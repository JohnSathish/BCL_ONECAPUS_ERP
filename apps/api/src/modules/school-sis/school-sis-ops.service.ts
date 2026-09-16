import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { mkdir, readdir, readFile, rm, stat } from 'fs/promises';
import * as os from 'os';
import { dirname, join, resolve } from 'path';
import { createGzip, gunzipSync } from 'zlib';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { StorageService } from '../../shared/storage/storage.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisAccessService } from './school-sis-access.service';
import { SchoolSisLicenseService } from './school-sis-license.service';
import { SchoolSisOpsMetrics } from './school-sis-ops.metrics';
import {
  maskLicenseKey,
  redactDeep,
  redactText,
} from './school-sis-ops.redact';
import { SUPER_ROLE_SLUGS } from './school-sis-iam.catalog';

const DEFAULT_MAINT =
  "St. Luke's School ERP is temporarily unavailable while scheduled maintenance is being performed.";

@Injectable()
export class SchoolSisOpsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolSisOpsService.name);
  private readonly boot = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolSisAccessService,
    private readonly licenses: SchoolSisLicenseService,
    private readonly cache: CacheService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly metrics: SchoolSisOpsMetrics,
    @InjectQueue('school-ops') private readonly opsQueue: Queue,
    @InjectQueue('school-sms') private readonly smsQueue: Queue,
    @InjectQueue('school-whatsapp') private readonly waQueue: Queue,
    @InjectQueue('school-push') private readonly pushQueue: Queue,
    @InjectQueue('school-automation') private readonly autoQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.opsQueue.add(
        'tick',
        {},
        { repeat: { every: 60_000 }, jobId: 'school-ops-tick' },
      );
    } catch {
      this.logger.debug('ops scheduler already registered');
    }
  }

  async ensure(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolSysSettings.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        maintenanceMessage: DEFAULT_MAINT,
      },
    });
  }

  async isMaintenanceBlocking(tenantId: string): Promise<string | null> {
    const s = await this.prisma.schoolSysSettings.findUnique({
      where: { tenantId },
    });
    if (!s?.maintenanceEnabled) return null;
    const now = Date.now();
    if (s.maintenanceStart && now < s.maintenanceStart.getTime()) return null;
    if (s.maintenanceEnd && now > s.maintenanceEnd.getTime()) return null;
    return s.maintenanceMessage?.trim() || DEFAULT_MAINT;
  }

  async dashboard(tenantId: string) {
    const t0 = Date.now();
    const settings = await this.ensure(tenantId);
    const [health, license, lastBackup, sessions, failedLogins, activeUsers] =
      await Promise.all([
        this.status(tenantId),
        this.licenses.snapshot(tenantId).catch(() => null),
        this.prisma.schoolSysBackup.findFirst({
          where: { tenantId, status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.refreshSession.count({
          where: { tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        this.prisma.authLoginEvent.count({
          where: {
            tenantId,
            outcome: { not: 'SUCCESS' },
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null, isActive: true },
        }),
      ]);
    const nextBackup = this.nextBackupAt(settings);
    const overall = health.overall;
    return {
      overall,
      api: health.application.api,
      database: health.database.connection,
      redis: health.services.redis,
      storage: health.storage,
      cpu: health.server.cpuPct,
      memory: health.server.ram,
      disk: health.server.disk,
      databaseSize: health.database.sizePretty,
      activeUsers,
      activeSessions: sessions,
      failedLogins,
      lastBackup: lastBackup
        ? {
            at: lastBackup.finishedAt ?? lastBackup.createdAt,
            status: lastBackup.status,
          }
        : null,
      nextBackup,
      version: health.application.version,
      license: license
        ? {
            status: this.licenseTone(license.status, license.daysRemaining),
            expiry: license.expiresAt,
            daysRemaining: license.daysRemaining,
            type: license.licenseType,
            key: maskLicenseKey(license.licenseKey),
            institution: license.institutionName,
            maxStudents: license.maxStudents,
            modules: license.enabledModules,
          }
        : { status: 'MISSING' },
      maintenance: {
        enabled: settings.maintenanceEnabled,
        message: settings.maintenanceMessage,
        start: settings.maintenanceStart,
        end: settings.maintenanceEnd,
      },
      apiMs: Date.now() - t0,
      refreshedAt: new Date().toISOString(),
    };
  }

  async status(tenantId: string) {
    await this.ensure(tenantId);
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuPct = Math.min(
      100,
      Math.round((os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 100),
    );
    const disk = await this.diskUsage();
    const db = await this.databaseHealth();
    const redis = await this.cache.healthStats();
    const storage = await this.storageBreakdown();
    const queues = await this.queueHealth();
    const services = await this.serviceHealth(tenantId, redis.connected);
    const overall = this.overall([
      db.connection === 'Operational' ? 'ok' : 'crit',
      redis.connected ? 'ok' : 'warn',
      disk.usedPct >= 90 ? 'crit' : disk.usedPct >= 80 ? 'warn' : 'ok',
      services.email,
      services.sms,
    ]);
    return {
      overall,
      server: {
        cpuPct,
        ram: {
          usedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
          usedPretty: this.bytes(totalMem - freeMem),
          totalPretty: this.bytes(totalMem),
        },
        disk,
        uptimeSec: Math.floor(os.uptime()),
        node: process.version,
        os: `${os.type()} ${os.release()}`,
        host: os.hostname(),
      },
      application: {
        name: "St. Luke's School ERP",
        version:
          this.config.get('APP_VERSION') ??
          process.env.npm_package_version ??
          '1.0.0',
        environment: this.config.get('NODE_ENV') ?? 'production',
        api: 'Operational',
        apiMs: this.metrics.snapshot().averageMs,
        uptimeSec: Math.floor((Date.now() - this.boot) / 1000),
        queues,
        websocket: redis.connected ? 'Operational' : 'Degraded',
      },
      database: db,
      services,
      storage,
      performance: this.metrics.snapshot(),
    };
  }

  async cacheStatus() {
    const stats = await this.cache.healthStats();
    return {
      ...stats,
      memoryPretty: this.bytes(stats.memoryBytes),
      scopes: [
        { id: 'application', label: 'Application cache', prefix: 'sis:' },
        {
          id: 'configuration',
          label: 'Configuration cache',
          prefix: 'sis-cfg:',
        },
        { id: 'api', label: 'API cache', prefix: 'sis-api:' },
        { id: 'session', label: 'Session cache', prefix: 'sess:' },
        { id: 'redis', label: 'Tenant Redis keys', prefix: 'sis:' },
      ],
    };
  }

  async clearCache(
    tenantId: string,
    actor: JwtUser,
    scope: string,
    meta: { ip?: string; ua?: string; requestId?: string },
  ) {
    const map: Record<string, string> = {
      application: 'sis:',
      configuration: 'sis-cfg:',
      api: 'sis-api:',
      session: `sess:${tenantId}`,
      redis: `sis:${tenantId}`,
    };
    const prefix = map[scope];
    if (!prefix) throw new BadRequestException('Unknown cache scope');
    if (scope === 'session' && !this.access.isSuper(actor)) {
      throw new ForbiddenException('Only Super Admin can clear session cache');
    }
    await this.cache.delByPrefix(prefix);
    await this.audit(
      tenantId,
      actor,
      'CACHE_CLEAR',
      'cache',
      meta,
      {},
      { scope },
    );
    await this.log(
      tenantId,
      'WARNING',
      'cache',
      `Cleared ${scope} cache`,
      actor.sub,
      meta,
    );
    return { ok: true, scope };
  }

  async backups(tenantId: string) {
    const settings = await this.ensure(tenantId);
    const items = await this.prisma.schoolSysBackup.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const last = items.find((b) => b.status === 'SUCCESS');
    return {
      schedule: {
        cadence: settings.backupSchedule,
        hour: settings.backupHour,
        minute: settings.backupMinute,
        retainDays: settings.backupRetentionDays,
        keepCount: settings.backupKeepCount,
        database: settings.backupDatabase,
        uploads: settings.backupUploads,
      },
      lastBackup: last
        ? { at: last.finishedAt ?? last.createdAt, status: 'Successful' }
        : { at: null, status: 'Never' },
      nextBackup: this.nextBackupAt(settings),
      items,
    };
  }

  async createBackup(
    tenantId: string,
    actor: JwtUser,
    kind: string,
    meta: { ip?: string; ua?: string; requestId?: string },
  ) {
    const row = await this.prisma.schoolSysBackup.create({
      data: {
        tenantId,
        kind: kind === 'FULL' || kind === 'UPLOADS' ? kind : 'DATABASE',
        status: 'PENDING',
        createdBy: actor.sub,
      },
    });
    await this.opsQueue.add('backup', { tenantId, backupId: row.id });
    await this.audit(
      tenantId,
      actor,
      'BACKUP_CREATE',
      'backup',
      meta,
      {},
      { id: row.id, kind: row.kind },
    );
    return row;
  }

  async processBackup(tenantId: string, backupId: string) {
    const row = await this.prisma.schoolSysBackup.findFirst({
      where: { id: backupId, tenantId },
    });
    if (!row) return;
    await this.prisma.schoolSysBackup.update({
      where: { id: backupId },
      data: { status: 'RUNNING' },
    });
    try {
      const key = `school-ops/${tenantId}/backups/${backupId}.json.gz`;
      const abs = this.storage.resolveLocalPath(key);
      await mkdir(dirname(abs), { recursive: true });
      const payload = await this.buildBackupPayload(tenantId, row.kind);
      const gz = createGzip();
      const out = createWriteStream(abs);
      await new Promise<void>((resolveP, reject) => {
        gz.on('error', reject);
        out.on('error', reject);
        out.on('finish', () => resolveP());
        gz.pipe(out);
        gz.end(Buffer.from(JSON.stringify(payload)));
      });
      const buf = await readFile(abs);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      await this.prisma.schoolSysBackup.update({
        where: { id: backupId },
        data: {
          status: 'SUCCESS',
          fileKey: key,
          sizeBytes: buf.length,
          sha256,
          verifiedAt: new Date(),
          finishedAt: new Date(),
          error: null,
        },
      });
      await this.log(
        tenantId,
        'INFO',
        'backup',
        `Backup ${row.kind} completed`,
        row.createdBy,
        {},
      );
    } catch (err) {
      await this.prisma.schoolSysBackup.update({
        where: { id: backupId },
        data: {
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Backup failed',
          finishedAt: new Date(),
        },
      });
      await this.log(
        tenantId,
        'ERROR',
        'backup',
        err instanceof Error ? err.message : 'Backup failed',
        row.createdBy,
        {},
      );
    }
  }

  async verifyBackup(
    tenantId: string,
    id: string,
    actor: JwtUser,
    meta: { ip?: string },
  ) {
    const row = await this.mustBackup(tenantId, id);
    if (!row.fileKey || !row.sha256)
      throw new BadRequestException('Backup file missing');
    const abs = this.safeFile(row.fileKey);
    const buf = await readFile(abs);
    const sha = createHash('sha256').update(buf).digest('hex');
    const ok = sha === row.sha256;
    await this.prisma.schoolSysBackup.update({
      where: { id },
      data: {
        verifiedAt: ok ? new Date() : null,
        status: ok ? 'SUCCESS' : 'FAILED',
      },
    });
    await this.audit(
      tenantId,
      actor,
      'BACKUP_VERIFY',
      'backup',
      meta,
      {},
      { id, ok },
    );
    return { ok, sha256: sha };
  }

  async deleteBackup(
    tenantId: string,
    id: string,
    actor: JwtUser,
    meta: { ip?: string },
  ) {
    const row = await this.mustBackup(tenantId, id);
    if (row.fileKey) {
      const abs = this.safeFile(row.fileKey);
      await rm(abs, { force: true });
    }
    await this.prisma.schoolSysBackup.delete({ where: { id } });
    await this.audit(
      tenantId,
      actor,
      'BACKUP_DELETE',
      'backup',
      meta,
      { id },
      {},
    );
    return { ok: true };
  }

  async restoreBackup(
    tenantId: string,
    id: string,
    actor: JwtUser,
    confirm: boolean,
    meta: { ip?: string },
  ) {
    if (
      !this.access.isSuper(actor) &&
      !SUPER_ROLE_SLUGS.has(actor.roles?.[0] ?? '')
    ) {
      throw new ForbiddenException(
        'Only Super Admin can restore production data',
      );
    }
    if (
      !this.access.has(actor, 'system.backup.restore') &&
      !this.access.isSuper(actor)
    ) {
      throw new ForbiddenException('Restore is not permitted');
    }
    if (!confirm) throw new BadRequestException('Confirmation required');
    const row = await this.mustBackup(tenantId, id);
    if (!row.fileKey) throw new BadRequestException('Backup file missing');
    const abs = this.safeFile(row.fileKey);
    const raw = gunzipSync(await readFile(abs));
    const payload = JSON.parse(raw.toString('utf8')) as {
      tenantId?: string;
      kind?: string;
    };
    if (payload.tenantId && payload.tenantId !== tenantId) {
      throw new BadRequestException('Backup belongs to another school');
    }
    await this.audit(
      tenantId,
      actor,
      'BACKUP_RESTORE',
      'backup',
      meta,
      {},
      {
        id,
        kind: row.kind,
        note: 'Verified archive; live table restore is Super Admin only and queued',
      },
    );
    await this.log(
      tenantId,
      'CRITICAL',
      'backup',
      `Restore requested for ${id}`,
      actor.sub,
      meta,
    );
    return {
      ok: true,
      message:
        'Backup verified. Live table restore is performed by BaseCode Labs with Super Admin approval to avoid accidental production overwrite.',
    };
  }

  async backupFile(tenantId: string, id: string) {
    const row = await this.mustBackup(tenantId, id);
    if (!row.fileKey) throw new NotFoundException('File missing');
    return {
      path: this.safeFile(row.fileKey),
      name: `${row.kind}-${id}.json.gz`,
    };
  }

  async saveSchedule(
    tenantId: string,
    actor: JwtUser,
    body: Record<string, unknown>,
    meta: { ip?: string },
  ) {
    const before = await this.ensure(tenantId);
    const updated = await this.prisma.schoolSysSettings.update({
      where: { tenantId },
      data: {
        backupSchedule: String(body.backupSchedule ?? before.backupSchedule),
        backupHour: Number(body.backupHour ?? before.backupHour),
        backupMinute: Number(body.backupMinute ?? before.backupMinute),
        backupRetentionDays: Number(
          body.backupRetentionDays ?? before.backupRetentionDays,
        ),
        backupKeepCount: Number(body.backupKeepCount ?? before.backupKeepCount),
        backupDatabase:
          body.backupDatabase == null
            ? before.backupDatabase
            : Boolean(body.backupDatabase),
        backupUploads:
          body.backupUploads == null
            ? before.backupUploads
            : Boolean(body.backupUploads),
      },
    });
    await this.audit(
      tenantId,
      actor,
      'BACKUP_SCHEDULE',
      'backup',
      meta,
      before,
      updated,
    );
    return updated;
  }

  async logs(
    tenantId: string,
    q: {
      level?: string;
      module?: string;
      search?: string;
      from?: string;
      to?: string;
      requestId?: string;
      userId?: string;
      ip?: string;
      page?: number;
    },
  ) {
    await this.ensure(tenantId);
    const page = Math.max(1, q.page ?? 1);
    const where: Prisma.SchoolSysLogWhereInput = { tenantId };
    if (q.level) where.level = q.level;
    if (q.module) where.module = q.module;
    if (q.requestId) where.requestId = q.requestId;
    if (q.userId) where.userId = q.userId;
    if (q.ip) where.ip = { contains: q.ip };
    if (q.from || q.to) {
      where.createdAt = {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      };
    }
    if (q.search?.trim()) {
      where.message = { contains: q.search.trim(), mode: 'insensitive' };
    }
    const [total, items] = await Promise.all([
      this.prisma.schoolSysLog.count({ where }),
      this.prisma.schoolSysLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
      }),
    ]);
    return { total, page, items };
  }

  async exportLogs(tenantId: string, actor: JwtUser, meta: { ip?: string }) {
    const { items } = await this.logs(tenantId, { page: 1 });
    await this.audit(
      tenantId,
      actor,
      'LOGS_EXPORT',
      'logs',
      meta,
      {},
      { count: items.length },
    );
    return items;
  }

  async purgeLogs(tenantId: string, actor: JwtUser, meta: { ip?: string }) {
    const s = await this.ensure(tenantId);
    const cut = new Date(Date.now() - s.logRetentionDays * 86400000);
    const res = await this.prisma.schoolSysLog.deleteMany({
      where: { tenantId, createdAt: { lt: cut } },
    });
    await this.audit(
      tenantId,
      actor,
      'LOGS_PURGE',
      'logs',
      meta,
      {},
      { deleted: res.count },
    );
    return { deleted: res.count };
  }

  async auditList(tenantId: string, page = 1) {
    await this.ensure(tenantId);
    const [ops, logins] = await Promise.all([
      this.prisma.schoolSysAudit.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 40,
        take: 40,
      }),
      this.prisma.authLoginEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const merged = [
      ...ops.map((a) => ({
        id: a.id,
        source: 'ops',
        user: a.actorEmail,
        action: a.action,
        module: a.module,
        at: a.createdAt,
        ip: a.ip,
        device: a.userAgent,
        requestId: a.requestId,
        previous: a.beforeJson,
        next: a.afterJson,
      })),
      ...logins.map((e) => ({
        id: e.id,
        source: 'auth',
        user: e.identifier ?? e.userId,
        action: e.outcome === 'SUCCESS' ? 'LOGIN' : 'FAILED_LOGIN',
        module: 'auth',
        at: e.createdAt,
        ip: e.ipAddress,
        device: e.userAgent,
        requestId: null,
        previous: {},
        next: { outcome: e.outcome },
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return { items: merged };
  }

  async maintenanceGet(tenantId: string) {
    const s = await this.ensure(tenantId);
    return {
      enabled: s.maintenanceEnabled,
      message: s.maintenanceMessage ?? DEFAULT_MAINT,
      start: s.maintenanceStart,
      end: s.maintenanceEnd,
      allowAdminBypass: s.maintenanceAllowAdminBypass,
      blocking: await this.isMaintenanceBlocking(tenantId),
    };
  }

  async maintenanceSet(
    tenantId: string,
    actor: JwtUser,
    body: Record<string, unknown>,
    meta: { ip?: string; ua?: string },
  ) {
    const before = await this.ensure(tenantId);
    const updated = await this.prisma.schoolSysSettings.update({
      where: { tenantId },
      data: {
        maintenanceEnabled: Boolean(body.enabled ?? body.maintenanceEnabled),
        maintenanceMessage: String(
          body.message ?? before.maintenanceMessage ?? DEFAULT_MAINT,
        ),
        maintenanceStart: body.start
          ? new Date(String(body.start))
          : before.maintenanceStart,
        maintenanceEnd: body.end
          ? new Date(String(body.end))
          : before.maintenanceEnd,
        maintenanceAllowAdminBypass:
          body.allowAdminBypass == null
            ? before.maintenanceAllowAdminBypass
            : Boolean(body.allowAdminBypass),
      },
    });
    await this.audit(
      tenantId,
      actor,
      'MAINTENANCE',
      'maintenance',
      meta,
      before,
      updated,
    );
    await this.log(
      tenantId,
      'WARNING',
      'maintenance',
      updated.maintenanceEnabled
        ? 'Maintenance enabled'
        : 'Maintenance disabled',
      actor.sub,
      meta,
    );
    return this.maintenanceGet(tenantId);
  }

  async configGet(tenantId: string) {
    const s = await this.ensure(tenantId);
    return {
      timezone: s.timezone,
      dateFormat: s.dateFormat,
      currency: s.currency,
      language: s.language,
      academicYearLabel: s.academicYearLabel,
      pageSize: s.pageSize,
      sessionTimeoutMin: s.sessionTimeoutMin,
      passwordMinLength: s.passwordMinLength,
      passwordRequireMfa: s.passwordRequireMfa,
      loginAttemptLimit: s.loginAttemptLimit,
      uploadMaxMb: s.uploadMaxMb,
      allowedFileTypes: s.allowedFileTypes,
      notifyEmail: s.notifyEmail,
      notifySms: s.notifySms,
      notifyPush: s.notifyPush,
      auditRetentionDays: s.auditRetentionDays,
      logRetentionDays: s.logRetentionDays,
      backupRetentionDays: s.backupRetentionDays,
    };
  }

  async configSave(
    tenantId: string,
    actor: JwtUser,
    body: Record<string, unknown>,
    meta: { ip?: string },
  ) {
    const before = await this.ensure(tenantId);
    const updated = await this.prisma.schoolSysSettings.update({
      where: { tenantId },
      data: {
        timezone: String(body.timezone ?? before.timezone),
        dateFormat: String(body.dateFormat ?? before.dateFormat),
        currency: String(body.currency ?? before.currency),
        language: String(body.language ?? before.language),
        academicYearLabel:
          body.academicYearLabel == null
            ? before.academicYearLabel
            : String(body.academicYearLabel),
        pageSize: Number(body.pageSize ?? before.pageSize),
        sessionTimeoutMin: Number(
          body.sessionTimeoutMin ?? before.sessionTimeoutMin,
        ),
        passwordMinLength: Number(
          body.passwordMinLength ?? before.passwordMinLength,
        ),
        passwordRequireMfa:
          body.passwordRequireMfa == null
            ? before.passwordRequireMfa
            : Boolean(body.passwordRequireMfa),
        loginAttemptLimit: Number(
          body.loginAttemptLimit ?? before.loginAttemptLimit,
        ),
        uploadMaxMb: Number(body.uploadMaxMb ?? before.uploadMaxMb),
        allowedFileTypes: String(
          body.allowedFileTypes ?? before.allowedFileTypes,
        ),
        notifyEmail:
          body.notifyEmail == null
            ? before.notifyEmail
            : Boolean(body.notifyEmail),
        notifySms:
          body.notifySms == null ? before.notifySms : Boolean(body.notifySms),
        notifyPush:
          body.notifyPush == null
            ? before.notifyPush
            : Boolean(body.notifyPush),
        auditRetentionDays: Number(
          body.auditRetentionDays ?? before.auditRetentionDays,
        ),
        logRetentionDays: Number(
          body.logRetentionDays ?? before.logRetentionDays,
        ),
        storageWarnPct: Number(body.storageWarnPct ?? before.storageWarnPct),
        storageCritPct: Number(body.storageCritPct ?? before.storageCritPct),
      },
    });
    await this.audit(
      tenantId,
      actor,
      'CONFIG_CHANGE',
      'configuration',
      meta,
      before,
      updated,
    );
    return this.configGet(tenantId);
  }

  async testChannel(
    tenantId: string,
    actor: JwtUser,
    channel: string,
    meta: { ip?: string },
  ) {
    const map: Record<string, () => Promise<Record<string, unknown>>> = {
      email: async () => ({
        ok: Boolean(this.config.get('SMTP_HOST')),
        detail: this.config.get('SMTP_HOST')
          ? 'SMTP host is configured'
          : 'SMTP host is not set',
      }),
      sms: async () => {
        const g = await this.prisma.schoolSmsGateway.findFirst({
          where: { tenantId, isDefault: true },
        });
        return {
          ok: Boolean(g && g.status === 'ACTIVE'),
          detail: g?.health ?? 'No gateway',
        };
      },
      whatsapp: async () => ({
        ok: this.cache.isEnabled(),
        detail: 'WhatsApp worker uses the school queue',
      }),
      push: async () => ({
        ok: Boolean(
          this.config.get('FCM_SERVER_KEY') ||
          this.config.get('FIREBASE_PROJECT_ID'),
        ),
        detail: 'FCM credentials are not returned',
      }),
    };
    const run = map[channel];
    if (!run) throw new BadRequestException('Unknown channel');
    const result = await run();
    await this.audit(
      tenantId,
      actor,
      `TEST_${channel.toUpperCase()}`,
      'diagnostics',
      meta,
      {},
      result,
    );
    await this.log(
      tenantId,
      result.ok ? 'INFO' : 'WARNING',
      channel,
      `Test ${channel}`,
      actor.sub,
      meta,
    );
    return result;
  }

  async jobs() {
    const listed: Array<[string, Queue]> = [
      ['sms', this.smsQueue],
      ['whatsapp', this.waQueue],
      ['push', this.pushQueue],
      ['automation', this.autoQueue],
      ['ops', this.opsQueue],
    ];
    const packs = await Promise.all(
      listed.map(async ([name, queue]) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all(
          [
            queue.getJobs(['waiting'], 0, 20),
            queue.getJobs(['active'], 0, 20),
            queue.getJobs(['completed'], 0, 20),
            queue.getJobs(['failed'], 0, 20),
            queue.getJobs(['delayed'], 0, 20),
          ],
        );
        const counts = await queue.getJobCounts();
        const raw = [
          ...waiting,
          ...active,
          ...completed,
          ...failed,
          ...delayed,
        ];
        const items = [];
        for (const j of raw) {
          items.push({
            id: j.id,
            queue: name,
            name: j.name,
            state: await j.getState(),
            attempts: j.attemptsMade,
            timestamp: j.timestamp,
            failedReason: j.failedReason,
            processedOn: j.processedOn,
            finishedOn: j.finishedOn,
          });
        }
        return { name, counts, items };
      }),
    );
    return { queues: packs };
  }

  async retryJob(actor: JwtUser, queueName: string, id: string) {
    this.access.assert(actor, 'system.jobs.retry', 'school-sis:manage');
    const q = this.queueByName(queueName);
    const job = await q.getJob(id);
    if (!job) throw new NotFoundException('Job not found');
    await job.retry();
    return { ok: true };
  }

  async cancelJob(actor: JwtUser, queueName: string, id: string) {
    this.access.assert(actor, 'system.jobs.retry', 'school-sis:manage');
    const q = this.queueByName(queueName);
    const job = await q.getJob(id);
    if (!job) throw new NotFoundException('Job not found');
    await job.remove();
    return { ok: true };
  }

  async about(tenantId: string) {
    const license = await this.licenses.snapshot(tenantId);
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const db = await this.databaseHealth();
    return {
      erpName: "St. Luke's School ERP",
      schoolName: branding?.displayName ?? "St. Luke's Secondary School, Tura",
      version: this.config.get('APP_VERSION') ?? '1.0.0',
      build:
        this.config.get('BUILD_SHA') ?? this.config.get('IMAGE_TAG') ?? 'local',
      database: db.version,
      lastDeploy: this.config.get('DEPLOYED_AT') ?? null,
      environment: this.config.get('NODE_ENV') ?? 'production',
      copyright: `© ${new Date().getFullYear()} St. Luke's Secondary School, Tura`,
      license: {
        status: this.licenseTone(license.status, license.daysRemaining),
        type: license.licenseType,
        key: maskLicenseKey(license.licenseKey),
        activatedAt: license.activatedAt,
        expiry: license.expiresAt,
        daysRemaining: license.daysRemaining,
        institution: license.institutionName,
        maxStudents: license.maxStudents,
        modules: license.enabledModules,
      },
    };
  }

  async tick() {
    const tenants = await this.prisma.schoolSysSettings.findMany();
    for (const s of tenants) {
      try {
        await this.maybeScheduleBackup(s.tenantId, s);
        await this.retain(s);
      } catch (err) {
        this.logger.warn(err);
      }
    }
  }

  private async maybeScheduleBackup(
    tenantId: string,
    s: { backupSchedule: string; backupHour: number; backupMinute: number },
  ) {
    if (s.backupSchedule === 'MANUAL') return;
    const now = new Date();
    if (now.getHours() !== s.backupHour || now.getMinutes() !== s.backupMinute)
      return;
    const since = new Date(Date.now() - 90 * 60_000);
    const recent = await this.prisma.schoolSysBackup.findFirst({
      where: {
        tenantId,
        createdAt: { gte: since },
        kind: { in: ['DATABASE', 'FULL'] },
      },
    });
    if (recent) return;
    const weekday = now.getDay();
    if (s.backupSchedule === 'WEEKLY' && weekday !== 0) return;
    if (s.backupSchedule === 'MONTHLY' && now.getDate() !== 1) return;
    const systemUser =
      (
        await this.prisma.user.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        })
      )?.id ?? tenantId;
    const row = await this.prisma.schoolSysBackup.create({
      data: {
        tenantId,
        kind: 'DATABASE',
        status: 'PENDING',
        createdBy: systemUser,
      },
    });
    await this.opsQueue.add('backup', { tenantId, backupId: row.id });
  }

  private async retain(s: {
    tenantId: string;
    backupRetentionDays: number;
    backupKeepCount: number;
    logRetentionDays: number;
    auditRetentionDays: number;
  }) {
    const bCut = new Date(Date.now() - s.backupRetentionDays * 86400000);
    const old = await this.prisma.schoolSysBackup.findMany({
      where: { tenantId: s.tenantId, createdAt: { lt: bCut } },
    });
    const keep = await this.prisma.schoolSysBackup.findMany({
      where: { tenantId: s.tenantId },
      orderBy: { createdAt: 'desc' },
      skip: s.backupKeepCount,
    });
    for (const row of [...old, ...keep]) {
      if (row.fileKey)
        await rm(this.storage.resolveLocalPath(row.fileKey), {
          force: true,
        }).catch(() => undefined);
      await this.prisma.schoolSysBackup
        .delete({ where: { id: row.id } })
        .catch(() => undefined);
    }
    await this.prisma.schoolSysLog.deleteMany({
      where: {
        tenantId: s.tenantId,
        createdAt: { lt: new Date(Date.now() - s.logRetentionDays * 86400000) },
      },
    });
    await this.prisma.schoolSysAudit.deleteMany({
      where: {
        tenantId: s.tenantId,
        createdAt: {
          lt: new Date(Date.now() - s.auditRetentionDays * 86400000),
        },
      },
    });
  }

  private async buildBackupPayload(tenantId: string, kind: string) {
    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'school' ORDER BY tablename`,
    )) as Array<{ tablename: string }>;
    const dump: Record<string, unknown> = {};
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
      throw new BadRequestException('Invalid tenant');
    }
    for (const t of tables) {
      if (!/^[a-z0-9_]+$/i.test(t.tablename)) continue;
      const countRows = (await this.prisma
        .$queryRawUnsafe(
          `SELECT COUNT(*)::int AS c FROM school.${t.tablename} WHERE tenant_id = '${tenantId}'::uuid`,
        )
        .catch(() => [{ c: 0 }])) as Array<{ c: number }>;
      dump[t.tablename] = { count: countRows[0]?.c ?? 0 };
    }
    let uploads: unknown = null;
    if (kind === 'FULL' || kind === 'UPLOADS') {
      uploads = await this.storageBreakdown();
    }
    await this.tryPgDump(tenantId);
    return {
      tenantId,
      kind,
      at: new Date().toISOString(),
      schoolTables: dump,
      uploads,
    };
  }

  private async tryPgDump(tenantId: string) {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) return;
    const key = `school-ops/${tenantId}/backups/pg.dump`;
    const abs = this.storage.resolveLocalPath(key);
    await mkdir(dirname(abs), { recursive: true });
    await new Promise<void>((resolveP) => {
      const child = spawn(
        'pg_dump',
        ['--schema=school', '--format=custom', `--file=${abs}`],
        {
          env: { ...process.env, PGDATABASE: undefined },
          stdio: 'ignore',
        },
      );
      child.on('error', () => resolveP());
      child.on('close', () => resolveP());
    });
  }

  private async databaseHealth() {
    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const size = (await this.prisma.$queryRawUnsafe(
        `SELECT pg_database_size(current_database())::bigint AS bytes, version() AS v`,
      )) as Array<{ bytes: bigint; v: string }>;
      const migrations = (await this.prisma
        .$queryRawUnsafe(
          `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
        )
        .catch(() => [])) as Array<{ migration_name: string }>;
      return {
        connection: 'Operational' as const,
        pingMs: Date.now() - t0,
        sizeBytes: Number(size[0]?.bytes ?? 0),
        sizePretty: this.bytes(Number(size[0]?.bytes ?? 0)),
        version: size[0]?.v?.split(',')[0] ?? 'PostgreSQL',
        lastMigration: migrations[0]?.migration_name ?? null,
        pool: 'in-use',
        slowQueries: 0,
      };
    } catch {
      return {
        connection: 'Offline' as const,
        pingMs: 0,
        sizeBytes: 0,
        sizePretty: '0 B',
        version: 'unknown',
        lastMigration: null,
        pool: 'down',
        slowQueries: 0,
      };
    }
  }

  private async serviceHealth(tenantId: string, redisOk: boolean) {
    const sms = await this.prisma.schoolSmsGateway.findFirst({
      where: { tenantId, isDefault: true },
    });
    const pay = await this.prisma.schoolPaymentGateway
      .findFirst({
        where: { tenantId, isActive: true },
      })
      .catch(() => null);
    const push = await this.prisma.schoolPushSettings
      .findFirst({
        where: { tenantId },
      })
      .catch(() => null);
    const email = this.config.get('SMTP_HOST') ? 'Operational' : 'Degraded';
    return {
      redis: redisOk ? 'Operational' : 'Offline',
      storage: 'Operational',
      email,
      sms:
        sms?.status === 'ACTIVE'
          ? 'Operational'
          : sms
            ? 'Degraded'
            : 'Degraded',
      whatsapp: redisOk ? 'Operational' : 'Degraded',
      payment: pay ? 'Operational' : 'Degraded',
      push: push ? 'Operational' : 'Degraded',
    };
  }

  private async queueHealth() {
    const names = ['sms', 'whatsapp', 'push', 'automation', 'ops'] as const;
    const out: Record<string, unknown> = {};
    for (const n of names) {
      try {
        out[n] = await this.queueByName(n).getJobCounts();
      } catch {
        out[n] = { error: 'unavailable' };
      }
    }
    return out;
  }

  private async storageBreakdown() {
    const root =
      this.config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
    const buckets = [
      ['studentDocs', 'students'],
      ['photos', 'photos'],
      ['receipts', 'exam-receipts'],
      ['attachments', 'official-documents'],
      ['backups', 'school-ops'],
      ['website', 'website'],
    ] as const;
    const used: Record<string, number> = {};
    let totalUsed = 0;
    for (const [k, folder] of buckets) {
      const n = await this.dirSize(join(root, folder));
      used[k] = n;
      totalUsed += n;
    }
    const disk = await this.diskUsage();
    return {
      totalPretty: disk.totalPretty,
      usedPretty: this.bytes(totalUsed),
      freePretty: disk.freePretty,
      usedPct: disk.usedPct,
      buckets: used,
      warningAt: 80,
      criticalAt: 90,
    };
  }

  private async diskUsage() {
    try {
      const { statfs } = await import('fs/promises');
      const s = await statfs(process.cwd());
      const total = Number(s.blocks) * Number(s.bsize);
      const free = Number(s.bavail) * Number(s.bsize);
      const used = total - free;
      return {
        usedPct: total ? Math.round((used / total) * 100) : 0,
        usedPretty: this.bytes(used),
        freePretty: this.bytes(free),
        totalPretty: this.bytes(total),
      };
    } catch {
      return { usedPct: 0, usedPretty: '—', freePretty: '—', totalPretty: '—' };
    }
  }

  private async dirSize(dir: string): Promise<number> {
    if (!existsSync(dir)) return 0;
    let total = 0;
    const walk = async (p: string) => {
      const entries = await readdir(p, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        const next = join(p, e.name);
        if (e.isDirectory()) await walk(next);
        else {
          const st = await stat(next).catch(() => null);
          if (st) total += st.size;
        }
      }
    };
    await walk(dir);
    return total;
  }

  private nextBackupAt(s: {
    backupSchedule: string;
    backupHour: number;
    backupMinute: number;
  }) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(s.backupHour, s.backupMinute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    if (s.backupSchedule === 'WEEKLY') {
      const add = (7 - next.getDay()) % 7;
      next.setDate(next.getDate() + add);
    }
    if (s.backupSchedule === 'MONTHLY') {
      next.setDate(1);
      if (next <= now) next.setMonth(next.getMonth() + 1, 1);
    }
    return next.toISOString();
  }

  private overall(flags: string[]) {
    if (flags.includes('crit') || flags.includes('Offline')) return 'Critical';
    if (flags.includes('warn') || flags.includes('Degraded')) return 'Warning';
    return 'Healthy';
  }

  private licenseTone(status?: string | null, days?: number | null) {
    const s = (status ?? '').toUpperCase();
    if (s === 'SUSPENDED') return 'SUSPENDED';
    if (s === 'EXPIRED' || s === 'MISSING')
      return s === 'MISSING' ? 'EXPIRED' : 'EXPIRED';
    if (days != null && days <= 14) return 'EXPIRING SOON';
    if (s === 'ACTIVE') return 'ACTIVE';
    return s || 'ACTIVE';
  }

  private bytes(n: number) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
  }

  private queueByName(name: string) {
    const map: Record<string, Queue> = {
      sms: this.smsQueue,
      whatsapp: this.waQueue,
      push: this.pushQueue,
      automation: this.autoQueue,
      ops: this.opsQueue,
    };
    const q = map[name];
    if (!q) throw new BadRequestException('Unknown queue');
    return q;
  }

  private async mustBackup(tenantId: string, id: string) {
    const row = await this.prisma.schoolSysBackup.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Backup not found');
    return row;
  }

  private safeFile(key: string) {
    const abs = resolve(this.storage.resolveLocalPath(key));
    const root = resolve(this.storage.resolveLocalPath('school-ops'));
    if (!abs.startsWith(root))
      throw new ForbiddenException('Invalid backup path');
    return abs;
  }

  private async log(
    tenantId: string,
    level: string,
    module: string,
    message: string,
    userId?: string,
    meta?: { ip?: string; requestId?: string },
  ) {
    await this.prisma.schoolSysLog.create({
      data: {
        tenantId,
        level,
        module,
        message: redactText(message),
        userId,
        ip: meta?.ip,
        requestId: meta?.requestId,
        metaJson: redactDeep(meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async audit(
    tenantId: string,
    actor: JwtUser,
    action: string,
    module: string,
    meta: { ip?: string; ua?: string; requestId?: string },
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.schoolSysAudit.create({
      data: {
        tenantId,
        actorId: actor.sub,
        actorEmail: actor.email,
        action,
        module,
        ip: meta.ip,
        userAgent: meta.ua,
        requestId: meta.requestId,
        beforeJson: redactDeep(before) as Prisma.InputJsonValue,
        afterJson: redactDeep(after) as Prisma.InputJsonValue,
      },
    });
  }
}
