import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { NewsModule } from './modules/news/modules/news.module';
import { UsersModule } from './modules/users/modules/users.module';
import { KycModule } from './modules/kyc/modules/kyc.module';
import { AssetsModule } from './modules/assets/modules/assets.module';
import { TransactionsModule } from './modules/assets/modules/transactions.module';
import { OrdersModule } from './modules/orders/modules/orders.module';
import { SupportModule } from './modules/support/modules/support.module';
import { AuthModule } from './modules/auth/modules/auth.module';
import { DividendsModule } from './modules/dividends/modules/dividends.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { MarketMakerModule } from './modules/market-maker/market-maker.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
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
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    NewsModule,
    UsersModule,
    KycModule,
    AssetsModule,
    TransactionsModule,
    OrdersModule,
    SupportModule,
    AuthModule,
    DividendsModule,
    MarketDataModule,
    MarketMakerModule,
    SettlementModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
