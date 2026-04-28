import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullModule as BullMQModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { NewsModule } from './modules/news/modules/news.module';
import { UsersModule } from './modules/users/modules/users.module';
import { KycModule } from './modules/kyc/modules/kyc.module';
import { AssetsModule } from './modules/assets/modules/assets.module';
import { PaymentModule } from './modules/payment/payment.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SupportModule } from './modules/support/support.module';
import { AuthModule } from './modules/auth/modules/auth.module';
import { DividendsModule } from './modules/dividends/modules/dividends.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { MarketMakerModule } from './modules/market-maker/market-maker.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ConfigModule } from '@nestjs/config';
import { PostsModule } from './modules/posts/posts.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { PositionsModule } from './modules/positions/positions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullMQModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
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
    AccountsModule,
    PositionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
