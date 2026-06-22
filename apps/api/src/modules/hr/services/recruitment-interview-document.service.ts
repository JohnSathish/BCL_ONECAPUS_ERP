import { Injectable, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildBulkInterviewCallLettersHtml,
  buildInterviewCallLetterHtml,
} from '../templates/interview-call-letter.template';

type InterviewRow = {
  id: string;
  scheduledAt: Date;
  venue?: string | null;
  panelJson?: unknown;
  application: {
    applicationNo?: string | null;
    fullName: string;
    fatherName?: string | null;
    addressJson?: unknown;
    vacancy?: {
      title: string;
      department?: { name: string } | null;
      instructionsHtml?: string | null;
      eligibilityJson?: unknown;
    } | null;
  };
};

@Injectable()
export class RecruitmentInterviewDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  private async branding(tenantId: string) {
    const row = await this.prisma.tenantBranding.findFirst({
      where: { tenantId },
    });
    return {
      collegeName: row?.displayName ?? 'Don Bosco College, Tura',
      collegeAddress: row?.address ?? 'Tura, West Garo Hills, Meghalaya',
    };
  }

  private panelMembers(panelJson: unknown) {
    if (!panelJson || typeof panelJson !== 'object') return '';
    const members = (panelJson as { members?: string[] }).members;
    return members?.filter(Boolean).join(', ') ?? '';
  }

  private addressText(addressJson: unknown) {
    if (!addressJson || typeof addressJson !== 'object') return '';
    const a = addressJson as { line1?: string; city?: string };
    return [a.line1, a.city].filter(Boolean).join(', ');
  }

  private selectionCommittee(eligibilityJson: unknown) {
    if (!eligibilityJson || typeof eligibilityJson !== 'object') return '';
    const committee = (
      eligibilityJson as { selectionCommittee?: { members?: string[] } }
    ).selectionCommittee;
    return committee?.members?.filter(Boolean).join(', ') ?? '';
  }

  buildHtml(
    tenantId: string,
    interview: InterviewRow,
    branding: Awaited<ReturnType<typeof this.branding>>,
  ) {
    const ref = `INT/${interview.application.applicationNo ?? interview.id.slice(0, 8).toUpperCase()}`;
    const committee = this.selectionCommittee(
      interview.application.vacancy?.eligibilityJson,
    );
    const panel =
      this.panelMembers(interview.panelJson) ||
      committee ||
      'As notified by the Selection Committee';

    return buildInterviewCallLetterHtml({
      collegeName: branding.collegeName,
      collegeAddress: branding.collegeAddress,
      referenceNo: ref,
      letterDate: new Date().toLocaleDateString('en-IN'),
      candidateName: interview.application.fullName,
      fatherName: interview.application.fatherName ?? undefined,
      addressText: this.addressText(interview.application.addressJson),
      applicationNo: interview.application.applicationNo ?? '—',
      vacancyTitle: interview.application.vacancy?.title ?? 'Vacancy',
      department: interview.application.vacancy?.department?.name,
      interviewDate: interview.scheduledAt.toLocaleString('en-IN'),
      interviewVenue: interview.venue ?? 'Don Bosco College, Tura',
      panelMembers: panel,
      instructions:
        interview.application.vacancy?.instructionsHtml ?? undefined,
    });
  }

  async getInterview(tenantId: string, interviewId: string) {
    const interview = await this.prisma.recruitmentInterview.findFirst({
      where: { id: interviewId, tenantId },
      include: {
        application: {
          include: {
            vacancy: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  async previewHtml(tenantId: string, interviewId: string) {
    const interview = await this.getInterview(tenantId, interviewId);
    const brand = await this.branding(tenantId);
    return this.buildHtml(tenantId, interview as InterviewRow, brand);
  }

  async pdfBuffer(tenantId: string, interviewId: string) {
    const html = await this.previewHtml(tenantId, interviewId);
    const interview = await this.getInterview(tenantId, interviewId);
    const buffer = await this.renderPdf(html);
    const name = interview.application.fullName.replace(/[^a-z0-9]+/gi, '-');
    return {
      buffer,
      filename: `interview-call-${name}.pdf`,
    };
  }

  async bulkPdfForDate(tenantId: string, dateIso: string) {
    const day = new Date(dateIso);
    if (Number.isNaN(day.getTime())) {
      throw new NotFoundException('Invalid date');
    }
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const interviews = await this.prisma.recruitmentInterview.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: start, lt: end },
      },
      include: {
        application: {
          include: {
            vacancy: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (!interviews.length)
      throw new NotFoundException('No interviews on this date');

    const brand = await this.branding(tenantId);
    const letters = interviews.map((iv) =>
      this.buildHtml(tenantId, iv as InterviewRow, brand),
    );
    const html = buildBulkInterviewCallLettersHtml(letters);
    const buffer = await this.renderPdf(html);
    return {
      buffer,
      filename: `interview-call-letters-${dateIso.slice(0, 10)}.pdf`,
      count: interviews.length,
    };
  }

  private async renderPdf(html: string) {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      return Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        }),
      );
    } finally {
      await browser.close();
    }
  }
}
