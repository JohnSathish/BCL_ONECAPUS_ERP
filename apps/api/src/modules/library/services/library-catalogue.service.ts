import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
            select: { id: true, status: true, barcode: true, copyNumber: true },
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
    const accessionNo = dto.accessionNo?.trim()
      ? dto.accessionNo.trim()
      : await this.reserveAccessionNo(tenantId);

    const existing = await this.prisma.libraryBook.findFirst({
      where: { tenantId, accessionNo, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(`Accession ${accessionNo} already exists`);
    }

    const copies = dto.totalCopies ?? 1;
    const accessionStatus = dto.accessionStatus ?? 'PENDING';
    const book = await this.prisma.libraryBook.create({
      data: {
        id: randomUUID(),
        tenantId,
        accessionNo,
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
        section: dto.section?.trim(),
        row: dto.row?.trim(),
        location: dto.location?.trim(),
        accessionStatus,
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
          status: accessionStatus === 'ON_SHELF' ? 'AVAILABLE' : 'PROCESSING',
        },
      });
    }

    return this.getBook(tenantId, book.id);
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
    const copy = await this.prisma.libraryBookCopy.findFirst({
      where: { tenantId, barcode: barcode.trim() },
      include: { book: { include: { category: true } } },
    });
    if (!copy) throw new NotFoundException('Book copy not found');
    return copy;
  }
}
