import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import puppeteer from 'puppeteer';

export type PersistedCertificateDocument = {
  htmlPath: string;
  pdfPath: string | null;
  primaryPath: string;
};

@Injectable()
export class CertificateDocumentService {
  private readonly logger = new Logger(CertificateDocumentService.name);
  private uploadRoot = resolveTenantUploadRoot();

  async persistCertificateDocument(
    tenantId: string,
    issueId: string,
    html: string,
  ): Promise<PersistedCertificateDocument> {
    const dir = join(this.uploadRoot, tenantId, 'certificates');
    await mkdir(dir, { recursive: true });

    const htmlFilename = `${issueId}.html`;
    const pdfFilename = `${issueId}.pdf`;
    const htmlAbsolute = join(dir, htmlFilename);
    const pdfAbsolute = join(dir, pdfFilename);
    const htmlPath = `/uploads/tenants/${tenantId}/certificates/${htmlFilename}`;

    await writeFile(htmlAbsolute, html, 'utf8');

    let pdfPath: string | null = null;
    try {
      await this.renderPdf(html, pdfAbsolute);
      pdfPath = `/uploads/tenants/${tenantId}/certificates/${pdfFilename}`;
    } catch (error) {
      this.logger.warn(
        `PDF generation failed for issue ${issueId}; HTML fallback kept. ${error instanceof Error ? error.message : error}`,
      );
    }

    return {
      htmlPath,
      pdfPath,
      primaryPath: pdfPath ?? htmlPath,
    };
  }

  /** @deprecated Use persistCertificateDocument */
  async persistHtml(tenantId: string, issueId: string, html: string) {
    const result = await this.persistCertificateDocument(
      tenantId,
      issueId,
      html,
    );
    return result.primaryPath;
  }

  resolveAbsolutePath(publicPath: string) {
    if (!publicPath.startsWith('/uploads/')) {
      throw new NotFoundException('Document path invalid');
    }
    return join(process.cwd(), publicPath.replace(/^\/uploads\//, 'uploads/'));
  }

  mimeTypeForPath(publicPath: string) {
    return publicPath.endsWith('.pdf')
      ? 'application/pdf'
      : 'text/html; charset=utf-8';
  }

  private async renderPdf(html: string, outputPath: string) {
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
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
    } finally {
      await browser.close();
    }
  }
}
