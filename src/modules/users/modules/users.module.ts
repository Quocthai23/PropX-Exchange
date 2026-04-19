import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../services/users.service';
import { UsersController } from '../controllers/users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
