import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { KmsService } from '@/shared/services/kms.service';
import { AppConfigService } from '@/config/app-config.service';
import { AwsKmsSigner } from '@/shared/services/aws-kms-signer.service';

const DEFAULT_ABI = [
  'function addToWhitelist(address wallet) external returns (bool)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | AwsKmsSigner | null = null;
  private contract:
    | (ethers.BaseContract & {
        addToWhitelist: (
          walletAddress: string,
        ) => Promise<ethers.ContractTransactionResponse>;
      })
    | null = null;
  private readonly isEnabled: boolean;

  constructor(
    private readonly kmsService: KmsService,
    private readonly config: AppConfigService,
  ) {
    const rpcUrl = this.config.chainRpcUrl;
    const contractAddress = this.config.identityRegistryAddress;

    this.isEnabled = Boolean(rpcUrl && contractAddress);

    if (!this.isEnabled) {
      this.logger.warn(
        'CHAIN_RPC_URL or IDENTITY_REGISTRY_ADDRESS is not set. KYC blockchain operations are disabled.',
      );
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled || !this.provider) {
      return;
    }

    try {
      // Async initialization - get private key from KMS (or .env fallback)
      const privateKey = await this.kmsService.getAdminPrivateKey();
      const contractAddress = this.config.identityRegistryAddress;
      const rawAbi = this.config.identityRegistryAbiJson;

      if (!contractAddress) {
        throw new Error('IDENTITY_REGISTRY_ADDRESS is required');
      }

      const abi = rawAbi
        ? (JSON.parse(rawAbi) as unknown as ethers.InterfaceAbi)
        : DEFAULT_ABI;

      if (this.config.useAwsKms && this.kmsService.getClient()) {
        const keyId = this.config.chainKmsKeyId;
        const signerAddress = this.config.chainKmsSignerAddress;
        if (!keyId || !signerAddress) {
          throw new Error(
            'CHAIN_KMS_KEY_ID and CHAIN_KMS_SIGNER_ADDRESS are required',
          );
        }
        this.signer = new AwsKmsSigner(
          this.kmsService.getClient()!,
          keyId,
          signerAddress,
          this.provider,
        );
        this.logger.log('BlockchainService initialized with AwsKmsSigner');
      } else {
        const privateKey = await this.kmsService.getAdminPrivateKey();
        this.signer = new ethers.Wallet(privateKey, this.provider);
        this.logger.log(
          'BlockchainService initialized with plain/decrypted private key',
        );
      }

      this.contract = new ethers.Contract(
        contractAddress,
        abi,
        this.signer,
      ) as unknown as ethers.BaseContract & {
        addToWhitelist: (
          walletAddress: string,
        ) => Promise<ethers.ContractTransactionResponse>;
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `BlockchainService initialization failed: ${errorMessage}`,
      );
      throw error;
    }
  }

  private getContract(): ethers.BaseContract & {
    addToWhitelist: (
      walletAddress: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  } {
    if (!this.contract) {
      throw new InternalServerErrorException(
        'Blockchain service is not configured. Please set CHAIN_RPC_URL and IDENTITY_REGISTRY_ADDRESS.',
      );
    }

    return this.contract;
  }

  async addToWhitelist(walletAddress: string): Promise<{ txHash: string }> {
    try {
      const tx = await this.getContract().addToWhitelist(walletAddress);
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
