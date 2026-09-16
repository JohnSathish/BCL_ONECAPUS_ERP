import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SchoolReportBrandingService } from './report-branding.service';
import { SchoolReportExcelService } from './report-excel.service';
import { SchoolReportPdfService } from './report-pdf.service';
import { renderReportHtml } from './report-html';
import {
  reportFileName,
  type ReportDocument,
  type ReportFormat,
} from './report-types';

@Injectable()
export class SchoolReportEngineService {
  private readonly log = new Logger(SchoolReportEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: SchoolReportBrandingService,
    private readonly pdf: SchoolReportPdfService,
    private readonly excel: SchoolReportExcelService,
  ) {}

  async generate(input: {
    tenantId: string;
    format: ReportFormat;
    document: ReportDocument;
    userId?: string;
    ip?: string;
  }) {
    const branding = await this.branding.load(input.tenantId);
    const extra =
      visiblePeriod(input.document) ||
      new Intl.DateTimeFormat('en-CA', { timeZone: branding.timezone }).format(
        new Date(),
      );
    const filename = reportFileName(
      branding,
      input.document.title,
      input.format,
      extra,
    );
    let buffer: Buffer;
    let contentType: string;
    if (input.format === 'pdf') {
      buffer = await this.pdf.render(input.document, branding);
      contentType = 'application/pdf';
    } else if (input.format === 'html') {
      buffer = Buffer.from(renderReportHtml(input.document, branding), 'utf8');
      contentType = 'text/html; charset=utf-8';
    } else if (input.format === 'csv') {
      buffer = this.excel.csv(input.document);
      contentType = 'text/csv; charset=utf-8';
    } else {
      buffer = await this.excel.render(input.document, branding);
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    try {
      await this.prisma.schoolReportExportAudit.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          reportKey: input.document.key,
          format: input.format,
          title: input.document.title,
          filtersJson: input.document.filters ?? {},
          recordCount: input.document.rows.length,
          ip: input.ip ?? null,
        },
      });
    } catch (err) {
      this.log.warn(
        `Could not write report audit: ${err instanceof Error ? err.message : err}`,
      );
    }
    return { buffer, filename, contentType, branding };
  }
}

function visiblePeriod(doc: ReportDocument) {
  return (
    doc.filters?.month || doc.filters?.date || doc.academicYear || doc.subtitle
  );
}
