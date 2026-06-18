import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { ReserveBookDto } from '../dto/library.dto';

@Injectable()
export class LibraryReservationService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(user: JwtUser, dto: ReserveBookDto) {
    let studentId = dto.studentId;
    if (!studentId) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      });
      if (!student) {
        throw new BadRequestException(
          'Student record required for reservation',
        );
      }
      studentId = student.id;
    }

    const book = await this.prisma.libraryBook.findFirst({
      where: { tenantId: user.tid, id: dto.bookId, deletedAt: null },
      include: { copies: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const available = book.copies.some((c) => c.status === 'AVAILABLE');
    if (available) {
      throw new BadRequestException(
        'Book has available copies — issue directly instead',
      );
    }

    const existing = await this.prisma.libraryReservation.findFirst({
      where: {
        tenantId: user.tid,
        bookId: dto.bookId,
        studentId,
        status: 'ACTIVE',
      },
    });
    if (existing) throw new BadRequestException('Already reserved');

    const created = await this.prisma.libraryReservation.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        bookId: dto.bookId,
        studentId,
        status: 'ACTIVE',
      },
      include: { book: true },
    });

    const position = await this.queuePosition(user.tid, dto.bookId, created.id);
    return { ...created, queuePosition: position };
  }

  async cancel(user: JwtUser, reservationId: string) {
    const row = await this.prisma.libraryReservation.findFirst({
      where: { tenantId: user.tid, id: reservationId, status: 'ACTIVE' },
    });
    if (!row) throw new NotFoundException('Reservation not found');
    return this.prisma.libraryReservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async listActive(tenantId: string) {
    const rows = await this.prisma.libraryReservation.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { book: true },
      orderBy: { reservedAt: 'asc' },
    });
    return this.enrichReservations(tenantId, rows);
  }

  async listQueue(tenantId: string) {
    const reservations = await this.listActive(tenantId);
    const byBook = new Map<
      string,
      {
        bookId: string;
        bookTitle: string;
        accessionNo: string;
        queue: typeof reservations;
      }
    >();

    for (const row of reservations) {
      const entry = byBook.get(row.bookId) ?? {
        bookId: row.bookId,
        bookTitle: row.book?.title ?? 'Book',
        accessionNo: row.book?.accessionNo ?? '—',
        queue: [],
      };
      entry.queue.push(row);
      byBook.set(row.bookId, entry);
    }

    return [...byBook.values()].sort((a, b) => b.queue.length - a.queue.length);
  }

  async getStudentReservations(tenantId: string, studentId: string) {
    const rows = await this.prisma.libraryReservation.findMany({
      where: { tenantId, studentId, status: { in: ['ACTIVE', 'FULFILLED'] } },
      include: { book: true },
      orderBy: { reservedAt: 'desc' },
      take: 50,
    });
    return this.enrichReservations(tenantId, rows);
  }

  private async queuePosition(
    tenantId: string,
    bookId: string,
    reservationId: string,
  ) {
    const active = await this.prisma.libraryReservation.findMany({
      where: { tenantId, bookId, status: 'ACTIVE' },
      orderBy: { reservedAt: 'asc' },
      select: { id: true },
    });
    const idx = active.findIndex((r) => r.id === reservationId);
    return idx >= 0 ? idx + 1 : active.length + 1;
  }

  private async enrichReservations<
    T extends {
      id: string;
      bookId: string;
      studentId: string;
      status: string;
      reservedAt: Date;
      book?: { title: string; accessionNo: string } | null;
    },
  >(tenantId: string, rows: T[]) {
    if (!rows.length) return [];

    const studentIds = [...new Set(rows.map((r) => r.studentId))];
    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: studentIds } },
      include: {
        masterProfile: { select: { fullName: true } },
        department: { select: { name: true } },
      },
    });

    const byBook = new Map<string, T[]>();
    for (const row of rows) {
      const list = byBook.get(row.bookId) ?? [];
      list.push(row);
      byBook.set(row.bookId, list);
    }

    const positionMap = new Map<string, number>();
    for (const [, list] of byBook) {
      const sorted = [...list].sort(
        (a, b) => a.reservedAt.getTime() - b.reservedAt.getTime(),
      );
      sorted.forEach((r, i) => {
        if (r.status === 'ACTIVE') positionMap.set(r.id, i + 1);
      });
    }

    return rows.map((row) => {
      const student = students.find((s) => s.id === row.studentId);
      return {
        ...row,
        studentName: student?.masterProfile?.fullName ?? 'Student',
        enrollmentNumber: student?.enrollmentNumber ?? null,
        department: student?.department?.name ?? null,
        queuePosition:
          row.status === 'ACTIVE' ? (positionMap.get(row.id) ?? null) : null,
      };
    });
  }

  async fulfillNext(tenantId: string, bookId: string) {
    const next = await this.prisma.libraryReservation.findFirst({
      where: { tenantId, bookId, status: 'ACTIVE' },
      orderBy: { reservedAt: 'asc' },
    });
    if (!next) return null;
    return this.prisma.libraryReservation.update({
      where: { id: next.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });
  }
}
