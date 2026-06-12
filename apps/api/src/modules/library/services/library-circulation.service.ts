import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import type { JwtUser } from '../../../common/decorators/current-user.decorator';

import { PrismaService } from '../../../database/prisma.service';

import type { IssueBookDto, ReturnBookDto } from '../dto/library.dto';

import { calculateOverdueFine } from '../utils/library-fine.util';

import { LibraryCatalogueService } from './library-catalogue.service';

import { LibraryFinesService } from './library-fines.service';

import { LibraryMemberLookupService } from './library-member-lookup.service';

import { LibraryNotificationsService } from './library-notifications.service';

import { LibraryReservationService } from './library-reservation.service';

import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryCirculationService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly lookup: LibraryMemberLookupService,

    private readonly catalogue: LibraryCatalogueService,

    private readonly settings: LibrarySettingsService,

    private readonly reservations: LibraryReservationService,

    private readonly notifications: LibraryNotificationsService,

    private readonly fines: LibraryFinesService,
  ) {}

  async issue(user: JwtUser, dto: IssueBookDto) {
    const profile = await this.lookup.lookup(user.tid, dto.memberScan);

    if (profile.memberType === 'VISITOR') {
      throw new BadRequestException('Visitors cannot borrow books');
    }

    if (!profile.active) {
      throw new BadRequestException('Member is not active');
    }

    const libSettings = await this.settings.getSettings(user.tid);

    if (libSettings.blockIssueOnUnpaidFines && profile.studentId) {
      const unpaid = await this.fines.getUnpaidTotal(
        user.tid,
        profile.studentId,
      );

      if (unpaid > 0) {
        throw new BadRequestException(
          `Issue blocked — unpaid library fine of ₹${unpaid.toFixed(2)}. Please settle at the circulation desk.`,
        );
      }
    }

    const copy = await this.catalogue.findCopyByBarcode(
      user.tid,
      dto.copyBarcode,
    );

    if (copy.status !== 'AVAILABLE') {
      throw new BadRequestException(`Copy is ${copy.status}`);
    }

    const dueAt = new Date();

    dueAt.setDate(dueAt.getDate() + libSettings.defaultLoanDays);

    const loan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.libraryLoan.create({
        data: {
          id: randomUUID(),

          tenantId: user.tid,

          copyId: copy.id,

          memberType: profile.memberType,

          studentId: profile.studentId,

          staffProfileId: profile.staffProfileId,

          dueAt,

          issuedById: user.sub,

          status: 'ACTIVE',
        },

        include: { copy: { include: { book: true } } },
      });

      await tx.libraryBookCopy.update({
        where: { id: copy.id },

        data: { status: 'ISSUED' },
      });

      return created;
    });

    return { loan, member: profile };
  }

  async returnBook(user: JwtUser, dto: ReturnBookDto) {
    const copy = await this.catalogue.findCopyByBarcode(
      user.tid,
      dto.copyBarcode,
    );

    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId: user.tid, copyId: copy.id, status: 'ACTIVE' },

      include: { copy: { include: { book: true } }, fines: true },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(user.tid);

    const returnedAt = new Date();

    const fineAmount = calculateOverdueFine(loan.dueAt, returnedAt, settings);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.libraryLoan.update({
        where: { id: loan.id },

        data: {
          returnedAt,

          returnedById: user.sub,

          status: 'RETURNED',
        },

        include: { copy: { include: { book: true } } },
      });

      await tx.libraryBookCopy.update({
        where: { id: copy.id },

        data: { status: 'AVAILABLE' },
      });

      const openFine = loan.fines.find((f) => !f.paidAt && !f.waivedAt);

      let fine = openFine ?? null;

      if (fineAmount > 0) {
        if (openFine) {
          fine = await tx.libraryFine.update({
            where: { id: openFine.id },

            data: { amount: fineAmount, reason: 'Overdue return' },
          });
        } else {
          fine = await tx.libraryFine.create({
            data: {
              id: randomUUID(),

              tenantId: user.tid,

              loanId: loan.id,

              amount: fineAmount,

              reason: 'Overdue return',
            },
          });
        }
      }

      return { loan: updatedLoan, fine };
    });

    await this.reservations
      .fulfillNext(user.tid, copy.bookId)
      .then(async (fulfilled) => {
        if (fulfilled?.id) {
          await this.notifications.notifyReservationReady(
            user.tid,
            fulfilled.id,
          );
        }
      });

    return result;
  }

  async renewLoan(user: JwtUser, copyBarcode: string) {
    const copy = await this.catalogue.findCopyByBarcode(user.tid, copyBarcode);

    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId: user.tid, copyId: copy.id, status: 'ACTIVE' },

      include: { copy: { include: { book: true } } },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(user.tid);

    if (loan.renewalCount >= settings.maxRenewals) {
      throw new BadRequestException(
        `Maximum renewals (${settings.maxRenewals}) reached`,
      );
    }

    const now = new Date();

    if (calculateOverdueFine(loan.dueAt, now, settings) > 0) {
      throw new BadRequestException(
        'Overdue books cannot be renewed — return or pay fines first',
      );
    }

    const base = loan.dueAt > now ? loan.dueAt : now;

    const newDue = new Date(base);

    newDue.setDate(newDue.getDate() + settings.defaultLoanDays);

    return this.prisma.libraryLoan.update({
      where: { id: loan.id },

      data: {
        dueAt: newDue,

        renewalCount: { increment: 1 },
      },

      include: { copy: { include: { book: true } } },
    });
  }

  async listOverdue(tenantId: string) {
    const loans = await this.prisma.libraryLoan.findMany({
      where: {
        tenantId,

        status: 'ACTIVE',

        dueAt: { lt: new Date() },
      },

      include: {
        copy: { include: { book: true } },

        fines: true,
      },

      orderBy: { dueAt: 'asc' },
    });

    return this.fines.enrichOverdueLoans(tenantId, loans);
  }

  async listActiveLoans(tenantId: string, limit = 100) {
    return this.prisma.libraryLoan.findMany({
      where: { tenantId, status: 'ACTIVE' },

      include: { copy: { include: { book: true } }, fines: true },

      orderBy: { issuedAt: 'desc' },

      take: limit,
    });
  }

  async getMemberLoans(tenantId: string, studentId: string) {
    return this.prisma.libraryLoan.findMany({
      where: { tenantId, studentId, status: { in: ['ACTIVE', 'RETURNED'] } },

      include: { copy: { include: { book: true } }, fines: true },

      orderBy: { issuedAt: 'desc' },

      take: 50,
    });
  }
}
