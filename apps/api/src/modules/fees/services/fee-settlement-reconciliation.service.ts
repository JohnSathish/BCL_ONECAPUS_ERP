import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  EXCEPTION_MATCH_STATUSES,
  type FeeSettlementMatchMethod,
  type FeeSettlementMatchStatus,
} from '../constants/fee-settlement.constants';

type ParsedSettlementRow = {
  lineNo: number;
  gatewayTransactionId?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  utr?: string;
  receiptNo?: string;
  studentIdentifier?: string;
  grossAmount: number;
  feeCharges: number;
  taxAmount: number;
  netAmount: number;
  settlementDate?: Date;
  currency: string;
  rawRow: Record<string, string>;
};

const HEADER_ALIASES: Record<string, keyof ParsedSettlementRow | 'ignore'> = {
  payment_id: 'gatewayPaymentId',
  paymentid: 'gatewayPaymentId',
  gateway_payment_id: 'gatewayPaymentId',
  entity_id: 'gatewayPaymentId',
  razorpay_payment_id: 'gatewayPaymentId',
  order_id: 'gatewayOrderId',
  orderid: 'gatewayOrderId',
  gateway_order_id: 'gatewayOrderId',
  razorpay_order_id: 'gatewayOrderId',
  transaction_id: 'gatewayTransactionId',
  txn_id: 'gatewayTransactionId',
  transactionid: 'gatewayTransactionId',
  gateway_transaction_id: 'gatewayTransactionId',
  merchant_tran_id: 'gatewayTransactionId',
  utr: 'utr',
  settlement_utr: 'utr',
  bank_utr: 'utr',
  bank_reference: 'utr',
  bank_ref: 'utr',
  receipt_no: 'receiptNo',
  receipt_number: 'receiptNo',
  receiptno: 'receiptNo',
  student_id: 'studentIdentifier',
  admission_no: 'studentIdentifier',
  admission_number: 'studentIdentifier',
  customer_id: 'studentIdentifier',
  amount: 'grossAmount',
  payment_amount: 'grossAmount',
  gross_amount: 'grossAmount',
  credit: 'grossAmount',
  debit: 'grossAmount',
  fee: 'feeCharges',
  fee_charges: 'feeCharges',
  gateway_fee: 'feeCharges',
  charges: 'feeCharges',
  tax: 'taxAmount',
  gst: 'taxAmount',
  tax_amount: 'taxAmount',
  net: 'netAmount',
  net_amount: 'netAmount',
  credit_amount: 'netAmount',
  settled_at: 'settlementDate',
  settlement_date: 'settlementDate',
  credit_date: 'settlementDate',
  settled_on: 'settlementDate',
  currency: 'currency',
};

@Injectable()
export class FeeSettlementReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private normalizeHeader(h: string) {
    return h
      .trim()
      .toLowerCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private parseAmount(value?: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/[,₹\s]/g, '').replace(/^\((.*)\)$/, '-$1');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private parseDate(value?: string): Date | undefined {
    if (!value?.trim()) return undefined;
    const raw = value.trim();
    const iso = Date.parse(raw);
    if (!Number.isNaN(iso)) return new Date(iso);
    const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (mdy) {
      const d = Number(mdy[1]);
      const m = Number(mdy[2]);
      let y = Number(mdy[3]);
      if (y < 100) y += 2000;
      // Prefer DD/MM/YYYY for Indian settlement files
      return new Date(Date.UTC(y, m - 1, d));
    }
    return undefined;
  }

  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  }

  parseSettlementCsv(buffer: Buffer): ParsedSettlementRow[] {
    const text = buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException(
        'Settlement file must include a header row and at least one data row',
      );
    }

    const headers = this.splitCsvLine(lines[0]).map((h) =>
      this.normalizeHeader(h),
    );
    const mapped = headers.map((h) => HEADER_ALIASES[h] ?? null);
    if (!mapped.some((m) => m && m !== 'ignore')) {
      throw new BadRequestException(
        'Unrecognized settlement CSV headers. Expected columns like payment_id, order_id, amount, utr, settlement_date.',
      );
    }

    const rows: ParsedSettlementRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i]);
      if (cols.every((c) => !c.trim())) continue;
      const rawRow: Record<string, string> = {};
      const row: ParsedSettlementRow = {
        lineNo: i,
        grossAmount: 0,
        feeCharges: 0,
        taxAmount: 0,
        netAmount: 0,
        currency: 'INR',
        rawRow,
      };

      headers.forEach((header, idx) => {
        const value = cols[idx] ?? '';
        rawRow[header] = value;
        const field = mapped[idx];
        if (!field || field === 'ignore') return;
        if (field === 'grossAmount') row.grossAmount = this.parseAmount(value);
        else if (field === 'feeCharges')
          row.feeCharges = this.parseAmount(value);
        else if (field === 'taxAmount') row.taxAmount = this.parseAmount(value);
        else if (field === 'netAmount') row.netAmount = this.parseAmount(value);
        else if (field === 'settlementDate')
          row.settlementDate = this.parseDate(value);
        else if (field === 'currency')
          row.currency = value.trim().toUpperCase() || 'INR';
        else if (value.trim()) (row as any)[field] = value.trim();
      });

      if (!row.netAmount && row.grossAmount) {
        row.netAmount =
          Math.round((row.grossAmount - row.feeCharges - row.taxAmount) * 100) /
          100;
      }
      if (!row.grossAmount && row.netAmount) {
        row.grossAmount = row.netAmount;
      }

      const hasIdentity =
        row.gatewayPaymentId ||
        row.gatewayOrderId ||
        row.gatewayTransactionId ||
        row.utr ||
        row.receiptNo ||
        row.studentIdentifier;
      if (!hasIdentity && !row.grossAmount && !row.netAmount) continue;
      rows.push(row);
    }

    if (!rows.length) {
      throw new BadRequestException('No settlement rows found in CSV');
    }
    return rows;
  }

  async listBatches(tenantId: string, limit = 30) {
    return this.db().feeSettlementBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.db().feeSettlementBatch.findFirst({
      where: { tenantId, id: batchId },
    });
    if (!batch) throw new NotFoundException('Settlement batch not found');
    return batch;
  }

  async dashboard(tenantId: string, batchId?: string) {
    const where = {
      tenantId,
      ...(batchId ? { batchId } : {}),
    };
    const lines = await this.db().feeSettlementLine.findMany({
      where,
      select: {
        matchStatus: true,
        grossAmount: true,
        netAmount: true,
        amountDifference: true,
      },
      take: 20_000,
    });

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const line of lines) {
      const key = String(line.matchStatus);
      if (!byStatus[key]) byStatus[key] = { count: 0, amount: 0 };
      byStatus[key].count += 1;
      byStatus[key].amount += Number(line.grossAmount ?? line.netAmount ?? 0);
    }

    const matched =
      (byStatus.MATCHED?.count ?? 0) + (byStatus.RECONCILED?.count ?? 0);
    const exceptions = lines.filter((l: any) =>
      EXCEPTION_MATCH_STATUSES.includes(l.matchStatus),
    ).length;
    const totalGross = lines.reduce(
      (s: number, l: any) => s + Number(l.grossAmount ?? 0),
      0,
    );
    const totalNet = lines.reduce(
      (s: number, l: any) => s + Number(l.netAmount ?? 0),
      0,
    );

    const batches = await this.listBatches(tenantId, 10);
    return {
      kpis: {
        totalLines: lines.length,
        matched,
        reconciled: byStatus.RECONCILED?.count ?? 0,
        exceptions,
        unmatched: byStatus.UNMATCHED?.count ?? 0,
        amountMismatch: byStatus.AMOUNT_MISMATCH?.count ?? 0,
        duplicates: byStatus.DUPLICATE?.count ?? 0,
        totalGross,
        totalNet,
      },
      byStatus,
      recentBatches: batches,
    };
  }

  async listLines(
    tenantId: string,
    query: {
      batchId?: string;
      matchStatus?: string;
      exceptionsOnly?: boolean;
      limit?: number;
    },
  ) {
    const statusFilter = query.matchStatus
      ? { matchStatus: query.matchStatus }
      : query.exceptionsOnly
        ? { matchStatus: { in: EXCEPTION_MATCH_STATUSES } }
        : {};

    const lines = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...statusFilter,
      },
      orderBy: [{ batchId: 'desc' }, { lineNo: 'asc' }],
      take: query.limit ?? 200,
    });

    return this.enrichLines(tenantId, lines);
  }

  private async enrichLines(tenantId: string, lines: any[]) {
    const paymentIds = [
      ...new Set(lines.map((l) => l.paymentId).filter(Boolean)),
    ] as string[];
    const payments = paymentIds.length
      ? await this.db().paymentTransaction.findMany({
          where: { tenantId, id: { in: paymentIds } },
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            status: true,
            providerPaymentId: true,
            providerOrderId: true,
            externalReference: true,
            studentId: true,
            paidAt: true,
            reconStatus: true,
          },
        })
      : [];
    const paymentMap = new Map<string, any>(
      payments.map((p: any) => [p.id as string, p]),
    );
    const studentIds = [
      ...new Set(payments.map((p: any) => p.studentId).filter(Boolean)),
    ] as string[];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          select: {
            id: true,
            admissionNo: true,
            user: { select: { displayName: true } },
          },
        })
      : [];
    const studentMap = new Map<string, any>(
      students.map((s: any) => [s.id as string, s]),
    );

    return lines.map((line: any) => {
      const payment: any = line.paymentId
        ? paymentMap.get(line.paymentId)
        : undefined;
      const student: any = payment
        ? studentMap.get(payment.studentId)
        : undefined;
      return {
        ...line,
        grossAmount: Number(line.grossAmount),
        feeCharges: Number(line.feeCharges),
        taxAmount: Number(line.taxAmount),
        netAmount: Number(line.netAmount),
        amountDifference:
          line.amountDifference == null ? null : Number(line.amountDifference),
        payment: payment
          ? {
              ...payment,
              amount: Number(payment.amount),
              studentName: student?.user?.displayName ?? null,
              admissionNo: student?.admissionNo ?? null,
            }
          : null,
      };
    });
  }

  async importCsv(
    user: JwtUser,
    file: Express.Multer.File,
    opts?: { provider?: string; remarks?: string; autoMatch?: boolean },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No settlement file uploaded');
    }
    const rows = this.parseSettlementCsv(file.buffer);
    const provider = (opts?.provider || 'GENERIC').trim().toUpperCase();

    const batch = await this.db().feeSettlementBatch.create({
      data: {
        tenantId: user.tid,
        provider,
        fileName: file.originalname || 'settlement.csv',
        settlementDate: rows.find((r) => r.settlementDate)?.settlementDate,
        status: 'IMPORTED',
        rowCount: rows.length,
        importedById: user.sub,
        remarks: opts?.remarks,
        metadata: { source: 'csv_upload' },
      },
    });

    await this.db().feeSettlementLine.createMany({
      data: rows.map((row) => ({
        tenantId: user.tid,
        batchId: batch.id,
        lineNo: row.lineNo,
        gatewayTransactionId: row.gatewayTransactionId,
        gatewayPaymentId: row.gatewayPaymentId,
        gatewayOrderId: row.gatewayOrderId,
        utr: row.utr,
        receiptNo: row.receiptNo,
        studentIdentifier: row.studentIdentifier,
        grossAmount: row.grossAmount,
        feeCharges: row.feeCharges,
        taxAmount: row.taxAmount,
        netAmount: row.netAmount,
        settlementDate: row.settlementDate,
        currency: row.currency,
        matchStatus: 'PENDING',
        rawRow: row.rawRow,
      })),
    });

    if (opts?.autoMatch !== false) {
      await this.runAutoMatch(user.tid, batch.id);
    }

    return this.getBatchSummary(user.tid, batch.id);
  }

  async getBatchSummary(tenantId: string, batchId: string) {
    const batch = await this.getBatch(tenantId, batchId);
    const dash = await this.dashboard(tenantId, batchId);
    return { ...batch, dashboard: dash };
  }

  async runAutoMatch(tenantId: string, batchId: string) {
    await this.getBatch(tenantId, batchId);
    const lines = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        batchId,
        matchStatus: { in: ['PENDING', 'UNMATCHED', 'MANUAL_REVIEW'] },
      },
      orderBy: { lineNo: 'asc' },
    });

    const payments = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        status: { in: ['SUCCESS', 'COMPLETED', 'PAID', 'CLEARED'] },
      },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        providerPaymentId: true,
        providerOrderId: true,
        externalReference: true,
        studentId: true,
        paidAt: true,
        reconStatus: true,
      },
      take: 20_000,
    });

    const receipts = await this.db().feeReceipt.findMany({
      where: { tenantId },
      select: { id: true, receiptNo: true, paymentId: true, amount: true },
      take: 20_000,
    });

    const students = await this.db().student.findMany({
      where: { tenantId },
      select: { id: true, admissionNo: true },
      take: 20_000,
    });

    const byProviderPayment = new Map<string, any[]>();
    const byProviderOrder = new Map<string, any[]>();
    const byTxnNo = new Map<string, any[]>();
    const byExternalRef = new Map<string, any[]>();
    const byPaymentId = new Map<string, any>();

    const pushMap = (
      map: Map<string, any[]>,
      key: string | null | undefined,
      p: any,
    ) => {
      if (!key?.trim()) return;
      const k = key.trim().toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    };

    for (const p of payments) {
      byPaymentId.set(p.id, p);
      pushMap(byProviderPayment, p.providerPaymentId, p);
      pushMap(byProviderOrder, p.providerOrderId, p);
      pushMap(byTxnNo, p.transactionNo, p);
      pushMap(byExternalRef, p.externalReference, p);
    }

    const receiptByNo = new Map<string, any>(
      receipts.map((r: any) => [String(r.receiptNo).toLowerCase(), r]),
    );
    const studentByAdmission = new Map<string, string>(
      students
        .filter((s: any) => s.admissionNo)
        .map((s: any) => [String(s.admissionNo).toLowerCase(), s.id as string]),
    );
    const studentById = new Map<string, string>(
      students.map((s: any) => [s.id as string, s.id as string]),
    );

    const usedPaymentIds = new Set<string>();
    const alreadyLinked = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        paymentId: { not: null },
        matchStatus: { in: ['MATCHED', 'RECONCILED', 'AMOUNT_MISMATCH'] },
      },
      select: { paymentId: true },
      take: 20_000,
    });
    for (const row of alreadyLinked) {
      if (row.paymentId) usedPaymentIds.add(row.paymentId);
    }

    for (const line of lines) {
      const result = this.resolveMatch(line, {
        byProviderPayment,
        byProviderOrder,
        byTxnNo,
        byExternalRef,
        byPaymentId,
        receiptByNo,
        studentByAdmission,
        studentById,
        payments,
        usedPaymentIds,
      });

      await this.db().feeSettlementLine.update({
        where: { id: line.id },
        data: {
          matchStatus: result.matchStatus,
          matchMethod: result.matchMethod,
          paymentId: result.paymentId,
          receiptId: result.receiptId,
          amountDifference: result.amountDifference,
        },
      });

      if (result.paymentId) {
        usedPaymentIds.add(result.paymentId);
        await this.db().paymentTransaction.update({
          where: { id: result.paymentId },
          data: {
            reconStatus:
              result.matchStatus === 'AMOUNT_MISMATCH' ||
              result.matchStatus === 'DUPLICATE'
                ? 'EXCEPTION'
                : result.matchStatus === 'MATCHED'
                  ? 'MATCHED'
                  : 'UNRECONCILED',
          },
        });
      }
    }

    await this.refreshBatchCounts(tenantId, batchId);
    return this.getBatchSummary(tenantId, batchId);
  }

  private resolveMatch(
    line: any,
    ctx: {
      byProviderPayment: Map<string, any[]>;
      byProviderOrder: Map<string, any[]>;
      byTxnNo: Map<string, any[]>;
      byExternalRef: Map<string, any[]>;
      byPaymentId: Map<string, any>;
      receiptByNo: Map<string, any>;
      studentByAdmission: Map<string, string>;
      studentById: Map<string, string>;
      payments: any[];
      usedPaymentIds: Set<string>;
    },
  ): {
    matchStatus: FeeSettlementMatchStatus;
    matchMethod?: FeeSettlementMatchMethod;
    paymentId?: string;
    receiptId?: string;
    amountDifference?: number;
  } {
    const tryCandidates = (
      candidates: any[],
      method: FeeSettlementMatchMethod,
    ) => {
      if (!candidates.length) return null;
      const unique = [...new Map(candidates.map((c) => [c.id, c])).values()];
      if (unique.length > 1) {
        const unused = unique.filter((c) => !ctx.usedPaymentIds.has(c.id));
        if (unused.length === 1) {
          return this.scoreAmount(line, unused[0], method);
        }
        return {
          matchStatus: 'DUPLICATE' as FeeSettlementMatchStatus,
          matchMethod: method,
          paymentId: unique[0].id,
          amountDifference: this.diffAmount(line, unique[0]),
        };
      }
      const p = unique[0];
      if (ctx.usedPaymentIds.has(p.id) && p.reconStatus === 'RECONCILED') {
        return {
          matchStatus: 'DUPLICATE' as FeeSettlementMatchStatus,
          matchMethod: method,
          paymentId: p.id,
          amountDifference: this.diffAmount(line, p),
        };
      }
      return this.scoreAmount(line, p, method);
    };

    // 1) Transaction ID
    if (line.gatewayTransactionId) {
      const hit = tryCandidates(
        ctx.byTxnNo.get(String(line.gatewayTransactionId).toLowerCase()) ?? [],
        'TXN_ID',
      );
      if (hit) return hit;
    }

    // 2) Gateway ref (payment id / order id)
    if (line.gatewayPaymentId) {
      const hit = tryCandidates(
        ctx.byProviderPayment.get(
          String(line.gatewayPaymentId).toLowerCase(),
        ) ?? [],
        'GATEWAY_REF',
      );
      if (hit) return hit;
    }
    if (line.gatewayOrderId) {
      const hit = tryCandidates(
        ctx.byProviderOrder.get(String(line.gatewayOrderId).toLowerCase()) ??
          [],
        'GATEWAY_REF',
      );
      if (hit) return hit;
    }

    // 3) UTR / external reference
    if (line.utr) {
      const hit = tryCandidates(
        ctx.byExternalRef.get(String(line.utr).toLowerCase()) ?? [],
        'UTR',
      );
      if (hit) return hit;
    }

    // 4) Receipt number
    if (line.receiptNo) {
      const receipt = ctx.receiptByNo.get(String(line.receiptNo).toLowerCase());
      if (receipt?.paymentId) {
        const payment = ctx.byPaymentId.get(receipt.paymentId);
        if (payment) {
          const scored = this.scoreAmount(line, payment, 'RECEIPT');
          return { ...scored, receiptId: receipt.id };
        }
      }
    }

    // 5) Student + amount + date
    if (line.studentIdentifier && (line.grossAmount || line.netAmount)) {
      const sid =
        ctx.studentByAdmission.get(
          String(line.studentIdentifier).toLowerCase(),
        ) ||
        (ctx.studentById.has(line.studentIdentifier)
          ? line.studentIdentifier
          : null);
      if (sid) {
        const target = Number(line.grossAmount || line.netAmount);
        const settleDay = line.settlementDate
          ? new Date(line.settlementDate).toISOString().slice(0, 10)
          : null;
        const candidates = ctx.payments.filter((p) => {
          if (p.studentId !== sid) return false;
          if (Math.abs(Number(p.amount) - target) > 0.5) return false;
          if (!settleDay || !p.paidAt) return true;
          const paidDay = new Date(p.paidAt).toISOString().slice(0, 10);
          const diffDays = Math.abs(
            (Date.parse(paidDay) - Date.parse(settleDay)) / 86_400_000,
          );
          return diffDays <= 1;
        });
        const hit = tryCandidates(candidates, 'STUDENT_AMOUNT_DATE');
        if (hit) return hit;
      }
    }

    return { matchStatus: 'UNMATCHED' };
  }

  private diffAmount(line: any, payment: any) {
    const settlementAmt = Number(line.grossAmount || line.netAmount || 0);
    return (
      Math.round((settlementAmt - Number(payment.amount ?? 0)) * 100) / 100
    );
  }

  private scoreAmount(
    line: any,
    payment: any,
    method: FeeSettlementMatchMethod,
  ) {
    const diff = this.diffAmount(line, payment);
    if (Math.abs(diff) > 0.5) {
      return {
        matchStatus: 'AMOUNT_MISMATCH' as FeeSettlementMatchStatus,
        matchMethod: method,
        paymentId: payment.id,
        amountDifference: diff,
      };
    }
    return {
      matchStatus: 'MATCHED' as FeeSettlementMatchStatus,
      matchMethod: method,
      paymentId: payment.id,
      amountDifference: diff,
    };
  }

  private async refreshBatchCounts(tenantId: string, batchId: string) {
    const lines = await this.db().feeSettlementLine.findMany({
      where: { tenantId, batchId },
      select: { matchStatus: true },
    });
    const matchedCount = lines.filter((l: any) =>
      ['MATCHED', 'RECONCILED'].includes(l.matchStatus),
    ).length;
    const reconciledCount = lines.filter(
      (l: any) => l.matchStatus === 'RECONCILED',
    ).length;
    const exceptionCount = lines.filter((l: any) =>
      EXCEPTION_MATCH_STATUSES.includes(l.matchStatus),
    ).length;

    await this.db().feeSettlementBatch.update({
      where: { id: batchId },
      data: {
        rowCount: lines.length,
        matchedCount,
        exceptionCount,
        reconciledCount,
        status:
          reconciledCount === lines.length && lines.length > 0
            ? 'CLOSED'
            : matchedCount > 0
              ? 'MATCHED'
              : 'IMPORTED',
      },
    });
  }

  async markReconciled(user: JwtUser, lineId: string, remarks?: string) {
    const line = await this.db().feeSettlementLine.findFirst({
      where: { tenantId: user.tid, id: lineId },
    });
    if (!line) throw new NotFoundException('Settlement line not found');
    if (!line.paymentId) {
      throw new BadRequestException(
        'Link an ERP payment before marking reconciled',
      );
    }

    const updated = await this.db().feeSettlementLine.update({
      where: { id: lineId },
      data: {
        matchStatus: 'RECONCILED',
        remarks: remarks ?? line.remarks,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });

    await this.db().paymentTransaction.update({
      where: { id: line.paymentId },
      data: { reconStatus: 'RECONCILED' },
    });
    await this.refreshBatchCounts(user.tid, line.batchId);
    const [enriched] = await this.enrichLines(user.tid, [updated]);
    return enriched;
  }

  async markManualReview(user: JwtUser, lineId: string, remarks?: string) {
    const line = await this.db().feeSettlementLine.findFirst({
      where: { tenantId: user.tid, id: lineId },
    });
    if (!line) throw new NotFoundException('Settlement line not found');

    const updated = await this.db().feeSettlementLine.update({
      where: { id: lineId },
      data: {
        matchStatus: 'MANUAL_REVIEW',
        remarks: remarks ?? line.remarks,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });

    if (line.paymentId) {
      await this.db().paymentTransaction.update({
        where: { id: line.paymentId },
        data: { reconStatus: 'EXCEPTION' },
      });
    }
    await this.refreshBatchCounts(user.tid, line.batchId);
    const [enriched] = await this.enrichLines(user.tid, [updated]);
    return enriched;
  }

  async linkPayment(
    user: JwtUser,
    lineId: string,
    paymentId: string,
    remarks?: string,
  ) {
    const line = await this.db().feeSettlementLine.findFirst({
      where: { tenantId: user.tid, id: lineId },
    });
    if (!line) throw new NotFoundException('Settlement line not found');

    const payment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment transaction not found');

    const diff = this.diffAmount(line, payment);
    const matchStatus: FeeSettlementMatchStatus =
      Math.abs(diff) > 0.5 ? 'AMOUNT_MISMATCH' : 'MATCHED';

    const updated = await this.db().feeSettlementLine.update({
      where: { id: lineId },
      data: {
        paymentId,
        matchMethod: 'MANUAL',
        matchStatus,
        amountDifference: diff,
        remarks: remarks ?? line.remarks,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });

    await this.db().paymentTransaction.update({
      where: { id: paymentId },
      data: {
        reconStatus:
          matchStatus === 'AMOUNT_MISMATCH' ? 'EXCEPTION' : 'MATCHED',
      },
    });
    await this.refreshBatchCounts(user.tid, line.batchId);
    const [enriched] = await this.enrichLines(user.tid, [updated]);
    return enriched;
  }

  async updateRemarks(user: JwtUser, lineId: string, remarks: string) {
    const line = await this.db().feeSettlementLine.findFirst({
      where: { tenantId: user.tid, id: lineId },
    });
    if (!line) throw new NotFoundException('Settlement line not found');
    const updated = await this.db().feeSettlementLine.update({
      where: { id: lineId },
      data: {
        remarks,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });
    const [enriched] = await this.enrichLines(user.tid, [updated]);
    return enriched;
  }

  async exportCsv(
    tenantId: string,
    query: {
      batchId?: string;
      matchStatus?: string;
      exceptionsOnly?: boolean;
      report?: 'daily' | 'exceptions' | 'all';
    },
  ) {
    const report = query.report ?? 'all';
    const lines = await this.listLines(tenantId, {
      batchId: query.batchId,
      matchStatus: report === 'exceptions' ? undefined : query.matchStatus,
      exceptionsOnly: report === 'exceptions' || query.exceptionsOnly,
      limit: 10_000,
    });

    const headers = [
      'batchId',
      'lineNo',
      'matchStatus',
      'matchMethod',
      'gatewayPaymentId',
      'gatewayOrderId',
      'gatewayTransactionId',
      'utr',
      'receiptNo',
      'studentIdentifier',
      'grossAmount',
      'feeCharges',
      'taxAmount',
      'netAmount',
      'settlementDate',
      'amountDifference',
      'erpTransactionNo',
      'erpAmount',
      'studentName',
      'admissionNo',
      'remarks',
    ];

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = lines.map((l: any) =>
      [
        l.batchId,
        l.lineNo,
        l.matchStatus,
        l.matchMethod,
        l.gatewayPaymentId,
        l.gatewayOrderId,
        l.gatewayTransactionId,
        l.utr,
        l.receiptNo,
        l.studentIdentifier,
        l.grossAmount,
        l.feeCharges,
        l.taxAmount,
        l.netAmount,
        l.settlementDate
          ? new Date(l.settlementDate).toISOString().slice(0, 10)
          : '',
        l.amountDifference,
        l.payment?.transactionNo,
        l.payment?.amount,
        l.payment?.studentName,
        l.payment?.admissionNo,
        l.remarks,
      ]
        .map(escape)
        .join(','),
    );

    const content = [headers.join(','), ...rows].join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename =
      report === 'exceptions'
        ? `fee-recon-exceptions-${stamp}.csv`
        : report === 'daily'
          ? `fee-recon-daily-${stamp}.csv`
          : `fee-recon-${stamp}.csv`;

    return { format: 'csv' as const, content, filename };
  }

  csvTemplate(): { format: 'csv'; content: string; filename: string } {
    const content = [
      'payment_id,order_id,transaction_id,amount,fee,tax,net_amount,settlement_utr,settlement_date,receipt_no,admission_no',
      'pay_example123,order_example456,TXN001,5000,100,18,4882,UTR123456789,2026-07-18,RCP-001,ADM2026001',
    ].join('\n');
    return {
      format: 'csv',
      content,
      filename: 'fee-settlement-template.csv',
    };
  }
}
