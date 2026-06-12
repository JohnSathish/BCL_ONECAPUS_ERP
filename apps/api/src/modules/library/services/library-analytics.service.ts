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
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      todayVisitors,
      weekVisitors,
      activeLoans,
      overdueLoans,
      totalBooks,
      availableCopies,
      digitalAssets,
      researchItems,
      unpaidFines,
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
        where: { tenantId, status: 'AVAILABLE' },
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
    ]);

    const footfallTrends = await this.footfallTrends(tenantId);
    const departmentHeatmap = await this.departmentHeatmap(tenantId);
    const genderTrends = await this.genderTrends(tenantId);

    return {
      occupancy,
      todayVisitors,
      weekVisitors,
      activeLoans,
      overdueLoans,
      totalBooks,
      availableCopies,
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
}
