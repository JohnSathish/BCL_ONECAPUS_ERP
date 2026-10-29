import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  BookQueryDto,
  CreateAccessionBookDto,
  CreateBookCopyDto,
  CreateBookDto,
  CreateCategoryDto,
  UpdateAccessionWorkflowDto,
  UpdateBookDto,
} from '../dto/library.dto';
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

  async listBooks(tenantId: string, query: BookQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accessionStatus
        ? { accessionStatus: query.accessionStatus }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { author: { contains: search, mode: 'insensitive' as const } },
              {
                accessionNo: { contains: search, mode: 'insensitive' as const },
              },
              { isbn: { contains: search, mode: 'insensitive' as const } },
              {
                copies: {
                  some: {
                    OR: [
                      {
                        barcode: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        accessionNumber: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.libraryBook.findMany({
        where,
        include: {
          category: true,
          copies: {
            select: {
              id: true,
              status: true,
              barcode: true,
              copyNumber: true,
              accessionNumber: true,
            },
          },
        },
        orderBy: { accessionNo: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.libraryBook.count({ where }),
    ]);

    return { items, total, page, limit };
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
          select: { accessionPrefix: true, accessionNextSeq: true },
        });
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
          await tx.libraryBookCopy.create({
            data: {
              tenantId,
              bookId: created.id,
              copyNumber: index + 1,
              barcode: accessionNo,
              accessionNumber: accessionNo,
              status: statuses.copyStatus,
              copyCondition: dto.condition ?? 'NEW',
              acquisitionDate: received,
              acquisitionPrice: price == null ? null : price,
              callNumber: emptyToNull(dto.classificationNumber),
              shelvingLocation: location,
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
