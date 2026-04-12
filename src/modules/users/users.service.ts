import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  healthCheck() {
    return { message: 'Users module is running.' };
  }
}
