import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import {
  BaseContract,
  Contract,
  ContractTransactionResponse,
  Interface,
  InterfaceAbi,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
} from 'ethers';
import { KmsService } from '../../../shared/services/kms.service';

type TokenizeRequest = {
  name: string;
  symbol: string;
  totalSupply: bigint;
};

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly useMockChain: boolean;

  private provider?: JsonRpcProvider;
  private signer?: Wallet;

  private readonly tokenFactoryAddress?: string;
  private readonly tokenFactoryAbi?: InterfaceAbi;

  private readonly usdtTokenAddress?: string;
  private readonly usdtTokenAbi: InterfaceAbi = [
    'function transfer(address to, uint256 amount) external returns (bool)',
  ];

  private readonly depositReceiver?: string;
  private readonly requiredConfirmations: number;

  constructor(private readonly kmsService: KmsService) {
    this.useMockChain = process.env.USE_MOCK_CHAIN === 'true';
    this.requiredConfirmations = Number(process.env.CHAIN_CONFIRMATIONS ?? '1');

    this.tokenFactoryAddress = process.env.ASSET_TOKEN_FACTORY_ADDRESS;
    const rawFactoryAbi = process.env.ASSET_TOKEN_FACTORY_ABI_JSON;
    this.tokenFactoryAbi = rawFactoryAbi
      ? (JSON.parse(rawFactoryAbi) as InterfaceAbi)
      : undefined;

    this.usdtTokenAddress = process.env.USDT_TOKEN_ADDRESS;
    this.depositReceiver = process.env.DEPOSIT_RECEIVER_ADDRESS?.toLowerCase();
  }

  async onModuleInit() {
    if (this.useMockChain) {
      this.logger.warn('USE_MOCK_CHAIN=true. Blockchain actions run in mock mode.');
      return;
    }

    const rpcUrl = process.env.CHAIN_RPC_URL;
    if (!rpcUrl) throw new Error('CHAIN_RPC_URL is required.');


    const adminKey = await this.kmsService.getAdminPrivateKey();
    
    this.provider = new JsonRpcProvider(rpcUrl);
    this.signer = new Wallet(adminKey, this.provider);
    this.logger.log('Blockchain and signer wallet initialized successfully.');
  }

  private getProvider(): JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Blockchain provider is not configured.');
    }
    return this.provider;
  }

  private getSigner(): Wallet {
    if (!this.signer) {
      throw new Error('Blockchain signer is not configured.');
    }
    return this.signer;
  }

  async sendTokenizeTx(
    request: TokenizeRequest,
  ): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    const signer = this.getSigner();

    if (!this.tokenFactoryAddress || !this.tokenFactoryAbi) {
      throw new InternalServerErrorException(
        'ASSET_TOKEN_FACTORY_ADDRESS and ASSET_TOKEN_FACTORY_ABI_JSON are required.',
      );
    }

    const factory = new Contract(
      this.tokenFactoryAddress,
      this.tokenFactoryAbi,
      signer,
    ) as unknown as BaseContract & {
      createAssetToken: (
        name: string,
        symbol: string,
        totalSupply: bigint,
      ) => Promise<ContractTransactionResponse>;
    };

    const tx = await factory.createAssetToken(
      request.name,
      request.symbol,
      request.totalSupply,
    );

    return tx.hash;
  }

  async waitForTokenizeReceipt(txHash: string): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomBytes(20).toString('hex')}`;
    }

    const provider = this.getProvider();
    const receipt = await provider.waitForTransaction(txHash, this.requiredConfirmations);

    if (!receipt || receipt.status !== 1) {
      throw new InternalServerErrorException(
        'Asset tokenization transaction failed.',
      );
    }

    if (!this.tokenFactoryAbi) {
      throw new InternalServerErrorException(
        'ASSET_TOKEN_FACTORY_ABI_JSON is required for receipt parsing.',
      );
    }

    const tokenFactoryInterface = new Interface(this.tokenFactoryAbi);

    const tokenAddress = receipt.logs
      .map((log) => {
        try {
          return tokenFactoryInterface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event?.name === 'AssetTokenCreated')?.args?.[0] as
      | string
      | undefined;

    if (!tokenAddress) {
      throw new InternalServerErrorException(
        'AssetTokenCreated event not found.',
      );
    }

    return tokenAddress;
  }

  async verifyDeposit(
    txHash: string,
    expectedAmount: Decimal,
    walletAddress: string,
  ): Promise<boolean> {
    if (this.useMockChain) {
      return true;
    }

    const provider = this.getProvider();

    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt || receipt.status !== 1) {
      return false;
    }

    const senderMatches = tx.from.toLowerCase() === walletAddress.toLowerCase();
    if (!senderMatches) {
      return false;
    }

    if (this.depositReceiver && tx.to?.toLowerCase() !== this.depositReceiver) {
      return false;
    }

    const onChainAmount = new Decimal(formatUnits(tx.value, 18));
    return onChainAmount.greaterThanOrEqualTo(expectedAmount);
  }

  async executeWithdrawal(
    walletAddress: string,
    amount: Decimal,
  ): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    const signer = this.getSigner();

    if (!this.usdtTokenAddress) {
      throw new InternalServerErrorException('USDT_TOKEN_ADDRESS is required.');
    }

    try {
      const usdt = new Contract(
        this.usdtTokenAddress,
        this.usdtTokenAbi,
        signer,
      ) as unknown as BaseContract & {
        transfer: (
          to: string,
          rawAmount: bigint,
        ) => Promise<ContractTransactionResponse>;
      };

      const rawAmount = parseUnits(amount.toFixed(6), 6);
      const tx = await usdt.transfer(walletAddress, rawAmount);
      const receipt = await tx.wait(this.requiredConfirmations);

      if (!receipt || receipt.status !== 1) {
        throw new InternalServerErrorException(
          'Withdrawal transaction failed.',
        );
      }

      return tx.hash;
    } catch {
      throw new InternalServerErrorException(
        'Failed to execute withdrawal transaction on chain.',
      );
    }
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    if (this.useMockChain) return 15;

    const provider = this.getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    

    if (!receipt) return 0;
    

    const currentBlock = await provider.getBlockNumber();
    return currentBlock - receipt.blockNumber + 1;
  }
}

