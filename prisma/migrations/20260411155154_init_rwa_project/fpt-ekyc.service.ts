import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

@Injectable()
export class FptEkycService {
    private readonly logger = new Logger(FptEkycService.name);
    // Khuyến cáo: Nên cấu hình key này trong file .env (VD: FPT_AI_API_KEY=...)
    private readonly apiKey = process.env.FPT_AI_API_KEY || '751q7JtJMBwTrtGCQThIoGP0ZUw1yCCZ';

    constructor(private readonly httpService: HttpService) { }

    // So sánh mặt trên CCCD và ảnh Selfie bằng endpoint /dmp/checkface/v1
    async compareFaces(idImageBuffer: Buffer, selfieBuffer: Buffer): Promise<number> {
        const formData = new FormData();

        // API yêu cầu key là 'file[]' cho cả 2 ảnh theo cURL của bạn
        formData.append('file[]', idImageBuffer, { filename: 'id.jpg' });
        formData.append('file[]', selfieBuffer, { filename: 'selfie.jpg' });

        try {
            const response = await firstValueFrom(
                this.httpService.post('https://api.fpt.ai/dmp/checkface/v1', formData, {
                    headers: {
                        'api-key': this.apiKey,
                        ...formData.getHeaders(),
                    },
                }),
            );

            // API FPT trả về điểm số ở dạng string hoặc number trong response.data.data.similarity
            const similarity = response.data?.data?.similarity;
            return parseFloat(similarity) || 0;
        } catch (error) {
            this.logger.error('FPT FaceMatch Error', error?.response?.data || error.message);
            throw new HttpException('Lỗi đối chiếu khuôn mặt. Vui lòng thử lại.', HttpStatus.BAD_REQUEST);
        }
    }
}