import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { officialDb } from './utils/official-documents-prisma.util';

const DEFAULT_ISSUERS = [
  {
    roleCode: 'PRINCIPAL',
    name: 'Fr. Principal SDB',
    designation: 'Principal cum Secretary',
    refPrefix: 'DBCT/PR',
    sortOrder: 1,
  },
  {
    roleCode: 'VICE_PRINCIPAL',
    name: 'Fr. John Paul Tirkey SDB',
    designation: 'Vice Principal',
    refPrefix: 'DBCT/JP',
    sortOrder: 2,
  },
  {
    roleCode: 'REGISTRAR',
    name: 'Registrar',
    designation: 'Registrar',
    refPrefix: 'DBCT/REG',
    sortOrder: 3,
  },
  {
    roleCode: 'CONTROLLER',
    name: 'Controller of Examinations',
    designation: 'Controller of Examinations',
    refPrefix: 'DBCT/COE',
    sortOrder: 4,
  },
  {
    roleCode: 'IQAC',
    name: 'IQAC Coordinator',
    designation: 'IQAC Coordinator',
    refPrefix: 'DBCT/IQAC',
    sortOrder: 5,
  },
  {
    roleCode: 'HR',
    name: 'HR Office',
    designation: 'Human Resources',
    refPrefix: 'DBCT/HR',
    sortOrder: 6,
  },
];

const DEFAULT_TEMPLATES = [
  {
    documentType: 'HOLIDAY',
    name: 'Holiday Notice',
    salutation: 'Dear Faculty members and Students',
    bodyHtml:
      '<p>It is hereby notified that the college shall remain closed on <strong>{{Today}}</strong> on account of <strong>[Holiday Reason]</strong>. All concerned are requested to take note of the same.</p>',
    sortOrder: 1,
  },
  {
    documentType: 'MEETING_NOTICE',
    name: 'Meeting Notice',
    salutation: 'Dear Faculty members',
    bodyHtml:
      '<p>You are hereby informed that a meeting of all Heads of Departments will be held on <strong>[Date]</strong> at <strong>[Time]</strong> in <strong>[Venue]</strong>. Attendance is mandatory.</p>',
    sortOrder: 2,
  },
  {
    documentType: 'EXAM',
    name: 'Examination Notice',
    salutation: 'Dear Students',
    bodyHtml:
      '<p>This is to notify all students of <strong>[Programme/Semester]</strong> that the examination schedule will commence as per the attached timetable. Students must carry their identity cards.</p>',
    sortOrder: 3,
  },
  {
    documentType: 'CIRCULAR',
    name: 'General Circular',
    salutation: 'Dear All',
    bodyHtml:
      '<p>Please be informed that <strong>[Subject matter]</strong>.</p>',
    sortOrder: 4,
  },
  {
    documentType: 'OFFICE_ORDER',
    name: 'Office Order',
    salutation: 'To',
    bodyHtml:
      '<p>Whereas <strong>[context]</strong>, the following order is issued with immediate effect:</p><p><strong>[Order details]</strong></p>',
    sortOrder: 5,
  },
  {
    documentType: 'MEMORANDUM',
    name: 'Memorandum',
    salutation: 'To',
    bodyHtml:
      '<p><strong>Subject:</strong> [Subject]</p><p>[Memorandum body]</p>',
    sortOrder: 6,
  },
  {
    documentType: 'APPOINTMENT_ORDER',
    name: 'Appointment Order Shell',
    salutation: 'To',
    bodyHtml:
      '<p>With reference to your application, you are hereby appointed as <strong>[Designation]</strong> with effect from <strong>[Date]</strong>.</p>',
    sortOrder: 7,
  },
  {
    documentType: 'NOTICE',
    name: 'General Notice',
    salutation: 'Dear Faculty members and Students',
    bodyHtml: '<p>[Notice content]</p>',
    sortOrder: 8,
  },
  {
    documentType: 'TENDER',
    name: 'Tender Notice',
    salutation: 'To',
    bodyHtml:
      '<p>Sealed tenders are invited for <strong>[Item/Service]</strong>. Last date for submission: <strong>[Date]</strong>.</p>',
    sortOrder: 9,
  },
  {
    documentType: 'URGENT',
    name: 'Urgent Notice',
    salutation: 'Dear All',
    bodyHtml:
      '<p><strong>URGENT:</strong> [Immediate instruction or announcement]. All concerned must comply without delay.</p>',
    sortOrder: 10,
  },
];

@Injectable()
export class OfficialDocumentsSeedService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return officialDb(this.prisma);
  }

  async seedTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      include: { branding: true },
    });
    const collegeName =
      tenant?.branding?.displayName ?? tenant?.name ?? 'Don Bosco College';
    const addressLine =
      tenant?.branding?.address?.trim() || 'Tura, Meghalaya – 794002';
    const logoPath = tenant?.branding?.logoUrl ?? null;

    await this.db().officialDocumentSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        defaultPrefix: 'DBC',
        referencePattern: '{PREFIX}/{TYPE}/{YEAR}/{SEQ:4}',
        verifyBaseUrl: 'https://portal.donboscocollege.ac.in',
      },
      update: {},
    });

    let letterhead = await this.db().officialLetterhead.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (!letterhead) {
      letterhead = await this.db().officialLetterhead.create({
        data: {
          tenantId,
          code: 'DEFAULT',
          name: 'Default DBC Letterhead',
          collegeName,
          addressLine,
          contactLine:
            'Mobile: 9678402086 | Email: viceprincipal@donboscocollege.ac.in | Website: www.donboscocollege.ac.in',
          logoPath,
          isDefault: true,
        },
      });
    } else if (!letterhead.logoPath && logoPath) {
      letterhead = await this.db().officialLetterhead.update({
        where: { id: letterhead.id },
        data: { logoPath, collegeName, addressLine },
      });
    }

    for (const issuer of DEFAULT_ISSUERS) {
      await this.db().officialDocumentIssuer.upsert({
        where: {
          tenantId_roleCode: { tenantId, roleCode: issuer.roleCode },
        },
        create: {
          tenantId,
          ...issuer,
          letterheadId: letterhead.id,
        },
        update: {
          letterheadId: letterhead.id,
        },
      });
    }

    for (const tpl of DEFAULT_TEMPLATES) {
      const existing = await this.db().officialDocumentTemplate.findFirst({
        where: { tenantId, name: tpl.name },
      });
      if (!existing) {
        await this.db().officialDocumentTemplate.create({
          data: { tenantId, ...tpl, title: tpl.name },
        });
      }
    }
  }
}
