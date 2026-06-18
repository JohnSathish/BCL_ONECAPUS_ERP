import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import type { ScanAccessDto, VisitQueryDto } from '../dto/library.dto';
import { LibraryAnalyticsService } from './library-analytics.service';
import {
  LibraryMemberLookupService,
  type LibraryMemberProfile,
} from './library-member-lookup.service';
import { LibraryQrService } from './library-qr.service';
import { LibrarySettingsService } from './library-settings.service';
import { LibraryZonesService } from './library-zones.service';

export type ScanResult = {
  action: 'ENTRY' | 'EXIT';
  profile: LibraryMemberProfile;
  visit: {
    id: string;
    entryAt: Date;
    exitAt?: Date | null;
    durationMinutes?: number | null;
    zoneId?: string | null;
    seatLabel?: string | null;
    entryMethod?: string | null;
  };
  occupancy: Awaited<ReturnType<LibraryAnalyticsService['getOccupancy']>>;
  zone?: {
    id: string;
    name: string;
    code: string;
    seatLabel?: string | null;
  } | null;
  deskContext?: {
    mobile?: string | null;
    rfidNumber?: string | null;
    abcId?: string | null;
    activeLoans?: number;
    /** Total unpaid library fine amount (₹) */
    unpaidFines?: number;
    membershipStatus?: string;
    attendancePercent?: number | null;
    feeStatus?: string | null;
  } | null;
};

@Injectable()
export class LibraryAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly analytics: LibraryAnalyticsService,
    private readonly realtime: RealtimeGateway,
    private readonly qr: LibraryQrService,
    private readonly settings: LibrarySettingsService,
    private readonly zones: LibraryZonesService,
  ) {}

  private openVisitWhere(tenantId: string, profile: LibraryMemberProfile) {
    if (profile.memberType === 'STUDENT') {
      return {
        tenantId,
        memberType: 'STUDENT',
        studentId: profile.studentId!,
        exitAt: null,
      };
    }
    if (profile.memberType === 'VISITOR') {
      return {
        tenantId,
        memberType: 'VISITOR',
        visitorId: profile.visitorId!,
        exitAt: null,
      };
    }
    return {
      tenantId,
      memberType: profile.memberType,
      staffProfileId: profile.staffProfileId!,
      exitAt: null,
    };
  }

  async scan(tenantId: string, dto: ScanAccessDto): Promise<ScanResult> {
    const { entryMethod } = this.qr.resolveScanCode(dto.scanCode);
    return this.scanWithMethod(tenantId, dto, entryMethod);
  }

  async scanWithMethod(
    tenantId: string,
    dto: ScanAccessDto,
    entryMethod: string,
  ): Promise<ScanResult> {
    const settings = await this.settings.getSettings(tenantId);
    if (entryMethod === 'QR' && !settings.qrEntryEnabled) {
      throw new BadRequestException('QR entry is disabled');
    }
    if (
      (entryMethod === 'RFID' || entryMethod === 'BARCODE') &&
      settings.rfidEntryEnabled === false
    ) {
      throw new BadRequestException('RFID/barcode entry is disabled');
    }
    return this.toggleVisit(tenantId, dto, entryMethod);
  }

  async selfCheckIn(user: JwtUser, zoneId?: string): Promise<ScanResult> {
    const settings = await this.settings.getSettings(user.tid);
    if (!settings.selfCheckInEnabled) {
      throw new BadRequestException('Self check-in is disabled');
    }
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student)
      throw new BadRequestException(
        'Student record required for self check-in',
      );

    return this.toggleVisit(
      user.tid,
      { scanCode: student.enrollmentNumber, zoneId },
      'SELF',
    );
  }

  private async toggleVisit(
    tenantId: string,
    dto: ScanAccessDto,
    entryMethod: string,
  ): Promise<ScanResult> {
    const profile = await this.lookup.lookup(tenantId, dto.scanCode);
    const settings = await this.settings.getSettings(tenantId);

    const openVisit = await this.prisma.libraryVisit.findFirst({
      where: this.openVisitWhere(tenantId, profile),
      orderBy: { entryAt: 'desc' },
    });

    if (!openVisit && !profile.active) {
      throw new BadRequestException(
        'Access restricted — library membership inactive or suspended',
      );
    }

    let visit;
    let action: 'ENTRY' | 'EXIT';
    let assignedZone: ScanResult['zone'] = null;

    if (openVisit) {
      const exitAt = new Date();
      const durationMinutes = Math.max(
        1,
        Math.round((exitAt.getTime() - openVisit.entryAt.getTime()) / 60_000),
      );
      visit = await this.prisma.libraryVisit.update({
        where: { id: openVisit.id },
        data: { exitAt, durationMinutes },
      });
      action = 'EXIT';
    } else {
      let zoneId: string | undefined = dto.zoneId;
      let seatLabel: string | undefined;

      if (settings.zonesEnabled) {
        const zone = await this.zones.pickZoneForEntry(tenantId, zoneId);
        if (zone) {
          zoneId = zone.id;
          seatLabel = this.zones.buildSeatLabel(zone.code, zone.occupied);
          assignedZone = {
            id: zone.id,
            name: zone.name,
            code: zone.code,
            seatLabel,
          };
        }
      }

      visit = await this.prisma.libraryVisit.create({
        data: {
          id: randomUUID(),
          tenantId,
          memberType: profile.memberType,
          studentId: profile.studentId,
          staffProfileId: profile.staffProfileId,
          visitorId: profile.visitorId,
          hallId: dto.hallId,
          zoneId,
          seatLabel,
          entryMethod,
        },
      });
      action = 'ENTRY';
    }

    const occupancy = await this.analytics.getOccupancy(tenantId);
    const deskContext = await this.buildDeskContext(tenantId, profile);
    const result: ScanResult = {
      action,
      profile,
      visit: {
        id: visit.id,
        entryAt: visit.entryAt,
        exitAt: visit.exitAt,
        durationMinutes: visit.durationMinutes,
        zoneId: visit.zoneId,
        seatLabel: visit.seatLabel,
        entryMethod: visit.entryMethod,
      },
      occupancy,
      zone: assignedZone,
      deskContext,
    };

    this.realtime.broadcastToTenant(
      tenantId,
      'library:occupancy:updated',
      occupancy,
    );
    this.realtime.broadcastToTenant(tenantId, 'library:scan:result', result);

    return result;
  }

  async listVisits(tenantId: string, query: VisitQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const where = {
      tenantId,
      ...(query.memberType ? { memberType: query.memberType } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(from || to
        ? {
            entryAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.libraryVisit.findMany({
        where,
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.libraryVisit.count({ where }),
    ]);

    const enriched = await this.enrichVisits(tenantId, items);
    return { items: enriched, total, page, limit };
  }

  async getStudentVisits(tenantId: string, studentId: string, limit = 50) {
    const items = await this.prisma.libraryVisit.findMany({
      where: { tenantId, studentId },
      orderBy: { entryAt: 'desc' },
      take: limit,
    });
    const enriched = await this.enrichVisits(tenantId, items);
    const totalVisits = await this.prisma.libraryVisit.count({
      where: { tenantId, studentId, exitAt: { not: null } },
    });
    return { items: enriched, totalVisits };
  }

  private async enrichVisits(
    tenantId: string,
    visits: {
      id: string;
      memberType: string;
      studentId: string | null;
      staffProfileId: string | null;
      visitorId: string | null;
      entryAt: Date;
      exitAt: Date | null;
      durationMinutes: number | null;
      zoneId?: string | null;
      seatLabel?: string | null;
      entryMethod?: string | null;
    }[],
  ) {
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const staffIds = [
      ...new Set(visits.map((v) => v.staffProfileId).filter(Boolean)),
    ] as string[];
    const visitorIds = [
      ...new Set(visits.map((v) => v.visitorId).filter(Boolean)),
    ] as string[];
    const zoneIds = [
      ...new Set(visits.map((v) => v.zoneId).filter(Boolean)),
    ] as string[];

    const [students, staff, visitors, zones] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            include: {
              masterProfile: true,
              department: { select: { name: true } },
              programVersion: {
                include: { program: { select: { name: true } } },
              },
              academicStanding: {
                select: { currentSemesterSequence: true },
              },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            include: { department: { select: { name: true } } },
          })
        : [],
      visitorIds.length
        ? this.prisma.libraryVisitor.findMany({
            where: { tenantId, id: { in: visitorIds } },
          })
        : [],
      zoneIds.length
        ? this.prisma.libraryReadingZone.findMany({
            where: { tenantId, id: { in: zoneIds } },
          })
        : [],
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    const visitorMap = new Map(visitors.map((v) => [v.id, v]));
    const zoneMap = new Map(zones.map((z) => [z.id, z]));

    return visits.map((v) => {
      const student = v.studentId ? studentMap.get(v.studentId) : undefined;
      const staffMember = v.staffProfileId
        ? staffMap.get(v.staffProfileId)
        : undefined;
      const visitor = v.visitorId ? visitorMap.get(v.visitorId) : undefined;
      const zone = v.zoneId ? zoneMap.get(v.zoneId) : undefined;
      return {
        ...v,
        memberName:
          student?.masterProfile?.fullName ??
          staffMember?.fullName ??
          visitor?.fullName ??
          'Unknown',
        department:
          student?.department?.name ??
          staffMember?.department?.name ??
          visitor?.institution ??
          null,
        photoUrl:
          toPublicUploadUrl(student?.masterProfile?.photoPath) ??
          staffMember?.photoUrl ??
          null,
        registrationNumber:
          student?.enrollmentNumber ??
          staffMember?.employeeCode ??
          visitor?.passNumber ??
          null,
        programme:
          student?.programVersion?.program?.name ??
          staffMember?.department?.name ??
          null,
        semester: student?.academicStanding?.currentSemesterSequence ?? null,
        zoneName: zone?.name ?? null,
      };
    });
  }

  private async buildDeskContext(
    tenantId: string,
    profile: LibraryMemberProfile,
  ): Promise<ScanResult['deskContext']> {
    if (profile.memberType !== 'STUDENT' || !profile.studentId) return null;

    const [student, activeLoans, fineAgg, feeRow, attendanceRows] =
      await Promise.all([
        this.prisma.student.findFirst({
          where: { tenantId, id: profile.studentId, deletedAt: null },
          include: {
            masterProfile: { select: { mobileNumber: true } },
            abcAccount: { select: { abcId: true } },
          },
        }),
        this.prisma.libraryLoan.count({
          where: { tenantId, studentId: profile.studentId, status: 'ACTIVE' },
        }),
        this.prisma.libraryFine.aggregate({
          where: {
            tenantId,
            paidAt: null,
            waivedAt: null,
            loan: { studentId: profile.studentId },
          },
          _sum: { amount: true },
        }),
        this.prisma.studentFeeSummary.findUnique({
          where: {
            tenantId_studentId: { tenantId, studentId: profile.studentId },
          },
          select: { feeStatus: true, totalOutstanding: true },
        }),
        this.prisma.studentAttendanceSummary.findMany({
          where: {
            tenantId,
            studentId: profile.studentId,
            periodKey: 'SEMESTER',
          },
          select: { percentage: true },
        }),
      ]);

    const attendancePercent = attendanceRows.length
      ? Math.round(
          attendanceRows.reduce((s, r) => s + Number(r.percentage), 0) /
            attendanceRows.length,
        )
      : null;

    const feeStatus =
      feeRow?.feeStatus ??
      (Number(feeRow?.totalOutstanding ?? 0) > 0 ? 'DUE' : 'CLEAR');

    return {
      mobile: student?.masterProfile?.mobileNumber ?? null,
      rfidNumber: student?.rfidNumber ?? null,
      abcId: student?.abcAccount?.abcId ?? null,
      activeLoans,
      unpaidFines: Number(fineAgg._sum.amount ?? 0),
      membershipStatus: profile.active ? 'ACTIVE' : profile.status,
      attendancePercent,
      feeStatus,
    };
  }

  async accessDeskDashboard(tenantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const occupancy = await this.analytics.getOccupancy(tenantId);

    const [
      entriesToday,
      exitsToday,
      completedToday,
      overdueLoans,
      unpaidFinesCount,
      booksIssuedToday,
      booksReturnedToday,
      openVisitsRaw,
    ] = await Promise.all([
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryVisit.count({
        where: { tenantId, exitAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryVisit.findMany({
        where: {
          tenantId,
          exitAt: { gte: startOfDay, lt: endOfDay },
          durationMinutes: { not: null },
        },
        select: { durationMinutes: true },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE', dueAt: { lt: new Date() } },
      }),
      this.prisma.libraryFine.count({
        where: { tenantId, paidAt: null, waivedAt: null },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, returnedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.libraryVisit.findMany({
        where: { tenantId, exitAt: null },
        select: {
          id: true,
          memberType: true,
          studentId: true,
          staffProfileId: true,
          visitorId: true,
          entryAt: true,
          exitAt: true,
          durationMinutes: true,
          zoneId: true,
          seatLabel: true,
          entryMethod: true,
        },
      }),
    ]);

    const avgStayMinutes = completedToday.length
      ? Math.round(
          completedToday.reduce((s, v) => s + (v.durationMinutes ?? 0), 0) /
            completedToday.length,
        )
      : 0;

    const todayVisits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: startOfDay, lt: endOfDay } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    const enriched = await this.enrichVisits(tenantId, todayVisits);

    type ActivityRow = {
      at: string;
      action: 'IN' | 'OUT';
      memberName: string;
      department: string | null;
      memberType: string;
      photoUrl: string | null;
    };
    const recentActivity: ActivityRow[] = [];
    for (const v of enriched) {
      recentActivity.push({
        at: v.entryAt.toISOString(),
        action: 'IN',
        memberName: v.memberName,
        department: v.department,
        memberType: v.memberType,
        photoUrl: v.photoUrl ?? null,
      });
      if (v.exitAt) {
        recentActivity.push({
          at: v.exitAt.toISOString(),
          action: 'OUT',
          memberName: v.memberName,
          department: v.department,
          memberType: v.memberType,
          photoUrl: v.photoUrl ?? null,
        });
      }
    }
    recentActivity.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    const footfallToday = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: startOfDay, lt: endOfDay } },
      select: { memberType: true, studentId: true, staffProfileId: true },
    });
    const footfallStudentIds = [
      ...new Set(footfallToday.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const footfallStaffIds = [
      ...new Set(footfallToday.map((v) => v.staffProfileId).filter(Boolean)),
    ] as string[];
    const [footfallStudents, footfallStaff] = await Promise.all([
      footfallStudentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: footfallStudentIds } },
            include: { masterProfile: { select: { gender: true } } },
          })
        : [],
      footfallStaffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: footfallStaffIds } },
            select: { id: true, staffType: true, gender: true },
          })
        : [],
    ]);
    const genderMap = new Map(
      footfallStudents.map((s) => [
        s.id,
        s.masterProfile?.gender?.toUpperCase().startsWith('F') ? 'F' : 'M',
      ]),
    );
    const staffTypeMap = new Map(
      footfallStaff.map((s) => [
        s.id,
        s.staffType === 'TEACHING' ? 'TEACHING' : 'NON_TEACHING',
      ]),
    );

    let maleStudents = 0;
    let femaleStudents = 0;
    let staffTeaching = 0;
    let staffNonTeaching = 0;
    let guestVisitors = 0;
    for (const v of footfallToday) {
      if (v.memberType === 'STUDENT' && v.studentId) {
        const g = genderMap.get(v.studentId);
        if (g === 'F') femaleStudents += 1;
        else maleStudents += 1;
      } else if (
        (v.memberType === 'STAFF' || v.memberType === 'FACULTY') &&
        v.staffProfileId
      ) {
        const t = staffTypeMap.get(v.staffProfileId);
        if (t === 'TEACHING') staffTeaching += 1;
        else staffNonTeaching += 1;
      } else if (v.memberType === 'VISITOR') {
        guestVisitors += 1;
      }
    }

    const enrichedOpen = await this.enrichVisits(tenantId, openVisitsRaw);
    const deptMap = new Map<string, number>();
    let maleStaffInside = 0;
    let femaleStaffInside = 0;
    for (const v of enrichedOpen) {
      const dept = v.department?.trim() || 'General';
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
    }
    const openStaffIds = [
      ...new Set(
        openVisitsRaw
          .filter((v) => v.memberType === 'STAFF' || v.memberType === 'FACULTY')
          .map((v) => v.staffProfileId)
          .filter(Boolean),
      ),
    ] as string[];
    if (openStaffIds.length) {
      const openStaff = await this.prisma.staffProfile.findMany({
        where: { tenantId, id: { in: openStaffIds } },
        select: { gender: true },
      });
      for (const s of openStaff) {
        if (s.gender?.toUpperCase().startsWith('F')) femaleStaffInside += 1;
        else maleStaffInside += 1;
      }
    }

    const peakBucket = occupancy.hourlyFootfall.reduce(
      (best, row) => (row.count > best.count ? row : best),
      { hour: 0, count: 0 },
    );
    const peakHour = peakBucket.count > 0 ? peakBucket.hour : null;

    const departmentInside = [...deptMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return {
      stats: {
        entriesToday,
        exitsToday,
        currentlyInside: occupancy.totalInside,
        visitorsToday: entriesToday,
        avgStayMinutes,
        scansToday: entriesToday + exitsToday,
        booksIssuedToday,
        booksReturnedToday,
        peakHour,
      },
      occupancy: {
        ...occupancy,
        maleStaffInside,
        femaleStaffInside,
      },
      visitorSummary: {
        maleStudents,
        femaleStudents,
        staffTeaching,
        staffNonTeaching,
        guestVisitors,
        totalFootfall: entriesToday,
      },
      recentActivity: recentActivity.slice(0, 12),
      departmentInside,
      alerts: [
        ...(overdueLoans > 0
          ? [
              {
                id: 'overdue',
                level: 'warn' as const,
                message: `${overdueLoans} books are overdue`,
                href: '/admin/library/circulation',
              },
            ]
          : []),
        ...(unpaidFinesCount > 0
          ? [
              {
                id: 'fines',
                level: 'warn' as const,
                message: `${unpaidFinesCount} unpaid library fines pending`,
                href: '/admin/library/circulation',
              },
            ]
          : []),
      ],
    };
  }
}
