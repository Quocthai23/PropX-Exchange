import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator, MicroserviceHealthIndicator } from '@nestjs/terminus';
import { Transport, RedisOptions } from '@nestjs/microservices';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check liveness status of Database and Redis' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.microservice.pingCheck<RedisOptions>('redis', {
        transport: Transport.REDIS,
        options: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      }),
    ]);
  }
}

