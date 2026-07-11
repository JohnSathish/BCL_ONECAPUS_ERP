import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  CommunicationTemplateDto,
  UpdateCommunicationTemplateDto,
} from '../dto/communication.dto';
import {
  DEFAULT_COMMUNICATION_TEMPLATES,
  findDefaultTemplateByCode,
} from '../data/default-communication-templates';
import { BrandedEmailLayoutService } from './branded-email-layout.service';
import { CommunicationTemplateRendererService } from './communication-template-renderer.service';
import { CommunicationEmailService } from './communication-email.service';
import {
  SAMPLE_EMAIL_VARIABLES,
  htmlToPlainText,
} from '../utils/email-template-helpers';

/** HR recruitment templates preserved from legacy seed catalog. */
const HR_TEMPLATES: CommunicationTemplateDto[] = [
  {
    code: 'RECRUITMENT_APPLICATION_RECEIVED',
    name: 'Application Received',
    category: 'HR',
    subject: 'Application received — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>We have received your application <strong>{{application_no}}</strong> for <strong>{{vacancy_title}}</strong> at {{institution_name}}.</p>',
    bodyText:
      'Dear {{candidate_name}}, application {{application_no}} for {{vacancy_title}} received.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_INTERVIEW_CALL',
    name: 'Interview Call Letter',
    category: 'HR',
    subject: 'Interview scheduled — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Interview for <strong>{{vacancy_title}}</strong> on <strong>{{interview_date}}</strong> at {{interview_venue}}.</p>',
    bodyText:
      'Interview for {{vacancy_title}} on {{interview_date}} at {{interview_venue}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'interview_date',
      'interview_venue',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_SELECTED',
    name: 'Selection Notice',
    category: 'HR',
    subject: 'Selected for {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Congratulations! You have been selected for <strong>{{vacancy_title}}</strong> at {{institution_name}}.</p>',
    bodyText: 'Selected for {{vacancy_title}} at {{institution_name}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_REJECTED',
    name: 'Rejection Notice',
    category: 'HR',
    subject: 'Application update — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Thank you for applying for <strong>{{vacancy_title}}</strong>. We will not be proceeding at this time.</p>',
    bodyText: 'Application for {{vacancy_title}} not successful.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'rejection_reason',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_INTERVIEW_REMINDER',
    name: 'Interview Reminder',
    category: 'HR',
    subject: 'Reminder: Interview — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Reminder: interview for <strong>{{vacancy_title}}</strong> on <strong>{{interview_date}}</strong> at {{interview_venue}}.</p>',
    bodyText: 'Interview reminder for {{vacancy_title}} on {{interview_date}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'interview_date',
      'interview_venue',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_DOCUMENTS_PENDING',
    name: 'Documents Required',
    category: 'HR',
    subject: 'Documents required — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Please submit pending documents for application <strong>{{application_no}}</strong>.</p><p>{{document_message}}</p>',
    bodyText:
      'Documents required for application {{application_no}}. {{document_message}}',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'document_message',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_JOINING_REMINDER',
    name: 'Joining Date Reminder',
    category: 'HR',
    subject: 'Joining reminder — {{joining_date}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Joining date for <strong>{{vacancy_title}}</strong> is <strong>{{joining_date}}</strong>.</p>',
    bodyText: 'Joining reminder for {{vacancy_title}} on {{joining_date}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'joining_date',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_APPOINTMENT_SENT',
    name: 'Appointment Order Issued',
    category: 'HR',
    subject: 'Appointment order — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Appointment order <strong>{{order_no}}</strong> for <strong>{{vacancy_title}}</strong> has been issued. Joining: <strong>{{joining_date}}</strong>.</p>',
    bodyText:
      'Appointment order {{order_no}} issued. Joining date {{joining_date}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'order_no',
      'joining_date',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_STATUS_UPDATE',
    name: 'Application Status Update',
    category: 'HR',
    subject: 'Application update — {{vacancy_title}}',
    bodyHtml:
      '<p>Dear {{candidate_name}},</p><p>Application <strong>{{application_no}}</strong> status: <strong>{{status_label}}</strong>.</p>',
    bodyText:
      'Application {{application_no}} status: {{status_label}} for {{vacancy_title}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'status_label',
      'institution_name',
    ],
    channels: ['EMAIL', 'WHATSAPP'],
  },
  {
    code: 'RECRUITMENT_HR_NEW_APPLICATION',
    name: 'HR — New Application',
    category: 'HR',
    subject: 'New application — {{vacancy_title}}',
    bodyHtml:
      '<p>New careers application:</p><ul><li>Candidate: {{candidate_name}}</li><li>No: {{application_no}}</li><li>Position: {{vacancy_title}}</li></ul>',
    bodyText:
      'New application {{application_no}} — {{candidate_name}} for {{vacancy_title}}.',
    variables: [
      'candidate_name',
      'application_no',
      'vacancy_title',
      'candidate_mobile',
      'candidate_email',
      'institution_name',
    ],
    channels: ['EMAIL'],
  },
];

export const DEFAULT_TEMPLATES: CommunicationTemplateDto[] = [
  ...DEFAULT_COMMUNICATION_TEMPLATES,
  ...HR_TEMPLATES,
];

@Injectable()
export class CommunicationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: CommunicationTemplateRendererService,
    private readonly brandedLayout: BrandedEmailLayoutService,
    private readonly email: CommunicationEmailService,
  ) {}

  list(tenantId: string, category?: string) {
    return this.prisma.communicationTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  async create(user: JwtUser, dto: CommunicationTemplateDto) {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: { tenantId: user.tid, code: dto.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Template code already exists');

    const bodyHtml = dto.bodyHtml ?? '';
    const bodyText =
      dto.bodyText ?? (bodyHtml ? htmlToPlainText(bodyHtml) : '');

    return this.prisma.communicationTemplate.create({
      data: {
        tenantId: user.tid,
        code: dto.code.toUpperCase(),
        name: dto.name,
        category: dto.category ?? 'GENERAL',
        subject: dto.subject,
        bodyHtml,
        bodyText,
        variables: dto.variables ?? [],
        channels: dto.channels ?? ['EMAIL', 'IN_APP'],
        isActive: dto.isActive ?? true,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateCommunicationTemplateDto) {
    await this.get(user.tid, id);
    const bodyHtml = dto.bodyHtml;
    const bodyText =
      dto.bodyText ??
      (typeof bodyHtml === 'string' ? htmlToPlainText(bodyHtml) : undefined);
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText,
        variables: dto.variables,
        channels: dto.channels,
        isActive: dto.isActive,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    await this.get(user.tid, id);
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async seedDefaults(user: JwtUser) {
    const created = [];
    for (const tpl of DEFAULT_TEMPLATES) {
      const forceRefresh =
        tpl.code === 'BACKUP_SUCCESS' || tpl.code === 'BACKUP_FAILED';
      const row = await this.prisma.communicationTemplate.upsert({
        where: {
          tenantId_code: { tenantId: user.tid, code: tpl.code },
        },
        create: {
          tenantId: user.tid,
          code: tpl.code,
          name: tpl.name,
          category: tpl.category ?? 'GENERAL',
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          bodyText: tpl.bodyText,
          variables: tpl.variables ?? [],
          channels: tpl.channels ?? ['EMAIL', 'IN_APP'],
          createdById: user.sub,
        },
        update: forceRefresh
          ? {
              name: tpl.name,
              category: tpl.category ?? 'ADMIN',
              subject: tpl.subject,
              bodyHtml: tpl.bodyHtml,
              bodyText: tpl.bodyText,
              variables: tpl.variables ?? [],
            }
          : {},
      });
      created.push(row);
    }
    return created;
  }

  async preview(
    tenantId: string,
    input: {
      templateId?: string;
      subject?: string;
      bodyHtml?: string;
      title?: string;
      sampleData?: Record<string, string>;
    },
  ) {
    let subject = input.subject ?? '';
    let bodyHtml = input.bodyHtml ?? '';
    let title = input.title ?? '';

    if (input.templateId) {
      const tpl = await this.get(tenantId, input.templateId);
      subject = subject || tpl.subject || tpl.name;
      bodyHtml = bodyHtml || tpl.bodyHtml || '';
      title = title || tpl.name;
    }

    if (!subject && !bodyHtml) {
      throw new BadRequestException('Provide templateId or subject/bodyHtml');
    }

    const ctx = await this.brandedLayout.resolveContext(tenantId);
    const brandingVars = this.brandedLayout.brandingVariables(ctx);
    const variables = {
      ...SAMPLE_EMAIL_VARIABLES,
      ...brandingVars,
      ...(input.sampleData ?? {}),
    };
    const rendered = this.renderer.renderAll(
      { subject, bodyHtml, bodyText: htmlToPlainText(bodyHtml) },
      variables,
    );
    const emailTitle = rendered.subject || title || 'Notification';
    const wrapped = this.brandedLayout.wrap({
      title: emailTitle,
      bodyHtml: rendered.bodyHtml,
      ctx,
    });

    return {
      subject: emailTitle,
      html: wrapped,
      bodyHtml: rendered.bodyHtml,
      variables,
    };
  }

  async duplicate(user: JwtUser, id: string) {
    const source = await this.get(user.tid, id);
    const baseCode = `${source.code}_COPY`.slice(0, 70);
    let code = baseCode;
    let n = 1;
    while (
      await this.prisma.communicationTemplate.findFirst({
        where: { tenantId: user.tid, code, deletedAt: null },
      })
    ) {
      n += 1;
      code = `${baseCode}_${n}`.slice(0, 80);
    }

    return this.prisma.communicationTemplate.create({
      data: {
        tenantId: user.tid,
        code,
        name: `${source.name} (Copy)`,
        category: source.category,
        subject: source.subject,
        bodyHtml: source.bodyHtml,
        bodyText: source.bodyText,
        variables: source.variables as string[],
        channels: source.channels as string[],
        isActive: true,
        createdById: user.sub,
      },
    });
  }

  async restoreDefault(user: JwtUser, id: string) {
    const row = await this.get(user.tid, id);
    const def =
      findDefaultTemplateByCode(row.code) ??
      DEFAULT_TEMPLATES.find((t) => t.code === row.code);
    if (!def) {
      throw new NotFoundException(
        `No default catalog entry for code ${row.code}`,
      );
    }
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: def.name,
        category: def.category ?? row.category,
        subject: def.subject,
        bodyHtml: def.bodyHtml,
        bodyText: def.bodyText,
        variables: def.variables ?? [],
        channels: def.channels ?? ['EMAIL', 'IN_APP'],
        isActive: true,
      },
    });
  }

  async testSend(user: JwtUser, id: string, toEmail?: string) {
    const preview = await this.preview(user.tid, { templateId: id });
    const actor = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tid, deletedAt: null },
      select: { email: true },
    });
    const to = (toEmail ?? actor?.email ?? '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      throw new BadRequestException('A valid recipient email is required');
    }

    const ctx = await this.brandedLayout.resolveContext(user.tid);
    const result = await this.email.send({
      to,
      subject: `[TEST] ${preview.subject}`,
      html: preview.html,
      text: htmlToPlainText(preview.bodyHtml),
      fromName: ctx.senderName ?? ctx.institutionName,
      replyTo: ctx.replyEmail,
    });

    if (!result.ok) {
      throw new BadRequestException(
        result.error ?? 'Failed to send test email',
      );
    }

    return {
      ok: true,
      to,
      provider: result.provider,
      providerRef: result.providerRef,
    };
  }
}
