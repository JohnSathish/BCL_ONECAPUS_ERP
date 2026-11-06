import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_STEP_UP_KEY } from '../decorators/require-step-up.decorator';
import { StepUpService } from '../../modules/auth/step-up.service';
import type { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUp: StepUpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_STEP_UP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const token = stepUpTokenFrom(req);
    const ok = await this.stepUp.verify(user.sub, token);
    if (!ok) {
      throw new ForbiddenException(
        'Step-up authentication required. Confirm password or MFA.',
      );
    }
    return true;
  }
}

function stepUpTokenFrom(req: Request): string {
  const header = req.headers['x-step-up-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const query = req.query?.stepUpToken;
  if (typeof query === 'string' && query.trim()) return query.trim();
  if (Array.isArray(query) && typeof query[0] === 'string' && query[0].trim()) {
    return query[0].trim();
  }
  return '';
}
