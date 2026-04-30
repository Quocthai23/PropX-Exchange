import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type {
  OpenAPIObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
  SecuritySchemeObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { LoggerService } from '@nestjs/common';
import { RequestLoggingInterceptor } from './shared/interceptors/request-logging.interceptor';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter';
import { AppConfigService } from './config/app-config.service';
import { RedisIoAdapter } from './shared/adapters/redis-io.adapter';

interface SwaggerOperation {
  responses?: Record<string, unknown>;
}

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

const COMMON_ERROR_CODES = [
  'internal-error',
  'not-found',
  'bad-request',
  'validation-error',
  'rate-limit-exceeded',
  'duplicate-request',
  'unauthorized',
  'forbidden',
  'token-expired',
  'asset-not-found',
  'invalid-token',
  'token-not-found',
  'session-not-found',
  'session-revoked',
  'session-expired',
  'user-not-found',
  'user-not-active',
  'user-already-exists',
  'invalid-credentials',
  'reference-code-not-found',
  'reference-code-invalid',
  'reference-code-already-set',
  'password-attempt-limit-exceeded',
  'otp-not-found',
  'invalid-otp',
  'invalid-otp-token',
  'mfa-already-enabled',
  'mfa-not-enabled',
  'invalid-mfa-code',
  'challenge-required',
  'challenge-not-found',
  'challenge-expired',
  'challenge-already-used',
  'challenge-invalid-factor',
  'challenge-payload-mismatch',
  'account-not-found',
  'account-not-active',
  'position-not-found',
  'position-already-closed',
  'feedback-not-found',
  'post-not-found',
  'post-unauthorized',
  'comment-not-found',
  'comment-unauthorized',
  'support-ticket-not-found',
  'support-unauthorized',
  'insufficient-balance',
  'transfer-to-same-account',
  'transfer-not-allowed-with-open-position',
  'external-api-error',
  'invalid-quantity',
  'price-not-found',
] as const;

const COMMON_SWAGGER_SCHEMAS: Record<string, SchemaObject | ReferenceObject> = {
  ValidationErrorItem: {
    type: 'object',
    required: ['field', 'message'],
    properties: {
      field: { type: 'string' },
      code: {
        type: 'string',
        description: 'Machine-friendly field-level error code.',
      },
      message: { type: 'string' },
    },
    additionalProperties: false,
  },
  ErrorResponse: {
    type: 'object',
    required: ['success', 'code', 't'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      code: { type: 'string', enum: [...COMMON_ERROR_CODES] },
      message: {
        type: 'string',
        description: 'Human-readable error summary for clients/logging.',
      },
      t: { type: 'string', format: 'date-time' },
      errors: {
        description:
          'Detailed error information by field, domain rule, or external provider.',
        oneOf: [
          {
            type: 'array',
            items: { $ref: '#/components/schemas/ValidationErrorItem' },
          },
          {
            type: 'object',
            additionalProperties: true,
          },
        ],
      },
      traceId: {
        type: 'string',
        description: 'Request trace id for debugging across services.',
      },
    },
    additionalProperties: false,
  },
  ChallengeRequiredResponse: {
    type: 'object',
    required: ['status', 'challengeId', 'purpose', 'requiredFactors'],
    properties: {
      status: { type: 'string', enum: ['challenge_required'] },
      challengeId: { type: 'string' },
      purpose: {
        type: 'string',
        enum: ['LOGIN', 'SETUP_MFA', 'DISABLE_MFA', 'WITHDRAW', 'TRANSFER'],
      },
      requiredFactors: {
        type: 'array',
        items: { type: 'string', enum: ['TOTP', 'EMAIL_OTP'] },
      },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  },
};

const COMMON_SWAGGER_RESPONSES: Record<
  string,
  ResponseObject | ReferenceObject
> = {
  BadRequest: {
    description: 'Malformed request payload or failed domain validation.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  Unauthorized: {
    description: 'Authentication is missing, invalid, revoked, or expired.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  Forbidden: {
    description:
      'Authenticated but not allowed to access or mutate this resource.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  NotFound: {
    description: 'Requested resource was not found.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  TooManyRequests: {
    description: 'Rate limit exceeded or too many OTP/password attempts.',
    headers: {
      'Retry-After': {
        description: 'Seconds to wait before retrying.',
        schema: { type: 'integer', minimum: 1 },
      },
    },
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  InternalServerError: {
    description: 'Unexpected server error or upstream dependency failure.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
};

const DEFAULT_ERROR_RESPONSE_REFS: Record<string, string> = {
  '400': '#/components/responses/BadRequest',
  '401': '#/components/responses/Unauthorized',
  '403': '#/components/responses/Forbidden',
  '404': '#/components/responses/NotFound',
  '429': '#/components/responses/TooManyRequests',
  '500': '#/components/responses/InternalServerError',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyCommonSwaggerComponents(document: OpenAPIObject) {
  document.components ??= {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...COMMON_SWAGGER_SCHEMAS,
  };
  document.components.responses = {
    ...(document.components.responses ?? {}),
    ...COMMON_SWAGGER_RESPONSES,
  };
  document.components.securitySchemes = {
    ...(document.components.securitySchemes ?? {}),
    accessToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    refreshToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    apiKey: {
      type: 'apiKey',
      name: 'apiKey',
      in: 'header',
    },
  } as Record<string, SecuritySchemeObject | ReferenceObject>;
}

function applyDefaultErrorResponses(document: OpenAPIObject) {
  const paths = document.paths ?? {};

  for (const pathItem of Object.values(paths as Record<string, unknown>)) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      if (!isRecord(operation)) {
        continue;
      }

      const typedOperation = operation as SwaggerOperation;
      typedOperation.responses ??= {};
      for (const [statusCode, ref] of Object.entries(
        DEFAULT_ERROR_RESPONSE_REFS,
      )) {
        if (!typedOperation.responses[statusCode]) {
          typedOperation.responses[statusCode] = { $ref: ref };
        }
      }
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  const configService = app.get(AppConfigService);
  app.useLogger(logger);

  app.use(
    (
      req: { headers?: Record<string, unknown>; traceId?: string },
      res: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      const incoming = req.headers?.['x-trace-id'];
      const traceId =
        typeof incoming === 'string' && incoming.trim() !== ''
          ? incoming
          : randomUUID();
      req.traceId = traceId;
      res.setHeader('X-Trace-Id', traceId);
      next();
    },
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );

  const redisHost = configService.redisHost;
  const redisPort = configService.redisPort;
  const redisPassword = configService.redisPassword;
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisUrl, redisPassword);
  app.useWebSocketAdapter(redisIoAdapter);

  const config = new DocumentBuilder()
    .setTitle('RWA Backend API')
    .setDescription(
      'API documentation for the RWA graduation project - Real World Assets Platform',
    )
    .setVersion('1.0.0')
    .setContact('RWA Team', '', 'support@rwa.com')
    .setLicense('Proprietary', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access-token',
    )
    .addServer(`http://localhost:${configService.port}`, 'Local Development')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Assets', 'Asset management endpoints')
    .addTag('Orders', 'Order management endpoints')
    .addTag('KYC', 'Know Your Customer endpoints')
    .addTag('Payment', 'Payment endpoints')
    .addTag('Settlement', 'Settlement endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  applyCommonSwaggerComponents(document);
  applyDefaultErrorResponses(document);

  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      tryItOutEnabled: true,
      filter: true,
      showRequestHeaders: true,
      requestInterceptor: (request: { headers: Record<string, any> }) => {
        request.headers['X-CSRF-TOKEN'] = localStorage.getItem('XSRF-TOKEN');
        return request;
      },
    },
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a1a; }
      .swagger-ui .info .title { color: #2563eb; }
      .swagger-ui .btn { background-color: #2563eb; }
      .swagger-ui .btn:hover { background-color: #1d4ed8; }
      .model-toggle::after { background-color: #2563eb; }
    `,
    customSiteTitle: 'RWA API Documentation',
  });

  await app.listen(configService.port);
  logger.log(
    `Application is running on: http://localhost:${configService.port}`,
  );
  logger.log(
    `Swagger documentation available at: http://localhost:${configService.port}/api/docs`,
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
