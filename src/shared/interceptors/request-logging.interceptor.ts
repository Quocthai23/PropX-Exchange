import type {
  CallHandler,
  ExecutionContext,
  LoggerService,
} from '@nestjs/common';
import { Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface RequestWithTraceId {
  method?: string;
  originalUrl?: string;
  url?: string;
  traceId?: string;
}

interface ResponseWithStatus {
  statusCode?: number;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithTraceId>();
    const res = http.getResponse<ResponseWithStatus>();

    const method = req?.method ?? 'UNKNOWN';
    const url = req?.originalUrl ?? req?.url ?? 'UNKNOWN';
    const traceId = req?.traceId ?? 'unknown';

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const status = res?.statusCode ?? 0;
        this.logger.log(
          `${method} ${url} ${status} ${durationMs}ms traceId=${traceId}`,
        );
      }),
    );
  }
}
