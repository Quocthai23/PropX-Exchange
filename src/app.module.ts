import { Module } from '@nestjs/common';
import { BullModule as BullMQModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NewsModule } from '@/modules/news/news.module';
import { UsersModule } from '@/modules/users/users.module';
import { KycModule } from '@/modules/kyc/kyc.module';
import { AssetsModule } from '@/modules/assets/assets.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { SupportModule } from '@/modules/support/support.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { DividendsModule } from '@/modules/dividends/dividends.module';
import { MarketDataModule } from '@/modules/market-data/market-data.module';
import { MarketMakerModule } from '@/modules/market-maker/market-maker.module';
import { SettlementModule } from '@/modules/settlement/settlement.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostsModule } from '@/modules/posts/posts.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@/modules/auth/winston.config';
import { validateEnv, type ValidatedEnv } from '@/config/env.validation';
import { AppConfigModule } from '@/config/app-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'short',
        ttl: 300000,
        limit: 3,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    BullMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ValidatedEnv, true>) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),
    NewsModule,
    UsersModule,
    KycModule,
    AssetsModule,
    PaymentModule,
    OrdersModule,
    SupportModule,
    AuthModule,
    DividendsModule,
    MarketDataModule,
    MarketMakerModule,
    SettlementModule,
    RealtimeModule,
    PostsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
