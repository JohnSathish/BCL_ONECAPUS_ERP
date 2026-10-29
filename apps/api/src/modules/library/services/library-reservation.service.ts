import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  ReservationListQueryDto,
  ReserveBookDto,
} from '../dto/library.dto';

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

  async summary(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [counts, departments] = await Promise.all([
      this.prisma.$queryRaw<
        {
          active: number;
          fulfilled: number;
          cancelled: number;
          fulfilled_today: number;
          titles: number;
          oldest: Date | null;
        }[]
      >`
        SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
          COUNT(*) FILTER (WHERE status = 'FULFILLED')::int AS fulfilled,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
          COUNT(*) FILTER (
            WHERE status = 'FULFILLED'
              AND fulfilled_at >= ${start}
              AND fulfilled_at < ${end}
          )::int AS fulfilled_today,
          COUNT(DISTINCT book_id) FILTER (WHERE status = 'ACTIVE')::int AS titles,
          MIN(reserved_at) FILTER (WHERE status = 'ACTIVE') AS oldest
        FROM library.library_reservations
        WHERE tenant_id = CAST(${tenantId} AS uuid)
      `,
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const row = counts[0];
    const oldest = row?.oldest ? new Date(row.oldest) : null;
    return {
      active: Number(row?.active ?? 0),
      titles: Number(row?.titles ?? 0),
      longestDays: oldest ? waitingDays(oldest) : 0,
      fulfilledToday: Number(row?.fulfilled_today ?? 0),
      fulfilled: Number(row?.fulfilled ?? 0),
      cancelled: Number(row?.cancelled ?? 0),
      expired: 0,
      expiryTracked: false,
      departments,
    };
  }

  async list(tenantId: string, query: ReservationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = await this.listWhere(tenantId, query);
    if (!where) {
      return { items: [], total: 0, page, limit, from: 0, to: 0 };
    }
    const orderBy =
      query.sort === 'oldest'
        ? { reservedAt: 'asc' as const }
        : query.sort === 'title'
          ? { book: { title: 'asc' as const } }
          : { reservedAt: 'desc' as const };
    const [rows, total] = await Promise.all([
      this.prisma.libraryReservation.findMany({
        where,
        include: { book: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.libraryReservation.count({ where }),
    ]);
    const items = await this.enrichReservations(tenantId, rows);
    return {
      items,
      total,
      page,
      limit,
      from: total ? skip + 1 : 0,
      to: Math.min(skip + items.length, total),
    };
  }

  async searchStudents(tenantId: string, search: string) {
    const q = search.trim();
    if (q.length < 2) return [];
    const rows = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { enrollmentNumber: { contains: q, mode: 'insensitive' } },
          { rollNumber: { contains: q, mode: 'insensitive' } },
          { masterProfile: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: {
        masterProfile: { select: { fullName: true } },
        department: { select: { name: true } },
      },
      orderBy: { enrollmentNumber: 'asc' },
      take: 8,
    });
    return rows.map((student) => ({
      id: student.id,
      fullName: student.masterProfile?.fullName ?? 'Student',
      enrollmentNumber: student.enrollmentNumber,
      department: student.department?.name ?? null,
    }));
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
      book?: {
        title: string;
        author: string | null;
        accessionNo: string;
      } | null;
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

    const bookIds = [...new Set(rows.map((row) => row.bookId))];
    const active = await this.prisma.libraryReservation.findMany({
      where: { tenantId, bookId: { in: bookIds }, status: 'ACTIVE' },
      orderBy: [{ bookId: 'asc' }, { reservedAt: 'asc' }],
      select: { id: true, bookId: true },
    });
    const positionMap = new Map<string, number>();
    let currentBook = '';
    let position = 0;
    for (const row of active) {
      if (row.bookId !== currentBook) {
        currentBook = row.bookId;
        position = 0;
      }
      position += 1;
      positionMap.set(row.id, position);
    }

    return rows.map((row) => {
      const student = students.find((s) => s.id === row.studentId);
      return {
        ...row,
        studentName: student?.masterProfile?.fullName ?? 'Student',
        enrollmentNumber: student?.enrollmentNumber ?? null,
        department: student?.department?.name ?? null,
        memberType: 'STUDENT' as const,
        author: row.book?.author ?? null,
        accessionNo: row.book?.accessionNo ?? null,
        expiresOn: null,
        queuePosition:
          row.status === 'ACTIVE' ? (positionMap.get(row.id) ?? null) : null,
      };
    });
  }

  private async listWhere(
    tenantId: string,
    query: ReservationListQueryDto,
  ): Promise<Prisma.LibraryReservationWhereInput | null> {
    if (query.status === 'EXPIRED') return null;
    if (
      query.memberType &&
      query.memberType !== 'ALL' &&
      query.memberType !== 'STUDENT'
    ) {
      return null;
    }

    const where: Prisma.LibraryReservationWhereInput = { tenantId };
    if (query.status && query.status !== 'ALL') where.status = query.status;

    if (query.departmentId) {
      const students = await this.prisma.student.findMany({
        where: { tenantId, departmentId: query.departmentId, deletedAt: null },
        select: { id: true },
      });
      if (!students.length) return null;
      where.studentId = { in: students.map((student) => student.id) };
    }

    const from = query.from ? startOfDay(query.from) : null;
    const to = query.to ? startOfDay(query.to) : null;
    if (from || to) {
      const reservedAt: Prisma.DateTimeFilter = {};
      if (from && to && from > to) {
        const next = new Date(from);
        next.setDate(next.getDate() + 1);
        reservedAt.gte = to;
        reservedAt.lt = next;
      } else {
        if (from) reservedAt.gte = from;
        if (to) {
          const next = new Date(to);
          next.setDate(next.getDate() + 1);
          reservedAt.lt = next;
        }
      }
      where.reservedAt = reservedAt;
    }

    const search = query.search?.trim();
    if (search) {
      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { enrollmentNumber: { contains: search, mode: 'insensitive' } },
            { rollNumber: { contains: search, mode: 'insensitive' } },
            {
              masterProfile: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        },
        select: { id: true },
        take: 300,
      });
      const studentFilter = where.studentId;
      const allowed =
        studentFilter &&
        typeof studentFilter === 'object' &&
        'in' in studentFilter &&
        Array.isArray(studentFilter.in)
          ? new Set(studentFilter.in)
          : null;
      const matched = students
        .map((student) => student.id)
        .filter((id) => (allowed ? allowed.has(id) : true));
      where.AND = [
        {
          OR: [
            { book: { title: { contains: search, mode: 'insensitive' } } },
            { book: { author: { contains: search, mode: 'insensitive' } } },
            {
              book: { accessionNo: { contains: search, mode: 'insensitive' } },
            },
            ...(matched.length ? [{ studentId: { in: matched } }] : []),
          ],
        },
      ];
    }

    return where;
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

function startOfDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function waitingDays(reservedAt: Date, now = new Date()) {
  const start = new Date(reservedAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.round((today.getTime() - start.getTime()) / 86_400_000),
  );
}
