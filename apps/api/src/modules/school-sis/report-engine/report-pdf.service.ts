import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { renderReportHtml } from './report-html';
import type { ReportBranding, ReportDocument } from './report-types';

@Injectable()
export class SchoolReportPdfService {
  private readonly log = new Logger(SchoolReportPdfService.name);

  async render(doc: ReportDocument, branding: ReportBranding) {
    const html = renderReportHtml(doc, branding);
    const cols = doc.columns.length;
    const landscape =
      doc.orientation === 'landscape' || (!doc.orientation && cols >= 9);
    const format =
      doc.pageSize === 'Letter'
        ? 'Letter'
        : doc.pageSize === 'A3'
          ? 'A3'
          : 'A4';
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
        format,
        landscape,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#5a6a7a;font-family:Inter,sans-serif;display:flex;justify-content:space-between;">
          <span>${escapeHtml(branding.schoolName)}${doc.academicYear ? ` | Academic Year ${escapeHtml(doc.academicYear)}` : ''}</span>
          <span>${escapeHtml(branding.footerText)} &nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
        margin: { top: '12mm', bottom: '16mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } catch (err) {
      this.log.error(err);
      throw err;
    } finally {
      await browser.close();
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
