-- AlterTable
ALTER TABLE `asset` ADD COLUMN `auditReportUrl` VARCHAR(191) NULL,
    ADD COLUMN `legalDocsIpfs` VARCHAR(191) NULL,
    ADD COLUMN `spvName` VARCHAR(191) NULL,
    ADD COLUMN `tokenStandard` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `balance` ADD COLUMN `avgCostPrice` DECIMAL(65, 30) NULL;

-- AlterTable
ALTER TABLE `kycrecord` ADD COLUMN `onChainWhitelisted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whitelistTxHash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `transaction` MODIFY `type` ENUM('DEPOSIT', 'WITHDRAW', 'TRANSFER', 'TRADE_BUY', 'TRADE_SELL', 'DIVIDEND', 'FEE', 'MINT', 'BURN', 'DIVIDEND_CLAIM') NOT NULL;

-- CreateTable
CREATE TABLE `AssetOnboardingRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `location` VARCHAR(191) NULL,
    `estimatedValue` DECIMAL(65, 30) NOT NULL,
    `legalDocuments` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPRAISING', 'APPROVED', 'REJECTED', 'TOKENIZED') NOT NULL DEFAULT 'PENDING',
    `adminNotes` TEXT NULL,
    `appraisedValue` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssetOnboardingRequest_userId_status_createdAt_idx`(`userId`, `status`, `createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetRedemptionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `tokenQuantity` DECIMAL(65, 30) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING_LEGAL', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `legalTransferDocs` JSON NULL,
    `burnTxHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssetRedemptionRequest_userId_status_createdAt_idx`(`userId`, `status`, `createdAt` DESC),
    INDEX `AssetRedemptionRequest_assetId_status_createdAt_idx`(`assetId`, `status`, `createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DaoProposal` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `proposerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `snapshotDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'PASSED', 'REJECTED', 'EXECUTED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DaoProposal_assetId_status_endDate_idx`(`assetId`, `status`, `endDate`),
    INDEX `DaoProposal_proposerId_createdAt_idx`(`proposerId`, `createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DaoVotingSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `votingPower` DECIMAL(65, 30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DaoVotingSnapshot_proposalId_votingPower_idx`(`proposalId`, `votingPower` DESC),
    UNIQUE INDEX `DaoVotingSnapshot_proposalId_userId_key`(`proposalId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProposalVote` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `isFor` BOOLEAN NOT NULL,
    `votingPower` DECIMAL(65, 30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProposalVote_proposalId_createdAt_idx`(`proposalId`, `createdAt` DESC),
    INDEX `ProposalVote_userId_createdAt_idx`(`userId`, `createdAt` DESC),
    UNIQUE INDEX `ProposalVote_proposalId_userId_key`(`proposalId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AssetOnboardingRequest` ADD CONSTRAINT `AssetOnboardingRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetRedemptionRequest` ADD CONSTRAINT `AssetRedemptionRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetRedemptionRequest` ADD CONSTRAINT `AssetRedemptionRequest_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DaoProposal` ADD CONSTRAINT `DaoProposal_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DaoProposal` ADD CONSTRAINT `DaoProposal_proposerId_fkey` FOREIGN KEY (`proposerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DaoVotingSnapshot` ADD CONSTRAINT `DaoVotingSnapshot_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `DaoProposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DaoVotingSnapshot` ADD CONSTRAINT `DaoVotingSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProposalVote` ADD CONSTRAINT `ProposalVote_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `DaoProposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProposalVote` ADD CONSTRAINT `ProposalVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
