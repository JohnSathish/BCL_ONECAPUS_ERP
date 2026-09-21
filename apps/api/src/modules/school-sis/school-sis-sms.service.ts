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
  extractVariables,
  hashOtp,
  maskMobile,
  missingVariables,
  normalizeInMobile,
  pickSmsVariables,
  renderSms,
  smsSegments,
} from './school-sis-sms.phone';
import { APITXT_SEND_OTP_URL, sendApitxtOtp } from './school-sis-apitxt-otp';
import { APITXT_SEND_MSG_URL } from './school-sis-apitxt-sms';
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
    const settings = await this.prisma.schoolSmsSettings.findUniqueOrThrow({
      where: { tenantId },
    });
    await this.ensureApitxtGateway(tenantId, settings);
    return this.prisma.schoolSmsSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async settingsView(tenantId: string) {
    const settings = await this.ensure(tenantId);
    const extras = asJson(settings.extrasJson);
    const gw = await this.prisma.schoolSmsGateway.findFirst({
      where: { tenantId, provider: 'APITXT' },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    const creds = this.creds(gw?.credentialsEnc);
    return {
      ...settings,
      apitxtRoute:
        String(extras.apitxtRoute || creds.route || '4') === '1' ? '1' : '4',
      apitxtTemplateId: String(
        extras.apitxtTemplateId || creds.templateId || '',
      ),
      apitxtFlash: String(extras.apitxtFlash || creds.flash || '0'),
      apitxtUnicode: String(extras.apitxtUnicode || creds.unicode || 'auto'),
      otpTemplateId: creds.otpTemplateId || '',
      otpChannel: creds.otpChannel || 'sms',
      gatewayId: gw?.id ?? null,
      gatewayStatus: gw?.status ?? 'INACTIVE',
      hasAuthkey: Boolean(creds.apiKey || creds.authkey),
    };
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
          dltEntityId: gw.dltEntityId,
          entityId: settings.entityId,
          defaultTemplateId:
            String(asJson(settings.extrasJson).apitxtTemplateId || '') ||
            creds.templateId ||
            null,
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
                  : gw.provider === 'APITXT'
                    ? 'apitxt.com'
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
              (gw.provider === 'APITXT'
                ? '4'
                : gw.provider === 'MSG91'
                  ? 'transactional'
                  : null),
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
        audienceJson: {
          ...dto.audience,
          flowVariables: dto.variables ?? {},
        } as object,
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
      variablesJson: Array.isArray(body.variables)
        ? body.variables
        : extractVariables(String(body.body || '')),
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
    const providerHint = String(body.provider || 'APITXT').toUpperCase();
    let existing = id
      ? await this.prisma.schoolSmsGateway.findFirst({
          where: { id, tenantId },
        })
      : null;
    if (!existing && providerHint === 'APITXT') {
      existing = await this.prisma.schoolSmsGateway.findFirst({
        where: { tenantId, provider: 'APITXT' },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });
    }
    if (id && !existing) throw new NotFoundException('Gateway not found');
    id = existing?.id ?? id;
    const provider = String(
      body.provider || existing?.provider || 'APITXT',
    ).toUpperCase();
    const creds = mergeSmsCreds(this.creds(existing?.credentialsEnc), body);
    if (provider === 'APITXT') {
      creds.otpApiUrl = creds.otpApiUrl || APITXT_SEND_OTP_URL;
      if (!creds.route) creds.route = '4';
    }
    const credentialsEnc = this.crypto.encrypt(JSON.stringify(creds));
    let apiUrl =
      body.apiUrl != null && String(body.apiUrl)
        ? String(body.apiUrl)
        : (existing?.apiUrl ?? null);
    if (provider === 'APITXT' && (!apiUrl || /sendotp/i.test(apiUrl))) {
      apiUrl =
        this.config.get<string>('SCHOOL_APITXT_SEND_URL')?.trim() ||
        APITXT_SEND_MSG_URL;
    }
    const senderRaw = keepStr(
      body.senderId,
      existing?.senderId || creds.sender,
    );
    const senderId = senderRaw ? senderRaw.toUpperCase() : null;
    const data = {
      name: String(body.name || existing?.name || body.provider || 'API txt'),
      provider,
      apiUrl,
      senderId,
      dltEntityId: keepStr(
        body.dltEntityId ?? body.peId ?? body.pe_id,
        existing?.dltEntityId || creds.peId,
      ),
      dltHeader: keepStr(body.dltHeader, existing?.dltHeader || senderId),
      environment: String(body.environment || existing?.environment || 'LIVE'),
      status: String(body.status || existing?.status || 'INACTIVE'),
      failoverRank: Number(body.failoverRank ?? existing?.failoverRank ?? 0),
      credentialsEnc,
    };
    const saved = id
      ? await this.prisma.schoolSmsGateway.update({ where: { id }, data })
      : await this.prisma.schoolSmsGateway.create({
          data: { tenantId, ...data },
        });
    if (body.isDefault === true && saved.status === 'ACTIVE') {
      await this.setDefaultGateway(tenantId, saved.id);
    }
    if (provider === 'APITXT') {
      await this.prisma.schoolSmsGateway.deleteMany({
        where: {
          tenantId,
          provider: 'APITXT',
          id: { not: saved.id },
          senderId: null,
          messages: { none: {} },
        },
      });
    }
    return this.publicGateway(
      await this.prisma.schoolSmsGateway.findUniqueOrThrow({
        where: { id: saved.id },
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
      dltEntityId: gw.dltEntityId,
      entityId: settings.entityId,
      defaultTemplateId:
        String(asJson(settings.extrasJson).apitxtTemplateId || '') ||
        creds.templateId ||
        null,
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
    if (balance.error && !connected && gw.provider.toUpperCase() !== 'APITXT') {
      issues.push(sanitizeSmsError(balance.error));
    }
    const ok =
      issues.length === 0 &&
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
      ok: issues.length === 0,
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
    const current = await this.ensure(tenantId);
    const extras = asJson(current.extrasJson);
    if ('apitxtRoute' in body) {
      extras.apitxtRoute = String(body.apitxtRoute || '4') === '1' ? '1' : '4';
    }
    if ('apitxtTemplateId' in body) {
      extras.apitxtTemplateId = String(body.apitxtTemplateId || '').trim();
    }
    if ('apitxtFlash' in body) {
      extras.apitxtFlash = String(body.apitxtFlash ?? '0');
    }
    if ('apitxtUnicode' in body) {
      extras.apitxtUnicode = String(body.apitxtUnicode || 'auto');
    }
    const data: Prisma.SchoolSmsSettingsUpdateInput = {
      extrasJson: extras as Prisma.InputJsonValue,
    };
    if ('defaultSenderId' in body) {
      const sender = String(body.defaultSenderId || '')
        .trim()
        .toUpperCase();
      data.defaultSenderId = sender || null;
    }
    if ('enforceDlt' in body) data.enforceDlt = body.enforceDlt !== false;
    if ('enforceDltOnService' in body) {
      data.enforceDltOnService = !!body.enforceDltOnService;
    }
    if ('failoverEnabled' in body)
      data.failoverEnabled = !!body.failoverEnabled;
    if ('maxPerMinute' in body) data.maxPerMinute = Number(body.maxPerMinute);
    if ('maxCampaignSize' in body) {
      data.maxCampaignSize = Number(body.maxCampaignSize);
    }
    if ('retryAttempts' in body)
      data.retryAttempts = Number(body.retryAttempts);
    if ('otpExpiryMinutes' in body) {
      data.otpExpiryMinutes = Number(body.otpExpiryMinutes);
    }
    if ('otpMaxAttempts' in body) {
      data.otpMaxAttempts = Number(body.otpMaxAttempts);
    }
    if ('unitCost' in body) data.unitCost = Number(body.unitCost);
    if ('manualBalance' in body) {
      data.manualBalance = Number(body.manualBalance);
    }
    if ('entityId' in body) {
      data.entityId = String(body.entityId || '').trim() || null;
    }
    if ('entityName' in body) {
      data.entityName = String(body.entityName || '').trim() || null;
    }
    return this.prisma.schoolSmsSettings.update({
      where: { tenantId },
      data,
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
        creds.otpApiUrl ||
        this.config.get<string>('SCHOOL_APITXT_OTP_URL') ||
        APITXT_SEND_OTP_URL,
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
    dltEntityId?: string | null;
    dltHeader?: string | null;
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
      dltEntityId: g.dltEntityId ?? null,
      dltHeader: g.dltHeader ?? null,
      status: g.status,
      isDefault: g.isDefault,
      health: g.health,
      lastError: g.lastError ? sanitizeSmsError(g.lastError) : null,
      lastSuccessAt: g.lastSuccessAt,
      hasApiKey: Boolean(creds.apiKey || creds.authkey || creds.authToken),
      hasTemplateId: Boolean(creds.templateId || creds.dltTemplateId),
      hasPeId: Boolean(g.dltEntityId || creds.peId || creds.pe_id),
      route: creds.route || (g.provider === 'APITXT' ? '4' : null),
      otpTemplateId: creds.otpTemplateId || '',
      otpChannel: creds.otpChannel || 'sms',
      templateId: creds.templateId || '',
      flash: creds.flash || '0',
      unicode: creds.unicode || 'auto',
    };
  }

  private async dispatch(
    gw: {
      id: string;
      tenantId?: string;
      provider: string;
      apiUrl: string | null;
      senderId: string | null;
      credentialsEnc: string | null;
      dltHeader: string | null;
      dltEntityId: string | null;
    },
    msg: {
      id: string;
      tenantId?: string;
      mobile: string;
      body: string;
      senderId: string | null;
      idempotencyKey: string | null;
      templateId?: string | null;
      campaignId?: string | null;
      studentId?: string | null;
      staffId?: string | null;
      recipientName?: string | null;
    },
  ) {
    const provider = resolveSmsProvider(gw.provider);
    const creds = this.creds(gw.credentialsEnc);
    const tenantId = msg.tenantId || gw.tenantId;
    let dltTemplateId = creds.templateId || creds.dltTemplateId || '';
    let smsKind: string | null = null;
    if (msg.templateId) {
      const tpl = await this.prisma.schoolSmsTemplate.findFirst({
        where: { id: msg.templateId },
        select: { dltTemplateId: true, smsKind: true },
      });
      if (tpl?.dltTemplateId) dltTemplateId = tpl.dltTemplateId;
      smsKind = tpl?.smsKind ?? null;
    }
    if (msg.campaignId) {
      const camp = await this.prisma.schoolSmsCampaign.findFirst({
        where: { id: msg.campaignId },
        select: { smsKind: true },
      });
      smsKind = camp?.smsKind || smsKind;
    }
    if (!dltTemplateId && tenantId) {
      const approved = await this.prisma.schoolSmsDltTemplate.findFirst({
        where: { tenantId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      });
      dltTemplateId = approved?.dltTemplateId || dltTemplateId;
    }
    if (!dltTemplateId && tenantId) {
      const settings = await this.prisma.schoolSmsSettings.findUnique({
        where: { tenantId },
      });
      dltTemplateId = String(
        asJson(settings?.extrasJson).apitxtTemplateId || '',
      );
    }
    const segs = smsSegments(msg.body);
    const variables = await this.flowVariablesFor(msg);
    return provider.sendSms(
      {
        to: msg.mobile,
        body: msg.body,
        senderId: msg.senderId || gw.senderId || creds.sender,
        header: gw.dltHeader,
        entityId: gw.dltEntityId || creds.peId || creds.pe_id,
        dltTemplateId: dltTemplateId || null,
        smsKind,
        unicode: segs.unicode,
        variables,
        idempotencyKey: msg.idempotencyKey || msg.id,
      },
      creds,
      gw.apiUrl,
    );
  }

  private async flowVariablesFor(msg: {
    tenantId?: string;
    studentId?: string | null;
    staffId?: string | null;
    recipientName?: string | null;
    campaignId?: string | null;
    templateId?: string | null;
    body: string;
  }): Promise<Record<string, string>> {
    const vars: Record<string, string> = {
      school_name: "St. Luke's Secondary School",
    };
    if (msg.recipientName) {
      vars.parent_name = msg.recipientName;
      vars.name = msg.recipientName;
    }
    let templateBody = '';
    if (msg.campaignId) {
      const camp = await this.prisma.schoolSmsCampaign.findFirst({
        where: { id: msg.campaignId },
        select: { body: true, audienceJson: true, templateId: true },
      });
      templateBody = camp?.body || '';
      const extra = asJson(asJson(camp?.audienceJson).flowVariables);
      for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== '') vars[k] = String(v);
      }
    }
    if (!templateBody && msg.templateId) {
      const tpl = await this.prisma.schoolSmsTemplate.findFirst({
        where: { id: msg.templateId },
        select: { body: true },
      });
      templateBody = tpl?.body || '';
    }
    if (!templateBody) templateBody = msg.body;
    if (msg.studentId) {
      const en = await this.prisma.schoolEnrollment.findFirst({
        where: { studentId: msg.studentId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          student: {
            include: { guardians: { include: { guardian: true } } },
          },
          section: { include: { grade: true } },
        },
      });
      if (en) {
        const parent =
          en.student.guardians.find((g) => g.guardian.isPrimary)?.guardian ??
          en.student.guardians[0]?.guardian;
        vars.student_name = en.student.fullName;
        vars.parent_name = parent?.fullName || vars.parent_name || 'Parent';
        vars.class_name = `${en.section.grade.name} ${en.section.name}`;
        vars.class = en.section.grade.code;
        vars.section = en.section.name;
        vars.admission_no = en.student.admissionNumber;
        vars.name = vars.parent_name;
      }
    }
    if (msg.staffId && !vars.student_name) {
      const staff = await this.prisma.schoolStaff.findFirst({
        where: { id: msg.staffId },
        select: { fullName: true },
      });
      if (staff) {
        vars.student_name = staff.fullName;
        vars.parent_name = staff.fullName;
        vars.name = staff.fullName;
      }
    }
    return pickSmsVariables(templateBody, vars);
  }

  private async ensureApitxtGateway(
    tenantId: string,
    settings: {
      defaultSenderId: string | null;
      entityId: string | null;
    },
  ) {
    const envKey =
      this.config.get<string>('SCHOOL_APITXT_AUTHKEY')?.trim() || '';
    const sender = (
      this.config.get<string>('SCHOOL_APITXT_SENDER')?.trim() ||
      settings.defaultSenderId ||
      ''
    ).toUpperCase();
    const peId =
      this.config.get<string>('SCHOOL_APITXT_PE_ID')?.trim() ||
      settings.entityId ||
      '';
    const templateId =
      this.config.get<string>('SCHOOL_APITXT_TEMPLATE_ID')?.trim() || '';
    const route = this.config.get<string>('SCHOOL_APITXT_ROUTE')?.trim() || '4';
    const sendUrl =
      this.config.get<string>('SCHOOL_APITXT_SEND_URL')?.trim() ||
      APITXT_SEND_MSG_URL;
    const existing = await this.prisma.schoolSmsGateway.findFirst({
      where: { tenantId, provider: 'APITXT' },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    if (existing) {
      await this.prisma.schoolSmsGateway.deleteMany({
        where: {
          tenantId,
          provider: 'APITXT',
          id: { not: existing.id },
          senderId: null,
          messages: { none: {} },
        },
      });
    }
    const prev = this.creds(existing?.credentialsEnc);
    const creds: Record<string, string> = { ...prev };
    if (envKey && !creds.apiKey && !creds.authkey) {
      creds.apiKey = envKey;
      creds.authkey = envKey;
    }
    if (!creds.route) creds.route = route;
    if (!creds.peId && peId) creds.peId = peId;
    if (!creds.templateId && templateId) creds.templateId = templateId;
    if (!creds.otpApiUrl) creds.otpApiUrl = APITXT_SEND_OTP_URL;
    const otpTemplateId =
      this.config.get<string>('SCHOOL_APITXT_OTP_TEMPLATE_ID')?.trim() || '';
    if (!creds.otpTemplateId && otpTemplateId) {
      creds.otpTemplateId = otpTemplateId;
    }
    if (!creds.otpChannel) {
      creds.otpChannel =
        this.config.get<string>('SCHOOL_APITXT_CHANNEL')?.trim() || 'sms';
    }
    if (!creds.otpCountry) {
      creds.otpCountry =
        this.config.get<string>('SCHOOL_APITXT_COUNTRY')?.trim() || '91';
    }
    if (!existing) {
      const others = await this.prisma.schoolSmsGateway.count({
        where: { tenantId },
      });
      const hasKey = Boolean(creds.apiKey || creds.authkey);
      await this.prisma.schoolSmsGateway.create({
        data: {
          tenantId,
          name: 'API txt',
          provider: 'APITXT',
          apiUrl: sendUrl,
          senderId: sender || null,
          dltEntityId: peId || null,
          dltHeader: sender || null,
          environment: 'LIVE',
          status: hasKey ? 'ACTIVE' : 'INACTIVE',
          isDefault: others === 0 && hasKey,
          credentialsEnc: this.crypto.encrypt(JSON.stringify(creds)),
        },
      });
      if (sender || peId) {
        await this.prisma.schoolSmsSettings.update({
          where: { tenantId },
          data: {
            ...(sender && !settings.defaultSenderId
              ? { defaultSenderId: sender }
              : {}),
            ...(peId && !settings.entityId ? { entityId: peId } : {}),
          },
        });
      }
      return;
    }
    const nextApiUrl =
      !existing.apiUrl || /sendotp/i.test(existing.apiUrl)
        ? sendUrl
        : existing.apiUrl;
    const hadKey = Boolean(prev.apiKey || prev.authkey);
    const hasKey = Boolean(creds.apiKey || creds.authkey);
    const shouldActivate = !hadKey && hasKey && existing.status !== 'ACTIVE';
    const decryptFailed = Boolean(
      existing.credentialsEnc && Object.keys(prev).length === 0,
    );
    const needsUpdate =
      nextApiUrl !== existing.apiUrl ||
      existing.name === 'Apitxt OTP' ||
      shouldActivate ||
      (!existing.senderId && Boolean(sender)) ||
      (!existing.dltEntityId && Boolean(peId)) ||
      (!decryptFailed &&
        (creds.route !== prev.route ||
          creds.otpApiUrl !== prev.otpApiUrl ||
          creds.peId !== prev.peId ||
          creds.templateId !== prev.templateId ||
          creds.apiKey !== prev.apiKey));
    if (!needsUpdate) return;
    await this.prisma.schoolSmsGateway.update({
      where: { id: existing.id },
      data: {
        apiUrl: nextApiUrl,
        senderId: existing.senderId || sender || null,
        dltEntityId: existing.dltEntityId || peId || null,
        dltHeader: existing.dltHeader || sender || null,
        status: shouldActivate ? 'ACTIVE' : existing.status,
        ...(decryptFailed
          ? {}
          : { credentialsEnc: this.crypto.encrypt(JSON.stringify(creds)) }),
        name: existing.name === 'Apitxt OTP' ? 'API txt' : existing.name,
      },
    });
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

function asJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') return safeJson(raw);
  return {};
}

function keepStr(incoming: unknown, fallback?: string | null): string | null {
  if (incoming == null) return fallback?.trim() ? fallback : null;
  const v = String(incoming).trim();
  return v || fallback || null;
}

function mergeSmsCreds(
  previous: Record<string, string>,
  body: Record<string, unknown>,
): Record<string, string> {
  const next = { ...previous };
  const assign = (key: string, ...aliases: string[]) => {
    for (const alias of [key, ...aliases]) {
      if (alias in body && body[alias] != null && String(body[alias]) !== '') {
        next[key] = String(body[alias]);
        return;
      }
    }
  };
  assign('apiKey', 'authkey');
  assign('authkey', 'apiKey');
  assign('apiSecret');
  assign('accountSid');
  assign('authToken');
  assign('token');
  assign('from');
  assign('sender', 'senderId');
  assign('peId', 'pe_id', 'dltEntityId');
  assign('templateId', 'dltTemplateId', 'apitxtTemplateId');
  assign('route', 'apitxtRoute');
  assign('flash', 'apitxtFlash');
  assign('unicode', 'apitxtUnicode');
  assign('otpTemplateId');
  assign('otpTemplateName');
  assign('otpChannel');
  assign('otpCountry');
  assign('otpApiUrl');
  assign('projectRefId');
  if (next.apiKey && !next.authkey) next.authkey = next.apiKey;
  if (next.authkey && !next.apiKey) next.apiKey = next.authkey;
  return next;
}
