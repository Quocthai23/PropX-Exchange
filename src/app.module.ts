import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { NewsModule } from './modules/news/news.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TransactionsModule } from './modules/assets/transactions.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SupportModule } from './modules/support/support.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
