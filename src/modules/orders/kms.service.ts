import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private adminPrivateKey: string | null = null;
  private kmsClient: KMSClient;

  constructor(private readonly config: AppConfigService) {
    this.kmsClient = new KMSClient({
      region: this.config.awsRegion || 'us-east-1',
    });
  }

  async onModuleInit() {
    if (this.config.useAwsKms) {
      this.logger.log('Initializing AWS KMS to decrypt admin private key...');
      try {
        const encryptedKey = this.config.chainAdminPrivateKeyEncryptedBase64;
        if (!encryptedKey)
          throw new Error(
            'Missing CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED environment variable',
          );

        const command = new DecryptCommand({
          CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
        });
        const response = await this.kmsClient.send(command);
        this.adminPrivateKey = Buffer.from(response.Plaintext!).toString(
          'utf-8',
        );
        this.logger.log(
          'Admin private key decrypted successfully (stored in RAM).',
        );
      } catch (error) {
        this.logger.error(
          'KMS decryption error. Please check AWS KMS configuration.',
          error,
        );
        process.exit(1);
      }
    } else {
      this.logger.warn(
        'USE_AWS_KMS=false. Using admin private key from .env (dev only).',
      );
      this.adminPrivateKey = this.config.chainAdminPrivateKeyPlain || null;
    }
  }

  getAdminPrivateKey(): string {
    if (!this.adminPrivateKey)
      throw new Error('Admin private key has not been initialized.');
    return this.adminPrivateKey;
  }
}
