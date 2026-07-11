import { Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';
import { StorageService } from '../../../shared/storage/storage.service';
import { toNumber, toRomanSemester } from '../utils/exam-fee.util';
import {
  buildExamReceiptHtml,
  type ExamReceiptBranding,
} from '../templates/exam-receipt.template';
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

  private async resolveLetterhead(tenantId: string): Promise<{
    branding: ExamReceiptBranding;
    logoSrc: string | null;
  }> {
    const brandingRow = await this.db().tenantBranding.findUnique({
      where: { tenantId },
      select: {
        displayName: true,
        address: true,
        logoUrl: true,
        badges: true,
      },
    });
    const displayName = String(
      brandingRow?.displayName ?? 'Don Bosco College Tura',
    );
    const isDbc = /don bosco/i.test(displayName);
    const badges = Array.isArray(brandingRow?.badges)
      ? (brandingRow.badges as string[])
      : [];

    const affiliationLine =
      badges.find((b) => /affiliated|nehu/i.test(b)) ??
      (isDbc ? 'Affiliated to NEHU, Shillong' : null);
    const accreditationLine =
      badges.find((b) => /naac/i.test(b)) ??
      (isDbc ? "NAAC Re-accredited with Grade 'B'" : null);

    const branding: ExamReceiptBranding = {
      collegeName: displayName,
      addressLine:
        brandingRow?.address?.trim() ||
        (isDbc ? 'Tura, West Garo Hills, Meghalaya - 794002' : null),
      affiliationLine,
      accreditationLine,
      establishedYear: isDbc ? '1970' : null,
    };

    return {
      branding,
      logoSrc: await resolvePdfImageSrcAsync(brandingRow?.logoUrl ?? null),
    };
  }

  private async brandingAssets(tenantId: string, qrPayload: string) {
    const { branding, logoSrc } = await this.resolveLetterhead(tenantId);
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
      collegeName: branding.collegeName,
      branding,
      logoSrc,
      qrImageSrc,
    };
  }

  private async loadStudentSnapshot(tenantId: string, studentId: string) {
    const student = await this.db().student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        user: { select: { displayName: true, email: true } },
        masterProfile: { select: { fullName: true } },
        department: { select: { name: true } },
        academicStanding: { select: { currentSemesterSequence: true } },
      },
    });

    const semesterNo =
      student?.academicStanding?.currentSemesterSequence ?? null;
    const name =
      student?.masterProfile?.fullName?.trim() ||
      student?.user?.displayName?.trim() ||
      null;

    return {
      name,
      rollNumber: student?.rollNumber ?? null,
      enrollmentNumber: student?.enrollmentNumber ?? null,
      department: student?.department?.name ?? null,
      email: student?.user?.email ?? null,
      semesterNo,
      semesterRoman: semesterNo != null ? toRomanSemester(semesterNo) : null,
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
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '6mm', right: '6mm', bottom: '6mm', left: '6mm' },
          preferCSSPageSize: true,
        }),
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

    const student = await this.loadStudentSnapshot(user.tid, app.studentId);
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
        ...student,
        department: student.department ?? app.departmentName,
        semesterNo: student.semesterNo ?? app.currentSemesterNo,
        semesterRoman: toRomanSemester(
          student.semesterNo ?? app.currentSemesterNo,
        ),
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
        branding: assets.branding,
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

  private async enrichBreakdown(tenantId: string, receipt: any) {
    const breakdown = {
      ...((receipt.breakdown ?? {}) as Record<string, unknown>),
    };
    const studentSnap = await this.loadStudentSnapshot(
      tenantId,
      receipt.studentId,
    );
    const existingStudent = (breakdown.student ?? {}) as Record<
      string,
      unknown
    >;
    const semesterNo =
      studentSnap.semesterNo ??
      existingStudent.semesterNo ??
      (breakdown as any)?.currentSemesterNo ??
      null;

    breakdown.student = {
      ...existingStudent,
      name:
        studentSnap.name ||
        existingStudent.name ||
        existingStudent.fullName ||
        null,
      rollNumber: studentSnap.rollNumber ?? existingStudent.rollNumber ?? null,
      enrollmentNumber:
        studentSnap.enrollmentNumber ??
        existingStudent.enrollmentNumber ??
        null,
      department: studentSnap.department ?? existingStudent.department ?? null,
      email: studentSnap.email ?? existingStudent.email ?? null,
      semesterNo,
      semesterRoman: toRomanSemester(semesterNo),
    };
    if (!breakdown.applicationNo) {
      breakdown.applicationNo = receipt.receiptNo;
    }
    return breakdown;
  }

  async getPdfBuffer(tenantId: string, id: string) {
    const receipt = await this.get(tenantId, id);
    const breakdown = await this.enrichBreakdown(tenantId, receipt);
    const assets = await this.brandingAssets(
      tenantId,
      receipt.qrPayload ?? receipt.receiptNo,
    );
    const html = buildExamReceiptHtml({
      receiptNo: receipt.receiptNo,
      issuedAt: receipt.issuedAt,
      applicationNo:
        (breakdown.applicationNo as string) ??
        receipt.breakdown?.applicationNo ??
        receipt.receiptNo,
      breakdown,
      collegeName: assets.collegeName,
      branding: assets.branding,
      logoSrc: assets.logoSrc,
      qrImageSrc: assets.qrImageSrc,
    });
    const pdf = await this.renderPdf(html);

    // Refresh cached PDF so reprints show corrected student/letterhead data.
    try {
      const path =
        receipt.pdfPath ?? `exam-receipts/${tenantId}/${receipt.id}.pdf`;
      await this.storage.put(path, pdf, { contentType: 'application/pdf' });
      if (!receipt.pdfPath || !(receipt.breakdown as any)?.student?.name) {
        await this.db().examReceipt.update({
          where: { id: receipt.id },
          data: {
            pdfPath: path,
            breakdown: {
              ...(receipt.breakdown ?? {}),
              ...breakdown,
              collegeName: assets.collegeName,
            },
          },
        });
      }
    } catch {
      // Return freshly rendered PDF even if cache update fails.
    }

    return pdf;
  }
}
