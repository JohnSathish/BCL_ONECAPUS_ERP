import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { extractRequestedShiftId } from '../utils/shift-request.util';

/** Copies active workspace shift into query.shiftId when the client omitted it. */
@Injectable()
export class ShiftQueryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      query?: Record<string, unknown>;
      shiftScope?: { activeShiftId?: string };
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (req.query && !req.query.shiftId) {
      const shiftId = extractRequestedShiftId(req as never);
      if (shiftId) req.query.shiftId = shiftId;
    }

    return next.handle();
  }
}
