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

  async previewAudience(tenantId: string, audience: PushAudienceDto) {
    await this.ensureSetup(tenantId);
    const users = await this.resolveUsers(tenantId, audience);
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        userId: { in: users.map((u) => u.userId) },
        revokedAt: null,
        pushToken: { not: null },
      },
    });
    return {
      recipients: users.length,
      devices: devices.length,
      sample: users.slice(0, 12),
    };
  }

  private async resolveUsers(tenantId: string, audience: PushAudienceDto) {
    const year = await this.sis.currentYear(tenantId);
    const kind = audience.kind;
    if (kind === 'CUSTOM' && audience.userIds?.length) {
      return audience.userIds.map((userId) => ({
        userId,
        studentId: null as string | null,
      }));
    }
    if (kind === 'INDIVIDUAL_STUDENT' || kind === 'PARENT') {
      const studentIds = audience.studentIds ?? [];
      const accounts = await this.prisma.schoolPersonAccount.findMany({
        where: {
          tenantId,
          studentId: { in: studentIds },
          ...(kind === 'PARENT'
            ? { personType: 'GUARDIAN' }
            : { personType: 'STUDENT' }),
        },
      });
      if (kind === 'PARENT' && !accounts.length) {
        const g = await this.prisma.schoolPersonAccount.findMany({
          where: { tenantId, studentId: { in: studentIds } },
        });
        return g.map((a) => ({ userId: a.userId, studentId: a.studentId }));
      }
      return accounts.map((a) => ({
        userId: a.userId,
        studentId: a.studentId,
      }));
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
      const map: Record<string, string> = {
        ALL_STUDENTS: 'student',
        ALL_PARENTS: 'parent',
        ALL_TEACHERS: 'teacher',
        TEACHER: 'teacher',
        ALL_STAFF: 'admin',
        STAFF: 'admin',
      };
      const rows = await this.prisma.schoolMobileDevice.findMany({
        where: { tenantId, revokedAt: null, persona: map[kind] },
        select: { userId: true },
        distinct: ['userId'],
      });
      return rows.map((r) => ({
        userId: r.userId,
        studentId: null as string | null,
      }));
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
    const users = await this.resolveUsers(tenantId, dto.audience);
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        userId: { in: users.map((u) => u.userId) },
        revokedAt: null,
        pushToken: { not: null },
      },
    });
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
        deepLinkType: dto.deepLinkType ?? 'NONE',
        deepLinkValue: dto.deepLinkValue,
        audienceType: dto.audience.kind,
        audienceJson: dto.audience as unknown as Prisma.InputJsonValue,
        status: send
          ? scheduledAt && scheduledAt > new Date()
            ? 'SCHEDULED'
            : 'PROCESSING'
          : 'DRAFT',
        scheduledAt,
        recipientCount: users.length,
        deviceCount: devices.length,
        createdBy: actor.userId,
      },
    });
    const userMap = new Map(users.map((u) => [u.userId, u]));
    if (devices.length) {
      await this.prisma.schoolPushRecipient.createMany({
        data: devices.map((d) => ({
          id: randomUUID(),
          tenantId,
          campaignId: campaign.id,
          userId: d.userId,
          studentId: userMap.get(d.userId)?.studentId ?? null,
          deviceId: d.id,
          platform: d.platform,
          idempotencyKey: `${campaign.id}:${d.id}`,
        })),
      });
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
      await this.enqueue(tenantId, campaign.id, settings?.retryAttempts ?? 3);
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

  async listCampaigns(tenantId: string, status?: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolPushCampaign.findMany({
      where: { tenantId, archivedAt: null, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 80,
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
    await this.prisma.schoolPushRecipient.updateMany({
      where: {
        campaignId: id,
        tenantId,
        status: 'FAILED',
        failureCode: {
          notIn: ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'],
        },
      },
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
    const result = await this.fcm.send({
      tokens,
      title: campaign.title,
      body: campaign.body,
      category: campaign.category,
      priority: campaign.priority,
      imageUrl: campaign.imageUrl ?? undefined,
      data: {
        notificationId: campaign.id,
        type: campaign.category,
        deepLink,
        entityId: campaign.deepLinkValue ?? '',
      },
    });
    const byToken = new Map(result.perToken.map((p) => [p.token, p]));
    for (const rec of recipients) {
      const device = rec.deviceId ? tokenByDevice.get(rec.deviceId) : undefined;
      const token = device?.pushToken ?? '';
      const row = byToken.get(token);
      if (row?.ok) {
        await this.prisma.schoolPushRecipient.update({
          where: { id: rec.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            deliveredAt: new Date(),
            providerRef: row.ref,
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
            failureReason: row?.reason ?? 'Unable to send notification',
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
        data: { pushToken: null },
      });
    }
    const remaining = await this.prisma.schoolPushRecipient.count({
      where: { campaignId, status: 'QUEUED' },
    });
    if (remaining) {
      await this.queue.add(
        'campaign',
        { tenantId, campaignId },
        { jobId: `push__${campaignId}__${remaining}`, delay: 400, attempts: 3 },
      );
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
    return this.prisma.schoolMobileDevice.findMany({
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
    });
  }

  async registerDevice(
    user: { tid: string; sub: string },
    dto: RegisterPushDeviceDto,
  ) {
    const platform = dto.platform.toLowerCase() === 'ios' ? 'ios' : 'android';
    const deviceId = dto.deviceId || `push:${dto.token.slice(-24)}`;
    const now = new Date();
    return this.prisma.schoolMobileDevice.upsert({
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
        revokedAt: null,
      },
    });
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
    const ok = /image\/(jpeg|png|webp)/i.test(file.mimetype);
    if (!ok) throw new BadRequestException('Upload a JPG, PNG or WebP image');
    const ext = file.mimetype.includes('png')
      ? 'png'
      : file.mimetype.includes('webp')
        ? 'webp'
        : 'jpg';
    const key = `school/${tenantId}/push/${randomUUID()}.${ext}`;
    const stored = await this.storage.put(key, file.buffer, {
      contentType: file.mimetype,
    });
    if (!stored.url) {
      throw new BadRequestException(
        'Image stored, but a public HTTPS URL is required for mobile delivery. Configure object storage.',
      );
    }
    return { url: stored.url, key };
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
