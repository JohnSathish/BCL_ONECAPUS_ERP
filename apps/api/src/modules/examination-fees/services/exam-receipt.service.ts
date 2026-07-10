import { Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';
import { StorageService } from '../../../shared/storage/storage.service';
import { toNumber } from '../utils/exam-fee.util';
import { buildExamReceiptHtml } from '../templates/exam-receipt.template';
import { ExamFeeSettingsService } from './exam-fee-settings.service';

@Injectable()
export class ExamReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ExamFeeSettingsService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async nextReceiptNo(tenantId: string) {
    const settings = await this.settings.get(tenantId);
    const prefix = settings.receiptPrefix || 'EXAM';
    const year = new Date().getFullYear();
    const count = await this.db().examReceipt.count({ where: { tenantId } });
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async brandingAssets(tenantId: string, qrPayload: string) {
    const branding = await this.db().tenantBranding.findUnique({
      where: { tenantId },
      select: { displayName: true, logoUrl: true },
    });
    const logoSrc = await resolvePdfImageSrcAsync(branding?.logoUrl ?? null);
    let qrImageSrc: string | null = null;
    try {
      qrImageSrc = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 180,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrImageSrc = null;
    }
    return {
      collegeName: branding?.displayName ?? null,
      logoSrc,
      qrImageSrc,
    };
  }

  private async renderPdf(html: string) {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return Buffer.from(
        await page.pdf({ format: 'A4', printBackground: true }),
      );
    } finally {
      await browser.close();
    }
  }

  async issue(user: JwtUser, applicationId: string, examPaymentId: string) {
    const app = await this.db().examApplication.findFirst({
      where: { id: applicationId, tenantId: user.tid },
      include: {
        currentSubjects: true,
        backPapers: true,
        session: true,
      },
    });
    if (!app) throw new NotFoundException('Application not found');

    const student = await this.db().student.findFirst({
      where: { id: app.studentId, tenantId: user.tid },
      include: {
        user: { select: { fullName: true, email: true } },
        department: { select: { name: true } },
      },
    });

    const payment = await this.db().examPayment.findFirst({
      where: { id: examPaymentId, tenantId: user.tid },
    });

    const receiptNo = await this.nextReceiptNo(user.tid);
    const breakdown = {
      currentSubjects: app.currentSubjects,
      backPapers: app.backPapers,
      fees: {
        currentSemesterFee: toNumber(app.currentSemesterFee),
        backPaperFee: toNumber(app.backPaperFee),
        processingFee: toNumber(app.processingFee),
        lateFee: toNumber(app.lateFee),
        totalFee: toNumber(app.totalFee),
      },
      session: {
        name: app.session?.name,
        cycle: app.session?.semesterCycle,
        academicYearLabel: app.session?.academicYearLabel,
      },
      student: {
        name: student?.user?.fullName,
        rollNumber: student?.rollNumber,
        enrollmentNumber: student?.enrollmentNumber,
        department: student?.department?.name ?? app.departmentName,
        email: student?.user?.email,
      },
      payment: payment
        ? {
            channel: payment.channel,
            mode: payment.paymentMode,
            provider: payment.provider,
            transactionId: payment.paymentTransactionId,
            externalReference: payment.externalReference,
            paidAt: payment.paidAt,
          }
        : null,
      applicationNo: app.applicationNo,
    };

    const qrPayload = JSON.stringify({
      type: 'EXAM_FEE_RECEIPT',
      receiptNo,
      applicationNo: app.applicationNo,
      amount: toNumber(app.totalFee),
      tenantId: user.tid,
    });

    const assets = await this.brandingAssets(user.tid, qrPayload);

    const receipt = await this.db().examReceipt.create({
      data: {
        tenantId: user.tid,
        applicationId,
        paymentId: examPaymentId,
        studentId: app.studentId,
        receiptNo,
        amount: app.totalFee,
        issuedById: user.sub,
        qrPayload,
        breakdown: {
          ...breakdown,
          collegeName: assets.collegeName,
        },
      },
    });

    try {
      const html = buildExamReceiptHtml({
        receiptNo,
        issuedAt: receipt.issuedAt,
        applicationNo: app.applicationNo,
        breakdown,
        collegeName: assets.collegeName,
        logoSrc: assets.logoSrc,
        qrImageSrc: assets.qrImageSrc,
      });
      const pdf = await this.renderPdf(html);
      const path = `exam-receipts/${user.tid}/${receipt.id}.pdf`;
      await this.storage.put(path, pdf, { contentType: 'application/pdf' });
      return this.db().examReceipt.update({
        where: { id: receipt.id },
        data: { pdfPath: path },
      });
    } catch {
      return receipt;
    }
  }

  list(tenantId: string) {
    return this.db().examReceipt.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().examReceipt.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Receipt not found');
    return row;
  }

  async getPdfBuffer(tenantId: string, id: string) {
    const receipt = await this.get(tenantId, id);
    if (receipt.pdfPath) {
      const buf = await this.storage.get(receipt.pdfPath);
      if (buf) return buf;
    }
    const assets = await this.brandingAssets(
      tenantId,
      receipt.qrPayload ?? receipt.receiptNo,
    );
    const html = buildExamReceiptHtml({
      receiptNo: receipt.receiptNo,
      issuedAt: receipt.issuedAt,
      applicationNo: receipt.breakdown?.applicationNo ?? receipt.receiptNo,
      breakdown: receipt.breakdown ?? {},
      collegeName: assets.collegeName,
      logoSrc: assets.logoSrc,
      qrImageSrc: assets.qrImageSrc,
    });
    return this.renderPdf(html);
  }
}
