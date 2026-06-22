import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AppointmentOrderDocumentService {
  private readonly logger = new Logger(AppointmentOrderDocumentService.name);
  private uploadRoot = resolveTenantUploadRoot();

  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async generatePdf(tenantId: string, orderId: string) {
    const order = await this.db().appointmentOrder.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order?.renderedHtml) return null;

    const dir = join(this.uploadRoot, tenantId, 'appointment-orders');
    await mkdir(dir, { recursive: true });

    const pdfFilename = `${orderId}.pdf`;
    const pdfAbsolute = join(dir, pdfFilename);
    const pdfPath = `/uploads/tenants/${tenantId}/appointment-orders/${pdfFilename}`;

    try {
      await this.renderPdf(order.renderedHtml, pdfAbsolute);
      await this.db().appointmentOrder.update({
        where: { id: orderId },
        data: { pdfPath },
      });
      return pdfPath;
    } catch (error) {
      this.logger.warn(
        `PDF generation failed for appointment order ${orderId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  async getPdfBuffer(tenantId: string, orderId: string) {
    const order = await this.db().appointmentOrder.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('Appointment order not found');

    if (!order.pdfPath) {
      await this.generatePdf(tenantId, orderId);
      const refreshed = await this.db().appointmentOrder.findFirst({
        where: { id: orderId, tenantId },
      });
      if (!refreshed?.pdfPath) {
        throw new NotFoundException('PDF not available');
      }
      order.pdfPath = refreshed.pdfPath;
    }

    const absolute = this.resolveAbsolutePath(order.pdfPath);
    const buffer = await readFile(absolute);
    return { buffer, filename: `${order.orderNo ?? orderId}.pdf` };
  }

  resolveAbsolutePath(publicPath: string) {
    if (!publicPath.startsWith('/uploads/')) {
      throw new NotFoundException('Document path invalid');
    }
    return join(process.cwd(), publicPath.replace(/^\/uploads\//, 'uploads/'));
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
