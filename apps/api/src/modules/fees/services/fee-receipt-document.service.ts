import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import {
  buildFeeReceiptHtml,
  buildFeeReceiptStorageKey,
  FEE_RECEIPT_TEMPLATE_VERSION,
  receiptPdfOptions,
  resolveFeeCycleLabel,
  resolveFeeReceiptBranding,
  resolveReceiptLines,
  resolveReceiptTemplateFormat,
  type ReceiptTemplateFormat,
} from '../templates/fee-receipt.template';

@Injectable()
export class FeeReceiptDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly financeSettings: FeeFinanceSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async generatePdf(tenantId: string, receiptId: string) {
    const { buffer, receiptNo, filePath } = await this.buildPdf(
      tenantId,
      receiptId,
    );
    return { filePath, receiptNo, buffer };
  }

  async generatePdfBuffer(tenantId: string, receiptId: string) {
    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { pdfPath: true, receiptNo: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    const settings = await this.financeSettings.get(tenantId);
    const format = resolveReceiptTemplateFormat(
      settings.metadata as Record<string, unknown> | null,
    );
    const cached = await this.readCachedPdf(
      receipt.pdfPath,
      tenantId,
      receipt.receiptNo,
      format,
    );
    if (cached) return { buffer: cached, receiptNo: receipt.receiptNo };

    const { buffer, receiptNo } = await this.buildPdf(tenantId, receiptId);
    return { buffer, receiptNo };
  }

  async generateBulkPdfBuffer(
    tenantId: string,
    receiptIds: string[],
    layout: 'single' | 'two_per_page' = 'two_per_page',
  ) {
    if (!receiptIds.length) throw new NotFoundException('No receipts selected');

    const settings = await this.financeSettings.get(tenantId);
    const format = resolveReceiptTemplateFormat(
      settings.metadata as Record<string, unknown> | null,
    );
    const sheets: string[] = [];

    for (const receiptId of receiptIds) {
      const payload = await this.buildReceiptPayload(tenantId, receiptId);
      const html = buildFeeReceiptHtml(payload, format);
      const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
      sheets.push(`<div class="receipt-sheet">${body}</div>`);
    }

    const perPage = layout === 'two_per_page' ? 2 : 1;
    const pages: string[] = [];
    for (let i = 0; i < sheets.length; i += perPage) {
      const chunk = sheets
        .slice(i, i + perPage)
        .join('<div class="cut-line"></div>');
      pages.push(`<div class="a4-page">${chunk}</div>`);
    }

    const merged = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      @page { size: A4 portrait; margin: 0; }
      body { margin: 0; font-family: Inter, Roboto, sans-serif; background: #fff; }
      .a4-page {
        width: 210mm; height: 297mm; page-break-after: always;
        display: flex; flex-direction: column; box-sizing: border-box;
      }
      .receipt-sheet {
        flex: 0 0 148mm;
        height: 148mm;
        overflow: hidden;
        padding: 0;
        box-sizing: border-box;
      }
      .cut-line {
        border-top: 1px dashed #94a3b8;
        margin: 0;
        flex-shrink: 0;
        position: relative;
      }
      .cut-line::after {
        content: '✂ cut here';
        position: absolute;
        right: 8mm;
        top: -7px;
        font-size: 7px;
        color: #94a3b8;
        background: #fff;
        padding: 0 4px;
      }
    </style></head><body>${pages.join('')}</body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(merged, { waitUntil: 'load', timeout: 15000 });
      return Buffer.from(
        await page.pdf({
          format: 'A4',
          landscape: false,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      );
    } finally {
      await browser.close();
    }
  }

  private async readCachedPdf(
    pdfPath: string | null | undefined,
    tenantId: string,
    receiptNo: string,
    format: ReceiptTemplateFormat,
  ): Promise<Buffer | null> {
    const storageKey = buildFeeReceiptStorageKey(tenantId, receiptNo, format);
    const fromStorage = await this.storage.get(storageKey);
    if (fromStorage) return fromStorage;

    if (pdfPath) {
      try {
        const buf = await readFile(pdfPath);
        if (
          pdfPath.includes(FEE_RECEIPT_TEMPLATE_VERSION) &&
          pdfPath.includes(format)
        )
          return buf;
      } catch {
        // regenerate
      }
    }
    return null;
  }

  private async buildReceiptPayload(tenantId: string, receiptId: string) {
    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId },
      include: {
        payment: {
          include: {
            allocations: {
              include: {
                demand: { include: { lines: true } },
              },
            },
          },
        },
        demand: { include: { lines: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    const student = await this.db().student.findFirst({
      where: { id: receipt.studentId, tenantId },
      include: {
        user: { select: { displayName: true } },
        masterProfile: true,
        programVersion: { include: { program: true } },
        academicStanding: true,
      },
    });

    const collector = receipt.issuedById
      ? await this.db().user.findFirst({
          where: { id: receipt.issuedById },
          select: { displayName: true, email: true },
        })
      : null;

    const branding = await resolveFeeReceiptBranding(this.db(), tenantId);
    const verifyUrl = `${process.env.WEB_ORIGIN ?? 'http://demo.localhost:3000'}/verify/receipt/${receipt.receiptNo}`;
    const payment = receipt.payment;
    const transactionRef =
      payment?.providerPaymentId ??
      payment?.externalReference ??
      payment?.transactionNo ??
      receipt.receiptNo;
    const paymentStatus =
      payment?.status === 'SUCCESS' || payment?.status === 'PAID'
        ? 'SUCCESS'
        : String(payment?.status ?? 'SUCCESS');

    return {
      branding,
      receiptNo: receipt.receiptNo,
      date: new Date(receipt.issuedAt),
      paidAt: payment?.paidAt
        ? new Date(payment.paidAt)
        : new Date(receipt.issuedAt),
      studentName:
        student?.masterProfile?.fullName ??
        student?.user?.displayName ??
        'Student',
      enrollmentNumber: student?.enrollmentNumber ?? '—',
      applicationNo: student?.masterProfile?.applicationNumber ?? '—',
      programme: student?.programVersion?.program?.name ?? '—',
      semester: student?.academicStanding?.currentSemesterSequence
        ? `Semester ${student.academicStanding.currentSemesterSequence}`
        : '—',
      feeCycle: String(resolveFeeCycleLabel(receipt)),
      lines: resolveReceiptLines(receipt),
      amount: Number(receipt.amount),
      paymentMode: payment?.paymentMode ?? 'ONLINE',
      paymentStatus,
      transactionRef: String(transactionRef),
      collectedBy:
        collector?.displayName ?? collector?.email ?? 'Finance Office',
      verifyUrl,
    };
  }

  private async buildPdf(tenantId: string, receiptId: string) {
    const settings = await this.financeSettings.get(tenantId);
    const format = resolveReceiptTemplateFormat(
      settings.metadata as Record<string, unknown> | null,
    );

    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { pdfPath: true, receiptNo: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    const existing = await this.readCachedPdf(
      receipt.pdfPath,
      tenantId,
      receipt.receiptNo,
      format,
    );
    if (existing) {
      return {
        buffer: existing,
        receiptNo: receipt.receiptNo,
        filePath: receipt.pdfPath,
      };
    }

    const payload = await this.buildReceiptPayload(tenantId, receiptId);
    const html = buildFeeReceiptHtml(payload, format);
    const pdfOpts = receiptPdfOptions(format);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    let buffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      buffer = Buffer.from(await page.pdf(pdfOpts));
    } finally {
      await browser.close();
    }

    const storageKey = buildFeeReceiptStorageKey(
      tenantId,
      receipt.receiptNo,
      format,
    );
    const stored = await this.storage.put(storageKey, buffer, {
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const filePath = stored.path ?? this.storage.resolveLocalPath(storageKey);

    await this.db().feeReceipt.update({
      where: { id: receiptId },
      data: { pdfPath: filePath, qrPayload: payload.verifyUrl },
    });

    return { buffer, receiptNo: receipt.receiptNo, filePath };
  }
}
