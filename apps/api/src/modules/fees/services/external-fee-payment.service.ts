import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import {
  externalSourceAllowed,
  resolveCollectionModes,
} from '../constants/collection-modes.constants';
import {
  EXTERNAL_FEE_PAYMENT_SOURCES,
  FEE_PAYMENT_SOURCE_LABELS,
  type FeePaymentSource,
  isExternalPaymentSource,
  paymentModeForSource,
} from '../constants/payment-source.constants';
import type { ExternalFeePaymentDto } from '../dto/fees.dto';
import { PaymentCollectionService } from './payment-collection.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';

@Injectable()
export class ExternalFeePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collections: PaymentCollectionService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly storage: StorageService,
    private readonly financeSettings: FeeFinanceSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async listSources(user: JwtUser) {
    const settings = await this.financeSettings.get(user.tid);
    const modes = resolveCollectionModes(settings);
    return EXTERNAL_FEE_PAYMENT_SOURCES.filter((value) =>
      externalSourceAllowed(value, modes),
    ).map((value) => ({
      value,
      label: FEE_PAYMENT_SOURCE_LABELS[value],
    }));
  }

  async list(
    tenantId: string,
    query: {
      status?: string;
      studentId?: string;
      paymentSource?: string;
      limit?: number;
    },
  ) {
    const rows = await this.db().externalFeePayment.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.paymentSource ? { paymentSource: query.paymentSource } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });
    return this.enrichRows(tenantId, rows);
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().externalFeePayment.findFirst({
      where: { tenantId, id },
    });
    if (!row) throw new NotFoundException('External payment entry not found');
    const [enriched] = await this.enrichRows(tenantId, [row]);
    return enriched;
  }

  async submit(user: JwtUser, dto: ExternalFeePaymentDto) {
    const settings = await this.financeSettings.get(user.tid);
    const modes = resolveCollectionModes(settings);
    if (
      !isExternalPaymentSource(dto.paymentSource) &&
      dto.paymentSource !== 'OFFICE_QR'
    ) {
      throw new BadRequestException(
        'Invalid payment source for external entry.',
      );
    }
    if (!externalSourceAllowed(dto.paymentSource, modes)) {
      throw new BadRequestException(
        `${FEE_PAYMENT_SOURCE_LABELS[dto.paymentSource as FeePaymentSource] ?? dto.paymentSource} is disabled in fee collection settings.`,
      );
    }

    const entry = await this.db().externalFeePayment.create({
      data: {
        tenantId: user.tid,
        entryNo: await this.nextEntryNo(user.tid),
        studentId: dto.studentId,
        paymentSource: dto.paymentSource,
        externalReference: dto.externalReference?.trim() || null,
        transactionDate: new Date(dto.transactionDate),
        amount: dto.amount,
        remarks: dto.remarks?.trim() || null,
        attachmentUrls: dto.attachmentUrls ?? [],
        demandIds: dto.demandIds ?? [],
        status: 'PENDING',
        submittedById: user.sub,
      },
    });

    if (dto.approveImmediately) {
      return this.approve(user, entry.id);
    }

    const [enriched] = await this.enrichRows(user.tid, [entry]);
    return enriched;
  }

  async approve(user: JwtUser, id: string) {
    const entry = await this.db().externalFeePayment.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!entry) throw new NotFoundException('External payment entry not found');
    if (entry.status !== 'PENDING') {
      throw new BadRequestException(
        `Entry is already ${entry.status.toLowerCase()}.`,
      );
    }

    const source = entry.paymentSource as FeePaymentSource;
    const demandIds = Array.isArray(entry.demandIds)
      ? (entry.demandIds as string[])
      : [];

    const result = await this.collections.collect(user, {
      studentId: entry.studentId,
      amount: Number(entry.amount),
      demandIds,
      paymentMode: paymentModeForSource(source),
      paymentSource: source,
      externalReference: entry.externalReference ?? undefined,
      remarks: entry.remarks ?? undefined,
      metadata: {
        externalPaymentId: entry.id,
        entryNo: entry.entryNo,
        paymentSource: source,
        externalReference: entry.externalReference,
        attachmentUrls: entry.attachmentUrls,
        transactionDate: entry.transactionDate,
      },
    });

    const updated = await this.db().externalFeePayment.update({
      where: { id: entry.id },
      data: {
        status: 'APPROVED',
        paymentId: result.payment.id,
        receiptId: result.receipt?.id ?? null,
        verifiedById: user.sub,
        verifiedAt: new Date(),
      },
    });

    await this.feeSummary.touchAfterPayment(user.tid, entry.studentId);

    const [enriched] = await this.enrichRows(user.tid, [updated]);
    return {
      entry: enriched,
      payment: result.payment,
      receipt: result.receipt,
    };
  }

  async reject(user: JwtUser, id: string, reason: string) {
    const entry = await this.db().externalFeePayment.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!entry) throw new NotFoundException('External payment entry not found');
    if (entry.status !== 'PENDING') {
      throw new BadRequestException(
        `Entry is already ${entry.status.toLowerCase()}.`,
      );
    }

    const updated = await this.db().externalFeePayment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        verifiedById: user.sub,
        verifiedAt: new Date(),
      },
    });

    const [enriched] = await this.enrichRows(user.tid, [updated]);
    return enriched;
  }

  async uploadAttachment(user: JwtUser, file: Express.Multer.File) {
    if (!file?.buffer?.length)
      throw new BadRequestException('No file uploaded.');
    const ext = (file.originalname?.split('.').pop() ?? 'bin')
      .toLowerCase()
      .slice(0, 8);
    const key = `fees/external-payments/${user.tid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const stored = await this.storage.put(key, file.buffer, {
      contentType: file.mimetype,
    });
    return {
      key,
      url:
        stored.url ??
        `/api/v1/fees/external-payments/attachments/${encodeURIComponent(key)}`,
      fileName: file.originalname,
      contentType: file.mimetype,
      size: file.size,
    };
  }

  async getAttachment(key: string) {
    const buf = await this.storage.get(key);
    if (!buf) throw new NotFoundException('Attachment not found');
    return buf;
  }

  private async enrichRows(
    tenantId: string,
    rows: Array<Record<string, unknown>>,
  ) {
    if (!rows.length) return [];
    const studentIds = [...new Set(rows.map((r) => String(r.studentId)))];
    const students = await this.db().student.findMany({
      where: { tenantId, id: { in: studentIds } },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        masterProfile: { select: { fullName: true, mobileNumber: true } },
        user: { select: { displayName: true } },
        programVersion: { include: { program: { select: { name: true } } } },
        primaryShift: { select: { name: true } },
      },
    });
    const studentMap = new Map(
      students.map((s: Record<string, unknown>) => [s.id, s]),
    );

    return rows.map((row) => {
      const student = studentMap.get(row.studentId) as
        | Record<string, any>
        | undefined;
      const source = String(row.paymentSource) as FeePaymentSource;
      return {
        ...row,
        amount: Number(row.amount),
        paymentSourceLabel: FEE_PAYMENT_SOURCE_LABELS[source] ?? source,
        student: student
          ? {
              id: student.id,
              name:
                student.masterProfile?.fullName ?? student.user?.displayName,
              enrollmentNumber: student.enrollmentNumber,
              rollNumber: student.rollNumber,
              mobile: student.masterProfile?.mobileNumber,
              program: student.programVersion?.program?.name,
              shift: student.primaryShift?.name,
            }
          : null,
      };
    });
  }

  private async nextEntryNo(tenantId: string) {
    const count = await this.db().externalFeePayment.count({
      where: { tenantId },
    });
    return `EP-${String(count + 1).padStart(6, '0')}`;
  }
}
