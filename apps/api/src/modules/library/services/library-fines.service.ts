import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LibrarySettingsService } from './library-settings.service';
import { LibraryLoanCalendarService } from './library-loan-calendar.service';

export type FineStatus = 'UNPAID' | 'PAID' | 'WAIVED';

@Injectable()
export class LibraryFinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
    private readonly loanCalendar: LibraryLoanCalendarService,
  ) {}

  private fineStatus(fine: {
    paidAt: Date | null;
    waivedAt: Date | null;
  }): FineStatus {
    if (fine.waivedAt) return 'WAIVED';
    if (fine.paidAt) return 'PAID';
    return 'UNPAID';
  }

  async listFines(tenantId: string, status: FineStatus | 'ALL' = 'ALL') {
    const fines = await this.prisma.libraryFine.findMany({
      where: { tenantId },
      include: {
        loan: {
          include: {
            copy: {
              include: { book: { select: { title: true, accessionNo: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return fines
      .map((fine) => ({
        ...fine,
        status: this.fineStatus(fine),
        amount: Number(fine.amount),
      }))
      .filter((fine) => status === 'ALL' || fine.status === status);
  }

  async getUnpaidTotal(tenantId: string, studentId: string) {
    const fines = await this.prisma.libraryFine.findMany({
      where: { tenantId, paidAt: null, waivedAt: null, loan: { studentId } },
      select: { amount: true },
    });
    return fines.reduce((sum, f) => sum + Number(f.amount), 0);
  }

  async getUnpaidTotalForStaff(tenantId: string, staffProfileId: string) {
    const fines = await this.prisma.libraryFine.findMany({
      where: {
        tenantId,
        paidAt: null,
        waivedAt: null,
        loan: { staffProfileId },
      },
      select: { amount: true },
    });
    return fines.reduce((sum, f) => sum + Number(f.amount), 0);
  }

  async payFine(user: JwtUser, fineId: string, notes?: string) {
    const fine = await this.prisma.libraryFine.findFirst({
      where: { tenantId: user.tid, id: fineId },
    });
    if (!fine) throw new NotFoundException('Fine not found');
    if (fine.paidAt || fine.waivedAt) {
      throw new BadRequestException('Fine is already settled');
    }

    return this.prisma.libraryFine.update({
      where: { id: fineId },
      data: {
        paidAt: new Date(),
        paidById: user.sub,
        reason: notes ? `${fine.reason ?? 'Overdue'} — ${notes}` : fine.reason,
      },
      include: {
        loan: { include: { copy: { include: { book: true } } } },
      },
    });
  }

  async waiveFine(user: JwtUser, fineId: string, reason?: string) {
    const fine = await this.prisma.libraryFine.findFirst({
      where: { tenantId: user.tid, id: fineId },
    });
    if (!fine) throw new NotFoundException('Fine not found');
    if (fine.paidAt || fine.waivedAt) {
      throw new BadRequestException('Fine is already settled');
    }

    return this.prisma.libraryFine.update({
      where: { id: fineId },
      data: {
        waivedAt: new Date(),
        waivedById: user.sub,
        waiveReason: reason ?? 'Waived by librarian',
      },
      include: {
        loan: { include: { copy: { include: { book: true } } } },
      },
    });
  }

  async enrichOverdueLoans<
    T extends {
      dueAt: Date;
      fines?: { amount: unknown; paidAt: Date | null; waivedAt: Date | null }[];
    },
  >(tenantId: string, loans: T[]) {
    const settings = await this.settings.getSettings(tenantId);
    const now = new Date();
    const assessed = await this.loanCalendar.assessMany(
      tenantId,
      loans,
      now,
      settings,
    );

    return loans.map((loan, index) => ({
      ...loan,
      projectedFine: assessed[index]?.fine ?? 0,
      daysOverdue: assessed[index]?.overdueDays ?? 0,
    }));
  }

  async accrueDailyRunningFines(tenantId: string) {
    const settings = await this.settings.getSettings(tenantId);
    const now = new Date();
    const overdueLoans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, status: 'ACTIVE', dueAt: { lt: now } },
      include: { fines: true },
    });
    const assessed = await this.loanCalendar.assessMany(
      tenantId,
      overdueLoans,
      now,
      settings,
    );

    let updated = 0;
    for (let index = 0; index < overdueLoans.length; index += 1) {
      const loan = overdueLoans[index];
      const projected = assessed[index]?.fine ?? 0;
      if (projected <= 0) {
        const stale = loan.fines.find((f) => !f.paidAt && !f.waivedAt);
        if (
          stale &&
          (stale.reason === 'Running overdue accrual' ||
            stale.reason === 'Overdue return') &&
          Number(stale.amount) !== 0
        ) {
          await this.prisma.libraryFine.update({
            where: { id: stale.id },
            data: {
              amount: 0,
              waivedAt: now,
              waiveReason:
                'No overdue working days after Sundays and college holidays',
            },
          });
          updated++;
        }
        continue;
      }

      const openFine = loan.fines.find((f) => !f.paidAt && !f.waivedAt);
      if (openFine) {
        if (Number(openFine.amount) !== projected) {
          await this.prisma.libraryFine.update({
            where: { id: openFine.id },
            data: { amount: projected, reason: 'Running overdue accrual' },
          });
          updated++;
        }
      } else {
        await this.prisma.libraryFine.create({
          data: {
            id: randomUUID(),
            tenantId,
            loanId: loan.id,
            amount: projected,
            reason: 'Running overdue accrual',
          },
        });
        updated++;
      }
    }

    return { checked: overdueLoans.length, updated };
  }
}
