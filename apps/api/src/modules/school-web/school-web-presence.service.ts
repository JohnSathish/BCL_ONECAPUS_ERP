import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import {
  SCHOOL_WEB_PRESENCE_CACHE_MS,
  clampTimeoutMinutes,
  hashSchoolWebIp,
  hashSchoolWebVisitor,
  isSchoolWebBotUserAgent,
  isSchoolWebSessionId,
  istDayDate,
  normalizePublicPath,
  schoolWebClientIp,
} from './school-web-presence.util';

type FooterVisitorSettings = {
  visitorCounterEnabled: boolean;
  visitorTimeoutMinutes: number;
  visitorAnalyticsEnabled: boolean;
  visitorRetentionDays: number;
};

type PresenceCounts = { online: number; totalVisitors: number };
type PresenceCache = { at: number; counts: PresenceCounts };
const presenceCache = new Map<string, PresenceCache>();
const newHashesByIp = new Map<string, { at: number; hashes: Set<string> }>();

@Injectable()
export class SchoolWebPresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private salt() {
    return (
      this.config.get<string>('SCHOOL_WEB_VISITOR_SALT')?.trim() ||
      'st-lukes-public-website-visitors'
    );
  }

  footerSettings(extrasJson: unknown): FooterVisitorSettings {
    const extras =
      extrasJson && typeof extrasJson === 'object'
        ? (extrasJson as Record<string, unknown>)
        : {};
    const footer =
      extras.footer && typeof extras.footer === 'object'
        ? (extras.footer as Record<string, unknown>)
        : {};
    return {
      visitorCounterEnabled: footer.visitorCounterEnabled !== false,
      visitorTimeoutMinutes: clampTimeoutMinutes(
        footer.visitorTimeoutMinutes ?? 10,
      ),
      visitorAnalyticsEnabled: footer.visitorAnalyticsEnabled !== false,
      visitorRetentionDays: Math.min(
        1825,
        Math.max(30, Number(footer.visitorRetentionDays) || 365),
      ),
    };
  }

  async presenceCounts(
    tenantId: string,
    timeoutMinutes: number,
  ): Promise<PresenceCounts> {
    const key = `${tenantId}:${timeoutMinutes}`;
    const hit = presenceCache.get(key);
    if (hit && Date.now() - hit.at < SCHOOL_WEB_PRESENCE_CACHE_MS)
      return hit.counts;
    const since = new Date(Date.now() - timeoutMinutes * 60_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ online: number; total_visitors: number }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE last_seen_at >= ${since})::int AS online,
        COALESCE(SUM(visit_count), 0)::int AS total_visitors
      FROM school.school_web_visitor_presence
      WHERE tenant_id = ${tenantId}::uuid
    `);
    const counts: PresenceCounts = {
      online: rows[0]?.online ?? 0,
      totalVisitors: rows[0]?.total_visitors ?? 0,
    };
    presenceCache.set(key, { at: Date.now(), counts });
    return counts;
  }

  async onlineCount(tenantId: string, timeoutMinutes: number): Promise<number> {
    return (await this.presenceCounts(tenantId, timeoutMinutes)).online;
  }

  async heartbeat(
    tenantId: string,
    extrasJson: unknown,
    sessionId: string | undefined,
    path: string | undefined,
    req: Request,
  ): Promise<PresenceCounts> {
    const settings = this.footerSettings(extrasJson);
    if (!settings.visitorCounterEnabled) return { online: 0, totalVisitors: 0 };

    const ua =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : '';
    if (isSchoolWebBotUserAgent(ua) || !isSchoolWebSessionId(sessionId)) {
      return this.presenceCounts(tenantId, settings.visitorTimeoutMinutes);
    }

    const now = new Date();
    const timeoutMs = settings.visitorTimeoutMinutes * 60_000;
    const visitorHash = hashSchoolWebVisitor(this.salt(), sessionId!);
    const publicPath = normalizePublicPath(path);
    const ipHash = hashSchoolWebIp(
      this.salt(),
      schoolWebClientIp(req.headers as Record<string, unknown>, req.ip),
    );

    const existing = await this.prisma.$queryRaw<
      Array<{ id: string; last_seen_at: Date; last_path: string | null }>
    >(Prisma.sql`
      SELECT id, last_seen_at, last_path
      FROM school.school_web_visitor_presence
      WHERE tenant_id = ${tenantId}::uuid AND visitor_hash = ${visitorHash}
      LIMIT 1
    `);
    const row = existing[0];

    if (!row && !this.allowNewVisitor(ipHash, visitorHash)) {
      return this.presenceCounts(tenantId, settings.visitorTimeoutMinutes);
    }

    const expired = Boolean(
      row && now.getTime() - new Date(row.last_seen_at).getTime() > timeoutMs,
    );
    const pathChanged = Boolean(row && row.last_path !== publicPath);
    const isNew = !row;
    const isNewVisit = isNew || expired;
    const isPageView = isNew || pathChanged;

    if (row) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE school.school_web_visitor_presence
        SET last_seen_at = ${now},
            last_path = ${publicPath},
            visit_count = visit_count + ${isNewVisit ? 1 : 0},
            page_views = page_views + ${isPageView ? 1 : 0},
            updated_at = ${now}
        WHERE id = ${row.id}::uuid
      `);
    } else {
      const id = randomUUID();
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO school.school_web_visitor_presence
          (id, tenant_id, visitor_hash, first_seen_at, last_seen_at, last_path, visit_count, page_views, created_at, updated_at)
        VALUES
          (${id}::uuid, ${tenantId}::uuid, ${visitorHash}, ${now}, ${now}, ${publicPath}, 1, 1, ${now}, ${now})
      `);
    }

    if (settings.visitorAnalyticsEnabled && (isNewVisit || isPageView)) {
      await this.bumpAnalytics(tenantId, {
        isNewVisit,
        isNewUnique: isNew,
        isPageView,
        path: publicPath,
      });
    }

    presenceCache.delete(`${tenantId}:${settings.visitorTimeoutMinutes}`);
    if (Math.random() < 0.03) {
      void this.cleanup(tenantId, settings.visitorRetentionDays);
    }

    return this.presenceCounts(tenantId, settings.visitorTimeoutMinutes);
  }

  async stats(tenantId: string, extrasJson: unknown) {
    const settings = this.footerSettings(extrasJson);
    const today = istDayDate();
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const monthStart = new Date(today);
    monthStart.setUTCDate(monthStart.getUTCDate() - 29);

    const [counts, rangeRows, pages] = await Promise.all([
      this.presenceCounts(tenantId, settings.visitorTimeoutMinutes),
      this.prisma.$queryRaw<
        Array<{
          day: Date;
          visits: number;
          unique_visitors: number;
          page_views: number;
        }>
      >(Prisma.sql`
        SELECT day, visits, unique_visitors, page_views
        FROM school.school_web_visitor_daily
        WHERE tenant_id = ${tenantId}::uuid AND day >= ${monthStart}::date
        ORDER BY day ASC
      `),
      this.prisma.$queryRaw<Array<{ path: string; views: number }>>(Prisma.sql`
        SELECT path, SUM(views)::int AS views
        FROM school.school_web_visitor_page_stats
        WHERE tenant_id = ${tenantId}::uuid AND day >= ${monthStart}::date
        GROUP BY path
        ORDER BY SUM(views) DESC
        LIMIT 12
      `),
    ]);

    const todayKey = today.toISOString().slice(0, 10);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const todayRow = rangeRows.find(
      (row) => new Date(row.day).toISOString().slice(0, 10) === todayKey,
    );
    const weekRows = rangeRows.filter(
      (row) => new Date(row.day).toISOString().slice(0, 10) >= weekKey,
    );
    const sum = (
      rows: Array<{
        visits: number;
        unique_visitors: number;
        page_views: number;
      }>,
      key: 'visits' | 'unique_visitors' | 'page_views',
    ) => rows.reduce((n, row) => n + Number(row[key] || 0), 0);

    return {
      currentlyOnline: counts.online,
      visitorsToday: todayRow?.visits ?? 0,
      uniqueVisitorsToday: todayRow?.unique_visitors ?? 0,
      pageViewsToday: todayRow?.page_views ?? 0,
      visitorsThisWeek: sum(weekRows, 'visits'),
      uniqueVisitorsThisWeek: sum(weekRows, 'unique_visitors'),
      pageViewsThisWeek: sum(weekRows, 'page_views'),
      visitorsThisMonth: sum(rangeRows, 'visits'),
      uniqueVisitorsThisMonth: sum(rangeRows, 'unique_visitors'),
      pageViewsThisMonth: sum(rangeRows, 'page_views'),
      totalVisitors: counts.totalVisitors,
      mostVisitedPages: pages.map((row) => ({
        path: row.path,
        views: row.views,
      })),
      trend: rangeRows.map((row) => ({
        day: new Date(row.day).toISOString().slice(0, 10),
        visits: row.visits,
        uniqueVisitors: row.unique_visitors,
        pageViews: row.page_views,
      })),
      definitions: {
        currentlyOnline:
          'Distinct browser sessions with a heartbeat inside the active timeout.',
        visits:
          'Sessions. A returning visitor after the timeout starts a new visit. Refreshes do not.',
        totalVisitors:
          'All recorded visits (sessions). Shown in the public footer as Total Visitors.',
        uniqueVisitors:
          'Distinct hashed visitor IDs in the period. One browser stays one visitor.',
        pageViews:
          'Counted when a visitor opens a different public path, not on heartbeat or refresh of the same path.',
      },
    };
  }

  private allowNewVisitor(ipHash: string, visitorHash: string): boolean {
    const now = Date.now();
    const row = newHashesByIp.get(ipHash);
    if (!row || now - row.at > 10 * 60_000) {
      newHashesByIp.set(ipHash, { at: now, hashes: new Set([visitorHash]) });
      return true;
    }
    if (row.hashes.has(visitorHash)) return true;
    if (row.hashes.size >= 4) return false;
    row.hashes.add(visitorHash);
    return true;
  }

  private async bumpAnalytics(
    tenantId: string,
    input: {
      isNewVisit: boolean;
      isNewUnique: boolean;
      isPageView: boolean;
      path: string;
    },
  ) {
    const day = istDayDate();
    const id = randomUUID();
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO school.school_web_visitor_daily
        (id, tenant_id, day, visits, unique_visitors, page_views, created_at, updated_at)
      VALUES
        (${id}::uuid, ${tenantId}::uuid, ${day}::date, ${input.isNewVisit ? 1 : 0}, ${input.isNewUnique ? 1 : 0}, ${input.isPageView ? 1 : 0}, NOW(), NOW())
      ON CONFLICT (tenant_id, day) DO UPDATE SET
        visits = school.school_web_visitor_daily.visits + EXCLUDED.visits,
        unique_visitors = school.school_web_visitor_daily.unique_visitors + EXCLUDED.unique_visitors,
        page_views = school.school_web_visitor_daily.page_views + EXCLUDED.page_views,
        updated_at = NOW()
    `);
    if (input.isPageView) {
      const pageId = randomUUID();
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO school.school_web_visitor_page_stats
          (id, tenant_id, day, path, views, created_at, updated_at)
        VALUES
          (${pageId}::uuid, ${tenantId}::uuid, ${day}::date, ${input.path}, 1, NOW(), NOW())
        ON CONFLICT (tenant_id, day, path) DO UPDATE SET
          views = school.school_web_visitor_page_stats.views + 1,
          updated_at = NOW()
      `);
    }
  }

  private async cleanup(tenantId: string, retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000);
    const presenceCutoff = new Date(
      Date.now() - Math.max(retentionDays, 120) * 24 * 60 * 60_000,
    );
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM school.school_web_visitor_daily WHERE tenant_id = ${tenantId}::uuid AND day < ${cutoff}::date
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM school.school_web_visitor_page_stats WHERE tenant_id = ${tenantId}::uuid AND day < ${cutoff}::date
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM school.school_web_visitor_presence
      WHERE tenant_id = ${tenantId}::uuid AND last_seen_at < ${presenceCutoff}
    `);
  }
}
