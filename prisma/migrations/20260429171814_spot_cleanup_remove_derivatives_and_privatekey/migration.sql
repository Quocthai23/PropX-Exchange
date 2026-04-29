/*
  Warnings:

  - You are about to drop the column `leverage` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedPrivateKey` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `position` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `position` DROP FOREIGN KEY `Position_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `position` DROP FOREIGN KEY `Position_userId_fkey`;

-- AlterTable
ALTER TABLE `account` DROP COLUMN `leverage`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `encryptedPrivateKey`,
    MODIFY `walletAddress` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `position`;
