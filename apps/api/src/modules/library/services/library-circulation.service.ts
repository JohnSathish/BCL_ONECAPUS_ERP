import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import type { IssueBookDto, ReturnBookDto } from '../dto/library.dto';
import { mergeCirculationPolicy } from '../domain/library-policy.types';
import { calculateOverdueFine } from '../utils/library-fine.util';
import { computeReadingScore } from '../domain/library-reading-score';
import { LibraryCatalogueService } from './library-catalogue.service';
import { LibraryFinesService } from './library-fines.service';
import {
  LibraryMemberLookupService,
  type LibraryMemberProfile,
} from './library-member-lookup.service';
import { LibraryNotificationsService } from './library-notifications.service';
import { LibraryPolicyService } from './library-policy.service';
import { LibraryQrService } from './library-qr.service';
import { LibraryReservationService } from './library-reservation.service';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryCirculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly catalogue: LibraryCatalogueService,
    private readonly settings: LibrarySettingsService,
    private readonly policy: LibraryPolicyService,
    private readonly reservations: LibraryReservationService,
    private readonly notifications: LibraryNotificationsService,
    private readonly fines: LibraryFinesService,
    private readonly qr: LibraryQrService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private resolveCopyBarcode(raw: string) {
    const { code } = this.qr.resolveScanCode(raw);
    return code;
  }

  private async logActivity(
    tenantId: string,
    actorId: string | undefined,
    action: 'ISSUE' | 'RETURN' | 'RENEW',
    payload: {
      memberName: string;
      bookTitle: string;
      programme?: string | null;
    },
  ) {
    await this.prisma.libraryAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        actorId: actorId ?? null,
        action,
        entityType: 'LOAN',
        metadata: payload,
      },
    });
    this.realtime.broadcastToTenant(tenantId, 'library:circulation:activity', {
      action,
      memberName: payload.memberName,
      bookTitle: payload.bookTitle,
      programme: payload.programme ?? null,
      at: new Date().toISOString(),
    });
  }

  async memberSummary(tenantId: string, scanCode: string) {
    const profile = await this.lookup.lookup(tenantId, scanCode);
    const policies = await this.policy.getPolicies(tenantId);
    const maxBooks = this.policy.resolveMaxBooks(
      policies.circulation,
      profile.memberType,
    );
    const activeLoans = await this.policy.countActiveLoans(tenantId, profile);
    const unpaid = profile.studentId
      ? await this.fines.getUnpaidTotal(tenantId, profile.studentId)
      : profile.staffProfileId
        ? await this.fines.getUnpaidTotalForStaff(
            tenantId,
            profile.staffProfileId,
          )
        : 0;

    const lastVisit = await this.prisma.libraryVisit.findFirst({
      where: {
        tenantId,
        ...(profile.studentId ? { studentId: profile.studentId } : {}),
        ...(profile.staffProfileId
          ? { staffProfileId: profile.staffProfileId }
          : {}),
      },
      orderBy: { entryAt: 'desc' },
      select: { entryAt: true },
    });

    const visitCount = await this.prisma.libraryVisit.count({
      where: {
        tenantId,
        ...(profile.studentId ? { studentId: profile.studentId } : {}),
        ...(profile.staffProfileId
          ? { staffProfileId: profile.staffProfileId }
          : {}),
      },
    });

    const loans = await this.listMemberActiveLoans(tenantId, profile);

    const readingScore = computeReadingScore({
      visitCount,
      totalLoans:
        activeLoans +
        (await this.prisma.libraryLoan.count({
          where: {
            tenantId,
            ...(profile.studentId ? { studentId: profile.studentId } : {}),
            ...(profile.staffProfileId
              ? { staffProfileId: profile.staffProfileId }
              : {}),
            status: 'RETURNED',
          },
        })),
      onTimeReturns: 0,
      activeMember: profile.active,
    }).overall;

    return {
      profile,
      activeLoans: loans,
      borrowedCount: activeLoans,
      maxBooks,
      outstandingFine: unpaid,
      lastVisitAt: lastVisit?.entryAt ?? null,
      visitCount,
      readingScore,
      membershipStatus: profile.active ? 'ACTIVE' : profile.status,
    };
  }

  async bookPreview(tenantId: string, barcodeRaw: string) {
    const barcode = this.resolveCopyBarcode(barcodeRaw);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    const available = await this.prisma.libraryBookCopy.count({
      where: { tenantId, bookId: copy.bookId, status: 'AVAILABLE' },
    });
    const policies = await this.policy.getPolicies(tenantId);
    const loanDays = this.policy.resolveLoanDays(
      policies.circulation,
      'STUDENT',
      copy.book.category?.code,
    );

    return {
      copy: {
        id: copy.id,
        barcode: copy.barcode,
        status: copy.status,
        copyNumber: copy.copyNumber,
      },
      book: {
        id: copy.book.id,
        title: copy.book.title,
        author: copy.book.author,
        publisher: copy.book.publisher,
        edition: copy.book.edition,
        accessionNo: copy.book.accessionNo,
        category: copy.book.category?.name ?? null,
        location: this.policy.formatBookLocation(copy.book),
        section: copy.book.section,
        rack: copy.book.rack,
        shelf: copy.book.shelf,
      },
      availableCopies: available,
      totalCopies: copy.book.totalCopies,
      suggestedLoanDays: loanDays,
    };
  }

  async issuePreview(
    tenantId: string,
    memberScan: string,
    copyBarcode: string,
  ) {
    const profile = await this.lookup.lookup(tenantId, memberScan);
    const barcode = this.resolveCopyBarcode(copyBarcode);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    await this.policy.validateIssue(
      tenantId,
      profile,
      copy.book.category?.code,
    );
    const policies = await this.policy.getPolicies(tenantId);
    const loanDays = this.policy.resolveLoanDays(
      policies.circulation,
      profile.memberType,
      copy.book.category?.code,
    );
    const dueAt = this.policy.computeDueDate(loanDays);
    const settings = await this.settings.getSettings(tenantId);
    return {
      dueAt,
      loanDays,
      finePerDay: Number(settings.finePerDay),
      graceDays: settings.graceDays,
      bookTitle: copy.book.title,
    };
  }

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

    const barcode = this.resolveCopyBarcode(dto.copyBarcode);
    const copy = await this.catalogue.findCopyByBarcode(user.tid, barcode);

    if (copy.status !== 'AVAILABLE') {
      throw new BadRequestException(`Copy is ${copy.status}`);
    }

    await this.policy.validateIssue(
      user.tid,
      profile,
      copy.book.category?.code,
    );

    const policies = await this.policy.getPolicies(user.tid);
    const loanDays = this.policy.resolveLoanDays(
      policies.circulation,
      profile.memberType,
      copy.book.category?.code,
    );
    const dueAt = this.policy.computeDueDate(loanDays);

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

    await this.logActivity(user.tid, user.sub, 'ISSUE', {
      memberName: profile.fullName,
      bookTitle: copy.book.title,
      programme: profile.programme,
    });

    return { loan, member: profile };
  }

  async returnBook(user: JwtUser, dto: ReturnBookDto) {
    const barcode = this.resolveCopyBarcode(dto.copyBarcode);
    const copy = await this.catalogue.findCopyByBarcode(user.tid, barcode);

    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId: user.tid, copyId: copy.id, status: 'ACTIVE' },
      include: { copy: { include: { book: true } }, fines: true },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(user.tid);
    const returnedAt = new Date();
    const fineAmount = calculateOverdueFine(loan.dueAt, returnedAt, settings);
    const overdueDays = Math.max(
      0,
      Math.ceil((returnedAt.getTime() - loan.dueAt.getTime()) / 86_400_000) -
        settings.graceDays,
    );

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

      return { loan: updatedLoan, fine, overdueDays };
    });

    await this.logActivity(user.tid, user.sub, 'RETURN', {
      memberName: 'Member',
      bookTitle: copy.book.title,
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
    const barcode = this.resolveCopyBarcode(copyBarcode);
    const copy = await this.catalogue.findCopyByBarcode(user.tid, barcode);

    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId: user.tid, copyId: copy.id, status: 'ACTIVE' },
      include: { copy: { include: { book: true } } },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(user.tid);
    const policies = mergeCirculationPolicy(settings.circulationPolicy);
    const maxRenewals = this.policy.resolveMaxRenewals(
      policies,
      loan.memberType,
      settings.maxRenewals,
    );

    if (loan.renewalCount >= maxRenewals) {
      throw new BadRequestException(
        `Maximum renewals (${maxRenewals}) reached`,
      );
    }

    const now = new Date();

    if (calculateOverdueFine(loan.dueAt, now, settings) > 0) {
      throw new BadRequestException(
        'Overdue books cannot be renewed — return or pay fines first',
      );
    }

    const loanDays = this.policy.resolveLoanDays(
      policies,
      loan.memberType,
      copy.book.category?.code,
    );
    const base = loan.dueAt > now ? loan.dueAt : now;
    const newDue = this.policy.computeDueDate(loanDays, base);

    const updated = await this.prisma.libraryLoan.update({
      where: { id: loan.id },
      data: {
        dueAt: newDue,
        renewalCount: { increment: 1 },
      },
      include: { copy: { include: { book: true } } },
    });

    await this.logActivity(user.tid, user.sub, 'RENEW', {
      memberName: 'Member',
      bookTitle: copy.book.title,
    });

    return updated;
  }

  private async listMemberActiveLoans(
    tenantId: string,
    profile: Awaited<ReturnType<LibraryMemberLookupService['lookup']>>,
  ) {
    return this.prisma.libraryLoan.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(profile.studentId ? { studentId: profile.studentId } : {}),
        ...(profile.staffProfileId
          ? { staffProfileId: profile.staffProfileId }
          : {}),
      },
      include: { copy: { include: { book: true } } },
      orderBy: { issuedAt: 'desc' },
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

  async deskContext(tenantId: string) {
    const settings = await this.settings.getSettings(tenantId);
    const policies = await this.policy.getPolicies(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [
      issuedToday,
      returnedToday,
      renewalsToday,
      overdueLoans,
      fineCollectedToday,
      pendingAgg,
      paidAgg,
      waivedAgg,
    ] = await Promise.all([
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, returnedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryAuditLog.count({
        where: {
          tenantId,
          action: 'RENEW',
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE', dueAt: { lt: new Date() } },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, paidAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, paidAt: null, waivedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, paidAt: { not: null } },
        _sum: { amount: true },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, waivedAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const circ = policies.circulation;
    return {
      stats: {
        issuedToday,
        returnedToday,
        renewalsToday,
        overdueLoans,
        fineCollectedToday: Number(fineCollectedToday._sum.amount ?? 0),
      },
      rules: {
        studentMaxBooks: circ.student.maxBooks,
        facultyMaxBooks: circ.faculty.maxBooks,
        staffMaxBooks: circ.staff.maxBooks,
        studentLoanDays: circ.student.loanDays,
        facultyLoanDays: circ.faculty.loanDays,
        studentMaxRenewals: circ.student.maxRenewals,
        facultyMaxRenewals: circ.faculty.maxRenewals,
        finePerDay: Number(settings.finePerDay),
        graceDays: settings.graceDays,
        maxFine: Number(settings.maxFine),
        blockIssueOnUnpaidFines: settings.blockIssueOnUnpaidFines,
      },
      fineSummary: {
        pending: Number(pendingAgg._sum.amount ?? 0),
        paidTotal: Number(paidAgg._sum.amount ?? 0),
        waivedTotal: Number(waivedAgg._sum.amount ?? 0),
        collectedToday: Number(fineCollectedToday._sum.amount ?? 0),
      },
    };
  }

  async returnPreview(tenantId: string, barcodeRaw: string) {
    const barcode = this.resolveCopyBarcode(barcodeRaw);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId, copyId: copy.id, status: 'ACTIVE' },
      include: {
        copy: { include: { book: true } },
        fines: true,
      },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(tenantId);
    const now = new Date();
    const projectedFine = calculateOverdueFine(loan.dueAt, now, settings);
    const overdueDays = Math.max(
      0,
      Math.ceil((now.getTime() - loan.dueAt.getTime()) / 86_400_000) -
        settings.graceDays,
    );
    const openFine = loan.fines.find((f) => !f.paidAt && !f.waivedAt);

    let member: LibraryMemberProfile | null = null;
    if (loan.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId, id: loan.studentId, deletedAt: null },
        include: {
          masterProfile: true,
          department: { select: { name: true } },
        },
      });
      if (student) {
        member = {
          memberType: 'STUDENT',
          memberId: student.id,
          studentId: student.id,
          fullName: student.masterProfile?.fullName ?? student.enrollmentNumber,
          photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
          registrationNumber: student.enrollmentNumber,
          department: student.department?.name ?? null,
          status: 'ACTIVE',
          active: true,
        };
      }
    } else if (loan.staffProfileId) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { tenantId, id: loan.staffProfileId, deletedAt: null },
        include: { department: { select: { name: true } } },
      });
      if (staff) {
        const isFaculty = staff.staffType === 'TEACHING';
        member = {
          memberType: isFaculty ? 'FACULTY' : 'STAFF',
          memberId: staff.id,
          staffProfileId: staff.id,
          fullName: staff.fullName,
          photoUrl: staff.photoUrl,
          registrationNumber: staff.employeeCode,
          department: staff.department?.name ?? null,
          status: staff.status,
          active: staff.status === 'ACTIVE',
        };
      }
    }

    return {
      loan: {
        id: loan.id,
        issuedAt: loan.issuedAt,
        dueAt: loan.dueAt,
        renewalCount: loan.renewalCount,
      },
      book: {
        title: copy.book.title,
        author: copy.book.author,
        accessionNo: copy.book.accessionNo,
        barcode: copy.barcode,
        location: this.policy.formatBookLocation(copy.book),
      },
      member,
      returnedAt: now,
      overdueDays,
      projectedFine,
      existingFineId: openFine?.id ?? null,
      existingFineAmount: openFine ? Number(openFine.amount) : 0,
      finePerDay: Number(settings.finePerDay),
      graceDays: settings.graceDays,
    };
  }

  async renewPreview(tenantId: string, barcodeRaw: string) {
    const barcode = this.resolveCopyBarcode(barcodeRaw);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId, copyId: copy.id, status: 'ACTIVE' },
      include: { copy: { include: { book: true } } },
    });

    if (!loan) throw new NotFoundException('No active loan for this copy');

    const settings = await this.settings.getSettings(tenantId);
    const policies = mergeCirculationPolicy(settings.circulationPolicy);
    const maxRenewals = this.policy.resolveMaxRenewals(
      policies,
      loan.memberType,
      settings.maxRenewals,
    );
    const now = new Date();
    const overdueFine = calculateOverdueFine(loan.dueAt, now, settings);
    const loanDays = this.policy.resolveLoanDays(
      policies,
      loan.memberType,
      copy.book.category?.code,
    );
    const base = loan.dueAt > now ? loan.dueAt : now;
    const newDueAt = this.policy.computeDueDate(loanDays, base);

    let blockReason: string | null = null;
    if (loan.renewalCount >= maxRenewals) {
      blockReason = `Maximum renewals (${maxRenewals}) reached`;
    } else if (overdueFine > 0) {
      blockReason = 'Overdue books cannot be renewed';
    }

    return {
      bookTitle: copy.book.title,
      barcode: copy.barcode,
      currentDueAt: loan.dueAt,
      renewalCount: loan.renewalCount,
      maxRenewals,
      newDueAt,
      loanDays,
      canRenew: !blockReason,
      blockReason,
    };
  }
}
