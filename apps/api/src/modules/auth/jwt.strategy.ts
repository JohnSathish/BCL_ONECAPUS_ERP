import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

type JwtPayload = {
  sub: string;
  tid: string;
  email: string;
  roles: string[];
  permissions?: string[];
  shiftIds?: string[];
  primaryShiftId?: string;
  allShifts?: boolean;
  dataScope?: JwtUser['dataScope'];
  sid?: string;
  impersonatedBy?: string;
  impersonationSessionId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tid,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session invalid or user deactivated');
    }

    if (payload.sid) {
      const liveSession = await this.prisma.refreshSession.findFirst({
        where: {
          jti: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!liveSession) {
        throw new UnauthorizedException('Session expired or revoked');
      }
    }

    if (payload.impersonationSessionId) {
      const imp = await this.prisma.impersonationSession.findFirst({
        where: {
          id: payload.impersonationSessionId,
          targetUserId: payload.sub,
          endedAt: null,
        },
      });
      if (!imp) {
        throw new UnauthorizedException('Impersonation session expired');
      }
    }

    return {
      sub: payload.sub,
      tid: payload.tid,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      shiftIds: payload.shiftIds ?? [],
      primaryShiftId: payload.primaryShiftId,
      allShifts: payload.allShifts ?? false,
      dataScope: payload.dataScope,
      impersonatedBy: payload.impersonatedBy,
      impersonationSessionId: payload.impersonationSessionId,
      isImpersonating: !!payload.impersonationSessionId,
    };
  }
}
