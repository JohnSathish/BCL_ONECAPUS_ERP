import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../decorators/current-user.decorator';

export const STUDENT_SELF_KEY = 'studentSelfParam';

/** Marks route param that must match the authenticated student's record. */
export const StudentSelfParam = (paramName = 'studentId') =>
  SetMetadata(STUDENT_SELF_KEY, paramName);

@Injectable()
export class StudentSelfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName =
      this.reflector.getAllAndOverride<string>(STUDENT_SELF_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? null;
    if (!paramName) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: JwtUser; params?: Record<string, string> }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const permissions = user.permissions ?? [];
    if (
      permissions.includes('students:manage') ||
      permissions.includes('students:read')
    ) {
      return true;
    }

    const paramId = req.params?.[paramName];
    if (!paramId) return true;

    const student = await this.prisma.student.findFirst({
      where: { userId: user.sub, tenantId: user.tid, deletedAt: null },
      select: { id: true },
    });
    if (!student || student.id !== paramId) {
      throw new ForbiddenException('Access denied to this student record');
    }
    return true;
  }
}
