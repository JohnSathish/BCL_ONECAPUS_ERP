import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { SchoolSisService } from './school-sis.service';
import {
  DEFAULT_PUSH_RULES,
  DEFAULT_PUSH_TEMPLATES,
  PUSH_CATEGORIES,
  deepLinkHref,
} from './school-sis-push.catalog';
import { SchoolSisFcmProvider } from './school-sis-push.provider';
import { classifyPushFailure } from './school-sis-push-errors';
import type {
  PushAudienceDto,
  RegisterPushDeviceDto,
  SavePushCampaignDto,
  SavePushPreferenceDto,
  SavePushRuleDto,
  SavePushSettingsDto,
  SavePushTemplateDto,
} from './dto/school-push.dto';

export type PushActor = { userId: string; manage: boolean; send: boolean };

const CRITICAL = new Set(['EMERGENCY', 'SYSTEM']);

@Injectable()
export class SchoolSisPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly fcm: SchoolSisFcmProvider,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('school-push') private readonly queue: Queue,
  ) {}

  private assert(actor: PushActor, send = false) {
    if (send && !actor.send && !actor.manage)
      throw new ForbiddenException('Not allowed');
    if (!send && !actor.manage && !actor.send)
      throw new ForbiddenException('Not allowed');
  }

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolPushSettings.upsert({
      where: { tenantId },
      create: { id: randomUUID(), tenantId },
      update: {},
    });
    if (
      (await this.prisma.schoolPushTemplate.count({
        where: { tenantId, deletedAt: null },
      })) === 0
    ) {
      for (const t of DEFAULT_PUSH_TEMPLATES) {
        await this.prisma.schoolPushTemplate.create({
          data: { id: randomUUID(), tenantId, ...t },
        });
      }
    }
    if (
      (await this.prisma.schoolPushRule.count({ where: { tenantId } })) === 0
    ) {
      for (const r of DEFAULT_PUSH_RULES) {
        await this.prisma.schoolPushRule.create({
          data: {
            id: randomUUID(),
            tenantId,
            eventType: r.eventType,
            name: r.name,
            pushEnabled: r.pushEnabled,
          },
        });
      }
    }
  }

  private async audit(
    tenantId: string,
    actor: PushActor,
    action: string,
    extra?: object,
  ) {
    await this.prisma.schoolPushAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId: actor.userId,
        action,
        campaignId: (extra as { campaignId?: string } | undefined)?.campaignId,
        detailJson: (extra ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async dashboard(tenantId: string) {
    await this.ensureSetup(tenantId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [total, active, sent, delivered, opened, failed, scheduled] =
      await Promise.all([
        this.prisma.schoolMobileDevice.count({ where: { tenantId } }),
        this.prisma.schoolMobileDevice.count({
          where: { tenantId, revokedAt: null, pushToken: { not: null } },
        }),
        this.prisma.schoolPushRecipient.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
            status: { not: 'FAILED' },
          },
        }),
        this.prisma.schoolPushRecipient.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
            deliveredAt: { not: null },
          },
        }),
        this.prisma.schoolPushRecipient.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
            openedAt: { not: null },
          },
        }),
        this.prisma.schoolPushRecipient.count({
          where: { tenantId, createdAt: { gte: monthStart }, status: 'FAILED' },
        }),
        this.prisma.schoolPushCampaign.count({
          where: { tenantId, status: 'SCHEDULED', archivedAt: null },
        }),
      ]);
    return {
      totalDevices: total,
      activeDevices: active,
      sent,
      delivered,
      opened,
      failed,
      scheduled,
      deliveredPct: sent ? delivered / sent : 0,
      openedPct: sent ? opened / sent : 0,
      failedPct: sent ? failed / sent : 0,
      fcm: this.fcm.connectionStatus(),
    };
  }

  async sendTest(tenantId: string, actor: PushActor) {
    this.assert(actor, true);
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        userId: actor.userId,
        revokedAt: null,
        pushToken: { not: null },
      },
    });
    if (!devices.length) {
      throw new BadRequestException(
        'No registered app on this account. Open the St. Luke’s School app while signed in.',
      );
    }
    const result = await this.fcm.send({
      tokens: devices.map((d) => d.pushToken!).filter(Boolean),
      title: "St. Luke's School",
      body: 'Test notification from the school office.',
      category: 'GENERAL',
      priority: 'HIGH',
      imageUrl: this.schoolLogoPublicUrl(),
      data: { type: 'SYSTEM', deepLink: '/(tabs)', notificationId: 'test' },
    });
    if (result.invalidTokens.length) {
      await this.prisma.schoolMobileDevice.updateMany({
        where: { tenantId, pushToken: { in: result.invalidTokens } },
        data: { pushToken: null, pushEnabled: false },
      });
    }
    await this.audit(tenantId, actor, 'NOTIFICATION_TEST', {
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
    return {
      ok: result.ok,
      devices: devices.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      engine: this.fcm.connectionStatus().engine,
    };
  }

  async previewAudience(
    tenantId: string,
    audience: PushAudienceDto,
    actorUserId?: string,
  ) {
    await this.ensureSetup(tenantId);
    const users = await this.resolveUsers(tenantId, audience, actorUserId);
    const rows = await this.devicesForUsers(
      tenantId,
      users.map((u) => u.userId),
    );
    return {
      recipients: users.length,
      devices: rows.filter((d) => d.pushToken).length,
      sample: users.slice(0, 12),
    };
  }

  private async devicesForUsers(tenantId: string, userIds: string[]) {
    if (!userIds.length) return [];
    return this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        deviceStatus: { notIn: ['BLOCKED', 'REVOKED'] },
        revokedAt: null,
      },
    });
  }

  private async ensureInbox(
    tenantId: string,
    userId: string,
    campaign: {
      id: string;
      title: string;
      body: string;
      imageUrl: string | null;
      category: string;
      audienceType: string;
      deepLinkType: string | null;
      deepLinkValue: string | null;
    },
  ) {
    const existing = await this.prisma.schoolMobileInbox.findFirst({
      where: { tenantId, userId, relatedId: campaign.id },
    });
    if (existing) return;
    const deepLink =
      deepLinkHref(campaign.deepLinkType, campaign.deepLinkValue) ?? '';
    await this.prisma.schoolMobileInbox.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId,
        title: campaign.title,
        body: campaign.body,
        imageUrl: campaign.imageUrl,
        type: campaign.category.toLowerCase(),
        deepLink: deepLink || null,
        relatedId: campaign.id,
        audience: campaign.audienceType,
      },
    });
  }

  private async resolveUsers(
    tenantId: string,
    audience: PushAudienceDto,
    actorUserId?: string,
  ) {
    const year = await this.sis.currentYear(tenantId);
    const kind = audience.kind;
    if (kind === 'MY_DEVICES') {
      if (!actorUserId) {
        throw new BadRequestException('Sign in to send a test to your phone');
      }
      return [{ userId: actorUserId, studentId: null as string | null }];
    }
    if (kind === 'CUSTOM' && audience.userIds?.length) {
      return audience.userIds.map((userId) => ({
        userId,
        studentId: null as string | null,
      }));
    }
    if (kind === 'INDIVIDUAL_STUDENT' || kind === 'PARENT') {
      const studentIds = audience.studentIds ?? [];
      const personTypes =
        kind === 'PARENT'
          ? ['GUARDIAN', 'PARENT']
          : ['STUDENT', 'GUARDIAN', 'PARENT'];
      const accounts = await this.prisma.schoolPersonAccount.findMany({
        where: {
          tenantId,
          studentId: { in: studentIds },
          personType: { in: personTypes },
        },
      });
      if (kind === 'PARENT' && !accounts.length) {
        const g = await this.prisma.schoolPersonAccount.findMany({
          where: { tenantId, studentId: { in: studentIds } },
        });
        return g.map((a) => ({ userId: a.userId, studentId: a.studentId }));
      }
      return [
        ...new Map(
          accounts.map((a) => [
            a.userId,
            { userId: a.userId, studentId: a.studentId },
          ]),
        ).values(),
      ];
    }
    if (audience.personas?.length) {
      const rows = await this.prisma.schoolMobileDevice.findMany({
        where: {
          tenantId,
          revokedAt: null,
          persona: { in: audience.personas },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      return rows.map((r) => ({
        userId: r.userId,
        studentId: null as string | null,
      }));
    }
    if (kind.startsWith('ALL_') || kind === 'TEACHER' || kind === 'STAFF') {
      const personTypes: Record<string, string[]> = {
        ALL_STUDENTS: ['STUDENT'],
        ALL_PARENTS: ['GUARDIAN', 'PARENT'],
        ALL_TEACHERS: ['STAFF'],
        TEACHER: ['STAFF'],
        ALL_STAFF: ['STAFF'],
        STAFF: ['STAFF'],
      };
      const devicePersona: Record<string, string> = {
        ALL_STUDENTS: 'student',
        ALL_PARENTS: 'parent',
        ALL_TEACHERS: 'teacher',
        TEACHER: 'teacher',
        ALL_STAFF: 'admin',
        STAFF: 'admin',
      };
      const types = personTypes[kind] ?? [];
      const accounts = types.length
        ? await this.prisma.schoolPersonAccount.findMany({
            where: { tenantId, personType: { in: types } },
            select: { userId: true, studentId: true },
          })
        : [];
      const devices = await this.prisma.schoolMobileDevice.findMany({
        where: {
          tenantId,
          revokedAt: null,
          persona: devicePersona[kind],
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      const byUser = new Map(
        accounts.map((a) => [
          a.userId,
          { userId: a.userId, studentId: a.studentId },
        ]),
      );
      for (const d of devices) {
        if (!byUser.has(d.userId)) {
          byUser.set(d.userId, { userId: d.userId, studentId: null });
        }
      }
      return [...byUser.values()];
    }
    let sectionIds = audience.sectionIds ?? [];
    if (
      (kind === 'CLASS' || kind === 'MULTI_CLASS') &&
      audience.gradeIds?.length
    ) {
      const sections = await this.prisma.schoolSection.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          gradeId: { in: audience.gradeIds },
          deletedAt: null,
        },
        select: { id: true },
      });
      sectionIds = [...new Set([...sectionIds, ...sections.map((s) => s.id)])];
    }
    if (!sectionIds.length) return [];
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        sectionId: { in: sectionIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);
    const type = audience.includeParents === false ? 'STUDENT' : undefined;
    const accounts = await this.prisma.schoolPersonAccount.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        ...(type ? { personType: type } : {}),
      },
    });
    return [
      ...new Map(
        accounts.map((a) => [
          a.userId,
          { userId: a.userId, studentId: a.studentId },
        ]),
      ).values(),
    ];
  }

  async compose(
    tenantId: string,
    dto: SavePushCampaignDto,
    actor: PushActor,
    send: boolean,
  ) {
    this.assert(actor, true);
    if (dto.title.length > 100 || dto.body.length > 500) {
      throw new BadRequestException('Title or message is too long');
    }
    if (dto.priority === 'URGENT' && !dto.confirm) {
      throw new BadRequestException(
        'Urgent notifications require confirmation',
      );
    }
    const users = await this.resolveUsers(tenantId, dto.audience, actor.userId);
    const devices = await this.devicesForUsers(
      tenantId,
      users.map((u) => u.userId),
    );
    const withToken = devices.filter((d) => d.pushToken);
    if (send && !users.length) {
      throw new BadRequestException('No recipients for this audience.');
    }
    if (devices.length > 40 && send && !dto.confirm) {
      throw new BadRequestException('Large broadcasts require confirmation');
    }
    const settings = await this.prisma.schoolPushSettings.findUnique({
      where: { tenantId },
    });
    let scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (
      scheduledAt &&
      settings?.quietHoursEnabled &&
      dto.priority !== 'URGENT'
    ) {
      scheduledAt = this.shiftQuiet(
        scheduledAt,
        settings.quietFrom,
        settings.quietTo,
      );
    }
    const campaign = await this.prisma.schoolPushCampaign.create({
      data: {
        id: randomUUID(),
        tenantId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        category: dto.category ?? 'GENERAL',
        priority: dto.priority ?? 'NORMAL',
        imageUrl: dto.imageUrl,
        iconUrl: dto.iconUrl,
        deepLinkType:
          dto.deepLinkType && dto.deepLinkType !== 'NONE'
            ? dto.deepLinkType
            : this.attachmentKind(dto.imageUrl) === 'pdf'
              ? 'DOCUMENT'
              : 'NONE',
        deepLinkValue:
          dto.deepLinkValue ||
          (this.attachmentKind(dto.imageUrl) === 'pdf'
            ? dto.imageUrl
            : undefined),
        audienceType: dto.audience.kind,
        audienceJson: dto.audience as unknown as Prisma.InputJsonValue,
        status: send
          ? scheduledAt && scheduledAt > new Date()
            ? 'SCHEDULED'
            : 'PROCESSING'
          : 'DRAFT',
        scheduledAt,
        recipientCount: users.length,
        deviceCount: withToken.length,
        createdBy: actor.userId,
      },
    });
    const userMap = new Map(users.map((u) => [u.userId, u]));
    const tokenUserIds = new Set(withToken.map((d) => d.userId));
    const recipientRows = [
      ...withToken.map((d) => ({
        id: randomUUID(),
        tenantId,
        campaignId: campaign.id,
        userId: d.userId,
        studentId: userMap.get(d.userId)?.studentId ?? null,
        deviceId: d.id,
        platform: d.platform,
        idempotencyKey: `${campaign.id}:${d.id}`,
      })),
      ...users
        .filter((u) => !tokenUserIds.has(u.userId))
        .map((u) => ({
          id: randomUUID(),
          tenantId,
          campaignId: campaign.id,
          userId: u.userId,
          studentId: u.studentId ?? null,
          deviceId: null as string | null,
          platform: 'inbox',
          idempotencyKey: `${campaign.id}:inbox:${u.userId}`,
        })),
    ];
    if (recipientRows.length) {
      await this.prisma.schoolPushRecipient.createMany({
        data: recipientRows,
      });
    }
    if (send) {
      for (const u of users) {
        await this.ensureInbox(tenantId, u.userId, {
          id: campaign.id,
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.imageUrl,
          category: campaign.category,
          audienceType: campaign.audienceType,
          deepLinkType: campaign.deepLinkType ?? 'NONE',
          deepLinkValue: campaign.deepLinkValue,
        });
      }
    }
    await this.audit(
      tenantId,
      actor,
      send ? 'NOTIFICATION_QUEUED' : 'NOTIFICATION_DRAFT',
      {
        campaignId: campaign.id,
        devices: devices.length,
      },
    );
    if (send && campaign.status === 'PROCESSING') {
      try {
        await this.processCampaign(tenantId, campaign.id);
      } catch {
        await this.enqueue(tenantId, campaign.id, settings?.retryAttempts ?? 3);
      }
    } else if (send && campaign.status === 'SCHEDULED' && scheduledAt) {
      await this.queue.add(
        'campaign',
        { tenantId, campaignId: campaign.id },
        {
          jobId: `push__${campaign.id}`,
          delay: Math.max(0, scheduledAt.getTime() - Date.now()),
          attempts: settings?.retryAttempts ?? 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
    }
    return this.getCampaign(tenantId, campaign.id);
  }

  private shiftQuiet(when: Date, from: string, to: string) {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const mins = when.getHours() * 60 + when.getMinutes();
    const fromM = fh * 60 + fm;
    const toM = th * 60 + tm;
    const inQuiet =
      fromM > toM ? mins >= fromM || mins < toM : mins >= fromM && mins < toM;
    if (!inQuiet) return when;
    const next = new Date(when);
    next.setHours(th, tm, 0, 0);
    if (next <= when) next.setDate(next.getDate() + 1);
    return next;
  }

  private enqueue(tenantId: string, campaignId: string, attempts: number) {
    return this.queue.add(
      'campaign',
      { tenantId, campaignId },
      {
        jobId: `push__${campaignId}`,
        attempts,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }

  async getCampaign(tenantId: string, id: string) {
    const row = await this.prisma.schoolPushCampaign.findFirst({
      where: { id, tenantId },
      include: { recipients: { take: 40, orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return row;
  }

  async campaignReport(
    tenantId: string,
    id: string,
    query?: { q?: string; status?: string; platform?: string },
  ) {
    const campaign = await this.prisma.schoolPushCampaign.findFirst({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundException('Notification not found');
    const recipients = await this.prisma.schoolPushRecipient.findMany({
      where: { tenantId, campaignId: id },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });
    const deviceIds = [
      ...new Set(recipients.map((r) => r.deviceId).filter(Boolean)),
    ] as string[];
    const userIds = [...new Set(recipients.map((r) => r.userId))];
    const studentIds = [
      ...new Set(recipients.map((r) => r.studentId).filter(Boolean)),
    ] as string[];
    const [devices, users, students, sender, year, audits] = await Promise.all([
      deviceIds.length
        ? this.prisma.schoolMobileDevice.findMany({
            where: { id: { in: deviceIds } },
            select: {
              id: true,
              platform: true,
              appVersion: true,
              osVersion: true,
              deviceModel: true,
              deviceLabel: true,
              deviceName: true,
              manufacturer: true,
              pushEnabled: true,
            },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true, phone: true, email: true },
          })
        : Promise.resolve([]),
      studentIds.length
        ? this.prisma.schoolStudent.findMany({
            where: { id: { in: studentIds } },
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              phone: true,
            },
          })
        : Promise.resolve([]),
      campaign.createdBy
        ? this.prisma.user.findFirst({
            where: { id: campaign.createdBy },
            select: { displayName: true, email: true },
          })
        : Promise.resolve(null),
      this.sis.currentYear(tenantId).catch(() => null),
      this.prisma.schoolPushAuditLog.findMany({
        where: { tenantId, campaignId: id },
        orderBy: { createdAt: 'asc' },
        take: 40,
      }),
    ]);
    const deviceById = new Map(devices.map((d) => [d.id, d]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const classByStudent = new Map<string, string>();
    if (studentIds.length) {
      const enrollments = await this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          studentId: { in: studentIds },
          deletedAt: null,
          status: 'ACTIVE',
          ...(year ? { academicYearId: year.id } : {}),
        },
        include: {
          section: { include: { grade: { select: { name: true } } } },
        },
      });
      for (const row of enrollments) {
        classByStudent.set(
          row.studentId,
          `${row.section.grade?.name ?? ''} ${row.section.name}`.trim(),
        );
      }
    }

    const n = Math.max(1, recipients.length || campaign.recipientCount || 0);
    const sent = recipients.filter(
      (r) => r.sentAt || r.status !== 'QUEUED',
    ).length;
    const delivered = recipients.filter((r) => r.deliveredAt).length;
    const opened = recipients.filter((r) => r.openedAt).length;
    const failed = recipients.filter((r) => r.status === 'FAILED').length;
    const pending = recipients.filter((r) =>
      ['QUEUED', 'PENDING'].includes(r.status),
    ).length;
    const ratio = (count: number) => Number(((count / n) * 100).toFixed(2));

    const mapped = recipients.map((r) => {
      const device = r.deviceId ? deviceById.get(r.deviceId) : undefined;
      const student = r.studentId ? studentById.get(r.studentId) : undefined;
      const user = userById.get(r.userId);
      const fail =
        r.status === 'FAILED'
          ? classifyPushFailure(r.failureCode, r.failureReason)
          : null;
      const deviceName =
        device?.deviceLabel ||
        device?.deviceName ||
        device?.deviceModel ||
        (r.platform
          ? r.platform === 'ios'
            ? 'iPhone'
            : 'Android'
          : r.deviceId
            ? 'App device'
            : 'Inbox only');
      return {
        id: r.id,
        studentName: student?.fullName || user?.displayName || 'School user',
        admissionNo: student?.admissionNumber || '—',
        className: r.studentId ? (classByStudent.get(r.studentId) ?? '') : '',
        mobile: student?.phone || user?.phone || '',
        device: deviceName,
        platform: (device?.platform || r.platform || 'unknown').toLowerCase(),
        appVersion: device?.appVersion || '',
        osVersion: device?.osVersion || '',
        status: r.openedAt ? 'OPENED' : r.deliveredAt ? 'DELIVERED' : r.status,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        openedAt: r.openedAt,
        failedAt: r.failedAt,
        failureLabel: fail?.label ?? r.failureReason,
        retryable: fail?.retryable ?? false,
      };
    });

    const needle = (query?.q ?? '').trim().toLowerCase();
    const statusFilter = (query?.status ?? 'ALL').toUpperCase();
    const platformFilter = (query?.platform ?? 'ALL').toLowerCase();
    const filtered = mapped.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (platformFilter !== 'all' && row.platform !== platformFilter)
        return false;
      if (!needle) return true;
      return `${row.studentName} ${row.admissionNo} ${row.mobile} ${row.device} ${row.className}`
        .toLowerCase()
        .includes(needle);
    });

    const retryableFailed = mapped.filter(
      (r) => r.status === 'FAILED' && r.retryable,
    ).length;

    const countBy = (key: (r: (typeof mapped)[number]) => string) => {
      const out: Record<
        string,
        { sent: number; delivered: number; failed: number }
      > = {};
      for (const row of mapped) {
        const k = key(row) || 'unknown';
        if (!out[k]) out[k] = { sent: 0, delivered: 0, failed: 0 };
        out[k].sent += 1;
        if (row.deliveredAt) out[k].delivered += 1;
        if (row.status === 'FAILED') out[k].failed += 1;
      }
      return Object.entries(out)
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.sent - a.sent);
    };

    const android = mapped.filter((r) => r.platform === 'android').length;
    const ios = mapped.filter((r) => r.platform === 'ios').length;

    const deltas = mapped
      .filter(
        (r) =>
          r.sentAt &&
          r.deliveredAt &&
          new Date(r.deliveredAt).getTime() - new Date(r.sentAt).getTime() >=
            200,
      )
      .map(
        (r) =>
          new Date(r.deliveredAt!).getTime() - new Date(r.sentAt!).getTime(),
      );
    const processingMs =
      campaign.sentAt && campaign.createdAt
        ? Math.max(
            0,
            new Date(campaign.sentAt).getTime() -
              new Date(campaign.createdAt).getTime(),
          )
        : null;
    const performance =
      processingMs != null || deltas.length
        ? {
            processingMs,
            averageDeliveryMs: deltas.length
              ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
              : null,
            fastestDeliveryMs: deltas.length ? Math.min(...deltas) : null,
            slowestDeliveryMs: deltas.length ? Math.max(...deltas) : null,
          }
        : null;

    const openedTimes = mapped
      .map((r) => r.openedAt)
      .filter(Boolean)
      .sort(
        (a, b) => new Date(a!).getTime() - new Date(b!).getTime(),
      ) as Date[];

    const timeline: Array<{ at: string; label: string }> = [
      { at: campaign.createdAt.toISOString(), label: 'Notification created' },
    ];
    const firstSent = mapped
      .map((r) => r.sentAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0];
    if (firstSent)
      timeline.push({
        at: new Date(firstSent).toISOString(),
        label: 'Sending started',
      });
    if (recipients.length) {
      const last = mapped[mapped.length - 1];
      timeline.push({
        at: new Date(
          last.sentAt || last.failedAt || campaign.updatedAt,
        ).toISOString(),
        label: `${recipients.length} recipients processed`,
      });
    }
    if (sent)
      timeline.push({
        at: (campaign.sentAt || campaign.updatedAt).toISOString(),
        label: `${sent} notifications accepted`,
      });
    if (delivered)
      timeline.push({
        at: (campaign.sentAt || campaign.updatedAt).toISOString(),
        label: `${delivered} delivered`,
      });
    if (openedTimes[0])
      timeline.push({
        at: new Date(openedTimes[0]).toISOString(),
        label: `${opened} notification${opened === 1 ? '' : 's'} opened`,
      });
    for (const log of audits) {
      timeline.push({
        at: log.createdAt.toISOString(),
        label: log.action.replaceAll('_', ' ').toLowerCase(),
      });
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at));

    const aud = (campaign.audienceJson ?? {}) as {
      kind?: string;
      gradeIds?: string[];
      sectionIds?: string[];
      studentIds?: string[];
    };
    let classLabels: string[] = [];
    if (aud.sectionIds?.length) {
      const sections = await this.prisma.schoolSection.findMany({
        where: { id: { in: aud.sectionIds }, tenantId },
        include: { grade: { select: { name: true } } },
      });
      classLabels = sections.map((s) =>
        `${s.grade?.name ?? 'Class'} ${s.name}`.trim(),
      );
    } else if (aud.gradeIds?.length) {
      const grades = await this.prisma.schoolGrade.findMany({
        where: { id: { in: aud.gradeIds }, tenantId },
        select: { name: true },
      });
      classLabels = grades.map((g) => g.name);
    }

    const audienceLabel = (campaign.audienceType || aud.kind || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        body: campaign.body,
        category: campaign.category,
        priority: campaign.priority,
        imageUrl: campaign.imageUrl,
        deepLinkType: campaign.deepLinkType,
        deepLinkValue: campaign.deepLinkValue,
        audienceType: campaign.audienceType,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
        sentAt: campaign.sentAt,
        createdAt: campaign.createdAt,
        archivedAt: campaign.archivedAt,
        messageId: `NTF-${campaign.createdAt
          .toISOString()
          .slice(0, 10)
          .replaceAll(
            '-',
            '',
          )}-${campaign.id.replaceAll('-', '').slice(-5).toUpperCase()}`,
        recipientCount: campaign.recipientCount || recipients.length,
        deviceCount: campaign.deviceCount,
      },
      sender: {
        name: sender?.displayName || sender?.email || 'Office staff',
        role: 'Administrator / Office Staff',
      },
      summary: {
        recipients: campaign.recipientCount || recipients.length,
        sent,
        delivered,
        opened,
        failed,
        pending,
        sentPct: ratio(sent),
        deliveredPct: ratio(delivered),
        openedPct: ratio(opened),
        failedPct: ratio(failed),
        pendingPct: ratio(pending),
      },
      content: {
        title: campaign.title,
        message: campaign.body,
        category: campaign.category,
        priority: campaign.priority,
        audience: campaign.audienceType,
        attachmentUrl: campaign.imageUrl,
        attachmentKind: this.attachmentKind(campaign.imageUrl),
        action: campaign.deepLinkType || 'NONE',
        deepLink: deepLinkHref(campaign.deepLinkType, campaign.deepLinkValue),
      },
      audience: {
        label: audienceLabel,
        academicYear: year ? `${year.name ?? ''}`.trim() || null : null,
        targeted: campaign.recipientCount || recipients.length,
        eligible: campaign.recipientCount || recipients.length,
        excluded: 0,
        classes: classLabels,
      },
      statusBreakdown: [
        { status: 'SENT', count: sent, pct: ratio(sent) },
        { status: 'DELIVERED', count: delivered, pct: ratio(delivered) },
        { status: 'OPENED', count: opened, pct: ratio(opened) },
        { status: 'FAILED', count: failed, pct: ratio(failed) },
        { status: 'PENDING', count: pending, pct: ratio(pending) },
      ],
      recipients: filtered,
      recipientTotal: filtered.length,
      devices: {
        android,
        ios,
        unknown: mapped.length - android - ios,
        platforms: countBy((r) =>
          r.platform === 'ios'
            ? 'iOS'
            : r.platform === 'android'
              ? 'Android'
              : 'Other',
        ),
        osVersions: countBy((r) => r.osVersion || 'Unknown'),
        appVersions: countBy((r) => r.appVersion || 'Unknown'),
        deviceModels: countBy((r) => r.device || 'Unknown'),
        failedByPlatform: countBy((r) =>
          r.platform === 'ios'
            ? 'iOS'
            : r.platform === 'android'
              ? 'Android'
              : 'Other',
        ),
      },
      failures: mapped.filter((r) => r.status === 'FAILED'),
      retryableFailedCount: retryableFailed,
      timeline,
      performance,
      engagement: {
        delivered,
        opened,
        openRate: delivered
          ? Number(((opened / delivered) * 100).toFixed(2))
          : 0,
        firstOpened: openedTimes[0] ?? null,
        lastOpened: openedTimes[openedTimes.length - 1] ?? null,
      },
    };
  }

  async listCampaigns(
    tenantId: string,
    status?: string,
    includeArchived = false,
  ) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushCampaign.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async cancel(tenantId: string, id: string, actor: PushActor) {
    this.assert(actor, true);
    await this.prisma.schoolPushCampaign.updateMany({
      where: { id, tenantId, status: { in: ['DRAFT', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' },
    });
    return this.getCampaign(tenantId, id);
  }

  async archive(tenantId: string, id: string, actor: PushActor) {
    this.assert(actor, true);
    await this.prisma.schoolPushCampaign.updateMany({
      where: { id, tenantId },
      data: { archivedAt: new Date() },
    });
    await this.audit(tenantId, actor, 'NOTIFICATION_ARCHIVED', {
      campaignId: id,
    });
    return { ok: true };
  }

  async retryFailed(tenantId: string, id: string, actor: PushActor) {
    this.assert(actor, true);
    const failed = await this.prisma.schoolPushRecipient.findMany({
      where: { campaignId: id, tenantId, status: 'FAILED' },
    });
    const retryable = failed.filter(
      (row) =>
        classifyPushFailure(row.failureCode, row.failureReason).retryable,
    );
    if (!retryable.length) {
      throw new BadRequestException(
        'No failed recipients can be retried. Remaining failures have invalid or expired devices.',
      );
    }
    await this.prisma.schoolPushRecipient.updateMany({
      where: { id: { in: retryable.map((r) => r.id) } },
      data: { status: 'QUEUED', failureCode: null, failureReason: null },
    });
    await this.prisma.schoolPushCampaign.updateMany({
      where: { id, tenantId },
      data: { status: 'PROCESSING' },
    });
    await this.queue.add(
      'campaign',
      { tenantId, campaignId: id },
      {
        jobId: `push__${id}__retry__${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    return this.getCampaign(tenantId, id);
  }

  async processCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.schoolPushCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign || campaign.status === 'CANCELLED') return { skipped: true };
    const settings = await this.prisma.schoolPushSettings.findUnique({
      where: { tenantId },
    });
    const take = settings?.batchSize ?? 80;
    const recipients = await this.prisma.schoolPushRecipient.findMany({
      where: { campaignId, status: 'QUEUED' },
      take,
    });
    if (!recipients.length) {
      const failed = await this.prisma.schoolPushRecipient.count({
        where: { campaignId, status: 'FAILED' },
      });
      await this.prisma.schoolPushCampaign.update({
        where: { id: campaignId },
        data: {
          status: failed ? 'PARTIALLY_SENT' : 'SENT',
          sentAt: new Date(),
        },
      });
      return { done: true };
    }
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: { id: { in: recipients.map((r) => r.deviceId!).filter(Boolean) } },
    });
    const tokenByDevice = new Map(devices.map((d) => [d.id, d]));
    const deepLink =
      deepLinkHref(campaign.deepLinkType, campaign.deepLinkValue) ?? '';
    const tokens = devices.map((d) => d.pushToken!).filter(Boolean);
    const result = tokens.length
      ? await this.fcm.send({
          tokens,
          title: campaign.title,
          body: campaign.body,
          category: campaign.category,
          priority: campaign.priority,
          imageUrl:
            this.fcmImageUrl(campaign.imageUrl) ?? this.schoolLogoPublicUrl(),
          data: {
            notificationId: campaign.id,
            type: campaign.category,
            deepLink,
            entityId: campaign.deepLinkValue ?? '',
            attachmentUrl: campaign.imageUrl ?? '',
            attachmentType: this.attachmentKind(campaign.imageUrl),
            path:
              this.attachmentKind(campaign.imageUrl) === 'pdf'
                ? (campaign.imageUrl ?? '')
                : '',
          },
        })
      : {
          ok: true,
          provider: 'inbox',
          successCount: 0,
          failureCount: 0,
          invalidTokens: [] as string[],
          perToken: [] as Array<{
            token: string;
            ok: boolean;
            ref?: string;
            code?: string;
            reason?: string;
          }>,
        };
    const byToken = new Map(result.perToken.map((p) => [p.token, p]));
    for (const rec of recipients) {
      const device = rec.deviceId ? tokenByDevice.get(rec.deviceId) : undefined;
      const token = device?.pushToken ?? '';
      const row = token ? byToken.get(token) : undefined;
      const inboxOnly = !token;
      if (row?.ok || inboxOnly) {
        if (device) {
          await this.prisma.schoolMobileDevice.update({
            where: { id: device.id },
            data: { lastPushAt: new Date(), pushEnabled: true },
          });
        }
        await this.prisma.schoolPushRecipient.update({
          where: { id: rec.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            deliveredAt: new Date(),
            providerRef: row?.ref ?? (inboxOnly ? 'inbox' : undefined),
          },
        });
        await this.prisma.schoolPushCampaign.update({
          where: { id: campaignId },
          data: {
            sentCount: { increment: 1 },
            deliveredCount: { increment: 1 },
          },
        });
        const existingInbox = await this.prisma.schoolMobileInbox.findFirst({
          where: { tenantId, userId: rec.userId, relatedId: campaign.id },
        });
        if (!existingInbox) {
          await this.prisma.schoolMobileInbox.create({
            data: {
              id: randomUUID(),
              tenantId,
              userId: rec.userId,
              title: campaign.title,
              body: campaign.body,
              imageUrl: campaign.imageUrl,
              type: campaign.category.toLowerCase(),
              deepLink: deepLink || null,
              relatedId: campaign.id,
              audience: campaign.audienceType,
            },
          });
        }
      } else {
        await this.prisma.schoolPushRecipient.update({
          where: { id: rec.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureCode: row?.code ?? 'UNKNOWN',
            failureReason: classifyPushFailure(row?.code, row?.reason).label,
          },
        });
        await this.prisma.schoolPushCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }
    }
    if (result.invalidTokens.length) {
      await this.prisma.schoolMobileDevice.updateMany({
        where: { tenantId, pushToken: { in: result.invalidTokens } },
        data: { pushToken: null, pushEnabled: false },
      });
    }
    const remaining = await this.prisma.schoolPushRecipient.count({
      where: { campaignId, status: 'QUEUED' },
    });
    if (remaining) {
      try {
        await this.queue.add(
          'campaign',
          { tenantId, campaignId },
          {
            jobId: `push__${campaignId}__${remaining}`,
            delay: 400,
            attempts: 3,
          },
        );
      } catch {
        await this.processCampaign(tenantId, campaignId);
      }
    } else {
      const failed = await this.prisma.schoolPushRecipient.count({
        where: { campaignId, status: 'FAILED' },
      });
      await this.prisma.schoolPushCampaign.update({
        where: { id: campaignId },
        data: {
          status: failed ? 'PARTIALLY_SENT' : 'SENT',
          sentAt: new Date(),
        },
      });
    }
    return { remaining };
  }

  async markOpened(tenantId: string, campaignId: string, userId: string) {
    const recs = await this.prisma.schoolPushRecipient.findMany({
      where: { tenantId, campaignId, userId, openedAt: null },
    });
    if (!recs.length) return { ok: true };
    await this.prisma.schoolPushRecipient.updateMany({
      where: { id: { in: recs.map((r) => r.id) } },
      data: { openedAt: new Date(), status: 'OPENED' },
    });
    await this.prisma.schoolPushCampaign.update({
      where: { id: campaignId },
      data: { openedCount: { increment: recs.length } },
    });
    return { ok: true };
  }

  async listDevices(tenantId: string, q?: string) {
    await this.ensureSetup(tenantId);
    const rows = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { deviceLabel: { contains: q, mode: 'insensitive' } },
                { deviceModel: { contains: q, mode: 'insensitive' } },
                { platform: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { lastActiveAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        deviceId: true,
        platform: true,
        persona: true,
        appVersion: true,
        deviceLabel: true,
        deviceModel: true,
        osVersion: true,
        deviceStatus: true,
        pushEnabled: true,
        lastActiveAt: true,
        lastPushAt: true,
      },
    });
    return rows;
  }

  async registerDevice(
    user: { tid: string; sub: string },
    dto: RegisterPushDeviceDto,
  ) {
    const platform = dto.platform.toLowerCase() === 'ios' ? 'ios' : 'android';
    const deviceId = dto.deviceId || `push:${dto.token.slice(-24)}`;
    const existing = await this.prisma.schoolMobileDevice.findUnique({
      where: { tenantId_deviceId: { tenantId: user.tid, deviceId } },
    });
    if (existing?.deviceStatus === 'BLOCKED') {
      return { ok: false, deviceStatus: 'BLOCKED' };
    }
    const now = new Date();
    const row = await this.prisma.schoolMobileDevice.upsert({
      where: { tenantId_deviceId: { tenantId: user.tid, deviceId } },
      create: {
        tenantId: user.tid,
        userId: user.sub,
        deviceId,
        platform,
        persona: dto.persona || 'student',
        appVersion: dto.appVersion,
        pushToken: dto.token,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        pushEnabled: true,
        lastTokenRefreshAt: now,
        lastActiveAt: now,
      },
      update: {
        userId: user.sub,
        pushToken: dto.token,
        platform,
        appVersion: dto.appVersion ?? undefined,
        deviceModel: dto.deviceModel ?? undefined,
        osVersion: dto.osVersion ?? undefined,
        lastTokenRefreshAt: now,
        lastActiveAt: now,
        pushEnabled: true,
        revokedAt:
          existing?.deviceStatus === 'BLOCKED' ? existing.revokedAt : null,
      },
    });
    const { pushToken: _hidden, ...safe } = row;
    void _hidden;
    return safe;
  }

  async unregisterDevice(tenantId: string, id: string, userId?: string) {
    await this.prisma.schoolMobileDevice.updateMany({
      where: { id, tenantId, ...(userId ? { userId } : {}) },
      data: { revokedAt: new Date(), pushToken: null },
    });
    return { ok: true };
  }

  async listTemplates(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveTemplate(
    tenantId: string,
    dto: SavePushTemplateDto,
    actor: PushActor,
    id?: string,
  ) {
    this.assert(actor, true);
    if (id) {
      await this.prisma.schoolPushTemplate.updateMany({
        where: { id, tenantId },
        data: dto,
      });
    } else {
      await this.prisma.schoolPushTemplate.create({
        data: { id: randomUUID(), tenantId, ...dto },
      });
    }
    return this.listTemplates(tenantId);
  }

  async getSettings(tenantId: string) {
    await this.ensureSetup(tenantId);
    const settings = await this.prisma.schoolPushSettings.findUniqueOrThrow({
      where: { tenantId },
    });
    return {
      ...settings,
      fcm: this.fcm.connectionStatus(),
      categories: PUSH_CATEGORIES,
    };
  }

  async saveSettings(
    tenantId: string,
    dto: SavePushSettingsDto,
    actor: PushActor,
  ) {
    this.assert(actor);
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushSettings.update({
      where: { tenantId },
      data: dto,
    });
  }

  async listPreferences(tenantId: string, userId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushPreference.findMany({
      where: { tenantId, userId },
    });
  }

  async savePreference(
    tenantId: string,
    userId: string,
    dto: SavePushPreferenceDto,
  ) {
    if (CRITICAL.has(dto.category) && !dto.enabled) {
      throw new BadRequestException(
        'Emergency notifications cannot be disabled',
      );
    }
    return this.prisma.schoolPushPreference.upsert({
      where: {
        tenantId_userId_category: { tenantId, userId, category: dto.category },
      },
      create: {
        id: randomUUID(),
        tenantId,
        userId,
        category: dto.category,
        enabled: dto.enabled,
      },
      update: { enabled: dto.enabled },
    });
  }

  async listRules(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushRule.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async saveRule(tenantId: string, dto: SavePushRuleDto, actor: PushActor) {
    this.assert(actor);
    return this.prisma.schoolPushRule.upsert({
      where: { tenantId_eventType: { tenantId, eventType: dto.eventType } },
      create: {
        id: randomUUID(),
        tenantId,
        name: dto.name ?? dto.eventType,
        ...dto,
      },
      update: dto,
    });
  }

  async uploadImage(
    tenantId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const image = /image\/(jpeg|jpg|png|webp)/i.test(file.mimetype);
    const pdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (!image && !pdf) {
      throw new BadRequestException('Upload a JPG, PNG, WebP image or a PDF');
    }
    const ext = pdf
      ? 'pdf'
      : file.mimetype.includes('png')
        ? 'png'
        : file.mimetype.includes('webp')
          ? 'webp'
          : 'jpg';
    const fileName = `${randomUUID()}.${ext}`;
    const key = `school/${tenantId}/push/${fileName}`;
    await this.storage.put(key, file.buffer, { contentType: file.mimetype });
    const url = this.mediaPublicUrl(tenantId, fileName);
    return {
      url,
      key,
      kind: pdf ? 'pdf' : 'image',
      fileName: file.originalname,
    };
  }

  async readMedia(tenantId: string, fileName: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$/i.test(fileName)) {
      throw new BadRequestException('Invalid file');
    }
    const key = `school/${tenantId}/push/${fileName}`;
    const buf = await this.storage.get(key);
    if (!buf) throw new NotFoundException('File not found');
    const lower = fileName.toLowerCase();
    const contentType = lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
    return { buf, contentType, fileName };
  }

  private mediaPublicUrl(tenantId: string, fileName: string) {
    const origin = (
      this.config.get<string>('API_PUBLIC_ORIGIN') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
    return `${origin}/api/v1/school-sis/notifications/media-file/${tenantId}/${fileName}`;
  }

  private attachmentKind(url?: string | null) {
    if (!url) return '';
    return /\.pdf($|\?)/i.test(url) ? 'pdf' : 'image';
  }

  private fcmImageUrl(url?: string | null) {
    if (!url || this.attachmentKind(url) === 'pdf') return undefined;
    return /^https?:\/\//i.test(url) ? url : undefined;
  }

  private schoolLogoPublicUrl() {
    const origin = (
      this.config.get<string>('WEB_ORIGIN') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      this.config.get<string>('API_PUBLIC_ORIGIN') ||
      ''
    )
      .replace(/\/$/, '')
      .replace(/\/api$/i, '');
    if (!/^https?:\/\//i.test(origin)) return undefined;
    return `${origin}/school-sis/st-lukes-logo.png`;
  }

  async logs(tenantId: string) {
    return this.prisma.schoolPushAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async deliveryReport(tenantId: string, campaignId?: string) {
    return this.prisma.schoolPushRecipient.findMany({
      where: { tenantId, ...(campaignId ? { campaignId } : {}) },
      include: { campaign: { select: { title: true, category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async onErpEvent(
    tenantId: string,
    eventType: string,
    payload: {
      userIds?: string[];
      studentId?: string;
      title?: string;
      body?: string;
    },
  ) {
    const rule = await this.prisma.schoolPushRule.findUnique({
      where: { tenantId_eventType: { tenantId, eventType } },
    });
    if (!rule?.pushEnabled || !rule.active) return { skipped: true };
    if (!payload.userIds?.length) return { skipped: true };
    return this.compose(
      tenantId,
      {
        title: payload.title || rule.name,
        body: payload.body || 'Open the school app for details.',
        category: 'SYSTEM',
        audience: { kind: 'CUSTOM', userIds: payload.userIds },
        confirm: true,
      },
      {
        userId: '00000000-0000-0000-0000-000000000000',
        manage: true,
        send: true,
      },
      true,
    );
  }
}
