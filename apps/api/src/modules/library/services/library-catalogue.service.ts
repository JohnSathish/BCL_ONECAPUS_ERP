import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  AddAccessionCopiesDto,
  BookQueryDto,
  CreateAccessionBookDto,
  CreateBookCopyDto,
  CreateBookDto,
  CreateCategoryDto,
  UpdateAccessionWorkflowDto,
  UpdateBookDto,
  UpdateCopyCirculationDto,
} from '../dto/library.dto';
import { mergeCirculationPolicy } from '../domain/library-policy.types';
import { copyTypeForBookType } from '../domain/library-copy-issue.logic';
import { LibrarySettingsService } from './library-settings.service';
import {
  accessionSeries,
  availabilityToStatuses,
  splitAuthors,
} from '../accession-numbers';

@Injectable()
export class LibraryCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
  ) {}

  async listCategories(tenantId: string) {
    await this.settings.ensureTenantDefaults(tenantId);
    return this.prisma.libraryCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.libraryCategory.create({
      data: {
        id: randomUUID(),
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async catalogueSummary(tenantId: string) {
    const [copies, titles, authors, categories, departments] =
      await Promise.all([
        this.prisma.libraryBookCopy.count({
          where: { tenantId, book: { deletedAt: null } },
        }),
        this.prisma.libraryBook.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT LOWER(BTRIM(author)))::int AS count
        FROM library.library_books
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND deleted_at IS NULL
          AND NULLIF(BTRIM(author), '') IS NOT NULL
      `,
        this.prisma.libraryCategory.count({
          where: { tenantId, active: true },
        }),
        this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT department_id)::int AS count
        FROM (
          SELECT department_id FROM library.library_books
          WHERE tenant_id = CAST(${tenantId} AS uuid)
            AND deleted_at IS NULL AND department_id IS NOT NULL
          UNION
          SELECT department_id FROM library.library_book_departments
          WHERE tenant_id = CAST(${tenantId} AS uuid)
        ) departments
      `,
      ]);
    return {
      copies,
      titles,
      authors: authors[0]?.count ?? 0,
      categories,
      departments: departments[0]?.count ?? 0,
      categoryMeaning: 'Active library categories configured for this college.',
      departmentMeaning: 'Departments that have at least one catalogue title.',
      authorMeaning: 'Distinct primary author names on catalogue titles.',
    };
  }

  async catalogueOptions(tenantId: string) {
    const [categories, departments, subjects, languages, years] =
      await Promise.all([
        this.listCategories(tenantId),
        this.prisma.department.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT BTRIM(subject) AS value
        FROM library.library_books
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND deleted_at IS NULL
          AND NULLIF(BTRIM(subject), '') IS NOT NULL
        ORDER BY value
        LIMIT 300
      `,
        this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT BTRIM(language) AS value
        FROM library.library_books
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND deleted_at IS NULL
          AND NULLIF(BTRIM(language), '') IS NOT NULL
        ORDER BY value
        LIMIT 100
      `,
        this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT BTRIM(publication_year) AS value
        FROM library.library_books
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND deleted_at IS NULL
          AND NULLIF(BTRIM(publication_year), '') IS NOT NULL
        ORDER BY value DESC
        LIMIT 100
      `,
      ]);
    return {
      categories,
      departments,
      subjects: subjects.map((row) => row.value),
      languages: languages.map((row) => row.value),
      years: years.map((row) => row.value),
    };
  }

  async listBooks(tenantId: string, query: BookQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where = this.bookWhere(tenantId, query);
    const sort = query.sort ?? 'accession';
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const orderBy = this.bookOrder(sort, dir);
    const ranked =
      sort === 'department' || sort === 'available'
        ? await this.rankedBookIds(tenantId, query, skip, limit)
        : null;

    const [rows, total, facets] = await Promise.all([
      this.prisma.libraryBook.findMany({
        where: ranked
          ? {
              tenantId,
              id: {
                in: ranked.ids.length
                  ? ranked.ids
                  : ['00000000-0000-0000-0000-000000000000'],
              },
            }
          : where,
        include: {
          category: true,
          copies: {
            select: {
              id: true,
              status: true,
              barcode: true,
              copyNumber: true,
              accessionNumber: true,
              copyType: true,
              issueAllowed: true,
            },
          },
        },
        orderBy: ranked ? undefined : orderBy,
        ...(ranked ? {} : { skip, take: limit }),
      }),
      ranked
        ? Promise.resolve(ranked.total)
        : this.prisma.libraryBook.count({ where }),
      query.facets === 'true'
        ? this.bookFacets(tenantId, query)
        : Promise.resolve(null),
    ]);
    if (ranked) {
      const order = new Map(ranked.ids.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    const departments = await this.departmentNames(
      tenantId,
      rows.map((row) => row.departmentId),
    );
    const items = rows.map((book) => {
      const availableCopies = book.copies.filter(
        (copy) => copy.status === 'AVAILABLE',
      ).length;
      const issuedCopies = book.copies.filter(
        (copy) => copy.status === 'ISSUED',
      ).length;
      return {
        ...book,
        departmentName: departments.get(book.departmentId ?? '') ?? null,
        copyCount: book.copies.length,
        availableCopies,
        issuedCopies,
      };
    });
    return {
      items,
      total,
      page,
      limit,
      from: total ? skip + 1 : 0,
      to: Math.min(skip + items.length, total),
      facets,
    };
  }

  private bookWhere(
    tenantId: string,
    query: BookQueryDto,
  ): Prisma.LibraryBookWhereInput {
    const search = query.search?.trim();
    const availability = query.availability;
    return {
      tenantId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.year ? { publicationYear: query.year } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accessionStatus
        ? { accessionStatus: query.accessionStatus }
        : {}),
      ...(availability === 'AVAILABLE'
        ? { copies: { some: { status: 'AVAILABLE' } } }
        : {}),
      ...(availability === 'ISSUED'
        ? { copies: { some: { status: 'ISSUED' } } }
        : {}),
      ...(availability === 'LOST'
        ? { copies: { some: { status: { in: ['LOST', 'DAMAGED'] } } } }
        : {}),
      ...(availability === 'RESERVED'
        ? { reservations: { some: { status: 'ACTIVE' } } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { additionalAuthors: { contains: search, mode: 'insensitive' } },
              { accessionNo: { contains: search, mode: 'insensitive' } },
              { isbn: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
              { publisher: { contains: search, mode: 'insensitive' } },
              {
                classificationNumber: { contains: search, mode: 'insensitive' },
              },
              {
                copies: {
                  some: {
                    OR: [
                      { barcode: { contains: search, mode: 'insensitive' } },
                      {
                        accessionNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      { callNumber: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private bookOrder(
    sort: NonNullable<BookQueryDto['sort']> | 'accession',
    dir: 'asc' | 'desc',
  ): Prisma.LibraryBookOrderByWithRelationInput {
    if (sort === 'title') return { title: dir };
    if (sort === 'author') return { author: dir };
    if (sort === 'year') return { publicationYear: dir };
    if (sort === 'copies') return { totalCopies: dir };
    return { accessionNo: dir };
  }

  private async bookFacets(tenantId: string, query: BookQueryDto) {
    const base = { ...query, availability: 'ALL' as const, facets: undefined };
    const [all, available, borrowed, reserved] = await Promise.all([
      this.prisma.libraryBook.count({ where: this.bookWhere(tenantId, base) }),
      this.prisma.libraryBook.count({
        where: this.bookWhere(tenantId, { ...base, availability: 'AVAILABLE' }),
      }),
      this.prisma.libraryBook.count({
        where: this.bookWhere(tenantId, { ...base, availability: 'ISSUED' }),
      }),
      this.prisma.libraryBook.count({
        where: this.bookWhere(tenantId, { ...base, availability: 'RESERVED' }),
      }),
    ]);
    return { all, available, borrowed, reserved };
  }

  private async rankedBookIds(
    tenantId: string,
    query: BookQueryDto,
    skip: number,
    limit: number,
  ) {
    const where = this.bookFilterSql(tenantId, query);
    const direction =
      query.sortDir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const order =
      query.sort === 'department'
        ? Prisma.sql`LOWER(COALESCE(d.department_name, '')) ${direction}, b.title ASC`
        : Prisma.sql`available ${direction}, b.title ASC`;
    const [ids, totals] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM library.library_books b
        LEFT JOIN core.departments d ON d.id = b.department_id AND d.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE c.status = 'AVAILABLE')::int AS available
          FROM library.library_book_copies c
          WHERE c.book_id = b.id
        ) copies ON true
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM library.library_books b
        WHERE ${where}
      `,
    ]);
    return { ids: ids.map((row) => row.id), total: totals[0]?.count ?? 0 };
  }

  private bookFilterSql(tenantId: string, query: BookQueryDto) {
    const filters = [
      Prisma.sql`b.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];
    if (query.categoryId)
      filters.push(
        Prisma.sql`b.category_id = CAST(${query.categoryId} AS uuid)`,
      );
    if (query.departmentId)
      filters.push(
        Prisma.sql`b.department_id = CAST(${query.departmentId} AS uuid)`,
      );
    if (query.subject) filters.push(Prisma.sql`b.subject = ${query.subject}`);
    if (query.language)
      filters.push(Prisma.sql`b.language = ${query.language}`);
    if (query.year)
      filters.push(Prisma.sql`b.publication_year = ${query.year}`);
    if (query.status) filters.push(Prisma.sql`b.status = ${query.status}`);
    if (query.accessionStatus)
      filters.push(Prisma.sql`b.accession_status = ${query.accessionStatus}`);
    const search = query.search?.trim();
    if (search) {
      const like = `%${search}%`;
      filters.push(Prisma.sql`(
        b.title ILIKE ${like} OR COALESCE(b.author, '') ILIKE ${like}
        OR COALESCE(b.additional_authors, '') ILIKE ${like}
        OR b.accession_no ILIKE ${like} OR COALESCE(b.isbn, '') ILIKE ${like}
        OR COALESCE(b.subject, '') ILIKE ${like} OR COALESCE(b.publisher, '') ILIKE ${like}
        OR COALESCE(b.classification_number, '') ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM library.library_book_copies c
          WHERE c.book_id = b.id
            AND (c.barcode ILIKE ${like} OR COALESCE(c.accession_number, '') ILIKE ${like} OR COALESCE(c.call_number, '') ILIKE ${like})
        )
      )`);
    }
    if (query.availability === 'AVAILABLE') {
      filters.push(
        Prisma.sql`EXISTS (SELECT 1 FROM library.library_book_copies c WHERE c.book_id = b.id AND c.status = 'AVAILABLE')`,
      );
    }
    if (query.availability === 'ISSUED') {
      filters.push(
        Prisma.sql`EXISTS (SELECT 1 FROM library.library_book_copies c WHERE c.book_id = b.id AND c.status = 'ISSUED')`,
      );
    }
    if (query.availability === 'LOST') {
      filters.push(
        Prisma.sql`EXISTS (SELECT 1 FROM library.library_book_copies c WHERE c.book_id = b.id AND c.status IN ('LOST', 'DAMAGED'))`,
      );
    }
    if (query.availability === 'RESERVED') {
      filters.push(
        Prisma.sql`EXISTS (SELECT 1 FROM library.library_reservations r WHERE r.book_id = b.id AND r.status = 'ACTIVE')`,
      );
    }
    return Prisma.join(filters, ' AND ');
  }

  private async departmentNames(tenantId: string, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.department.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async getBook(tenantId: string, id: string) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { category: true, copies: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async createBook(tenantId: string, dto: CreateBookDto) {
    const copies = dto.totalCopies ?? 1;
    const book = await this.prisma.libraryBook.create({
      data: {
        id: randomUUID(),
        tenantId,
        accessionNo: dto.accessionNo.trim(),
        bookNumber: dto.bookNumber?.trim(),
        isbn: dto.isbn?.trim(),
        title: dto.title.trim(),
        author: dto.author?.trim(),
        publisher: dto.publisher?.trim(),
        edition: dto.edition?.trim(),
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
        price: dto.price,
        shelf: dto.shelf?.trim(),
        rack: dto.rack?.trim(),
        location: dto.location?.trim(),
        totalCopies: copies,
      },
    });

    for (let i = 1; i <= copies; i++) {
      await this.prisma.libraryBookCopy.create({
        data: {
          id: randomUUID(),
          tenantId,
          bookId: book.id,
          copyNumber: i,
          barcode: `${book.accessionNo}-C${i}`,
          status: 'AVAILABLE',
        },
      });
    }

    return this.getBook(tenantId, book.id);
  }

  async updateBook(tenantId: string, id: string, dto: UpdateBookDto) {
    await this.getBook(tenantId, id);
    return this.prisma.libraryBook.update({
      where: { id },
      data: {
        bookNumber: dto.bookNumber?.trim(),
        isbn: dto.isbn?.trim(),
        title: dto.title?.trim(),
        author: dto.author?.trim(),
        publisher: dto.publisher?.trim(),
        edition: dto.edition?.trim(),
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
        price: dto.price,
        shelf: dto.shelf?.trim(),
        rack: dto.rack?.trim(),
        location: dto.location?.trim(),
        status: dto.status,
      },
      include: { category: true, copies: true },
    });
  }

  async addCopy(tenantId: string, dto: CreateBookCopyDto) {
    const book = await this.getBook(tenantId, dto.bookId);
    const existing = await this.prisma.libraryBookCopy.findFirst({
      where: { tenantId, barcode: dto.barcode.trim() },
    });
    if (existing) throw new BadRequestException('Barcode already exists');

    const copyNumber = dto.copyNumber ?? book.copies.length + 1;
    const copy = await this.prisma.libraryBookCopy.create({
      data: {
        id: randomUUID(),
        tenantId,
        bookId: dto.bookId,
        copyNumber,
        barcode: dto.barcode.trim(),
        status: 'AVAILABLE',
      },
    });

    await this.prisma.libraryBook.update({
      where: { id: dto.bookId },
      data: { totalCopies: { increment: 1 } },
    });

    return copy;
  }

  async peekNextAccessionNo(tenantId: string) {
    await this.settings.ensureTenantDefaults(tenantId);
    const s = await this.prisma.librarySettings.findUniqueOrThrow({
      where: { tenantId },
    });
    const year = new Date().getFullYear();
    const padded = String(s.accessionNextSeq).padStart(5, '0');
    return {
      accessionNo: `${s.accessionPrefix}-${year}-${padded}`,
      prefix: s.accessionPrefix,
      nextSeq: s.accessionNextSeq,
    };
  }

  private async reserveAccessionNo(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.librarySettings.findUniqueOrThrow({
        where: { tenantId },
      });
      const seq = s.accessionNextSeq;
      const year = new Date().getFullYear();
      const accessionNo = `${s.accessionPrefix}-${year}-${String(seq).padStart(5, '0')}`;
      await tx.librarySettings.update({
        where: { tenantId },
        data: { accessionNextSeq: seq + 1 },
      });
      return accessionNo;
    });
  }

  async createAccessionEntry(tenantId: string, dto: CreateAccessionBookDto) {
    await this.settings.ensureTenantDefaults(tenantId);
    const title = dto.title.trim();
    const authors = splitAuthors(dto.author);
    if (!title) throw new BadRequestException('Book title is required.');
    if (!authors.primary)
      throw new BadRequestException('At least one author is required.');
    const copies = dto.totalCopies ?? 1;
    if (copies < 1 || copies > 100)
      throw new BadRequestException('Enter between 1 and 100 copies.');
    if (dto.copies && dto.copies.length !== copies) {
      throw new BadRequestException('Send one row for each physical copy.');
    }
    const received = parseIsoDate(dto.dateReceived);
    if (!received)
      throw new BadRequestException('Date received must be a valid date.');
    const departmentIds = [
      ...new Set([dto.departmentId, ...(dto.departmentIds ?? [])]),
    ];
    const departments = await this.prisma.department.findMany({
      where: { tenantId, id: { in: departmentIds }, deletedAt: null },
      select: { id: true },
    });
    if (departments.length !== departmentIds.length) {
      throw new BadRequestException('Choose a department from this college.');
    }
    const category = await this.prisma.libraryCategory.findFirst({
      where: { tenantId, id: dto.categoryId },
      select: { id: true },
    });
    if (!category)
      throw new BadRequestException('Choose a subject or category.');
    const statuses = availabilityToStatuses(dto.availability ?? 'RECEIVED');
    const location = dto.location?.trim() || null;
    const price =
      dto.acquisitionType === 'PURCHASE'
        ? (dto.price ?? null)
        : (dto.price ?? null);

    let bookId: string;
    try {
      bookId = await this.prisma.$transaction(async (tx) => {
        const settings = await tx.librarySettings.update({
          where: { tenantId },
          data: { accessionNextSeq: { increment: copies } },
          select: {
            accessionPrefix: true,
            accessionNextSeq: true,
            circulationPolicy: true,
          },
        });
        const copyIssue = mergeCirculationPolicy(
          settings.circulationPolicy,
        ).copyIssue;
        const start = settings.accessionNextSeq - copies;
        const numbers = accessionSeries(
          settings.accessionPrefix,
          new Date().getFullYear(),
          start,
          copies,
        );
        if (numbers.length !== copies)
          throw new BadRequestException(
            'Accession numbers could not be reserved.',
          );
        const primary = numbers[0];
        const taken = await tx.libraryBook.findFirst({
          where: { tenantId, accessionNo: primary, deletedAt: null },
          select: { id: true },
        });
        if (taken)
          throw new BadRequestException(`Accession ${primary} already exists`);
        const created = await tx.libraryBook.create({
          data: {
            tenantId,
            accessionNo: primary,
            bookNumber: primary,
            isbn: emptyToNull(dto.isbn),
            title,
            author: authors.primary,
            additionalAuthors: emptyToNull(authors.additional),
            publisher: emptyToNull(dto.publisher),
            edition: emptyToNull(dto.edition),
            publicationYear: emptyToNull(dto.publicationYear),
            language: emptyToNull(dto.language),
            subject: emptyToNull(dto.keywords),
            classificationNumber: emptyToNull(dto.classificationNumber),
            subjectClassification: emptyToNull(dto.subjectClassification),
            bookType: dto.bookType.trim(),
            departmentId: dto.departmentId,
            categoryId: dto.categoryId,
            price: price == null ? null : price,
            shelf: location,
            location,
            accessionStatus: statuses.accessionStatus,
            acquisitionType: dto.acquisitionType,
            supplierName: emptyToNull(dto.supplierName),
            invoiceNumber: emptyToNull(dto.invoiceNumber),
            purchaseDate:
              dto.acquisitionType === 'PURCHASE'
                ? parseIsoDate(dto.purchaseDate)
                : null,
            fundingSource: emptyToNull(dto.fundingSource),
            description: emptyToNull(dto.remarks),
            totalCopies: copies,
          },
        });
        for (let index = 0; index < numbers.length; index += 1) {
          const accessionNo = numbers[index];
          const line = dto.copies?.[index];
          const copyType = line?.copyType ?? copyTypeForBookType(dto.bookType);
          const lineStatus = availabilityToStatuses(
            line?.availability ?? dto.availability ?? 'RECEIVED',
          );
          await tx.libraryBookCopy.create({
            data: {
              tenantId,
              bookId: created.id,
              copyNumber: index + 1,
              barcode: accessionNo,
              accessionNumber: accessionNo,
              status: lineStatus.copyStatus,
              copyCondition: line?.condition ?? dto.condition ?? 'NEW',
              copyType,
              issueAllowed: line ? line.issueAllowed : copyIssue[copyType],
              copyRemarks: emptyToNull(line?.remarks),
              acquisitionDate: received,
              acquisitionPrice: price == null ? null : price,
              callNumber: emptyToNull(dto.classificationNumber),
              shelvingLocation: emptyToNull(line?.location) ?? location,
            },
          });
        }
        if (departmentIds.length) {
          await tx.libraryBookDepartment.createMany({
            data: departmentIds.map((departmentId) => ({
              tenantId,
              bookId: created.id,
              departmentId,
            })),
          });
        }
        await tx.libraryAuditLog.create({
          data: {
            tenantId,
            action: 'ACCESSION_ENTRY',
            entityType: 'LibraryBook',
            entityId: created.id,
            metadata: {
              copies,
              acquisitionType: dto.acquisitionType,
              accessionNumbers: numbers,
            },
          },
        });
        return created.id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'An accession number or barcode in this batch is already in use. Refresh and save again.',
        );
      }
      throw error;
    }

    return this.getBook(tenantId, bookId);
  }

  async updateAccessionWorkflow(
    tenantId: string,
    bookId: string,
    dto: UpdateAccessionWorkflowDto,
  ) {
    const book = await this.getBook(tenantId, bookId);
    const nextStatus = dto.accessionStatus ?? book.accessionStatus;

    const updated = await this.prisma.libraryBook.update({
      where: { id: bookId },
      data: {
        accessionStatus: dto.accessionStatus,
        shelf: dto.shelf?.trim(),
        rack: dto.rack?.trim(),
        section: dto.section?.trim(),
        row: dto.row?.trim(),
        location: dto.location?.trim(),
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId,
      },
      include: { category: true, copies: true },
    });

    if (dto.accessionStatus === 'ON_SHELF') {
      await this.prisma.libraryBookCopy.updateMany({
        where: { tenantId, bookId, status: 'PROCESSING' },
        data: { status: 'AVAILABLE' },
      });
    } else if (nextStatus === 'WITHDRAWN') {
      await this.prisma.libraryBookCopy.updateMany({
        where: { tenantId, bookId },
        data: { status: 'WITHDRAWN' },
      });
    }

    return updated;
  }

  async addAccessionCopies(
    tenantId: string,
    bookId: string,
    dto: AddAccessionCopiesDto,
  ) {
    const book = await this.getBook(tenantId, bookId);
    const lines = dto.copies;
    if (!lines.length) {
      throw new BadRequestException('Add at least one physical copy.');
    }
    await this.settings.ensureTenantDefaults(tenantId);
    const received = new Date();
    received.setUTCHours(0, 0, 0, 0);
    try {
      await this.prisma.$transaction(async (tx) => {
        const settings = await tx.librarySettings.update({
          where: { tenantId },
          data: { accessionNextSeq: { increment: lines.length } },
          select: { accessionPrefix: true, accessionNextSeq: true },
        });
        const start = settings.accessionNextSeq - lines.length;
        const numbers = accessionSeries(
          settings.accessionPrefix,
          new Date().getFullYear(),
          start,
          lines.length,
        );
        const last = await tx.libraryBookCopy.aggregate({
          where: { tenantId, bookId },
          _max: { copyNumber: true },
        });
        let copyNumber = (last._max.copyNumber ?? book.copies.length) + 1;
        for (let index = 0; index < numbers.length; index += 1) {
          const line = lines[index];
          const accessionNo = numbers[index];
          const lineStatus = availabilityToStatuses(
            line.availability ?? 'ON_SHELF',
          );
          await tx.libraryBookCopy.create({
            data: {
              tenantId,
              bookId,
              copyNumber,
              barcode: accessionNo,
              accessionNumber: accessionNo,
              status: lineStatus.copyStatus,
              copyCondition: line.condition ?? 'NEW',
              copyType: line.copyType,
              issueAllowed: line.issueAllowed,
              copyRemarks: emptyToNull(line.remarks),
              acquisitionDate: received,
              callNumber: book.classificationNumber,
              shelvingLocation:
                emptyToNull(line.location) ?? book.location ?? book.shelf,
            },
          });
          copyNumber += 1;
        }
        await tx.libraryBook.update({
          where: { id: bookId },
          data: { totalCopies: { increment: lines.length } },
        });
        await tx.libraryAuditLog.create({
          data: {
            tenantId,
            action: 'ADD_COPIES',
            entityType: 'LibraryBook',
            entityId: bookId,
            metadata: { copies: lines.length, accessionNumbers: numbers },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'An accession number or barcode in this batch is already in use. Refresh and save again.',
        );
      }
      throw error;
    }
    return this.getBook(tenantId, bookId);
  }

  async updateCopyCirculation(
    tenantId: string,
    copyId: string,
    dto: UpdateCopyCirculationDto,
  ) {
    const copy = await this.prisma.libraryBookCopy.findFirst({
      where: { id: copyId, tenantId, book: { deletedAt: null } },
    });
    if (!copy) throw new NotFoundException('Book copy not found');
    if (dto.status && dto.status !== copy.status) {
      const active = await this.prisma.libraryLoan.count({
        where: { tenantId, copyId, status: 'ACTIVE', returnedAt: null },
      });
      if (active) {
        throw new BadRequestException(
          'This copy is on loan. Return it before changing its status.',
        );
      }
    }
    return this.prisma.libraryBookCopy.update({
      where: { id: copyId },
      data: {
        copyType: dto.copyType,
        issueAllowed: dto.issueAllowed,
        shelvingLocation:
          dto.location === undefined ? undefined : emptyToNull(dto.location),
        copyCondition: dto.condition,
        status: dto.status,
        copyRemarks:
          dto.remarks === undefined ? undefined : emptyToNull(dto.remarks),
      },
    });
  }

  async findCopyByBarcode(tenantId: string, barcode: string) {
    const code = barcode.trim();
    const include = { book: { include: { category: true } } } as const;
    const copy = await this.prisma.libraryBookCopy.findFirst({
      where: { tenantId, barcode: code },
      include,
    });
    if (copy) return copy;
    const matches = await this.prisma.libraryBookCopy.findMany({
      where: { tenantId, accessionNumber: code },
      include,
      take: 2,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new BadRequestException(
        'This accession number matches more than one physical copy.',
      );
    }
    throw new NotFoundException('Book copy not found');
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
