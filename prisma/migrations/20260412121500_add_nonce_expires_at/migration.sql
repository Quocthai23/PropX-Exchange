-- Add nonce expiration support for wallet signature verification
ALTER TABLE `User`
ADD COLUMN `nonceExpiresAt` DATETIME(3) NULL;
