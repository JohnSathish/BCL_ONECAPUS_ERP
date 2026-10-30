import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CatalogueReportQueryDto } from '../dto/catalogue-report.dto';

type CountRow = {
  titles: number;
  copies: number;
  available: number;
  issued: number;
  lost: number;
  damaged: number;
};

type DepartmentRow = CountRow & {
  id: string;
  code: string;
  name: string;
};

@Injectable()
export class LibraryDepartmentInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string, query: CatalogueReportQueryDto) {
    const [cards, unmapped, departments, institutionName] = await Promise.all([
      this.cardCounts(tenantId, query),
      this.unmappedTitleCount(tenantId, query),
      this.departmentRows(tenantId, query),
      this.institutionName(tenantId),
    ]);
    return {
      institutionName,
      generatedAt: new Date().toISOString(),
      cards: {
        departments: departments.length,
        titles: cards.titles,
        copies: cards.copies,
        available: cards.available,
        issued: cards.issued,
        lost: cards.lost,
        damaged: cards.damaged,
        unmapped,
      },
      departments,
      note: 'A title linked to more than one department is counted in each of those departments. The cards count each title and each physical copy once. Books with no ERP department stay unmapped.',
    };
  }

  async books(tenantId: string, query: CatalogueReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.copyFilters(tenantId, query);
    const department = this.departmentSql(query.departmentId);
    const order =
      query.sort === 'author'
        ? Prisma.sql`b.author ${query.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}, b.title ASC`
        : Prisma.sql`b.title ${query.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}`;
    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<[{ total: number }]>`
        SELECT COUNT(*)::int AS total FROM (
          SELECT b.id
          FROM library.library_book_copies c
          JOIN library.library_books b ON b.id = c.book_id
          ${this.loanJoin()}
          WHERE ${where} ${department}
          GROUP BY b.id
        ) titles
      `,
      this.prisma.$queryRaw<BookGroup[]>`
        SELECT
          b.id,
          b.title,
          COALESCE(b.author, '') AS author,
          COALESCE(b.isbn, '') AS isbn,
          COALESCE(b.publisher, '') AS publisher,
          COALESCE(b.publication_year, '') AS "publicationYear",
          COALESCE(b.edition, '') AS edition,
          COALESCE(cat.name, '') AS category,
          COALESCE(NULLIF(BTRIM(b.shelf), ''), NULLIF(BTRIM(b.rack), ''), '') AS location,
          COUNT(c.id)::int AS copies,
          COUNT(c.id) FILTER (WHERE loan.id IS NULL AND c.status = 'AVAILABLE')::int AS available,
          COUNT(c.id) FILTER (WHERE loan.id IS NOT NULL)::int AS issued,
          COUNT(c.id) FILTER (WHERE c.status IN ('LOST', 'DAMAGED'))::int AS "lostDamaged",
          MIN(NULLIF(BTRIM(c.call_number), '')) AS "callNumber",
          CASE
            WHEN COUNT(DISTINCT NULLIF(BTRIM(c.collection_code), '')) = 1
              THEN MIN(NULLIF(BTRIM(c.collection_code), ''))
            WHEN COUNT(DISTINCT NULLIF(BTRIM(c.collection_code), '')) > 1 THEN 'Mixed'
            ELSE COALESCE(b.book_type, '')
          END AS "collectionType"
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        LEFT JOIN library.library_categories cat ON cat.id = b.category_id
        ${this.loanJoin()}
        WHERE ${where} ${department}
        GROUP BY b.id, cat.name
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
    ]);
    return {
      page,
      limit,
      total: Number(countRow[0]?.total ?? 0),
      rows: rows.map(numberizeBook),
    };
  }

  async copyRows(tenantId: string, bookId: string) {
    const rows = await this.prisma.$queryRaw<CopyRow[]>`
      SELECT
        c.id,
        COALESCE(c.accession_number, '') AS accession,
        c.barcode,
        c.status,
        COALESCE(c.call_number, '') AS "callNumber",
        COALESCE(c.collection_code, '') AS "collectionCode",
        COALESCE(c.shelving_location, '') AS "shelvingLocation",
        (loan.id IS NOT NULL) AS "onLoan"
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id AND b.deleted_at IS NULL
      ${this.loanJoin()}
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND c.book_id = CAST(${bookId} AS uuid)
      ORDER BY c.accession_number ASC NULLS LAST, c.copy_number ASC
    `;
    return rows.map((row) => ({
      ...row,
      onLoan: Boolean(row.onLoan),
      displayStatus: copyInventoryStatus(row.status, Boolean(row.onLoan)),
    }));
  }

  async accessionRegister(tenantId: string, query: CatalogueReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.copyFilters(tenantId, query);
    const department = this.departmentSql(query.departmentId);
    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<[{ total: number }]>`
        SELECT COUNT(c.id)::int AS total
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        ${this.loanJoin()}
        WHERE ${where} ${department}
      `,
      this.prisma.$queryRaw<RegisterRow[]>`
        SELECT
          COALESCE(c.accession_number, '') AS accession,
          b.title,
          COALESCE(b.author, '') AS author,
          COALESCE(b.isbn, '') AS isbn,
          c.status,
          (loan.id IS NOT NULL) AS "onLoan",
          COALESCE(dep.department_name, '') AS department
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        ${this.loanJoin()}
        LEFT JOIN core.departments dep ON dep.id = b.department_id AND dep.deleted_at IS NULL
        WHERE ${where} ${department}
        ORDER BY c.accession_number ASC NULLS LAST, b.title ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
    ]);
    return {
      page,
      limit,
      total: Number(countRow[0]?.total ?? 0),
      rows: rows.map((row) => ({
        ...row,
        onLoan: Boolean(row.onLoan),
        displayStatus: copyInventoryStatus(row.status, Boolean(row.onLoan)),
      })),
    };
  }

  async unmapped(tenantId: string, query: CatalogueReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const next = { ...query, departmentId: 'unmapped' };
    const where = this.copyFilters(tenantId, next);
    const [countRow, rows] = await Promise.all([
      this.prisma.$queryRaw<[{ total: number }]>`
        SELECT COUNT(*)::int AS total FROM (
          SELECT b.id
          FROM library.library_book_copies c
          JOIN library.library_books b ON b.id = c.book_id
          ${this.loanJoin()}
          WHERE ${where}
          GROUP BY b.id
        ) titles
      `,
      this.prisma.$queryRaw<UnmappedRow[]>`
        SELECT
          b.id,
          b.title,
          COALESCE(b.author, '') AS author,
          COALESCE(MIN(NULLIF(BTRIM(c.accession_number), '')), '') AS accession,
          COALESCE(MIN(NULLIF(BTRIM(c.collection_code), '')), '') AS "collectionCode",
          COUNT(c.id)::int AS copies
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        ${this.loanJoin()}
        WHERE ${where}
        GROUP BY b.id
        ORDER BY b.title ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
    ]);
    return {
      page,
      limit,
      total: Number(countRow[0]?.total ?? 0),
      rows: rows.map((row) => ({ ...row, copies: Number(row.copies) })),
    };
  }

  async assign(
    tenantId: string,
    dto: { departmentId: string; bookIds: string[] },
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!department) {
      throw new BadRequestException('Choose a department from this college.');
    }
    const books = await this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null, id: { in: dto.bookIds } },
      select: { id: true, departmentId: true },
    });
    let linked = 0;
    let primarySet = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const book of books) {
        await tx.libraryBookDepartment.upsert({
          where: {
            bookId_departmentId: {
              bookId: book.id,
              departmentId: department.id,
            },
          },
          create: {
            id: randomUUID(),
            tenantId,
            bookId: book.id,
            departmentId: department.id,
          },
          update: {},
        });
        linked += 1;
        if (!book.departmentId) {
          await tx.libraryBook.update({
            where: { id: book.id },
            data: { departmentId: department.id },
          });
          primarySet += 1;
        }
      }
    });
    return {
      department: department.name,
      linked,
      primarySet,
      skipped: dto.bookIds.length - books.length,
    };
  }

  async export(
    tenantId: string,
    user: JwtUser,
    query: CatalogueReportQueryDto,
    format: 'xlsx' | 'csv' | 'pdf',
  ) {
    const summary = await this.summary(tenantId, query);
    const books = await this.books(tenantId, {
      ...query,
      page: 1,
      limit: 4000,
    });
    const register = await this.accessionRegister(tenantId, {
      ...query,
      page: 1,
      limit: 8000,
    });
    const unmapped = await this.unmapped(tenantId, {
      ...query,
      page: 1,
      limit: 4000,
    });
    const generatedBy = user.email;
    if (format === 'csv') {
      const lines = [
        ['Accession', 'Title', 'Author', 'ISBN', 'Status', 'Department'],
        ...register.rows.map((row) => [
          row.accession,
          row.title,
          row.author,
          row.isbn,
          row.displayStatus,
          row.department,
        ]),
      ];
      return fileResult(
        Buffer.from(
          lines.map((line) => line.map(csvCell).join(',')).join('\n'),
          'utf8',
        ),
        'text/csv; charset=utf-8',
        'csv',
      );
    }
    if (format === 'pdf') {
      return fileResult(
        await this.pdf(summary, books.rows, generatedBy, query),
        'application/pdf',
        'pdf',
      );
    }
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Department summary');
    summarySheet.addRow([summary.institutionName]);
    summarySheet.addRow(['Department-wise book inventory']);
    summarySheet.addRow([`Generated ${summary.generatedAt} by ${generatedBy}`]);
    summarySheet.addRow([]);
    summarySheet.addRow([
      'Department',
      'Code',
      'Unique titles',
      'Physical copies',
      'Available',
      'Issued',
      'Lost',
      'Damaged',
    ]).font = { bold: true };
    for (const row of summary.departments) {
      summarySheet.addRow([
        row.name,
        row.code,
        row.titles,
        row.copies,
        row.available,
        row.issued,
        row.lost,
        row.damaged,
      ]);
    }
    const bookSheet = workbook.addWorksheet('Book details');
    bookSheet.addRow([
      'Title',
      'Author',
      'ISBN',
      'Publisher',
      'Year',
      'Edition',
      'Category',
      'Call number',
      'Collection',
      'Copies',
      'Available',
      'Issued',
      'Lost or damaged',
      'Location',
    ]).font = { bold: true };
    for (const row of books.rows) {
      bookSheet.addRow([
        row.title,
        row.author,
        row.isbn,
        row.publisher,
        row.publicationYear,
        row.edition,
        row.category,
        row.callNumber ?? '',
        row.collectionType ?? '',
        row.copies,
        row.available,
        row.issued,
        row.lostDamaged,
        row.location,
      ]);
    }
    if (books.total > books.rows.length) {
      bookSheet.addRow([
        `Showing ${books.rows.length} of ${books.total} titles. Narrow the department or filters for the rest.`,
      ]);
    }
    const copySheet = workbook.addWorksheet('Accession register');
    copySheet.addRow([
      'Accession',
      'Title',
      'Author',
      'ISBN',
      'Status',
      'Department',
    ]).font = {
      bold: true,
    };
    for (const row of register.rows) {
      copySheet.addRow([
        row.accession,
        row.title,
        row.author,
        row.isbn,
        row.displayStatus,
        row.department,
      ]);
    }
    const unmappedSheet = workbook.addWorksheet('Unmapped books');
    unmappedSheet.addRow([
      'Title',
      'Author',
      'Accession',
      'Koha collection code',
      'Copies',
    ]).font = { bold: true };
    for (const row of unmapped.rows) {
      unmappedSheet.addRow([
        row.title,
        row.author,
        row.accession,
        row.collectionCode,
        row.copies,
      ]);
    }
    for (const sheet of workbook.worksheets) {
      sheet.columns.forEach((column) => {
        column.width = 22;
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return fileResult(
      Buffer.from(buffer),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx',
    );
  }

  private async pdf(
    summary: Awaited<ReturnType<LibraryDepartmentInventoryService['summary']>>,
    books: BookGroup[],
    generatedBy: string,
    query: CatalogueReportQueryDto,
  ) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 842;
    const pageHeight = 595;
    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 36;
    const draw = (text: string, size: number, useBold = false) => {
      if (y < 48) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 36;
      }
      page.drawText(text.slice(0, 140), {
        x: 32,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.12, 0.16),
      });
      y -= size + 6;
    };
    draw(summary.institutionName, 14, true);
    draw(
      query.scope === 'added'
        ? 'Department-wise books added in the selected period'
        : 'Department-wise book inventory',
      12,
      true,
    );
    draw(`Generated ${summary.generatedAt.slice(0, 10)} by ${generatedBy}`, 9);
    draw(
      `Titles ${summary.cards.titles} · Copies ${summary.cards.copies} · Available ${summary.cards.available} · Issued ${summary.cards.issued} · Lost ${summary.cards.lost} · Damaged ${summary.cards.damaged} · Unmapped titles ${summary.cards.unmapped}`,
      9,
    );
    y -= 6;
    draw(
      'Department    Titles    Copies    Available    Issued    Lost    Damaged',
      9,
      true,
    );
    for (const row of summary.departments.slice(0, 40)) {
      draw(
        `${row.code || '—'}  ${row.name}    ${row.titles}    ${row.copies}    ${row.available}    ${row.issued}    ${row.lost}    ${row.damaged}`,
        8,
      );
    }
    y -= 8;
    draw('Book register', 11, true);
    for (const row of books.slice(0, 60)) {
      draw(
        `${row.title} · ${row.author || 'Author not recorded'} · copies ${row.copies} · available ${row.available} · issued ${row.issued}`,
        8,
      );
    }
    y -= 16;
    draw(
      'Librarian ________________________    Principal ________________________',
      9,
    );
    const pages = doc.getPages();
    pages.forEach((sheet, index) => {
      sheet.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: pageWidth - 90,
        y: 24,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    });
    return Buffer.from(await doc.save());
  }

  private loanJoin() {
    return Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT l.id
        FROM library.library_loans l
        WHERE l.copy_id = c.id AND l.returned_at IS NULL AND l.status = 'ACTIVE'
        LIMIT 1
      ) loan ON true
    `;
  }

  private copyFilters(tenantId: string, query: CatalogueReportQueryDto) {
    const filters = [
      Prisma.sql`c.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];
    if (query.categoryId) {
      filters.push(
        Prisma.sql`b.category_id = CAST(${query.categoryId} AS uuid)`,
      );
    }
    if (query.collectionCode?.trim()) {
      filters.push(
        Prisma.sql`BTRIM(c.collection_code) = ${query.collectionCode.trim()}`,
      );
    }
    if (query.author?.trim()) {
      filters.push(Prisma.sql`b.author ILIKE ${`%${query.author.trim()}%`}`);
    }
    if (query.publisher?.trim()) {
      filters.push(
        Prisma.sql`b.publisher ILIKE ${`%${query.publisher.trim()}%`}`,
      );
    }
    if (query.year?.trim()) {
      filters.push(Prisma.sql`b.publication_year = ${query.year.trim()}`);
    }
    if (query.status === 'AVAILABLE') {
      filters.push(Prisma.sql`c.status = 'AVAILABLE' AND loan.id IS NULL`);
    } else if (query.status === 'ISSUED') {
      filters.push(Prisma.sql`loan.id IS NOT NULL`);
    } else if (query.status === 'LOST' || query.status === 'DAMAGED') {
      filters.push(Prisma.sql`c.status = ${query.status}`);
    }
    if (query.accessionFrom?.trim()) {
      filters.push(
        Prisma.sql`c.accession_number >= ${query.accessionFrom.trim()}`,
      );
    }
    if (query.accessionTo?.trim()) {
      filters.push(
        Prisma.sql`c.accession_number <= ${query.accessionTo.trim()}`,
      );
    }
    if (query.from)
      filters.push(Prisma.sql`c.acquisition_date >= ${query.from}::date`);
    if (query.to)
      filters.push(Prisma.sql`c.acquisition_date <= ${query.to}::date`);
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(
        Prisma.sql`(b.title ILIKE ${pattern} OR COALESCE(b.author, '') ILIKE ${pattern} OR COALESCE(c.accession_number, '') ILIKE ${pattern} OR c.barcode ILIKE ${pattern})`,
      );
    }
    if (query.departmentId === 'unmapped') {
      filters.push(Prisma.sql`b.department_id IS NULL`);
      filters.push(
        Prisma.sql`NOT EXISTS (SELECT 1 FROM library.library_book_departments bd WHERE bd.book_id = b.id)`,
      );
    }
    return Prisma.join(filters, ' AND ');
  }

  private departmentSql(departmentId?: string) {
    if (!departmentId || departmentId === 'unmapped') return Prisma.sql``;
    return Prisma.sql`
      AND (
        EXISTS (
          SELECT 1
          FROM library.library_book_departments bd
          WHERE bd.book_id = b.id
            AND bd.department_id = CAST(${departmentId} AS uuid)
        )
        OR (
          b.department_id = CAST(${departmentId} AS uuid)
          AND NOT EXISTS (
            SELECT 1 FROM library.library_book_departments bd WHERE bd.book_id = b.id
          )
        )
      )
    `;
  }

  private async cardCounts(
    tenantId: string,
    query: CatalogueReportQueryDto,
  ): Promise<CountRow> {
    const where = this.copyFilters(tenantId, query);
    const department = this.departmentSql(query.departmentId);
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(DISTINCT b.id)::int AS titles,
        COUNT(c.id)::int AS copies,
        COUNT(c.id) FILTER (WHERE loan.id IS NULL AND c.status = 'AVAILABLE')::int AS available,
        COUNT(c.id) FILTER (WHERE loan.id IS NOT NULL)::int AS issued,
        COUNT(c.id) FILTER (WHERE c.status = 'LOST')::int AS lost,
        COUNT(c.id) FILTER (WHERE c.status = 'DAMAGED')::int AS damaged
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      ${this.loanJoin()}
      WHERE ${where} ${department}
    `;
    return numberizeCount(rows[0]);
  }

  private async unmappedTitleCount(
    tenantId: string,
    query: CatalogueReportQueryDto,
  ) {
    const where = this.copyFilters(tenantId, {
      ...query,
      departmentId: 'unmapped',
    });
    const rows = await this.prisma.$queryRaw<[{ total: number }]>`
      SELECT COUNT(DISTINCT b.id)::int AS total
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      ${this.loanJoin()}
      WHERE ${where}
    `;
    return Number(rows[0]?.total ?? 0);
  }

  private async departmentRows(
    tenantId: string,
    query: CatalogueReportQueryDto,
  ) {
    const where = this.copyFilters(tenantId, {
      ...query,
      departmentId: undefined,
    });
    const only =
      query.departmentId && query.departmentId !== 'unmapped'
        ? Prisma.sql`AND d.id = CAST(${query.departmentId} AS uuid)`
        : Prisma.sql``;
    const rows = await this.prisma.$queryRaw<DepartmentRow[]>`
      WITH scoped AS (
        SELECT b.id AS book_id, c.id AS copy_id, c.status, loan.id AS loan_id
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        ${this.loanJoin()}
        WHERE ${where}
      ),
      membership AS (
        SELECT bd.book_id, bd.department_id
        FROM library.library_book_departments bd
        JOIN core.departments d ON d.id = bd.department_id AND d.deleted_at IS NULL
        JOIN library.library_books b ON b.id = bd.book_id
          AND b.tenant_id = CAST(${tenantId} AS uuid)
          AND b.deleted_at IS NULL
        UNION
        SELECT b.id, b.department_id
        FROM library.library_books b
        JOIN core.departments d ON d.id = b.department_id AND d.deleted_at IS NULL
        WHERE b.tenant_id = CAST(${tenantId} AS uuid)
          AND b.deleted_at IS NULL
          AND b.department_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM library.library_book_departments x WHERE x.book_id = b.id
          )
      )
      SELECT
        d.id,
        d.department_code AS code,
        d.department_name AS name,
        COUNT(DISTINCT s.book_id)::int AS titles,
        COUNT(s.copy_id)::int AS copies,
        COUNT(s.copy_id) FILTER (WHERE s.loan_id IS NULL AND s.status = 'AVAILABLE')::int AS available,
        COUNT(s.copy_id) FILTER (WHERE s.loan_id IS NOT NULL)::int AS issued,
        COUNT(s.copy_id) FILTER (WHERE s.status = 'LOST')::int AS lost,
        COUNT(s.copy_id) FILTER (WHERE s.status = 'DAMAGED')::int AS damaged
      FROM membership m
      JOIN scoped s ON s.book_id = m.book_id
      JOIN core.departments d ON d.id = m.department_id
      WHERE d.deleted_at IS NULL ${only}
      GROUP BY d.id, d.department_code, d.department_name
      ORDER BY copies DESC, d.department_name ASC
    `;
    return rows.map((row) => ({
      ...numberizeCount(row),
      id: row.id,
      code: row.code,
      name: row.name,
    }));
  }

  private async institutionName(tenantId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });
    return institution?.name?.trim() || 'College library';
  }
}

export function copyInventoryStatus(status: string, onLoan: boolean) {
  if (onLoan) return 'Issued';
  if (status === 'LOST') return 'Lost';
  if (status === 'DAMAGED') return 'Damaged';
  if (status === 'AVAILABLE') return 'Available';
  if (status === 'WITHDRAWN') return 'Withdrawn';
  return status;
}

type BookGroup = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publicationYear: string;
  edition: string;
  category: string;
  location: string;
  copies: number;
  available: number;
  issued: number;
  lostDamaged: number;
  callNumber: string | null;
  collectionType: string | null;
};

type CopyRow = {
  id: string;
  accession: string;
  barcode: string;
  status: string;
  callNumber: string;
  collectionCode: string;
  shelvingLocation: string;
  onLoan: boolean;
};

type RegisterRow = {
  accession: string;
  title: string;
  author: string;
  isbn: string;
  status: string;
  onLoan: boolean;
  department: string;
  displayStatus?: string;
};

type UnmappedRow = {
  id: string;
  title: string;
  author: string;
  accession: string;
  collectionCode: string;
  copies: number;
};

function numberizeCount(row: CountRow | undefined): CountRow {
  return {
    titles: Number(row?.titles ?? 0),
    copies: Number(row?.copies ?? 0),
    available: Number(row?.available ?? 0),
    issued: Number(row?.issued ?? 0),
    lost: Number(row?.lost ?? 0),
    damaged: Number(row?.damaged ?? 0),
  };
}

function numberizeBook(row: BookGroup): BookGroup {
  return {
    ...row,
    copies: Number(row.copies),
    available: Number(row.available),
    issued: Number(row.issued),
    lostDamaged: Number(row.lostDamaged),
    callNumber: row.callNumber ?? '',
    collectionType: row.collectionType ?? '',
  };
}

function csvCell(value: string | number) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function fileResult(body: Buffer, contentType: string, extension: string) {
  return { body, contentType, extension };
}
