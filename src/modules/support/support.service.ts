import { Injectable } from '@nestjs/common';

@Injectable()
export class SupportService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(_createSupportDto: any) {
    return 'This action adds a new support';
  }

  findAll() {
    return `This action returns all support`;
  }

  findOne(id: number) {
    return `This action returns a #${id} support`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, _updateSupportDto: any) {
    return `This action updates a #${id} support`;
  }

  remove(id: number) {
    return `This action removes a #${id} support`;
  }
}
