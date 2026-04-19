-- CreateTable
CREATE TABLE `NewsArticle` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `content` TEXT NULL,
    `url` TEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `language` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `keywords` TEXT NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NewsArticle_dedupeKey_key`(`dedupeKey`),
    INDEX `NewsArticle_source_publishedAt_idx`(`source`, `publishedAt` DESC),
    INDEX `NewsArticle_publishedAt_idx`(`publishedAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetValuationSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NULL,
    `areaCode` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `listingUrl` TEXT NULL,
    `price` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
    `landArea` DECIMAL(65, 30) NULL,
    `pricePerM2` DECIMAL(65, 30) NULL,
    `capturedAt` DATETIME(3) NOT NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssetValuationSnapshot_assetId_capturedAt_idx`(`assetId`, `capturedAt` DESC),
    INDEX `AssetValuationSnapshot_areaCode_capturedAt_idx`(`areaCode`, `capturedAt` DESC),
    INDEX `AssetValuationSnapshot_source_capturedAt_idx`(`source`, `capturedAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AssetValuationSnapshot` ADD CONSTRAINT `AssetValuationSnapshot_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
