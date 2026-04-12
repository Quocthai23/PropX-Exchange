import { Injectable } from '@nestjs/common';

@Injectable()
export class NewsService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(_createNewsDto: any) {
    return 'This action adds a new news';
  }

  findAll() {
    return `This action returns all news`;
  }

  findOne(id: number) {
    return `This action returns a #${id} news`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, _updateNewsDto: any) {
    return `This action updates a #${id} news`;
  }

  remove(id: number) {
    return `This action removes a #${id} news`;
  }
}
