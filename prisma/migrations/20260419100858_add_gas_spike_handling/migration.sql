/*
  Warnings:

  - You are about to drop the column `apy` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `totalValuation` on the `asset` table. All the data in the column will be lost.
  - You are about to alter the column `totalSupply` on the `asset` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `tokenPrice` on the `asset` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `available` on the `balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `locked` on the `balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `status` on the `kycrecord` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(8))` to `VarChar(191)`.
  - You are about to alter the column `side` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `VarChar(191)`.
  - You are about to alter the column `price` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `quantity` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `filledQuantity` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `status` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(7))` to `VarChar(191)`.
  - You are about to alter the column `type` on the `transaction` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `VarChar(191)`.
  - You are about to alter the column `amount` on the `transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,4)` to `Decimal(65,30)`.
  - You are about to alter the column `status` on the `transaction` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(5))` to `VarChar(191)`.
  - You are about to drop the column `nonce` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `nonceExpiresAt` on the `user` table. All the data in the column will be lost.
  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `VarChar(191)`.
  - You are about to alter the column `kycStatus` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(6))` to `VarChar(191)`.
  - You are about to drop the `candlestick` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dividend` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `newsarticle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rewardhistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `supportticket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticketmessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trade` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[txHash]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[symbol]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryId` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedPrivateKey` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Balance` DROP FOREIGN KEY `Balance_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `Balance` DROP FOREIGN KEY `Balance_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Candlestick` DROP FOREIGN KEY `Candlestick_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `Dividend` DROP FOREIGN KEY `Dividend_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `KycRecord` DROP FOREIGN KEY `KycRecord_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Order` DROP FOREIGN KEY `Order_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `Order` DROP FOREIGN KEY `Order_userId_fkey`;

-- DropForeignKey
ALTER TABLE `RewardHistory` DROP FOREIGN KEY `RewardHistory_userId_fkey`;

-- DropForeignKey
ALTER TABLE `SupportTicket` DROP FOREIGN KEY `SupportTicket_userId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketMessage` DROP FOREIGN KEY `TicketMessage_senderId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketMessage` DROP FOREIGN KEY `TicketMessage_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `Trade` DROP FOREIGN KEY `Trade_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `Transaction` DROP FOREIGN KEY `Transaction_userId_fkey`;

-- DropIndex
DROP INDEX `Balance_assetId_fkey` ON `Balance`;

-- DropIndex
DROP INDEX `Order_assetId_fkey` ON `Order`;

-- DropIndex
DROP INDEX `Order_userId_fkey` ON `Order`;

-- DropIndex
DROP INDEX `Transaction_userId_fkey` ON `Transaction`;

-- AlterTable
ALTER TABLE `Asset` DROP COLUMN `apy`,
    DROP COLUMN `images`,
    DROP COLUMN `location`,
    DROP COLUMN `status`,
    DROP COLUMN `totalValuation`,
    ADD COLUMN `categoryId` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `expectedApy` DECIMAL(65, 30) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isHot` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `logo` VARCHAR(191) NULL,
    ADD COLUMN `txHash` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `totalSupply` DECIMAL(65, 30) NOT NULL,
    MODIFY `tokenPrice` DECIMAL(65, 30) NOT NULL;

-- AlterTable
ALTER TABLE `Balance` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `available` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    MODIFY `locked` DECIMAL(65, 30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `KycRecord` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD COLUMN `type` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `side` VARCHAR(191) NOT NULL,
    MODIFY `price` DECIMAL(65, 30) NULL,
    MODIFY `quantity` DECIMAL(65, 30) NOT NULL,
    MODIFY `filledQuantity` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    MODIFY `status` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `confirmations` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `fee` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    ADD COLUMN `gasPrice` DECIMAL(65, 30) NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD COLUMN `lastGasPrice` DECIMAL(65, 30) NULL,
    ADD COLUMN `refundStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    ADD COLUMN `refundTxHash` VARCHAR(191) NULL,
    ADD COLUMN `speedUpAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stuckSince` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `type` VARCHAR(191) NOT NULL,
    MODIFY `amount` DECIMAL(65, 30) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `nonce`,
    DROP COLUMN `nonceExpiresAt`,
    ADD COLUMN `encryptedPrivateKey` TEXT NOT NULL,
    MODIFY `email` VARCHAR(191) NOT NULL,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'INVESTOR',
    MODIFY `kycStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE';

-- DropTable
DROP TABLE `Candlestick`;

-- DropTable
DROP TABLE `Dividend`;

-- DropTable
DROP TABLE `NewsArticle`;

-- DropTable
DROP TABLE `RewardHistory`;

-- DropTable
DROP TABLE `SupportTicket`;

-- DropTable
DROP TABLE `TicketMessage`;

-- DropTable
DROP TABLE `Trade`;

-- CreateTable
CREATE TABLE `Otp` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Otp_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GasSpeedUpAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `previousTxHash` VARCHAR(191) NOT NULL,
    `newTxHash` VARCHAR(191) NOT NULL,
    `oldGasPrice` DECIMAL(65, 30) NOT NULL,
    `newGasPrice` DECIMAL(65, 30) NOT NULL,
    `gasFeePaid` DECIMAL(65, 30) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `performedBy` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateAction` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `type` ENUM('DIVIDEND', 'DEPRECIATION', 'LIQUIDATION') NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `recordDate` DATETIME(3) NOT NULL,
    `executionDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Asset_txHash_key` ON `Asset`(`txHash`);

-- CreateIndex
CREATE UNIQUE INDEX `Asset_symbol_key` ON `Asset`(`symbol`);

-- CreateIndex
CREATE UNIQUE INDEX `Order_idempotencyKey_key` ON `Order`(`idempotencyKey`);

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_idempotencyKey_key` ON `Transaction`(`idempotencyKey`);

-- AddForeignKey
ALTER TABLE `GasSpeedUpAttempt` ADD CONSTRAINT `GasSpeedUpAttempt_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateAction` ADD CONSTRAINT `CorporateAction_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
