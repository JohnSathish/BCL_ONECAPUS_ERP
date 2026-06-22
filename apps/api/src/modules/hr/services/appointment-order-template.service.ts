import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_APPOINTMENT_BODY,
  DEFAULT_TERMS_NON_TEACHING,
  DEFAULT_TERMS_TEACHING,
} from '../templates/appointment-order.template';

const DEFAULT_TEMPLATES = [
  {
    code: 'APPT_ASSISTANT_PROFESSOR',
    name: 'Assistant Professor',
    staffType: 'TEACHING',
    bodyHtml: DEFAULT_APPOINTMENT_BODY,
    termsHtml: DEFAULT_TERMS_TEACHING,
  },
  {
    code: 'APPT_NON_TEACHING',
    name: 'Non-Teaching Staff',
    staffType: 'NON_TEACHING',
    bodyHtml: DEFAULT_APPOINTMENT_BODY,
    termsHtml: DEFAULT_TERMS_NON_TEACHING,
  },
  {
    code: 'APPT_CONTRACT_FACULTY',
    name: 'Contract Faculty',
    staffType: 'TEACHING',
    bodyHtml: DEFAULT_APPOINTMENT_BODY,
    termsHtml: DEFAULT_TERMS_TEACHING,
  },
  {
    code: 'APPT_GUEST_LECTURER',
    name: 'Guest Lecturer',
    staffType: 'GUEST',
    bodyHtml: DEFAULT_APPOINTMENT_BODY,
    termsHtml: DEFAULT_TERMS_TEACHING,
  },
];

@Injectable()
export class AppointmentOrderTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string) {
    return this.db().appointmentOrderTemplate.findMany({
      where: { tenantId, isActive: true },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async seedDefaults(tenantId: string) {
    for (const [index, tpl] of DEFAULT_TEMPLATES.entries()) {
      const template = await this.db().appointmentOrderTemplate.upsert({
        where: { tenantId_code: { tenantId, code: tpl.code } },
        create: {
          tenantId,
          code: tpl.code,
          name: tpl.name,
          staffType: tpl.staffType,
          sortOrder: index,
        },
        update: { name: tpl.name, staffType: tpl.staffType },
      });

      const existingVersion =
        await this.db().appointmentOrderTemplateVersion.findFirst({
          where: { tenantId, templateId: template.id, isActive: true },
        });
      if (!existingVersion) {
        await this.db().appointmentOrderTemplateVersion.create({
          data: {
            tenantId,
            templateId: template.id,
            versionNo: 1,
            bodyHtml: `${tpl.bodyHtml}\n{{terms_block}}`,
            isActive: true,
          },
        });
      }
    }
    return this.list(tenantId);
  }
}
