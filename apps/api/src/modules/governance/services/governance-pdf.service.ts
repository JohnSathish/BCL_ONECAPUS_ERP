import { Injectable, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { renderGovernanceMomHtml } from '../templates/governance-mom.template';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernancePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async generateMomPdf(tenantId: string, minute: Record<string, unknown>) {
    const meeting = minute.meeting as Record<string, unknown> | undefined;
    const committee = meeting?.committee as
      | { name?: string; shortCode?: string }
      | undefined;

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    const institutionName = tenant?.name ?? 'Institution';

    const attendances = meeting?.id
      ? await this.db().governanceMeetingAttendance.findMany({
          where: { tenantId, meetingId: meeting.id as string },
        })
      : [];

    const html = renderGovernanceMomHtml({
      institutionName,
      committeeName: committee?.name ?? 'Committee',
      committeeCode: committee?.shortCode ?? '—',
      meetingTitle: String(meeting?.title ?? 'Meeting'),
      meetingDate: meeting?.meetingDate
        ? new Date(meeting.meetingDate as string).toLocaleDateString('en-IN')
        : '—',
      meetingTime: meeting?.meetingTime as string | null,
      venue: meeting?.venue as string | null,
      discussion: minute.discussion as string | null,
      decisions: minute.decisions as string | null,
      resolutions: minute.resolutions as string | null,
      futureActions: minute.futureActions as string | null,
      agendaItems:
        (meeting?.agendaItems as Array<{
          title: string;
          description?: string | null;
        }>) ?? [],
      attendance: attendances.map((a: Record<string, unknown>) => ({
        displayName: a.displayName as string | null,
        status: String(a.status),
      })),
    });

    const buffer = await this.htmlToPdf(html);
    const storageKey = `governance/${tenantId}/mom/${minute.id}-${Date.now()}.pdf`;
    await this.storage.put(storageKey, buffer, {
      contentType: 'application/pdf',
    });
    return storageKey;
  }

  async getMomPdfBuffer(tenantId: string, minuteId: string) {
    const minute = await this.db().governanceMeetingMinute.findFirst({
      where: { id: minuteId, tenantId },
    });
    if (!minute?.pdfPath) throw new NotFoundException('MoM PDF not available');
    const buffer = await this.storage.get(minute.pdfPath);
    if (!buffer) throw new NotFoundException('MoM PDF file missing');
    return buffer;
  }

  async htmlToPdf(html: string) {
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
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
