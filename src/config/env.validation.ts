export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  ENABLE_MARKET_MAKER?: string;
  ENABLE_SETTLEMENT?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_REFRESH_EXPIRES_IN?: string;
  WALLET_ENCRYPTION_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  USE_AWS_KMS?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  CHAIN_ADMIN_PRIVATE_KEY?: string;
  CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED?: string;
  PINATA_JWT?: string;
  EXTERNAL_VALUATION_TARGETS_JSON?: string;
  USE_MOCK_CHAIN?: string;
  CHAIN_RPC_URL?: string;
  CHAIN_CONFIRMATIONS?: string;
  CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON?: string;
  ASSET_TOKEN_FACTORY_ADDRESS?: string;
  ASSET_TOKEN_FACTORY_ABI_JSON?: string;
  USDT_TOKEN_ADDRESS?: string;
  DEPOSIT_RECEIVER_ADDRESS?: string;
  IDENTITY_REGISTRY_ADDRESS?: string;
  IDENTITY_REGISTRY_ABI_JSON?: string;
  EXTERNAL_NEWS_LANGUAGE?: string;
  EXTERNAL_NEWS_COUNTRY?: string;
  EXTERNAL_NEWS_KEYWORD?: string;
  NEWSAPI_API_KEY?: string;
  NEWSAPI_BASE_URL?: string;
  FREENEWSAPI_API_KEY?: string;
  FREENEWSAPI_BASE_URL?: string;
  THENEWSAPI_API_KEY?: string;
  THENEWSAPI_BASE_URL?: string;
  MEDIASTACK_API_KEY?: string;
  MEDIASTACK_BASE_URL?: string;
  FCSAPI_API_KEY?: string;
  FCSAPI_BASE_URL?: string;
  RAPIDAPI_KEY?: string;
  CONTEXTUALWEB_BASE_URL?: string;
  CONTEXTUALWEB_RAPIDAPI_HOST?: string;
  CURRENTS_API_KEY?: string;
  CURRENTS_BASE_URL?: string;
  GNEWS_API_KEY?: string;
  GNEWS_BASE_URL?: string;
  NEWSDATA_API_KEY?: string;
  NEWSDATA_BASE_URL?: string;
  OPENNEWS_CANADA_FEED_URL?: string;
}

function asInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const nodeEnv = (config.NODE_ENV as string | undefined) ?? 'development';
  const isProduction = nodeEnv === 'production';

  const validated: ValidatedEnv = {
    NODE_ENV: nodeEnv,
    PORT: asInt(config.PORT, 3000),
    DATABASE_URL: config.DATABASE_URL as string | undefined,
    REDIS_HOST: (config.REDIS_HOST as string | undefined) ?? 'localhost',
    REDIS_PORT: asInt(config.REDIS_PORT, 6379),
    REDIS_PASSWORD: config.REDIS_PASSWORD as string | undefined,
    ENABLE_MARKET_MAKER: config.ENABLE_MARKET_MAKER as string | undefined,
    ENABLE_SETTLEMENT: config.ENABLE_SETTLEMENT as string | undefined,
    JWT_SECRET: config.JWT_SECRET as string | undefined,
    JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET as string | undefined,
    JWT_REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN as string | undefined,
    WALLET_ENCRYPTION_KEY: config.WALLET_ENCRYPTION_KEY as string | undefined,
    SMTP_HOST: config.SMTP_HOST as string | undefined,
    SMTP_PORT:
      typeof config.SMTP_PORT === 'string' ||
      typeof config.SMTP_PORT === 'number'
        ? asInt(config.SMTP_PORT, 587)
        : undefined,
    SMTP_USER: config.SMTP_USER as string | undefined,
    SMTP_PASS: config.SMTP_PASS as string | undefined,
    USE_AWS_KMS: config.USE_AWS_KMS as string | undefined,
    AWS_REGION: config.AWS_REGION as string | undefined,
    AWS_ACCESS_KEY_ID: config.AWS_ACCESS_KEY_ID as string | undefined,
    AWS_SECRET_ACCESS_KEY: config.AWS_SECRET_ACCESS_KEY as string | undefined,
    CHAIN_ADMIN_PRIVATE_KEY:
      typeof config.CHAIN_ADMIN_PRIVATE_KEY === 'string'
        ? config.CHAIN_ADMIN_PRIVATE_KEY
        : undefined,
    CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED:
      config.CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED as string | undefined,
    PINATA_JWT: config.PINATA_JWT as string | undefined,
    EXTERNAL_VALUATION_TARGETS_JSON:
      typeof config.EXTERNAL_VALUATION_TARGETS_JSON === 'string'
        ? config.EXTERNAL_VALUATION_TARGETS_JSON
        : undefined,
    USE_MOCK_CHAIN: config.USE_MOCK_CHAIN as string | undefined,
    CHAIN_RPC_URL: config.CHAIN_RPC_URL as string | undefined,
    CHAIN_CONFIRMATIONS: config.CHAIN_CONFIRMATIONS as string | undefined,
    CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON:
      config.CHAIN_CONFIRMATIONS_BY_CHAIN_ID_JSON as string | undefined,
    ASSET_TOKEN_FACTORY_ADDRESS: config.ASSET_TOKEN_FACTORY_ADDRESS as
      | string
      | undefined,
    ASSET_TOKEN_FACTORY_ABI_JSON: config.ASSET_TOKEN_FACTORY_ABI_JSON as
      | string
      | undefined,
    USDT_TOKEN_ADDRESS: config.USDT_TOKEN_ADDRESS as string | undefined,
    DEPOSIT_RECEIVER_ADDRESS: config.DEPOSIT_RECEIVER_ADDRESS as
      | string
      | undefined,
    IDENTITY_REGISTRY_ADDRESS: config.IDENTITY_REGISTRY_ADDRESS as
      | string
      | undefined,
    IDENTITY_REGISTRY_ABI_JSON: config.IDENTITY_REGISTRY_ABI_JSON as
      | string
      | undefined,
    EXTERNAL_NEWS_LANGUAGE: config.EXTERNAL_NEWS_LANGUAGE as string | undefined,
    EXTERNAL_NEWS_COUNTRY: config.EXTERNAL_NEWS_COUNTRY as string | undefined,
    EXTERNAL_NEWS_KEYWORD: config.EXTERNAL_NEWS_KEYWORD as string | undefined,
    NEWSAPI_API_KEY: config.NEWSAPI_API_KEY as string | undefined,
    NEWSAPI_BASE_URL: config.NEWSAPI_BASE_URL as string | undefined,
    FREENEWSAPI_API_KEY: config.FREENEWSAPI_API_KEY as string | undefined,
    FREENEWSAPI_BASE_URL: config.FREENEWSAPI_BASE_URL as string | undefined,
    THENEWSAPI_API_KEY: config.THENEWSAPI_API_KEY as string | undefined,
    THENEWSAPI_BASE_URL: config.THENEWSAPI_BASE_URL as string | undefined,
    MEDIASTACK_API_KEY: config.MEDIASTACK_API_KEY as string | undefined,
    MEDIASTACK_BASE_URL: config.MEDIASTACK_BASE_URL as string | undefined,
    FCSAPI_API_KEY: config.FCSAPI_API_KEY as string | undefined,
    FCSAPI_BASE_URL: config.FCSAPI_BASE_URL as string | undefined,
    RAPIDAPI_KEY: config.RAPIDAPI_KEY as string | undefined,
    CONTEXTUALWEB_BASE_URL: config.CONTEXTUALWEB_BASE_URL as string | undefined,
    CONTEXTUALWEB_RAPIDAPI_HOST: config.CONTEXTUALWEB_RAPIDAPI_HOST as
      | string
      | undefined,
    CURRENTS_API_KEY: config.CURRENTS_API_KEY as string | undefined,
    CURRENTS_BASE_URL: config.CURRENTS_BASE_URL as string | undefined,
    GNEWS_API_KEY: config.GNEWS_API_KEY as string | undefined,
    GNEWS_BASE_URL: config.GNEWS_BASE_URL as string | undefined,
    NEWSDATA_API_KEY: config.NEWSDATA_API_KEY as string | undefined,
    NEWSDATA_BASE_URL: config.NEWSDATA_BASE_URL as string | undefined,
    OPENNEWS_CANADA_FEED_URL: config.OPENNEWS_CANADA_FEED_URL as
      | string
      | undefined,
  };

  if (isProduction) {
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
      'WALLET_ENCRYPTION_KEY',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
    ] as const;

    const missing = required.filter((key) => !validated[key]);
    if (missing.length) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }

    if (
      validated.USE_AWS_KMS === 'true' &&
      (!validated.AWS_ACCESS_KEY_ID || !validated.AWS_SECRET_ACCESS_KEY)
    ) {
      throw new Error(
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when USE_AWS_KMS=true',
      );
    }
  }

  return validated;
}
