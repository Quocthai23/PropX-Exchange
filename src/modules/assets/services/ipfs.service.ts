import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

type IpfsFileResult = {
  cid: string;
  uri: string;
};

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly jwt: string | undefined;

  constructor() {
    this.jwt = process.env.PINATA_JWT;
    if (!this.jwt) {
      this.logger.warn(
        'PINATA_JWT is not set. IPFS upload features are disabled until configured.',
      );
    }
  }

  private getJwt(): string {
    if (!this.jwt) {
      throw new InternalServerErrorException(
        'PINATA_JWT is required for IPFS uploads.',
      );
    }

    return this.jwt;
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<IpfsFileResult> {
    if (!fileBuffer.length) {
      throw new BadRequestException('File is empty.');
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, fileName);

    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getJwt()}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to upload file to IPFS.');
    }

    const json = (await response.json()) as { IpfsHash?: string };
    if (!json.IpfsHash) {
      throw new InternalServerErrorException('Invalid IPFS response format.');
    }

    return {
      cid: json.IpfsHash,
      uri: `ipfs://${json.IpfsHash}`,
    };
  }

  async pinJson(payload: unknown): Promise<IpfsFileResult> {
    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getJwt()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Failed to pin metadata JSON to IPFS.',
      );
    }

    const json = (await response.json()) as { IpfsHash?: string };
    if (!json.IpfsHash) {
      throw new InternalServerErrorException(
        'Invalid IPFS JSON response format.',
      );
    }

    return {
      cid: json.IpfsHash,
      uri: `ipfs://${json.IpfsHash}`,
    };
  }
}
