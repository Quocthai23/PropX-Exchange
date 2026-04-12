import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../users/dto/roles.guard';
import { Roles } from '../users/dto/roles.decorator';

type UploadedAssetFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  listAssets() {
    return this.assetsService.listAll();
  }

  @Get(':id')
  getAsset(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findById(id);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createAsset(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.createAsset(createAssetDto);
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLegalDocument(
    @Param('id', ParseUUIDPipe) assetId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .addFileTypeValidator({ fileType: /(pdf|png|jpg|jpeg)$/i })
        .build({ fileIsRequired: true }),
    )
    file: UploadedAssetFile,
  ) {
    return this.assetsService.uploadLegalDocs(
      assetId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post(':id/tokenize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async tokenizeAsset(@Param('id', ParseUUIDPipe) assetId: string) {
    return this.assetsService.tokenizeAsset(assetId);
  }
}
