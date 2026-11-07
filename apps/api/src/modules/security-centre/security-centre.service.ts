import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toCsv } from './domain/csv';
import type { LoginProtection } from './domain/login-protection';
import { redactSecurityValue } from './domain/redact-security-payload';
import {
  verifySecurityChain,
  type SecurityHashPayload,
} from './domain/security-hash';
import { SecurityEventRecorder } from './security-event.recorder';
import { SecurityFileIntegrityService } from './security-file-integrity.service';
import { SecurityPolicyService } from './security-policy.service';

const SENSITIVE_MODULES = [
  'students',
  'student',
  'examinations',
  'examination',
  'attendance',
  'fees',
  'fee',
  'payments',
  'payment',
  'staff',
  'payroll',
  'salary',
  'hr',
  'rbac',
  'users',
  'administration',
  'settings',
];

type TrailQuery = {
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
  limit?: string;
  eventType?: string;
  severity?: string;
};

type TrailRow = {
  id: string;
  source: string;
  at: string;
  actorUserId: string | null;
  action: string;
  module: string;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  severity: string | null;
  previousValue: unknown;
  newValue: unknown;
};

@Injectable()
export class SecurityCentreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SecurityPolicyService,
    private readonly recorder: SecurityEventRecorder,
    private readonly files: SecurityFileIntegrityService,
  ) {}

  async dashboard(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      successfulLogins,
      failedLogins,
      lockoutEvents,
      activeLockouts,
      unauthorizedApi,
      openAlerts,
      recentAlerts,
      latestBackup,
      failedSamples,
      sensitiveCounts,
    ] = await Promise.all([
      this.prisma.authLoginEvent.count({
        where: { tenantId, outcome: 'success' },
      }),
      this.prisma.authLoginEvent.count({
        where: { tenantId, outcome: 'failure', createdAt: { gte: since24h } },
      }),
      this.prisma.authLoginEvent.count({
        where: { tenantId, outcome: 'lockout', createdAt: { gte: since7d } },
      }),
      this.prisma.loginAttempt.count({
        where: { tenantId, lockedUntil: { gt: now } },
      }),
      this.prisma.permissionAuditLog.count({
        where: { tenantId, outcome: 'denied', createdAt: { gte: since7d } },
      }),
      this.prisma.securityAlert.count({
        where: { tenantId, status: 'open' },
      }),
      this.prisma.securityAlert.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          ruleCode: true,
          severity: true,
          title: true,
          summary: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.backupRun.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, completedAt: true, type: true, sizeBytes: true },
      }),
      this.prisma.authLoginEvent.findMany({
        where: {
          tenantId,
          outcome: 'failure',
          createdAt: { gte: since24h },
          ipAddress: { not: null },
        },
        select: { ipAddress: true },
        take: 1000,
      }),
      this.sensitiveChangeCounts(tenantId, since24h),
    ]);

    const ipCounts = new Map<string, number>();
    for (const row of failedSamples) {
      if (!row.ipAddress) continue;
      ipCounts.set(row.ipAddress, (ipCounts.get(row.ipAddress) ?? 0) + 1);
    }
    const suspiciousIps = [...ipCounts.entries()]
      .filter(([, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ipAddress, failures]) => ({ ipAddress, failures }));

    return {
      successfulLogins,
      failedLogins24h: failedLogins,
      suspiciousIps,
      unauthorizedApi7d: unauthorizedApi,
      accountLockouts: activeLockouts,
      lockouts7d: lockoutEvents,
      sensitiveModifications24h: sensitiveCounts.total,
      sensitiveBreakdown: sensitiveCounts.breakdown,
      openAlerts,
      recentAlerts,
      server: this.serverStatus(),
      backup: {
        lastSuccessAt: latestBackup?.completedAt ?? null,
        lastRunId: latestBackup?.id ?? null,
        type: latestBackup?.type ?? null,
        sizeBytes: latestBackup?.sizeBytes?.toString() ?? null,
        encryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
      },
    };
  }

  async listEvents(tenantId: string, query: TrailQuery) {
    const { page, limit, skip } = this.page(query);
    const where = this.eventWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { seq: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityEvent.count({ where }),
    ]);
    return {
      items: items.map((row) => this.presentEvent(row)),
      total,
      page,
      limit,
    };
  }

  async exportEvents(tenantId: string, query: TrailQuery) {
    const where = this.eventWhere(tenantId, query);
    const items = await this.prisma.securityEvent.findMany({
      where,
      orderBy: { seq: 'desc' },
      take: 5000,
    });
    const csv = toCsv(
      [
        'time',
        'type',
        'severity',
        'action',
        'actor',
        'ip',
        'module',
        'entity',
        'summary',
        'previous',
        'updated',
      ],
      items.map((row) => [
        row.createdAt.toISOString(),
        row.eventType,
        row.severity,
        row.action,
        row.actorUserId,
        row.ipAddress,
        row.module,
        row.entityId,
        row.summary,
        row.previousValue,
        row.newValue,
      ]),
    );
    return {
      filename: `security-events-${tenantId.slice(0, 8)}.csv`,
      csv,
    };
  }

  async listAlerts(
    tenantId: string,
    query: { status?: string; page?: string; limit?: string },
  ) {
    const { page, limit, skip } = this.page(query);
    const where: Prisma.SecurityAlertWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.securityAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityAlert.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async acknowledge(tenantId: string, alertId: string, actorUserId: string) {
    const alert = await this.prisma.securityAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) throw new NotFoundException('Security alert not found');
    if (alert.status !== 'acknowledged') {
      await this.prisma.securityAlert.update({
        where: { id: alert.id },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedById: actorUserId,
        },
      });
    }
    await this.recorder.capture({
      tenantId,
      actorUserId,
      eventType: 'ALERT_ACKNOWLEDGED',
      severity: 'info',
      module: 'security',
      action: 'alert_acknowledged',
      summary: `Acknowledged ${alert.ruleCode}`,
      entityId: alert.id,
      subjectKey: alert.subjectKey,
    });
    return { id: alert.id, status: 'acknowledged' };
  }

  async listTrail(tenantId: string, query: TrailQuery) {
    const source = query.source || 'security';
    if (source === 'security') {
      const page = await this.listEvents(tenantId, query);
      return {
        ...page,
        items: page.items.map((row) => ({
          id: row.id,
          source: 'security',
          at: row.createdAt,
          actorUserId: row.actorUserId,
          action: row.action,
          module: row.module,
          entityId: row.entityId,
          summary: row.summary,
          ipAddress: row.ipAddress,
          severity: row.severity,
          previousValue: row.previousValue,
          newValue: row.newValue,
        })),
      };
    }
    const { page, limit } = this.page(query);
    const take = Math.min(page * limit, 200);
    const rows = await this.trailSource(tenantId, source, query, take);
    const start = (page - 1) * limit;
    return {
      items: rows.slice(start, start + limit),
      total: rows.length,
      page,
      limit,
      truncated: rows.length >= take,
    };
  }

  async exportTrail(tenantId: string, query: TrailQuery) {
    const source = query.source || 'security';
    if (source === 'security') {
      const exported = await this.exportEvents(tenantId, query);
      return { ...exported, filename: `security-audit-security.csv` };
    }
    const rows = await this.trailSource(tenantId, source, query, 2000);
    const csv = toCsv(
      [
        'time',
        'source',
        'action',
        'actor',
        'module',
        'entity',
        'summary',
        'previous',
        'updated',
      ],
      rows.map((row) => [
        row.at,
        row.source,
        row.action,
        row.actorUserId,
        row.module,
        row.entityId,
        row.summary,
        row.previousValue,
        row.newValue,
      ]),
    );
    return { filename: `security-audit-${source}.csv`, csv };
  }

  async verifyChain(tenantId: string) {
    const rows = await this.prisma.securityEvent.findMany({
      where: { tenantId },
      orderBy: { seq: 'desc' },
      take: 500,
    });
    const ordered = [...rows].reverse();
    const result = verifySecurityChain(
      ordered.map((row) => ({
        prevHash: row.prevHash,
        recordHash: row.recordHash,
        payload: this.hashPayload(row),
      })),
    );
    return {
      ...result,
      window: ordered.length,
      limitation:
        'Verification covers the latest 500 events. A database superuser can still disable triggers.',
    };
  }

  getPolicy(tenantId: string) {
    return this.policy.get(tenantId);
  }

  async savePolicy(
    tenantId: string,
    actorUserId: string,
    patch: Partial<LoginProtection>,
  ) {
    const saved = await this.policy.save(tenantId, patch);
    await this.recorder.capture({
      tenantId,
      actorUserId,
      eventType: 'POLICY_CHANGE',
      severity: 'medium',
      module: 'security',
      action: 'monitor_policy_updated',
      summary: 'Security monitoring thresholds were updated',
      newValue: saved,
      subjectKey: `tenant:${tenantId}`,
    });
    return saved;
  }

  listFiles(tenantId: string) {
    return this.files.list(tenantId);
  }

  scanFiles(tenantId: string, actorUserId: string) {
    return this.files.scan(tenantId, actorUserId);
  }

  acceptFile(tenantId: string, actorUserId: string, relativePath: string) {
    return this.files.accept(tenantId, actorUserId, relativePath);
  }

  private serverStatus() {
    return {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      jwtConfigured: Boolean(process.env.JWT_ACCESS_SECRET),
      backupEncryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
      globalRateLimit: '300 requests per 60 seconds',
      validation: 'whitelist and reject unexpected fields',
      authentication: 'JWT required unless a route is explicitly public',
      authorization:
        'server-side permission guards; super administrators bypass permission lists',
      securityCentre: 'super administrator only, blocked during impersonation',
      appendOnlyAudit: true,
      checkedAt: new Date().toISOString(),
    };
  }

  private async sensitiveChangeCounts(tenantId: string, since: Date) {
    const where = { tenantId, createdAt: { gte: since } };
    const [platform, students, attendance, exams, fees, payroll, staff] =
      await Promise.all([
        this.prisma.auditLog.count({
          where: { ...where, module: { in: SENSITIVE_MODULES } },
        }),
        this.prisma.studentProfileAuditLog.count({ where }),
        this.prisma.studentAttendanceAuditLog.count({ where }),
        this.prisma.examAuditLog.count({ where }),
        this.prisma.feeAuditLog.count({ where }),
        this.prisma.payrollAuditLog.count({ where }),
        this.prisma.staffProfileAuditLog.count({ where }),
      ]);
    const breakdown = {
      platform,
      students,
      attendance,
      exams,
      fees,
      payroll,
      staff,
    };
    return {
      breakdown,
      total: Object.values(breakdown).reduce((sum, count) => sum + count, 0),
    };
  }

  private eventWhere(
    tenantId: string,
    query: TrailQuery,
  ): Prisma.SecurityEventWhereInput {
    const createdAt = this.range(query.from, query.to);
    return {
      tenantId,
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(query.q
        ? {
            OR: [
              { summary: { contains: query.q, mode: 'insensitive' } },
              { action: { contains: query.q, mode: 'insensitive' } },
              { ipAddress: { contains: query.q } },
              { entityId: { contains: query.q } },
            ],
          }
        : {}),
    };
  }

  private presentEvent(row: {
    id: string;
    createdAt: Date;
    eventType: string;
    severity: string;
    action: string;
    actorUserId: string | null;
    module: string | null;
    entityType: string | null;
    entityId: string | null;
    summary: string;
    ipAddress: string | null;
    userAgent: string | null;
    previousValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    subjectKey: string | null;
  }) {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      eventType: row.eventType,
      severity: row.severity,
      action: row.action,
      actorUserId: row.actorUserId,
      module: row.module,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      previousValue: redactSecurityValue(row.previousValue),
      newValue: redactSecurityValue(row.newValue),
      subjectKey: row.subjectKey,
    };
  }

  private hashPayload(row: {
    tenantId: string;
    actorUserId: string | null;
    eventType: string;
    severity: string;
    module: string | null;
    entityType: string | null;
    entityId: string | null;
    action: string;
    ipAddress: string | null;
    summary: string;
    subjectKey: string | null;
    createdAt: Date;
  }): SecurityHashPayload {
    return {
      tenantId: row.tenantId,
      actorUserId: row.actorUserId,
      eventType: row.eventType,
      severity: row.severity,
      module: row.module,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      ipAddress: row.ipAddress,
      summary: row.summary,
      subjectKey: row.subjectKey,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async trailSource(
    tenantId: string,
    source: string,
    query: TrailQuery,
    take: number,
  ): Promise<TrailRow[]> {
    const createdAt = this.range(query.from, query.to);
    const where = { tenantId, ...(createdAt ? { createdAt } : {}) };
    if (source === 'students') {
      const rows = await this.prisma.studentProfileAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        id: row.id,
        source,
        at: row.createdAt.toISOString(),
        actorUserId: row.actorId,
        action: 'profile_change',
        module: 'students',
        entityId: row.studentId,
        summary: `${row.sectionKey}.${row.fieldKey}`,
        ipAddress: null,
        severity: null,
        previousValue: redactSecurityValue(row.oldValue),
        newValue: redactSecurityValue(row.newValue),
      }));
    }
    if (source === 'attendance') {
      const rows = await this.prisma.studentAttendanceAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => this.jsonChange(source, 'attendance', row));
    }
    if (source === 'exams') {
      const rows = await this.prisma.examAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        ...this.jsonChange(source, 'examinations', row),
        entityId: row.entityId,
        summary: `${row.entity} ${row.action}`,
      }));
    }
    if (source === 'fees') {
      const rows = await this.prisma.feeAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        ...this.jsonChange(source, 'fees', row),
        entityId: row.demandId ?? row.feeStructureId,
        summary: row.reason || row.action,
      }));
    }
    if (source === 'payroll') {
      const rows = await this.prisma.payrollAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        id: row.id,
        source,
        at: row.createdAt.toISOString(),
        actorUserId: row.userId,
        action: row.action,
        module: 'payroll',
        entityId: row.entityId,
        summary: row.entityType,
        ipAddress: null,
        severity: null,
        previousValue: redactSecurityValue(row.oldValue),
        newValue: redactSecurityValue(row.newValue),
      }));
    }
    if (source === 'staff') {
      const rows = await this.prisma.staffProfileAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        id: row.id,
        source,
        at: row.createdAt.toISOString(),
        actorUserId: row.actorUserId,
        action: row.action,
        module: 'staff',
        entityId: row.staffProfileId,
        summary: row.summary,
        ipAddress: null,
        severity: null,
        previousValue: null,
        newValue: redactSecurityValue(row.metaJson),
      }));
    }
    if (source === 'permissions') {
      const rows = await this.prisma.permissionAuditLog.findMany({
        where: { ...where, outcome: 'denied' },
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => ({
        id: row.id,
        source,
        at: row.createdAt.toISOString(),
        actorUserId: row.userId,
        action: row.action,
        module: row.module ?? 'rbac',
        entityId: null,
        summary: row.permissionSlug ?? row.action,
        ipAddress: row.ipAddress,
        severity: 'medium',
        previousValue: null,
        newValue: redactSecurityValue(row.metadata),
      }));
    }
    const rows = await this.prisma.auditLog.findMany({
      where: { ...where, module: { in: SENSITIVE_MODULES } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      source: 'platform',
      at: row.createdAt.toISOString(),
      actorUserId: row.userId,
      action: row.action,
      module: row.module ?? 'administration',
      entityId: row.entityId,
      summary: `${row.entityType} ${row.action}`,
      ipAddress: null,
      severity: null,
      previousValue: null,
      newValue: redactSecurityValue(row.metadata),
    }));
  }

  private jsonChange(
    source: string,
    moduleName: string,
    row: {
      id: string;
      createdAt: Date;
      actorId: string | null;
      action: string;
      before: Prisma.JsonValue | null;
      after: Prisma.JsonValue | null;
      entityId?: string | null;
      studentId?: string | null;
      sessionId?: string | null;
    },
  ): TrailRow {
    return {
      id: row.id,
      source,
      at: row.createdAt.toISOString(),
      actorUserId: row.actorId,
      action: row.action,
      module: moduleName,
      entityId: row.entityId ?? row.studentId ?? row.sessionId ?? null,
      summary: row.action,
      ipAddress: null,
      severity: null,
      previousValue: redactSecurityValue(row.before),
      newValue: redactSecurityValue(row.after),
    };
  }

  private page(query: { page?: string; limit?: string }) {
    const page = Math.max(1, Math.min(50, Number(query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 25));
    return { page, limit, skip: (page - 1) * limit };
  }

  private range(from?: string, to?: string) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) createdAt.gte = parsed;
    }
    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) createdAt.lte = parsed;
    }
    return createdAt.gte || createdAt.lte ? createdAt : undefined;
  }
}
