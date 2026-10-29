import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { ReportPayload } from '../reports/library-catalogue-report.logic';
import type {
  BarcodeCopyQueryDto,
  CreateBarcodeJobDto,
  LabelSettingsDto,
  UpdateBarcodeJobDto,
} from './library-barcode.dto';
import {
  BARCODE_SELECT_LIMIT,
  type BarcodeCopyInput,
  type LabelSettings,
  labelSheetFits,
  mergeLabelSettings,
  prepareBarcodeLabels,
} from './library-barcode.logic';

const JOB_STATUS = ['PREPARED', 'DIALOG_OPENED', 'USER_CONFIRMED'] as const;
const NEXT_STATUS: Record<string, string[]> = {
  PREPARED: ['DIALOG_OPENED', 'USER_CONFIRMED'],
  DIALOG_OPENED: ['USER_CONFIRMED'],
  USER_CONFIRMED: [],
};

@Injectable()
export class LibraryBarcodeService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const [counts, duplicates, confirmed] = await Promise.all([
      this.prisma.$queryRaw<
        {
          total: number;
          withAccession: number;
          matched: number;
          missing: number;
        }[]
      >`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE NULLIF(BTRIM(c.accession_number), '') IS NOT NULL)::int AS "withAccession",
          COUNT(*) FILTER (
            WHERE NULLIF(BTRIM(c.accession_number), '') IS NOT NULL
              AND BTRIM(c.accession_number) = c.barcode
          )::int AS matched,
          COUNT(*) FILTER (WHERE NULLIF(BTRIM(c.accession_number), '') IS NULL)::int AS missing
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        WHERE c.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
      `,
      this.duplicateAccessions(tenantId),
      this.prisma.libraryBarcodePrintItem.findMany({
        where: { tenantId, job: { status: 'USER_CONFIRMED' } },
        distinct: ['copyId'],
        select: { copyId: true },
      }),
    ]);
    const row = counts[0] ?? {
      total: 0,
      withAccession: 0,
      matched: 0,
      missing: 0,
    };
    const duplicateCopies = duplicates.reduce(
      (sum, item) => sum + item.copies,
      0,
    );
    return {
      totalCopies: row.total,
      withAccession: row.withAccession,
      printable: Math.max(row.matched - duplicateCopies, 0),
      confirmedLabels: confirmed.length,
      missingAccession: row.missing,
      duplicateAccessionNumbers: duplicates.length,
      duplicateCopyCount: duplicateCopies,
      note: 'Confirmed means the browser print dialog closed. It does not prove the label left the printer.',
    };
  }

  async copies(tenantId: string, query: BarcodeCopyQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = await this.copyWhere(tenantId, query);
    const [total, records] = await Promise.all([
      this.prisma.libraryBookCopy.count({ where }),
      this.prisma.libraryBookCopy.findMany({
        where,
        include: copyInclude,
        orderBy: [{ accessionNumber: 'asc' }, { barcode: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const departments = await this.departmentNames(
      tenantId,
      records.map((row) => row.book.departmentId),
    );
    return {
      items: records.map((row) => this.toListRow(row, departments)),
      total,
      page,
      limit,
    };
  }

  async copyIds(tenantId: string, query: BarcodeCopyQueryDto) {
    const where = await this.copyWhere(tenantId, query);
    const [total, records] = await Promise.all([
      this.prisma.libraryBookCopy.count({ where }),
      this.prisma.libraryBookCopy.findMany({
        where,
        select: { id: true },
        orderBy: [{ accessionNumber: 'asc' }, { barcode: 'asc' }],
        take: BARCODE_SELECT_LIMIT,
      }),
    ]);
    return {
      ids: records.map((row) => row.id),
      total,
      truncated: total > records.length,
      limit: BARCODE_SELECT_LIMIT,
    };
  }

  async preview(tenantId: string, copyIds: string[]) {
    const labels = await this.labelInputs(tenantId, copyIds);
    return prepareBarcodeLabels(labels);
  }

  async createJob(tenantId: string, user: JwtUser, dto: CreateBarcodeJobDto) {
    const prepared = prepareBarcodeLabels(
      await this.labelInputs(tenantId, dto.copyIds),
    );
    if (prepared.rejected.length) {
      throw new BadRequestException({
        message: 'Some selected copies cannot be printed.',
        rejected: prepared.rejected,
      });
    }
    if (!prepared.labels.length) {
      throw new BadRequestException('Select at least one printable copy.');
    }
    const job = await this.prisma.libraryBarcodePrintJob.create({
      data: {
        tenantId,
        actorId: user.sub,
        actorLabel: user.email,
        mode: dto.mode,
        status: 'PREPARED',
        labelCount: prepared.labels.length,
        filterSnapshot: {
          copyIds: prepared.labels.map((label) => label.copyId),
        },
        items: {
          create: prepared.labels.map((label) => ({
            tenantId,
            copyId: label.copyId,
            accessionNumber: label.accessionNumber,
            barcode: label.encodedValue,
          })),
        },
      },
    });
    return { jobId: job.id, status: job.status, labels: prepared.labels };
  }

  async updateJob(tenantId: string, jobId: string, dto: UpdateBarcodeJobDto) {
    const job = await this.prisma.libraryBarcodePrintJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Print job not found');
    if (!NEXT_STATUS[job.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `A ${job.status} job cannot move to ${dto.status}.`,
      );
    }
    return this.prisma.libraryBarcodePrintJob.update({
      where: { id: job.id },
      data: { status: dto.status },
      select: { id: true, status: true, labelCount: true, mode: true },
    });
  }

  async jobs(tenantId: string, page = 1) {
    const limit = 25;
    const where = { tenantId };
    const [total, items] = await Promise.all([
      this.prisma.libraryBarcodePrintJob.count({ where }),
      this.prisma.libraryBarcodePrintJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorLabel: true,
          mode: true,
          status: true,
          labelCount: true,
          createdAt: true,
          items: { select: { accessionNumber: true, copyId: true }, take: 100 },
        },
      }),
    ]);
    return {
      items: items.map((job) => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        sampleAccessions: job.items
          .slice(0, 3)
          .map((item) => item.accessionNumber),
        copyIds: job.items.map((item) => item.copyId),
      })),
      total,
      page,
      limit,
      note: 'USER_CONFIRMED means the browser print dialog closed. It does not prove a label was physically printed.',
    };
  }

  async getSettings(tenantId: string) {
    const [settings, institution] = await Promise.all([
      this.prisma.librarySettings.findUnique({
        where: { tenantId },
        select: { barcodeLabelSettings: true },
      }),
      this.institution(tenantId),
    ]);
    const template = mergeLabelSettings(
      settings?.barcodeLabelSettings,
      institution,
    );
    return {
      template,
      fits: labelSheetFits(template),
      institutionName: institution.name,
    };
  }

  async saveSettings(tenantId: string, dto: LabelSettingsDto) {
    const institution = await this.institution(tenantId);
    const template = mergeLabelSettings(dto, institution);
    if (!labelSheetFits(template)) {
      throw new BadRequestException(
        'These labels do not fit on the page after margins and gaps. Reduce the label size or the number of rows and columns.',
      );
    }
    await this.prisma.librarySettings.upsert({
      where: { tenantId },
      update: {
        barcodeLabelSettings: template as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        barcodeLabelSettings: template as unknown as Prisma.InputJsonValue,
      },
    });
    return { template, fits: true };
  }

  definitions() {
    return BARCODE_REPORTS;
  }

  async report(
    tenantId: string,
    key: string,
    query: BarcodeCopyQueryDto,
  ): Promise<ReportPayload> {
    const definition = BARCODE_REPORTS.find((item) => item.key === key);
    if (!definition) throw new NotFoundException('Report not found');
    const institution = await this.institution(tenantId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const base = {
      key,
      title: definition.title,
      institutionName: institution.name,
      generatedAt: new Date().toISOString(),
      filters: describeFilters(query),
      notes: [
        'Each row is one physical copy. A title with several copies is counted once per copy.',
        'Print confirmed means the browser print dialog closed, not that the printer finished.',
      ],
      page,
      limit,
      formal: false,
      unavailable: undefined,
    };
    if (key === 'barcode-history' || key === 'barcode-reprints') {
      return this.historyReport(tenantId, key, base);
    }
    if (key === 'barcode-department')
      return this.departmentReport(tenantId, base);
    if (key === 'barcode-duplicates')
      return this.duplicateReport(tenantId, base);
    const printStatus = key === 'barcode-unprinted' ? 'UNPRINTED' : undefined;
    const where = await this.copyWhere(tenantId, {
      ...query,
      printStatus:
        key === 'barcode-inventory' ? query.printStatus : printStatus,
    });
    if (key === 'barcode-missing') {
      const current = Array.isArray(where.AND) ? where.AND : [];
      where.AND = [
        ...current,
        { OR: [{ accessionNumber: null }, { accessionNumber: '' }] },
      ];
    }
    if (key === 'barcode-valid') {
      const current = Array.isArray(where.AND) ? where.AND : [];
      where.AND = [
        ...current,
        { accessionNumber: { not: null } },
        { NOT: { accessionNumber: '' } },
        { NOT: { barcode: '' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.libraryBookCopy.count({ where }),
      this.prisma.libraryBookCopy.findMany({
        where,
        include: copyInclude,
        orderBy: [{ accessionNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const departments = await this.departmentNames(
      tenantId,
      records.map((row) => row.book.departmentId),
    );
    const rows = records.map((row, index) => {
      const item = this.toListRow(row, departments);
      return {
        serial: (page - 1) * limit + index + 1,
        accession: item.accessionNumber,
        title: item.title,
        author: item.author,
        department: item.department,
        callNumber: item.callNumber,
        isbn: item.isbn,
        barcode: item.barcode,
        status: item.blocker ?? item.printStatus,
      };
    });
    return {
      ...base,
      columns: COPY_COLUMNS,
      rows,
      total,
      totals: { copies: total },
    };
  }

  private async historyReport(
    tenantId: string,
    key: string,
    base: ReportPayloadBase,
  ): Promise<ReportPayload> {
    const where = {
      tenantId,
      ...(key === 'barcode-reprints' ? { mode: 'REPRINT' } : {}),
    };
    const [total, jobs] = await Promise.all([
      this.prisma.libraryBarcodePrintJob.count({ where }),
      this.prisma.libraryBarcodePrintJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (base.page - 1) * base.limit,
        take: base.limit,
        include: { items: { select: { accessionNumber: true }, take: 8 } },
      }),
    ]);
    return {
      ...base,
      notes: base.notes,
      columns: [
        { key: 'when', label: 'Date and time' },
        { key: 'user', label: 'User' },
        { key: 'mode', label: 'Print mode' },
        { key: 'status', label: 'Job status' },
        { key: 'labels', label: 'Labels' },
        { key: 'accessions', label: 'Accession numbers', text: true },
      ],
      rows: jobs.map((job) => ({
        when: job.createdAt.toISOString(),
        user: job.actorLabel ?? '',
        mode: job.mode,
        status: job.status,
        labels: job.labelCount,
        accessions: job.items.map((item) => item.accessionNumber).join(', '),
      })),
      total,
      totals: { jobs: total },
    };
  }

  private async departmentReport(
    tenantId: string,
    base: ReportPayloadBase,
  ): Promise<ReportPayload> {
    const rows = await this.prisma.$queryRaw<
      { department: string; copies: number }[]
    >`
      SELECT COALESCE(NULLIF(BTRIM(d.department_name), ''), '(No department)') AS department,
        COUNT(c.id)::int AS copies
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      LEFT JOIN core.departments d ON d.id = b.department_id AND d.deleted_at IS NULL
      WHERE c.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
      GROUP BY 1
      ORDER BY copies DESC
    `;
    return {
      ...base,
      notes: [
        ...base.notes,
        'Department comes from the book department field, not from the barcode.',
      ],
      columns: [
        { key: 'department', label: 'Department' },
        { key: 'copies', label: 'Physical copies' },
      ],
      rows,
      total: rows.length,
      totals: {
        copies: rows.reduce((sum, row) => sum + Number(row.copies), 0),
      },
    };
  }

  private async duplicateReport(
    tenantId: string,
    base: ReportPayloadBase,
  ): Promise<ReportPayload> {
    const duplicates = await this.duplicateAccessions(tenantId);
    return {
      ...base,
      notes: [
        ...base.notes,
        'These accession numbers are not changed by barcode printing.',
      ],
      columns: [
        { key: 'accession', label: 'Accession number', text: true },
        { key: 'copies', label: 'Physical copies' },
      ],
      rows: duplicates.map((row) => ({
        accession: row.value,
        copies: row.copies,
      })),
      total: duplicates.length,
      totals: { copies: duplicates.reduce((sum, row) => sum + row.copies, 0) },
    };
  }

  private async labelInputs(
    tenantId: string,
    copyIds: string[],
  ): Promise<BarcodeCopyInput[]> {
    const ids = [...new Set(copyIds)];
    const records = await this.prisma.libraryBookCopy.findMany({
      where: { tenantId, id: { in: ids }, book: { deletedAt: null } },
      include: copyInclude,
    });
    const departments = await this.departmentNames(
      tenantId,
      records.map((row) => row.book.departmentId),
    );
    const byId = new Map(records.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        id: row.id,
        accessionNumber: row.accessionNumber,
        barcode: row.barcode,
        title: row.book.title,
        author: [row.book.author, row.book.additionalAuthors]
          .filter(Boolean)
          .join(', '),
        callNumber: row.callNumber || row.book.classificationNumber,
        department: departments.get(row.book.departmentId ?? '') ?? '',
      }));
  }

  private async copyWhere(
    tenantId: string,
    query: BarcodeCopyQueryDto,
  ): Promise<Prisma.LibraryBookCopyWhereInput> {
    const search = query.search?.trim();
    const duplicates =
      query.printStatus === 'NOT_PRINTABLE' || query.printStatus === 'UNPRINTED'
        ? (await this.duplicateAccessions(tenantId)).map((row) => row.value)
        : [];
    const book: Prisma.LibraryBookWhereInput = {
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.publisher
        ? { publisher: { contains: query.publisher, mode: 'insensitive' } }
        : {}),
      ...(query.year ? { publicationYear: query.year } : {}),
      ...(query.edition
        ? { edition: { contains: query.edition, mode: 'insensitive' } }
        : {}),
    };
    const where: Prisma.LibraryBookCopyWhereInput = {
      tenantId,
      book,
      ...(query.accessionFrom || query.accessionTo
        ? {
            accessionNumber: {
              ...(query.accessionFrom ? { gte: query.accessionFrom } : {}),
              ...(query.accessionTo ? { lte: query.accessionTo } : {}),
            },
          }
        : {}),
    };
    if (search) {
      where.AND = [
        {
          OR: [
            { accessionNumber: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
            { callNumber: { contains: search, mode: 'insensitive' } },
            { book: { title: { contains: search, mode: 'insensitive' } } },
            { book: { author: { contains: search, mode: 'insensitive' } } },
            { book: { isbn: { contains: search, mode: 'insensitive' } } },
            {
              book: {
                classificationNumber: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        },
      ];
    }
    if (query.printStatus === 'CONFIRMED') {
      where.barcodePrintItems = { some: { job: { status: 'USER_CONFIRMED' } } };
    }
    if (query.printStatus === 'UNPRINTED') {
      where.barcodePrintItems = { none: { job: { status: 'USER_CONFIRMED' } } };
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { accessionNumber: { not: null } },
        { NOT: { accessionNumber: '' } },
        { NOT: { barcode: '' } },
        ...(duplicates.length
          ? [{ NOT: { accessionNumber: { in: duplicates } } }]
          : []),
      ];
    }
    if (query.printStatus === 'NOT_PRINTABLE') {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { accessionNumber: null },
            { accessionNumber: '' },
            { barcode: '' },
            ...(duplicates.length
              ? [{ accessionNumber: { in: duplicates } }]
              : []),
          ],
        },
      ];
    }
    return where;
  }

  private toListRow(row: CopyRecord, departments: Map<string, string>) {
    const statuses = row.barcodePrintItems.map((item) => item.job.status);
    const printStatus = statuses.includes('USER_CONFIRMED')
      ? 'CONFIRMED'
      : statuses.includes('DIALOG_OPENED')
        ? 'DIALOG_OPENED'
        : statuses.includes('PREPARED')
          ? 'PREPARED'
          : 'NEVER';
    const prepared = prepareBarcodeLabels([
      {
        id: row.id,
        accessionNumber: row.accessionNumber,
        barcode: row.barcode,
        title: row.book.title,
        author: row.book.author,
        callNumber: row.callNumber || row.book.classificationNumber,
        department: departments.get(row.book.departmentId ?? '') ?? '',
      },
    ]);
    return {
      copyId: row.id,
      bookId: row.bookId,
      accessionNumber: row.accessionNumber ?? '',
      barcode: row.barcode,
      title: row.book.title,
      author: [row.book.author, row.book.additionalAuthors]
        .filter(Boolean)
        .join(', '),
      isbn: row.book.isbn ?? '',
      publisher: row.book.publisher ?? '',
      edition: row.book.edition ?? '',
      publicationYear: row.book.publicationYear ?? '',
      department: departments.get(row.book.departmentId ?? '') ?? '',
      category: row.book.category?.name ?? '',
      callNumber: row.callNumber || row.book.classificationNumber || '',
      copyStatus: row.status,
      printStatus,
      printable: prepared.labels.length === 1,
      blocker: prepared.rejected[0]?.reason ?? null,
    };
  }

  private async duplicateAccessions(tenantId: string) {
    return this.prisma.$queryRaw<{ value: string; copies: number }[]>`
      SELECT BTRIM(c.accession_number) AS value, COUNT(*)::int AS copies
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND b.deleted_at IS NULL
        AND NULLIF(BTRIM(c.accession_number), '') IS NOT NULL
      GROUP BY BTRIM(c.accession_number)
      HAVING COUNT(*) > 1
      ORDER BY copies DESC
      LIMIT 200
    `;
  }

  private async departmentNames(tenantId: string, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.department.findMany({
      where: { tenantId, id: { in: unique }, deletedAt: null },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async institution(tenantId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      select: { name: true, code: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      name: institution?.name?.trim() || 'Don Bosco College, Tura',
      code: institution?.code,
    };
  }
}

const copyInclude = {
  book: {
    select: {
      title: true,
      author: true,
      additionalAuthors: true,
      isbn: true,
      publisher: true,
      edition: true,
      publicationYear: true,
      classificationNumber: true,
      departmentId: true,
      category: { select: { name: true } },
    },
  },
  barcodePrintItems: {
    where: { job: { status: { in: [...JOB_STATUS] } } },
    select: { job: { select: { status: true } } },
    take: 8,
  },
} satisfies Prisma.LibraryBookCopyInclude;

type CopyRecord = Prisma.LibraryBookCopyGetPayload<{
  include: typeof copyInclude;
}>;

const COPY_COLUMNS = [
  { key: 'serial', label: 'S.No.' },
  { key: 'accession', label: 'Accession number', text: true },
  { key: 'title', label: 'Book title' },
  { key: 'author', label: 'Author' },
  { key: 'department', label: 'Department' },
  { key: 'callNumber', label: 'Call number' },
  { key: 'isbn', label: 'ISBN', text: true },
  { key: 'barcode', label: 'Barcode', text: true },
  { key: 'status', label: 'Status' },
];

const BARCODE_REPORTS = [
  { key: 'barcode-inventory', title: 'Complete barcode inventory' },
  { key: 'barcode-valid', title: 'Books with valid accession numbers' },
  { key: 'barcode-missing', title: 'Books missing accession numbers' },
  { key: 'barcode-duplicates', title: 'Duplicate accession numbers' },
  { key: 'barcode-history', title: 'Barcode print history' },
  { key: 'barcode-department', title: 'Department-wise barcode inventory' },
  { key: 'barcode-unprinted', title: 'Unprinted labels' },
  { key: 'barcode-reprints', title: 'Reprinted labels' },
];

function describeFilters(query: BarcodeCopyQueryDto) {
  return [
    query.search ? `Search: ${query.search}` : '',
    query.departmentId ? `Department: ${query.departmentId}` : '',
    query.publisher ? `Publisher: ${query.publisher}` : '',
    query.year ? `Year: ${query.year}` : '',
    query.printStatus ? `Print status: ${query.printStatus}` : '',
    query.accessionFrom || query.accessionTo
      ? `Accession: ${query.accessionFrom ?? 'start'} to ${query.accessionTo ?? 'end'}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
}

type ReportPayloadBase = Omit<
  ReportPayload,
  'columns' | 'rows' | 'total' | 'totals'
>;

export type { LabelSettings };
