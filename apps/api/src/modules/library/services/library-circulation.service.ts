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
import { resolveCopyIssue } from '../domain/library-copy-issue.logic';
import {
  collegeDateIso,
  renewalPeriodDays,
} from '../domain/library-loan-calendar.logic';
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
import { LibraryLoanCalendarService } from './library-loan-calendar.service';

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
    private readonly loanCalendar: LibraryLoanCalendarService,
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
      accessionNumber?: string | null;
      dueAt?: string;
      previousDueAt?: string;
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
    const rules = await this.policy.loadBorrowRules(tenantId, profile);
    const maxBooks = this.policy.resolveMaxBooks(
      policies.circulation,
      profile.memberType,
      rules.loanLimit,
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

    const loans = await this.attachIssuerNames(
      tenantId,
      await this.listMemberActiveLoans(tenantId, profile),
    );

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

    const returnedLoans = await this.attachIssuerNames(
      tenantId,
      await this.prisma.libraryLoan.findMany({
        where: {
          tenantId,
          status: 'RETURNED',
          ...(profile.studentId ? { studentId: profile.studentId } : {}),
          ...(profile.staffProfileId
            ? { staffProfileId: profile.staffProfileId }
            : {}),
        },
        include: { copy: { include: { book: true } }, fines: true },
        orderBy: { returnedAt: 'desc' },
        take: 40,
      }),
    );

    return {
      profile,
      activeLoans: loans,
      returnedLoans,
      borrowedCount: activeLoans,
      maxBooks,
      outstandingFine: unpaid,
      lastVisitAt: lastVisit?.entryAt ?? null,
      visitCount,
      readingScore,
      membershipStatus: rules.blocked
        ? 'BLOCKED'
        : rules.expired
          ? 'EXPIRED'
          : profile.active
            ? 'ACTIVE'
            : profile.status,
      blockReason: rules.blocked
        ? rules.blockReason
        : rules.expired
          ? 'Membership expired'
          : null,
      fineExempt: rules.fineExempt,
    };
  }

  async bookPreview(tenantId: string, barcodeRaw: string) {
    const barcode = this.resolveCopyBarcode(barcodeRaw);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    const available = await this.prisma.libraryBookCopy.count({
      where: { tenantId, bookId: copy.bookId, status: 'AVAILABLE' },
    });
    const { decision, policy } = await this.copyDecision(tenantId, copy);
    let loanDays = this.policy.resolveLoanDays(
      policy,
      'STUDENT',
      loanCategory(copy, decision.copyType),
    );
    if (decision.allowed && loanDays < 1) {
      loanDays = this.policy.resolveLoanDays(policy, 'STUDENT', null);
    }

    return {
      issueAllowed: decision.allowed,
      issueMessage: decision.message,
      copy: {
        id: copy.id,
        barcode: copy.barcode,
        accessionNumber: copy.accessionNumber,
        status: copy.status,
        copyNumber: copy.copyNumber,
        copyType: decision.copyType ?? copy.copyType ?? null,
        issueAllowed: copy.issueAllowed,
      },
      book: {
        id: copy.book.id,
        title: copy.book.title,
        author: copy.book.author,
        publisher: copy.book.publisher,
        edition: copy.book.edition,
        isbn: copy.book.isbn,
        publicationYear: copy.book.publicationYear,
        coverImageUrl: copy.book.coverImageUrl,
        accessionNo: copy.accessionNumber || copy.book.accessionNo,
        callNumber: copy.callNumber || copy.book.classificationNumber,
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
    const rules = await this.policy.loadBorrowRules(tenantId, profile);
    const { decision, policy } = await this.copyDecision(tenantId, copy);
    if (!decision.allowed) {
      throw new BadRequestException(
        decision.message ?? 'Issue is not permitted for this copy.',
      );
    }
    await this.policy.validateIssue(tenantId, profile, null);
    let loanDays = this.policy.resolveLoanDays(
      policy,
      profile.memberType,
      loanCategory(copy, decision.copyType),
      rules.loanDays,
    );
    if (loanDays < 1) {
      loanDays = this.policy.resolveLoanDays(
        policy,
        profile.memberType,
        null,
        rules.loanDays,
      );
    }
    const dueAt = await this.loanCalendar.dueAt(tenantId, new Date(), loanDays);
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

    const issueRules = await this.policy.loadBorrowRules(user.tid, profile);
    if (
      libSettings.blockIssueOnUnpaidFines &&
      profile.studentId &&
      !issueRules.fineExempt
    ) {
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

    const { decision, policy } = await this.copyDecision(user.tid, copy);
    if (!decision.allowed) {
      throw new BadRequestException(
        decision.message ?? 'Issue is not permitted for this copy.',
      );
    }
    await this.policy.validateIssue(user.tid, profile, null);

    let loanDays = this.policy.resolveLoanDays(
      policy,
      profile.memberType,
      loanCategory(copy, decision.copyType),
      issueRules.loanDays,
    );
    if (loanDays < 1) {
      loanDays = this.policy.resolveLoanDays(
        policy,
        profile.memberType,
        null,
        issueRules.loanDays,
      );
    }
    const dueAt = await this.loanCalendar.dueAt(user.tid, new Date(), loanDays);

    const loan = await this.prisma.$transaction(async (tx) => {
      const reserved = await tx.libraryBookCopy.updateMany({
        where: { id: copy.id, status: 'AVAILABLE' },
        data: { status: 'ISSUED' },
      });
      if (reserved.count !== 1) {
        throw new BadRequestException(
          'This copy was just issued to someone else.',
        );
      }
      const loanId = randomUUID();
      return tx.libraryLoan.create({
        data: {
          id: loanId,
          tenantId: user.tid,
          copyId: copy.id,
          memberType: profile.memberType,
          studentId: profile.studentId,
          staffProfileId: profile.staffProfileId,
          dueAt,
          issuedById: user.sub,
          status: 'ACTIVE',
          receiptNo: this.receiptNumber(dto.receiptNo, loanId),
        },
        include: { copy: { include: { book: true } } },
      });
    });

    await this.logActivity(user.tid, user.sub, 'ISSUE', {
      memberName: profile.fullName,
      bookTitle: copy.book.title,
      programme: profile.programme,
      accessionNumber: copy.accessionNumber || copy.barcode,
      dueAt: dueAt.toISOString(),
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
    const assessment = await this.loanCalendar.assess(
      user.tid,
      loan.dueAt,
      returnedAt,
      settings,
    );
    const fineAmount = assessment.fine;
    const overdueDays = assessment.overdueDays;

    const result = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.libraryLoan.updateMany({
        where: { id: loan.id, status: 'ACTIVE' },
        data: {
          returnedAt,
          returnedById: user.sub,
          status: 'RETURNED',
        },
      });
      if (closed.count !== 1) {
        throw new BadRequestException('This loan has already been returned.');
      }
      const updatedLoan = await tx.libraryLoan.findFirstOrThrow({
        where: { id: loan.id },
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
      } else if (openFine && isRunningOverdueFine(openFine.reason)) {
        fine = await tx.libraryFine.update({
          where: { id: openFine.id },
          data: {
            amount: 0,
            waivedAt: returnedAt,
            waivedById: user.sub,
            waiveReason:
              'No overdue working days after Sundays and college holidays',
          },
        });
      }

      return { loan: updatedLoan, fine, overdueDays };
    });

    await this.logActivity(user.tid, user.sub, 'RETURN', {
      memberName: 'Member',
      bookTitle: copy.book.title,
      accessionNumber: copy.accessionNumber || copy.barcode,
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
    const renewRules = await this.policy.loadBorrowRules(user.tid, {
      studentId: loan.studentId,
      staffProfileId: loan.staffProfileId,
    });
    this.policy.assertCanBorrow(renewRules);
    const maxRenewals = this.policy.resolveMaxRenewals(
      policies,
      loan.memberType,
      settings.maxRenewals,
      renewRules.maxRenewals,
    );

    if (loan.renewalCount >= maxRenewals) {
      throw new BadRequestException(
        `Maximum renewals (${maxRenewals}) reached`,
      );
    }

    const now = new Date();
    const assessment = await this.loanCalendar.assess(
      user.tid,
      loan.dueAt,
      now,
      settings,
    );

    if (assessment.fine > 0 && !policies.loanCalendar.allowRenewalWhenOverdue) {
      throw new BadRequestException(
        'Overdue books cannot be renewed — return or pay fines first',
      );
    }

    let loanDays = this.policy.resolveLoanDays(
      policies,
      loan.memberType,
      loanCategory(copy, copy.copyType),
      renewRules.loanDays,
    );
    if (copy.issueAllowed === true && loanDays < 1) {
      loanDays = this.policy.resolveLoanDays(
        policies,
        loan.memberType,
        null,
        renewRules.loanDays,
      );
    }
    const period = renewalPeriodDays(
      loanDays,
      policies.loanCalendar.renewalWorkingDays,
    );
    const dueIso = collegeDateIso(loan.dueAt);
    const nowIso = collegeDateIso(now);
    const newDue = await this.loanCalendar.dueAt(
      user.tid,
      dueIso >= nowIso ? loan.dueAt : now,
      period,
    );

    const renewed = await this.prisma.libraryLoan.updateMany({
      where: { id: loan.id, status: 'ACTIVE', renewalCount: loan.renewalCount },
      data: {
        dueAt: newDue,
        renewalCount: { increment: 1 },
      },
    });
    if (renewed.count !== 1) {
      throw new BadRequestException('This loan was just renewed or returned.');
    }
    const updated = await this.prisma.libraryLoan.findFirstOrThrow({
      where: { id: loan.id },
      include: { copy: { include: { book: true } } },
    });

    await this.logActivity(user.tid, user.sub, 'RENEW', {
      memberName: 'Member',
      bookTitle: copy.book.title,
      accessionNumber: copy.accessionNumber || copy.barcode,
      previousDueAt: loan.dueAt.toISOString(),
      dueAt: newDue.toISOString(),
    });

    return updated;
  }

  private receiptNumber(supplied: string | undefined, loanId: string) {
    const cleaned = supplied
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20);
    if (cleaned && cleaned.length >= 8) return cleaned;
    const stamp = new Date();
    const year = String(stamp.getFullYear()).slice(2);
    const month = String(stamp.getMonth() + 1).padStart(2, '0');
    const day = String(stamp.getDate()).padStart(2, '0');
    return `IR${year}${month}${day}${loanId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }

  private async attachIssuerNames<T extends { issuedById: string | null }>(
    tenantId: string,
    loans: T[],
  ) {
    const ids = [
      ...new Set(
        loans
          .map((loan) => loan.issuedById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!ids.length)
      return loans.map((loan) => ({
        ...loan,
        issuedByName: null as string | null,
      }));
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, displayName: true, email: true },
    });
    const names = new Map(
      users.map((user) => [user.id, user.displayName?.trim() || user.email]),
    );
    return loans.map((loan) => ({
      ...loan,
      issuedByName: loan.issuedById
        ? (names.get(loan.issuedById) ?? null)
        : null,
    }));
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

    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    const yesterdayStart = new Date(startOfDay);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const [
      issuedToday,
      returnedToday,
      issuedYesterday,
      returnedYesterday,
      renewalsToday,
      overdueLoans,
      issuedNow,
      dueThisWeek,
      totalCopies,
      students,
      staff,
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
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: yesterdayStart, lt: startOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          returnedAt: { gte: yesterdayStart, lt: startOfDay },
        },
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
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          dueAt: { gte: new Date(), lte: weekAhead },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, book: { deletedAt: null } },
      }),
      this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.staffProfile.count({ where: { tenantId, deletedAt: null } }),
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
        issuedYesterday,
        returnedYesterday,
        renewalsToday,
        overdueLoans,
        issuedNow,
        dueThisWeek,
        totalCopies,
        totalMembers: students + staff,
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
    const assessment = await this.loanCalendar.assess(
      tenantId,
      loan.dueAt,
      now,
      settings,
    );
    const projectedFine = assessment.fine;
    const overdueDays = assessment.overdueDays;
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
    const renewRules = await this.policy.loadBorrowRules(tenantId, {
      studentId: loan.studentId,
      staffProfileId: loan.staffProfileId,
    });
    const maxRenewals = this.policy.resolveMaxRenewals(
      policies,
      loan.memberType,
      settings.maxRenewals,
      renewRules.maxRenewals,
    );
    const now = new Date();
    const assessment = await this.loanCalendar.assess(
      tenantId,
      loan.dueAt,
      now,
      settings,
    );
    const overdueFine = assessment.fine;
    let loanDays = this.policy.resolveLoanDays(
      policies,
      loan.memberType,
      loanCategory(copy, copy.copyType),
      renewRules.loanDays,
    );
    if (copy.issueAllowed === true && loanDays < 1) {
      loanDays = this.policy.resolveLoanDays(
        policies,
        loan.memberType,
        null,
        renewRules.loanDays,
      );
    }
    const period = renewalPeriodDays(
      loanDays,
      policies.loanCalendar.renewalWorkingDays,
    );
    const dueIso = collegeDateIso(loan.dueAt);
    const nowIso = collegeDateIso(now);
    const newDueAt = await this.loanCalendar.dueAt(
      tenantId,
      dueIso >= nowIso ? loan.dueAt : now,
      period,
    );

    let blockReason: string | null = null;
    if (renewRules.blocked) {
      blockReason = renewRules.blockReason
        ? `Borrowing is blocked: ${renewRules.blockReason.replaceAll('_', ' ').toLowerCase()}.`
        : 'Borrowing is blocked for this member.';
    } else if (renewRules.expired) {
      blockReason = 'This library membership has expired.';
    } else if (loan.renewalCount >= maxRenewals) {
      blockReason = `Maximum renewals (${maxRenewals}) reached`;
    } else if (
      overdueFine > 0 &&
      !policies.loanCalendar.allowRenewalWhenOverdue
    ) {
      blockReason = 'Overdue books cannot be renewed';
    }

    return {
      bookTitle: copy.book.title,
      barcode: copy.barcode,
      currentDueAt: loan.dueAt,
      renewalCount: loan.renewalCount,
      maxRenewals,
      newDueAt,
      loanDays: period,
      canRenew: !blockReason,
      blockReason,
    };
  }

  private async copyDecision(
    tenantId: string,
    copy: {
      copyType: string | null;
      issueAllowed: boolean | null;
      book: { category: { code: string } | null };
    },
  ) {
    const settings = await this.settings.getSettings(tenantId);
    const policy = mergeCirculationPolicy(settings.circulationPolicy);
    const decision = resolveCopyIssue({
      copyType: copy.copyType,
      issueAllowed: copy.issueAllowed,
      categoryCode: copy.book.category?.code,
      copyIssue: policy.copyIssue,
      referenceAllow: policy.reference.allowIssue,
      rareAllow: policy.rare.allowIssue,
    });
    return { decision, policy };
  }
}

function isRunningOverdueFine(reason: string | null): boolean {
  return reason === 'Running overdue accrual' || reason === 'Overdue return';
}

function loanCategory(
  copy: {
    issueAllowed: boolean | null;
    copyType: string | null;
    book: { category: { code: string } | null };
  },
  decisionType: string | null,
) {
  const type = decisionType ?? copy.copyType;
  if (copy.issueAllowed != null || type) {
    if (type === 'REFERENCE') return 'REFERENCE';
    if (type === 'RARE') return 'RARE';
    return null;
  }
  return copy.book.category?.code ?? null;
}
