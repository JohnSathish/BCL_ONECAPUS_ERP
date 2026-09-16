import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SchoolSisOpsMetrics } from './school-sis-ops.metrics';

@Injectable()
export class SchoolSisOpsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: SchoolSisOpsMetrics) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ url?: string; path?: string }>();
    const path = `${req.path ?? ''} ${req.url ?? ''}`;
    if (!path.includes('school-sis') && !path.includes('school-mobile')) {
      return next.handle();
    }
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const status =
            context.switchToHttp().getResponse<{ statusCode?: number }>()
              ?.statusCode ?? 200;
          this.metrics.record(
            (req.path ?? req.url ?? '/').split('?')[0],
            status,
            Date.now() - started,
          );
        },
        error: (err: { status?: number }) => {
          this.metrics.record(
            (req.path ?? req.url ?? '/').split('?')[0],
            err?.status ?? 500,
            Date.now() - started,
          );
        },
      }),
    );
  }
}
