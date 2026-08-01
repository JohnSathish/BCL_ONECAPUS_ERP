import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveTenantUploadRoot } from '../../common/uploads/upload-paths';
import puppeteer from 'puppeteer';

/** CR80 portrait feed (Evolis Primacy) */
const CR80_WIDTH_MM = 53.98;
const CR80_HEIGHT_MM = 85.6;

@Injectable()
export class IdCardDocumentService {
  private readonly logger = new Logger(IdCardDocumentService.name);

  async renderPdf(html: string, pageCount = 2): Promise<Buffer> {
    const timeout = Math.min(600_000, 60_000 + pageCount * 2_000);
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
      // domcontentloaded avoids hanging forever on external QR/photo URLs.
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout });
      // Allow photos/QR/signature hosted on Nest to finish loading before capture.
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 15_000 });
      } catch {
        this.logger.warn(
          'ID card PDF: network idle wait skipped (external assets may still be loading)',
        );
      }
      // Brief settle for late image decode after network idle.
      await new Promise((r) => setTimeout(r, 400));
      const pdf = await page.pdf({
        width: `${CR80_WIDTH_MM}mm`,
        height: `${CR80_HEIGHT_MM}mm`,
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      if (!pdf?.length) {
        throw new Error('Puppeteer returned an empty PDF buffer');
      }
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error(
        `ID card PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      await browser.close();
    }
  }

  async persistPdf(
    tenantId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(resolveTenantUploadRoot(), tenantId, 'id-cards');
    await mkdir(dir, { recursive: true });
    const abs = join(dir, filename);
    await writeFile(abs, buffer);
    return `/uploads/tenants/${tenantId}/id-cards/${filename}`;
  }
}
