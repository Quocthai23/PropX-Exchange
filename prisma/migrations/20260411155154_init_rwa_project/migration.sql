-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `walletAddress` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `role` ENUM('INVESTOR', 'ADMIN') NOT NULL DEFAULT 'INVESTOR',
    `kycStatus` ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE',
    `nonce` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_walletAddress_key`(`walletAddress`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KycRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `dob` DATETIME(3) NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `idFrontImg` VARCHAR(191) NOT NULL,
    `idBackImg` VARCHAR(191) NOT NULL,
    `selfieImg` VARCHAR(191) NOT NULL,
    `status` ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KycRecord_userId_key`(`userId`),
    UNIQUE INDEX `KycRecord_idNumber_key`(`idNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `contractAddress` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `images` JSON NOT NULL,
    `totalValuation` DECIMAL(20, 4) NOT NULL,
    `totalSupply` DECIMAL(20, 4) NOT NULL,
    `tokenPrice` DECIMAL(20, 4) NOT NULL,
    `apy` DECIMAL(5, 2) NOT NULL,
    `status` ENUM('LISTING', 'FUNDED', 'TRADING') NOT NULL DEFAULT 'LISTING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Asset_contractAddress_key`(`contractAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Balance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NULL,
    `available` DECIMAL(20, 4) NOT NULL DEFAULT 0,
    `locked` DECIMAL(20, 4) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Balance_userId_assetId_key`(`userId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('DEPOSIT', 'WITHDRAW', 'DIVIDEND') NOT NULL,
    `amount` DECIMAL(20, 4) NOT NULL,
    `txHash` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Transaction_txHash_key`(`txHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `side` ENUM('BUY', 'SELL') NOT NULL,
    `price` DECIMAL(20, 4) NOT NULL,
    `quantity` DECIMAL(20, 4) NOT NULL,
    `filledQuantity` DECIMAL(20, 4) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'PARTIAL', 'FILLED', 'CANCELED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trade` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(20, 4) NOT NULL,
    `quantity` DECIMAL(20, 4) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Candlestick` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` VARCHAR(191) NOT NULL,
    `timeframe` VARCHAR(191) NOT NULL,
    `open` DECIMAL(20, 4) NOT NULL,
    `high` DECIMAL(20, 4) NOT NULL,
    `low` DECIMAL(20, 4) NOT NULL,
    `close` DECIMAL(20, 4) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketMessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NewsArticle` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `thumbnail` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('REFERRAL', 'EVENT_BONUS') NOT NULL,
    `amount` DECIMAL(20, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dividend` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(20, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KycRecord` ADD CONSTRAINT `KycRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Balance` ADD CONSTRAINT `Balance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Balance` ADD CONSTRAINT `Balance_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candlestick` ADD CONSTRAINT `Candlestick_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardHistory` ADD CONSTRAINT `RewardHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dividend` ADD CONSTRAINT `Dividend_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
