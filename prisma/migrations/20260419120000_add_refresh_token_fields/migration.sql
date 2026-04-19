-- AlterTable
ALTER TABLE `user`
  ADD COLUMN `refreshTokenHash` TEXT NULL,
  ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL;
