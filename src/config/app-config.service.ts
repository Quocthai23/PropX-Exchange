import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: ConfigService<ValidatedEnv, true>,
  ) {}

  get nodeEnv(): string {
    return this.configService.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get('PORT');
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL');
  }

  get redisHost(): string {
    return this.configService.get('REDIS_HOST');
  }

  get redisPort(): number {
    return this.configService.get('REDIS_PORT');
  }

  get redisPassword(): string | undefined {
    return this.configService.get('REDIS_PASSWORD');
  }

  get enableMarketMaker(): boolean {
    return this.configService.get('ENABLE_MARKET_MAKER') === 'true';
  }

  get enableSettlement(): boolean {
    return this.configService.get('ENABLE_SETTLEMENT') === 'true';
  }

  get jwtSecret(): string {
    return this.configService.get('JWT_SECRET');
  }

  get jwtRefreshSecret(): string | undefined {
    return this.configService.get('JWT_REFRESH_SECRET');
  }

  get jwtRefreshExpiresIn(): string | undefined {
    return this.configService.get('JWT_REFRESH_EXPIRES_IN');
  }

  get walletEncryptionKey(): string | undefined {
    return this.configService.get('WALLET_ENCRYPTION_KEY');
  }

  get smtpHost(): string | undefined {
    return this.configService.get('SMTP_HOST');
  }

  get smtpPort(): number | undefined {
    return this.configService.get('SMTP_PORT');
  }

  get smtpUser(): string | undefined {
    return this.configService.get('SMTP_USER');
  }

  get smtpPass(): string | undefined {
    return this.configService.get('SMTP_PASS');
  }

  get useAwsKms(): boolean {
    return this.configService.get('USE_AWS_KMS') === 'true';
  }

  get awsRegion(): string | undefined {
    return this.configService.get('AWS_REGION');
  }

  get awsAccessKeyId(): string | undefined {
    return this.configService.get('AWS_ACCESS_KEY_ID');
  }

  get awsSecretAccessKey(): string | undefined {
    return this.configService.get('AWS_SECRET_ACCESS_KEY');
  }

  get chainAdminPrivateKeyPlain(): string | undefined {
    return this.configService.get('CHAIN_ADMIN_PRIVATE_KEY');
  }

  get chainAdminPrivateKeyEncryptedBase64(): string | undefined {
    return this.configService.get('CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED');
  }

  get chainKmsKeyId(): string | undefined {
    return this.configService.get('CHAIN_KMS_KEY_ID');
  }

  get chainKmsSignerAddress(): string | undefined {
    return this.configService.get('CHAIN_KMS_SIGNER_ADDRESS');
  }

  get pinataJwt(): string | undefined {
    return this.configService.get('PINATA_JWT');
  }

  get externalValuationTargetsJson(): string | undefined {
    return this.configService.get('EXTERNAL_VALUATION_TARGETS_JSON');
  }

  get externalNewsLanguage(): string {
    return this.configService.get('EXTERNAL_NEWS_LANGUAGE') ?? 'en';
  }

  get externalNewsCountry(): string {
    return this.configService.get('EXTERNAL_NEWS_COUNTRY') ?? 'us';
  }

  get externalNewsKeyword(): string {
    return this.configService.get('EXTERNAL_NEWS_KEYWORD') ?? 'rwa investment';
  }

  get newsApiKey(): string | undefined {
    return this.configService.get('NEWSAPI_API_KEY');
  }

  get newsApiBaseUrl(): string {
    return this.configService.get('NEWSAPI_BASE_URL') ?? 'https://newsapi.org';
  }

  get freeNewsApiKey(): string | undefined {
    return this.configService.get('FREENEWSAPI_API_KEY');
  }

  get freeNewsApiBaseUrl(): string {
    return (
      this.configService.get('FREENEWSAPI_BASE_URL') ??
      'https://freenewsapi.com'
    );
  }

  get theNewsApiKey(): string | undefined {
    return this.configService.get('THENEWSAPI_API_KEY');
  }

  get theNewsApiBaseUrl(): string {
    return (
      this.configService.get('THENEWSAPI_BASE_URL') ??
      'https://api.thenewsapi.com'
    );
  }

  get mediastackApiKey(): string | undefined {
    return this.configService.get('MEDIASTACK_API_KEY');
  }

  get mediastackBaseUrl(): string {
    return (
      this.configService.get('MEDIASTACK_BASE_URL') ??
      'http://api.mediastack.com'
    );
  }

  get fcsApiKey(): string | undefined {
    return this.configService.get('FCSAPI_API_KEY');
  }

  get fcsApiBaseUrl(): string {
    return this.configService.get('FCSAPI_BASE_URL') ?? 'https://fcsapi.com';
  }

  get rapidApiKey(): string | undefined {
    return this.configService.get('RAPIDAPI_KEY');
  }

  get contextualWebBaseUrl(): string {
    return (
      this.configService.get('CONTEXTUALWEB_BASE_URL') ??
      'https://contextualwebsearch-websearch-v1.p.rapidapi.com'
    );
  }

  get contextualWebRapidApiHost(): string {
    return (
      this.configService.get('CONTEXTUALWEB_RAPIDAPI_HOST') ??
      'contextualwebsearch-websearch-v1.p.rapidapi.com'
    );
  }

  get currentsApiKey(): string | undefined {
    return this.configService.get('CURRENTS_API_KEY');
  }

  get currentsBaseUrl(): string {
    return (
      this.configService.get('CURRENTS_BASE_URL') ??
      'https://api.currentsapi.services'
    );
  }

  get gnewsApiKey(): string | undefined {
    return this.configService.get('GNEWS_API_KEY');
  }

  get gnewsBaseUrl(): string {
    return this.configService.get('GNEWS_BASE_URL') ?? 'https://gnews.io';
  }

  get newsDataApiKey(): string | undefined {
    return this.configService.get('NEWSDATA_API_KEY');
  }

  get newsDataBaseUrl(): string {
    return this.configService.get('NEWSDATA_BASE_URL') ?? 'https://newsdata.io';
  }

  get openNewsCanadaFeedUrl(): string | undefined {
    return this.configService.get('OPENNEWS_CANADA_FEED_URL');
  }

  get useMockChain(): boolean {
    return this.configService.get('USE_MOCK_CHAIN') === 'true';
  }

  get chainRpcUrl(): string | undefined {
    return this.configService.get('CHAIN_RPC_URL');
  }

  get chainConfirmations(): string | undefined {
    return this.configService.get('CHAIN_CONFIRMATIONS');
  }

  get chainConfirmationsByChainIdJson(): string | undefined {
    return this.configService.get('CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON');
  }

  get assetTokenFactoryAddress(): string | undefined {
    return this.configService.get('ASSET_TOKEN_FACTORY_ADDRESS');
  }

  get assetTokenFactoryAbiJson(): string | undefined {
    return this.configService.get('ASSET_TOKEN_FACTORY_ABI_JSON');
  }

  get usdtTokenAddress(): string | undefined {
    return this.configService.get('USDT_TOKEN_ADDRESS');
  }

  get depositReceiverAddress(): string | undefined {
    return this.configService.get('DEPOSIT_RECEIVER_ADDRESS');
  }

  get identityRegistryAddress(): string | undefined {
    return this.configService.get('IDENTITY_REGISTRY_ADDRESS');
  }

  get identityRegistryAbiJson(): string | undefined {
    return this.configService.get('IDENTITY_REGISTRY_ABI_JSON');
  }
}
