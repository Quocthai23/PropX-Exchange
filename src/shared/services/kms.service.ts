import { Injectable, Logger } from '@nestjs/common';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);
  private kmsClient: KMSClient | null = null;
  private cachedDecryptedKey: string | null = null;

  constructor(private readonly config: AppConfigService) {
    const useKms = this.config.useAwsKms;

    if (useKms) {
      const accessKeyId = this.config.awsAccessKeyId;
      const secretAccessKey = this.config.awsSecretAccessKey;

      if (!accessKeyId || !secretAccessKey) {
        throw new Error(
          'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when USE_AWS_KMS=true',
        );
      }

      this.kmsClient = new KMSClient({
        region: this.config.awsRegion || 'us-east-1',
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('AWS KMS initialized for key decryption');
    } else {
      this.logger.warn(
        'USE_AWS_KMS is disabled. Using plaintext private key from .env (NOT PRODUCTION SAFE)',
      );
    }
  }

  /**
   * Get the admin private key for blockchain operations.
   * If USE_AWS_KMS=true, decrypt from KMS (production-secure).
   * Otherwise, return plaintext from env (dev/test only).
   *
   * SECURITY WARNING:
   * - In production, ALWAYS use AWS KMS or similar hardware security module.
   * - Never commit plaintext private keys to git.
   * - Monitor KMS key usage logs for suspicious access.
   */
  async getAdminPrivateKey(): Promise<string> {
    // If using plaintext dev mode
    if (!this.kmsClient) {
      const plainKey = this.config.chainAdminPrivateKeyPlain;
      if (!plainKey) {
        throw new Error('CHAIN_ADMIN_PRIVATE_KEY not configured in .env');
      }
      return plainKey;
    }

    // If using KMS, decrypt and cache
    if (this.cachedDecryptedKey) {
      return this.cachedDecryptedKey;
    }

    try {
      const encryptedKeyBase64 =
        this.config.chainAdminPrivateKeyEncryptedBase64;
      if (!encryptedKeyBase64) {
        throw new Error('CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED not configured');
      }

      const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');
      const command = new DecryptCommand({
        CiphertextBlob: encryptedKey,
      });

      this.logger.log(
        'Decrypting admin private key from AWS KMS (this may be slow on first call)',
      );
      const result = await this.kmsClient.send(command);

      if (!result.Plaintext) {
        throw new Error('KMS decryption returned empty plaintext');
      }

      const decryptedKey = Buffer.from(result.Plaintext).toString('utf-8');

      // Cache for this process (DO NOT store in file/DB)
      this.cachedDecryptedKey = decryptedKey;
      this.logger.log('Admin private key decrypted from KMS and cached');

      return decryptedKey;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to decrypt key from KMS: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Clear cached key (for security, can be called on graceful shutdown)
   */
  clearCache(): void {
    this.cachedDecryptedKey = null;
    this.logger.log('Cached private key cleared');
  }

  getClient(): KMSClient | null {
    return this.kmsClient;
  }
}
