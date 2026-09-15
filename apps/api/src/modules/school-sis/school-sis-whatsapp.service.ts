import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import {
  WA_DEFAULT_AUTOMATIONS,
  WA_FLOW_KINDS,
  WA_LIBRARY_TEMPLATES,
  WA_OPT_IN_CATEGORIES,
} from './school-sis-whatsapp.catalog';
import {
  MetaWhatsappProvider,
  exchangeEmbeddedSignupCode,
  type MetaCloudCredentials,
} from './school-sis-whatsapp.provider';
import type {
  AssignConversationDto,
  AudienceFilterDto,
  ConversationNoteDto,
  EmbeddedSignupDto,
  SaveAutomationDto,
  SaveCampaignDto,
  SaveFlowDto,
  SaveOptInDto,
  SaveTemplateDto,
  SaveWhatsappAccountDto,
  SaveWhatsappNumberDto,
  SaveWhatsappSettingsDto,
  SendTemplateMessageDto,
  SendTextMessageDto,
} from './dto/school-whatsapp.dto';

export type WaActor = {
  userId: string;
  email?: string;
  ip?: string;
  manage: boolean;
  send: boolean;
  campaigns: boolean;
  settings: boolean;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

function toE164(raw: string | null | undefined) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
}

function maskSecret(value: string | null | undefined) {
  if (!value) return { configured: false, hint: null as string | null };
  const plain = value.startsWith('enc:v1:') ? 'stored' : value;
  return { configured: true, hint: `***************${plain.slice(-4)}` };
}

@Injectable()
export class SchoolSisWhatsappService {
  private readonly logger = new Logger(SchoolSisWhatsappService.name);
  private readonly provider = new MetaWhatsappProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly crypto: FieldEncryptionService,
    private readonly config: ConfigService,
    @InjectQueue('school-whatsapp') private readonly queue: Queue,
  ) {}

  private assert(
    actor: WaActor,
    need: 'send' | 'campaigns' | 'settings' | 'manage',
  ) {
    if (need === 'manage' && !actor.manage)
      throw new ForbiddenException('Not allowed');
    if (need === 'settings' && !actor.settings && !actor.manage) {
      throw new ForbiddenException('WhatsApp settings require authorization');
    }
    if (need === 'send' && !actor.send && !actor.manage) {
      throw new ForbiddenException('WhatsApp send requires authorization');
    }
    if (need === 'campaigns' && !actor.campaigns && !actor.manage) {
      throw new ForbiddenException('WhatsApp campaigns require authorization');
    }
  }

  private async audit(
    tenantId: string,
    actor: WaActor | { userId?: string; ip?: string },
    action: string,
    extra?: Record<string, unknown>,
  ) {
    await this.prisma.schoolWhatsappAuditLog.create({
      data: {
        tenantId,
        userId: actor.userId ?? null,
        action,
        recipient: extra?.recipient ? String(extra.recipient) : null,
        template: extra?.template ? String(extra.template) : null,
        messageId: extra?.messageId ? String(extra.messageId) : null,
        ip: actor.ip ?? null,
        status: extra?.status ? String(extra.status) : null,
        detailJson: (extra ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolWhatsappSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    const existing = await this.prisma.schoolWhatsappTemplate.count({
      where: { tenantId, deletedAt: null },
    });
    if (existing === 0) {
      for (const tpl of WA_LIBRARY_TEMPLATES) {
        await this.prisma.schoolWhatsappTemplate.create({
          data: {
            tenantId,
            name: tpl.name,
            language: 'en',
            category: tpl.category,
            status: 'DRAFT',
            body: tpl.body,
            libraryKey: tpl.key,
            variables: {
              create: tpl.variables.map((v) => ({
                tenantId,
                position: v.position,
                token: v.token,
                erpField: v.erpField,
                sample: v.sample,
              })),
            },
          },
        });
      }
    }
    const autoCount = await this.prisma.schoolWhatsappAutomation.count({
      where: { tenantId, deletedAt: null },
    });
    if (autoCount === 0) {
      for (const row of WA_DEFAULT_AUTOMATIONS) {
        await this.prisma.schoolWhatsappAutomation.create({
          data: { tenantId, ...row },
        });
      }
    }
    const flowCount = await this.prisma.schoolWhatsappFlow.count({
      where: { tenantId, deletedAt: null },
    });
    if (flowCount === 0) {
      for (const kind of WA_FLOW_KINDS) {
        await this.prisma.schoolWhatsappFlow.create({
          data: {
            tenantId,
            name: kind.replaceAll('_', ' '),
            kind,
            status: 'DRAFT',
          },
        });
      }
    }
  }

  private async settingsRow(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  private decrypt(value: string | null) {
    return this.crypto.decrypt(value);
  }

  private encrypt(value: string | undefined) {
    if (value == null || value.trim() === '') return undefined;
    return this.crypto.encrypt(value.trim());
  }

  private async defaultNumber(tenantId: string) {
    return this.prisma.schoolWhatsappPhoneNumber.findFirst({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { account: true },
    });
  }

  private credsFor(
    account: {
      accessTokenEnc: string | null;
      apiVersion: string;
      wabaId: string | null;
      appSecretEnc: string | null;
    },
    phoneNumberId: string,
  ): MetaCloudCredentials {
    const token = this.decrypt(account.accessTokenEnc);
    if (!token) {
      throw new BadRequestException('WhatsApp account not connected');
    }
    return {
      accessToken: token,
      phoneNumberId,
      wabaId: account.wabaId ?? undefined,
      appSecret: this.decrypt(account.appSecretEnc) ?? undefined,
      apiVersion: account.apiVersion || 'v22.0',
    };
  }

  async dashboard(tenantId: string) {
    await this.ensureSetup(tenantId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      sent,
      delivered,
      read,
      failed,
      pending,
      inbound,
      conversations,
      campaigns,
      todayRows,
      recent,
    ] = await Promise.all([
      this.prisma.schoolWhatsappMessage.count({
        where: {
          tenantId,
          direction: 'OUT',
          createdAt: { gte: since },
          status: { not: 'FAILED' },
        },
      }),
      this.prisma.schoolWhatsappMessage.count({
        where: {
          tenantId,
          direction: 'OUT',
          deliveredAt: { not: null },
          createdAt: { gte: since },
        },
      }),
      this.prisma.schoolWhatsappMessage.count({
        where: {
          tenantId,
          direction: 'OUT',
          readAt: { not: null },
          createdAt: { gte: since },
        },
      }),
      this.prisma.schoolWhatsappMessage.count({
        where: {
          tenantId,
          direction: 'OUT',
          status: 'FAILED',
          createdAt: { gte: since },
        },
      }),
      this.prisma.schoolWhatsappMessage.count({
        where: {
          tenantId,
          direction: 'OUT',
          status: { in: ['QUEUED', 'PENDING'] },
        },
      }),
      this.prisma.schoolWhatsappMessage.count({
        where: { tenantId, direction: 'IN', createdAt: { gte: since } },
      }),
      this.prisma.schoolWhatsappConversation.count({
        where: { tenantId, status: { in: ['OPEN', 'PENDING'] } },
      }),
      this.prisma.schoolWhatsappCampaign.count({
        where: { tenantId, createdAt: { gte: since } },
      }),
      this.prisma.schoolWhatsappMessage.groupBy({
        by: ['status'],
        where: { tenantId, direction: 'OUT', createdAt: { gte: today } },
        _count: true,
      }),
      this.prisma.schoolWhatsappCampaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { template: { select: { name: true } } },
      }),
    ]);
    const todayMap = Object.fromEntries(
      todayRows.map((r) => [r.status, r._count]),
    );
    const number = await this.defaultNumber(tenantId);
    return {
      kpis: {
        sent,
        delivered,
        read,
        failed,
        pending,
        replies: inbound,
        conversations,
        campaigns,
      },
      today: {
        sent:
          (todayMap.SENT ?? 0) +
          (todayMap.DELIVERED ?? 0) +
          (todayMap.READ ?? 0),
        delivered: todayMap.DELIVERED ?? 0,
        read: todayMap.READ ?? 0,
        failed: todayMap.FAILED ?? 0,
        replies: await this.prisma.schoolWhatsappMessage.count({
          where: { tenantId, direction: 'IN', createdAt: { gte: today } },
        }),
      },
      connection: number
        ? {
            connected: number.account.status === 'CONNECTED',
            displayPhone: number.displayPhone,
            accountName: number.account.name,
            apiStatus: number.account.status,
            lastWebhookAt: number.account.lastWebhookAt,
            lastError: number.account.lastError,
          }
        : { connected: false },
      recentCampaigns: recent,
    };
  }

  async listAccounts(tenantId: string) {
    await this.ensureSetup(tenantId);
    const rows = await this.prisma.schoolWhatsappAccount.findMany({
      where: { tenantId, deletedAt: null },
      include: { numbers: { where: { deletedAt: null } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      ...row,
      accessTokenEnc: undefined,
      appSecretEnc: undefined,
      webhookVerifyEnc: undefined,
      accessToken: maskSecret(row.accessTokenEnc),
      appSecret: maskSecret(row.appSecretEnc),
      webhookVerifyToken: maskSecret(row.webhookVerifyEnc),
    }));
  }

  embeddedConfig() {
    return {
      appId: this.config.get<string>('SCHOOL_WHATSAPP_EMBEDDED_APP_ID') ?? '',
      configId:
        this.config.get<string>('SCHOOL_WHATSAPP_EMBEDDED_CONFIG_ID') ?? '',
      graphVersion:
        this.config.get<string>('SCHOOL_WHATSAPP_GRAPH_VERSION') ?? 'v22.0',
      signupVersion: 'v4',
      note: 'Embedded Signup v4. Do not use Embedded Signup v2 (deprecated 15 Oct 2026).',
    };
  }

  async saveAccount(
    tenantId: string,
    dto: SaveWhatsappAccountDto,
    actor: WaActor,
    id?: string,
  ) {
    this.assert(actor, 'settings');
    const data: Prisma.SchoolWhatsappAccountUncheckedUpdateInput = {
      name: dto.name.trim(),
      wabaId: dto.wabaId?.trim() || null,
      businessPortfolioId: dto.businessPortfolioId?.trim() || null,
      appId: dto.appId?.trim() || null,
      apiVersion: dto.apiVersion?.trim() || 'v22.0',
    };
    if (dto.accessToken) data.accessTokenEnc = this.encrypt(dto.accessToken);
    if (dto.appSecret) data.appSecretEnc = this.encrypt(dto.appSecret);
    if (dto.webhookVerifyToken) {
      data.webhookVerifyEnc = this.encrypt(dto.webhookVerifyToken);
      data.webhookVerifyHash = createHash('sha256')
        .update(dto.webhookVerifyToken)
        .digest('hex');
    }
    const row = id
      ? await this.prisma.schoolWhatsappAccount.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolWhatsappAccount.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            wabaId: dto.wabaId?.trim() || null,
            businessPortfolioId: dto.businessPortfolioId?.trim() || null,
            appId: dto.appId?.trim() || null,
            apiVersion: dto.apiVersion?.trim() || 'v22.0',
            accessTokenEnc: this.encrypt(dto.accessToken) ?? null,
            appSecretEnc: this.encrypt(dto.appSecret) ?? null,
            webhookVerifyEnc: this.encrypt(dto.webhookVerifyToken) ?? null,
            webhookVerifyHash: dto.webhookVerifyToken
              ? createHash('sha256')
                  .update(dto.webhookVerifyToken)
                  .digest('hex')
              : null,
            status: dto.accessToken ? 'CONNECTED' : 'DISCONNECTED',
            createdBy: actor.userId,
          },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'ACCOUNT_UPDATED' : 'ACCOUNT_CREATED',
      {
        recordId: row.id,
      },
    );
    return this.listAccounts(tenantId);
  }

  async saveNumber(
    tenantId: string,
    dto: SaveWhatsappNumberDto,
    actor: WaActor,
    id?: string,
  ) {
    this.assert(actor, 'settings');
    const account = await this.prisma.schoolWhatsappAccount.findFirst({
      where: { id: dto.accountId, tenantId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('WhatsApp account not found');
    if (dto.isDefault) {
      await this.prisma.schoolWhatsappPhoneNumber.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    const payload = {
      name: dto.name.trim(),
      displayPhone: dto.displayPhone.trim(),
      phoneNumberId: dto.phoneNumberId.trim(),
      purpose: dto.purpose ?? 'GENERAL',
      isDefault: dto.isDefault ?? false,
      status: dto.status ?? 'ACTIVE',
    };
    if (id) {
      await this.prisma.schoolWhatsappPhoneNumber.update({
        where: { id },
        data: payload,
      });
    } else {
      await this.prisma.schoolWhatsappPhoneNumber.create({
        data: { tenantId, accountId: account.id, ...payload },
      });
    }
    return this.listAccounts(tenantId);
  }

  async testConnection(
    tenantId: string,
    actor: WaActor,
    phoneNumberRowId?: string,
  ) {
    this.assert(actor, 'settings');
    const number = phoneNumberRowId
      ? await this.prisma.schoolWhatsappPhoneNumber.findFirst({
          where: { id: phoneNumberRowId, tenantId, deletedAt: null },
          include: { account: true },
        })
      : await this.defaultNumber(tenantId);
    if (!number)
      throw new BadRequestException('WhatsApp account not connected');
    const result = await this.provider.testConnection(
      this.credsFor(number.account, number.phoneNumberId),
    );
    await this.prisma.schoolWhatsappAccount.update({
      where: { id: number.accountId },
      data: {
        lastHealthAt: new Date(),
        lastError: result.ok ? null : result.error,
        status: result.ok ? 'CONNECTED' : 'ERROR',
      },
    });
    if (result.ok && result.displayPhone) {
      await this.prisma.schoolWhatsappPhoneNumber.update({
        where: { id: number.id },
        data: {
          displayPhone: result.displayPhone,
          qualityRating: result.qualityRating ?? undefined,
        },
      });
    }
    await this.audit(tenantId, actor, 'CONNECTION_TEST', {
      status: result.ok ? 'OK' : 'FAIL',
    });
    return result;
  }

  async disconnect(tenantId: string, accountId: string, actor: WaActor) {
    this.assert(actor, 'settings');
    await this.prisma.schoolWhatsappAccount.updateMany({
      where: { id: accountId, tenantId },
      data: { status: 'DISCONNECTED', accessTokenEnc: null },
    });
    await this.audit(tenantId, actor, 'ACCOUNT_DISCONNECTED', {
      recordId: accountId,
    });
    return this.listAccounts(tenantId);
  }

  async completeEmbeddedSignup(
    tenantId: string,
    dto: EmbeddedSignupDto,
    actor: WaActor,
  ) {
    this.assert(actor, 'settings');
    const appId =
      this.config.get<string>('SCHOOL_WHATSAPP_EMBEDDED_APP_ID') ??
      this.config.get<string>('SCHOOL_WHATSAPP_APP_ID');
    const appSecret =
      this.config.get<string>('SCHOOL_WHATSAPP_APP_SECRET') ??
      this.config.get<string>('SCHOOL_WHATSAPP_EMBEDDED_APP_SECRET');
    const apiVersion =
      this.config.get<string>('SCHOOL_WHATSAPP_GRAPH_VERSION') ?? 'v22.0';
    if (!appId || !appSecret) {
      throw new BadRequestException(
        'Embedded Signup is not configured. Set SCHOOL_WHATSAPP_EMBEDDED_APP_ID and SCHOOL_WHATSAPP_APP_SECRET.',
      );
    }
    const exchanged = await exchangeEmbeddedSignupCode({
      appId,
      appSecret,
      code: dto.code,
      apiVersion,
    });
    if (!exchanged.accessToken) {
      throw new BadRequestException(exchanged.error ?? 'Token exchange failed');
    }
    const account = await this.prisma.schoolWhatsappAccount.create({
      data: {
        tenantId,
        name: dto.verifiedName || 'School WhatsApp Business',
        provider: 'META',
        wabaId: dto.wabaId ?? null,
        businessPortfolioId: dto.businessId ?? null,
        appId,
        apiVersion,
        accessTokenEnc: this.encrypt(exchanged.accessToken) ?? null,
        appSecretEnc: this.encrypt(appSecret) ?? null,
        status: 'CONNECTED',
        createdBy: actor.userId,
      },
    });
    if (dto.phoneNumberId) {
      const hasDefault = await this.prisma.schoolWhatsappPhoneNumber.findFirst({
        where: { tenantId, isDefault: true, deletedAt: null },
      });
      await this.prisma.schoolWhatsappPhoneNumber.create({
        data: {
          tenantId,
          accountId: account.id,
          name: dto.verifiedName || 'School General',
          displayPhone: dto.displayPhone || dto.phoneNumberId,
          phoneNumberId: dto.phoneNumberId,
          isDefault: !hasDefault,
          status: 'ACTIVE',
        },
      });
      await this.testConnection(tenantId, actor);
    }
    await this.audit(tenantId, actor, 'EMBEDDED_SIGNUP', {
      recordId: account.id,
    });
    return this.listAccounts(tenantId);
  }

  async getSettings(tenantId: string) {
    const row = await this.settingsRow(tenantId);
    return {
      ...row,
      embedded: this.embeddedConfig(),
      categories: WA_OPT_IN_CATEGORIES,
    };
  }

  async saveSettings(
    tenantId: string,
    dto: SaveWhatsappSettingsDto,
    actor: WaActor,
  ) {
    this.assert(actor, 'settings');
    await this.settingsRow(tenantId);
    return this.prisma.schoolWhatsappSettings.update({
      where: { tenantId },
      data: {
        defaultLanguage: dto.defaultLanguage,
        defaultPhoneNumberId: dto.defaultPhoneNumberId,
        retryAttempts: dto.retryAttempts,
        rateLimitPerMinute: dto.rateLimitPerMinute,
        requireCampaignConfirm: dto.requireCampaignConfirm,
        allowDuplicateSend: dto.allowDuplicateSend,
        campaignApproval: dto.campaignApproval,
        optInRequired: dto.optInRequired,
      },
    });
  }

  async listTemplates(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappTemplate.findMany({
      where: { tenantId, deletedAt: null },
      include: { variables: { orderBy: { position: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async saveTemplate(
    tenantId: string,
    dto: SaveTemplateDto,
    actor: WaActor,
    id?: string,
  ) {
    this.assert(actor, 'manage');
    const data = {
      name: dto.name.trim().toLowerCase().replace(/\s+/g, '_'),
      language: dto.language ?? 'en',
      category: dto.category ?? 'UTILITY',
      body: dto.body,
      headerType: dto.headerType,
      headerText: dto.headerText,
      footerText: dto.footerText,
      buttonsJson: (dto.buttonsJson ?? []) as Prisma.InputJsonValue,
      status: 'DRAFT',
      metaStatus: null as string | null,
    };
    const row = id
      ? await this.prisma.schoolWhatsappTemplate.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolWhatsappTemplate.create({
          data: { tenantId, ...data },
        });
    if (dto.variables) {
      await this.prisma.schoolWhatsappTemplateVariable.deleteMany({
        where: { templateId: row.id },
      });
      if (dto.variables.length) {
        await this.prisma.schoolWhatsappTemplateVariable.createMany({
          data: dto.variables.map((v) => ({
            tenantId,
            templateId: row.id,
            position: v.position,
            token: v.token,
            erpField: v.erpField,
            sample: v.sample,
          })),
        });
      }
    }
    return this.listTemplates(tenantId);
  }

  async syncTemplates(tenantId: string, actor: WaActor) {
    this.assert(actor, 'settings');
    const number = await this.defaultNumber(tenantId);
    if (!number?.account.wabaId) {
      throw new BadRequestException('WhatsApp account not connected');
    }
    const remote = await this.provider.listTemplates(
      this.credsFor(number.account, number.phoneNumberId),
    );
    for (const tpl of remote) {
      const body =
        (
          tpl.components as Array<{ type?: string; text?: string }> | undefined
        )?.find((c) => c.type === 'BODY')?.text ?? '';
      await this.prisma.schoolWhatsappTemplate.upsert({
        where: {
          tenantId_name_language: {
            tenantId,
            name: tpl.name,
            language: tpl.language,
          },
        },
        create: {
          tenantId,
          name: tpl.name,
          language: tpl.language,
          category: (tpl.category || 'UTILITY').toUpperCase(),
          status: this.mapMetaStatus(tpl.status),
          metaTemplateId: tpl.id,
          metaStatus: tpl.status,
          body,
          componentsJson: (tpl.components ?? []) as Prisma.InputJsonValue,
        },
        update: {
          status: this.mapMetaStatus(tpl.status),
          metaTemplateId: tpl.id,
          metaStatus: tpl.status,
          body: body || undefined,
          componentsJson: (tpl.components ?? []) as Prisma.InputJsonValue,
          category: (tpl.category || 'UTILITY').toUpperCase(),
        },
      });
    }
    await this.audit(tenantId, actor, 'TEMPLATES_SYNCED', {
      count: remote.length,
    });
    return this.listTemplates(tenantId);
  }

  private mapMetaStatus(status: string) {
    const s = status.toUpperCase();
    if (s === 'APPROVED') return 'APPROVED';
    if (s === 'PENDING' || s === 'IN_REVIEW') return 'PENDING';
    if (s === 'REJECTED') return 'REJECTED';
    if (s === 'PAUSED') return 'PAUSED';
    if (s === 'DISABLED') return 'DISABLED';
    return s || 'DRAFT';
  }

  async syncContacts(tenantId: string, actor: WaActor) {
    this.assert(actor, 'manage');
    const guardians = await this.prisma.schoolGuardian.findMany({
      where: { tenantId, deletedAt: null, phone: { not: null } },
      include: {
        students: {
          include: {
            student: {
              select: { id: true, fullName: true, admissionNumber: true },
            },
          },
        },
      },
      take: 8000,
    });
    let upserts = 0;
    for (const g of guardians) {
      const phone = toE164(g.phone);
      if (!phone) continue;
      const primary = g.students[0]?.student;
      await this.prisma.schoolWhatsappContact.upsert({
        where: { tenantId_phoneE164: { tenantId, phoneE164: phone } },
        create: {
          tenantId,
          phoneE164: phone,
          displayName: g.fullName,
          guardianId: g.id,
          studentId: primary?.id,
          relationship: g.relation,
        },
        update: {
          displayName: g.fullName,
          guardianId: g.id,
          studentId: primary?.id ?? undefined,
          relationship: g.relation,
        },
      });
      upserts += 1;
    }
    const staff = await this.prisma.schoolStaff.findMany({
      where: { tenantId, deletedAt: null, phone: { not: null } },
    });
    for (const s of staff) {
      const phone = toE164(s.phone);
      if (!phone) continue;
      await this.prisma.schoolWhatsappContact.upsert({
        where: { tenantId_phoneE164: { tenantId, phoneE164: phone } },
        create: {
          tenantId,
          phoneE164: phone,
          displayName: s.fullName,
          staffId: s.id,
          relationship: s.staffType,
        },
        update: { displayName: s.fullName, staffId: s.id },
      });
      upserts += 1;
    }
    await this.audit(tenantId, actor, 'CONTACTS_SYNCED', { count: upserts });
    return { upserts };
  }

  async listContacts(tenantId: string, q?: string) {
    await this.ensureSetup(tenantId);
    const term = q?.trim();
    return this.prisma.schoolWhatsappContact.findMany({
      where: {
        tenantId,
        ...(term
          ? {
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { phoneE164: { contains: term.replace(/\D/g, '') } },
              ],
            }
          : {}),
      },
      include: {
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
        guardian: { select: { id: true, fullName: true, relation: true } },
        staff: { select: { id: true, fullName: true, designation: true } },
        optIns: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  conversationWindow(contact: { windowExpiresAt: Date | null }) {
    if (!contact.windowExpiresAt) return { open: false, expiresInMs: 0 };
    const ms = contact.windowExpiresAt.getTime() - Date.now();
    return { open: ms > 0, expiresInMs: Math.max(0, ms) };
  }

  async listConversations(tenantId: string, filter?: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappConversation.findMany({
      where: {
        tenantId,
        ...(filter === 'unread' ? { unreadCount: { gt: 0 } } : {}),
        ...(filter === 'assigned' ? { assignedTo: { not: null } } : {}),
        ...(filter === 'unassigned' ? { assignedTo: null } : {}),
        ...(filter === 'pending' ? { status: 'PENDING' } : {}),
        ...(filter === 'resolved' ? { status: 'RESOLVED' } : {}),
      },
      include: {
        contact: {
          include: {
            student: { select: { fullName: true, admissionNumber: true } },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
  }

  async getConversation(tenantId: string, id: string) {
    const row = await this.prisma.schoolWhatsappConversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: {
          include: {
            student: true,
            guardian: true,
            optIns: true,
          },
        },
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
        notes: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!row) throw new NotFoundException('Conversation not found');
    await this.prisma.schoolWhatsappConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
    return { ...row, window: this.conversationWindow(row.contact) };
  }

  async assignConversation(
    tenantId: string,
    id: string,
    dto: AssignConversationDto,
    actor: WaActor,
  ) {
    this.assert(actor, 'send');
    await this.prisma.schoolWhatsappConversation.updateMany({
      where: { id, tenantId },
      data: {
        assignedTo: dto.assignedTo,
        status: dto.status,
      },
    });
    await this.audit(tenantId, actor, 'CONVERSATION_ASSIGNED', {
      recordId: id,
    });
    return this.getConversation(tenantId, id);
  }

  async addNote(
    tenantId: string,
    conversationId: string,
    dto: ConversationNoteDto,
    actor: WaActor,
  ) {
    this.assert(actor, 'send');
    await this.prisma.schoolWhatsappConversationNote.create({
      data: {
        tenantId,
        conversationId,
        body: dto.body.trim(),
        createdBy: actor.userId,
      },
    });
    return this.getConversation(tenantId, conversationId);
  }

  async previewAudience(tenantId: string, filter: AudienceFilterDto) {
    await this.ensureSetup(tenantId);
    const built = await this.buildAudience(tenantId, filter);
    return {
      total: built.all.length,
      valid: built.valid.length,
      invalid: built.invalid.length,
      duplicatesRemoved: built.duplicates,
      finalRecipients: built.valid.length,
      sample: built.valid.slice(0, 20),
    };
  }

  private async buildAudience(tenantId: string, filter: AudienceFilterDto) {
    const year = filter.academicYearId
      ? await this.prisma.schoolAcademicYear.findFirst({
          where: { id: filter.academicYearId, tenantId },
        })
      : await this.sis.currentYear(tenantId);
    if (!year) throw new BadRequestException('Academic year not found');
    let studentIds: string[] | undefined;
    if (filter.kind === 'STAFF') {
      const staff = await this.prisma.schoolStaff.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(filter.staffIds?.length ? { id: { in: filter.staffIds } } : {}),
        },
        take: 4000,
      });
      const all = staff
        .map((s) => ({
          phone: toE164(s.phone),
          displayName: s.fullName,
          studentId: null as string | null,
          staffId: s.id,
        }))
        .filter((x) => x);
      return this.dedupeAudience(all, filter.allowDuplicates);
    }
    if (filter.kind === 'FEE_DEFAULTERS') {
      const dues = await this.prisma.schoolFeeMonthAccount.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          status: { in: ['DUE', 'OVERDUE', 'PARTIAL'] },
        },
        select: { studentId: true },
      });
      studentIds = [...new Set(dues.map((d) => d.studentId))];
    }
    if (filter.studentIds?.length) studentIds = filter.studentIds;
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
        ...(filter.sectionIds?.length
          ? { sectionId: { in: filter.sectionIds } }
          : {}),
        ...(filter.gradeIds?.length
          ? { section: { gradeId: { in: filter.gradeIds } } }
          : {}),
      },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: true } },
          },
        },
        section: { include: { grade: true } },
      },
      take: 8000,
    });
    const all: Array<{
      phone: string;
      displayName: string;
      studentId: string | null;
      staffId?: string;
    }> = [];
    for (const en of enrollments) {
      if (
        filter.gender &&
        en.student.gender &&
        en.student.gender !== filter.gender
      )
        continue;
      const guardians = en.student.guardians.map((g) => g.guardian);
      const phones = guardians.length
        ? guardians
        : [{ phone: en.student.phone, fullName: en.student.fullName }];
      for (const g of phones) {
        all.push({
          phone: toE164(g.phone),
          displayName: g.fullName ?? en.student.fullName,
          studentId: en.student.id,
        });
      }
    }
    return this.dedupeAudience(all, filter.allowDuplicates);
  }

  private dedupeAudience(
    all: Array<{
      phone: string;
      displayName: string;
      studentId: string | null;
      staffId?: string;
    }>,
    allowDuplicates?: boolean,
  ) {
    const invalid = all.filter((r) => !r.phone);
    const validRaw = all.filter((r) => r.phone);
    const seen = new Set<string>();
    const valid = [];
    let duplicates = 0;
    for (const row of validRaw) {
      if (!allowDuplicates && seen.has(row.phone)) {
        duplicates += 1;
        continue;
      }
      seen.add(row.phone);
      valid.push(row);
    }
    return { all, valid, invalid, duplicates };
  }

  async createCampaign(tenantId: string, dto: SaveCampaignDto, actor: WaActor) {
    this.assert(actor, 'campaigns');
    const template = await this.prisma.schoolWhatsappTemplate.findFirst({
      where: { id: dto.templateId, tenantId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Template not found');
    const audience = await this.buildAudience(tenantId, dto.audience);
    const campaign = await this.prisma.schoolWhatsappCampaign.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        templateId: template.id,
        phoneNumberId: dto.phoneNumberId,
        language: dto.language ?? template.language,
        audienceJson: dto.audience as Prisma.InputJsonValue,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        totalRecipients: audience.all.length,
        validCount: audience.valid.length,
        invalidCount: audience.invalid.length,
        duplicateCount: audience.duplicates,
        createdBy: actor.userId,
      },
    });
    if (audience.valid.length) {
      await this.prisma.schoolWhatsappCampaignRecipient.createMany({
        data: audience.valid.map((r) => ({
          tenantId,
          campaignId: campaign.id,
          phoneE164: r.phone,
          displayName: r.displayName,
          studentId: r.studentId,
          idempotencyKey: `${campaign.id}:${r.phone}`,
        })),
      });
    }
    await this.audit(tenantId, actor, 'CAMPAIGN_CREATED', {
      recordId: campaign.id,
      template: template.name,
    });
    return this.getCampaign(tenantId, campaign.id);
  }

  async getCampaign(tenantId: string, id: string) {
    const row = await this.prisma.schoolWhatsappCampaign.findFirst({
      where: { id, tenantId },
      include: {
        template: { include: { variables: true } },
        phoneNumber: true,
        recipients: { take: 50, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  async listCampaigns(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappCampaign.findMany({
      where: { tenantId },
      include: {
        template: { select: { name: true, status: true, metaStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async sendCampaign(
    tenantId: string,
    id: string,
    actor: WaActor,
    confirm?: boolean,
  ) {
    this.assert(actor, 'campaigns');
    const settings = await this.settingsRow(tenantId);
    if (settings.requireCampaignConfirm && !confirm) {
      throw new BadRequestException('Campaign confirmation is required');
    }
    const campaign = await this.getCampaign(tenantId, id);
    if (!campaign.template || campaign.template.status !== 'APPROVED') {
      throw new BadRequestException('Template not approved');
    }
    if (['PROCESSING', 'COMPLETED'].includes(campaign.status)) {
      throw new BadRequestException('Campaign already processing');
    }
    await this.prisma.schoolWhatsappCampaign.update({
      where: { id },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });
    await this.queue.add(
      'campaign',
      { tenantId, campaignId: id, userId: actor.userId },
      {
        jobId: `campaign__${id}`,
        attempts: settings.retryAttempts,
        backoff: { type: 'exponential', delay: 4000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    await this.audit(tenantId, actor, 'CAMPAIGN_QUEUED', {
      recordId: id,
      status: 'PROCESSING',
    });
    return this.getCampaign(tenantId, id);
  }

  async scheduleCampaign(
    tenantId: string,
    id: string,
    scheduledAt: string,
    actor: WaActor,
  ) {
    this.assert(actor, 'campaigns');
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new BadRequestException('Schedule time must be in the future');
    }
    await this.prisma.schoolWhatsappCampaign.updateMany({
      where: { id, tenantId },
      data: { scheduledAt: when, status: 'SCHEDULED' },
    });
    const delay = when.getTime() - Date.now();
    await this.queue.add(
      'campaign',
      { tenantId, campaignId: id, userId: actor.userId },
      {
        jobId: `campaign__${id}`,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 4000 },
      },
    );
    return this.getCampaign(tenantId, id);
  }

  async pauseCampaign(tenantId: string, id: string, actor: WaActor) {
    this.assert(actor, 'campaigns');
    await this.prisma.schoolWhatsappCampaign.updateMany({
      where: { id, tenantId, status: 'PROCESSING' },
      data: { status: 'PAUSED' },
    });
    return this.getCampaign(tenantId, id);
  }

  async sendText(tenantId: string, dto: SendTextMessageDto, actor: WaActor) {
    this.assert(actor, 'send');
    const phone = toE164(dto.to);
    if (!phone)
      throw new BadRequestException('Recipient has no WhatsApp number');
    const contact = await this.upsertContact(tenantId, phone, dto.contactId);
    const window = this.conversationWindow(contact);
    if (!window.open) {
      throw new BadRequestException('24-hour messaging window expired');
    }
    await this.assertOptIn(tenantId, contact.id, 'GENERAL');
    const conversation = await this.ensureConversation(
      tenantId,
      contact.id,
      dto.phoneNumberId,
    );
    const message = await this.prisma.schoolWhatsappMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        phoneNumberId: dto.phoneNumberId ?? conversation.phoneNumberId,
        direction: 'OUT',
        type: 'TEXT',
        body: dto.body,
        status: 'QUEUED',
        idempotencyKey: randomUUID(),
        sentBy: actor.userId,
      },
    });
    await this.queue.add(
      'send',
      { tenantId, messageId: message.id },
      {
        jobId: `send__${message.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
    return message;
  }

  async sendTemplate(
    tenantId: string,
    dto: SendTemplateMessageDto,
    actor: WaActor,
  ) {
    this.assert(actor, 'send');
    const phone = toE164(dto.to);
    if (!phone)
      throw new BadRequestException('Recipient has no WhatsApp number');
    const template = await this.prisma.schoolWhatsappTemplate.findFirst({
      where: { id: dto.templateId, tenantId, deletedAt: null },
      include: { variables: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status !== 'APPROVED') {
      throw new BadRequestException('Template not approved');
    }
    const contact = await this.upsertContact(
      tenantId,
      phone,
      dto.contactId,
      dto.studentId,
    );
    await this.assertOptIn(
      tenantId,
      contact.id,
      dto.category ?? template.category,
    );
    const conversation = await this.ensureConversation(
      tenantId,
      contact.id,
      dto.phoneNumberId,
    );
    const message = await this.prisma.schoolWhatsappMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        phoneNumberId: dto.phoneNumberId ?? conversation.phoneNumberId,
        templateId: template.id,
        direction: 'OUT',
        type: 'TEMPLATE',
        body: template.body,
        payloadJson: {
          variables: dto.variables ?? {},
          templateName: template.name,
          language: template.language,
        } as Prisma.InputJsonValue,
        status: 'QUEUED',
        idempotencyKey: randomUUID(),
        sentBy: actor.userId,
      },
    });
    await this.prisma.schoolWhatsappTemplate.update({
      where: { id: template.id },
      data: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    await this.queue.add(
      'send',
      { tenantId, messageId: message.id },
      {
        jobId: `send__${message.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
    await this.audit(tenantId, actor, 'TEMPLATE_QUEUED', {
      messageId: message.id,
      template: template.name,
      recipient: phone,
    });
    return message;
  }

  private async upsertContact(
    tenantId: string,
    phone: string,
    contactId?: string,
    studentId?: string,
  ) {
    if (contactId) {
      const existing = await this.prisma.schoolWhatsappContact.findFirst({
        where: { id: contactId, tenantId },
      });
      if (existing) return existing;
    }
    return this.prisma.schoolWhatsappContact.upsert({
      where: { tenantId_phoneE164: { tenantId, phoneE164: phone } },
      create: {
        tenantId,
        phoneE164: phone,
        displayName: phone,
        studentId,
      },
      update: { studentId: studentId ?? undefined },
    });
  }

  private async ensureConversation(
    tenantId: string,
    contactId: string,
    phoneNumberId?: string,
  ) {
    const existing = await this.prisma.schoolWhatsappConversation.findFirst({
      where: {
        tenantId,
        contactId,
        ...(phoneNumberId ? { phoneNumberId } : {}),
      },
    });
    if (existing) return existing;
    const number = phoneNumberId
      ? await this.prisma.schoolWhatsappPhoneNumber.findFirst({
          where: { id: phoneNumberId, tenantId },
        })
      : await this.defaultNumber(tenantId);
    return this.prisma.schoolWhatsappConversation.create({
      data: {
        tenantId,
        contactId,
        phoneNumberId: number?.id ?? null,
        status: 'OPEN',
      },
    });
  }

  private async assertOptIn(
    tenantId: string,
    contactId: string,
    category: string,
  ) {
    const settings = await this.settingsRow(tenantId);
    if (!settings.optInRequired) return;
    const essential = settings.essentialCategories as string[];
    const row = await this.prisma.schoolWhatsappOptIn.findUnique({
      where: { contactId_category: { contactId, category } },
    });
    if (row?.status === 'OPTED_OUT') {
      throw new BadRequestException('Recipient opted out');
    }
    if (
      settings.optInRequired &&
      !essential.includes(category) &&
      row?.status !== 'OPTED_IN'
    ) {
      throw new BadRequestException('Recipient opted out');
    }
  }

  async processSendJob(tenantId: string, messageId: string) {
    const message = await this.prisma.schoolWhatsappMessage.findFirst({
      where: { id: messageId, tenantId },
      include: {
        contact: true,
        template: { include: { variables: true } },
        phoneNumber: { include: { account: true } },
      },
    });
    if (!message) return { skipped: true };
    if (message.providerMessageId)
      return { skipped: true, reason: 'already-sent' };
    if (message.status === 'FAILED' && message.failureCode === 'OPTED_OUT') {
      return { skipped: true };
    }
    const number = message.phoneNumber ?? (await this.defaultNumber(tenantId));
    if (!number) {
      await this.failMessage(
        message.id,
        'NOT_CONNECTED',
        'WhatsApp account not connected',
      );
      return { ok: false };
    }
    const creds = this.credsFor(number.account, number.phoneNumberId);
    let result;
    if (message.type === 'TEMPLATE' && message.template) {
      const vars =
        (message.payloadJson as { variables?: Record<string, string> })
          .variables ?? {};
      const parameters = message.template.variables
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          type: 'text',
          text: vars[v.erpField] || vars[String(v.position)] || v.sample || '',
        }));
      result = await this.provider.sendTemplate(creds, {
        to: message.contact.phoneE164,
        templateName: message.template.name,
        language: message.template.language,
        components: parameters.length ? [{ type: 'body', parameters }] : [],
      });
    } else {
      result = await this.provider.sendText(creds, {
        to: message.contact.phoneE164,
        body: message.body || '',
      });
    }
    if (!result.ok) {
      await this.failMessage(
        message.id,
        result.errorCode ?? 'META_ERROR',
        result.error ?? 'Meta API error',
      );
      return result;
    }
    await this.prisma.schoolWhatsappMessage.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        providerMessageId: result.providerMessageId,
        phoneNumberId: number.id,
        sentAt: new Date(),
      },
    });
    await this.prisma.schoolWhatsappMessageStatus.upsert({
      where: { messageId_status: { messageId: message.id, status: 'SENT' } },
      create: { tenantId, messageId: message.id, status: 'SENT' },
      update: {},
    });
    await this.prisma.schoolWhatsappContact.update({
      where: { id: message.contactId },
      data: { lastOutboundAt: new Date() },
    });
    return result;
  }

  async processCampaignJob(
    tenantId: string,
    campaignId: string,
    userId?: string,
  ) {
    const campaign = await this.prisma.schoolWhatsappCampaign.findFirst({
      where: { id: campaignId, tenantId },
      include: { template: { include: { variables: true } } },
    });
    if (
      !campaign ||
      campaign.status === 'CANCELLED' ||
      campaign.status === 'PAUSED'
    ) {
      return { skipped: true };
    }
    if (!campaign.template || campaign.template.status !== 'APPROVED') {
      await this.prisma.schoolWhatsappCampaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' },
      });
      return { error: 'Template not approved' };
    }
    const recipients =
      await this.prisma.schoolWhatsappCampaignRecipient.findMany({
        where: { campaignId, status: 'QUEUED' },
        take: 40,
      });
    if (!recipients.length) {
      await this.prisma.schoolWhatsappCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { done: true };
    }
    for (const rec of recipients) {
      try {
        const contact = await this.upsertContact(
          tenantId,
          rec.phoneE164,
          rec.contactId ?? undefined,
          rec.studentId ?? undefined,
        );
        await this.assertOptIn(
          tenantId,
          contact.id,
          campaign.template.category,
        );
        const conversation = await this.ensureConversation(
          tenantId,
          contact.id,
          campaign.phoneNumberId ?? undefined,
        );
        const message = await this.prisma.schoolWhatsappMessage.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            contactId: contact.id,
            phoneNumberId: campaign.phoneNumberId,
            campaignId,
            templateId: campaign.templateId,
            direction: 'OUT',
            type: 'TEMPLATE',
            body: campaign.template.body,
            payloadJson: { campaignId } as Prisma.InputJsonValue,
            status: 'QUEUED',
            idempotencyKey: rec.idempotencyKey,
            sentBy: userId,
          },
        });
        await this.prisma.schoolWhatsappCampaignRecipient.update({
          where: { id: rec.id },
          data: {
            status: 'PROCESSING',
            messageId: message.id,
            contactId: contact.id,
          },
        });
        await this.processSendJob(tenantId, message.id);
        await this.prisma.schoolWhatsappCampaignRecipient.update({
          where: { id: rec.id },
          data: { status: 'SENT' },
        });
        await this.prisma.schoolWhatsappCampaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Failed';
        await this.prisma.schoolWhatsappCampaignRecipient.update({
          where: { id: rec.id },
          data: { status: 'FAILED', skipReason: reason },
        });
        await this.prisma.schoolWhatsappCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }
    }
    const remaining = await this.prisma.schoolWhatsappCampaignRecipient.count({
      where: { campaignId, status: 'QUEUED' },
    });
    if (remaining > 0) {
      await this.queue.add(
        'campaign',
        { tenantId, campaignId, userId },
        {
          jobId: `campaign__${campaignId}__${remaining}`,
          attempts: 3,
          delay: 400,
        },
      );
    } else {
      await this.prisma.schoolWhatsappCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
    return { remaining };
  }

  private async failMessage(id: string, code: string, reason: string) {
    await this.prisma.schoolWhatsappMessage.update({
      where: { id },
      data: {
        status: 'FAILED',
        failureCode: code,
        failureReason: reason,
        failedAt: new Date(),
      },
    });
    const msg = await this.prisma.schoolWhatsappMessage.findUnique({
      where: { id },
    });
    if (msg) {
      await this.prisma.schoolWhatsappMessageStatus.upsert({
        where: { messageId_status: { messageId: id, status: 'FAILED' } },
        create: { tenantId: msg.tenantId, messageId: id, status: 'FAILED' },
        update: {},
      });
    }
  }

  async deliveryStatus(tenantId: string, campaignId?: string) {
    return this.prisma.schoolWhatsappMessage.findMany({
      where: {
        tenantId,
        direction: 'OUT',
        ...(campaignId ? { campaignId } : {}),
      },
      include: { contact: true, template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async retryFailed(tenantId: string, messageId: string, actor: WaActor) {
    this.assert(actor, 'send');
    const message = await this.prisma.schoolWhatsappMessage.findFirst({
      where: { id: messageId, tenantId, status: 'FAILED' },
    });
    if (!message) throw new NotFoundException('Failed message not found');
    await this.prisma.schoolWhatsappMessage.update({
      where: { id: messageId },
      data: {
        status: 'QUEUED',
        failureCode: null,
        failureReason: null,
        providerMessageId: null,
      },
    });
    await this.queue.add(
      'send',
      { tenantId, messageId },
      { jobId: `retry__${messageId}__${Date.now()}`, attempts: 3 },
    );
    return { ok: true };
  }

  async listOptIns(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappOptIn.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });
  }

  async saveOptIn(tenantId: string, dto: SaveOptInDto, actor: WaActor) {
    this.assert(actor, 'manage');
    if (dto.status === 'OPTED_IN') {
      const existing = await this.prisma.schoolWhatsappOptIn.findUnique({
        where: {
          contactId_category: {
            contactId: dto.contactId,
            category: dto.category,
          },
        },
      });
      if (existing?.status === 'OPTED_OUT') {
        throw new BadRequestException(
          'Never silently re-enable an opted-out contact',
        );
      }
    }
    const row = await this.prisma.schoolWhatsappOptIn.upsert({
      where: {
        contactId_category: {
          contactId: dto.contactId,
          category: dto.category,
        },
      },
      create: {
        tenantId,
        contactId: dto.contactId,
        category: dto.category,
        status: dto.status,
        source: dto.source ?? 'OFFICE',
        consentedAt: dto.status === 'OPTED_IN' ? new Date() : null,
        optedOutAt: dto.status === 'OPTED_OUT' ? new Date() : null,
        notes: dto.notes,
      },
      update: {
        status: dto.status,
        source: dto.source ?? 'OFFICE',
        consentedAt: dto.status === 'OPTED_IN' ? new Date() : undefined,
        optedOutAt: dto.status === 'OPTED_OUT' ? new Date() : undefined,
        notes: dto.notes,
      },
    });
    await this.audit(tenantId, actor, 'OPT_IN_UPDATED', {
      recordId: row.id,
      status: dto.status,
    });
    return row;
  }

  async listAutomations(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappAutomation.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveAutomation(
    tenantId: string,
    dto: SaveAutomationDto,
    actor: WaActor,
    id?: string,
  ) {
    this.assert(actor, 'manage');
    const data = {
      name: dto.name,
      trigger: dto.trigger,
      matchValue: dto.matchValue?.toLowerCase() ?? null,
      action: dto.action,
      templateId: dto.templateId,
      replyText: dto.replyText,
      escalateTo: dto.escalateTo,
      category: dto.category ?? 'GENERAL',
      active: dto.active ?? true,
    };
    if (id) {
      await this.prisma.schoolWhatsappAutomation.update({
        where: { id },
        data,
      });
    } else {
      await this.prisma.schoolWhatsappAutomation.create({
        data: { tenantId, ...data },
      });
    }
    return this.listAutomations(tenantId);
  }

  async listMedia(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappMedia.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async registerMedia(
    tenantId: string,
    actor: WaActor,
    meta: {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      sha256?: string;
    },
  ) {
    this.assert(actor, 'manage');
    if (meta.sha256) {
      const existing = await this.prisma.schoolWhatsappMedia.findFirst({
        where: { tenantId, sha256: meta.sha256, deletedAt: null },
      });
      if (existing) return existing;
    }
    return this.prisma.schoolWhatsappMedia.create({
      data: { tenantId, ...meta, uploadedBy: actor.userId },
    });
  }

  async listFlows(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolWhatsappFlow.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveFlow(
    tenantId: string,
    dto: SaveFlowDto,
    actor: WaActor,
    id?: string,
  ) {
    this.assert(actor, 'manage');
    if (id) {
      await this.prisma.schoolWhatsappFlow.update({
        where: { id },
        data: {
          name: dto.name,
          kind: dto.kind,
          schemaJson: dto.schemaJson as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.schoolWhatsappFlow.create({
        data: {
          tenantId,
          name: dto.name,
          kind: dto.kind,
          schemaJson: (dto.schemaJson ?? {}) as Prisma.InputJsonValue,
        },
      });
    }
    return this.listFlows(tenantId);
  }

  async analytics(tenantId: string, from?: string, to?: string) {
    await this.ensureSetup(tenantId);
    const gte = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const lte = to ? new Date(to) : new Date();
    const where = {
      tenantId,
      direction: 'OUT' as const,
      createdAt: { gte, lte },
    };
    const [sent, delivered, read, failed, byUser, byTemplate] =
      await Promise.all([
        this.prisma.schoolWhatsappMessage.count({ where }),
        this.prisma.schoolWhatsappMessage.count({
          where: { ...where, deliveredAt: { not: null } },
        }),
        this.prisma.schoolWhatsappMessage.count({
          where: { ...where, readAt: { not: null } },
        }),
        this.prisma.schoolWhatsappMessage.count({
          where: { ...where, status: 'FAILED' },
        }),
        this.prisma.schoolWhatsappMessage.groupBy({
          by: ['sentBy'],
          where,
          _count: true,
        }),
        this.prisma.schoolWhatsappMessage.groupBy({
          by: ['templateId'],
          where,
          _count: true,
        }),
      ]);
    return {
      sent,
      delivered,
      read,
      failed,
      deliveryRate: sent ? delivered / sent : 0,
      readRate: sent ? read / sent : 0,
      failureRate: sent ? failed / sent : 0,
      byUser,
      byTemplate,
    };
  }

  async logs(tenantId: string) {
    return this.prisma.schoolWhatsappAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  signedPaymentUrl(tenantId: string, studentId: string) {
    const exp = Date.now() + 7 * 86400000;
    const secret = this.config.get<string>('ENCRYPTION_KEY') || 'school-wa';
    const sig = createHmac('sha256', secret)
      .update(`${tenantId}:${studentId}:${exp}`)
      .digest('hex');
    const api = this.config.get<string>('PUBLIC_WEB_URL') || '';
    return `${api}/school-sis-portal/pay?sid=${studentId}&exp=${exp}&sig=${sig}`;
  }

  async onErpEvent(
    tenantId: string,
    trigger: string,
    payload: {
      studentId?: string;
      phone?: string;
      variables?: Record<string, string>;
    },
  ) {
    const automation = await this.prisma.schoolWhatsappAutomation.findFirst({
      where: { tenantId, trigger, active: true, deletedAt: null },
    });
    if (!automation?.templateId && !payload.phone) return { skipped: true };
    return {
      queued: false,
      trigger,
      note: 'ERP event recorded for WhatsApp automation',
    };
  }
}
