import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private adminPrivateKey: string | null = null;
  private kmsClient: KMSClient;

  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',

    });
  }

  async onModuleInit() {
    if (process.env.USE_AWS_KMS === 'true') {
      this.logger.log('Initializing AWS KMS to decrypt admin private key...');
      try {
        const encryptedKey = process.env.CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED;
        if (!encryptedKey) throw new Error('Missing CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED environment variable');

        const command = new DecryptCommand({
          CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
        });
        const response = await this.kmsClient.send(command);
        this.adminPrivateKey = Buffer.from(response.Plaintext!).toString('utf-8');
        this.logger.log('Admin private key decrypted successfully (stored in RAM).');
      } catch (error) {
        this.logger.error('KMS decryption error. Please check AWS KMS configuration.', error);
        process.exit(1);
      }
    } else {
      this.logger.warn('USE_AWS_KMS=false. Using admin private key from .env (dev only).');
      this.adminPrivateKey = process.env.CHAIN_ADMIN_PRIVATE_KEY || null;
    }
  }

  getAdminPrivateKey(): string {
    if (!this.adminPrivateKey) throw new Error('Admin private key has not been initialized.');
    return this.adminPrivateKey;
  }
}
