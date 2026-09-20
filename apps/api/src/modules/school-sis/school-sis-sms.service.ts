import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolReportEngineService } from './report-engine/report-engine.service';
import {
  DEFAULT_SMS_TEMPLATES,
  mapProviderStatus,
  SMS_CATEGORIES,
  SMS_PROVIDERS,
} from './school-sis-sms.catalog';
import {
  displayInMobile,
  hashOtp,
  maskMobile,
  missingVariables,
  normalizeInMobile,
  renderSms,
  smsSegments,
} from './school-sis-sms.phone';
import { sendApitxtOtp } from './school-sis-apitxt-otp';
import { resolveSmsProvider } from './school-sis-sms.providers';
import {
  collectGatewayConfigIssues,
  enrollmentSearchWhere,
  formatClassLabel,
  providerSendsTransactionalSms,
  sanitizeSmsError,
} from './school-sis-sms.search';

type Audience = {
  type?: string;
  recipient?: string;
  sectionIds?: string[];
  studentIds?: string[];
  staffIds?: string[];
  mobiles?: string[];
  search?: string;
};

type Resolved = {
  mobile: string;
  name: string;
  type: string;
  studentId?: string;
  staffId?: string;
  vars: Record<string, string>;
};

function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class SchoolSisSmsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolSisSmsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly crypto: FieldEncryptionService,
    private readonly reports: SchoolReportEngineService,
    private readonly config: ConfigService,
    @InjectQueue('school-sms') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        'tick',
        {},
        { repeat: { every: 60_000 }, jobId: 'school-sms-tick' },
      );
    } catch {
      this.logger.debug('SMS scheduler already registered');
    }
  }

  async ensure(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolSmsSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, entityName: "St. Luke's Secondary School" },
    });
    const count = await this.prisma.schoolSmsTemplate.count({
      where: { tenantId },
    });
    if (!count) {
      await this.prisma.schoolSmsTemplate.createMany({
        data: DEFAULT_SMS_TEMPLATES.map((t) => ({
          tenantId,
          key: t.key,
          name: t.name,
          category: t.category,
          smsKind: t.smsKind,
          body: t.body,
          variablesJson: t.variables,
        })),
      });
    }
    return this.prisma.schoolSmsSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async dashboard(tenantId: string) {
    const settings = await this.ensure(tenantId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const month = new Date(start);
    month.setDate(1);
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - 6);
    const [
      today,
      delivered,
      failed,
      pending,
      monthCount,
      recent,
      gateways,
      cost,
      weekRows,
    ] = await Promise.all([
      this.prisma.schoolSmsMessage.count({
        where: { tenantId, createdAt: { gte: start } },
      }),
      this.prisma.schoolSmsMessage.count({
        where: { tenantId, createdAt: { gte: start }, status: 'DELIVERED' },
      }),
      this.prisma.schoolSmsMessage.count({
        where: {
          tenantId,
          createdAt: { gte: start },
          status: { in: ['FAILED', 'REJECTED', 'UNDELIVERED'] },
        },
      }),
      this.prisma.schoolSmsMessage.count({
        where: { tenantId, status: { in: ['QUEUED', 'SUBMITTED', 'SENT'] } },
      }),
      this.prisma.schoolSmsMessage.count({
        where: { tenantId, createdAt: { gte: month } },
      }),
      this.prisma.schoolSmsMessage.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { gateway: true, campaign: true },
      }),
      this.prisma.schoolSmsGateway.findMany({
        where: { tenantId },
        orderBy: { failoverRank: 'asc' },
      }),
      this.prisma.schoolSmsMessage.aggregate({
        where: { tenantId, createdAt: { gte: start } },
        _sum: { totalCost: true },
      }),
      this.prisma.schoolSmsMessage.findMany({
        where: {
          tenantId,
          createdAt: { gte: weekStart },
        },
        select: { createdAt: true, status: true },
      }),
    ]);
    const cats = await this.prisma.schoolSmsMessage.groupBy({
      by: ['recipientType'],
      where: { tenantId, createdAt: { gte: month } },
      _count: true,
    });
    const activity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const key = localDayKey(day);
      const rows = weekRows.filter((m) => localDayKey(m.createdAt) === key);
      return {
        date: key,
        label: day.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        }),
        sent: rows.length,
        delivered: rows.filter((m) => m.status === 'DELIVERED').length,
        failed: rows.filter((m) =>
          ['FAILED', 'REJECTED', 'UNDELIVERED'].includes(m.status),
        ).length,
      };
    });
    return {
      kpis: {
        balance: settings.manualBalance,
        sentToday: today,
        delivered,
        failed,
        pending,
        monthCount,
        deliveryRate: today
          ? Number(((delivered / today) * 100).toFixed(1))
          : 0,
        failedRate: today ? Number(((failed / today) * 100).toFixed(1)) : 0,
        estimatedCost: Number(cost._sum.totalCost ?? 0),
      },
      categories: SMS_CATEGORIES,
      providers: SMS_PROVIDERS,
      byType: cats,
      activity,
      recent: recent.map((m) => ({
        ...m,
        mobile: maskMobile(m.mobile),
        gateway: m.gateway?.name,
      })),
      gateways: gateways.map((g) => this.publicGateway(g)),
    };
  }

  async preview(
    tenantId: string,
    body: { template?: string; variables?: Record<string, string> },
  ) {
    await this.ensure(tenantId);
    const text = renderSms(body.template || '', {
      school_name: "St. Luke's Secondary School",
      ...(body.variables ?? {}),
    });
    return {
      preview: text,
      ...smsSegments(text),
      missing: missingVariables(body.template || '', body.variables ?? {}),
    };
  }

  async searchStudents(tenantId: string, q: string, recipient = 'PARENT') {
    await this.ensure(tenantId);
    const term = q.trim();
    if (term.length < 2) return { items: [] };
    const year = await this.sis.currentYear(tenantId);
    const searchWhere = enrollmentSearchWhere(term);
    if (!searchWhere) return { items: [] };
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        ...searchWhere,
      },
      include: {
        student: { include: { guardians: { include: { guardian: true } } } },
        section: { include: { grade: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
      take: 20,
    });
    const wantParent = recipient.toUpperCase() !== 'STUDENT';
    return {
      items: enrollments.map((en) => {
        const st = en.student;
        const parent =
          st.guardians.find((g) => g.guardian.isPrimary)?.guardian ??
          st.guardians[0]?.guardian;
        const parentMobile = normalizeInMobile(parent?.phone);
        const studentMobile = normalizeInMobile(st.phone);
        const recipientMobile = wantParent
          ? parentMobile || studentMobile
          : studentMobile;
        return {
          studentId: st.id,
          fullName: st.fullName,
          admissionNumber: st.admissionNumber,
          rollNumber: en.rollNumber,
          classLabel: formatClassLabel(en.section.grade.name, en.section.name),
          parentName: parent?.fullName ?? null,
          studentMobile,
          parentMobile,
          studentMobileDisplay: displayInMobile(studentMobile),
          parentMobileDisplay: displayInMobile(parentMobile),
          recipientMobile,
          recipientMobileDisplay: displayInMobile(recipientMobile),
          recipientType: wantParent ? 'PARENT' : 'STUDENT',
        };
      }),
    };
  }

  async configStatus(
    tenantId: string,
    gatewayId?: string,
    opts?: { transactional?: boolean },
  ) {
    const settings = await this.ensure(tenantId);
    const gw = gatewayId
      ? await this.prisma.schoolSmsGateway.findFirst({
          where: { id: gatewayId, tenantId },
        })
      : ((await this.prisma.schoolSmsGateway.findFirst({
          where: { tenantId, isDefault: true, status: 'ACTIVE' },
        })) ??
        (await this.prisma.schoolSmsGateway.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          orderBy: { updatedAt: 'desc' },
        })));
    const issues: string[] = [];
    const creds = this.creds(gw?.credentialsEnc);
    if (!gw) {
      issues.push('No active SMS gateway is configured.');
    } else {
      issues.push(
        ...collectGatewayConfigIssues({
          provider: gw.provider,
          status: gw.status,
          apiUrl: gw.apiUrl,
          senderId: gw.senderId,
          defaultSenderId: settings.defaultSenderId,
          creds,
        }),
      );
    }
    const [header, approvedTemplates, templates] = await Promise.all([
      this.prisma.schoolSmsHeader.findFirst({
        where: { tenantId, status: 'APPROVED' },
      }),
      this.prisma.schoolSmsDltTemplate.count({
        where: { tenantId, status: 'APPROVED' },
      }),
      this.prisma.schoolSmsTemplate.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
    ]);
    if (settings.enforceDltOnService && !header) {
      issues.push('DLT header is required but none is approved.');
    }
    if (opts?.transactional === false) {
      const idx = issues.findIndex((i) => i.includes('Apitxt is configured'));
      if (idx >= 0) issues.splice(idx, 1);
    }
    const origin =
      this.config.get<string>('API_PUBLIC_ORIGIN')?.replace(/\/$/, '') ||
      'https://erp.stlukestura.in/api';
    const providerKey = (gw?.provider || 'msg91').toLowerCase();
    const callbackPath = `/v1/school-sis/public/sms/webhooks/${providerKey}`;
    const lastError = gw?.lastError ? sanitizeSmsError(gw.lastError) : null;
    return {
      ready: issues.length === 0,
      canSend: issues.length === 0,
      issues,
      gateway: gw
        ? {
            id: gw.id,
            name: gw.name,
            provider: gw.provider,
            status: gw.status,
            isDefault: gw.isDefault,
            health: gw.health,
            environment: gw.environment,
            senderId: gw.senderId || settings.defaultSenderId,
            hasApiUrl: Boolean(gw.apiUrl),
            apiHost: gw.apiUrl
              ? (() => {
                  try {
                    return new URL(gw.apiUrl).host;
                  } catch {
                    return null;
                  }
                })()
              : gw.provider === 'MSG91'
                ? 'control.msg91.com'
                : gw.provider === 'TWILIO'
                  ? 'api.twilio.com'
                  : null,
            hasCredentials: Boolean(
              creds.apiKey ||
              creds.authkey ||
              creds.authToken ||
              creds.token ||
              creds.accountSid,
            ),
            hasSenderId: Boolean(gw.senderId || settings.defaultSenderId),
            hasDltEntityId: Boolean(gw.dltEntityId || settings.entityId),
            dltHeader: gw.dltHeader,
            route:
              creds.route ||
              creds.smsType ||
              (gw.provider === 'MSG91' ? 'transactional' : null),
            transactionalSms: providerSendsTransactionalSms(gw.provider),
            lastSuccessAt: gw.lastSuccessAt,
            lastError,
            credentialFields: {
              hasApiKey: Boolean(creds.apiKey || creds.authkey),
              hasApiSecret: Boolean(creds.apiSecret),
              hasAccountSid: Boolean(creds.accountSid),
              hasAuthToken: Boolean(creds.authToken),
              hasToken: Boolean(creds.token),
            },
          }
        : null,
      dlt: {
        enforceDlt: settings.enforceDlt,
        enforceDltOnService: settings.enforceDltOnService,
        entityIdSet: Boolean(settings.entityId),
        entityName: settings.entityName,
        approvedHeader: header?.header ?? null,
        approvedTemplateCount: approvedTemplates,
      },
      templates: { activeCount: templates },
      credits: { manualBalance: settings.manualBalance },
      deliveryCallback: {
        path: callbackPath,
        url: `${origin}${callbackPath}`,
        configured: true,
      },
    };
  }

  async resolve(tenantId: string, audience: Audience, category = 'GENERAL') {
    await this.ensure(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const recipient = (audience.recipient || 'PARENT').toUpperCase();
    const type = (audience.type || '').toUpperCase();
    const rows: Resolved[] = [];
    const seen = new Set<string>();
    const missing: Array<{ name: string; reason: string }> = [];
    const searchWhere = audience.search
      ? enrollmentSearchWhere(audience.search)
      : null;
    if (type === 'INDIVIDUAL' && !audience.studentIds?.length && !searchWhere) {
      return {
        selected: 0,
        valid: 0,
        missing: 0,
        duplicatesSkipped: 0,
        missingRows: [] as Array<{ name: string; reason: string }>,
        sample: [] as Array<{ name: string; mobile: string }>,
        recipients: [] as Resolved[],
        hint: 'Search and select a student before sending an individual SMS.',
      };
    }
    if (audience.type === 'STAFF' || audience.staffIds?.length) {
      const staff = await this.prisma.schoolStaff.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(audience.staffIds?.length
            ? { id: { in: audience.staffIds } }
            : {}),
        },
        take: 4000,
      });
      for (const s of staff) {
        const mobile = normalizeInMobile(s.phone);
        if (!mobile) {
          missing.push({ name: s.fullName, reason: 'Missing mobile' });
          continue;
        }
        if (seen.has(mobile)) continue;
        seen.add(mobile);
        rows.push({
          mobile,
          name: s.fullName,
          type: 'STAFF',
          staffId: s.id,
          vars: {
            student_name: s.fullName,
            parent_name: s.fullName,
            school_name: "St. Luke's Secondary School",
          },
        });
      }
    } else if (audience.mobiles?.length) {
      for (const raw of audience.mobiles) {
        const mobile = normalizeInMobile(raw);
        if (!mobile) {
          missing.push({ name: raw, reason: 'Invalid mobile' });
          continue;
        }
        if (seen.has(mobile)) continue;
        seen.add(mobile);
        rows.push({
          mobile,
          name: raw,
          type: 'CUSTOM',
          vars: { school_name: "St. Luke's Secondary School" },
        });
      }
    } else {
      const targeted =
        Boolean(audience.sectionIds?.length) ||
        Boolean(audience.studentIds?.length) ||
        Boolean(searchWhere);
      if (
        (type === 'CLASS' || type === 'SECTION' || type === '') &&
        !targeted
      ) {
        return {
          selected: 0,
          valid: 0,
          missing: 0,
          duplicatesSkipped: 0,
          missingRows: [],
          sample: [],
          recipients: [],
          hint: 'Search for a student or choose a class/section. Whole-school SMS is not allowed from this composer.',
        };
      }
      const enrollments = await this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          status: 'ACTIVE',
          ...(audience.sectionIds?.length
            ? { sectionId: { in: audience.sectionIds } }
            : {}),
          ...(audience.studentIds?.length
            ? { studentId: { in: audience.studentIds } }
            : {}),
          ...(searchWhere && !audience.studentIds?.length ? searchWhere : {}),
        },
        include: {
          student: { include: { guardians: { include: { guardian: true } } } },
          section: { include: { grade: true } },
        },
        take: audience.studentIds?.length
          ? Math.min(audience.studentIds.length, 200)
          : searchWhere
            ? 30
            : 5000,
      });
      for (const en of enrollments) {
        const st = en.student;
        const parent =
          st.guardians.find((g) => g.guardian.isPrimary)?.guardian ??
          st.guardians[0]?.guardian;
        const wantParent = recipient !== 'STUDENT';
        const mobile = normalizeInMobile(
          wantParent ? parent?.phone || st.phone : st.phone,
        );
        if (!mobile) {
          missing.push({ name: st.fullName, reason: 'Missing mobile' });
          continue;
        }
        const allowed = await this.consentOk(tenantId, st.id, category);
        if (!allowed) {
          missing.push({ name: st.fullName, reason: 'Opted out' });
          continue;
        }
        if (seen.has(mobile)) continue;
        seen.add(mobile);
        rows.push({
          mobile,
          name: wantParent ? parent?.fullName || st.fullName : st.fullName,
          type: wantParent ? 'PARENT' : 'STUDENT',
          studentId: st.id,
          vars: {
            student_name: st.fullName,
            parent_name: parent?.fullName || 'Parent',
            class_name: `${en.section.grade.name} ${en.section.name}`,
            class: en.section.grade.code,
            section: en.section.name,
            admission_no: st.admissionNumber,
            school_name: "St. Luke's Secondary School",
          },
        });
      }
    }
    return {
      selected: rows.length + missing.length,
      valid: rows.length,
      missing: missing.length,
      duplicatesSkipped: 0,
      missingRows: missing.slice(0, 50),
      sample: rows
        .slice(0, 5)
        .map((r) => ({ name: r.name, mobile: maskMobile(r.mobile) })),
      recipients: rows,
    };
  }

  async sendCampaign(
    tenantId: string,
    dto: {
      name?: string;
      category?: string;
      smsKind?: string;
      audience: Audience;
      templateKey?: string;
      body?: string;
      variables?: Record<string, string>;
      gatewayId?: string;
      scheduleAt?: string;
      sendNow?: boolean;
      idempotencyKey?: string;
    },
    actorUserId: string,
    ip?: string,
  ) {
    const settings = await this.ensure(tenantId);
    const audienceType = (dto.audience.type || '').toUpperCase();
    if (audienceType === 'INDIVIDUAL' && !dto.audience.studentIds?.length) {
      throw new BadRequestException(
        'Select a student before sending an individual SMS.',
      );
    }
    const template = dto.templateKey
      ? await this.prisma.schoolSmsTemplate.findFirst({
          where: { tenantId, key: dto.templateKey, status: 'ACTIVE' },
        })
      : null;
    const body = dto.body || template?.body;
    if (!body) throw new BadRequestException('Message body required');
    const kind = (dto.smsKind || template?.smsKind || 'SERVICE').toUpperCase();
    const category = (
      dto.category ||
      template?.category ||
      'GENERAL'
    ).toUpperCase();
    const cfg = await this.configStatus(tenantId, dto.gatewayId, {
      transactional: kind !== 'OTP' && category !== 'OTP',
    });
    if (!cfg.canSend) {
      throw new BadRequestException(
        cfg.issues.join(' ') || 'SMS configuration is incomplete.',
      );
    }
    await this.assertDlt(tenantId, settings, kind, template?.dltTemplateId);
    const resolved = await this.resolve(
      tenantId,
      dto.audience,
      dto.category || template?.category,
    );
    if (!resolved.valid) throw new BadRequestException('No valid recipients');
    if (resolved.valid > settings.maxCampaignSize) {
      throw new BadRequestException(
        `Campaign exceeds maximum of ${settings.maxCampaignSize}`,
      );
    }
    const sample = resolved.recipients[0];
    const missingVars = sample
      ? missingVariables(body, { ...sample.vars, ...(dto.variables ?? {}) })
      : [];
    if (missingVars.length) {
      throw new BadRequestException(
        `Message is missing values for: ${missingVars
          .map((k) => `{${k}}`)
          .join(', ')}`,
      );
    }
    const gw = await this.pickGateway(tenantId, dto.gatewayId);
    const campaign = await this.prisma.schoolSmsCampaign.create({
      data: {
        tenantId,
        name: dto.name || template?.name || 'SMS campaign',
        category: dto.category || template?.category || 'GENERAL',
        smsKind: kind,
        audienceJson: dto.audience as object,
        templateId: template?.id,
        gatewayId: gw.id,
        body,
        status:
          dto.scheduleAt && !dto.sendNow
            ? 'SCHEDULED'
            : dto.sendNow === false
              ? 'DRAFT'
              : 'PROCESSING',
        scheduledAt: dto.scheduleAt ? new Date(dto.scheduleAt) : null,
        recipientCount: resolved.valid,
        createdBy: actorUserId,
      },
    });
    const unit = Number(settings.unitCost);
    for (const r of resolved.recipients) {
      const text = renderSms(body, { ...r.vars, ...(dto.variables ?? {}) });
      const miss = missingVariables(body, {
        ...r.vars,
        ...(dto.variables ?? {}),
      });
      if (miss.length) continue;
      const segs = smsSegments(text);
      const key = dto.idempotencyKey
        ? `${dto.idempotencyKey}:${r.mobile}`
        : `camp:${campaign.id}:${r.mobile}`;
      try {
        const msg = await this.prisma.schoolSmsMessage.create({
          data: {
            tenantId,
            campaignId: campaign.id,
            studentId: r.studentId,
            staffId: r.staffId,
            recipientName: r.name,
            recipientType: r.type,
            mobile: r.mobile,
            body: text,
            templateId: template?.id,
            gatewayId: gw.id,
            senderId: gw.senderId || settings.defaultSenderId,
            segments: segs.segments,
            unitCost: unit,
            totalCost: unit * segs.segments,
            idempotencyKey: key,
            createdBy: actorUserId,
            status: campaign.status === 'PROCESSING' ? 'QUEUED' : 'QUEUED',
          },
        });
        await this.prisma.schoolSmsMessageEvent.create({
          data: { tenantId, messageId: msg.id, status: 'QUEUED' },
        });
        if (campaign.status === 'PROCESSING') {
          await this.queue.add(
            'send',
            { tenantId, messageId: msg.id },
            {
              jobId: msg.id,
              attempts: settings.retryAttempts,
              backoff: { type: 'exponential', delay: 5000 },
            },
          );
        }
      } catch (err) {
        if (
          !(
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          )
        )
          throw err;
      }
    }
    await this.audit(tenantId, actorUserId, 'CAMPAIGN_CREATE', ip, {
      campaignId: campaign.id,
      recipients: resolved.valid,
    });
    return {
      campaign,
      estimate: { recipients: resolved.valid, missing: resolved.missing },
    };
  }

  async sendTemplate(
    tenantId: string,
    input: {
      templateKey: string;
      studentId?: string;
      staffId?: string;
      mobile?: string;
      variables?: Record<string, string>;
      idempotencyKey: string;
    },
  ) {
    const existing = await this.prisma.schoolSmsMessage.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const audience: Audience = input.studentId
      ? { type: 'STUDENT', studentIds: [input.studentId], recipient: 'PARENT' }
      : input.staffId
        ? { type: 'STAFF', staffIds: [input.staffId] }
        : { mobiles: input.mobile ? [input.mobile] : [] };
    return this.sendCampaign(
      tenantId,
      {
        templateKey: input.templateKey,
        audience,
        variables: input.variables,
        sendNow: true,
        idempotencyKey: input.idempotencyKey,
      },
      '00000000-0000-0000-0000-000000000000',
    );
  }

  async processSendJob(tenantId: string, messageId: string) {
    const settings = await this.ensure(tenantId);
    const msg = await this.prisma.schoolSmsMessage.findFirst({
      where: { id: messageId, tenantId },
    });
    if (!msg) return;
    if (['DELIVERED', 'SUBMITTED', 'SENT'].includes(msg.status)) return;
    const primary = await this.pickGateway(
      tenantId,
      msg.gatewayId ?? undefined,
    );
    let result;
    try {
      result = await this.dispatch(primary, msg);
    } catch (err) {
      result = {
        accepted: false,
        status: 'FAILED' as const,
        errorMessage: sanitizeSmsError(err),
        errorClass: 'TEMPORARY' as const,
      };
    }
    if (
      !result.accepted &&
      settings.failoverEnabled &&
      result.errorClass === 'TEMPORARY'
    ) {
      const secondary = await this.prisma.schoolSmsGateway.findFirst({
        where: { tenantId, status: 'ACTIVE', id: { not: primary.id } },
        orderBy: { failoverRank: 'asc' },
      });
      if (secondary) {
        let fb;
        try {
          fb = await this.dispatch(secondary, msg);
        } catch (err) {
          fb = {
            accepted: false,
            status: 'FAILED' as const,
            errorMessage: sanitizeSmsError(err),
            errorClass: 'TEMPORARY' as const,
          };
        }
        await this.applyProviderResult(
          msg.id,
          tenantId,
          secondary.id,
          fb,
          true,
        );
        return;
      }
    }
    await this.applyProviderResult(msg.id, tenantId, primary.id, result, false);
  }

  async handleWebhook(
    provider: string,
    raw: string,
    headers: Record<string, string | undefined>,
  ) {
    const payload = safeJson(raw);
    const eventId =
      String(
        (payload as { requestId?: string; sid?: string; messageId?: string })
          .requestId ||
          (payload as { sid?: string }).sid ||
          (payload as { messageId?: string }).messageId ||
          createHash('sha256').update(raw).digest('hex'),
      ) || null;
    try {
      await this.prisma.schoolSmsWebhookEvent.create({
        data: {
          provider: provider.toUpperCase(),
          providerEventId: eventId,
          payloadJson: payload as object,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }
    const providerMessageId = String(
      (payload as { requestId?: string }).requestId ||
        (payload as { sid?: string }).sid ||
        (payload as { messageId?: string }).messageId ||
        '',
    );
    const mapped = mapProviderStatus(
      String(
        (payload as { status?: string }).status ||
          (payload as { deliveryStatus?: string }).deliveryStatus ||
          '',
      ),
    );
    if (!providerMessageId) return { ok: true };
    const msg = await this.prisma.schoolSmsMessage.findFirst({
      where: { providerMessageId },
    });
    if (!msg) return { ok: true, unmatched: true };
    await this.prisma.schoolSmsMessage.update({
      where: { id: msg.id },
      data: {
        status: mapped === 'UNKNOWN' ? msg.status : mapped,
        deliveredAt: mapped === 'DELIVERED' ? new Date() : msg.deliveredAt,
        failedAt: ['FAILED', 'REJECTED', 'UNDELIVERED', 'EXPIRED'].includes(
          mapped,
        )
          ? new Date()
          : msg.failedAt,
        errorMessage: (payload as { error?: string }).error,
      },
    });
    await this.prisma.schoolSmsMessageEvent.create({
      data: {
        tenantId: msg.tenantId,
        messageId: msg.id,
        status: mapped,
        note: headers['x-forwarded-for'],
      },
    });
    return { ok: true };
  }

  async messages(tenantId: string, q: { status?: string; search?: string }) {
    await this.ensure(tenantId);
    const rows = await this.prisma.schoolSmsMessage.findMany({
      where: {
        tenantId,
        status: q.status || undefined,
        OR: q.search
          ? [
              { recipientName: { contains: q.search, mode: 'insensitive' } },
              { mobile: { contains: q.search } },
              { body: { contains: q.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        gateway: true,
        campaign: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    return rows.map((m) => ({ ...m, mobile: maskMobile(m.mobile) }));
  }

  async retry(tenantId: string, id: string) {
    const msg = await this.prisma.schoolSmsMessage.findFirst({
      where: { id, tenantId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.errorClass === 'PERMANENT')
      throw new BadRequestException('Permanent failure — will not retry');
    await this.prisma.schoolSmsMessage.update({
      where: { id },
      data: { status: 'QUEUED', errorMessage: null },
    });
    await this.queue.add(
      'send',
      { tenantId, messageId: id },
      { jobId: `${id}:${msg.attempts + 1}` },
    );
    return { ok: true };
  }

  async templates(tenantId: string) {
    await this.ensure(tenantId);
    return this.prisma.schoolSmsTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async saveTemplate(
    tenantId: string,
    body: Record<string, unknown>,
    id?: string,
  ) {
    await this.ensure(tenantId);
    const data = {
      name: String(body.name || ''),
      key: String(body.key || body.name || '')
        .toUpperCase()
        .replace(/\s+/g, '_'),
      category: String(body.category || 'GENERAL'),
      smsKind: String(body.smsKind || 'SERVICE'),
      dltTemplateId: body.dltTemplateId ? String(body.dltTemplateId) : null,
      body: String(body.body || ''),
      variablesJson: body.variables ?? [],
      status: String(body.status || 'ACTIVE'),
    };
    if (id)
      return this.prisma.schoolSmsTemplate.update({ where: { id }, data });
    return this.prisma.schoolSmsTemplate.create({
      data: { tenantId, ...data },
    });
  }

  async gateways(tenantId: string) {
    await this.ensure(tenantId);
    const rows = await this.prisma.schoolSmsGateway.findMany({
      where: { tenantId },
    });
    return rows.map((g) => this.publicGateway(g));
  }

  async saveGateway(
    tenantId: string,
    body: Record<string, unknown>,
    id?: string,
  ) {
    await this.ensure(tenantId);
    const creds = {
      apiKey: String(body.apiKey || ''),
      apiSecret: String(body.apiSecret || ''),
      authkey: String(body.authkey || ''),
      accountSid: String(body.accountSid || ''),
      authToken: String(body.authToken || ''),
      token: String(body.token || ''),
      from: String(body.from || ''),
      otpTemplateId: String(body.otpTemplateId || ''),
      otpTemplateName: String(body.otpTemplateName || ''),
      otpChannel: String(body.otpChannel || ''),
      otpCountry: String(body.otpCountry || ''),
      projectRefId: String(body.projectRefId || ''),
    };
    const credentialsEnc = this.crypto.encrypt(JSON.stringify(creds));
    const data = {
      name: String(body.name || body.provider || 'Gateway'),
      provider: String(body.provider || 'MSG91').toUpperCase(),
      apiUrl: body.apiUrl ? String(body.apiUrl) : null,
      senderId: body.senderId ? String(body.senderId) : null,
      dltEntityId: body.dltEntityId ? String(body.dltEntityId) : null,
      dltHeader: body.dltHeader ? String(body.dltHeader) : null,
      environment: String(body.environment || 'LIVE'),
      status: String(body.status || 'INACTIVE'),
      failoverRank: Number(body.failoverRank || 0),
      credentialsEnc,
    };
    if (id) {
      return this.publicGateway(
        await this.prisma.schoolSmsGateway.update({ where: { id }, data }),
      );
    }
    return this.publicGateway(
      await this.prisma.schoolSmsGateway.create({
        data: { tenantId, ...data },
      }),
    );
  }

  async setDefaultGateway(tenantId: string, id: string) {
    const gw = await this.prisma.schoolSmsGateway.findFirst({
      where: { id, tenantId },
    });
    if (!gw) throw new NotFoundException('Gateway not found');
    if (gw.status !== 'ACTIVE')
      throw new BadRequestException('Default gateway cannot be inactive');
    await this.prisma.$transaction([
      this.prisma.schoolSmsGateway.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      }),
      this.prisma.schoolSmsGateway.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return { ok: true };
  }

  async testGateway(tenantId: string, id: string, testMobile?: string) {
    const settings = await this.ensure(tenantId);
    const gw = await this.prisma.schoolSmsGateway.findFirst({
      where: { id, tenantId },
    });
    if (!gw) throw new NotFoundException('Gateway not found');
    const creds = this.creds(gw.credentialsEnc);
    const issues = collectGatewayConfigIssues({
      provider: gw.provider,
      status: gw.status === 'ACTIVE' ? 'ACTIVE' : gw.status,
      apiUrl: gw.apiUrl,
      senderId: gw.senderId,
      defaultSenderId: settings.defaultSenderId,
      creds,
    });
    const provider = resolveSmsProvider(gw.provider);
    const fieldsOk = await provider.validateConfiguration(creds, gw.apiUrl);
    if (!fieldsOk && !issues.some((i) => /key|token|sid|url/i.test(i))) {
      issues.push('Gateway credentials are incomplete.');
    }
    let balance: Awaited<ReturnType<typeof provider.getBalance>> = {};
    try {
      balance = await provider.getBalance(creds, gw.apiUrl);
    } catch (err) {
      balance = { error: sanitizeSmsError(err), reachable: false };
    }
    const connected =
      Boolean(balance.reachable) ||
      typeof balance.credits === 'number' ||
      typeof balance.amount === 'number';
    if (balance.error && !connected) {
      issues.push(sanitizeSmsError(balance.error));
    }
    const ok =
      issues.filter((i) => !i.includes('Apitxt is configured')).length === 0 &&
      (connected || gw.provider.toUpperCase() === 'APITXT');
    await this.prisma.schoolSmsGateway.update({
      where: { id },
      data: {
        health:
          connected || gw.provider.toUpperCase() === 'APITXT' ? 'OK' : 'ERROR',
        lastError: ok ? null : issues[0] || 'Configuration invalid',
      },
    });
    if (issues.length && gw.provider.toUpperCase() !== 'APITXT' && !connected) {
      throw new BadRequestException(issues.join(' '));
    }
    let testSend: { queued?: boolean; campaignId?: string } | null = null;
    if (testMobile && providerSendsTransactionalSms(gw.provider)) {
      if (issues.length) {
        throw new BadRequestException(issues.join(' '));
      }
      const sent = await this.sendCampaign(
        tenantId,
        {
          name: 'Gateway connection test',
          category: 'GENERAL',
          smsKind: 'SERVICE',
          body: "St. Luke's School SMS gateway test. Please ignore.",
          audience: { type: 'CUSTOM', mobiles: [testMobile] },
          gatewayId: gw.id,
          sendNow: true,
        },
        '00000000-0000-0000-0000-000000000000',
      );
      testSend = {
        queued: true,
        campaignId: String(
          (sent as { campaign?: { id?: string } }).campaign?.id ?? '',
        ),
      };
    }
    return {
      ok:
        issues.length === 0 ||
        (gw.provider.toUpperCase() === 'APITXT' && fieldsOk),
      connected,
      issues,
      provider: gw.provider,
      senderId: gw.senderId || settings.defaultSenderId,
      credits: balance.credits ?? settings.manualBalance,
      providerBalance:
        typeof balance.credits === 'number'
          ? { credits: balance.credits }
          : typeof balance.amount === 'number'
            ? { amount: balance.amount, currency: balance.currency }
            : null,
      transactionalSms: providerSendsTransactionalSms(gw.provider),
      testSend,
    };
  }

  async dlt(tenantId: string) {
    const settings = await this.ensure(tenantId);
    const [headers, templates] = await Promise.all([
      this.prisma.schoolSmsHeader.findMany({ where: { tenantId } }),
      this.prisma.schoolSmsDltTemplate.findMany({ where: { tenantId } }),
    ]);
    return {
      entity: { id: settings.entityId, name: settings.entityName },
      headers,
      templates,
    };
  }

  async saveHeader(tenantId: string, body: Record<string, unknown>) {
    await this.ensure(tenantId);
    return this.prisma.schoolSmsHeader.create({
      data: {
        tenantId,
        header: String(body.header || ''),
        description: body.description ? String(body.description) : null,
        provider: body.provider ? String(body.provider) : null,
        status: String(body.status || 'DRAFT'),
      },
    });
  }

  async saveDltTemplate(tenantId: string, body: Record<string, unknown>) {
    await this.ensure(tenantId);
    return this.prisma.schoolSmsDltTemplate.create({
      data: {
        tenantId,
        name: String(body.name || ''),
        dltTemplateId: String(body.dltTemplateId || ''),
        category: String(body.category || 'SERVICE'),
        templateText: String(body.templateText || body.body || ''),
        variablesJson: body.variables ?? [],
        status: String(body.status || 'DRAFT'),
      },
    });
  }

  async saveSettings(tenantId: string, body: Record<string, unknown>) {
    await this.ensure(tenantId);
    return this.prisma.schoolSmsSettings.update({
      where: { tenantId },
      data: {
        defaultSenderId: body.defaultSenderId
          ? String(body.defaultSenderId)
          : null,
        enforceDlt: body.enforceDlt !== false,
        enforceDltOnService: !!body.enforceDltOnService,
        failoverEnabled: !!body.failoverEnabled,
        maxPerMinute: Number(body.maxPerMinute ?? 60),
        maxCampaignSize: Number(body.maxCampaignSize ?? 5000),
        retryAttempts: Number(body.retryAttempts ?? 3),
        otpExpiryMinutes: Number(body.otpExpiryMinutes ?? 5),
        otpMaxAttempts: Number(body.otpMaxAttempts ?? 5),
        unitCost: Number(body.unitCost ?? 1),
        manualBalance: Number(body.manualBalance ?? 0),
        entityId: body.entityId ? String(body.entityId) : null,
        entityName: body.entityName ? String(body.entityName) : null,
      },
    });
  }

  async credits(
    tenantId: string,
    amount: number,
    note: string,
    actorUserId: string,
  ) {
    await this.ensure(tenantId);
    await this.prisma.schoolSmsCreditTxn.create({
      data: {
        tenantId,
        kind: amount >= 0 ? 'CREDIT' : 'DEBIT',
        amount,
        note,
        createdBy: actorUserId,
      },
    });
    return this.prisma.schoolSmsSettings.update({
      where: { tenantId },
      data: { manualBalance: { increment: amount } },
    });
  }

  async sendLoginOtp(tenantId: string, mobileRaw: string, otp: string) {
    await this.ensure(tenantId);
    const mobile = normalizeInMobile(mobileRaw);
    if (!mobile) {
      return {
        accepted: false,
        status: 'FAILED' as const,
        errorMessage: 'Invalid mobile',
      };
    }
    const cfg = await this.apitxtOtpConfig(tenantId);
    if (!cfg.authkey) {
      this.logger.warn('Login OTP skipped: Apitxt authkey is not configured');
      return {
        accepted: false,
        status: 'FAILED' as const,
        errorCode: 'NO_KEY',
        errorMessage:
          'Configure the Apitxt SMS gateway (or SCHOOL_APITXT_AUTHKEY) to send login OTPs.',
      };
    }
    const result = await sendApitxtOtp({
      authkey: cfg.authkey,
      mobile,
      otp,
      channel: cfg.channel,
      templateId: cfg.templateId,
      templateName: cfg.templateName,
      country: cfg.country,
      projectRefId: cfg.projectRefId,
      apiUrl: cfg.apiUrl,
    });
    if (!result.accepted) {
      this.logger.warn(
        `Apitxt login OTP failed (${result.errorCode ?? 'error'})`,
      );
    }
    return result;
  }

  private async apitxtOtpConfig(tenantId: string) {
    const envKey = this.config.get<string>('SCHOOL_APITXT_AUTHKEY')?.trim();
    const gw = await this.prisma.schoolSmsGateway.findFirst({
      where: { tenantId, status: 'ACTIVE', provider: 'APITXT' },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    const creds = this.creds(gw?.credentialsEnc);
    return {
      authkey: creds.apiKey || creds.authkey || envKey || '',
      channel:
        creds.otpChannel ||
        creds.channel ||
        this.config.get<string>('SCHOOL_APITXT_CHANNEL') ||
        'sms',
      templateId:
        creds.otpTemplateId ||
        creds.templateId ||
        this.config.get<string>('SCHOOL_APITXT_OTP_TEMPLATE_ID') ||
        undefined,
      templateName:
        creds.otpTemplateName ||
        creds.templateName ||
        this.config.get<string>('SCHOOL_APITXT_TEMPLATE_NAME') ||
        undefined,
      country:
        creds.otpCountry ||
        creds.country ||
        this.config.get<string>('SCHOOL_APITXT_COUNTRY') ||
        '91',
      projectRefId:
        creds.projectRefId ||
        this.config.get<string>('SCHOOL_APITXT_PROJECT_REF_ID') ||
        undefined,
      apiUrl:
        gw?.apiUrl ||
        this.config.get<string>('SCHOOL_APITXT_OTP_URL') ||
        undefined,
    };
  }

  async issueOtp(tenantId: string, mobileRaw: string, purpose: string) {
    const settings = await this.ensure(tenantId);
    const mobile = normalizeInMobile(mobileRaw);
    if (!mobile) throw new BadRequestException('Invalid mobile');
    const recent = await this.prisma.schoolSmsOtp.count({
      where: {
        tenantId,
        mobile,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent >= 3) throw new BadRequestException('OTP rate limit');
    const code = String(randomInt(100000, 999999));
    await this.prisma.schoolSmsOtp.create({
      data: {
        tenantId,
        purpose,
        mobile,
        codeHash: hashOtp(tenantId, purpose, mobile, code),
        expiresAt: new Date(Date.now() + settings.otpExpiryMinutes * 60_000),
      },
    });
    const sent = await this.sendLoginOtp(tenantId, mobile, code);
    if (!sent.accepted) {
      throw new BadRequestException(
        sent.errorMessage || 'Could not send the login OTP.',
      );
    }
    return { sent: true, expiresInMinutes: settings.otpExpiryMinutes };
  }

  async verifyOtp(
    tenantId: string,
    mobileRaw: string,
    purpose: string,
    code: string,
  ) {
    const settings = await this.ensure(tenantId);
    const mobile = normalizeInMobile(mobileRaw);
    if (!mobile) throw new BadRequestException('Invalid mobile');
    const row = await this.prisma.schoolSmsOtp.findFirst({
      where: { tenantId, mobile, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('OTP not found');
    if (row.expiresAt < new Date())
      throw new BadRequestException('OTP expired');
    if (row.attempts >= settings.otpMaxAttempts)
      throw new BadRequestException('OTP attempts exceeded');
    const ok = row.codeHash === hashOtp(tenantId, purpose, mobile, code);
    await this.prisma.schoolSmsOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 }, consumedAt: ok ? new Date() : null },
    });
    if (!ok) throw new BadRequestException('Invalid OTP');
    return { ok: true };
  }

  async campaigns(tenantId: string) {
    await this.ensure(tenantId);
    return this.prisma.schoolSmsCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async cancelCampaign(tenantId: string, id: string) {
    return this.prisma.schoolSmsCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async dispatchScheduled() {
    const due = await this.prisma.schoolSmsCampaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      take: 20,
    });
    for (const c of due) {
      await this.prisma.schoolSmsCampaign.update({
        where: { id: c.id },
        data: { status: 'PROCESSING' },
      });
      const msgs = await this.prisma.schoolSmsMessage.findMany({
        where: { campaignId: c.id, status: 'QUEUED' },
      });
      for (const m of msgs) {
        await this.queue.add(
          'send',
          { tenantId: c.tenantId, messageId: m.id },
          { jobId: m.id },
        );
      }
    }
  }

  async exportReport(tenantId: string, format: 'pdf' | 'xlsx' | 'csv' = 'pdf') {
    const year = await this.sis.currentYear(tenantId);
    const rows = await this.prisma.schoolSmsMessage.findMany({
      where: { tenantId },
      take: 2000,
      orderBy: { createdAt: 'desc' },
    });
    return this.reports.generate({
      tenantId,
      format,
      document: {
        key: 'sms-usage',
        title: 'SMS Usage Report',
        academicYear: year.name,
        columns: [
          { key: 'createdAt', label: 'Date' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'status', label: 'Status' },
          { key: 'totalCost', label: 'Cost' },
        ],
        rows: rows.map((r) => ({
          createdAt: r.createdAt.toISOString().slice(0, 16),
          mobile: maskMobile(r.mobile),
          status: r.status,
          totalCost: Number(r.totalCost),
        })),
        official: true,
      },
    });
  }

  async auditLog(tenantId: string) {
    return this.prisma.schoolSmsAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async consentOk(
    tenantId: string,
    studentId: string,
    category: string,
  ) {
    const row = await this.prisma.schoolSmsConsent.findFirst({
      where: { tenantId, studentId },
    });
    if (!row) return true;
    if (!row.smsEnabled) return false;
    if (category.includes('FEE') && !row.feeSms) return false;
    if (category.includes('ATTEND') && !row.attendanceSms) return false;
    if (category.includes('EXAM') || category === 'RESULT')
      if (!row.examSms) return false;
    if (category.includes('TRANSPORT') && !row.transportSms) return false;
    if (category === 'MARKETING' && !row.promotionalSms) return false;
    return true;
  }

  private async assertDlt(
    tenantId: string,
    settings: { enforceDlt: boolean; enforceDltOnService: boolean },
    kind: string,
    dltTemplateId?: string | null,
  ) {
    const need =
      kind === 'PROMOTIONAL'
        ? settings.enforceDlt
        : settings.enforceDltOnService;
    if (!need) return;
    const header = await this.prisma.schoolSmsHeader.findFirst({
      where: { tenantId, status: 'APPROVED' },
    });
    if (!header) {
      throw new BadRequestException(
        'Commercial SMS requires an approved DLT header.',
      );
    }
    if (dltTemplateId) {
      const tpl = await this.prisma.schoolSmsDltTemplate.findFirst({
        where: { tenantId, dltTemplateId, status: 'APPROVED' },
      });
      if (!tpl)
        throw new BadRequestException(
          'Selected DLT content template is not approved.',
        );
    }
  }

  private async pickGateway(tenantId: string, id?: string) {
    const gw = id
      ? await this.prisma.schoolSmsGateway.findFirst({
          where: { id, tenantId },
        })
      : await this.prisma.schoolSmsGateway.findFirst({
          where: { tenantId, isDefault: true, status: 'ACTIVE' },
        });
    if (!gw || gw.status !== 'ACTIVE') {
      throw new BadRequestException(
        'SMS Gateway unavailable. Please configure another active default gateway.',
      );
    }
    return gw;
  }

  private creds(enc?: string | null): Record<string, string> {
    if (!enc) return {};
    try {
      return JSON.parse(this.crypto.decrypt(enc) || '{}') as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  }

  private publicGateway(g: {
    id: string;
    name: string;
    provider: string;
    apiUrl: string | null;
    senderId: string | null;
    status: string;
    isDefault: boolean;
    health: string;
    lastError: string | null;
    lastSuccessAt: Date | null;
    credentialsEnc: string | null;
  }) {
    const creds = this.creds(g.credentialsEnc);
    return {
      id: g.id,
      name: g.name,
      provider: g.provider,
      apiUrl: g.apiUrl,
      senderId: g.senderId,
      status: g.status,
      isDefault: g.isDefault,
      health: g.health,
      lastError: g.lastError ? sanitizeSmsError(g.lastError) : null,
      lastSuccessAt: g.lastSuccessAt,
      hasApiKey: Boolean(creds.apiKey || creds.authkey || creds.authToken),
    };
  }

  private async dispatch(
    gw: {
      id: string;
      provider: string;
      apiUrl: string | null;
      senderId: string | null;
      credentialsEnc: string | null;
      dltHeader: string | null;
      dltEntityId: string | null;
    },
    msg: {
      id: string;
      mobile: string;
      body: string;
      senderId: string | null;
      idempotencyKey: string | null;
    },
  ) {
    const provider = resolveSmsProvider(gw.provider);
    return provider.sendSms(
      {
        to: msg.mobile,
        body: msg.body,
        senderId: msg.senderId || gw.senderId,
        header: gw.dltHeader,
        entityId: gw.dltEntityId,
        idempotencyKey: msg.idempotencyKey || msg.id,
      },
      this.creds(gw.credentialsEnc),
      gw.apiUrl,
    );
  }

  private async applyProviderResult(
    messageId: string,
    tenantId: string,
    gatewayId: string,
    result: {
      accepted: boolean;
      status: string;
      providerMessageId?: string;
      errorCode?: string;
      errorMessage?: string;
      errorClass?: string;
    },
    failover: boolean,
  ) {
    const status = result.accepted ? result.status : 'FAILED';
    await this.prisma.schoolSmsMessage.update({
      where: { id: messageId },
      data: {
        gatewayId,
        status,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
          ? sanitizeSmsError(result.errorMessage)
          : result.errorMessage,
        errorClass: result.errorClass,
        submittedAt: result.accepted ? new Date() : undefined,
        sentAt: result.accepted ? new Date() : undefined,
        failedAt: result.accepted ? undefined : new Date(),
        failoverUsed: failover,
        attempts: { increment: 1 },
      },
    });
    await this.prisma.schoolSmsMessageEvent.create({
      data: {
        tenantId,
        messageId,
        status,
        note: failover ? 'failover' : undefined,
      },
    });
    await this.prisma.schoolSmsGateway.update({
      where: { id: gatewayId },
      data: result.accepted
        ? { lastSuccessAt: new Date(), health: 'OK', lastError: null }
        : { health: 'ERROR', lastError: sanitizeSmsError(result.errorMessage) },
    });
    if (result.accepted) {
      await this.prisma.schoolSmsSettings.update({
        where: { tenantId },
        data: { manualBalance: { decrement: 1 } },
      });
    }
  }

  private audit(
    tenantId: string,
    actorId: string,
    action: string,
    ip?: string,
    detail?: object,
  ) {
    return this.prisma.schoolSmsAudit.create({
      data: {
        tenantId,
        actorId,
        action,
        ip,
        detailJson: (detail ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}
