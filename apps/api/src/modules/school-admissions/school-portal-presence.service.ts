import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import {
  isSchoolPortalBotUserAgent,
  isSchoolPortalSessionId,
  SCHOOL_PORTAL_LIVE_WINDOW_MS,
  SCHOOL_PORTAL_PRESENCE_TTL_MS,
  schoolPortalClientIp,
  schoolPortalSessionKey,
  schoolPortalVisitorKey,
} from './school-portal-presence.util';

export type SchoolPortalTrafficStats = {
  totalVisitors: number;
  liveOnline: number;
};

@Injectable()
export class SchoolPortalPresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private salt() {
    return (
      this.config.get<string>('SCHOOL_PORTAL_VISITOR_SALT')?.trim() ||
      'tps-school-admissions-visitors'
    );
  }

  async stats(tenantId: string): Promise<SchoolPortalTrafficStats> {
    const liveSince = new Date(Date.now() - SCHOOL_PORTAL_LIVE_WINDOW_MS);
    const [totalVisitors, liveOnline] = await Promise.all([
      this.prisma.schoolPortalVisitor.count({ where: { tenantId } }),
      this.prisma.schoolPortalPresence.count({
        where: { tenantId, lastSeenAt: { gte: liveSince } },
      }),
    ]);
    return { totalVisitors, liveOnline };
  }

  async heartbeat(
    tenantId: string,
    sessionId: string,
    req: Request,
  ): Promise<SchoolPortalTrafficStats> {
    const ua =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : '';
    if (isSchoolPortalBotUserAgent(ua) || !isSchoolPortalSessionId(sessionId)) {
      return this.stats(tenantId);
    }

    const now = new Date();
    const salt = this.salt();
    const ip = schoolPortalClientIp(
      req.headers as Record<string, unknown>,
      req.ip,
    );
    const visitorKey = schoolPortalVisitorKey(salt, ip, ua);
    const sessionKey = schoolPortalSessionKey(salt, sessionId);

    await this.prisma.$transaction([
      this.prisma.schoolPortalVisitor.upsert({
        where: { tenantId_visitorKey: { tenantId, visitorKey } },
        create: { tenantId, visitorKey, lastSeenAt: now },
        update: { lastSeenAt: now },
      }),
      this.prisma.schoolPortalPresence.upsert({
        where: { tenantId_sessionKey: { tenantId, sessionKey } },
        create: { tenantId, sessionKey, lastSeenAt: now },
        update: { lastSeenAt: now },
      }),
    ]);

    if (Math.random() < 0.05) {
      await this.prisma.schoolPortalPresence.deleteMany({
        where: {
          lastSeenAt: {
            lt: new Date(Date.now() - SCHOOL_PORTAL_PRESENCE_TTL_MS),
          },
        },
      });
    }

    return this.stats(tenantId);
  }
}
