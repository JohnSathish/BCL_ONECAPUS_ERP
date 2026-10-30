import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { libraryHealth } from '../library-health.logic';
import { fillUsageDays, usageRange } from '../library-usage-days';
import { LibrarySettingsService } from './library-settings.service';

export type LibraryDashboardPeriod = 'today' | 'week' | 'month';
export type OccupancySnapshot = {
  studentsInside: number;
  maleStudents: number;
  femaleStudents: number;
  facultyInside: number;
  staffInside: number;
  visitorsInside: number;
  totalInside: number;
  availableSeats: number;
  totalSeats: number;
  occupancyPercent: number;
  hourlyFootfall: { hour: number; count: number }[];
  hourlyExits: { hour: number; count: number }[];
};

@Injectable()
export class LibraryAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
  ) {}

  /** Close visits that have stayed open for more than one hour. */
  async closeStaleOpenVisits(tenantId: string) {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    return this.prisma.$executeRaw`
      UPDATE library.library_visits
      SET exit_at = entry_at + interval '1 hour',
          duration_minutes = 60,
          exit_method = 'AUTO',
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = CAST(${tenantId} AS uuid)
        AND exit_at IS NULL
        AND entry_at < ${cutoff}
    `;
  }

  async getOccupancy(tenantId: string): Promise<OccupancySnapshot> {
    await this.closeStaleOpenVisits(tenantId);
    const settings = await this.settings.getSettings(tenantId);
    const openVisits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, exitAt: null },
    });

    const studentIds = openVisits
      .filter((v) => v.memberType === 'STUDENT')
      .map((v) => v.studentId!);
    const staffIds = openVisits
      .filter((v) => v.memberType === 'STAFF' || v.memberType === 'FACULTY')
      .map((v) => v.staffProfileId!);

    const [students, staff] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            include: { masterProfile: { select: { gender: true } } },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            select: { id: true, staffType: true, gender: true },
          })
        : [],
    ]);

    const maleStudents = students.filter((s) =>
      s.masterProfile?.gender?.toUpperCase().startsWith('M'),
    ).length;
    const femaleStudents = students.filter((s) =>
      s.masterProfile?.gender?.toUpperCase().startsWith('F'),
    ).length;
    const facultyInside = staff.filter(
      (s) => s.staffType === 'TEACHING',
    ).length;
    const staffInside = staff.filter((s) => s.staffType !== 'TEACHING').length;
    const visitorsInside = openVisits.filter(
      (v) => v.memberType === 'VISITOR',
    ).length;
    const studentsInside = studentIds.length;
    const totalInside = openVisits.length;
    const totalSeats = settings.totalSeats;
    const availableSeats = Math.max(0, totalSeats - totalInside);
    const occupancyPercent =
      totalSeats > 0 ? Math.round((totalInside / totalSeats) * 100) : 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const [todayVisits, todayExits] = await Promise.all([
      this.prisma.libraryVisit.findMany({
        where: { tenantId, entryAt: { gte: startOfDay, lt: endOfDay } },
        select: { entryAt: true },
      }),
      this.prisma.libraryVisit.findMany({
        where: { tenantId, exitAt: { gte: startOfDay, lt: endOfDay } },
        select: { exitAt: true },
      }),
    ]);
    const hourlyFootfall = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: todayVisits.filter((v) => v.entryAt.getHours() === hour).length,
    }));
    const hourlyExits = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: todayExits.filter((v) => v.exitAt && v.exitAt.getHours() === hour)
        .length,
    }));

    return {
      studentsInside,
      maleStudents,
      femaleStudents,
      facultyInside,
      staffInside,
      visitorsInside,
      totalInside,
      availableSeats,
      totalSeats,
      occupancyPercent,
      hourlyFootfall,
      hourlyExits,
    };
  }

  async dashboard(tenantId: string, period: LibraryDashboardPeriod = 'today') {
    const occupancy = await this.getOccupancy(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const yesterdayStart = new Date(startOfDay);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const stockCutoff = new Date(startOfDay);
    stockCutoff.setDate(stockCutoff.getDate() - 30);
    const periodStart =
      period === 'month'
        ? new Date(startOfDay.getTime() - 29 * 86_400_000)
        : period === 'week'
          ? startOfWeek
          : startOfDay;
    const periodLabel =
      period === 'month'
        ? 'in the last 30 days'
        : period === 'week'
          ? 'in the last 7 days'
          : 'today';

    const [
      todayVisitors,
      weekVisitors,
      activeLoans,
      overdueLoans,
      totalTitles,
      totalCopies,
      availableCopies,
      issuedToday,
      returnedToday,
      digitalViewsToday,
      digitalDownloadsToday,
      fineCollectedToday,
      digitalAssets,
      researchItems,
      unpaidFines,
      camsFootfall,
      coverage,
      attention,
      departments,
      periodIssues,
      periodReturns,
      periodRenewals,
      periodDigitalViews,
      issuedYesterday,
      returnedYesterday,
      titlesThen,
      copiesThen,
      titlesAdded,
      copiesAdded,
      renewedToday,
      reservedToday,
      members,
    ] = await Promise.all([
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: startOfDay } },
      }),
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: startOfWeek } },
      }),
      this.prisma.libraryLoan.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE', dueAt: { lt: new Date() } },
      }),
      this.prisma.libraryBook.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, book: { deletedAt: null } },
      }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, status: 'AVAILABLE', book: { deletedAt: null } },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          returnedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryDigitalAccessLog.count({
        where: {
          tenantId,
          action: 'VIEW',
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryDigitalAccessLog.count({
        where: {
          tenantId,
          action: 'DOWNLOAD',
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryFine.aggregate({
        where: {
          tenantId,
          paidAt: { gte: startOfDay, lt: endOfDay },
          waivedAt: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.libraryDigitalAsset.count({
        where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.researchRepositoryItem.count({
        where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.libraryFine.findMany({
        where: { tenantId, paidAt: null, waivedAt: null },
        select: { amount: true },
      }),
      this.libraryCamsFootfall(tenantId, startOfDay, endOfDay),
      this.collectionCoverage(tenantId),
      this.attentionCounts(tenantId),
      this.departmentCollection(tenantId),
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: periodStart, lt: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, returnedAt: { gte: periodStart, lt: endOfDay } },
      }),
      this.prisma.libraryAuditLog.count({
        where: {
          tenantId,
          action: 'RENEW',
          createdAt: { gte: periodStart, lt: endOfDay },
        },
      }),
      this.prisma.libraryDigitalAccessLog.count({
        where: { tenantId, createdAt: { gte: periodStart, lt: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          issuedAt: { gte: yesterdayStart, lt: startOfDay },
        },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          returnedAt: { gte: yesterdayStart, lt: startOfDay },
        },
      }),
      this.prisma.libraryBook.count({
        where: {
          tenantId,
          deletedAt: null,
          copies: { some: { acquisitionDate: { lt: stockCutoff } } },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          acquisitionDate: { lt: stockCutoff },
          book: { deletedAt: null },
        },
      }),
      this.prisma.libraryBook.count({
        where: {
          tenantId,
          deletedAt: null,
          copies: {
            some: { acquisitionDate: { gte: stockCutoff } },
            none: { acquisitionDate: { lt: stockCutoff } },
          },
        },
      }),
      this.prisma.libraryBookCopy.count({
        where: {
          tenantId,
          acquisitionDate: { gte: stockCutoff },
          book: { deletedAt: null },
        },
      }),
      this.prisma.libraryAuditLog.count({
        where: {
          tenantId,
          action: 'RENEW',
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryReservation.count({
        where: { tenantId, reservedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.memberEngagement(tenantId, periodStart, endOfDay),
    ]);

    const footfallTrends = await this.footfallTrends(tenantId);
    const departmentHeatmap = await this.departmentHeatmap(tenantId);
    const genderTrends = await this.genderTrends(tenantId);
    const healthScore = libraryHealth({
      eligibleCopies: coverage.eligible,
      completeCopies: coverage.complete,
      periodEvents: periodIssues + periodReturns + periodRenewals,
      periodLabel,
      publishedDigitalAssets: digitalAssets,
      digitalViews: periodDigitalViews,
      activeLoans,
      overdueLoans,
      activeMembers: members.active,
      knownMembers: members.known,
    });
    const activity = await this.recentActivity(tenantId, 20, 'today');
    const recentActivity = await this.recentActivity(tenantId, 20, 'recent');

    return {
      occupancy,
      todayVisitors,
      weekVisitors,
      activeLoans,
      overdueLoans,
      totalBooks: totalCopies,
      totalTitles,
      availableCopies,
      issuedToday,
      returnedToday,
      issuedChange: percentChange(issuedToday, issuedYesterday),
      returnedChange: percentChange(returnedToday, returnedYesterday),
      titlesGrowth: percentChange(titlesThen + titlesAdded, titlesThen),
      copiesGrowth: percentChange(copiesThen + copiesAdded, copiesThen),
      digitalViewsToday,
      digitalDownloadsToday,
      fineCollectedToday: Number(fineCollectedToday._sum.amount ?? 0),
      digitalAssets,
      researchItems,
      unpaidFinesCount: unpaidFines.length,
      unpaidFinesTotal: unpaidFines.reduce(
        (sum, f) => sum + Number(f.amount),
        0,
      ),
      footfallTrends,
      departmentHeatmap,
      genderTrends,
      healthScore,
      activity,
      recentActivity,
      activityCounts: {
        issued: issuedToday,
        returned: returnedToday,
        renewed: renewedToday,
        reserved: reservedToday,
      },
      attention,
      departments,
      period,
      entryAnalytics: camsFootfall,
    };
  }

  async recentActivity(
    tenantId: string,
    limit = 20,
    scope: 'today' | 'recent' = 'recent',
    action?: 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE',
  ) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const since = scope === 'today' ? start : undefined;
    const want = (kind: 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE') =>
      !action || action === kind;
    const [issued, returned, renewals, reserved] = await Promise.all([
      want('ISSUE')
        ? this.prisma.libraryLoan.findMany({
            where: {
              tenantId,
              ...(since ? { issuedAt: { gte: since } } : {}),
            },
            orderBy: { issuedAt: 'desc' },
            take: limit,
            select: {
              status: true,
              issuedAt: true,
              issuedById: true,
              studentId: true,
              staffProfileId: true,
              copy: {
                select: {
                  accessionNumber: true,
                  barcode: true,
                  book: { select: { title: true } },
                },
              },
            },
          })
        : [],
      want('RETURN')
        ? this.prisma.libraryLoan.findMany({
            where: {
              tenantId,
              returnedAt: since ? { gte: since } : { not: null },
            },
            orderBy: { returnedAt: 'desc' },
            take: limit,
            select: {
              status: true,
              returnedAt: true,
              returnedById: true,
              studentId: true,
              staffProfileId: true,
              copy: {
                select: {
                  accessionNumber: true,
                  barcode: true,
                  book: { select: { title: true } },
                },
              },
            },
          })
        : [],
      want('RENEW')
        ? this.prisma.libraryAuditLog.findMany({
            where: {
              tenantId,
              action: 'RENEW',
              ...(since ? { createdAt: { gte: since } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],
      want('RESERVE')
        ? this.prisma.libraryReservation.findMany({
            where: {
              tenantId,
              ...(since ? { reservedAt: { gte: since } } : {}),
            },
            orderBy: { reservedAt: 'desc' },
            take: limit,
            select: {
              reservedAt: true,
              studentId: true,
              book: { select: { title: true } },
            },
          })
        : [],
    ]);

    const rows = [
      ...issued.map((loan) => ({
        at: loan.issuedAt,
        action: 'ISSUE',
        bookTitle: loan.copy.book.title,
        accessionNumber: loan.copy.accessionNumber || loan.copy.barcode,
        status: 'Issued',
        studentId: loan.studentId,
        staffProfileId: loan.staffProfileId,
        actorId: loan.issuedById,
        memberName: '',
      })),
      ...returned.flatMap((loan) =>
        loan.returnedAt
          ? [
              {
                at: loan.returnedAt,
                action: 'RETURN',
                bookTitle: loan.copy.book.title,
                accessionNumber: loan.copy.accessionNumber || loan.copy.barcode,
                status: 'Returned',
                studentId: loan.studentId,
                staffProfileId: loan.staffProfileId,
                actorId: loan.returnedById,
                memberName: '',
              },
            ]
          : [],
      ),
      ...renewals.map((log) => {
        const meta = (log.metadata ?? {}) as Record<string, string>;
        return {
          at: log.createdAt,
          action: 'RENEW',
          bookTitle: meta.bookTitle || '—',
          accessionNumber: meta.accessionNumber || null,
          status: 'Renewed',
          studentId: null as string | null,
          staffProfileId: null as string | null,
          actorId: log.actorId,
          memberName: meta.memberName || 'Member',
        };
      }),
      ...reserved.map((row) => ({
        at: row.reservedAt,
        action: 'RESERVE',
        bookTitle: row.book.title,
        accessionNumber: null as string | null,
        status: 'Reserved',
        studentId: row.studentId,
        staffProfileId: null as string | null,
        actorId: null as string | null,
        memberName: '',
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);

    const studentIds = [
      ...new Set(rows.map((row) => row.studentId).filter(Boolean)),
    ] as string[];
    const staffIds = [
      ...new Set(rows.map((row) => row.staffProfileId).filter(Boolean)),
    ] as string[];
    const actorIds = [
      ...new Set(rows.map((row) => row.actorId).filter(Boolean)),
    ] as string[];
    const [students, staff, actors] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: {
              id: true,
              enrollmentNumber: true,
              masterProfile: { select: { fullName: true } },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            select: { id: true, fullName: true, employeeCode: true },
          })
        : [],
      actorIds.length
        ? this.prisma.user.findMany({
            where: { tenantId, id: { in: actorIds } },
            select: { id: true, displayName: true, email: true },
          })
        : [],
    ]);
    const studentNames = new Map(
      students.map((row) => [row.id, row.masterProfile?.fullName || 'Student']),
    );
    const studentCodes = new Map(
      students.map((row) => [row.id, row.enrollmentNumber]),
    );
    const staffNames = new Map(staff.map((row) => [row.id, row.fullName]));
    const staffCodes = new Map(staff.map((row) => [row.id, row.employeeCode]));
    const actorNames = new Map(
      actors.map((row) => [row.id, row.displayName || row.email]),
    );

    return rows.map((row) => ({
      at: row.at.toISOString(),
      action: row.action,
      memberName:
        (row.studentId ? studentNames.get(row.studentId) : undefined) ||
        (row.staffProfileId ? staffNames.get(row.staffProfileId) : undefined) ||
        row.memberName ||
        'Member',
      memberCode:
        (row.studentId ? studentCodes.get(row.studentId) : undefined) ||
        (row.staffProfileId ? staffCodes.get(row.staffProfileId) : undefined) ||
        null,
      bookTitle: row.bookTitle,
      accessionNumber: row.accessionNumber,
      staffName: row.actorId ? (actorNames.get(row.actorId) ?? null) : null,
      status: row.status,
      programme: null,
    }));
  }

  async dashboardUsage(
    tenantId: string,
    query: { days?: number; from?: string; to?: string },
  ) {
    let range: ReturnType<typeof usageRange>;
    try {
      range = usageRange(query);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid reporting period',
      );
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
    const [issuedRows, returnedRows, books] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(issued_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND issued_at >= ${range.from}
          AND issued_at < ${range.to}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(returned_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND returned_at >= ${range.from}
          AND returned_at < ${range.to}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<
        { bookId: string; title: string; issues: number }[]
      >`
        SELECT b.id AS "bookId", b.title, COUNT(*)::int AS issues
        FROM library.library_loans l
        JOIN library.library_book_copies c ON c.id = l.copy_id
        JOIN library.library_books b ON b.id = c.book_id
        WHERE l.tenant_id = ${tenant}
          AND l.issued_at >= ${range.from}
          AND l.issued_at < ${range.to}
          AND b.deleted_at IS NULL
        GROUP BY b.id, b.title
        ORDER BY issues DESC, b.title
        LIMIT 5
      `,
    ]);
    const issued = new Map(
      issuedRows.map((row) => [row.day, Number(row.count)]),
    );
    const returned = new Map(
      returnedRows.map((row) => [row.day, Number(row.count)]),
    );
    const topIssues = Math.max(1, ...books.map((book) => Number(book.issues)));
    return {
      from: fillUsageDays(range.from, 1, issued, returned)[0]?.date,
      days: range.days,
      newMembers: null,
      series: fillUsageDays(range.from, range.days, issued, returned),
      topBooks: books.map((book) => ({
        bookId: book.bookId,
        title: book.title,
        issues: Number(book.issues),
        share: Math.round((Number(book.issues) / topIssues) * 100),
      })),
    };
  }

  private async memberEngagement(tenantId: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      { active: number; known: number }[]
    >`
      WITH known AS (
        SELECT 's:' || student_id::text AS id
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND student_id IS NOT NULL
        UNION
        SELECT 'f:' || staff_profile_id::text
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND staff_profile_id IS NOT NULL
        UNION
        SELECT 's:' || student_id::text
        FROM library.library_visits
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND student_id IS NOT NULL
        UNION
        SELECT 'f:' || staff_profile_id::text
        FROM library.library_visits
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND staff_profile_id IS NOT NULL
      ),
      active AS (
        SELECT 's:' || student_id::text AS id
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND student_id IS NOT NULL
          AND issued_at >= ${from} AND issued_at < ${to}
        UNION
        SELECT 'f:' || staff_profile_id::text
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND staff_profile_id IS NOT NULL
          AND issued_at >= ${from} AND issued_at < ${to}
        UNION
        SELECT 's:' || student_id::text
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND student_id IS NOT NULL
          AND returned_at >= ${from} AND returned_at < ${to}
        UNION
        SELECT 'f:' || staff_profile_id::text
        FROM library.library_loans
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND staff_profile_id IS NOT NULL
          AND returned_at >= ${from} AND returned_at < ${to}
        UNION
        SELECT 's:' || student_id::text
        FROM library.library_visits
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND student_id IS NOT NULL
          AND entry_at >= ${from} AND entry_at < ${to}
        UNION
        SELECT 'f:' || staff_profile_id::text
        FROM library.library_visits
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND staff_profile_id IS NOT NULL
          AND entry_at >= ${from} AND entry_at < ${to}
      )
      SELECT (SELECT COUNT(*)::int FROM active) AS active,
             (SELECT COUNT(*)::int FROM known) AS known
    `;
    return {
      active: Number(rows[0]?.active ?? 0),
      known: Number(rows[0]?.known ?? 0),
    };
  }

  private async collectionCoverage(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      { eligible: number; complete: number }[]
    >`
      SELECT COUNT(*)::int AS eligible,
        COUNT(*) FILTER (
          WHERE NULLIF(BTRIM(c.accession_number), '') IS NOT NULL
            AND NULLIF(BTRIM(b.title), '') IS NOT NULL
            AND (
              NULLIF(BTRIM(COALESCE(c.call_number, '')), '') IS NOT NULL
              OR NULLIF(BTRIM(COALESCE(b.classification_number, '')), '') IS NOT NULL
            )
            AND (
              b.department_id IS NOT NULL
              OR EXISTS (
                SELECT 1 FROM library.library_book_departments bd
                WHERE bd.book_id = b.id
              )
            )
        )::int AS complete
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND b.deleted_at IS NULL
    `;
    return rows[0] ?? { eligible: 0, complete: 0 };
  }

  private async attentionCounts(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        missingAccession: number;
        duplicateGroups: number;
        unprintedLocal: number;
        printHistoryUnknown: number;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE NULLIF(BTRIM(c.accession_number), '') IS NULL
        )::int AS "missingAccession",
        (
          SELECT COUNT(*)::int FROM (
            SELECT 1
            FROM library.library_book_copies d
            JOIN library.library_books db ON db.id = d.book_id
            WHERE d.tenant_id = CAST(${tenantId} AS uuid)
              AND db.deleted_at IS NULL
              AND NULLIF(BTRIM(d.accession_number), '') IS NOT NULL
            GROUP BY BTRIM(d.accession_number)
            HAVING COUNT(*) > 1
          ) dup
        ) AS "duplicateGroups",
        COUNT(*) FILTER (
          WHERE COALESCE(c.source_system, '') <> 'KOHA'
            AND NULLIF(BTRIM(c.accession_number), '') IS NOT NULL
            AND BTRIM(c.accession_number) = c.barcode
            AND NOT EXISTS (
              SELECT 1
              FROM library.library_book_copies d
              JOIN library.library_books db ON db.id = d.book_id
              WHERE d.tenant_id = c.tenant_id
                AND db.deleted_at IS NULL
                AND d.id <> c.id
                AND NULLIF(BTRIM(d.accession_number), '') IS NOT NULL
                AND BTRIM(d.accession_number) = BTRIM(c.accession_number)
            )
            AND NOT EXISTS (
              SELECT 1
              FROM library.library_barcode_print_items i
              JOIN library.library_barcode_print_jobs j ON j.id = i.job_id
              WHERE i.copy_id = c.id AND j.status = 'USER_CONFIRMED'
            )
        )::int AS "unprintedLocal",
        COUNT(*) FILTER (
          WHERE c.source_system = 'KOHA'
            AND NOT EXISTS (
              SELECT 1
              FROM library.library_barcode_print_items i
              JOIN library.library_barcode_print_jobs j ON j.id = i.job_id
              WHERE i.copy_id = c.id AND j.status = 'USER_CONFIRMED'
            )
        )::int AS "printHistoryUnknown"
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND b.deleted_at IS NULL
    `;
    return (
      rows[0] ?? {
        missingAccession: 0,
        duplicateGroups: 0,
        unprintedLocal: 0,
        printHistoryUnknown: 0,
      }
    );
  }

  private async departmentCollection(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      { departmentId: string | null; department: string; copies: number }[]
    >`
      SELECT dept.department_id AS "departmentId",
        COALESCE(NULLIF(BTRIM(d.department_name), ''), 'Unassigned') AS department,
        COUNT(*)::int AS copies
      FROM library.library_book_copies c
      JOIN library.library_books b ON b.id = c.book_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          b.department_id,
          (
            SELECT bd.department_id
            FROM library.library_book_departments bd
            WHERE bd.book_id = b.id
            ORDER BY bd.created_at
            LIMIT 1
          )
        ) AS department_id
      ) dept ON true
      LEFT JOIN core.departments d
        ON d.id = dept.department_id AND d.deleted_at IS NULL
      WHERE c.tenant_id = CAST(${tenantId} AS uuid)
        AND b.deleted_at IS NULL
      GROUP BY dept.department_id, d.department_name
      ORDER BY copies DESC
    `;
    const totalCopies = rows.reduce((sum, row) => sum + row.copies, 0);
    return {
      totalCopies,
      rows: rows.map((row) => ({
        ...row,
        percent: totalCopies ? Math.round((row.copies / totalCopies) * 100) : 0,
      })),
    };
  }

  private async libraryCamsFootfall(tenantId: string, start: Date, end: Date) {
    const point = await this.prisma.accessPoint.findFirst({
      where: { tenantId, code: 'library', deletedAt: null, active: true },
    });
    if (!point) {
      return {
        active: false,
        male: 0,
        female: 0,
        staff: 0,
        guests: 0,
        total: 0,
      };
    }
    const logs = await this.prisma.entryExitLog.findMany({
      where: {
        tenantId,
        accessPointId: point.id,
        allowed: true,
        direction: 'IN',
        scannedAt: { gte: start, lt: end },
      },
      select: { memberType: true, studentId: true },
    });
    let male = 0;
    let female = 0;
    let staff = 0;
    let guests = 0;
    const studentIds = logs
      .filter((l) => l.memberType === 'STUDENT' && l.studentId)
      .map((l) => l.studentId!);
    const students =
      studentIds.length > 0
        ? await this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            include: { masterProfile: { select: { gender: true } } },
          })
        : [];
    for (const log of logs) {
      if (log.memberType === 'VISITOR') guests += 1;
      else if (log.memberType === 'FACULTY' || log.memberType === 'STAFF') {
        staff += 1;
      } else if (log.studentId) {
        const g =
          students
            .find((s) => s.id === log.studentId)
            ?.masterProfile?.gender?.toUpperCase() ?? '';
        if (g.startsWith('M')) male += 1;
        else if (g.startsWith('F')) female += 1;
      }
    }
    return {
      active: true,
      male,
      female,
      staff,
      guests,
      total: logs.length,
    };
  }

  async footfallTrends(tenantId: string) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);

    const visits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: startOfMonth } },
      select: { entryAt: true, memberType: true, studentId: true },
    });

    const weekly = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return {
        date: day.toISOString().slice(0, 10),
        count: visits.filter((v) => v.entryAt >= day && v.entryAt < next)
          .length,
      };
    });

    const monthly = Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return {
        week: i + 1,
        count: visits.filter(
          (v) => v.entryAt >= weekStart && v.entryAt < weekEnd,
        ).length,
      };
    });

    const studentVisits = visits.filter((v) => v.memberType === 'STUDENT');
    const staffVisits = visits.filter(
      (v) => v.memberType === 'STAFF' || v.memberType === 'FACULTY',
    );

    return {
      weekly,
      monthly,
      studentVsStaff: {
        students: studentVisits.length,
        staff: staffVisits.length,
      },
    };
  }

  async departmentHeatmap(tenantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);

    const visits = await this.prisma.libraryVisit.findMany({
      where: {
        tenantId,
        memberType: 'STUDENT',
        entryAt: { gte: startOfMonth },
      },
      select: { studentId: true, entryAt: true },
    });
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: { department: { select: { id: true, name: true } } },
        })
      : [];

    const map = new Map<
      string,
      { departmentId: string | null; departmentName: string; visits: number }
    >();
    for (const visit of visits) {
      const student = students.find((s) => s.id === visit.studentId);
      const key = student?.departmentId ?? 'unknown';
      const name = student?.department?.name ?? 'Unknown';
      const row = map.get(key) ?? {
        departmentId: student?.departmentId ?? null,
        departmentName: name,
        visits: 0,
      };
      row.visits += 1;
      map.set(key, row);
    }

    const rows = [...map.values()].sort((a, b) => b.visits - a.visits);
    const max = rows[0]?.visits ?? 1;
    const dayStarts = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(startOfMonth);
      day.setDate(startOfMonth.getDate() + index);
      day.setHours(0, 0, 0, 0);
      return day;
    });
    const grid = rows.slice(0, 6).map((department) => ({
      departmentName: department.departmentName,
      counts: dayStarts.map((day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const key = department.departmentId ?? 'unknown';
        return visits.filter((visit) => {
          const student = students.find((row) => row.id === visit.studentId);
          const visitKey = student?.departmentId ?? 'unknown';
          return (
            visitKey === key && visit.entryAt >= day && visit.entryAt < next
          );
        }).length;
      }),
    }));
    return {
      from: localDateKey(startOfMonth),
      rows: rows.map((r) => ({
        ...r,
        intensity: Math.round((r.visits / max) * 100),
      })),
      days: dayStarts.map((day) => day.getDate()),
      grid,
    };
  }

  async genderTrends(tenantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);

    const visits = await this.prisma.libraryVisit.findMany({
      where: {
        tenantId,
        memberType: 'STUDENT',
        entryAt: { gte: startOfMonth },
      },
      select: { entryAt: true, studentId: true },
    });
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: { masterProfile: { select: { gender: true } } },
        })
      : [];

    const weekly = Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      let male = 0;
      let female = 0;
      for (const visit of visits) {
        if (visit.entryAt < weekStart || visit.entryAt >= weekEnd) continue;
        const gender =
          students
            .find((s) => s.id === visit.studentId)
            ?.masterProfile?.gender?.toUpperCase() ?? '';
        if (gender.startsWith('M')) male += 1;
        else if (gender.startsWith('F')) female += 1;
      }
      return { week: i + 1, male, female, total: male + female };
    });

    return { from: startOfMonth.toISOString().slice(0, 10), weekly };
  }

  async readingAnalytics(
    tenantId: string,
    daysOrQuery: number | { days?: number; from?: string; to?: string } = 365,
  ) {
    const range = resolveReadingRange(
      typeof daysOrQuery === 'number' ? { days: daysOrQuery } : daysOrQuery,
    );
    const { from, to, days } = range;
    const previousFrom = new Date(from);
    previousFrom.setDate(previousFrom.getDate() - days);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const [loans, previousLoans, weekLoans, departmentsTotal] =
      await Promise.all([
        this.prisma.libraryLoan.findMany({
          where: { tenantId, issuedAt: { gte: from, lt: to } },
          include: {
            copy: {
              include: {
                book: {
                  select: {
                    id: true,
                    title: true,
                    author: true,
                    accessionNo: true,
                    categoryId: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.libraryLoan.findMany({
          where: { tenantId, issuedAt: { gte: previousFrom, lt: from } },
          select: {
            issuedAt: true,
            returnedAt: true,
            studentId: true,
            staffProfileId: true,
            copy: { select: { bookId: true } },
          },
        }),
        this.prisma.libraryLoan.findMany({
          where: { tenantId, issuedAt: { gte: weekStart } },
          select: { issuedAt: true },
        }),
        this.prisma.department.count({ where: { tenantId, deletedAt: null } }),
      ]);

    const bookMap = new Map<
      string,
      {
        bookId: string;
        title: string;
        author: string | null;
        accessionNo: string;
        issueCount: number;
      }
    >();
    for (const loan of loans) {
      const book = loan.copy.book;
      const row = bookMap.get(book.id) ?? {
        bookId: book.id,
        title: book.title,
        author: book.author,
        accessionNo: book.accessionNo,
        issueCount: 0,
      };
      row.issueCount += 1;
      bookMap.set(book.id, row);
    }
    const topBooks = [...bookMap.values()]
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 20);

    const readerMap = new Map<
      string,
      {
        memberType: string;
        memberId: string;
        studentId?: string;
        staffProfileId?: string;
        issueCount: number;
      }
    >();
    for (const loan of loans) {
      const memberId = loan.studentId ?? loan.staffProfileId;
      if (!memberId) continue;
      const key = `${loan.memberType}:${memberId}`;
      const row = readerMap.get(key) ?? {
        memberType: loan.memberType,
        memberId,
        studentId: loan.studentId ?? undefined,
        staffProfileId: loan.staffProfileId ?? undefined,
        issueCount: 0,
      };
      row.issueCount += 1;
      readerMap.set(key, row);
    }

    const readerEntries = [...readerMap.values()]
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 50);

    const studentIds = readerEntries
      .filter((r) => r.studentId)
      .map((r) => r.studentId!);
    const staffIds = readerEntries
      .filter((r) => r.staffProfileId)
      .map((r) => r.staffProfileId!);

    const [students, staffProfiles] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            include: {
              masterProfile: { select: { fullName: true } },
              department: { select: { id: true, name: true } },
              programVersion: {
                select: { program: { select: { name: true } } },
              },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            include: {
              department: { select: { id: true, name: true } },
            },
          })
        : [],
    ]);

    const topReaders = readerEntries.map((r) => {
      if (r.studentId) {
        const s = students.find((x) => x.id === r.studentId);
        return {
          memberType: r.memberType,
          memberId: r.memberId,
          fullName: s?.masterProfile?.fullName ?? 'Student',
          registrationNumber: s?.enrollmentNumber ?? null,
          department: s?.department?.name ?? null,
          programme: s?.programVersion?.program?.name ?? null,
          issueCount: r.issueCount,
        };
      }
      const sp = staffProfiles.find((x) => x.id === r.staffProfileId);
      return {
        memberType: r.memberType,
        memberId: r.memberId,
        fullName: sp?.fullName ?? 'Staff',
        registrationNumber: sp?.employeeCode ?? null,
        department: sp?.department?.name ?? null,
        programme: null,
        issueCount: r.issueCount,
      };
    });

    const loanStudentIds = [
      ...new Set(loans.map((l) => l.studentId).filter(Boolean)),
    ] as string[];
    const loanStaffIds = [
      ...new Set(loans.map((l) => l.staffProfileId).filter(Boolean)),
    ] as string[];
    const [loanStudents, loanStaff, categories] = await Promise.all([
      loanStudentIds.length > 0
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: loanStudentIds } },
            include: {
              masterProfile: { select: { fullName: true } },
              department: { select: { id: true, name: true } },
            },
          })
        : [],
      loanStaffIds.length > 0
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: loanStaffIds } },
            include: { department: { select: { id: true, name: true } } },
          })
        : [],
      this.prisma.libraryCategory.findMany({
        where: {
          tenantId,
          id: {
            in: [
              ...new Set(
                loans
                  .map((loan) => loan.copy.book.categoryId)
                  .filter((id): id is string => Boolean(id)),
              ),
            ]
              .slice(0, 200)
              .concat('00000000-0000-0000-0000-000000000000')
              .slice(0, 200),
          },
        },
        select: { id: true, name: true },
      }),
    ]);

    const deptMap = new Map<
      string,
      {
        departmentId: string | null;
        departmentName: string;
        issueCount: number;
        uniqueReaders: Set<string>;
      }
    >();
    for (const loan of loans) {
      if (!loan.studentId) continue;
      const student = loanStudents.find((s) => s.id === loan.studentId);
      const deptId = student?.department?.id ?? null;
      const deptName = student?.department?.name ?? 'Unknown';
      const key = deptId ?? 'unknown';
      const row = deptMap.get(key) ?? {
        departmentId: deptId,
        departmentName: deptName,
        issueCount: 0,
        uniqueReaders: new Set<string>(),
      };
      row.issueCount += 1;
      row.uniqueReaders.add(loan.studentId);
      deptMap.set(key, row);
    }
    for (const loan of loans) {
      if (!loan.staffProfileId) continue;
      const staff = loanStaff.find((row) => row.id === loan.staffProfileId);
      const deptId = staff?.department?.id ?? null;
      const deptName = staff?.department?.name ?? 'Unknown';
      const key = deptId ?? 'unknown';
      const row = deptMap.get(key) ?? {
        departmentId: deptId,
        departmentName: deptName,
        issueCount: 0,
        uniqueReaders: new Set<string>(),
      };
      row.issueCount += 1;
      row.uniqueReaders.add(loan.staffProfileId);
      deptMap.set(key, row);
    }

    const maxIssues = Math.max(
      1,
      ...[...deptMap.values()].map((d) => d.issueCount),
    );
    const departmentUsage = [...deptMap.values()]
      .map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        issueCount: d.issueCount,
        uniqueReaders: d.uniqueReaders.size,
        intensity: Math.round((d.issueCount / maxIssues) * 100),
      }))
      .sort((a, b) => b.issueCount - a.issueCount);

    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const categoryCounts = new Map<string, number>();
    for (const loan of loans) {
      const name = loan.copy.book.categoryId
        ? categoryNames.get(loan.copy.book.categoryId)
        : null;
      if (!name) continue;
      categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
    }
    const mostPopularCategory =
      [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const loan of loans) dayCounts[loan.issuedAt.getDay()] += 1;
    const averageLoanDays = meanLoanDays(loans);
    const previousAverage = meanLoanDays(previousLoans);
    const activeReaders = new Set(
      loans
        .map((loan) => loan.studentId ?? loan.staffProfileId)
        .filter(Boolean),
    ).size;
    const previousReaders = new Set(
      previousLoans
        .map((loan) => loan.studentId ?? loan.staffProfileId)
        .filter(Boolean),
    ).size;
    const previousTitles = new Set(
      previousLoans.map((loan) => loan.copy.bookId),
    ).size;
    const end = new Date(to);
    end.setDate(end.getDate() - 1);
    const weeklyIssues = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const key = localDateKey(day);
      return {
        date: key,
        label: day.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        count: weekLoans.filter((loan) => localDateKey(loan.issuedAt) === key)
          .length,
      };
    });

    return {
      from: localDateKey(from),
      to: localDateKey(end),
      days,
      topBooks,
      topReaders,
      departmentUsage,
      summary: {
        from: localDateKey(from),
        to: localDateKey(end),
        totalIssues: loans.length,
        activeReaders,
        uniqueTitles: bookMap.size,
        departmentsActive: [...deptMap.values()].filter(
          (row) => row.departmentId,
        ).length,
        departmentsTotal,
        averageLoanDays,
        mostActiveDay: loans.length
          ? DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))]
          : null,
        mostPopularCategory,
        deltas: {
          totalIssues: percentChange(loans.length, previousLoans.length),
          activeReaders: percentChange(activeReaders, previousReaders),
          uniqueTitles: percentChange(bookMap.size, previousTitles),
          averageLoanDays:
            averageLoanDays == null || previousAverage == null
              ? null
              : percentChange(averageLoanDays, previousAverage),
        },
      },
      weeklyIssues,
    };
  }

  async reportsDesk(
    tenantId: string,
    query: { days?: number; from?: string; to?: string; year?: number },
  ) {
    const range = resolveReadingRange(query);
    const { from, to, days } = range;
    const previousFrom = new Date(from);
    previousFrom.setDate(previousFrom.getDate() - days);
    const end = new Date(to);
    end.setDate(end.getDate() - 1);
    const year = query.year ?? end.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const now = new Date();
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;

    const [
      current,
      previous,
      overdueNow,
      overdueThen,
      newNow,
      newPrev,
      issuedMonths,
      returnedMonths,
      categoryRows,
      bookRows,
      readerRows,
      yearRows,
      studentDeptRows,
      staffDeptRows,
    ] = await Promise.all([
      this.periodLoanStats(tenant, from, to),
      this.periodLoanStats(tenant, previousFrom, from),
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND status = 'ACTIVE'
          AND due_at < ${now}
      `,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND issued_at < ${from}
          AND due_at < ${from}
          AND (returned_at IS NULL OR returned_at >= ${from})
      `,
      this.firstIssueCount(tenant, from, to),
      this.firstIssueCount(tenant, previousFrom, from),
      this.monthCounts(tenant, 'issued_at', yearStart, yearEnd),
      this.monthCounts(tenant, 'returned_at', yearStart, yearEnd),
      this.prisma.$queryRaw<{ name: string; issues: number; titles: number }[]>`
        SELECT COALESCE(cat.name, 'Uncategorised') AS name,
          COUNT(*)::int AS issues,
          COUNT(DISTINCT b.id)::int AS titles
        FROM library.library_loans l
        JOIN library.library_book_copies c ON c.id = l.copy_id
        JOIN library.library_books b ON b.id = c.book_id
        LEFT JOIN library.library_categories cat ON cat.id = b.category_id
        WHERE l.tenant_id = ${tenant}
          AND l.issued_at >= ${from}
          AND l.issued_at < ${to}
        GROUP BY 1
        ORDER BY issues DESC
      `,
      this.prisma.$queryRaw<
        {
          id: string;
          title: string;
          author: string | null;
          accession_no: string;
          issues: number;
        }[]
      >`
        SELECT b.id, b.title, b.author, b.accession_no, COUNT(*)::int AS issues
        FROM library.library_loans l
        JOIN library.library_book_copies c ON c.id = l.copy_id
        JOIN library.library_books b ON b.id = c.book_id
        WHERE l.tenant_id = ${tenant}
          AND l.issued_at >= ${from}
          AND l.issued_at < ${to}
        GROUP BY b.id, b.title, b.author, b.accession_no
        ORDER BY issues DESC
        LIMIT 10
      `,
      this.prisma.$queryRaw<
        {
          member_type: string;
          student_id: string | null;
          staff_profile_id: string | null;
          issues: number;
        }[]
      >`
        SELECT member_type, student_id, staff_profile_id, COUNT(*)::int AS issues
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND issued_at >= ${from}
          AND issued_at < ${to}
          AND (student_id IS NOT NULL OR staff_profile_id IS NOT NULL)
        GROUP BY member_type, student_id, staff_profile_id
        ORDER BY issues DESC
        LIMIT 10
      `,
      this.prisma.$queryRaw<{ year: number }[]>`
        SELECT DISTINCT EXTRACT(YEAR FROM issued_at)::int AS year
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
        ORDER BY year DESC
      `,
      this.prisma.$queryRaw<{ name: string; issues: number }[]>`
        SELECT d.department_name AS name, COUNT(*)::int AS issues
        FROM library.library_loans l
        JOIN academic.students s ON s.id = l.student_id
        JOIN core.departments d ON d.id = s.department_id
        WHERE l.tenant_id = ${tenant}
          AND l.issued_at >= ${from}
          AND l.issued_at < ${to}
        GROUP BY d.department_name
      `,
      this.prisma.$queryRaw<{ name: string; issues: number }[]>`
        SELECT d.department_name AS name, COUNT(*)::int AS issues
        FROM library.library_loans l
        JOIN academic.staff_profiles sp ON sp.id = l.staff_profile_id
        JOIN core.departments d ON d.id = sp.department_id
        WHERE l.tenant_id = ${tenant}
          AND l.issued_at >= ${from}
          AND l.issued_at < ${to}
        GROUP BY d.department_name
      `,
    ]);

    const studentIds = readerRows
      .map((row) => row.student_id)
      .filter((id): id is string => Boolean(id));
    const staffIds = readerRows
      .map((row) => row.staff_profile_id)
      .filter((id): id is string => Boolean(id));
    const [students, staff] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: {
              id: true,
              masterProfile: { select: { fullName: true } },
              department: { select: { name: true } },
              programVersion: {
                select: { program: { select: { name: true } } },
              },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            select: {
              id: true,
              fullName: true,
              department: { select: { name: true } },
            },
          })
        : [],
    ]);

    const deptMap = new Map<string, number>();
    for (const row of [...studentDeptRows, ...staffDeptRows]) {
      deptMap.set(row.name, (deptMap.get(row.name) ?? 0) + Number(row.issues));
    }
    const departments = [...deptMap.entries()]
      .map(([name, issues]) => ({ name, issues }))
      .sort((a, b) => b.issues - a.issues)
      .slice(0, 5);

    const months = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      label: MONTHS[index],
      issued: Number(
        issuedMonths.find((row) => Number(row.month) === index + 1)?.count ?? 0,
      ),
      returned: Number(
        returnedMonths.find((row) => Number(row.month) === index + 1)?.count ??
          0,
      ),
    }));

    const currentAvg = current.avgDays;
    const previousAvg = previous.avgDays;
    return {
      from: localDateKey(from),
      to: localDateKey(end),
      days,
      year,
      years: [
        ...new Set([year, ...yearRows.map((row) => Number(row.year))]),
      ].filter((value) => Number.isFinite(value)),
      summary: {
        totalIssues: current.issues,
        activeMembers: current.readers,
        newReaders: Number(newNow[0]?.readers ?? 0),
        averageLoanDays: currentAvg,
        overdue: Number(overdueNow[0]?.count ?? 0),
        deltas: {
          totalIssues: percentChange(current.issues, previous.issues),
          activeMembers: percentChange(current.readers, previous.readers),
          newReaders: percentChange(
            Number(newNow[0]?.readers ?? 0),
            Number(newPrev[0]?.readers ?? 0),
          ),
          averageLoanDays:
            currentAvg == null || previousAvg == null
              ? null
              : percentChange(currentAvg, previousAvg),
          overdue: percentChange(
            Number(overdueNow[0]?.count ?? 0),
            Number(overdueThen[0]?.count ?? 0),
          ),
        },
      },
      months,
      categories: shareCategories(
        categoryRows.map((row) => ({
          name: row.name,
          issues: Number(row.issues),
          titles: Number(row.titles),
        })),
      ),
      topBooks: bookRows.map((row) => ({
        bookId: row.id,
        title: row.title,
        author: row.author,
        accessionNo: row.accession_no,
        issues: Number(row.issues),
      })),
      topReaders: readerRows.map((row) => {
        const student = students.find((item) => item.id === row.student_id);
        const member = staff.find((item) => item.id === row.staff_profile_id);
        return {
          memberType: row.member_type,
          memberId: row.student_id ?? row.staff_profile_id ?? '',
          fullName:
            student?.masterProfile?.fullName ?? member?.fullName ?? 'Member',
          department:
            student?.department?.name ?? member?.department?.name ?? null,
          programme: student?.programVersion?.program?.name ?? null,
          issues: Number(row.issues),
        };
      }),
      departments,
    };
  }

  private periodLoanStats(tenant: Prisma.Sql, from: Date, to: Date) {
    return this.prisma.$queryRaw<
      { issues: number; readers: number; avg_days: string | number | null }[]
    >`
      SELECT COUNT(*)::int AS issues,
        COUNT(DISTINCT COALESCE(student_id, staff_profile_id))::int AS readers,
        ROUND(AVG(EXTRACT(EPOCH FROM (returned_at - issued_at)) / 86400) FILTER (
          WHERE returned_at IS NOT NULL AND returned_at >= issued_at
        )::numeric, 1) AS avg_days
      FROM library.library_loans
      WHERE tenant_id = ${tenant}
        AND issued_at >= ${from}
        AND issued_at < ${to}
    `.then((rows) => ({
      issues: Number(rows[0]?.issues ?? 0),
      readers: Number(rows[0]?.readers ?? 0),
      avgDays: rows[0]?.avg_days == null ? null : Number(rows[0].avg_days),
    }));
  }

  private firstIssueCount(tenant: Prisma.Sql, from: Date, to: Date) {
    return this.prisma.$queryRaw<{ readers: number }[]>`
      SELECT COUNT(*)::int AS readers
      FROM (
        SELECT COALESCE(student_id, staff_profile_id) AS member_id, MIN(issued_at) AS first_at
        FROM library.library_loans
        WHERE tenant_id = ${tenant}
          AND (student_id IS NOT NULL OR staff_profile_id IS NOT NULL)
        GROUP BY 1
      ) firsts
      WHERE first_at >= ${from} AND first_at < ${to}
    `;
  }

  private monthCounts(
    tenant: Prisma.Sql,
    column: 'issued_at' | 'returned_at',
    from: Date,
    to: Date,
  ) {
    const field = Prisma.raw(column);
    return this.prisma.$queryRaw<{ month: number; count: number }[]>`
      SELECT EXTRACT(MONTH FROM ${field})::int AS month, COUNT(*)::int AS count
      FROM library.library_loans
      WHERE tenant_id = ${tenant}
        AND ${field} >= ${from}
        AND ${field} < ${to}
      GROUP BY 1
    `;
  }
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function resolveReadingRange(query: {
  days?: number;
  from?: string;
  to?: string;
}) {
  const start = query.from ? startOfDay(query.from) : null;
  const endDay = query.to ? startOfDay(query.to) : null;
  if (query.from && query.to && start && endDay) {
    const from = start <= endDay ? start : endDay;
    const last = start <= endDay ? endDay : start;
    const to = new Date(last);
    to.setDate(to.getDate() + 1);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (days < 1 || days > 730) {
      throw new BadRequestException('Choose a range of 1 to 730 days');
    }
    return { from, to, days };
  }
  const days = query.days ?? 365;
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to, days };
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

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function meanLoanDays(loans: { issuedAt: Date; returnedAt: Date | null }[]) {
  const completed = loans.filter(
    (loan) => loan.returnedAt && loan.returnedAt >= loan.issuedAt,
  );
  if (!completed.length) return null;
  const total = completed.reduce(
    (sum, loan) => sum + (loan.returnedAt!.getTime() - loan.issuedAt.getTime()),
    0,
  );
  return Math.round((total / completed.length / 86_400_000) * 10) / 10;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function shareCategories(
  rows: { name: string; issues: number; titles: number }[],
) {
  const top = rows.slice(0, 4);
  const rest = rows.slice(4);
  const grouped = rest.length
    ? [
        ...top,
        {
          name: 'Others',
          issues: rest.reduce((sum, row) => sum + row.issues, 0),
          titles: rest.reduce((sum, row) => sum + row.titles, 0),
        },
      ]
    : top;
  const issueTotal = grouped.reduce((sum, row) => sum + row.issues, 0);
  const titleTotal = grouped.reduce((sum, row) => sum + row.titles, 0);
  return grouped.map((row) => ({
    ...row,
    issueShare: issueTotal
      ? Math.round((row.issues / issueTotal) * 1000) / 10
      : 0,
    titleShare: titleTotal
      ? Math.round((row.titles / titleTotal) * 1000) / 10
      : 0,
  }));
}
