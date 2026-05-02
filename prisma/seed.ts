import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus, KycStatus, OrderSide, OrderType, OrderStatus, TransactionType, TransactionStatus, AssetTradingStatus, OnboardingStatus, RedemptionStatus, ProposalStatus, PostStatus, CorporateActionType, CommissionEvent, CommissionRewardStatus } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('DATABASE_URL is not defined');
}
const adapter = new PrismaMariaDb(datasourceUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Start seeding data...');

  // 1. User
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      walletAddress: '0x0000000000000000000000000000000000000000',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      enabledMfa: false,
    },
  });
  console.log('1. User created');

  const user2 = await prisma.user.upsert({
    where: { email: 'test2@example.com' },
    update: {},
    create: {
      email: 'test2@example.com',
      username: 'testuser2',
      walletAddress: '0x1111111111111111111111111111111111111111',
      role: UserRole.INVESTOR,
      status: UserStatus.ACTIVE,
      enabledMfa: false,
    },
  });
  console.log('1b. User 2 created');

  // 2. AssetCategory
  const category = await prisma.assetCategory.upsert({
    where: { name: 'Real Estate' },
    update: {},
    create: {
      name: 'Real Estate',
      description: 'Real Estate Category',
      isActive: true,
    },
  });
  console.log('2. AssetCategory created');

  // 3. Asset
  const asset = await prisma.asset.upsert({
    where: { symbol: 'RWA-TEST' },
    update: {},
    create: {
      symbol: 'RWA-TEST',
      name: 'Test Asset',
      categoryId: category.id,
      totalSupply: 1000000,
      tokenPrice: 10,
      priceBandPercentage: 0.07,
      tradingStatus: AssetTradingStatus.OPEN,
      isActive: true,
      contractAddress: '0x2222222222222222222222222222222222222222',
    },
  });
  console.log('3. Asset created');

  // 4. FavoriteAsset
  await prisma.favoriteAsset.upsert({
    where: { userId_assetId: { userId: user.id, assetId: asset.id } },
    update: {},
    create: { userId: user.id, assetId: asset.id },
  });
  console.log('4. FavoriteAsset created');

  // 5. UserRelation
  await prisma.userRelation.upsert({
    where: { fromUserId_toUserId: { fromUserId: user.id, toUserId: user2.id } },
    update: {},
    create: { fromUserId: user.id, toUserId: user2.id, isFollowing: true },
  });
  console.log('5. UserRelation created');

  // 6. SupportTicket
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      subject: 'Test Issue',
      status: 'OPEN',
    },
  });
  console.log('6. SupportTicket created');

  // 7. TicketMessage
  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: user.id,
      content: 'This is a test message',
    },
  });
  console.log('7. TicketMessage created');

  // 8. Otp
  await prisma.otp.upsert({
    where: { email: 'test@example.com' },
    update: { code: '123456', expiresAt: new Date(Date.now() + 1000000) },
    create: {
      email: 'test@example.com',
      code: '123456',
      expiresAt: new Date(Date.now() + 1000000),
    },
  });
  console.log('8. Otp created');

  // 9. DeviceSession
  await prisma.deviceSession.create({
    data: {
      userId: user.id,
      deviceId: 'device-123',
      refreshTokenHash: 'hash',
      refreshTokenExpiresAt: new Date(Date.now() + 1000000),
    },
  });
  console.log('9. DeviceSession created');

  // 10. KycRecord
  await prisma.kycRecord.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fullName: 'Test User',
      dob: new Date('1990-01-01'),
      idNumber: '123456789',
      idFrontImg: 'url-front',
      idBackImg: 'url-back',
      selfieImg: 'url-selfie',
      status: KycStatus.APPROVED,
    },
  });
  console.log('10. KycRecord created');

  // 11. Balance
  await prisma.balance.upsert({
    where: { userId_assetId: { userId: user.id, assetId: asset.id } },
    update: { available: 100 },
    create: {
      userId: user.id,
      assetId: asset.id,
      available: 100,
      locked: 0,
    },
  });
  console.log('11. Balance created');

  // 12. AssetOnboardingRequest
  await prisma.assetOnboardingRequest.create({
    data: {
      userId: user.id,
      title: 'New Asset Request',
      description: 'Desc',
      estimatedValue: 50000,
      legalDocuments: ['url1'],
      status: OnboardingStatus.PENDING,
    },
  });
  console.log('12. AssetOnboardingRequest created');

  // 13. AssetRedemptionRequest
  await prisma.assetRedemptionRequest.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      tokenQuantity: 10,
      status: RedemptionStatus.PENDING,
    },
  });
  console.log('13. AssetRedemptionRequest created');

  // 14. DaoProposal
  const proposal = await prisma.daoProposal.create({
    data: {
      assetId: asset.id,
      proposerId: user.id,
      title: 'Test Proposal',
      description: 'Proposal desc',
      snapshotDate: new Date(),
      endDate: new Date(Date.now() + 10000000),
      status: ProposalStatus.ACTIVE,
    },
  });
  console.log('14. DaoProposal created');

  // 15. DaoVotingSnapshot
  await prisma.daoVotingSnapshot.upsert({
    where: { proposalId_userId: { proposalId: proposal.id, userId: user.id } },
    update: {},
    create: {
      proposalId: proposal.id,
      userId: user.id,
      votingPower: 100,
    },
  });
  console.log('15. DaoVotingSnapshot created');

  // 16. ProposalVote
  await prisma.proposalVote.upsert({
    where: { proposalId_userId: { proposalId: proposal.id, userId: user.id } },
    update: {},
    create: {
      proposalId: proposal.id,
      userId: user.id,
      isFor: true,
      votingPower: 100,
    },
  });
  console.log('16. ProposalVote created');

  // 17. Order
  await prisma.order.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 10,
      quantity: 5,
      status: OrderStatus.PENDING,
    },
  });
  console.log('17. Order created');

  // 18. Transaction
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: TransactionType.DEPOSIT,
      amount: 1000,
      status: TransactionStatus.COMPLETED,
    },
  });
  console.log('18. Transaction created');

  // 19. GasSpeedUpAttempt
  await prisma.gasSpeedUpAttempt.create({
    data: {
      transactionId: transaction.id,
      previousTxHash: '0xold',
      newTxHash: '0xnew',
      oldGasPrice: 10,
      newGasPrice: 20,
      gasFeePaid: 0.1,
    },
  });
  console.log('19. GasSpeedUpAttempt created');

  // 20. AuditLog
  await prisma.auditLog.create({
    data: {
      entity: 'User',
      entityId: user.id,
      action: 'CREATE',
      performedBy: user.id,
    },
  });
  console.log('20. AuditLog created');

  // 21. CorporateAction
  await prisma.corporateAction.create({
    data: {
      assetId: asset.id,
      type: CorporateActionType.DIVIDEND,
      amount: 1000,
      recordDate: new Date(),
      executionDate: new Date(),
      status: 'COMPLETED',
    },
  });
  console.log('21. CorporateAction created');

  // 22. DividendDistribution
  const dividendDist = await prisma.dividendDistribution.create({
    data: {
      assetId: asset.id,
      totalAmount: 500,
      snapshotDate: new Date(),
      status: 'COMPLETED',
    },
  });
  console.log('22. DividendDistribution created');

  // 23. DividendClaim
  await prisma.dividendClaim.upsert({
    where: { distributionId_userId: { distributionId: dividendDist.id, userId: user.id } },
    update: {},
    create: {
      distributionId: dividendDist.id,
      userId: user.id,
      amount: 50,
      status: 'CLAIMED',
    },
  });
  console.log('23. DividendClaim created');

  // 24. Candlestick
  await prisma.candlestick.create({
    data: {
      assetId: asset.id,
      resolution: '1d',
      openTime: new Date(),
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 1000,
    },
  });
  console.log('24. Candlestick created');

  // 25. Trade
  await prisma.trade.create({
    data: {
      assetId: asset.id,
      buyerId: user.id,
      sellerId: user2.id,
      price: 10,
      quantity: 5,
      settlementStatus: 'SETTLED',
    },
  });
  console.log('25. Trade created');

  // 26. NewsArticle
  const news = await prisma.newsArticle.upsert({
    where: { dedupeKey: 'test-news-1' },
    update: {},
    create: {
      source: 'Test Source',
      dedupeKey: 'test-news-1',
      title: { en: 'Test News' },
      url: 'https://example.com',
      publishedAt: new Date(),
    },
  });
  console.log('26. NewsArticle created');

  // 27. AssetNews
  await prisma.assetNews.upsert({
    where: { newsId_assetId: { newsId: news.id, assetId: asset.id } },
    update: {},
    create: {
      newsId: news.id,
      assetId: asset.id,
    },
  });
  console.log('27. AssetNews created');

  // 28. AccountType
  const accountType = await prisma.accountType.upsert({
    where: { code: 'MAIN_ACC' },
    update: {},
    create: {
      code: 'MAIN_ACC',
      name: 'Main Account',
      currency: 'USDT',
    },
  });
  console.log('28. AccountType created');

  // 29. Account
  await prisma.account.upsert({
    where: { userId_accountTypeId: { userId: user.id, accountTypeId: accountType.id } },
    update: {},
    create: {
      userId: user.id,
      accountTypeId: accountType.id,
      name: 'Test Account',
    },
  });
  console.log('29. Account created');

  // 30. Notification
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'SYSTEM',
      title: 'Welcome',
      content: 'Hello World',
    },
  });
  console.log('30. Notification created');

  // 31. Post
  const post = await prisma.post.create({
    data: {
      userId: user.id,
      content: 'This is a test post',
      status: PostStatus.PUBLISHED,
    },
  });
  console.log('31. Post created');

  // 32. PostCashtag
  await prisma.postCashtag.upsert({
    where: { postId_assetId: { postId: post.id, assetId: asset.id } },
    update: {},
    create: {
      postId: post.id,
      assetId: asset.id,
    },
  });
  console.log('32. PostCashtag created');

  // 33. PostReport
  await prisma.postReport.create({
    data: {
      postId: post.id,
      userId: user2.id,
      reason: 'Spam',
    },
  });
  console.log('33. PostReport created');

  // 34. PostLike
  await prisma.postLike.upsert({
    where: { postId_userId: { postId: post.id, userId: user2.id } },
    update: {},
    create: {
      postId: post.id,
      userId: user2.id,
    },
  });
  console.log('34. PostLike created');

  // 35. Comment
  await prisma.comment.create({
    data: {
      postId: post.id,
      userId: user2.id,
      content: 'Nice post',
    },
  });
  console.log('35. Comment created');

  // 36. PostBookmark
  await prisma.postBookmark.upsert({
    where: { postId_userId: { postId: post.id, userId: user.id } },
    update: {},
    create: {
      postId: post.id,
      userId: user.id,
    },
  });
  console.log('36. PostBookmark created');

  // 37. AssetValuationSnapshot
  await prisma.assetValuationSnapshot.create({
    data: {
      assetId: asset.id,
      source: 'AppraisalTeam',
      price: 50000,
      capturedAt: new Date(),
    },
  });
  console.log('37. AssetValuationSnapshot created');

  // 38. UserDevice
  await prisma.userDevice.upsert({
    where: { fcmToken: 'test-token-123' },
    update: {},
    create: {
      userId: user.id,
      fcmToken: 'test-token-123',
    },
  });
  console.log('38. UserDevice created');

  // 39. GlobalNotification
  const globalNotif = await prisma.globalNotification.create({
    data: {
      title: 'System Maintenance',
      content: 'Will be down for 1 hour',
      type: 'SYSTEM',
    },
  });
  console.log('39. GlobalNotification created');

  // 40. UserReadGlobalNotification
  await prisma.userReadGlobalNotification.upsert({
    where: { userId_globalNotificationId: { userId: user.id, globalNotificationId: globalNotif.id } },
    update: {},
    create: {
      userId: user.id,
      globalNotificationId: globalNotif.id,
    },
  });
  console.log('40. UserReadGlobalNotification created');

  // 41. CommissionConfig
  await prisma.commissionConfig.upsert({
    where: { eventType: CommissionEvent.TRADE },
    update: {},
    create: {
      eventType: CommissionEvent.TRADE,
      commissionRate: 0.1,
    },
  });
  console.log('41. CommissionConfig created');

  // 42. CommissionReward
  await prisma.commissionReward.create({
    data: {
      userId: user.id,
      sourceUserId: user2.id,
      eventType: CommissionEvent.TRADE,
      amount: 5,
      status: CommissionRewardStatus.PENDING,
    },
  });
  console.log('42. CommissionReward created');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
