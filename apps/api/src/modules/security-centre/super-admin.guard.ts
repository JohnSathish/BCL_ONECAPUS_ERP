import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { superAdminAccessDenial } from './domain/super-admin-access';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const denial = superAdminAccessDenial(request.user);
    if (denial) throw new ForbiddenException(denial);
    return true;
  }
}
