import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    const started = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - started;
      const status = res.statusCode;
      const line = `${method} ${originalUrl} ${status} ${ms}ms [${requestId}]`;
      if (status >= 500 || ms > 5000) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
