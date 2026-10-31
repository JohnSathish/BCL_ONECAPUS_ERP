import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readFile } from 'fs/promises';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolvePublicUploadFsPath } from '../../../common/uploads/upload-paths';
import { PrismaService } from '../../../database/prisma.service';
import { mergeCirculationPolicy } from '../domain/library-policy.types';
import type { CatalogueReportQueryDto } from '../dto/catalogue-report.dto';
import { buildDepartmentDetailWorkbook } from './library-department-detail-excel';
import {
  detailAvailability,
  detailCopyTypeLabel,
  type DetailCopy,
} from './library-department-detail.logic';

type RawCopy = {
  copyId: string;
  bookId: string;
  primaryDepartmentId: string | null;
  primaryDepartmentName: string | null;
  title: string;
  author: string;
  isbn: string;
  edition: string;
  publisher: string;
  year: string;
  subject: string;
  accession: string;
  barcode: string;
  callNumber: string;
  copyType: string | null;
  issueAllowed: boolean | null;
  status: string;
  bookType: string;
  categoryCode: string;
  onLoan: boolean;
};

@Injectable()
export class LibraryDepartmentDetailReportService {
  constructor(private readonly prisma: PrismaService) {}

  async workbook(
    tenantId: string,
    user: JwtUser,
    query: CatalogueReportQueryDto,
  ) {
    const layout = query.layout ?? 'selected';
    const departmentId = layout === 'selected' ? query.departmentId : undefined;
    const [rawCopies, links, branding, actor, academicYear, settings] =
      await Promise.all([
        this.copies(tenantId, query, departmentId),
        this.links(tenantId),
        this.prisma.tenantBranding.findUnique({
          where: { tenantId },
          select: { displayName: true, address: true, logoUrl: true },
        }),
        this.prisma.user.findFirst({
          where: { id: user.sub, tenantId },
          select: { displayName: true, email: true },
        }),
        this.prisma.academicYear.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
          select: { name: true },
        }),
        this.prisma.librarySettings.findUnique({
          where: { tenantId },
          select: { circulationPolicy: true },
        }),
      ]);
    const policy = mergeCirculationPolicy(settings?.circulationPolicy);
    const linked = new Map<string, { id: string; name: string }[]>();
    for (const link of links) {
      const list = linked.get(link.bookId) ?? [];
      if (!list.some((item) => item.id === link.departmentId)) {
        list.push({ id: link.departmentId, name: link.name });
      }
      linked.set(link.bookId, list);
    }
    const rows = rawCopies.map((row) => this.toCopy(row, linked, policy));
    const departmentLabel = departmentId
      ? await this.departmentName(tenantId, departmentId)
      : 'All departments';
    const collegeName =
      branding?.displayName?.trim() || 'Don Bosco College, Tura';
    const address =
      branding?.address?.trim() ||
      (/don bosco/i.test(collegeName) ? 'Tura, Meghalaya – 794002' : '');
    const buffer = await buildDepartmentDetailWorkbook({
      collegeName,
      address,
      generatedAt: new Date().toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
      generatedBy: actor?.displayName?.trim() || actor?.email || user.email,
      academicYear: academicYear?.name ?? '',
      period:
        query.from || query.to
          ? `${query.from || 'start'} to ${query.to || 'today'} (acquisition date)`
          : 'All records currently in the catalogue',
      layout:
        layout === 'sheets'
          ? 'sheets'
          : layout === 'consolidated'
            ? 'consolidated'
            : 'selected',
      departmentLabel,
      rows,
      logo: await readLogo(branding?.logoUrl),
    });
    return {
      body: buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  private toCopy(
    row: RawCopy,
    linked: Map<string, { id: string; name: string }[]>,
    policy: ReturnType<typeof mergeCirculationPolicy>,
  ): DetailCopy {
    const junctions = linked.get(row.bookId) ?? [];
    const departments = junctions.length
      ? junctions.map((item) => item.name)
      : row.primaryDepartmentName
        ? [row.primaryDepartmentName]
        : [];
    const department =
      (row.primaryDepartmentId &&
        junctions.find((item) => item.id === row.primaryDepartmentId)?.name) ||
      row.primaryDepartmentName ||
      departments.slice().sort((left, right) => left.localeCompare(right))[0] ||
      '(Unmapped)';
    return {
      copyId: row.copyId,
      bookId: row.bookId,
      department,
      departments,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      edition: row.edition,
      publisher: row.publisher,
      year: row.year,
      subject: row.subject,
      accession: row.accession,
      barcode: row.barcode,
      callNumber: row.callNumber,
      copyType: detailCopyTypeLabel(row.copyType, row.bookType),
      status: detailAvailability({
        status: row.status,
        onLoan: Boolean(row.onLoan),
        issueAllowed: row.issueAllowed,
        copyType: row.copyType,
        categoryCode: row.categoryCode,
        copyIssue: policy.copyIssue,
        referenceAllow: policy.reference.allowIssue,
        rareAllow: policy.rare.allowIssue,
      }),
    };
  }

  private async copies(
    tenantId: string,
    query: CatalogueReportQueryDto,
    departmentId?: string,
  ) {
    const filters = [
      Prisma.sql`c.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];
    if (departmentId) {
      filters.push(Prisma.sql`(
        EXISTS (
          SELECT 1 FROM library.library_book_departments bd
          WHERE bd.book_id = b.id AND bd.department_id = CAST(${departmentId} AS uuid)
        )
        OR (
          b.department_id = CAST(${departmentId} AS uuid)
          AND NOT EXISTS (
            SELECT 1 FROM library.library_book_departments x WHERE x.book_id = b.id
          )
        )
      )`);
    }
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      filters.push(
        Prisma.sql`(b.title ILIKE ${pattern} OR b.author ILIKE ${pattern} OR b.isbn ILIKE ${pattern} OR c.barcode ILIKE ${pattern} OR c.accession_number ILIKE ${pattern})`,
      );
    }
    if (query.author?.trim()) {
      filters.push(Prisma.sql`b.author ILIKE ${`%${query.author.trim()}%`}`);
    }
    if (query.collectionCode && query.collectionCode !== '(Unmapped)') {
      filters.push(Prisma.sql`c.collection_code = ${query.collectionCode}`);
    }
    if (query.collectionCode === '(Unmapped)') {
      filters.push(
        Prisma.sql`(c.collection_code IS NULL OR BTRIM(c.collection_code) = '')`,
      );
    }
    if (query.status === 'ISSUED') {
      filters.push(Prisma.sql`loan.id IS NOT NULL`);
    } else if (query.status === 'AVAILABLE') {
      filters.push(Prisma.sql`loan.id IS NULL AND c.status = 'AVAILABLE'`);
    } else if (query.status === 'LOST') {
      filters.push(Prisma.sql`c.status = 'LOST'`);
    } else if (query.status === 'DAMAGED') {
      filters.push(Prisma.sql`c.status = 'DAMAGED'`);
    } else if (query.status) {
      filters.push(Prisma.sql`c.status = ${query.status}`);
    }
    if (query.from)
      filters.push(Prisma.sql`c.acquisition_date >= ${new Date(query.from)}`);
    if (query.to) {
      const end = new Date(query.to);
      if (!query.to.includes('T')) end.setHours(23, 59, 59, 999);
      filters.push(Prisma.sql`c.acquisition_date <= ${end}`);
    }
    const where = Prisma.join(filters, ' AND ');
    const rows: RawCopy[] = [];
    const batch = 2000;
    for (let offset = 0; ; offset += batch) {
      const page = await this.prisma.$queryRaw<RawCopy[]>`
        SELECT
          c.id AS "copyId",
          b.id AS "bookId",
          b.department_id AS "primaryDepartmentId",
          prim.department_name AS "primaryDepartmentName",
          b.title,
          TRIM(BOTH ' ;' FROM CONCAT_WS('; ', NULLIF(BTRIM(b.author), ''), NULLIF(BTRIM(b.additional_authors), ''))) AS author,
          COALESCE(b.isbn, '') AS isbn,
          COALESCE(b.edition, '') AS edition,
          COALESCE(b.publisher, '') AS publisher,
          COALESCE(b.publication_year, '') AS year,
          COALESCE(NULLIF(BTRIM(b.subject), ''), cat.name, '') AS subject,
          COALESCE(c.accession_number, '') AS accession,
          c.barcode,
          COALESCE(NULLIF(BTRIM(c.call_number), ''), NULLIF(BTRIM(b.classification_number), ''), '') AS "callNumber",
          c.copy_type AS "copyType",
          c.issue_allowed AS "issueAllowed",
          c.status,
          COALESCE(b.book_type, '') AS "bookType",
          COALESCE(cat.code, '') AS "categoryCode",
          (loan.id IS NOT NULL) AS "onLoan"
        FROM library.library_book_copies c
        JOIN library.library_books b ON b.id = c.book_id
        LEFT JOIN core.departments prim ON prim.id = b.department_id AND prim.deleted_at IS NULL
        LEFT JOIN library.library_categories cat ON cat.id = b.category_id
        LEFT JOIN LATERAL (
          SELECT l.id
          FROM library.library_loans l
          WHERE l.copy_id = c.id AND l.returned_at IS NULL AND l.status = 'ACTIVE'
          LIMIT 1
        ) loan ON true
        WHERE ${where}
        ORDER BY c.id
        LIMIT ${batch} OFFSET ${offset}
      `;
      rows.push(...page);
      if (page.length < batch) break;
    }
    return rows;
  }

  private links(tenantId: string) {
    return this.prisma.$queryRaw<
      { bookId: string; departmentId: string; name: string }[]
    >`
      SELECT bd.book_id AS "bookId", d.id AS "departmentId", d.department_name AS name
      FROM library.library_book_departments bd
      JOIN core.departments d ON d.id = bd.department_id AND d.deleted_at IS NULL
      JOIN library.library_books b ON b.id = bd.book_id
      WHERE b.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
    `;
  }

  private async departmentName(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
      select: { name: true },
    });
    return department?.name || 'Department';
  }
}

async function readLogo(url?: string | null) {
  if (!url?.trim()) return null;
  try {
    const buffer =
      url.startsWith('http://') || url.startsWith('https://')
        ? Buffer.from(
            await (
              await fetch(url, { signal: AbortSignal.timeout(4000) })
            ).arrayBuffer(),
          )
        : await readFile(resolvePublicUploadFsPath(url));
    const extension = imageExtension(buffer);
    return extension ? { buffer, extension } : null;
  } catch {
    return null;
  }
}

function imageExtension(buffer: Buffer): 'png' | 'jpeg' | 'gif' | null {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50)
    return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8)
    return 'jpeg';
  if (buffer.length > 6 && buffer.subarray(0, 6).toString() === 'GIF87a')
    return 'gif';
  if (buffer.length > 6 && buffer.subarray(0, 6).toString() === 'GIF89a')
    return 'gif';
  return null;
}
