import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LibrarySettingsService } from './library-settings.service';
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
};

@Injectable()
export class LibraryAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
  ) {}

  async getOccupancy(tenantId: string): Promise<OccupancySnapshot> {
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
    const todayVisits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: startOfDay } },
      select: { entryAt: true },
    });
    const hourlyFootfall = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: todayVisits.filter((v) => v.entryAt.getHours() === hour).length,
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
    };
  }

  async dashboard(tenantId: string) {
    const occupancy = await this.getOccupancy(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

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
      fineCollectedToday,
      digitalAssets,
      researchItems,
      unpaidFines,
      camsFootfall,
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
      this.prisma.libraryBookCopy.count({ where: { tenantId } }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, status: 'AVAILABLE' },
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
        where: { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, paidAt: { gte: startOfDay, lt: endOfDay } },
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
    ]);

    const footfallTrends = await this.footfallTrends(tenantId);
    const departmentHeatmap = await this.departmentHeatmap(tenantId);
    const genderTrends = await this.genderTrends(tenantId);
    const healthScore = this.computeHealthScore({
      todayVisitors,
      totalSeats: occupancy.totalSeats,
      issuedToday,
      overdueLoans,
      activeLoans,
      digitalViewsToday,
      weekVisitors,
      camsActive: camsFootfall.active,
    });
    const activity = await this.recentActivity(tenantId, 20);

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
      digitalViewsToday,
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
      entryAnalytics: camsFootfall,
    };
  }

  async recentActivity(tenantId: string, limit = 20) {
    const logs = await this.prisma.libraryAuditLog.findMany({
      where: {
        tenantId,
        action: { in: ['ISSUE', 'RETURN', 'RENEW'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return logs.map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, string>;
      return {
        at: log.createdAt.toISOString(),
        action: log.action,
        memberName: meta.memberName ?? 'Member',
        bookTitle: meta.bookTitle ?? '—',
        programme: meta.programme ?? null,
      };
    });
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

  private computeHealthScore(input: {
    todayVisitors: number;
    totalSeats: number;
    issuedToday: number;
    overdueLoans: number;
    activeLoans: number;
    digitalViewsToday: number;
    weekVisitors: number;
    camsActive: boolean;
  }) {
    const usagePct =
      input.totalSeats > 0
        ? Math.min(100, (input.todayVisitors / input.totalSeats) * 100)
        : 0;
    const circulationScore = Math.min(100, input.issuedToday * 8 + 20);
    const digitalScore = Math.min(100, input.digitalViewsToday * 5 + 10);
    const overdueRate =
      input.activeLoans > 0
        ? (input.overdueLoans / input.activeLoans) * 100
        : 0;
    const overdueScore = Math.max(0, 100 - overdueRate * 2);
    const engagementScore = Math.min(100, input.weekVisitors / 10);
    const camsScore = input.camsActive ? 15 : 5;
    const overall = Math.round(
      usagePct * 0.2 +
        circulationScore * 0.25 +
        digitalScore * 0.15 +
        overdueScore * 0.2 +
        engagementScore * 0.1 +
        camsScore,
    );
    return {
      overall: Math.min(100, overall),
      usage: Math.round(usagePct),
      circulation: Math.round(circulationScore),
      digital: Math.round(digitalScore),
      overdueControl: Math.round(overdueScore),
      engagement: Math.round(engagementScore),
      entryAnalytics: input.camsActive,
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
      select: { studentId: true },
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
    return {
      from: startOfMonth.toISOString().slice(0, 10),
      rows: rows.map((r) => ({
        ...r,
        intensity: Math.round((r.visits / max) * 100),
      })),
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

  async readingAnalytics(tenantId: string, days = 365) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: from } },
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
    });

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
        issueCount: r.issueCount,
      };
    });

    const loanStudentIds = [
      ...new Set(loans.map((l) => l.studentId).filter(Boolean)),
    ] as string[];
    const loanStudents =
      loanStudentIds.length > 0
        ? await this.prisma.student.findMany({
            where: { tenantId, id: { in: loanStudentIds } },
            include: {
              masterProfile: { select: { fullName: true } },
              department: { select: { id: true, name: true } },
            },
          })
        : [];

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

    return {
      from: from.toISOString().slice(0, 10),
      days,
      topBooks,
      topReaders,
      departmentUsage,
    };
  }
}
