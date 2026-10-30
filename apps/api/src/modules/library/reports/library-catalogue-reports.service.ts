import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { copyTypeLabel } from '../domain/library-copy-issue.logic';
import { PrismaService } from '../../../database/prisma.service';
import type { CatalogueReportQueryDto } from '../dto/catalogue-report.dto';
import {
  CATALOGUE_REPORTS,
  grandTotals,
  reportDefinition,
  type ReportColumn,
  type ReportPayload,
} from './library-catalogue-report.logic';

const COPY_COLUMNS: ReportColumn[] = [
  { key: 'serial', label: 'S.No.' },
  { key: 'department', label: 'Department' },
  { key: 'title', label: 'Book title' },
  { key: 'author', label: 'Author' },
  { key: 'isbn', label: 'ISBN', text: true },
  { key: 'edition', label: 'Edition' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'year', label: 'Publication year' },
  { key: 'subject', label: 'Subject' },
  { key: 'accession', label: 'Accession number', text: true },
  { key: 'barcode', label: 'Barcode', text: true },
  { key: 'callNumber', label: 'Call number' },
  { key: 'copyType', label: 'Copy type' },
  { key: 'issue', label: 'Issue permission' },
  { key: 'shelf', label: 'Shelf location' },
  { key: 'status', label: 'Copy status' },
  { key: 'category', label: 'Category' },
];

const ACQUISITION_KEYS = new Set([
  'acquisition-register',
  'purchased-period',
  'donated-gifts',
]);

const ACQUISITION_COLUMNS: ReportColumn[] = [
  { key: 'acquisitionType', label: 'Acquisition type' },
  { key: 'supplier', label: 'Supplier / donor' },
  { key: 'invoice', label: 'Invoice number', text: true },
  { key: 'price', label: 'Price per copy' },
  { key: 'funding', label: 'Funding source' },
  { key: 'condition', label: 'Condition' },
];

const SUMMARY_COLUMNS: ReportColumn[] = [
  { key: 'department', label: 'Department' },
  { key: 'titles', label: 'Distinct titles' },
  { key: 'copies', label: 'Total physical copies' },
  { key: 'available', label: 'Available copies' },
  { key: 'issued', label: 'Issued copies' },
];

type GroupRow = {
  department: string;
  titles: number;
  copies: number;
  available: number;
  issued: number;
};

@Injectable()
export class LibraryCatalogueReportsService {
  constructor(private readonly prisma: PrismaService) {}

  definitions() {
    return {
      reports: CATALOGUE_REPORTS.map((report) => ({
        key: report.key,
        title: report.title,
        group: report.group,
        sensitive: report.sensitive,
        formal: report.formal,
        unavailableReason: report.unavailableReason ?? null,
      })),
    };
  }

  async options(tenantId: string) {
    const [departments, categories, collections] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.libraryCategory.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.libraryBookCopy.groupBy({
        by: ['collectionCode'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);
    return {
      departments,
      categories,
      collections: collections
        .map((row) => ({
          code: row.collectionCode ?? '',
          copies: row._count._all,
        }))
        .sort((a, b) => b.copies - a.copies),
      statuses: [
        'AVAILABLE',
        'ISSUED',
        'OVERDUE',
        'LOST',
        'DAMAGED',
        'WITHDRAWN',
        'NOT_FOR_LOAN',
      ],
    };
  }

  async dashboard(tenantId: string) {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    const [
      titles,
      copies,
      available,
      lost,
      damaged,
      withdrawn,
      unmapped,
      issued,
      overdue,
      recent,
      titlesThen,
      copiesThen,
      titlesAdded,
      copiesAdded,
      departments,
    ] = await Promise.all([
      this.prisma.libraryBook.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, book: { deletedAt: null } },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          status: 'AVAILABLE',
          book: { deletedAt: null },
          loans: { none: { status: 'ACTIVE', returnedAt: null } },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, status: 'LOST', book: { deletedAt: null } },
      }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, status: 'DAMAGED', book: { deletedAt: null } },
      }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, status: 'WITHDRAWN', book: { deletedAt: null } },
      }),
      this.prisma.libraryBook.count({
        where: {
          tenantId,
          deletedAt: null,
          departmentId: null,
          departments: { none: {} },
        },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE', returnedAt: null },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          returnedAt: null,
          dueAt: { lt: now },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          acquisitionDate: { gte: yearAgo },
          book: { deletedAt: null },
        },
      }),
      this.prisma.libraryBook.count({
        where: {
          tenantId,
          deletedAt: null,
          copies: { some: { acquisitionDate: { lt: cutoff } } },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          acquisitionDate: { lt: cutoff },
          book: { deletedAt: null },
        },
      }),
      this.prisma.libraryBook.count({
        where: {
          tenantId,
          deletedAt: null,
          copies: {
            some: { acquisitionDate: { gte: cutoff } },
            none: { acquisitionDate: { lt: cutoff } },
          },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          acquisitionDate: { gte: cutoff },
          book: { deletedAt: null },
        },
      }),
      this.departmentRows(tenantId, {}),
    ]);
    return {
      distinctTitles: titles,
      physicalCopies: copies,
      availableCopies: available,
      issuedCopies: issued,
      overdueCopies: overdue,
      lostCopies: lost,
      damagedCopies: damaged,
      withdrawnCopies: withdrawn,
      titlesWithoutDepartment: unmapped,
      recentlyAcquiredCopies: recent,
      growth: {
        titles: stockGrowth(titlesThen + titlesAdded, titlesThen),
        copies: stockGrowth(copiesThen + copiesAdded, copiesThen),
      },
      departments: departments.slice(0, 12),
      generatedAt: now.toISOString(),
    };
  }

  async run(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
    revealBorrowers: boolean,
  ) {
    const definition = reportDefinition(key);
    if (!definition)
      throw new BadRequestException('That library report is not available.');
    if (definition.sensitive && !revealBorrowers) {
      throw new BadRequestException(
        'Individual borrowing reports are limited to library staff.',
      );
    }
    const institutionName = await this.institutionName(tenantId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const base = {
      key,
      title: definition.title,
      institutionName,
      generatedAt: new Date().toISOString(),
      filters: describeFilters(query),
      formal: definition.formal,
      page,
      limit,
    };
    if (definition.unavailableReason) {
      return emptyPayload(base, definition.unavailableReason);
    }
    if (definition.kind === 'summary' && isDepartmentSummary(key)) {
      const rows = await this.departmentRows(tenantId, query);
      const totals = grandTotals(rows);
      const slice = rows.slice((page - 1) * limit, page * limit);
      return {
        ...base,
        notes: departmentNotes(key),
        columns: SUMMARY_COLUMNS,
        rows: [
          ...slice.map((row) => ({ ...row })),
          ...(page * limit >= rows.length
            ? [
                {
                  department: 'Grand total',
                  titles: totals.titles,
                  copies: totals.copies,
                  available: totals.available,
                  issued: totals.issued,
                },
              ]
            : []),
        ],
        total: rows.length,
        totals,
      } satisfies ReportPayload;
    }
    if (definition.kind === 'summary')
      return this.grouped(tenantId, key, query, base);
    if (definition.kind === 'loans')
      return this.loans(tenantId, key, query, base, revealBorrowers);
    if (definition.kind === 'batches') return this.imports(tenantId, base);
    return this.copies(tenantId, key, query, base);
  }

  private async departmentRows(
    tenantId: string,
    query: CatalogueReportQueryDto,
  ): Promise<GroupRow[]> {
    const filters = [
      Prisma.sql`c.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];
    if (query.departmentId)
      filters.push(
        Prisma.sql`b.department_id = CAST(${query.departmentId} AS uuid)`,
      );
    if (query.collectionCode) {
      filters.push(
        Prisma.sql`COALESCE(NULLIF(BTRIM(c.collection_code), ''), '(Unmapped)') = ${query.collectionCode}`,
      );
    }
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(
        Prisma.sql`(b.title ILIKE ${pattern} OR b.author ILIKE ${pattern} OR c.barcode ILIKE ${pattern} OR c.accession_number ILIKE ${pattern})`,
      );
    }
    const where = Prisma.join(filters, ' AND ');
    const rows = await this.prisma.$queryRaw<GroupRow[]>`
      SELECT
        COALESCE(dep.department_name, NULLIF(BTRIM(c.collection_code), ''), '(Unmapped)') AS department,
        COUNT(DISTINCT b.id)::int AS titles,
        COUNT(c.id)::int AS copies,
        COUNT(c.id) FILTER (WHERE loan.id IS NULL AND c.status = 'AVAILABLE')::int AS available,
        COUNT(c.id) FILTER (WHERE loan.id IS NOT NULL)::int AS issued
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      LEFT JOIN core.departments dep ON dep.id = b.department_id AND dep.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT l.id
        FROM library.library_loans l
        WHERE l.copy_id = c.id AND l.returned_at IS NULL AND l.status = 'ACTIVE'
        LIMIT 1
      ) loan ON true
      WHERE ${where}
      GROUP BY 1
      ORDER BY copies DESC
    `;
    return rows.map((row) => ({
      department: row.department,
      titles: Number(row.titles),
      copies: Number(row.copies),
      available: Number(row.available),
      issued: Number(row.issued),
    }));
  }

  private async grouped(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
    base: Omit<
      ReportPayload,
      'notes' | 'columns' | 'rows' | 'total' | 'totals'
    >,
  ): Promise<ReportPayload> {
    if (key === 'total-copies' || key === 'total-titles') {
      const snapshot = await this.dashboard(tenantId);
      const columns: ReportColumn[] = [
        { key: 'measure', label: 'Measure' },
        { key: 'value', label: 'Count' },
      ];
      return {
        ...base,
        notes: ['Distinct titles and physical copies are counted separately.'],
        columns,
        rows: [
          { measure: 'Distinct titles', value: snapshot.distinctTitles },
          { measure: 'Physical copies', value: snapshot.physicalCopies },
          { measure: 'Available copies', value: snapshot.availableCopies },
          { measure: 'Issued copies', value: snapshot.issuedCopies },
        ],
        total: 4,
        totals: {
          titles: snapshot.distinctTitles,
          copies: snapshot.physicalCopies,
        },
      };
    }
    if (key === 'acquisition-cost' || key === 'department-acquisition') {
      const rows = await this.costRows(tenantId, query);
      const spent = rows.reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        ...base,
        notes: [
          'Amounts use the acquisition price stored on each copy. Copies without a price are excluded from the total.',
        ],
        columns: [
          { key: 'department', label: 'Department' },
          { key: 'copies', label: 'Copies acquired' },
          { key: 'priced', label: 'Copies with a price' },
          { key: 'amount', label: 'Acquisition cost' },
        ],
        rows,
        total: rows.length,
        totals: {
          amount: spent,
          copies: rows.reduce((sum, row) => sum + Number(row.copies), 0),
        },
      };
    }
    if (
      key === 'collection-growth' ||
      key === 'acquisition-year' ||
      key === 'period-summary'
    ) {
      const rows = await this.yearRows(
        tenantId,
        query,
        key === 'period-summary',
      );
      return {
        ...base,
        notes:
          key === 'period-summary'
            ? [
                'Issue and return counts come from circulation transactions. A zero means no transactions were recorded in that period.',
              ]
            : ['Acquisition year is taken from the copy acquisition date.'],
        columns:
          key === 'period-summary'
            ? [
                { key: 'period', label: 'Period' },
                { key: 'copies', label: 'Copies acquired' },
                { key: 'issued', label: 'Issues' },
                { key: 'returned', label: 'Returns' },
              ]
            : [
                { key: 'period', label: 'Year' },
                { key: 'copies', label: 'Copies acquired' },
                { key: 'titles', label: 'Distinct titles' },
              ],
        rows,
        total: rows.length,
        totals: {},
      };
    }
    if (key === 'frequent' || key === 'department-borrowing') {
      const rows =
        key === 'frequent'
          ? await this.frequentRows(tenantId, query)
          : await this.borrowingRows(tenantId, query);
      return {
        ...base,
        notes: rows.length
          ? ['Counts come from library loan transactions.']
          : [
              'No circulation transactions match this report. Counts are not estimated from the catalogue.',
            ],
        columns:
          key === 'frequent'
            ? [
                { key: 'title', label: 'Book title' },
                { key: 'loans', label: 'Times borrowed' },
              ]
            : [
                { key: 'department', label: 'Department' },
                { key: 'loans', label: 'Loans' },
              ],
        rows,
        total: rows.length,
        totals: {},
      };
    }
    const rows = await this.labelRows(tenantId, key, query);
    return {
      ...base,
      notes:
        key === 'copy-type'
          ? [
              'Each physical copy is counted once under its own copy type. A title with mixed copies appears in more than one row. Copies saved before copy types existed stay in Not set.',
            ]
          : [
              'Language and subject are blank when the Koha export did not include those MARC fields.',
            ],
      columns: [
        { key: 'label', label: 'Group' },
        { key: 'titles', label: 'Distinct titles' },
        { key: 'copies', label: 'Physical copies' },
      ],
      rows,
      total: rows.length,
      totals: {
        titles: rows.reduce((sum, row) => sum + Number(row.titles), 0),
        copies: rows.reduce((sum, row) => sum + Number(row.copies), 0),
      },
    };
  }

  private async copies(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
    base: Omit<
      ReportPayload,
      'notes' | 'columns' | 'rows' | 'total' | 'totals'
    >,
  ): Promise<ReportPayload> {
    const where = await this.copyWhere(tenantId, key, query);
    const page = base.page;
    const limit = base.limit;
    const [total, records] = await Promise.all([
      this.prisma.libraryBookCopy.count({ where }),
      this.prisma.libraryBookCopy.findMany({
        where,
        include: {
          book: { select: copyBookSelect },
          loans: {
            where: { status: 'ACTIVE', returnedAt: null },
            select: { dueAt: true },
            take: 1,
          },
        },
        orderBy: copyOrder(query),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const departments = await this.departmentNames(
      tenantId,
      records
        .map((row) => row.book.departmentId)
        .filter((id): id is string => Boolean(id)),
    );
    const rows = records.map((row, index) =>
      copyRow(
        row,
        (page - 1) * limit + index + 1,
        departments.get(row.book.departmentId ?? '') ?? '',
      ),
    );
    return {
      ...base,
      notes: copyNotes(key),
      columns: ACQUISITION_KEYS.has(key)
        ? [...COPY_COLUMNS, ...ACQUISITION_COLUMNS]
        : COPY_COLUMNS,
      rows,
      total,
      totals: { copies: total },
    };
  }

  private async loans(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
    base: Omit<
      ReportPayload,
      'notes' | 'columns' | 'rows' | 'total' | 'totals'
    >,
    revealBorrowers: boolean,
  ): Promise<ReportPayload> {
    if (key === 'fines') return this.fines(tenantId, query, base);
    const now = new Date();
    const range = dateRange(query);
    const where: Prisma.LibraryLoanWhereInput = {
      tenantId,
      ...(key === 'issue-history'
        ? { issuedAt: range }
        : { status: 'ACTIVE', returnedAt: null }),
      ...(key === 'overdue' || key === 'not-returned'
        ? { dueAt: { lt: now } }
        : {}),
      ...(key === 'student-borrowing'
        ? { studentId: { not: null }, issuedAt: range }
        : {}),
      ...(key === 'faculty-borrowing'
        ? { staffProfileId: { not: null }, issuedAt: range }
        : {}),
    };
    const page = base.page;
    const limit = base.limit;
    const [total, records] = await Promise.all([
      this.prisma.libraryLoan.count({ where }),
      this.prisma.libraryLoan.findMany({
        where,
        include: {
          copy: { include: { book: { select: copyBookSelect } } },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const names = revealBorrowers
      ? await this.borrowerNames(tenantId, records)
      : new Map<string, string>();
    const rows = records.map((loan, index) => ({
      serial: (page - 1) * limit + index + 1,
      title: loan.copy.book.title,
      author: loan.copy.book.author ?? '',
      accession: loan.copy.accessionNumber ?? '',
      barcode: loan.copy.barcode,
      issued: loan.issuedAt.toISOString().slice(0, 10),
      due: loan.dueAt.toISOString().slice(0, 10),
      returned: loan.returnedAt
        ? loan.returnedAt.toISOString().slice(0, 10)
        : '',
      borrower: revealBorrowers
        ? (names.get(loan.studentId ?? loan.staffProfileId ?? '') ??
          loan.memberType)
        : 'Restricted',
      status:
        !loan.returnedAt && loan.dueAt < now
          ? 'OVERDUE'
          : loan.returnedAt
            ? 'RETURNED'
            : 'ISSUED',
    }));
    return {
      ...base,
      notes: total
        ? ['Circulation rows come from loan transactions.']
        : ['No circulation transactions match this report.'],
      columns: [
        { key: 'serial', label: 'S.No.' },
        { key: 'title', label: 'Book title' },
        { key: 'author', label: 'Author' },
        { key: 'accession', label: 'Accession number', text: true },
        { key: 'barcode', label: 'Barcode', text: true },
        { key: 'borrower', label: 'Borrower' },
        { key: 'issued', label: 'Issued' },
        { key: 'due', label: 'Due' },
        { key: 'returned', label: 'Returned' },
        { key: 'status', label: 'Status' },
      ],
      rows,
      total,
      totals: { loans: total },
    };
  }

  private async fines(
    tenantId: string,
    query: CatalogueReportQueryDto,
    base: Omit<
      ReportPayload,
      'notes' | 'columns' | 'rows' | 'total' | 'totals'
    >,
  ): Promise<ReportPayload> {
    const range = dateRange(query);
    const where: Prisma.LibraryFineWhereInput = {
      tenantId,
      createdAt: range,
      paidAt: null,
      waivedAt: null,
    };
    const page = base.page;
    const limit = base.limit;
    const [total, records, sum] = await Promise.all([
      this.prisma.libraryFine.count({ where }),
      this.prisma.libraryFine.findMany({
        where,
        include: {
          loan: {
            include: {
              copy: { include: { book: { select: { title: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.libraryFine.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      ...base,
      notes: [
        'Outstanding fines are unpaid and not waived. A zero total means no dues are recorded.',
      ],
      columns: [
        { key: 'title', label: 'Book title' },
        { key: 'amount', label: 'Amount' },
        { key: 'reason', label: 'Reason' },
        { key: 'created', label: 'Created' },
      ],
      rows: records.map((fine) => ({
        title: fine.loan.copy.book.title,
        amount: Number(fine.amount),
        reason: fine.reason ?? '',
        created: fine.createdAt.toISOString().slice(0, 10),
      })),
      total,
      totals: { amount: Number(sum._sum.amount ?? 0) },
    };
  }

  private async imports(
    tenantId: string,
    base: Omit<
      ReportPayload,
      'notes' | 'columns' | 'rows' | 'total' | 'totals'
    >,
  ): Promise<ReportPayload> {
    const batches = await this.prisma.libraryKohaImportBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      ...base,
      notes: [
        'Each row is one import batch. Imported titles and copies are reconciled against the staged source counts.',
      ],
      columns: [
        { key: 'name', label: 'Import' },
        { key: 'status', label: 'Status' },
        { key: 'sourceTitles', label: 'Source titles' },
        { key: 'sourceCopies', label: 'Source copies' },
        { key: 'importedTitles', label: 'Imported titles' },
        { key: 'importedCopies', label: 'Imported copies' },
        { key: 'skipped', label: 'Skipped' },
        { key: 'duplicates', label: 'Duplicates' },
        { key: 'failed', label: 'Failed' },
      ],
      rows: batches.map((batch) => ({
        name: batch.importName,
        status: batch.status,
        sourceTitles: batch.totalSourceRecords,
        sourceCopies: batch.totalCopies,
        importedTitles: batch.importedBooks,
        importedCopies: batch.importedCopies,
        skipped: batch.skippedRecords,
        duplicates: batch.duplicateRecords,
        failed: batch.failedRecords,
      })),
      total: batches.length,
      totals: {},
    };
  }

  private bookIdFilter(value?: string) {
    if (!value?.trim()) return [];
    return value
      .split(',')
      .map((id) => id.trim())
      .filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
      )
      .slice(0, 100);
  }

  private async copyWhere(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
  ): Promise<Prisma.LibraryBookCopyWhereInput> {
    const search = query.search?.trim();
    const now = new Date();
    const bookIds = this.bookIdFilter(query.bookIds);
    const where: Prisma.LibraryBookCopyWhereInput = {
      tenantId,
      book: {
        deletedAt: null,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.publisher
          ? { publisher: { contains: query.publisher, mode: 'insensitive' } }
          : {}),
        ...(query.year ? { publicationYear: query.year } : {}),
        ...(query.subject
          ? { subject: { contains: query.subject, mode: 'insensitive' } }
          : {}),
        ...(query.author
          ? { author: { contains: query.author, mode: 'insensitive' } }
          : {}),
        ...(query.language ? { language: query.language } : {}),
      },
      ...(bookIds.length ? { bookId: { in: bookIds } } : {}),
      ...(query.collectionCode && query.collectionCode !== '(Unmapped)'
        ? { collectionCode: query.collectionCode }
        : {}),
      ...(query.branch ? { homeBranchCode: query.branch } : {}),
      ...(query.shelf
        ? { shelvingLocation: { contains: query.shelf, mode: 'insensitive' } }
        : {}),
    };
    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: 'insensitive' } },
        { accessionNumber: { contains: search, mode: 'insensitive' } },
        { book: { title: { contains: search, mode: 'insensitive' } } },
        { book: { author: { contains: search, mode: 'insensitive' } } },
        { book: { isbn: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (key === 'available' || query.status === 'AVAILABLE') {
      where.status = 'AVAILABLE';
      where.loans = { none: { status: 'ACTIVE', returnedAt: null } };
    } else if (query.status === 'ISSUED' || key === 'issued') {
      where.loans = { some: { status: 'ACTIVE', returnedAt: null } };
    } else if (query.status === 'OVERDUE') {
      where.loans = {
        some: { status: 'ACTIVE', returnedAt: null, dueAt: { lt: now } },
      };
    } else if (query.status === 'LOST' || key === 'lost') where.status = 'LOST';
    else if (query.status === 'DAMAGED' || key === 'damaged')
      where.status = 'DAMAGED';
    else if (key === 'lost-damaged-inventory')
      where.status = { in: ['LOST', 'DAMAGED'] };
    else if (query.status) where.status = query.status;
    if (query.collectionCode === '(Unmapped)') {
      where.AND = [{ OR: [{ collectionCode: null }, { collectionCode: '' }] }];
    }
    if (key === 'unmapped' || key === 'unverified') {
      where.AND = [
        { OR: [{ collectionCode: null }, { collectionCode: '' }] },
        { book: { departmentId: null, departments: { none: {} } } },
      ];
    }
    if (key === 'missing-accession')
      where.OR = [{ accessionNumber: null }, { accessionNumber: '' }];
    if (key === 'missing-barcode') where.barcode = '';
    if (key === 'duplicates') {
      const [barcodes, accessions] = await Promise.all([
        this.prisma.$queryRaw<{ value: string }[]>`
          SELECT barcode AS value FROM library.library_book_copies
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND barcode <> ''
          GROUP BY barcode HAVING COUNT(*) > 1`,
        this.prisma.$queryRaw<{ value: string }[]>`
          SELECT accession_number AS value FROM library.library_book_copies
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND accession_number IS NOT NULL AND accession_number <> ''
          GROUP BY accession_number HAVING COUNT(*) > 1`,
      ]);
      const barcodeValues = barcodes.map((row) => row.value);
      const accessionValues = accessions.map((row) => row.value);
      where.OR = [
        ...(barcodeValues.length ? [{ barcode: { in: barcodeValues } }] : []),
        ...(accessionValues.length
          ? [{ accessionNumber: { in: accessionValues } }]
          : []),
      ];
      if (!where.OR.length) where.id = '00000000-0000-0000-0000-000000000000';
    }
    if (key === 'reference-register') {
      const reference = {
        OR: [
          { copyType: 'REFERENCE' },
          {
            copyType: null,
            book: { bookType: 'REFERENCE' },
          },
        ],
      };
      const current = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [...current, reference];
    }
    if (key === 'accession-range') {
      where.accessionNumber = {
        ...(query.accessionFrom ? { gte: query.accessionFrom } : {}),
        ...(query.accessionTo ? { lte: query.accessionTo } : {}),
      };
    }
    if (key === 'purchased-period' || key === 'acquisition-register') {
      const range = dateRange(query);
      if (query.from || query.to || key === 'purchased-period')
        where.acquisitionDate = range;
    }
    if (key === 'purchased-period') {
      where.book = {
        AND: [
          where.book ?? {},
          { NOT: { acquisitionType: { in: ['DONATION', 'GIFT'] } } },
        ],
      };
    }
    if (key === 'donated-gifts') {
      where.book = {
        AND: [
          where.book ?? {},
          { acquisitionType: { in: ['DONATION', 'GIFT'] } },
        ],
      };
    }
    return where;
  }

  private async labelRows(
    tenantId: string,
    key: string,
    query: CatalogueReportQueryDto,
  ) {
    const label =
      key === 'copy-type'
        ? Prisma.sql`CASE c.copy_type
            WHEN 'GENERAL' THEN 'General Book'
            WHEN 'REFERENCE' THEN 'Reference Book'
            WHEN 'RARE' THEN 'Rare Book'
            WHEN 'TEXTBOOK' THEN 'Textbook'
            WHEN 'RESERVE' THEN 'Reserve Book'
            WHEN 'RESTRICTED' THEN 'Restricted Book'
            WHEN 'OTHER' THEN 'Other'
            ELSE '(Not set on the copy)'
          END`
        : key === 'author'
          ? Prisma.sql`COALESCE(NULLIF(BTRIM(b.author), ''), '(No author)')`
          : key === 'publisher'
            ? Prisma.sql`COALESCE(NULLIF(BTRIM(b.publisher), ''), '(No publisher)')`
            : key === 'language'
              ? Prisma.sql`COALESCE(NULLIF(BTRIM(b.language), ''), '(No language)')`
              : key === 'subject'
                ? Prisma.sql`COALESCE(NULLIF(BTRIM(b.subject), ''), '(No subject)')`
                : key === 'category'
                  ? Prisma.sql`COALESCE(cat.name, '(No category)')`
                  : key === 'branch'
                    ? Prisma.sql`COALESCE(NULLIF(BTRIM(c.home_branch_code), ''), '(No branch)')`
                    : Prisma.sql`COALESCE(NULLIF(BTRIM(c.shelving_location), ''), '(No shelf location)')`;
    const categoryJoin =
      key === 'category'
        ? Prisma.sql`LEFT JOIN library.library_categories cat ON cat.id = b.category_id`
        : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { label: string; titles: number; copies: number }[]
    >`
      SELECT ${label} AS label,
        COUNT(DISTINCT b.id)::int AS titles,
        COUNT(c.id)::int AS copies
      FROM library.library_books b
      LEFT JOIN library.library_book_copies c ON c.book_id = b.id
      ${categoryJoin}
      WHERE b.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
      GROUP BY 1
      ORDER BY copies DESC
      LIMIT 200
    `;
    const filtered = query.search?.trim().toLowerCase();
    return rows
      .filter((row) => !filtered || row.label.toLowerCase().includes(filtered))
      .map((row) => ({
        label: row.label,
        titles: Number(row.titles),
        copies: Number(row.copies),
      }));
  }

  private async costRows(tenantId: string, query: CatalogueReportQueryDto) {
    const fromSql = query.from
      ? Prisma.sql`AND c.acquisition_date >= ${new Date(query.from)}`
      : Prisma.empty;
    const toSql = query.to
      ? Prisma.sql`AND c.acquisition_date <= ${new Date(query.to)}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { department: string; copies: number; priced: number; amount: number }[]
    >`
      SELECT
        COALESCE(dep.department_name, NULLIF(BTRIM(c.collection_code), ''), '(Unmapped)') AS department,
        COUNT(c.id)::int AS copies,
        COUNT(c.acquisition_price)::int AS priced,
        COALESCE(SUM(c.acquisition_price), 0)::float AS amount
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id AND b.deleted_at IS NULL
      LEFT JOIN core.departments dep ON dep.id = b.department_id AND dep.deleted_at IS NULL
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        ${fromSql}
        ${toSql}
      GROUP BY 1
      ORDER BY amount DESC
    `;
    return rows.map((row) => ({
      department: row.department,
      copies: Number(row.copies),
      priced: Number(row.priced),
      amount: Number(row.amount),
    }));
  }

  private async yearRows(
    tenantId: string,
    query: CatalogueReportQueryDto,
    monthly: boolean,
  ) {
    const bucket = monthly
      ? Prisma.sql`to_char(c.acquisition_date, 'YYYY-MM')`
      : Prisma.sql`to_char(c.acquisition_date, 'YYYY')`;
    const fromSql = query.from
      ? Prisma.sql`AND c.acquisition_date >= ${new Date(query.from)}`
      : Prisma.empty;
    const toSql = query.to
      ? Prisma.sql`AND c.acquisition_date <= ${new Date(query.to)}`
      : Prisma.empty;
    const acquired = await this.prisma.$queryRaw<
      { period: string; copies: number; titles: number }[]
    >`
      SELECT ${bucket} AS period,
        COUNT(c.id)::int AS copies,
        COUNT(DISTINCT c.book_id)::int AS titles
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id AND b.deleted_at IS NULL
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND c.acquisition_date IS NOT NULL
        ${fromSql}
        ${toSql}
      GROUP BY 1
      ORDER BY 1
    `;
    if (!monthly) {
      return acquired.map((row) => ({
        period: row.period,
        copies: Number(row.copies),
        titles: Number(row.titles),
      }));
    }
    const range = dateRange(query);
    const [issues, returns] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where: { tenantId, issuedAt: range },
        select: { issuedAt: true },
      }),
      this.prisma.libraryLoan.findMany({
        where: { tenantId, returnedAt: range },
        select: { returnedAt: true },
      }),
    ]);
    const issueByMonth = new Map<string, number>();
    for (const loan of issues) {
      const period = loan.issuedAt.toISOString().slice(0, 7);
      issueByMonth.set(period, (issueByMonth.get(period) ?? 0) + 1);
    }
    const returnByMonth = new Map<string, number>();
    for (const loan of returns) {
      if (!loan.returnedAt) continue;
      const period = loan.returnedAt.toISOString().slice(0, 7);
      returnByMonth.set(period, (returnByMonth.get(period) ?? 0) + 1);
    }
    const periods = new Set<string>([
      ...acquired.map((row) => row.period),
      ...issueByMonth.keys(),
      ...returnByMonth.keys(),
    ]);
    return [...periods].sort().map((period) => ({
      period,
      copies: Number(
        acquired.find((row) => row.period === period)?.copies ?? 0,
      ),
      issued: issueByMonth.get(period) ?? 0,
      returned: returnByMonth.get(period) ?? 0,
    }));
  }

  private async frequentRows(tenantId: string, query: CatalogueReportQueryDto) {
    const range = dateRange(query);
    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: range },
      select: {
        copy: { select: { book: { select: { id: true, title: true } } } },
      },
    });
    const map = new Map<string, { title: string; loans: number }>();
    for (const loan of loans) {
      const book = loan.copy.book;
      const row = map.get(book.id) ?? { title: book.title, loans: 0 };
      row.loans += 1;
      map.set(book.id, row);
    }
    return [...map.values()].sort((a, b) => b.loans - a.loans).slice(0, 50);
  }

  private async borrowingRows(
    tenantId: string,
    query: CatalogueReportQueryDto,
  ) {
    const range = dateRange(query);
    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: range, studentId: { not: null } },
      select: { studentId: true },
    });
    const studentIds = [
      ...new Set(
        loans
          .map((loan) => loan.studentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          select: { id: true, department: { select: { name: true } } },
        })
      : [];
    const names = new Map(
      students.map((student) => [
        student.id,
        student.department?.name ?? '(No department)',
      ]),
    );
    const map = new Map<string, number>();
    for (const loan of loans) {
      const department = names.get(loan.studentId ?? '') ?? '(No department)';
      map.set(department, (map.get(department) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([department, count]) => ({ department, loans: count }))
      .sort((a, b) => b.loans - a.loans);
  }

  private async departmentNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.department.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async borrowerNames(
    tenantId: string,
    loans: { studentId: string | null; staffProfileId: string | null }[],
  ) {
    const studentIds = [
      ...new Set(
        loans
          .map((loan) => loan.studentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const staffIds = [
      ...new Set(
        loans
          .map((loan) => loan.staffProfileId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [students, staff] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: {
              id: true,
              rollNumber: true,
              masterProfile: { select: { fullName: true } },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            select: { id: true, employeeCode: true, fullName: true },
          })
        : [],
    ]);
    const names = new Map<string, string>();
    for (const student of students) {
      names.set(
        student.id,
        `${student.masterProfile?.fullName ?? 'Student'} (${student.rollNumber ?? 'student'})`,
      );
    }
    for (const member of staff)
      names.set(
        member.id,
        `${member.fullName} (${member.employeeCode ?? 'staff'})`,
      );
    return names;
  }

  private async institutionName(tenantId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });
    return institution?.name?.trim() || 'Don Bosco College, Tura';
  }
}

const copyBookSelect = {
  id: true,
  title: true,
  author: true,
  isbn: true,
  edition: true,
  publisher: true,
  publicationYear: true,
  subject: true,
  classificationNumber: true,
  departmentId: true,
  bookType: true,
  acquisitionType: true,
  supplierName: true,
  invoiceNumber: true,
  fundingSource: true,
  price: true,
  category: { select: { name: true } },
} satisfies Prisma.LibraryBookSelect;

function stockGrowth(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function copyRow(
  row: {
    barcode: string;
    accessionNumber: string | null;
    status: string;
    collectionCode: string | null;
    callNumber: string | null;
    copyType: string | null;
    issueAllowed: boolean | null;
    shelvingLocation: string | null;
    acquisitionPrice: { toString(): string } | null;
    copyCondition: string | null;
    book: {
      title: string;
      author: string | null;
      isbn: string | null;
      edition: string | null;
      publisher: string | null;
      publicationYear: string | null;
      subject: string | null;
      classificationNumber: string | null;
      bookType: string | null;
      acquisitionType: string | null;
      supplierName: string | null;
      invoiceNumber: string | null;
      fundingSource: string | null;
      price: { toString(): string } | null;
      category: { name: string } | null;
    };
    loans: { dueAt: Date }[];
  },
  serial: number,
  departmentName: string,
) {
  const loan = row.loans[0];
  const status = loan
    ? loan.dueAt < new Date()
      ? 'OVERDUE'
      : 'ISSUED'
    : row.status;
  return {
    serial,
    department: departmentName || row.collectionCode || '(Unmapped)',
    title: row.book.title,
    author: row.book.author ?? '',
    isbn: row.book.isbn ?? '',
    edition: row.book.edition ?? '',
    publisher: row.book.publisher ?? '',
    year: row.book.publicationYear ?? '',
    subject: row.book.subject ?? '',
    accession: row.accessionNumber ?? '',
    barcode: row.barcode,
    callNumber: row.callNumber || row.book.classificationNumber || '',
    copyType: copyTypeLabel(row.copyType),
    issue:
      row.issueAllowed == null
        ? 'Not set'
        : row.issueAllowed
          ? 'Allowed'
          : 'Not allowed',
    shelf: row.shelvingLocation ?? '',
    status,
    category: row.book.category?.name ?? '',
    acquisitionType: row.book.acquisitionType ?? '',
    supplier: row.book.supplierName ?? '',
    invoice: row.book.invoiceNumber ?? '',
    price: row.acquisitionPrice?.toString() || row.book.price?.toString() || '',
    funding: row.book.fundingSource ?? '',
    condition: row.copyCondition ?? '',
  };
}

function copyOrder(
  query: CatalogueReportQueryDto,
): Prisma.LibraryBookCopyOrderByWithRelationInput {
  const dir = query.dir ?? 'asc';
  if (query.sort === 'accession') return { accessionNumber: dir };
  if (query.sort === 'barcode') return { barcode: dir };
  if (query.sort === 'status') return { status: dir };
  if (query.sort === 'author') return { book: { author: dir } };
  if (query.sort === 'year') return { book: { publicationYear: dir } };
  return { book: { title: dir } };
}

function dateRange(query: CatalogueReportQueryDto) {
  const from = query.from ? new Date(query.from) : new Date('1900-01-01');
  const to = query.to ? new Date(query.to) : new Date();
  if (query.to && !query.to.includes('T')) to.setHours(23, 59, 59, 999);
  return { gte: from, lte: to };
}

function describeFilters(query: CatalogueReportQueryDto) {
  const parts = [
    query.search ? `Search: ${query.search}` : '',
    query.collectionCode ? `Collection: ${query.collectionCode}` : '',
    query.status ? `Status: ${query.status}` : '',
    query.from || query.to
      ? `Period: ${query.from ?? 'start'} to ${query.to ?? 'today'}`
      : '',
    query.author ? `Author: ${query.author}` : '',
    query.publisher ? `Publisher: ${query.publisher}` : '',
    query.year ? `Year: ${query.year}` : '',
  ].filter(Boolean);
  return parts.join('; ') || 'All records';
}

function emptyPayload(
  base: Omit<
    ReportPayload,
    'notes' | 'columns' | 'rows' | 'total' | 'totals' | 'unavailable'
  >,
  reason: string,
): ReportPayload {
  return {
    ...base,
    notes: [reason],
    columns: [{ key: 'notice', label: 'Notice' }],
    rows: [{ notice: reason }],
    total: 0,
    totals: {},
    unavailable: reason,
  };
}

function departmentNotes(key: string) {
  const notes = [
    'Distinct titles and physical copies are counted separately.',
    'A department name is used when the book is linked to an ERP department. Otherwise the Koha collection code is shown.',
    'Issued copies are copies with an open loan. Available copies are on the shelf and not on loan.',
  ];
  if (key === 'principal-summary' || key === 'principal-stock') {
    notes.push(
      'Stock verification has not been recorded, so inventory discrepancies are not included.',
    );
    notes.push(
      'This statement shows the physical collection. Availability is the subset that is not issued, lost, or damaged.',
    );
  }
  return notes;
}

function copyNotes(key: string) {
  if (key === 'unmapped' || key === 'unverified') {
    return [
      'These records have no confirmed academic department. The original collection code is blank or was not verified.',
    ];
  }
  if (key === 'missing-accession' || key === 'missing-barcode') {
    return [
      'These copies were kept. A barcode or accession number was not invented for them.',
    ];
  }
  if (key === 'duplicates') {
    return [
      'Repeated barcodes and accession numbers are listed for review. They were not deleted.',
    ];
  }
  if (key === 'reference-register') {
    return [
      'Reference copies are listed from the copy type. Older titles marked Reference, with no copy type yet, are included and are not relabelled.',
    ];
  }
  if (
    key === 'available' ||
    key === 'lost' ||
    key === 'damaged' ||
    key === 'lost-damaged-inventory'
  ) {
    return [
      'Each row is one physical copy. Copy type shows Reference, General, and the other copy types when they have been set.',
    ];
  }
  return ['Each row is one physical copy.'];
}

function isDepartmentSummary(key: string) {
  return [
    'department-summary',
    'department-statistics',
    'stock-statement',
    'principal-stock',
    'principal-summary',
  ].includes(key);
}
