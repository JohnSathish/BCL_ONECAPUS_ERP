import { Injectable, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdmissionsApplicationDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async getApplicationForExport(tenantId: string, id: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        cycle: { include: { academicYear: true } },
        intake: { include: { program: true } },
        program: true,
        preferredShift: true,
        academicStream: true,
        documents: true,
        seatAllocations: {
          where: { deletedAt: null },
          orderBy: { round: 'desc' },
          take: 1,
          include: { shift: true },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  buildPrintHtml(
    application: Awaited<
      ReturnType<
        AdmissionsApplicationDocumentService['getApplicationForExport']
      >
    >,
    branding?: {
      displayName?: string | null;
      shortName?: string | null;
    } | null,
  ) {
    const formData = (application.formData ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const personal = (formData.personal ?? {}) as Record<string, unknown>;
    const academic = (formData.academic ?? {}) as Record<string, unknown>;
    const prefs = (formData.coursePreferences ?? {}) as Record<string, unknown>;
    const institution = branding?.displayName ?? 'Don Bosco College Tura';
    const photo = application.documents.find(
      (d) => d.slotCode === 'PHOTO',
    )?.fileUrl;
    const shift =
      application.seatAllocations[0]?.shift?.name ??
      application.preferredShift?.name ??
      '—';

    const sections: { title: string; rows: [string, string][] }[] = [
      {
        title: 'Personal information',
        rows: [
          [
            'Full name',
            String(
              personal.fullName ??
                `${application.firstName} ${application.lastName}`,
            ),
          ],
          ['Email', application.email],
          ['Phone', application.phone ?? '—'],
          ['Date of birth', String(personal.dateOfBirth ?? '—')],
          ['Gender', String(personal.gender ?? '—')],
          ['Category', application.category],
        ],
      },
      {
        title: 'Academic records',
        rows: [
          [
            'Class XII %',
            String(academic.class12Percentage ?? application.meritScore),
          ],
          ['Board', String(academic.board ?? '—')],
          ['Stream', application.academicStream?.name ?? '—'],
        ],
      },
      {
        title: 'Course preferences',
        rows: [
          ['Shift', shift],
          [
            'Major',
            application.majorSubjectCode ?? String(prefs.majorCode ?? '—'),
          ],
          [
            'Minor',
            application.minorSubjectCode ?? String(prefs.minorCode ?? '—'),
          ],
          ['MDC', application.mdcSubjectCode ?? String(prefs.mdcCode ?? '—')],
        ],
      },
      {
        title: 'Payment & status',
        rows: [
          ['Application status', application.status],
          ['Application fee', application.paymentStatus],
          [
            'Amount paid',
            application.amountPaid != null ? `₹${application.amountPaid}` : '—',
          ],
          ['Admission fee', application.admissionFeeStatus],
          ['Documents', application.documentVerificationStatus],
        ],
      },
    ];

    const sectionHtml = sections
      .map(
        (section) => `
        <section class="block">
          <h2>${esc(section.title)}</h2>
          <table>
            ${section.rows
              .map(
                ([label, value]) =>
                  `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`,
              )
              .join('')}
          </table>
        </section>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(application.applicationNumber)} — Application</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1a2b4b; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    .header { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
    .photo { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1; }
    .block { margin-bottom: 18px; page-break-inside: avoid; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { width: 34%; background: #f8fafc; font-weight: 600; }
    footer { margin-top: 28px; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    ${photo ? `<img class="photo" src="${esc(photo)}" alt="" />` : ''}
    <div>
      <h1>${esc(institution)}</h1>
      <p class="meta">Online Admission Application · ${esc(application.cycle?.title ?? application.intake?.name ?? '')}</p>
      <p class="meta"><strong>${esc(application.applicationNumber)}</strong> · ${esc(String(personal.fullName ?? `${application.firstName} ${application.lastName}`))}</p>
    </div>
  </div>
  ${sectionHtml}
  <footer>Generated ${new Date().toLocaleString('en-IN')} · OneCampus ERP Admissions</footer>
</body>
</html>`;
  }

  async renderPdfBuffer(html: string): Promise<Buffer> {
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
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async exportPdf(tenantId: string, id: string) {
    const application = await this.getApplicationForExport(tenantId, id);
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { displayName: true, shortName: true },
    });
    const html = this.buildPrintHtml(application, branding);
    const buffer = await this.renderPdfBuffer(html);
    return {
      buffer,
      filename: `${application.applicationNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_application.pdf`,
    };
  }
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
