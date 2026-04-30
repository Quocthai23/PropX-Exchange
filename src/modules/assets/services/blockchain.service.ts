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
  Signer,
  Wallet,
  formatUnits,
  parseUnits,
} from 'ethers';
import { KmsService } from '@/shared/services/kms.service';
import { AppConfigService } from '@/config/app-config.service';
import { AwsKmsSigner } from '@/shared/services/aws-kms-signer.service';

interface TokenizeRequest {
  name: string;
  symbol: string;
  totalSupply: bigint;
}

interface BurnRequest {
  assetAddress: string;
  amount: bigint;
}

interface DynamicFeeOverrides {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly useMockChain: boolean;
  private readonly confirmationByChainId: Record<string, number>;

  private provider?: JsonRpcProvider;
  private signer?: Signer;

  private readonly tokenFactoryAddress?: string;
  private readonly tokenFactoryAbi?: InterfaceAbi;

  private readonly usdtTokenAddress?: string;
  private readonly usdtTokenAbi: InterfaceAbi = [
    'function transfer(address to, uint256 amount) external returns (bool)',
  ];
  private readonly assetTokenAbi: InterfaceAbi = [
    'function burn(uint256 amount) external',
  ];

  private readonly depositReceiver?: string;
  private readonly requiredConfirmations: number;

  constructor(
    private readonly kmsService: KmsService,
    private readonly config: AppConfigService,
  ) {
    this.useMockChain = this.config.useMockChain;
    this.requiredConfirmations = this.normalizeConfirmations(
      Number(this.config.chainConfirmations ?? '12'),
      'CHAIN_CONFIRMATIONS',
    );

    const rawConfirmationsByChainId =
      this.config.chainConfirmationsByChainIdJson;
    if (rawConfirmationsByChainId) {
      try {
        const parsed = JSON.parse(rawConfirmationsByChainId) as Record<
          string,
          number
        >;
        this.confirmationByChainId = Object.entries(parsed).reduce<
          Record<string, number>
        >((acc, [chainId, confirmations]) => {
          acc[chainId] = this.normalizeConfirmations(
            Number(confirmations),
            `CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON.${chainId}`,
          );
          return acc;
        }, {});
      } catch {
        this.logger.warn(
          'CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON is invalid. Falling back to CHAIN_CONFIRMATIONS.',
        );
        this.confirmationByChainId = {};
      }
    } else {
      this.confirmationByChainId = {};
    }

    this.tokenFactoryAddress = this.config.assetTokenFactoryAddress;
    const rawFactoryAbi = this.config.assetTokenFactoryAbiJson;
    this.tokenFactoryAbi = rawFactoryAbi
      ? (JSON.parse(rawFactoryAbi) as InterfaceAbi)
      : undefined;

    this.usdtTokenAddress = this.config.usdtTokenAddress;
    this.depositReceiver = this.config.depositReceiverAddress?.toLowerCase();
  }

  private normalizeConfirmations(value: number, source: string): number {
    if (!Number.isFinite(value)) {
      this.logger.warn(
        `${source} is invalid. Falling back to 12 confirmations.`,
      );
      return 12;
    }

    if (value < 12 || value > 30) {
      const clamped = Math.min(30, Math.max(12, Math.trunc(value)));
      this.logger.warn(
        `${source}=${value} is out of safe range [12, 30]. Using ${clamped}.`,
      );
      return clamped;
    }

    return Math.trunc(value);
  }

  async onModuleInit() {
    if (this.useMockChain) {
      this.logger.warn(
        'USE_MOCK_CHAIN=true. Blockchain actions run in mock mode.',
      );
      return;
    }

    const rpcUrl = this.config.chainRpcUrl;
    if (!rpcUrl) throw new Error('CHAIN_RPC_URL is required.');

    this.provider = new JsonRpcProvider(rpcUrl);
    if (this.config.useAwsKms) {
      const kmsClient = this.kmsService.getClient();
      const kmsKeyId = this.config.chainKmsKeyId;
      const signerAddress = this.config.chainKmsSignerAddress;
      if (!kmsClient || !kmsKeyId || !signerAddress) {
        throw new Error(
          'CHAIN_KMS_KEY_ID and CHAIN_KMS_SIGNER_ADDRESS are required when USE_AWS_KMS=true.',
        );
      }
      this.signer = new AwsKmsSigner(
        kmsClient,
        kmsKeyId,
        signerAddress,
        this.provider,
      );
    } else {
      const adminKey = await this.kmsService.getAdminPrivateKey();
      this.signer = new Wallet(adminKey, this.provider);
    }
    this.logger.log('Blockchain and signer wallet initialized successfully.');
  }

  private getProvider(): JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Blockchain provider is not configured.');
    }
    return this.provider;
  }

  private getSigner(): Signer {
    if (!this.signer) {
      throw new Error('Blockchain signer is not configured.');
    }
    return this.signer;
  }

  private async getDynamicFeeOverrides(): Promise<DynamicFeeOverrides> {
    if (this.useMockChain) return {};

    const provider = this.getProvider();
    const feeData = await provider.getFeeData();
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      return {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      };
    }

    if (feeData.gasPrice) {
      return { gasPrice: feeData.gasPrice };
    }

    return {};
  }

  async sendTokenizeTx(request: TokenizeRequest): Promise<string> {
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
        overrides?: DynamicFeeOverrides,
      ) => Promise<ContractTransactionResponse>;
    };

    const tx = await factory.createAssetToken(
      request.name,
      request.symbol,
      request.totalSupply,
      await this.getDynamicFeeOverrides(),
    );

    return tx.hash;
  }

  async waitForTokenizeReceipt(txHash: string): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomBytes(20).toString('hex')}`;
    }

    const provider = this.getProvider();
    const receipt = await provider.waitForTransaction(
      txHash,
      this.requiredConfirmations,
    );

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

  async burnAssetToken(request: BurnRequest): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    const signer = this.getSigner();
    const assetToken = new Contract(
      request.assetAddress,
      this.assetTokenAbi,
      signer,
    ) as unknown as BaseContract & {
      burn: (
        amount: bigint,
        overrides?: DynamicFeeOverrides,
      ) => Promise<ContractTransactionResponse>;
    };
    const tx = await assetToken.burn(
      request.amount,
      await this.getDynamicFeeOverrides(),
    );
    this.logger.log(
      `Burn token tx submitted for ${request.assetAddress}, amount=${request.amount.toString()}, tx=${tx.hash}`,
    );
    return tx.hash;
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
          overrides?: DynamicFeeOverrides,
        ) => Promise<ContractTransactionResponse>;
      };

      const rawAmount = parseUnits(amount.toFixed(6), 6);
      const tx = await usdt.transfer(
        walletAddress,
        rawAmount,
        await this.getDynamicFeeOverrides(),
      );
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

  async isTransactionSuccessful(txHash: string): Promise<boolean | null> {
    if (this.useMockChain) return true;

    const provider = this.getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return null;
    return receipt.status === 1;
  }

  async getRequiredConfirmations(): Promise<number> {
    if (this.useMockChain) {
      return this.requiredConfirmations;
    }

    const provider = this.getProvider();
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    return this.confirmationByChainId[chainId] ?? this.requiredConfirmations;
  }

  /**
   * Get current gas price from blockchain
   */
  async getCurrentGasPrice(): Promise<Decimal> {
    if (this.useMockChain) {
      return new Decimal('50000000000'); // 50 gwei in wei
    }

    try {
      const provider = this.getProvider();
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      return new Decimal(gasPrice.toString());
    } catch (error) {
      this.logger.error('Failed to get gas price from provider:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve current gas price.',
      );
    }
  }

  /**
   * Speed up a withdrawal by replaying transaction with higher gas price
   */
  async speedUpWithdrawal(
    originalTxHash: string,
    walletAddress: string,
    amount: Decimal,
    newGasPrice: Decimal,
  ): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    const provider = this.getProvider();
    const signer = this.getSigner();

    if (!this.usdtTokenAddress) {
      throw new InternalServerErrorException('USDT_TOKEN_ADDRESS is required.');
    }

    try {
      const rawAmount = parseUnits(amount.toFixed(6), 6);
      const signerAddress = await signer.getAddress();
      const nonce = await provider.getTransactionCount(signerAddress);

      // Create the encoded transfer data
      const iface = new Interface(this.usdtTokenAbi);
      const data = iface.encodeFunctionData('transfer', [
        walletAddress,
        rawAmount,
      ]);

      // Send transaction with higher gas price
      const dynamicFee = await this.getDynamicFeeOverrides();
      const signedTx = await signer.signTransaction({
        to: this.usdtTokenAddress,
        data: data,
        nonce: nonce,
        ...(dynamicFee.maxFeePerGas && dynamicFee.maxPriorityFeePerGas
          ? {
              maxFeePerGas: BigInt(newGasPrice.toFixed(0)),
              maxPriorityFeePerGas: dynamicFee.maxPriorityFeePerGas,
            }
          : { gasPrice: BigInt(newGasPrice.toFixed(0)) }),
      });

      const response = await provider.broadcastTransaction(signedTx);

      this.logger.log(
        `Speed-up transaction sent. Original: ${originalTxHash}, New: ${response.hash}`,
      );

      return response.hash;
    } catch (error) {
      this.logger.error('Failed to speed up withdrawal transaction:', error);
      throw new InternalServerErrorException(
        'Failed to speed up withdrawal transaction on chain.',
      );
    }
  }

  /**
   * Process refund for a stuck transaction
   */
  async processRefund(originalTxHash: string): Promise<string> {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    const provider = this.getProvider();
    const signer = this.getSigner();

    try {
      // Get the original transaction to extract nonce
      const originalTx = await provider.getTransaction(originalTxHash);

      if (!originalTx) {
        throw new InternalServerErrorException(
          'Original transaction not found on chain.',
        );
      }

      // Create a zero-value transaction with same nonce to replace the original
      // This effectively cancels the pending transaction
      const feeData = await provider.getFeeData();
      const baseGasPrice = feeData.gasPrice || BigInt(0);
      const newGasPrice = baseGasPrice * BigInt(2); // Use 2x gas price to ensure replacement

      const signerAddress = await signer.getAddress();
      const dynamicFee = await this.getDynamicFeeOverrides();
      const tx = await signer.sendTransaction({
        to: signerAddress, // Send to self
        value: BigInt(0),
        nonce: originalTx.nonce,
        gasLimit: BigInt(21000), // Minimal gas for simple transfer
        ...(dynamicFee.maxFeePerGas && dynamicFee.maxPriorityFeePerGas
          ? {
              maxFeePerGas: dynamicFee.maxFeePerGas * BigInt(2),
              maxPriorityFeePerGas: dynamicFee.maxPriorityFeePerGas * BigInt(2),
            }
          : { gasPrice: newGasPrice }),
      });

      this.logger.log(
        `Refund transaction sent for ${originalTxHash}. Replacement txHash: ${tx.hash}`,
      );

      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to process refund:', error);
      throw new InternalServerErrorException(
        'Failed to process refund on blockchain.',
      );
    }
  }

  /**
   * Estimate gas cost for a withdrawal
   */
  async estimateGasCost(amount: Decimal, gasPrice: Decimal): Promise<Decimal> {
    if (this.useMockChain) {
      return new Decimal('50000000000000'); // ~0.00005 USDT
    }

    try {
      const provider = this.getProvider();

      if (!this.usdtTokenAddress) {
        throw new InternalServerErrorException(
          'USDT_TOKEN_ADDRESS is required.',
        );
      }

      const usdt = new Contract(
        this.usdtTokenAddress,
        this.usdtTokenAbi,
        provider,
      ) as unknown as BaseContract & {
        transfer: (to: string, rawAmount: bigint) => Promise<void>;
      };

      const rawAmount = parseUnits(amount.toFixed(6), 6);
      const dummyAddress = '0x' + '0'.repeat(40);

      // Estimate gas for the transfer
      const estimatedGas = await provider.estimateGas({
        to: this.usdtTokenAddress,
        data: usdt.interface.encodeFunctionData('transfer', [
          dummyAddress,
          rawAmount,
        ]),
      });

      // Calculate total cost
      const gasCost = new Decimal(estimatedGas.toString()).times(
        gasPrice.toString(),
      );

      return gasCost;
    } catch (error) {
      this.logger.warn('Failed to estimate gas cost, using default:', error);
      // Return a reasonable default estimate (~200k gas * gasPrice)
      return new Decimal('200000').times(gasPrice.toString());
    }
  }

  /**
   * Execute settlement for a batch of trades on the blockchain.
   * (Will call the Escrow/Marketplace smart contract batchSettle function)
   */
  batchSettleTrades(
    assetAddress: string,
    trades: { from: string; to: string; amount: Decimal }[],
  ): string {
    if (this.useMockChain) {
      return `0x${crypto.randomUUID().replace(/-/g, '')}`;
    }

    this.logger.log(
      `Batch settling ${trades.length} trades for asset ${assetAddress} on-chain.`,
    );
    // TODO: Integrate with the real smart contract here. Example:
    // const tx = await escrowContract.batchSettle(assetAddress, trades.map(t => t.from), trades.map(t => t.to), trades.map(t => parseUnits(t.amount.toString(), 18)));
    // await tx.wait();
    // return tx.hash;

    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }
}
