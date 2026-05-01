import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class AuthRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthRedisService.name);
  private readonly redisClient: RedisClientType;

  constructor(private readonly config: AppConfigService) {
    this.redisClient = createClient({
      socket: {
        host: this.config.redisHost,
        port: this.config.redisPort,
      },
      password: this.config.redisPassword,
    });
    this.redisClient.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.redisClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
  }

  getClient(): RedisClientType {
    return this.redisClient;
  }
}
