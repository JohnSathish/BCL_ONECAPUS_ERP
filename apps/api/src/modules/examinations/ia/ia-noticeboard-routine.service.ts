import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { IaAdmitPdfService } from './ia-admit-pdf.service';
import {
  buildNoticeboardRowsFromPlan,
  resolveNoticeboardPattern,
} from './ia-noticeboard-grid';
import {
  DBC_TURA_NOTICE_CONTACTS,
  renderIaNoticeboardRoutineHtml,
  type IaNoticeboardRoutineInput,
} from './templates/ia-noticeboard-routine.template';

@Injectable()
export class IaNoticeboardRoutineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: IaAdmitPdfService,
  ) {}

  private async institutionContext(tenantId: string) {
    const [tenant, branding, institution] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: {
          displayName: true,
          address: true,
          logoUrl: true,
          portalSubtitle: true,
        },
      }),
      this.prisma.institution.findFirst({
        where: { tenantId, deletedAt: null },
        select: { name: true },
      }),
    ]);
    return {
      name: tenant?.name ?? 'College',
      displayName:
        branding?.displayName ??
        institution?.name ??
        tenant?.name ??
        'Don Bosco College Tura',
      address: branding?.address ?? 'Don Bosco College Tura, Meghalaya 794002',
      logoUrl:
        toPublicUploadUrl(branding?.logoUrl) ?? branding?.logoUrl ?? null,
      affiliation: branding?.portalSubtitle ?? null,
      accreditation: DBC_TURA_NOTICE_CONTACTS.accreditation,
      phone: DBC_TURA_NOTICE_CONTACTS.phone,
      mobile: DBC_TURA_NOTICE_CONTACTS.mobile,
      email: DBC_TURA_NOTICE_CONTACTS.email,
      website: DBC_TURA_NOTICE_CONTACTS.website,
    };
  }

  private yearFromSessionName(name: string, academicYearName?: string | null) {
    const fromAy = academicYearName?.match(/(20\d{2})/);
    if (fromAy) return fromAy[1];
    const fromName = name.match(/(20\d{2})/);
    return fromName?.[1] ?? String(new Date().getFullYear());
  }

  private defaultInstructions(
    _pattern: 'MORNING' | 'DAY',
    admitFromLabel: string | null,
  ): string[] {
    // Official DBC Morning First IA notice uses Arrival 9:30 AM.
    return [
      'Arrival: 9:30 AM',
      admitFromLabel
        ? `Admit Card will be issued from ${admitFromLabel}. Kindly, bring your fee book.`
        : 'Admit Card will be issued from the Examination Cell. Kindly, bring your fee book.',
      'Topics to Study: Classes taken till date.',
    ];
  }

  private toIsoDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatAdmitFrom(start: Date) {
    const d = new Date(start);
    d.setDate(d.getDate() - 6);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-IN', { month: 'long' });
    return `${day}${this.ordinal(day)} ${month} ${d.getFullYear()}`;
  }

  private ordinal(n: number) {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  async buildDocument(
    user: JwtUser,
    sessionId: string,
    options?: {
      routinePattern?: 'MORNING' | 'DAY';
      startDate?: string;
    },
  ): Promise<{
    html: string;
    filename: string;
    input: IaNoticeboardRoutineInput;
  }> {
    const session = await (this.prisma as any).examSession.findFirst({
      where: {
        id: sessionId,
        tenantId: user.tid,
        deletedAt: null,
      },
    });
    if (!session) throw new NotFoundException('IA exam not found');

    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    let shiftName = typeof meta.shiftName === 'string' ? meta.shiftName : null;
    if (!shiftName && session.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: session.shiftId, tenantId: user.tid, deletedAt: null },
        select: { name: true },
      });
      shiftName = shift?.name ?? null;
    }

    const pattern = options?.routinePattern
      ? options.routinePattern
      : resolveNoticeboardPattern(
          shiftName,
          typeof meta.routinePattern === 'string' ? meta.routinePattern : null,
        );

    // Always print the official FYUGP category plan (not raw paper schedule dates/times).
    const startIso =
      (options?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)
        ? options.startDate
        : null) ?? this.toIsoDate(session.startDate as Date | string | null);
    if (!startIso) {
      throw new BadRequestException(
        'Set Start date on IA Timetable (e.g. 2026-08-24) before printing the noticeboard routine.',
      );
    }

    const rows = buildNoticeboardRowsFromPlan(startIso, pattern);
    if (!rows.length) {
      throw new BadRequestException(
        'No timetable rows available for this examination.',
      );
    }

    const academicYearName =
      typeof meta.academicYearName === 'string' ? meta.academicYearName : null;
    const year = this.yearFromSessionName(session.name, academicYearName);
    const shiftLabel = pattern === 'MORNING' ? 'MORNING SHIFT' : 'DAY SHIFT';
    const examTitle = `FYUGP ROUTINE FOR ODD SEMESTER FIRST INTERNAL ASSESSMENT ${year}`;

    const [sy, sm, sd] = startIso.split('-').map(Number);
    const startForAdmit = new Date(sy, sm - 1, sd);
    const admitFrom = this.formatAdmitFrom(startForAdmit);

    const institution = await this.institutionContext(user.tid);
    const input: IaNoticeboardRoutineInput = {
      institution: {
        ...institution,
        logoUrl: resolvePdfImageSrc(institution.logoUrl),
      },
      examTitle,
      shiftLabel,
      academicYearLabel: academicYearName,
      rows,
      instructions: this.defaultInstructions(pattern, admitFrom),
      leftSignatory: {
        title: 'Coordinator,',
        subtitle: 'Examination cell',
      },
      rightSignatory: {
        title: DBC_TURA_NOTICE_CONTACTS.principalName,
        subtitle: 'Principal',
      },
    };

    const html = renderIaNoticeboardRoutineHtml(input);
    const filename = `FYUGP-First-IA-${year}-${pattern}-Noticeboard.pdf`;
    return { html, filename, input };
  }

  async renderHtml(
    user: JwtUser,
    sessionId: string,
    options?: { routinePattern?: 'MORNING' | 'DAY'; startDate?: string },
  ) {
    const { html } = await this.buildDocument(user, sessionId, options);
    return html;
  }

  async renderPdf(
    user: JwtUser,
    sessionId: string,
    options?: { routinePattern?: 'MORNING' | 'DAY'; startDate?: string },
  ) {
    const { html, filename } = await this.buildDocument(
      user,
      sessionId,
      options,
    );
    const pdf = await this.pdf.htmlToPdf(html);
    return { pdf, filename };
  }
}
