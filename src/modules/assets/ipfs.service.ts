import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

type IpfsFileResult = {
  cid: string;
  uri: string;
};

@Injectable()
export class IpfsService {
  private readonly jwt: string;

  constructor() {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      throw new Error('PINATA_JWT is required for IPFS uploads.');
    }
    this.jwt = pinataJwt;
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
          Authorization: `Bearer ${this.jwt}`,
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
          Authorization: `Bearer ${this.jwt}`,
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
