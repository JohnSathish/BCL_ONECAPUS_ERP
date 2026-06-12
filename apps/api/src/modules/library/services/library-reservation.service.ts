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
      if (!student)
        throw new BadRequestException(
          'Student record required for reservation',
        );
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

    return this.prisma.libraryReservation.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        bookId: dto.bookId,
        studentId,
        status: 'ACTIVE',
      },
      include: { book: true },
    });
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
    return this.prisma.libraryReservation.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { book: true },
      orderBy: { reservedAt: 'asc' },
    });
  }

  async getStudentReservations(tenantId: string, studentId: string) {
    return this.prisma.libraryReservation.findMany({
      where: { tenantId, studentId, status: { in: ['ACTIVE', 'FULFILLED'] } },
      include: { book: true },
      orderBy: { reservedAt: 'desc' },
      take: 50,
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
