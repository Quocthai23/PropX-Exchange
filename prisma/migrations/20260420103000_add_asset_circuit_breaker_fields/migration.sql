-- AlterTable
ALTER TABLE `Asset`
    ADD COLUMN `referencePrice` DECIMAL(65, 30) NULL,
    ADD COLUMN `priceBandPercentage` DECIMAL(65, 30) NOT NULL DEFAULT 0.07,
    ADD COLUMN `tradingStatus` VARCHAR(191) NOT NULL DEFAULT 'OPEN';
