import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  @Get('presigned-url')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get presigned URL for image upload' })
  async getPresignedUrl(@Query('files') files: string = '1') {
    const count = parseInt(files, 10);
    const results: { key: string; uploadURL: string }[] = [];
    for (let i = 0; i < count; i++) {
      const key = `temp-${Date.now()}-${i}`;
      // For local development, we point the upload URL to our own upload endpoint
      // In production, this would be a Cloudflare/AWS S3 presigned URL
      results.push({
        key,
        uploadURL: `${process.env.API_BASE_URL || 'http://localhost:3001'}/images/upload`,
      });
    }
    return results;
  }

  @Post('upload')
  @ApiOperation({ summary: 'Direct image upload' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const baseUrl = process.env.CDN_BASE_URL || 'http://localhost:3001';
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;
    
    // Return the format expected by the frontend imageService.ts
    return {
      success: true,
      result: {
        variants: [fileUrl],
        id: fileUrl.split('/').pop(),
        filename: file.originalname,
        uploaded: new Date().toISOString(),
      },
    };
  }
}
