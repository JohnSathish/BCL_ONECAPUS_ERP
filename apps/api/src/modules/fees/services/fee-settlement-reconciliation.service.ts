import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  EXCEPTION_MATCH_STATUSES,
  resolveSettlementHeaderMap,
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
    if (value == null || value === '') return 0;
    const cleaned = String(value)
      .replace(/[,₹\s]/g, '')
      .replace(/^\((.*)\)$/, '-$1');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private parseDate(value?: string | Date): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (value == null || !String(value).trim()) return undefined;
    const raw = String(value).trim();
    const iso = Date.parse(raw);
    if (!Number.isNaN(iso)) return new Date(iso);
    const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (mdy) {
      const d = Number(mdy[1]);
      const m = Number(mdy[2]);
      let y = Number(mdy[3]);
      if (y < 100) y += 2000;
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

  private cellToString(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value && 'text' in (value as object)) {
      return String((value as { text?: string }).text ?? '');
    }
    if (typeof value === 'object' && value && 'result' in (value as object)) {
      return String((value as { result?: unknown }).result ?? '');
    }
    return String(value);
  }

  private buildRowsFromMatrix(
    headers: string[],
    dataRows: string[][],
    provider?: string,
  ): ParsedSettlementRow[] {
    const aliases = resolveSettlementHeaderMap(provider);
    const mapped = headers.map((h) => aliases[h] ?? null);
    if (!mapped.some((m) => m && m !== 'ignore')) {
      throw new BadRequestException(
        'Unrecognized settlement headers. Expected columns like payment_id, order_id, amount, fee, tax, utr, settlement_date.',
      );
    }

    const rows: ParsedSettlementRow[] = [];
    dataRows.forEach((cols, idx) => {
      if (cols.every((c) => !String(c ?? '').trim())) return;
      const rawRow: Record<string, string> = {};
      const row: ParsedSettlementRow = {
        lineNo: idx + 1,
        grossAmount: 0,
        feeCharges: 0,
        taxAmount: 0,
        netAmount: 0,
        currency: 'INR',
        rawRow,
      };

      headers.forEach((header, colIdx) => {
        const value = cols[colIdx] ?? '';
        rawRow[header] = value;
        const field = mapped[colIdx];
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
      if (!hasIdentity && !row.grossAmount && !row.netAmount) return;
      rows.push(row);
    });

    if (!rows.length) {
      throw new BadRequestException('No settlement rows found in file');
    }
    return rows;
  }

  parseSettlementCsv(buffer: Buffer, provider?: string): ParsedSettlementRow[] {
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
    const dataRows = lines.slice(1).map((line) => this.splitCsvLine(line));
    return this.buildRowsFromMatrix(headers, dataRows, provider);
  }

  async parseSettlementXlsx(
    buffer: Buffer,
    provider?: string,
  ): Promise<ParsedSettlementRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel file has no worksheets');
    }
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = this.normalizeHeader(
        this.cellToString(cell.value),
      );
    });
    while (headers.length && !headers[headers.length - 1]) headers.pop();
    if (headers.length < 1) {
      throw new BadRequestException('Excel settlement sheet has no headers');
    }

    const dataRows: string[][] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cols: string[] = [];
      for (let c = 1; c <= headers.length; c++) {
        cols.push(this.cellToString(row.getCell(c).value));
      }
      dataRows.push(cols);
    });
    return this.buildRowsFromMatrix(headers, dataRows, provider);
  }

  async parseSettlementFile(
    file: Express.Multer.File,
    provider?: string,
  ): Promise<ParsedSettlementRow[]> {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isXlsx =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      mime.includes('spreadsheet') ||
      mime.includes('excel');
    if (isXlsx) {
      return this.parseSettlementXlsx(file.buffer, provider);
    }
    return this.parseSettlementCsv(file.buffer, provider);
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
        feeCharges: true,
        taxAmount: true,
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
    const totalFees = lines.reduce(
      (s: number, l: any) => s + Number(l.feeCharges ?? 0),
      0,
    );
    const totalTax = lines.reduce(
      (s: number, l: any) => s + Number(l.taxAmount ?? 0),
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
        settlementPending: byStatus.SETTLEMENT_PENDING?.count ?? 0,
        chargebacks: byStatus.CHARGEBACK?.count ?? 0,
        totalGross,
        totalFees,
        totalTax,
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
        bankAmountDifference:
          line.bankAmountDifference == null
            ? null
            : Number(line.bankAmountDifference),
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
    const provider = (opts?.provider || 'GENERIC').trim().toUpperCase();
    const rows = await this.parseSettlementFile(file, provider);

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
        provider: true,
        providerPaymentId: true,
        providerOrderId: true,
        externalReference: true,
        paymentMode: true,
        paymentSource: true,
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

    await this.flagUnsettledErpPayments(tenantId, batchId, usedPaymentIds);
    await this.detectChargebacks(tenantId, batchId);
    await this.runBankThreeWayMatch(tenantId, batchId);
    await this.refreshBatchCounts(tenantId, batchId);
    return this.getBatchSummary(tenantId, batchId);
  }

  /**
   * ERP SUCCESS gateway payments in the settlement window that were not matched
   * to any settlement file row → SETTLEMENT_PENDING exception lines.
   */
  private async flagUnsettledErpPayments(
    tenantId: string,
    batchId: string,
    matchedPaymentIds: Set<string>,
  ) {
    await this.db().feeSettlementLine.deleteMany({
      where: { tenantId, batchId, matchStatus: 'SETTLEMENT_PENDING' },
    });

    const batch = await this.getBatch(tenantId, batchId);
    const settlementLines = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        batchId,
        matchStatus: { not: 'SETTLEMENT_PENDING' },
      },
      select: { settlementDate: true, lineNo: true },
    });

    const dates = settlementLines
      .map((l: any) => (l.settlementDate ? new Date(l.settlementDate) : null))
      .filter(Boolean) as Date[];
    let from: Date;
    let to: Date;
    if (dates.length) {
      from = new Date(Math.min(...dates.map((d) => d.getTime())));
      to = new Date(Math.max(...dates.map((d) => d.getTime())));
    } else if (batch.settlementDate) {
      from = new Date(batch.settlementDate);
      to = new Date(batch.settlementDate);
    } else {
      to = new Date(batch.createdAt);
      from = new Date(to.getTime() - 7 * 86_400_000);
    }
    from = new Date(from.getTime() - 86_400_000);
    to = new Date(to.getTime() + 2 * 86_400_000);

    const candidates = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        status: { in: ['SUCCESS', 'COMPLETED', 'PAID', 'CLEARED'] },
        reconStatus: { notIn: ['RECONCILED'] },
        paidAt: { gte: from, lte: to },
        OR: [
          { provider: { not: null } },
          { providerPaymentId: { not: null } },
          { providerOrderId: { not: null } },
          { paymentSource: 'ERP_GATEWAY' },
          {
            paymentMode: {
              in: ['ONLINE', 'GATEWAY', 'UPI', 'CARD', 'NETBANKING'],
            },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        providerPaymentId: true,
        providerOrderId: true,
        transactionNo: true,
        externalReference: true,
        paidAt: true,
      },
      take: 5_000,
    });

    const maxLineNo = settlementLines.reduce(
      (m: number, l: any) => Math.max(m, Number(l.lineNo ?? 0)),
      0,
    );

    const unsettled = candidates.filter(
      (p: any) => !matchedPaymentIds.has(p.id),
    );
    if (!unsettled.length) return;

    await this.db().feeSettlementLine.createMany({
      data: unsettled.map((p: any, idx: number) => ({
        tenantId,
        batchId,
        lineNo: maxLineNo + idx + 1,
        gatewayPaymentId: p.providerPaymentId,
        gatewayOrderId: p.providerOrderId,
        gatewayTransactionId: p.transactionNo,
        utr: p.externalReference,
        grossAmount: Number(p.amount),
        netAmount: Number(p.amount),
        settlementDate: p.paidAt,
        matchStatus: 'SETTLEMENT_PENDING',
        paymentId: p.id,
        remarks: 'ERP payment not found in settlement file',
        rawRow: { source: 'erp_unsettled_scan' },
      })),
    });

    await this.db().paymentTransaction.updateMany({
      where: { id: { in: unsettled.map((p: any) => p.id) } },
      data: { reconStatus: 'EXCEPTION' },
    });
  }

  async searchPayments(
    tenantId: string,
    q: string,
    limit = 12,
  ): Promise<
    Array<{
      id: string;
      transactionNo: string;
      amount: number;
      status: string;
      paidAt?: string | null;
      providerPaymentId?: string | null;
      providerOrderId?: string | null;
      externalReference?: string | null;
      studentName?: string | null;
      admissionNo?: string | null;
      reconStatus?: string | null;
    }>
  > {
    const term = q.trim();
    if (term.length < 2) return [];

    const students = await this.db().student.findMany({
      where: {
        tenantId,
        OR: [
          { admissionNo: { contains: term, mode: 'insensitive' } },
          {
            user: {
              displayName: { contains: term, mode: 'insensitive' },
            },
          },
        ],
      },
      select: { id: true },
      take: 20,
    });
    const studentIds = students.map((s: any) => s.id);

    const payments = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        OR: [
          { transactionNo: { contains: term, mode: 'insensitive' } },
          { providerPaymentId: { contains: term, mode: 'insensitive' } },
          { providerOrderId: { contains: term, mode: 'insensitive' } },
          { externalReference: { contains: term, mode: 'insensitive' } },
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
          ...(term.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          )
            ? [{ id: term }]
            : []),
        ],
      },
      orderBy: { paidAt: 'desc' },
      take: limit,
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        status: true,
        paidAt: true,
        providerPaymentId: true,
        providerOrderId: true,
        externalReference: true,
        studentId: true,
        reconStatus: true,
      },
    });

    const payStudentIds = [
      ...new Set(payments.map((p: any) => p.studentId).filter(Boolean)),
    ];
    const studentRows = payStudentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: payStudentIds } },
          select: {
            id: true,
            admissionNo: true,
            user: { select: { displayName: true } },
          },
        })
      : [];
    const studentMap = new Map<string, any>(
      studentRows.map((s: any) => [s.id as string, s]),
    );

    return payments.map((p: any) => {
      const student: any = studentMap.get(p.studentId);
      return {
        id: p.id,
        transactionNo: p.transactionNo,
        amount: Number(p.amount),
        status: p.status,
        paidAt: p.paidAt,
        providerPaymentId: p.providerPaymentId,
        providerOrderId: p.providerOrderId,
        externalReference: p.externalReference,
        reconStatus: p.reconStatus,
        studentName: student?.user?.displayName ?? null,
        admissionNo: student?.admissionNo ?? null,
      };
    });
  }

  async countOpenExceptions(tenantId: string) {
    return this.db().feeSettlementLine.count({
      where: {
        tenantId,
        matchStatus: { in: EXCEPTION_MATCH_STATUSES },
      },
    });
  }

  async findFinanceUserIds(tenantId: string): Promise<string[]> {
    const permissions = await this.db().permission.findMany({
      where: { slug: { in: ['fees:manage', 'fees:reconcile'] } },
      select: { id: true },
    });
    if (!permissions.length) return [];
    const permissionIds = permissions.map((p: any) => p.id);

    const userIds = new Set<string>();
    const rolePerms = await this.db().rolePermission.findMany({
      where: {
        permissionId: { in: permissionIds },
        role: { tenantId, deletedAt: null },
      },
      select: { roleId: true },
    });
    const roleIds = rolePerms.map((r: any) => r.roleId);
    if (roleIds.length) {
      const userRoles = await this.db().userRole.findMany({
        where: { roleId: { in: roleIds }, deletedAt: null },
        select: { userId: true },
      });
      for (const ur of userRoles) userIds.add(ur.userId);
    }

    const direct = await this.db().userPermission.findMany({
      where: {
        permissionId: { in: permissionIds },
        user: { tenantId, deletedAt: null },
      },
      select: { userId: true },
    });
    for (const row of direct) userIds.add(row.userId);

    return [...userIds];
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

  async markChargeback(user: JwtUser, lineId: string, remarks?: string) {
    const line = await this.db().feeSettlementLine.findFirst({
      where: { tenantId: user.tid, id: lineId },
    });
    if (!line) throw new NotFoundException('Settlement line not found');

    const updated = await this.db().feeSettlementLine.update({
      where: { id: lineId },
      data: {
        matchStatus: 'CHARGEBACK',
        remarks:
          remarks ??
          line.remarks ??
          'Marked as chargeback / refunded settlement',
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

  async detectChargebacks(tenantId: string, batchId: string) {
    const lines = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        batchId,
        paymentId: { not: null },
        matchStatus: {
          notIn: ['CHARGEBACK', 'RECONCILED'],
        },
      },
      select: { id: true, paymentId: true },
      take: 10_000,
    });
    const paymentIds = lines
      .map((l: any) => l.paymentId)
      .filter(Boolean) as string[];
    if (!paymentIds.length) return { flagged: 0 };

    const refunds = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        OR: [
          { paymentMode: { in: ['REFUND', 'CHARGEBACK'] } },
          { status: { in: ['REFUNDED', 'REVERSED'] } },
        ],
      },
      select: { id: true, metadata: true, amount: true },
      take: 5_000,
    });

    const refundedOriginalIds = new Set<string>();
    for (const refund of refunds) {
      const meta = (refund.metadata ?? {}) as Record<string, unknown>;
      const originalId = meta.originalPaymentId;
      if (typeof originalId === 'string' && paymentIds.includes(originalId)) {
        refundedOriginalIds.add(originalId);
      }
    }

    const refundedReceipts = await this.db().feeReceipt.findMany({
      where: {
        tenantId,
        paymentId: { in: paymentIds },
        status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] },
      },
      select: { paymentId: true },
    });
    for (const r of refundedReceipts) {
      if (r.paymentId) refundedOriginalIds.add(r.paymentId);
    }

    let flagged = 0;
    for (const line of lines) {
      if (!line.paymentId || !refundedOriginalIds.has(line.paymentId)) continue;
      await this.db().feeSettlementLine.update({
        where: { id: line.id },
        data: {
          matchStatus: 'CHARGEBACK',
          remarks: 'Auto-detected refund / chargeback against ERP payment',
        },
      });
      await this.db().paymentTransaction.update({
        where: { id: line.paymentId },
        data: { reconStatus: 'EXCEPTION' },
      });
      flagged += 1;
    }
    return { flagged };
  }

  /**
   * Match settlement UTRs to accounting bank statement lines (3-way: ERP ↔ gateway ↔ bank).
   */
  async runBankThreeWayMatch(tenantId: string, batchId: string) {
    const lines = await this.db().feeSettlementLine.findMany({
      where: {
        tenantId,
        batchId,
        matchStatus: { not: 'SETTLEMENT_PENDING' },
      },
      select: {
        id: true,
        utr: true,
        netAmount: true,
        grossAmount: true,
        settlementDate: true,
      },
      take: 20_000,
    });

    const utrs = [
      ...new Set(
        lines
          .map((l: any) =>
            String(l.utr ?? '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    if (!utrs.length) {
      for (const line of lines) {
        await this.db().feeSettlementLine.update({
          where: { id: line.id },
          data: {
            bankMatchStatus: line.utr ? 'UNMATCHED' : 'PENDING',
            bankStatementLineId: null,
            bankAmountDifference: null,
          },
        });
      }
      return { matched: 0, unmatched: lines.length };
    }

    const bankLines = await this.db().accountingBankStatementLine.findMany({
      where: {
        tenantId,
        referenceNo: { not: null },
      },
      select: {
        id: true,
        referenceNo: true,
        creditAmount: true,
        debitAmount: true,
        lineDate: true,
      },
      take: 20_000,
    });

    const byRef = new Map<string, any[]>();
    for (const bl of bankLines) {
      const key = String(bl.referenceNo ?? '')
        .trim()
        .toLowerCase();
      if (!key) continue;
      if (!byRef.has(key)) byRef.set(key, []);
      byRef.get(key)!.push(bl);
    }

    let matched = 0;
    let unmatched = 0;
    for (const line of lines) {
      const utr = String(line.utr ?? '')
        .trim()
        .toLowerCase();
      if (!utr) {
        await this.db().feeSettlementLine.update({
          where: { id: line.id },
          data: {
            bankMatchStatus: 'PENDING',
            bankStatementLineId: null,
            bankAmountDifference: null,
          },
        });
        continue;
      }
      const candidates = byRef.get(utr) ?? [];
      if (!candidates.length) {
        unmatched += 1;
        await this.db().feeSettlementLine.update({
          where: { id: line.id },
          data: {
            bankMatchStatus: 'UNMATCHED',
            bankStatementLineId: null,
            bankAmountDifference: null,
          },
        });
        continue;
      }
      const settlementAmt = Number(line.netAmount || line.grossAmount || 0);
      const bank = candidates[0];
      const bankAmt = Math.max(
        Number(bank.creditAmount ?? 0),
        Number(bank.debitAmount ?? 0),
      );
      const diff = Math.round((settlementAmt - bankAmt) * 100) / 100;
      const status = Math.abs(diff) > 0.5 ? 'AMOUNT_MISMATCH' : 'MATCHED';
      if (status === 'MATCHED') matched += 1;
      else unmatched += 1;
      await this.db().feeSettlementLine.update({
        where: { id: line.id },
        data: {
          bankMatchStatus: status,
          bankStatementLineId: bank.id,
          bankAmountDifference: diff,
        },
      });
    }
    return { matched, unmatched };
  }

  async executiveSummary(tenantId: string) {
    const dash = await this.dashboard(tenantId);
    const lines = await this.db().feeSettlementLine.findMany({
      where: { tenantId },
      select: {
        matchStatus: true,
        bankMatchStatus: true,
        grossAmount: true,
        netAmount: true,
        feeCharges: true,
        taxAmount: true,
      },
      take: 20_000,
    });

    const threeWayOk = lines.filter(
      (l: any) =>
        ['MATCHED', 'RECONCILED'].includes(l.matchStatus) &&
        l.bankMatchStatus === 'MATCHED',
    ).length;
    const bankUnmatched = lines.filter(
      (l: any) => l.bankMatchStatus === 'UNMATCHED',
    ).length;
    const bankMismatch = lines.filter(
      (l: any) => l.bankMatchStatus === 'AMOUNT_MISMATCH',
    ).length;

    const matchRate =
      dash.kpis.totalLines > 0
        ? Math.round((dash.kpis.matched / dash.kpis.totalLines) * 1000) / 10
        : 100;

    return {
      asOf: new Date().toISOString(),
      headline: {
        collectionsGross: dash.kpis.totalGross,
        collectionsNet: dash.kpis.totalNet,
        gatewayFees: dash.kpis.totalFees,
        taxGst: dash.kpis.totalTax,
        matchRatePct: matchRate,
        openExceptions: dash.kpis.exceptions,
        chargebacks: dash.kpis.chargebacks ?? 0,
        settlementPending: dash.kpis.settlementPending ?? 0,
        threeWayMatched: threeWayOk,
        bankUnmatched,
        bankAmountMismatch: bankMismatch,
      },
      byStatus: dash.byStatus,
      recentBatches: dash.recentBatches,
      attentionNeeded: dash.kpis.exceptions > 0,
    };
  }

  async exportPdf(
    tenantId: string,
    query: { batchId?: string; report?: 'daily' | 'exceptions' | 'all' },
  ) {
    const report = query.report ?? 'all';
    const summary = await this.executiveSummary(tenantId);
    const lines = await this.listLines(tenantId, {
      batchId: query.batchId,
      exceptionsOnly: report === 'exceptions',
      limit: 500,
    });

    const kpi = summary.headline;
    const rowHtml = lines
      .map(
        (l: any) => `<tr>
        <td>${l.lineNo}</td>
        <td>${l.matchStatus}</td>
        <td>${l.bankMatchStatus ?? '—'}</td>
        <td>${l.gatewayPaymentId || l.gatewayTransactionId || '—'}</td>
        <td>${l.utr || '—'}</td>
        <td class="num">₹${Number(l.grossAmount).toLocaleString('en-IN')}</td>
        <td class="num">₹${Number(l.feeCharges).toLocaleString('en-IN')}</td>
        <td class="num">₹${Number(l.taxAmount).toLocaleString('en-IN')}</td>
        <td class="num">₹${Number(l.netAmount).toLocaleString('en-IN')}</td>
        <td>${l.payment?.transactionNo ?? '—'}</td>
        <td>${l.payment?.studentName ?? '—'}</td>
      </tr>`,
      )
      .join('');

    const title =
      report === 'exceptions'
        ? 'Fee Settlement Exceptions'
        : report === 'daily'
          ? 'Daily Fee Settlement Reconciliation'
          : 'Fee Settlement Reconciliation Pack';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:11px;color:#111}
      h1{font-size:18px;margin:0 0 8px}
      .meta{color:#555;margin-bottom:16px}
      .kpis{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}
      .kpi{border:1px solid #ddd;border-radius:6px;padding:8px 12px;min-width:120px}
      .kpi b{display:block;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#f3f4f6}
      .num{text-align:right}
    </style></head><body>
      <h1>${title}</h1>
      <div class="meta">Generated ${new Date().toLocaleString('en-IN')} · Lines shown: ${lines.length}</div>
      <div class="kpis">
        <div class="kpi">Gross<b>₹${kpi.collectionsGross.toLocaleString('en-IN')}</b></div>
        <div class="kpi">Net<b>₹${kpi.collectionsNet.toLocaleString('en-IN')}</b></div>
        <div class="kpi">Fees<b>₹${kpi.gatewayFees.toLocaleString('en-IN')}</b></div>
        <div class="kpi">Tax/GST<b>₹${kpi.taxGst.toLocaleString('en-IN')}</b></div>
        <div class="kpi">Match rate<b>${kpi.matchRatePct}%</b></div>
        <div class="kpi">Exceptions<b>${kpi.openExceptions}</b></div>
        <div class="kpi">Chargebacks<b>${kpi.chargebacks}</b></div>
        <div class="kpi">3-way OK<b>${kpi.threeWayMatched}</b></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>ERP match</th><th>Bank</th><th>Gateway</th><th>UTR</th>
          <th>Gross</th><th>Fee</th><th>Tax</th><th>Net</th><th>Txn</th><th>Student</th>
        </tr></thead>
        <tbody>${rowHtml || '<tr><td colspan="11">No rows</td></tr>'}</tbody>
      </table>
    </body></html>`;

    const buffer = await this.htmlToPdf(html);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      format: 'pdf' as const,
      buffer,
      filename: `fee-recon-${report}-${stamp}.pdf`,
    };
  }

  private async htmlToPdf(html: string) {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '12mm', right: '8mm', bottom: '12mm', left: '8mm' },
      });
      const buffer = Buffer.from(pdf);
      if (buffer.length < 500) {
        throw new Error('PDF generation produced an empty document');
      }
      return buffer;
    } finally {
      await browser.close();
    }
  }
}
