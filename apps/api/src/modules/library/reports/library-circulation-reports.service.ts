import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import {
  calendarDaysOverdue,
  fineStatus,
  parseTransactionCode,
  transactionCode,
  transactionStatus,
} from '../domain/library-circulation-ledger.logic';
import {
  FINE_STATUS_LABELS,
  REPORT_TITLES,
  RETURNER_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  csvCell,
  memberTypeLabel,
  resolveReportRange,
  startOfCollegeDate,
  type ReportRange,
} from '../domain/library-circulation-report.logic';
import {
  collegeDateIso,
  endOfCollegeDate,
} from '../domain/library-loan-calendar.logic';
import type {
  CirculationAnalyticsQueryDto,
  CirculationExportQueryDto,
  CirculationReportKey,
  CirculationReportQueryDto,
} from '../dto/circulation-report.dto';
import { LibraryLoanCalendarService } from '../services/library-loan-calendar.service';
import { LibrarySettingsService } from '../services/library-settings.service';

const EXPORT_CAP = 10_000;
const TZ = 'Asia/Kolkata';

type TxnWhere = Prisma.LibraryCirculationTransactionWhereInput;

const TXN_INCLUDE = {
  loan: {
    select: {
      status: true,
      dueAt: true,
      issuedAt: true,
      renewalCount: true,
      receiptNo: true,
      fines: { select: { amount: true, paidAt: true, waivedAt: true } },
    },
  },
  copy: {
    select: {
      accessionNumber: true,
      barcode: true,
      book: { select: { title: true, author: true, accessionNo: true } },
    },
  },
} satisfies Prisma.LibraryCirculationTransactionInclude;

type TxnRecord = Prisma.LibraryCirculationTransactionGetPayload<{
  include: typeof TXN_INCLUDE;
}>;

export type ReportColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
  pdf?: boolean;
  width?: number;
};

type Dataset = {
  title: string;
  columns: ReportColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  totals: [string, string | number][];
};

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
}

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  });
}

function money(value: number | null | undefined) {
  return value == null ? '' : Number(value).toFixed(2);
}

function contains(value: string) {
  return { contains: value, mode: 'insensitive' as const };
}

@Injectable()
export class LibraryCirculationReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanCalendar: LibraryLoanCalendarService,
    private readonly settings: LibrarySettingsService,
  ) {}

  async options(tenantId: string) {
    const [departments, academicYears, processors] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['processedById', 'processedByName'],
        where: { tenantId, processedById: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const staff = new Map<string, string>();
    for (const row of processors) {
      if (row.processedById && !staff.has(row.processedById)) {
        staff.set(row.processedById, row.processedByName ?? 'Unknown');
      }
    }
    return {
      departments,
      academicYears,
      processors: [...staff.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      memberTypes: ['STUDENT', 'FACULTY', 'STAFF', 'RESEARCH_SCHOLAR'].map(
        (value) => ({ value, label: memberTypeLabel(value) }),
      ),
    };
  }

  async summary(tenantId: string, q: CirculationReportQueryDto) {
    const range = await this.range(tenantId, q);
    const snap = this.snapshotWhere(q);
    const scoped: TxnWhere = {
      tenantId,
      ...snap,
      ...(q.processedById ? { processedById: q.processedById } : {}),
    };
    const inRange = { occurredAt: { gte: range.from, lte: range.to } };
    const todayIso = collegeDateIso(new Date());
    const today = {
      occurredAt: {
        gte: startOfCollegeDate(todayIso),
        lte: endOfCollegeDate(todayIso),
      },
    };
    const [
      issues,
      issueCopies,
      renewals,
      renewalCopies,
      returns,
      returnCopies,
      lateReturns,
      todayIssues,
      todayReturns,
      currentlyBorrowed,
      overdue,
    ] = await Promise.all([
      this.prisma.libraryCirculationTransaction.count({
        where: { ...scoped, ...inRange, transactionType: 'ISSUE' },
      }),
      this.distinctCopies({ ...scoped, ...inRange, transactionType: 'ISSUE' }),
      this.prisma.libraryCirculationTransaction.count({
        where: { ...scoped, ...inRange, transactionType: 'RENEW' },
      }),
      this.distinctCopies({ ...scoped, ...inRange, transactionType: 'RENEW' }),
      this.prisma.libraryCirculationTransaction.count({
        where: { ...scoped, ...inRange, transactionType: 'RETURN' },
      }),
      this.distinctCopies({ ...scoped, ...inRange, transactionType: 'RETURN' }),
      this.prisma.libraryCirculationTransaction.count({
        where: {
          ...scoped,
          ...inRange,
          transactionType: 'RETURN',
          isLate: true,
        },
      }),
      this.prisma.libraryCirculationTransaction.count({
        where: { ...scoped, ...today, transactionType: 'ISSUE' },
      }),
      this.prisma.libraryCirculationTransaction.count({
        where: { ...scoped, ...today, transactionType: 'RETURN' },
      }),
      this.prisma.libraryLoan.count({
        where: this.loanWhere(tenantId, q, range, 'current'),
      }),
      this.prisma.libraryLoan.count({
        where: this.loanWhere(tenantId, q, range, 'overdue'),
      }),
    ]);
    return {
      range: this.rangeOut(range),
      totalIssues: issues,
      issuedCopies: issueCopies,
      totalRenewals: renewals,
      renewedCopies: renewalCopies,
      totalReturns: returns,
      returnedCopies: returnCopies,
      currentlyBorrowed,
      overdue,
      lateReturns,
      todayIssues,
      todayReturns,
    };
  }

  async rows(tenantId: string, q: CirculationReportQueryDto) {
    const report = q.report ?? 'all';
    const range = await this.range(tenantId, q);
    if (report === 'current' || report === 'overdue') {
      return this.loanRows(tenantId, q, range, report);
    }
    if (report === 'departments') {
      return {
        kind: 'departments' as const,
        range: this.rangeOut(range),
        items: await this.departmentRows(tenantId, q, range),
      };
    }
    if (report === 'librarians') {
      return {
        kind: 'librarians' as const,
        range: this.rangeOut(range),
        items: await this.librarianRows(tenantId, q, range),
      };
    }
    if (report === 'lost-damaged') {
      return this.incidentRows(tenantId, q, range);
    }
    return this.transactionRows(tenantId, q, range, report);
  }

  async analytics(tenantId: string, q: CirculationAnalyticsQueryDto) {
    const year = q.year ?? Number(collegeDateIso(new Date()).slice(0, 4));
    const range = resolveReportRange(
      {
        from: q.from ?? `${year}-01-01`,
        to: q.to ?? `${year}-12-31`,
      },
      null,
    );
    const filters = [
      Prisma.sql`t.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`t.occurred_at BETWEEN ${range.from} AND ${range.to}`,
      ...(q.departmentId
        ? [Prisma.sql`t.department_id = CAST(${q.departmentId} AS uuid)`]
        : []),
      ...(q.memberType ? [Prisma.sql`t.member_type = ${q.memberType}`] : []),
    ];
    const where = Prisma.join(filters, ' AND ');
    const issueWhere = Prisma.sql`${where} AND t.transaction_type = 'ISSUE'`;
    const local = Prisma.sql`((t.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})`;

    const loanFilters = [
      Prisma.sql`l.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`l.due_at BETWEEN ${range.from} AND ${range.to}`,
      Prisma.sql`l.due_at < ${new Date()}`,
      Prisma.sql`(l.returned_at IS NULL OR l.returned_at > l.due_at)`,
      ...(q.departmentId || q.memberType
        ? [
            Prisma.sql`EXISTS (SELECT 1 FROM library.library_circulation_transactions t
              WHERE t.loan_id = l.id AND t.transaction_type = 'ISSUE'
              ${q.departmentId ? Prisma.sql`AND t.department_id = CAST(${q.departmentId} AS uuid)` : Prisma.empty}
              ${q.memberType ? Prisma.sql`AND t.member_type = ${q.memberType}` : Prisma.empty})`,
          ]
        : []),
    ];

    const [
      monthly,
      overdueMonthly,
      departments,
      books,
      students,
      staff,
      memberTypes,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; type: string; count: number }[]>`
          SELECT to_char(${local}, 'YYYY-MM') AS month, t.transaction_type AS type, COUNT(*)::int AS count
          FROM library.library_circulation_transactions t
          WHERE ${where}
          GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT to_char((l.due_at AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM library.library_loans l
          WHERE ${Prisma.join(loanFilters, ' AND ')}
          GROUP BY 1`,
      this.prisma.$queryRaw<
        {
          department: string | null;
          issues: number;
          returns: number;
          renewals: number;
        }[]
      >`
          SELECT COALESCE(t.department_name, 'No department') AS department,
            COUNT(*) FILTER (WHERE t.transaction_type = 'ISSUE')::int AS issues,
            COUNT(*) FILTER (WHERE t.transaction_type = 'RETURN')::int AS returns,
            COUNT(*) FILTER (WHERE t.transaction_type = 'RENEW')::int AS renewals
          FROM library.library_circulation_transactions t
          WHERE ${where}
          GROUP BY 1
          ORDER BY issues DESC
          LIMIT 15`,
      this.prisma.$queryRaw<
        { title: string; author: string | null; count: number }[]
      >`
          SELECT b.title, b.author, COUNT(*)::int AS count
          FROM library.library_circulation_transactions t
          JOIN library.library_book_copies c ON c.id = t.copy_id
          JOIN library.library_books b ON b.id = c.book_id
          WHERE ${issueWhere}
          GROUP BY b.id, b.title, b.author
          ORDER BY count DESC, b.title
          LIMIT 10`,
      this.prisma.$queryRaw<
        {
          name: string | null;
          code: string | null;
          department: string | null;
          count: number;
        }[]
      >`
          SELECT MAX(t.borrower_name) AS name, MAX(t.borrower_code) AS code,
            MAX(t.department_name) AS department, COUNT(*)::int AS count
          FROM library.library_circulation_transactions t
          WHERE ${issueWhere} AND t.student_id IS NOT NULL
          GROUP BY t.student_id
          ORDER BY count DESC
          LIMIT 10`,
      this.prisma.$queryRaw<
        {
          name: string | null;
          code: string | null;
          department: string | null;
          count: number;
        }[]
      >`
          SELECT MAX(t.borrower_name) AS name, MAX(t.borrower_code) AS code,
            MAX(t.department_name) AS department, COUNT(*)::int AS count
          FROM library.library_circulation_transactions t
          WHERE ${issueWhere} AND t.staff_profile_id IS NOT NULL
          GROUP BY t.staff_profile_id
          ORDER BY count DESC
          LIMIT 10`,
      this.prisma.$queryRaw<{ memberType: string; count: number }[]>`
          SELECT t.member_type AS "memberType", COUNT(*)::int AS count
          FROM library.library_circulation_transactions t
          WHERE ${issueWhere}
          GROUP BY 1
          ORDER BY count DESC`,
    ]);

    const months: string[] = [];
    let cursor = range.fromIso.slice(0, 7);
    const lastMonth = range.toIso.slice(0, 7);
    while (cursor <= lastMonth && months.length < 60) {
      months.push(cursor);
      const [y, m] = cursor.split('-').map(Number);
      cursor =
        m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    const count = (month: string, type: string) =>
      monthly.find((r) => r.month === month && r.type === type)?.count ?? 0;

    return {
      range: this.rangeOut(range),
      monthly: months.map((month) => ({
        month,
        issues: count(month, 'ISSUE'),
        returns: count(month, 'RETURN'),
        renewals: count(month, 'RENEW'),
        overdue: overdueMonthly.find((r) => r.month === month)?.count ?? 0,
      })),
      departments,
      mostBorrowedBooks: books,
      topStudents: students,
      topStaff: staff,
      byMemberType: memberTypes.map((r) => ({
        ...r,
        label: memberTypeLabel(r.memberType),
      })),
    };
  }

  async export(tenantId: string, q: CirculationExportQueryDto) {
    const report = q.report ?? 'all';
    const range = await this.range(tenantId, q);
    const dataset = await this.dataset(tenantId, q, report, range);
    const header = await this.header(tenantId, q, range);
    const slug = `library-circulation-${report}-${range.fromIso}-to-${range.toIso}`;
    if (q.format === 'csv') {
      const lines = [
        dataset.columns.map((c) => csvCell(c.label)).join(','),
        ...dataset.rows.map((row) =>
          dataset.columns.map((c) => csvCell(c.value(row))).join(','),
        ),
      ];
      return {
        buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'),
        filename: `${slug}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }
    if (q.format === 'xlsx') {
      return {
        buffer: await this.excel(dataset, header),
        filename: `${slug}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    return {
      buffer: await this.htmlToPdf(this.pdfHtml(dataset, header)),
      filename: `${slug}.pdf`,
      contentType: 'application/pdf',
    };
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  private async range(
    tenantId: string,
    q: { from?: string; to?: string; academicYearId?: string },
  ) {
    const academicYear = q.academicYearId
      ? await this.prisma.academicYear.findFirst({
          where: { id: q.academicYearId, tenantId, deletedAt: null },
          select: { startDate: true, endDate: true },
        })
      : null;
    if (q.academicYearId && !academicYear) {
      throw new BadRequestException('Academic year not found');
    }
    return resolveReportRange(q, academicYear);
  }

  private rangeOut(range: ReportRange) {
    return { from: range.fromIso, to: range.toIso, asOf: range.asOf };
  }

  /** Filters on the borrower snapshot and the book, shared by every report. */
  private snapshotWhere(q: CirculationReportQueryDto): TxnWhere {
    const and: TxnWhere[] = [];
    if (q.departmentId) and.push({ departmentId: q.departmentId });
    if (q.memberType) and.push({ memberType: q.memberType });
    if (q.semester) and.push({ semesterNo: q.semester });
    if (q.memberId) {
      and.push({
        OR: [{ studentId: q.memberId }, { staffProfileId: q.memberId }],
      });
    }
    const borrower = q.borrower?.trim();
    if (borrower) {
      and.push({
        OR: [
          { borrowerName: contains(borrower) },
          { borrowerCode: contains(borrower) },
        ],
      });
    }
    const title = q.bookTitle?.trim();
    if (title) and.push({ copy: { book: { title: contains(title) } } });
    const accession = q.accession?.trim();
    if (accession) {
      and.push({
        OR: [
          { copy: { accessionNumber: contains(accession) } },
          { copy: { barcode: contains(accession) } },
          { copy: { book: { accessionNo: contains(accession) } } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  private searchWhere(search?: string): TxnWhere | null {
    const term = search?.trim();
    if (!term) return null;
    const or: TxnWhere[] = [
      { borrowerName: contains(term) },
      { borrowerCode: contains(term) },
      { returnedByName: contains(term) },
      { processedByName: contains(term) },
      { copy: { book: { title: contains(term) } } },
      { copy: { accessionNumber: contains(term) } },
      { copy: { barcode: contains(term) } },
    ];
    const seq = parseTransactionCode(term);
    if (seq) or.push({ seqNo: seq });
    return { OR: or };
  }

  private statusWhere(status?: string): TxnWhere | null {
    const notLostOrDamaged: TxnWhere = {
      OR: [
        { bookCondition: null },
        { bookCondition: { notIn: ['LOST', 'DAMAGED'] } },
      ],
    };
    const now = new Date();
    switch (status) {
      case 'RENEWED':
        return { transactionType: 'RENEW' };
      case 'LOST':
        return { transactionType: 'RETURN', bookCondition: 'LOST' };
      case 'RETURNED_DAMAGED':
        return { transactionType: 'RETURN', bookCondition: 'DAMAGED' };
      case 'RETURNED_LATE':
        return {
          AND: [{ transactionType: 'RETURN', isLate: true }, notLostOrDamaged],
        };
      case 'RETURNED':
        return {
          OR: [
            {
              AND: [
                { transactionType: 'RETURN', isLate: false },
                notLostOrDamaged,
              ],
            },
            { transactionType: 'ISSUE', loan: { status: { not: 'ACTIVE' } } },
          ],
        };
      case 'ON_LOAN':
        return {
          transactionType: 'ISSUE',
          loan: { status: 'ACTIVE', dueAt: { gte: now } },
        };
      case 'OVERDUE':
        return {
          transactionType: 'ISSUE',
          loan: { status: 'ACTIVE', dueAt: { lt: now } },
        };
      default:
        return null;
    }
  }

  private txnWhere(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
    report: CirculationReportKey,
  ): TxnWhere {
    const and: TxnWhere[] = [
      { tenantId, occurredAt: { gte: range.from, lte: range.to } },
      this.snapshotWhere(q),
    ];
    if (report === 'issued') and.push({ transactionType: 'ISSUE' });
    if (report === 'renewed') and.push({ transactionType: 'RENEW' });
    if (report === 'returned') and.push({ transactionType: 'RETURN' });
    if (report === 'late')
      and.push({ transactionType: 'RETURN', isLate: true });
    if (q.type) and.push({ transactionType: q.type });
    if (q.processedById) and.push({ processedById: q.processedById });
    const status = this.statusWhere(q.status);
    if (status) and.push(status);
    const search = this.searchWhere(q.search);
    if (search) and.push(search);
    return { AND: and };
  }

  /** Loans on loan at the end of the range (or now, if the range ends later). */
  private loanWhere(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
    mode: 'current' | 'overdue',
  ): Prisma.LibraryLoanWhereInput {
    const issueFilter: TxnWhere = {
      transactionType: 'ISSUE',
      ...this.snapshotWhere(q),
    };
    const and: Prisma.LibraryLoanWhereInput[] = [
      { tenantId, issuedAt: { lte: range.asOf } },
      { OR: [{ returnedAt: null }, { returnedAt: { gt: range.asOf } }] },
      { transactions: { some: issueFilter } },
    ];
    if (mode === 'overdue') and.push({ dueAt: { lt: range.asOf } });
    if (q.processedById) and.push({ issuedById: q.processedById });
    const term = q.search?.trim();
    if (term) {
      and.push({
        OR: [
          { copy: { book: { title: contains(term) } } },
          { copy: { accessionNumber: contains(term) } },
          { copy: { barcode: contains(term) } },
          { receiptNo: contains(term) },
          {
            transactions: {
              some: {
                transactionType: 'ISSUE',
                OR: [
                  { borrowerName: contains(term) },
                  { borrowerCode: contains(term) },
                ],
              },
            },
          },
        ],
      });
    }
    return { AND: and };
  }

  private async distinctCopies(where: TxnWhere) {
    const rows = await this.prisma.libraryCirculationTransaction.groupBy({
      by: ['copyId'],
      where,
    });
    return rows.length;
  }

  // ---------------------------------------------------------------------------
  // Report rows
  // ---------------------------------------------------------------------------

  private txnOrder(
    q: CirculationReportQueryDto,
  ): Prisma.LibraryCirculationTransactionOrderByWithRelationInput[] {
    const dir = q.sortDir === 'asc' ? 'asc' : 'desc';
    switch (q.sortBy) {
      case 'transactionId':
        return [{ seqNo: dir }];
      case 'borrower':
        return [{ borrowerName: dir }, { occurredAt: 'desc' }];
      case 'department':
        return [{ departmentName: dir }, { occurredAt: 'desc' }];
      case 'type':
        return [{ transactionType: dir }, { occurredAt: 'desc' }];
      case 'title':
        return [{ copy: { book: { title: dir } } }, { occurredAt: 'desc' }];
      case 'accession':
        return [{ copy: { accessionNumber: dir } }, { occurredAt: 'desc' }];
      case 'fine':
        return [
          { fineAmount: { sort: dir, nulls: 'last' } },
          { occurredAt: 'desc' },
        ];
      case 'processedBy':
        return [{ processedByName: dir }, { occurredAt: 'desc' }];
      default:
        return [{ occurredAt: dir }, { seqNo: dir }];
    }
  }

  private mapTxn(row: TxnRecord, now: Date) {
    const status = transactionStatus(row, row.loan, now);
    const fine = row.fineAmount != null ? Number(row.fineAmount) : null;
    const fStatus =
      row.transactionType === 'RETURN' || fine
        ? fineStatus(row.loan.fines)
        : 'NONE';
    return {
      id: row.id,
      transactionId: transactionCode(row.seqNo),
      occurredAt: row.occurredAt,
      type: row.transactionType,
      typeLabel: TYPE_LABELS[row.transactionType] ?? row.transactionType,
      accession:
        row.copy.accessionNumber ||
        row.copy.book.accessionNo ||
        row.copy.barcode,
      title: row.copy.book.title,
      author: row.copy.book.author,
      department: row.departmentName,
      borrowerName: row.borrowerName,
      borrowerCode: row.borrowerCode,
      memberType: row.memberType,
      memberTypeLabel: memberTypeLabel(row.memberType),
      semester: row.semesterNo,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt,
      currentDueAt: row.loan.dueAt,
      previousDueAt: row.previousDueAt,
      renewalCount:
        row.transactionType === 'RENEW'
          ? row.renewalNumber
          : row.loan.renewalCount,
      returnedAt: row.returnedAt,
      returnedByType: row.returnedByType,
      returnedByTypeLabel: row.returnedByType
        ? (RETURNER_LABELS[row.returnedByType] ?? row.returnedByType)
        : row.transactionType === 'RETURN'
          ? 'Not recorded'
          : null,
      returnedByName: row.returnedByName,
      returnedByCode: row.returnedByCode,
      processedBy: row.processedByName,
      bookCondition: row.bookCondition,
      daysLate: row.daysLate,
      isLate: row.isLate,
      fineAmount: fine,
      fineStatus: fStatus,
      fineStatusLabel: FINE_STATUS_LABELS[fStatus],
      status,
      statusLabel: STATUS_LABELS[status],
      remarks: row.remarks,
      source: row.source,
      receiptNo: row.loan.receiptNo,
    };
  }

  private async transactionRows(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
    report: CirculationReportKey,
    all = false,
  ) {
    const where = this.txnWhere(tenantId, q, range, report);
    const limit = all ? EXPORT_CAP : Math.min(200, q.limit ?? 25);
    const page = all ? 1 : Math.max(1, q.page ?? 1);
    const [total, rows] = await Promise.all([
      this.prisma.libraryCirculationTransaction.count({ where }),
      this.prisma.libraryCirculationTransaction.findMany({
        where,
        include: TXN_INCLUDE,
        orderBy: this.txnOrder(q),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const now = new Date();
    return {
      kind: 'transactions' as const,
      range: this.rangeOut(range),
      items: rows.map((row) => this.mapTxn(row, now)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async loanRows(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
    mode: 'current' | 'overdue',
    all = false,
  ) {
    const where = this.loanWhere(tenantId, q, range, mode);
    const limit = all ? EXPORT_CAP : Math.min(200, q.limit ?? 25);
    const page = all ? 1 : Math.max(1, q.page ?? 1);
    const dir =
      q.sortDir === 'asc' ? 'asc' : q.sortDir === 'desc' ? 'desc' : null;
    const orderBy: Prisma.LibraryLoanOrderByWithRelationInput[] =
      q.sortBy === 'issuedAt'
        ? [{ issuedAt: dir ?? 'desc' }]
        : q.sortBy === 'title'
          ? [{ copy: { book: { title: dir ?? 'asc' } } }]
          : [{ dueAt: dir ?? 'asc' }];
    const [total, loans] = await Promise.all([
      this.prisma.libraryLoan.count({ where }),
      this.prisma.libraryLoan.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          copy: {
            select: {
              accessionNumber: true,
              barcode: true,
              book: {
                select: { title: true, author: true, accessionNo: true },
              },
            },
          },
          fines: { select: { amount: true, paidAt: true, waivedAt: true } },
          transactions: {
            where: { transactionType: 'ISSUE' },
            take: 1,
            select: {
              borrowerName: true,
              borrowerCode: true,
              departmentName: true,
              processedByName: true,
              semesterNo: true,
            },
          },
        },
      }),
    ]);

    const studentIds = loans
      .map((l) => l.studentId)
      .filter((id): id is string => Boolean(id));
    const staffIds = loans
      .map((l) => l.staffProfileId)
      .filter((id): id is string => Boolean(id));
    const [students, staff, settings] = await Promise.all([
      studentIds.length
        ? this.prisma.studentProfile.findMany({
            where: { studentId: { in: studentIds } },
            select: { studentId: true, mobileNumber: true },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, mobile: true },
          })
        : [],
      this.settings.getSettings(tenantId),
    ]);
    const mobile = new Map<string, string | null>([
      ...students.map(
        (s) => [s.studentId, s.mobileNumber] as [string, string | null],
      ),
      ...staff.map((s) => [s.id, s.mobile] as [string, string | null]),
    ]);
    const now = new Date();
    const active = loans.filter((l) => l.status === 'ACTIVE');
    const assessed = await this.loanCalendar.assessMany(
      tenantId,
      active.map((l) => ({ dueAt: l.dueAt })),
      now,
      settings,
    );
    const projected = new Map(
      active.map((l, i) => [l.id, assessed[i]?.fine ?? 0]),
    );

    const items = loans.map((loan) => {
      const issue = loan.transactions[0];
      const unpaid = loan.fines
        .filter((f) => !f.paidAt && !f.waivedAt)
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const overdueDays = calendarDaysOverdue(loan.dueAt, range.asOf);
      return {
        id: loan.id,
        receiptNo: loan.receiptNo,
        accession:
          loan.copy.accessionNumber ||
          loan.copy.book.accessionNo ||
          loan.copy.barcode,
        title: loan.copy.book.title,
        author: loan.copy.book.author,
        borrowerName: issue?.borrowerName ?? null,
        borrowerCode: issue?.borrowerCode ?? null,
        department: issue?.departmentName ?? null,
        semester: issue?.semesterNo ?? null,
        memberType: loan.memberType,
        memberTypeLabel: memberTypeLabel(loan.memberType),
        mobile: mobile.get(loan.studentId ?? loan.staffProfileId ?? '') ?? null,
        issuedAt: loan.issuedAt,
        dueAt: loan.dueAt,
        renewalCount: loan.renewalCount,
        overdueDays,
        isOverdue: overdueDays > 0,
        outstandingFine: Math.max(unpaid, projected.get(loan.id) ?? 0),
        issuedBy: issue?.processedByName ?? null,
        status:
          loan.status === 'ACTIVE'
            ? overdueDays > 0
              ? 'OVERDUE'
              : 'ON_LOAN'
            : 'RETURNED',
        statusLabel:
          loan.status === 'ACTIVE'
            ? overdueDays > 0
              ? 'Overdue'
              : 'On loan'
            : `Returned ${fmtDate(loan.returnedAt)}`,
      };
    });
    return {
      kind: 'loans' as const,
      range: this.rangeOut(range),
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async departmentRows(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
  ) {
    const where: TxnWhere = {
      tenantId,
      occurredAt: { gte: range.from, lte: range.to },
      ...this.snapshotWhere(q),
      ...(q.processedById ? { processedById: q.processedById } : {}),
    };
    const [byType, late, borrowers, current, overdue] = await Promise.all([
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['departmentId', 'departmentName', 'transactionType'],
        where,
        _count: { _all: true },
      }),
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['departmentId'],
        where: { ...where, transactionType: 'RETURN', isLate: true },
        _count: { _all: true },
      }),
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['departmentId', 'studentId', 'staffProfileId'],
        where: { ...where, transactionType: 'ISSUE' },
      }),
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['departmentId'],
        where: {
          tenantId,
          transactionType: 'ISSUE',
          ...this.snapshotWhere(q),
          loan: this.loanWhere(
            tenantId,
            { ...q, search: undefined },
            range,
            'current',
          ),
        },
        _count: { _all: true },
      }),
      this.prisma.libraryCirculationTransaction.groupBy({
        by: ['departmentId'],
        where: {
          tenantId,
          transactionType: 'ISSUE',
          ...this.snapshotWhere(q),
          loan: this.loanWhere(
            tenantId,
            { ...q, search: undefined },
            range,
            'overdue',
          ),
        },
        _count: { _all: true },
      }),
    ]);
    type Row = {
      departmentId: string | null;
      department: string;
      issues: number;
      renewals: number;
      returns: number;
      lateReturns: number;
      currentlyBorrowed: number;
      overdue: number;
      borrowers: number;
    };
    const rows = new Map<string, Row>();
    const row = (id: string | null, name?: string | null) => {
      const key = id ?? 'none';
      let entry = rows.get(key);
      if (!entry) {
        entry = {
          departmentId: id,
          department: name ?? (id ? 'Unknown department' : 'No department'),
          issues: 0,
          renewals: 0,
          returns: 0,
          lateReturns: 0,
          currentlyBorrowed: 0,
          overdue: 0,
          borrowers: 0,
        };
        rows.set(key, entry);
      } else if (name && entry.department === 'Unknown department') {
        entry.department = name;
      }
      return entry;
    };
    for (const r of byType) {
      const entry = row(r.departmentId, r.departmentName);
      if (r.transactionType === 'ISSUE') entry.issues += r._count._all;
      if (r.transactionType === 'RENEW') entry.renewals += r._count._all;
      if (r.transactionType === 'RETURN') entry.returns += r._count._all;
    }
    for (const r of late) row(r.departmentId).lateReturns = r._count._all;
    for (const r of borrowers) row(r.departmentId).borrowers += 1;
    for (const r of current)
      row(r.departmentId).currentlyBorrowed = r._count._all;
    for (const r of overdue) row(r.departmentId).overdue = r._count._all;
    const missing = [...rows.values()].filter(
      (r) => r.departmentId && r.department === 'Unknown department',
    );
    if (missing.length) {
      const names = await this.prisma.department.findMany({
        where: { id: { in: missing.map((r) => r.departmentId!) } },
        select: { id: true, name: true },
      });
      for (const n of names) {
        const entry = rows.get(n.id);
        if (entry) entry.department = n.name;
      }
    }
    return [...rows.values()].sort(
      (a, b) => b.issues - a.issues || a.department.localeCompare(b.department),
    );
  }

  private async librarianRows(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
  ) {
    const groups = await this.prisma.libraryCirculationTransaction.groupBy({
      by: ['processedById', 'processedByName', 'transactionType'],
      where: {
        tenantId,
        occurredAt: { gte: range.from, lte: range.to },
        ...this.snapshotWhere(q),
        ...(q.processedById ? { processedById: q.processedById } : {}),
      },
      _count: { _all: true },
      _max: { occurredAt: true },
    });
    type Row = {
      processedById: string | null;
      name: string;
      issues: number;
      renewals: number;
      returns: number;
      total: number;
      lastActivityAt: Date | null;
    };
    const rows = new Map<string, Row>();
    for (const g of groups) {
      const key = g.processedById ?? 'none';
      const entry = rows.get(key) ?? {
        processedById: g.processedById,
        name:
          g.processedByName ??
          (g.processedById ? 'Unknown user' : 'Not recorded'),
        issues: 0,
        renewals: 0,
        returns: 0,
        total: 0,
        lastActivityAt: null,
      };
      if (g.transactionType === 'ISSUE') entry.issues += g._count._all;
      if (g.transactionType === 'RENEW') entry.renewals += g._count._all;
      if (g.transactionType === 'RETURN') entry.returns += g._count._all;
      entry.total += g._count._all;
      const last = g._max.occurredAt;
      if (last && (!entry.lastActivityAt || last > entry.lastActivityAt)) {
        entry.lastActivityAt = last;
        if (g.processedByName) entry.name = g.processedByName;
      }
      rows.set(key, entry);
    }
    return [...rows.values()].sort((a, b) => b.total - a.total);
  }

  private async incidentRows(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
    all = false,
  ) {
    const snapshot = this.snapshotWhere(q);
    const hasSnapshot = Object.keys(snapshot).length > 0;
    const term = q.search?.trim();
    const where: Prisma.LibraryCopyIncidentWhereInput = {
      tenantId,
      incidentType: { in: ['LOST', 'DAMAGED'] },
      createdAt: { gte: range.from, lte: range.to },
      ...(q.status === 'LOST'
        ? { incidentType: 'LOST' }
        : q.status === 'RETURNED_DAMAGED'
          ? { incidentType: 'DAMAGED' }
          : {}),
      ...(term
        ? {
            OR: [
              { copy: { book: { title: contains(term) } } },
              { copy: { accessionNumber: contains(term) } },
              { copy: { barcode: contains(term) } },
              { notes: contains(term) },
            ],
          }
        : {}),
    };
    const limit = all ? EXPORT_CAP : Math.min(200, q.limit ?? 25);
    const page = all ? 1 : Math.max(1, q.page ?? 1);
    const incidents = await this.prisma.libraryCopyIncident.findMany({
      where,
      orderBy: { createdAt: q.sortDir === 'asc' ? 'asc' : 'desc' },
      include: {
        copy: {
          select: {
            accessionNumber: true,
            barcode: true,
            book: { select: { title: true, author: true, accessionNo: true } },
          },
        },
      },
    });
    const loanIds = incidents
      .map((i) => i.loanId)
      .filter((id): id is string => Boolean(id));
    const [issues, fines, reporters] = await Promise.all([
      loanIds.length
        ? this.prisma.libraryCirculationTransaction.findMany({
            where: {
              loanId: { in: loanIds },
              transactionType: 'ISSUE',
              ...snapshot,
            },
            select: {
              loanId: true,
              borrowerName: true,
              borrowerCode: true,
              departmentName: true,
              memberType: true,
            },
          })
        : [],
      loanIds.length
        ? this.prisma.libraryFine.findMany({
            where: { loanId: { in: loanIds } },
            select: {
              loanId: true,
              amount: true,
              paidAt: true,
              waivedAt: true,
              reason: true,
            },
          })
        : [],
      this.prisma.user.findMany({
        where: {
          id: {
            in: incidents
              .map((i) => i.reportedById)
              .filter((id): id is string => Boolean(id)),
          },
        },
        select: { id: true, displayName: true, email: true },
      }),
    ]);
    const issueByLoan = new Map(issues.map((i) => [i.loanId, i]));
    const names = new Map(
      reporters.map((u) => [u.id, u.displayName?.trim() || u.email]),
    );
    const filtered = hasSnapshot
      ? incidents.filter((i) => i.loanId && issueByLoan.has(i.loanId))
      : incidents;
    const total = filtered.length;
    const pageRows = filtered.slice((page - 1) * limit, page * limit);
    const items = pageRows.map((incident) => {
      const issue = incident.loanId
        ? issueByLoan.get(incident.loanId)
        : undefined;
      const charges = fines.filter(
        (f) =>
          f.loanId === incident.loanId &&
          (f.reason === 'Lost book penalty' || f.reason === 'Damage charge'),
      );
      const fStatus = fineStatus(charges);
      return {
        id: incident.id,
        occurredAt: incident.createdAt,
        incidentType: incident.incidentType,
        typeLabel: incident.incidentType === 'LOST' ? 'Lost' : 'Damaged',
        accession:
          incident.copy.accessionNumber ||
          incident.copy.book.accessionNo ||
          incident.copy.barcode,
        title: incident.copy.book.title,
        author: incident.copy.book.author,
        borrowerName: issue?.borrowerName ?? null,
        borrowerCode: issue?.borrowerCode ?? null,
        department: issue?.departmentName ?? null,
        memberTypeLabel: issue ? memberTypeLabel(issue.memberType) : '—',
        chargeAmount:
          incident.chargeAmount != null ? Number(incident.chargeAmount) : null,
        fineStatus: fStatus,
        fineStatusLabel: FINE_STATUS_LABELS[fStatus],
        remarks: incident.notes,
        recoveryStatus: incident.status,
        recoveryStatusLabel:
          incident.status === 'OPEN'
            ? 'Not recovered'
            : incident.status === 'REPLACED'
              ? 'Replaced'
              : incident.status === 'RESOLVED'
                ? 'Resolved'
                : incident.status,
        resolvedAt: incident.resolvedAt,
        reportedBy: incident.reportedById
          ? (names.get(incident.reportedById) ?? null)
          : null,
      };
    });
    return {
      kind: 'incidents' as const,
      range: this.rangeOut(range),
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------

  private async dataset(
    tenantId: string,
    q: CirculationReportQueryDto,
    report: CirculationReportKey,
    range: ReportRange,
  ): Promise<Dataset> {
    const title = REPORT_TITLES[report] ?? 'Circulation Report';
    const summary = await this.summary(tenantId, q);
    const totals: [string, string | number][] = [
      ['Total issues', summary.totalIssues],
      ['Total renewals', summary.totalRenewals],
      ['Total returns', summary.totalReturns],
      ['Currently borrowed', summary.currentlyBorrowed],
      ['Overdue books', summary.overdue],
      ['Late returns', summary.lateReturns],
    ];
    type Any = Record<string, unknown>;
    const s = (key: string) => (row: Any) =>
      (row[key] as string | number | null) ?? '';
    const d = (key: string) => (row: Any) => fmtDate(row[key] as Date | null);
    const dt = (key: string) => (row: Any) =>
      fmtDateTime(row[key] as Date | null);
    const m = (key: string) => (row: Any) => money(row[key] as number | null);

    if (report === 'current' || report === 'overdue') {
      const result = await this.loanRows(tenantId, q, range, report, true);
      return {
        title,
        rows: result.items,
        totals: [['Total records', result.total], ...totals],
        columns: [
          {
            key: 'accession',
            label: 'Accession No.',
            value: s('accession'),
            pdf: true,
          },
          {
            key: 'title',
            label: 'Book Title',
            value: s('title'),
            pdf: true,
            width: 34,
          },
          { key: 'author', label: 'Author', value: s('author'), pdf: true },
          {
            key: 'borrowerName',
            label: 'Borrower',
            value: s('borrowerName'),
            pdf: true,
          },
          {
            key: 'borrowerCode',
            label: 'Roll No. / Staff ID',
            value: s('borrowerCode'),
            pdf: true,
          },
          {
            key: 'memberType',
            label: 'Member Type',
            value: s('memberTypeLabel'),
          },
          {
            key: 'department',
            label: 'Department',
            value: s('department'),
            pdf: true,
          },
          {
            key: 'mobile',
            label: 'Contact',
            value: s('mobile'),
            pdf: report === 'overdue',
          },
          {
            key: 'issuedAt',
            label: 'Issue Date',
            value: d('issuedAt'),
            pdf: true,
          },
          { key: 'dueAt', label: 'Due Date', value: d('dueAt'), pdf: true },
          { key: 'renewalCount', label: 'Renewals', value: s('renewalCount') },
          {
            key: 'overdueDays',
            label: 'Days Overdue',
            value: s('overdueDays'),
            pdf: true,
          },
          {
            key: 'outstandingFine',
            label: 'Outstanding Fine (₹)',
            value: m('outstandingFine'),
            pdf: true,
          },
          { key: 'issuedBy', label: 'Issued By', value: s('issuedBy') },
          {
            key: 'status',
            label: 'Status',
            value: s('statusLabel'),
            pdf: true,
          },
        ],
      };
    }
    if (report === 'departments') {
      const items = await this.departmentRows(tenantId, q, range);
      return {
        title,
        rows: items as unknown as Any[],
        totals: [['Departments', items.length], ...totals],
        columns: [
          {
            key: 'department',
            label: 'Department',
            value: s('department'),
            pdf: true,
            width: 34,
          },
          { key: 'issues', label: 'Issues', value: s('issues'), pdf: true },
          {
            key: 'renewals',
            label: 'Renewals',
            value: s('renewals'),
            pdf: true,
          },
          { key: 'returns', label: 'Returns', value: s('returns'), pdf: true },
          {
            key: 'lateReturns',
            label: 'Late Returns',
            value: s('lateReturns'),
            pdf: true,
          },
          {
            key: 'currentlyBorrowed',
            label: 'Currently Borrowed',
            value: s('currentlyBorrowed'),
            pdf: true,
          },
          { key: 'overdue', label: 'Overdue', value: s('overdue'), pdf: true },
          {
            key: 'borrowers',
            label: 'Borrowers',
            value: s('borrowers'),
            pdf: true,
          },
        ],
      };
    }
    if (report === 'librarians') {
      const items = await this.librarianRows(tenantId, q, range);
      return {
        title,
        rows: items as unknown as Any[],
        totals: [['Staff members', items.length], ...totals],
        columns: [
          {
            key: 'name',
            label: 'Librarian / Staff',
            value: s('name'),
            pdf: true,
            width: 30,
          },
          { key: 'issues', label: 'Issues', value: s('issues'), pdf: true },
          {
            key: 'renewals',
            label: 'Renewals',
            value: s('renewals'),
            pdf: true,
          },
          { key: 'returns', label: 'Returns', value: s('returns'), pdf: true },
          { key: 'total', label: 'Total', value: s('total'), pdf: true },
          {
            key: 'lastActivityAt',
            label: 'Last Activity',
            value: dt('lastActivityAt'),
            pdf: true,
          },
        ],
      };
    }
    if (report === 'lost-damaged') {
      const result = await this.incidentRows(tenantId, q, range, true);
      return {
        title,
        rows: result.items,
        totals: [['Total records', result.total]],
        columns: [
          {
            key: 'occurredAt',
            label: 'Date',
            value: dt('occurredAt'),
            pdf: true,
          },
          { key: 'type', label: 'Type', value: s('typeLabel'), pdf: true },
          {
            key: 'accession',
            label: 'Accession No.',
            value: s('accession'),
            pdf: true,
          },
          {
            key: 'title',
            label: 'Book Title',
            value: s('title'),
            pdf: true,
            width: 34,
          },
          {
            key: 'borrowerName',
            label: 'Borrower',
            value: s('borrowerName'),
            pdf: true,
          },
          {
            key: 'borrowerCode',
            label: 'Roll No. / Staff ID',
            value: s('borrowerCode'),
            pdf: true,
          },
          { key: 'department', label: 'Department', value: s('department') },
          {
            key: 'chargeAmount',
            label: 'Charge (₹)',
            value: m('chargeAmount'),
            pdf: true,
          },
          {
            key: 'fineStatus',
            label: 'Fine Status',
            value: s('fineStatusLabel'),
            pdf: true,
          },
          { key: 'remarks', label: 'Remarks', value: s('remarks'), pdf: true },
          {
            key: 'recovery',
            label: 'Recovery Status',
            value: s('recoveryStatusLabel'),
            pdf: true,
          },
          { key: 'reportedBy', label: 'Recorded By', value: s('reportedBy') },
        ],
      };
    }
    const result = await this.transactionRows(tenantId, q, range, report, true);
    return {
      title,
      rows: result.items,
      totals: [['Total records', result.total], ...totals],
      columns: [
        {
          key: 'transactionId',
          label: 'Transaction ID',
          value: s('transactionId'),
          pdf: true,
        },
        {
          key: 'occurredAt',
          label: 'Date & Time',
          value: dt('occurredAt'),
          pdf: true,
        },
        { key: 'type', label: 'Type', value: s('typeLabel'), pdf: true },
        {
          key: 'accession',
          label: 'Accession No.',
          value: s('accession'),
          pdf: true,
        },
        {
          key: 'title',
          label: 'Book Title',
          value: s('title'),
          pdf: true,
          width: 34,
        },
        { key: 'author', label: 'Author', value: s('author') },
        {
          key: 'department',
          label: 'Department',
          value: s('department'),
          pdf: true,
        },
        {
          key: 'borrowerName',
          label: 'Borrower',
          value: s('borrowerName'),
          pdf: true,
        },
        {
          key: 'borrowerCode',
          label: 'Roll No. / Staff ID',
          value: s('borrowerCode'),
          pdf: true,
        },
        {
          key: 'memberType',
          label: 'Member Type',
          value: s('memberTypeLabel'),
        },
        { key: 'issuedAt', label: 'Original Issue Date', value: d('issuedAt') },
        {
          key: 'currentDueAt',
          label: 'Current Due Date',
          value: d('currentDueAt'),
          pdf: true,
        },
        {
          key: 'previousDueAt',
          label: 'Previous Due Date',
          value: d('previousDueAt'),
        },
        {
          key: 'renewalCount',
          label: 'Renewal Count',
          value: s('renewalCount'),
        },
        {
          key: 'returnedAt',
          label: 'Actual Return Date',
          value: dt('returnedAt'),
          pdf: true,
        },
        {
          key: 'returnedBy',
          label: 'Returned By',
          value: (row) =>
            row.type === 'RETURN'
              ? [
                  row.returnedByName,
                  row.returnedByCode,
                  row.returnedByTypeLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '',
          pdf: true,
        },
        {
          key: 'processedBy',
          label: 'Received / Processed By',
          value: s('processedBy'),
          pdf: true,
        },
        {
          key: 'bookCondition',
          label: 'Book Condition',
          value: s('bookCondition'),
        },
        { key: 'daysLate', label: 'Days Late', value: s('daysLate') },
        {
          key: 'fineAmount',
          label: 'Fine (₹)',
          value: m('fineAmount'),
          pdf: true,
        },
        {
          key: 'fineStatus',
          label: 'Fine Status',
          value: s('fineStatusLabel'),
        },
        { key: 'status', label: 'Status', value: s('statusLabel'), pdf: true },
        { key: 'remarks', label: 'Remarks', value: s('remarks') },
      ],
    };
  }

  private async header(
    tenantId: string,
    q: CirculationReportQueryDto,
    range: ReportRange,
  ) {
    const [tenant, academicYear, department, processor] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      q.academicYearId
        ? this.prisma.academicYear.findUnique({
            where: { id: q.academicYearId },
            select: { name: true },
          })
        : null,
      q.departmentId
        ? this.prisma.department.findUnique({
            where: { id: q.departmentId },
            select: { name: true },
          })
        : null,
      q.processedById
        ? this.prisma.user.findUnique({
            where: { id: q.processedById },
            select: { displayName: true, email: true },
          })
        : null,
    ]);
    const name = tenant?.name ?? 'Don Bosco College Tura';
    const collegeName = /don\s+bosco\s+college,?\s*tura/i.test(name)
      ? 'DON BOSCO COLLEGE, TURA'
      : name.toUpperCase();
    const filters = [
      department ? `Department: ${department.name}` : null,
      q.memberType ? `Member type: ${memberTypeLabel(q.memberType)}` : null,
      q.semester ? `Semester: ${q.semester}` : null,
      q.borrower ? `Borrower: ${q.borrower}` : null,
      q.bookTitle ? `Book title: ${q.bookTitle}` : null,
      q.accession ? `Accession: ${q.accession}` : null,
      q.type ? `Type: ${TYPE_LABELS[q.type]}` : null,
      q.status ? `Status: ${STATUS_LABELS[q.status] ?? q.status}` : null,
      processor
        ? `Processed by: ${processor.displayName || processor.email}`
        : null,
      q.search ? `Search: ${q.search}` : null,
    ].filter(Boolean);
    return {
      collegeName,
      rangeLabel: `${fmtDate(range.from)} to ${fmtDate(range.to)}`,
      academicYear: academicYear?.name ?? 'All',
      filters: filters.length ? filters.join('; ') : 'None',
      generatedAt: fmtDateTime(new Date()),
    };
  }

  private async excel(
    dataset: Dataset,
    header: Awaited<ReturnType<LibraryCirculationReportsService['header']>>,
  ) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Circulation', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    const cols = dataset.columns.length;
    const lines = [
      [header.collegeName, 16],
      ['LIBRARY CIRCULATION REPORT', 13],
      [dataset.title, 12],
    ] as const;
    lines.forEach(([text, size], i) => {
      ws.mergeCells(i + 1, 1, i + 1, cols);
      const cell = ws.getCell(i + 1, 1);
      cell.value = text;
      cell.font = { bold: true, size };
      cell.alignment = { horizontal: 'center' };
    });
    const meta = [
      `Date range: ${header.rangeLabel}`,
      `Academic year: ${header.academicYear}`,
      `Filters: ${header.filters}`,
      `Generated on: ${header.generatedAt}`,
    ];
    meta.forEach((text, i) => {
      const r = lines.length + 1 + i;
      ws.mergeCells(r, 1, r, cols);
      ws.getCell(r, 1).value = text;
      ws.getCell(r, 1).font = { size: 10, color: { argb: 'FF475569' } };
    });
    const headerRow = ws.getRow(lines.length + meta.length + 2);
    dataset.columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
      ws.getColumn(i + 1).width =
        c.width ?? Math.max(12, Math.min(28, c.label.length + 4));
    });
    for (const row of dataset.rows) {
      ws.addRow(dataset.columns.map((c) => c.value(row)));
    }
    ws.addRow([]);
    for (const [label, value] of dataset.totals) {
      const r = ws.addRow([label, value]);
      r.getCell(1).font = { bold: true };
    }
    ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private pdfHtml(
    dataset: Dataset,
    header: Awaited<ReturnType<LibraryCirculationReportsService['header']>>,
  ) {
    const cols = dataset.columns.filter((c) => c.pdf);
    const esc = (value: string | number | null | undefined) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const body = dataset.rows
      .map(
        (row, i) =>
          `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${esc(c.value(row))}</td>`).join('')}</tr>`,
      )
      .join('');
    const totals = dataset.totals
      .map(
        ([label, value]) =>
          `<div class="kpi">${esc(label)}<b>${esc(value)}</b></div>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><style>
      body{font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;font-size:9.5px}
      h1,h2,h3{margin:0;text-align:center}
      h1{font-size:17px;letter-spacing:.04em} h2{font-size:13px;letter-spacing:.12em;margin-top:4px} h3{font-size:12px;margin:6px 0 10px}
      .meta{margin:8px 0;color:#334155;line-height:1.5}
      .kpis{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}
      .kpi{border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;min-width:90px}
      .kpi b{display:block;font-size:13px}
      table{width:100%;border-collapse:collapse}
      thead{display:table-header-group}
      th{background:#1e3a8a;color:#fff;padding:4px;border:1px solid #1e3a8a;text-align:left}
      td{border:1px solid #cbd5e1;padding:3px 4px;vertical-align:top}
      tr{page-break-inside:avoid}
      tr:nth-child(even) td{background:#f1f5f9}
      .empty{text-align:center;color:#64748b;padding:24px}
      .sign{display:flex;justify-content:space-between;margin-top:48px;padding:0 24px}
      .sign div{width:200px;border-top:1px solid #0f172a;text-align:center;padding-top:4px;font-weight:600}
    </style></head><body>
      <h1>${esc(header.collegeName)}</h1>
      <h2>LIBRARY CIRCULATION REPORT</h2>
      <h3>${esc(dataset.title)}</h3>
      <div class="meta">Date range: ${esc(header.rangeLabel)} &nbsp;·&nbsp; Academic year: ${esc(header.academicYear)}<br/>
        Filters: ${esc(header.filters)}<br/>Generated on: ${esc(header.generatedAt)}</div>
      <div class="kpis">${totals}</div>
      ${
        dataset.rows.length
          ? `<table><thead><tr><th>#</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
          : `<p class="empty">No records found for the selected filters.</p>`
      }
      <div class="sign"><div>Librarian</div><div>Principal</div></div>
    </body></html>`;
  }

  private async htmlToPdf(html: string) {
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
        format: 'A4',
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;padding:0 10mm;color:#64748b;display:flex;justify-content:space-between;"><span>Library Circulation Report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
        margin: { top: '10mm', right: '8mm', bottom: '14mm', left: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
