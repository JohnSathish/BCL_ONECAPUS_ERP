import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { examFeePrismaMessage } from '../../modules/examination-fees/utils/exam-fee-prisma.util';
import { prismaSchemaDriftMessage } from '../utils/prisma-schema-drift.util';

@Catch()
export class HttpProblemJsonExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpProblemJsonExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = String(
      request.headers['x-request-id'] ??
        response.getHeader('X-Request-Id') ??
        'unknown',
    );

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const prismaHint =
      exception instanceof HttpException
        ? null
        : (prismaSchemaDriftMessage(exception) ??
          examFeePrismaMessage(exception));

    const message =
      exception instanceof HttpException
        ? exception.message
        : (prismaHint ?? 'An unexpected error occurred');

    const body =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>)
        : undefined;

    const rawDetail =
      prismaHint ??
      (typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? (body.message as string[]).join(', ')
          : message);

    const detail =
      status === HttpStatus.TOO_MANY_REQUESTS &&
      /throttler/i.test(String(rawDetail))
        ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
        : rawDetail;

    const retryAfterSeconds =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      typeof body.retryAfterSeconds === 'number'
        ? body.retryAfterSeconds
        : undefined;

    const fieldErrors =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      body.fieldErrors &&
      typeof body.fieldErrors === 'object' &&
      !Array.isArray(body.fieldErrors)
        ? (body.fieldErrors as Record<string, string>)
        : undefined;

    const issues =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Array.isArray(body.issues)
        ? body.issues
        : body &&
            typeof body === 'object' &&
            !Array.isArray(body) &&
            body.message &&
            typeof body.message === 'object' &&
            !Array.isArray(body.message) &&
            Array.isArray((body.message as { issues?: unknown }).issues)
          ? (body.message as { issues: unknown[] }).issues
          : undefined;

    if (status >= 500) {
      this.logger.error(
        { err: exception, path: request.url, method: request.method, traceId },
        message,
      );
    }

    response
      .status(status)
      .type('application/json')
      .json({
        success: false,
        errorCode: this.errorCode(status, body),
        message: detail,
        details: {
          status,
          path: request.url,
          method: request.method,
          ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
          ...(fieldErrors ? { fieldErrors } : {}),
          ...(issues ? { issues } : {}),
        },
        timestamp: new Date().toISOString(),
        traceId,
        type: `https://httpstatuses.com/${status}`,
        title: HttpStatus[status] ?? 'Error',
        status,
        detail,
        instance: request.url,
        ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
        ...(fieldErrors ? { fieldErrors } : {}),
        ...(issues ? { issues } : {}),
      });
  }

  private errorCode(status: number, body?: Record<string, unknown>) {
    if (typeof body?.errorCode === 'string') return body.errorCode;
    if (status === HttpStatus.UNAUTHORIZED) return 'AUTH_UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'AUTH_FORBIDDEN';
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_SERVER_ERROR';
    return `HTTP_${status}`;
  }
}
