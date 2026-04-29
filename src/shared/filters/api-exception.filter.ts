import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';

interface ErrorResponseBody {
  success: false;
  code: string;
  message: string;
  t: string;
  errors?: unknown;
  traceId?: string;
}

interface RequestWithTraceId {
  traceId?: string;
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'bad-request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 429:
      return 'rate-limit-exceeded';
    default:
      return 'internal-error';
  }
}

function pickMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return 'Validation error';
    }
  }
  return fallback;
}

function normalizeErrors(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const errors = (payload as { errors?: unknown }).errors;
  if (errors) {
    return errors;
  }

  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.map((item) => ({ field: 'body', message: String(item) }));
  }

  return undefined;
}

function pickCode(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const explicit = (payload as { code?: unknown }).code;
    if (typeof explicit === 'string' && explicit.trim() !== '') {
      return explicit;
    }

    const message = (payload as { message?: unknown }).message;
    if (status === 400 && Array.isArray(message) && message.length > 0) {
      return 'validation-error';
    }
  }

  return mapStatusToCode(status);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithTraceId>();
    const traceId = request?.traceId;

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : undefined;

    const body: ErrorResponseBody = {
      success: false,
      code: pickCode(status, payload),
      message: pickMessage(payload, 'Unexpected server error'),
      t: toIsoNow(),
      errors: normalizeErrors(payload),
      traceId,
    };

    response.status(status).json(body);
  }
}
