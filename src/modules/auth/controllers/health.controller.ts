import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { Transport, RedisOptions } from '@nestjs/microservices';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppConfigService } from '@/config/app-config.service';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check liveness status of Database and Redis' })
  check() {
    let redisOpts: any = {
      host: this.config.redisHost,
      port: this.config.redisPort,
    };
    
    const urlStr = this.config.redisUrl;
    if (urlStr) {
      try {
        const parsed = new URL(urlStr);
        redisOpts = {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          username: parsed.username || undefined,
          password: parsed.password || undefined,
          tls: parsed.protocol === 'rediss:' ? {} : undefined,
        };
      } catch (e) {
        // fallback to default
      }
    }

    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () =>
        this.microservice.pingCheck<RedisOptions>('redis', {
          transport: Transport.REDIS,
          options: redisOpts,
        }),
    ]);
  }
}
