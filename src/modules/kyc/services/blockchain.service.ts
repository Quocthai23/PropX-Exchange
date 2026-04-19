import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { KmsService } from '../../../shared/services/kms.service';

const DEFAULT_ABI = [
  'function addToWhitelist(address wallet) external returns (bool)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private contract: ethers.BaseContract & {
    addToWhitelist: (
      walletAddress: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  };

  constructor(private readonly kmsService: KmsService) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    const contractAddress = process.env.IDENTITY_REGISTRY_ADDRESS;

    if (!rpcUrl || !contractAddress) {
      throw new Error(
        'CHAIN_RPC_URL and IDENTITY_REGISTRY_ADDRESS are required.',
      );
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async onModuleInit(): Promise<void> {
    try {
      // Async initialization - get private key from KMS (or .env fallback)
      const privateKey = await this.kmsService.getAdminPrivateKey();
      const contractAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
      const rawAbi = process.env.IDENTITY_REGISTRY_ABI_JSON;

      if (!contractAddress) {
        throw new Error('IDENTITY_REGISTRY_ADDRESS is required');
      }

      const abi = rawAbi
        ? (JSON.parse(rawAbi) as unknown as ethers.InterfaceAbi)
        : DEFAULT_ABI;

      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        contractAddress,
        abi,
        this.signer,
      ) as unknown as ethers.BaseContract & {
        addToWhitelist: (
          walletAddress: string,
        ) => Promise<ethers.ContractTransactionResponse>;
      };

      this.logger.log(
        'BlockchainService initialized with KMS-managed private key',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `BlockchainService initialization failed: ${errorMessage}`,
      );
      throw error;
    }
  }

  async addToWhitelist(walletAddress: string): Promise<{ txHash: string }> {
    try {
      const tx = await this.contract.addToWhitelist(walletAddress);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new InternalServerErrorException(
          'Blockchain transaction failed to confirm.',
        );
      }

      return { txHash: tx.hash };
    } catch {
      throw new InternalServerErrorException(
        'Failed to add wallet to identity registry.',
      );
    }
  }
}
