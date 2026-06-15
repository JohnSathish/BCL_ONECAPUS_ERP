import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type { IngestAnalyticsEventsDto } from './dto/mobile-app.dto';

@Injectable()
export class MobileAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(user: JwtUser, dto: IngestAnalyticsEventsDto) {
    if (!dto.events.length) return { accepted: 0 };
    const rows = dto.events.map((e) => ({
      id: randomUUID(),
      tenantId: user.tid,
      userId: user.sub,
      appType: e.appType,
      eventType: e.eventType,
      appVersion: e.appVersion,
      deviceId: e.deviceId,
      metadata: (e.metadata ?? {}) as object,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
    }));
    await this.prisma.mobileAppEvent.createMany({ data: rows });
    await this.rollupToday(user.tid, rows);
    return { accepted: rows.length };
  }

  private async rollupToday(
    tenantId: string,
    rows: Array<{
      appType: string;
      eventType: string;
      appVersion?: string | null;
      userId?: string | null;
    }>,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byApp = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byApp.get(row.appType) ?? [];
      list.push(row);
      byApp.set(row.appType, list);
    }
    for (const [appType, events] of byApp) {
      const logins = events.filter((e) => e.eventType === 'LOGIN').length;
      const userIds = new Set(events.map((e) => e.userId).filter(Boolean));
      const versionBreakdown: Record<string, number> = {};
      for (const e of events) {
        if (!e.appVersion) continue;
        versionBreakdown[e.appVersion] =
          (versionBreakdown[e.appVersion] ?? 0) + 1;
      }
      const existing = await this.prisma.mobileAppDailyStats.findUnique({
        where: { tenantId_date_appType: { tenantId, date: today, appType } },
      });
      if (existing) {
        const prev = (existing.versionBreakdown ?? {}) as Record<
          string,
          number
        >;
        for (const [v, c] of Object.entries(versionBreakdown)) {
          prev[v] = (prev[v] ?? 0) + c;
        }
        await this.prisma.mobileAppDailyStats.update({
          where: { id: existing.id },
          data: {
            loginCount: existing.loginCount + logins,
            activeUsers: Math.max(existing.activeUsers, userIds.size),
            versionBreakdown: prev,
          },
        });
      } else {
        await this.prisma.mobileAppDailyStats.create({
          data: {
            id: randomUUID(),
            tenantId,
            date: today,
            appType,
            loginCount: logins,
            activeUsers: userIds.size,
            versionBreakdown,
          },
        });
      }
    }
  }

  async dashboard(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    const [daily, recentEvents] = await Promise.all([
      this.prisma.mobileAppDailyStats.findMany({
        where: { tenantId, date: { gte: since } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.mobileAppEvent.groupBy({
        by: ['appType', 'eventType'],
        where: { tenantId, occurredAt: { gte: since } },
        _count: { id: true },
      }),
    ]);
    const versionTotals: Record<string, Record<string, number>> = {
      STUDENT: {},
      STAFF: {},
    };
    for (const row of daily) {
      const vb = (row.versionBreakdown ?? {}) as Record<string, number>;
      const bucket = versionTotals[row.appType] ?? {};
      for (const [v, c] of Object.entries(vb)) {
        bucket[v] = (bucket[v] ?? 0) + c;
      }
      versionTotals[row.appType] = bucket;
    }
    const totalLogins = daily.reduce((s, r) => s + r.loginCount, 0);
    const pushSent = daily.reduce((s, r) => s + r.pushSent, 0);
    const pushDelivered = daily.reduce((s, r) => s + r.pushDelivered, 0);
    return {
      periodDays: days,
      totalLogins,
      daily,
      versionTotals,
      eventBreakdown: recentEvents.map((e) => ({
        appType: e.appType,
        eventType: e.eventType,
        count: e._count.id,
      })),
      pushDeliveryRate:
        pushSent > 0 ? Math.round((pushDelivered / pushSent) * 100) : null,
    };
  }
}
