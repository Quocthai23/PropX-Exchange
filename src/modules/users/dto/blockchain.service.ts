import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  addToWhitelist(walletAddress: string): boolean {
    this.logger.log(
      `[Blockchain] Calling smart contract to whitelist wallet: ${walletAddress}`,
    );

    try {

      // await contract.addToWhitelist(walletAddress);
      return true;
    } catch (error) {
      this.logger.error(
        `[Blockchain] Error while whitelisting wallet ${walletAddress}`,
        error,
      );
      throw new Error('Unable to add wallet to smart contract whitelist.');
    }
  }
}
