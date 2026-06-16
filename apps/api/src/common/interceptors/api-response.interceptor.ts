import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        if (this.shouldBypass(payload, response)) return payload;
        const traceId = String(response.getHeader('X-Request-Id') ?? 'unknown');
        return {
          success: true,
          message: 'OK',
          data: jsonSafe(payload ?? null),
          meta: {},
          timestamp: new Date().toISOString(),
          traceId,
        };
      }),
    );
  }

  private shouldBypass(payload: unknown, response: Response) {
    if (payload instanceof StreamableFile || Buffer.isBuffer(payload))
      return true;
    if (typeof payload === 'string') return true;
    if (response.headersSent) return true;
    const contentType = String(
      response.getHeader('content-type') ?? '',
    ).toLowerCase();
    return Boolean(
      contentType &&
      !contentType.includes('application/json') &&
      !contentType.includes('+json'),
    );
  }
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        jsonSafe(v),
      ]),
    );
  }
  return value;
}
