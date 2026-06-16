import {
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

const DEFAULT_TEMPLATES: CommunicationTemplateDto[] = [
  {
    code: 'ADMISSION_SUBMITTED',
    name: 'Admission Application Submitted',
    category: 'ADMISSIONS',
    subject: 'Application received — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>We have received your admission application ({{application_number}}) for {{program_name}}.</p>',
    bodyText:
      'Dear {{student_name}}, your application {{application_number}} for {{program_name}} has been received.',
    variables: [
      'student_name',
      'application_number',
      'program_name',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMISSION_REJECTED',
    name: 'Admission Application Rejected',
    category: 'ADMISSIONS',
    subject: 'Application update — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>We regret to inform you that your application ({{application_number}}) was not successful at this time.</p>',
    bodyText:
      'Dear {{student_name}}, your application {{application_number}} was not successful.',
    variables: [
      'student_name',
      'application_number',
      'program_name',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMISSION_CONFIRMATION',
    name: 'Admission Confirmation',
    category: 'ADMISSIONS',
    subject: 'Admission confirmed — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your admission to {{program_name}} has been confirmed. Application no: {{application_number}}.</p>',
    bodyText:
      'Dear {{student_name}}, your admission to {{program_name}} has been confirmed.',
    variables: [
      'student_name',
      'program_name',
      'application_number',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'APPLICANT_REGISTERED',
    name: 'Applicant Registration',
    category: 'ADMISSIONS',
    subject: 'Your application number — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your application number is <strong>{{application_number}}</strong>. Temporary password: {{temp_password}}</p>',
    bodyText:
      'Dear {{student_name}}, application number {{application_number}}. Password: {{temp_password}}',
    variables: [
      'student_name',
      'application_number',
      'temp_password',
      'institution_name',
    ],
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  {
    code: 'APPLICATION_SUBMITTED',
    name: 'Application Submitted (Portal)',
    category: 'ADMISSIONS',
    subject: 'Application submitted — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your application {{application_number}} for {{program_name}} has been submitted successfully.</p>',
    bodyText:
      'Dear {{student_name}}, application {{application_number}} submitted.',
    variables: [
      'student_name',
      'application_number',
      'program_name',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'APPLICANT_PASSWORD_RESET',
    name: 'Applicant Password Reset',
    category: 'ADMISSIONS',
    subject: 'Reset your admission portal password — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>We received a request to reset the password for application <strong>{{application_number}}</strong>.</p><p><a href="{{reset_link}}">Click here to set a new password</a>. This link expires in {{expiry_minutes}} minutes.</p><p>If you did not request this, you can ignore this email.</p>',
    bodyText:
      'Dear {{student_name}}, reset your admission portal password for {{application_number}}: {{reset_link}} (expires in {{expiry_minutes}} minutes).',
    variables: [
      'student_name',
      'application_number',
      'reset_link',
      'expiry_minutes',
      'institution_name',
    ],
    channels: ['EMAIL'],
  },
  {
    code: 'APPLICATION_STATUS_CHANGED',
    name: 'Application Status Changed',
    category: 'ADMISSIONS',
    subject: 'Application status update — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your application {{application_number}} status is now: {{status}}.</p>',
    bodyText:
      'Dear {{student_name}}, application {{application_number}} status: {{status}}.',
    variables: [
      'student_name',
      'application_number',
      'status',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'FEE_REMINDER',
    name: 'Fee Reminder',
    category: 'FEES',
    subject: 'Fee due reminder — {{due_date}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your fee of {{amount}} is due on {{due_date}}.</p>',
    bodyText:
      'Dear {{student_name}}, fee of {{amount}} is due on {{due_date}}.',
    variables: ['student_name', 'amount', 'due_date', 'demand_no'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'BACKUP_SUCCESS',
    name: 'Backup Completed Successfully',
    category: 'GENERAL',
    subject: 'Backup completed — {{institution_name}}',
    bodyHtml:
      '<p>Backup <strong>{{backup_type}}</strong> completed at {{completed_at}}.</p><p>Size: {{size_bytes}} · Run: {{run_id}}</p>',
    bodyText:
      'Backup {{backup_type}} completed at {{completed_at}}. Size: {{size_bytes}}. Run: {{run_id}}',
    variables: [
      'institution_name',
      'backup_type',
      'completed_at',
      'size_bytes',
      'run_id',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'BACKUP_FAILED',
    name: 'Backup Failed',
    category: 'GENERAL',
    subject: 'Backup failed — {{institution_name}}',
    bodyHtml:
      '<p>Backup <strong>{{backup_type}}</strong> failed at {{completed_at}}.</p><p>{{error_message}}</p>',
    bodyText:
      'Backup {{backup_type}} failed at {{completed_at}}. {{error_message}}',
    variables: [
      'institution_name',
      'backup_type',
      'completed_at',
      'size_bytes',
      'run_id',
      'error_message',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'FEE_RECEIPT',
    name: 'Fee Payment Receipt',
    category: 'FEES',
    subject: 'Fee receipt {{receipt_no}} — {{institution_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Thank you for your payment of <strong>₹{{amount}}</strong>.</p><p>Receipt No: <strong>{{receipt_no}}</strong><br/>Date: {{paid_date}}<br/>Mode: {{payment_mode}}</p><p><a href="{{verify_url}}">Verify receipt online</a></p>',
    bodyText:
      'Dear {{student_name}}, fee receipt {{receipt_no}} for Rs {{amount}} ({{payment_mode}}) dated {{paid_date}}. {{institution_name}}',
    variables: [
      'student_name',
      'receipt_no',
      'amount',
      'payment_mode',
      'paid_date',
      'enrollment_number',
      'programme',
      'institution_name',
      'verify_url',
    ],
    channels: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'],
  },
  {
    code: 'TIMETABLE_PUBLISHED',
    name: 'Timetable Published',
    category: 'ACADEMICS',
    subject: 'Timetable published — {{plan_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>The timetable <strong>{{plan_name}}</strong> for {{shift_name}} ({{semester}}) has been published.</p>',
    bodyText:
      'Dear {{student_name}}, timetable {{plan_name}} for {{shift_name}} has been published.',
    variables: [
      'student_name',
      'plan_name',
      'shift_name',
      'semester',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'EXAM_RESULTS_PUBLISHED',
    name: 'Exam Results Published',
    category: 'EXAMINATIONS',
    subject: 'Results published — {{exam_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Results for <strong>{{exam_name}}</strong> ({{session_name}}) are now available in the portal.</p>',
    bodyText:
      'Dear {{student_name}}, results for {{exam_name}} are now available.',
    variables: [
      'student_name',
      'exam_name',
      'session_name',
      'publish_date',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'EXAM_NOTICE',
    name: 'Exam Notice',
    category: 'EXAMINATIONS',
    subject: 'Examination notice — {{exam_name}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>{{exam_name}} is scheduled on {{exam_date}}.</p>',
    bodyText: 'Dear {{student_name}}, {{exam_name}} is on {{exam_date}}.',
    variables: ['student_name', 'exam_name', 'exam_date'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'CERTIFICATE_READY',
    name: 'Certificate Ready',
    category: 'CERTIFICATES',
    subject: 'Your {{certificate_type}} is ready',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your {{certificate_type}} has been issued and is available in the portal.</p>',
    bodyText: 'Dear {{student_name}}, your {{certificate_type}} is ready.',
    variables: ['student_name', 'certificate_type', 'certificate_number'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LIBRARY_OVERDUE',
    name: 'Library Book Overdue',
    category: 'LIBRARY',
    subject: 'Overdue library book — {{book_title}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your loan for <strong>{{book_title}}</strong> was due on {{due_date}}. Please return it to the library.</p>',
    bodyText:
      'Dear {{student_name}}, please return {{book_title}} (due {{due_date}}).',
    variables: ['student_name', 'book_title', 'due_date', 'institution_name'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LIBRARY_RESERVATION_READY',
    name: 'Library Reservation Ready',
    category: 'LIBRARY',
    subject: 'Reserved book available — {{book_title}}',
    bodyHtml:
      '<p>Dear {{student_name}},</p><p>Your reserved book <strong>{{book_title}}</strong> is now available for collection at the library.</p>',
    bodyText: 'Dear {{student_name}}, {{book_title}} is ready for collection.',
    variables: ['student_name', 'book_title', 'institution_name'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_ASSIGNED',
    name: 'Transport Route Assigned',
    category: 'TRANSPORT',
    subject: 'Bus route assigned — {{route_code}}',
    bodyHtml:
      '<p>Dear parent/guardian,</p><p>{{student_name}} has been assigned to route <strong>{{route_code}} — {{route_name}}</strong>. Pickup stop: {{stop_name}} ({{pickup_time}}). Driver: {{driver_name}} ({{driver_mobile}}).</p>',
    bodyText:
      '{{student_name}} assigned to {{route_code}} — stop {{stop_name}} at {{pickup_time}}.',
    variables: [
      'student_name',
      'route_code',
      'route_name',
      'stop_name',
      'pickup_time',
      'driver_name',
      'driver_mobile',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_CANCELLED',
    name: 'Transport Assignment Cancelled',
    category: 'TRANSPORT',
    subject: 'Bus route cancelled — {{route_code}}',
    bodyHtml:
      '<p>Dear parent/guardian,</p><p>The transport assignment for {{student_name}} on route <strong>{{route_code}}</strong> has been cancelled.</p>',
    bodyText:
      'Transport for {{student_name}} on {{route_code}} has been cancelled.',
    variables: ['student_name', 'route_code', 'route_name', 'institution_name'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_CAPACITY_WARNING',
    name: 'Transport Route Capacity Warning',
    category: 'TRANSPORT',
    subject: 'Route capacity alert — {{route_code}}',
    bodyHtml:
      '<p>Route <strong>{{route_code}} — {{route_name}}</strong> is at {{assigned}}/{{capacity}} seats.</p>',
    bodyText: 'Route {{route_code}} is at {{assigned}}/{{capacity}} seats.',
    variables: [
      'route_code',
      'route_name',
      'assigned',
      'capacity',
      'institution_name',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'GENERAL_ANNOUNCEMENT',
    name: 'General Announcement',
    category: 'GENERAL',
    subject: '{{subject}}',
    bodyHtml: '<p>{{message}}</p>',
    bodyText: '{{message}}',
    variables: ['subject', 'message'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_60',
    name: 'License Expiry — 60 Days',
    category: 'GENERAL',
    subject: 'ERP license renewal reminder — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Please contact {{renewal_contact}} to renew.</p>',
    bodyText:
      'ERP license for {{institution_name}} expires {{expiry_date}} ({{days_remaining}} days). Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_30',
    name: 'License Expiry — 30 Days',
    category: 'GENERAL',
    subject: 'ERP license expires in 30 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> expires on {{expiry_date}} ({{days_remaining}} days remaining). Renewal is recommended.</p><p>Contact {{renewal_contact}}.</p>',
    bodyText:
      'License for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_15',
    name: 'License Expiry — 15 Days',
    category: 'GENERAL',
    subject: 'Urgent: ERP license expires in 15 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p><strong>Urgent:</strong> Your ERP license for {{institution_name}} expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Contact {{renewal_contact}} immediately.</p>',
    bodyText:
      'Urgent: License for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_7',
    name: 'License Expiry — 7 Days',
    category: 'GENERAL',
    subject: 'Critical: ERP license expires in 7 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p><strong>Critical:</strong> Your ERP license for {{institution_name}} expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Contact {{renewal_contact}} immediately to avoid disruption.</p>',
    bodyText:
      'Critical: License for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_0',
    name: 'License Expired',
    category: 'GENERAL',
    subject: 'ERP license expired — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> has expired (expiry date: {{expiry_date}}).</p><p>Please contact {{renewal_contact}} immediately to restore full access.</p>',
    bodyText:
      'License for {{institution_name}} has expired. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
];

@Injectable()
export class CommunicationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.communicationTemplate.create({
      data: {
        tenantId: user.tid,
        code: dto.code.toUpperCase(),
        name: dto.name,
        category: dto.category ?? 'GENERAL',
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        variables: dto.variables ?? [],
        channels: dto.channels ?? ['EMAIL', 'IN_APP'],
        isActive: dto.isActive ?? true,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateCommunicationTemplateDto) {
    await this.get(user.tid, id);
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
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
      const row = await this.prisma.communicationTemplate.upsert({
        where: {
          tenantId_code: { tenantId: user.tid, code: tpl.code },
        },
        create: {
          tenantId: user.tid,
          code: tpl.code,
          name: tpl.name,
          category: tpl.category,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          bodyText: tpl.bodyText,
          variables: tpl.variables,
          channels: tpl.channels,
          createdById: user.sub,
        },
        update: {},
      });
      created.push(row);
    }
    return created;
  }
}
