import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from './services/users.service';
import { UserPortfolioService } from './services/user-portfolio.service';
import { UserRelationsService } from './services/user-relations.service';
import { UsersController } from './controllers/users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserPortfolioService, UserRelationsService, PrismaService],
})
export class UsersModule {}
