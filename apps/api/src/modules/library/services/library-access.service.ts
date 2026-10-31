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
import type { ScanAccessDto, VisitQueryDto } from '../dto/library.dto';
import {
  decideLibraryScan,
  memberTypeWhere,
  mergeAccessDeskSettings,
  pickActiveOpenVisit,
  previousRange,
  startOfDay,
  visitPresentation,
  visitRange,
} from '../library-visit.logic';
import { LibraryAnalyticsService } from './library-analytics.service';
import {
  LibraryMemberLookupService,
  type LibraryMemberProfile,
} from './library-member-lookup.service';
import { LibraryQrService } from './library-qr.service';
import { LibrarySettingsService } from './library-settings.service';
import { LibraryZonesService } from './library-zones.service';

export type ScanResult = {
  action: 'ENTRY' | 'EXIT' | 'IGNORED' | 'TOO_SOON';
  message?: string;
  remainingSeconds?: number;
  voice?: {
    text: string;
    voiceName: string;
    rate: number;
    volume: number;
  } | null;
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

  private memberVisitWhere(tenantId: string, profile: LibraryMemberProfile) {
    if (profile.memberType === 'STUDENT') {
      return {
        tenantId,
        memberType: 'STUDENT' as const,
        studentId: profile.studentId!,
      };
    }
    if (profile.memberType === 'VISITOR') {
      return {
        tenantId,
        memberType: 'VISITOR' as const,
        visitorId: profile.visitorId!,
      };
    }
    return {
      tenantId,
      memberType: profile.memberType,
      staffProfileId: profile.staffProfileId!,
    };
  }

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
    const desk = mergeAccessDeskSettings(settings.accessDeskSettings);
    await this.analytics.closeStaleOpenVisits(tenantId);

    const lockKey = `${tenantId}:${profile.studentId ?? profile.staffProfileId ?? profile.visitorId ?? profile.memberId}`;
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const openRows = await tx.libraryVisit.findMany({
        where: this.openVisitWhere(tenantId, profile),
        orderBy: { entryAt: 'desc' },
      });
      const openVisit = pickActiveOpenVisit(openRows);
      const latest = await tx.libraryVisit.findFirst({
        where: this.memberVisitWhere(tenantId, profile),
        orderBy: { entryAt: 'desc' },
      });
      const now = new Date();
      const decision = decideLibraryScan({
        memberType: profile.memberType,
        openEntryAt: openVisit?.entryAt ?? null,
        lastAcceptedAt: latest ? (latest.exitAt ?? latest.entryAt) : null,
        now,
        minStaySeconds: desk.minStaySeconds,
        duplicateWindowSeconds: desk.duplicateWindowSeconds,
      });

      if (!openVisit && decision.action === 'ENTRY' && !profile.active) {
        throw new BadRequestException(
          'Access restricted — library membership inactive or suspended',
        );
      }

      if (decision.action === 'IGNORED' || decision.action === 'TOO_SOON') {
        const held = openVisit ?? latest;
        if (!held) {
          throw new BadRequestException(decision.message);
        }
        return {
          action: decision.action,
          message: decision.message,
          remainingSeconds:
            decision.action === 'TOO_SOON'
              ? decision.remainingSeconds
              : undefined,
          visit: held,
          zone: null as ScanResult['zone'],
        };
      }

      if (decision.action === 'EXIT' && openVisit) {
        const durationMinutes = Math.max(
          1,
          Math.round((now.getTime() - openVisit.entryAt.getTime()) / 60_000),
        );
        const visit = await tx.libraryVisit.update({
          where: { id: openVisit.id },
          data: { exitAt: now, durationMinutes, exitMethod: 'SCAN' },
        });
        return {
          action: 'EXIT' as const,
          visit,
          zone: null as ScanResult['zone'],
        };
      }

      let zoneId: string | undefined = dto.zoneId;
      let seatLabel: string | undefined;
      let assignedZone: ScanResult['zone'] = null;
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
      const visit = await tx.libraryVisit.create({
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
      return { action: 'ENTRY' as const, visit, zone: assignedZone };
    });

    const action = outcome.action;
    const visit = outcome.visit;
    const assignedZone = outcome.zone;
    const occupancy = await this.analytics.getOccupancy(tenantId);
    const deskContext = await this.buildDeskContext(tenantId, profile);
    const speak =
      (action === 'ENTRY' || action === 'EXIT') &&
      profile.memberType === 'STUDENT' &&
      desk.voiceEnabled;
    const result: ScanResult = {
      action,
      message: 'message' in outcome ? outcome.message : undefined,
      remainingSeconds:
        'remainingSeconds' in outcome ? outcome.remainingSeconds : undefined,
      voice: speak
        ? {
            text: action === 'ENTRY' ? desk.entryText : desk.exitText,
            voiceName: desk.voiceName,
            rate: desk.speechRate,
            volume: desk.volume,
          }
        : null,
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

    if (action === 'ENTRY' || action === 'EXIT') {
      this.realtime.broadcastToTenant(
        tenantId,
        'library:occupancy:updated',
        occupancy,
      );
    }
    this.realtime.broadcastToTenant(tenantId, 'library:scan:result', result);

    return result;
  }

  async listVisits(tenantId: string, query: VisitQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const range = visitRange(query);
    const people = await this.peopleFilter(tenantId, query);
    const where = {
      tenantId,
      entryAt: { gte: range.from, lte: range.to },
      ...memberTypeWhere(query.memberType),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...people.where,
    };

    const [items, total, stats] = await Promise.all([
      people.empty
        ? Promise.resolve([])
        : this.prisma.libraryVisit.findMany({
            where,
            orderBy: { entryAt: 'desc' },
            skip,
            take: limit,
          }),
      people.empty
        ? Promise.resolve(0)
        : this.prisma.libraryVisit.count({ where }),
      this.visitStats(tenantId, range),
    ]);

    const enriched = await this.enrichVisits(tenantId, items);
    const from = skip + (total ? 1 : 0);
    const to = Math.min(skip + enriched.length, total);
    return { items: enriched, total, page, limit, from, to, range, stats };
  }

  async recordExit(tenantId: string, visitId: string) {
    const visit = await this.prisma.libraryVisit.findFirst({
      where: { tenantId, id: visitId },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.exitAt) {
      throw new BadRequestException('This visit already has an exit time.');
    }
    const exitAt = new Date();
    const durationMinutes = Math.max(
      0,
      Math.round((exitAt.getTime() - visit.entryAt.getTime()) / 60_000),
    );
    const updated = await this.prisma.libraryVisit.updateMany({
      where: { id: visit.id, tenantId, exitAt: null },
      data: { exitAt, durationMinutes, exitMethod: 'SCAN' },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('This visit already has an exit time.');
    }
    const saved = await this.prisma.libraryVisit.findFirstOrThrow({
      where: { id: visit.id },
    });
    const [row] = await this.enrichVisits(tenantId, [saved]);
    return row;
  }

  private async visitStats(tenantId: string, range: { from: Date; to: Date }) {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prior = previousRange(range);
    const [
      totalToday,
      yesterdayTotal,
      students,
      staff,
      visitors,
      currentAvg,
      previousAvg,
    ] = await Promise.all([
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          memberType: 'STUDENT',
          entryAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          memberType: { in: ['STAFF', 'FACULTY'] },
          entryAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          memberType: 'VISITOR',
          entryAt: { gte: today, lt: tomorrow },
        },
      }),
      this.averageStay(tenantId, range),
      this.averageStay(tenantId, prior),
    ]);
    const share = (value: number) =>
      totalToday > 0 ? Math.round((value / totalToday) * 100) : null;
    return {
      totalToday,
      yesterdayTotal,
      totalDeltaPct: this.deltaPct(totalToday, yesterdayTotal),
      students,
      studentSharePct: share(students),
      staff,
      staffSharePct: share(staff),
      visitors,
      visitorSharePct: share(visitors),
      averageDurationMinutes: currentAvg.average,
      completedVisits: currentAvg.count,
      previousAverageDurationMinutes: previousAvg.average,
      averageDeltaPct:
        previousAvg.count > 0
          ? this.deltaPct(currentAvg.average ?? 0, previousAvg.average ?? 0)
          : null,
    };
  }

  private async averageStay(tenantId: string, range: { from: Date; to: Date }) {
    const rows = await this.prisma.$queryRaw<
      { average: number | null; count: number }[]
    >`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (exit_at - entry_at)) / 60))::int AS average,
        COUNT(*)::int AS count
      FROM library.library_visits
      WHERE tenant_id = CAST(${tenantId} AS uuid)
        AND exit_at IS NOT NULL
        AND exit_at >= entry_at
        AND entry_at >= ${range.from}
        AND entry_at <= ${range.to}
    `;
    return { average: rows[0]?.average ?? null, count: rows[0]?.count ?? 0 };
  }

  private deltaPct(current: number, previous: number) {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async peopleFilter(tenantId: string, query: VisitQueryDto) {
    const search = query.search?.trim();
    if (!search && !query.departmentId) return { empty: false, where: {} };
    const studentWhere = {
      tenantId,
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(search
        ? {
            OR: [
              {
                enrollmentNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                rollNumber: { contains: search, mode: 'insensitive' as const },
              },
              {
                libraryCardNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                masterProfile: {
                  is: {
                    fullName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [students, staff, visitors] = await Promise.all([
      this.prisma.student.findMany({
        where: studentWhere,
        select: { id: true },
        take: 4_000,
      }),
      this.prisma.staffProfile.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { employeeCode: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true },
        take: 1_000,
      }),
      search && !query.departmentId
        ? this.prisma.libraryVisitor.findMany({
            where: {
              tenantId,
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { passNumber: { contains: search, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
            take: 500,
          })
        : Promise.resolve([]),
    ]);
    const or = [
      ...(students.length
        ? [{ studentId: { in: students.map((row) => row.id) } }]
        : []),
      ...(staff.length
        ? [{ staffProfileId: { in: staff.map((row) => row.id) } }]
        : []),
      ...(visitors.length
        ? [{ visitorId: { in: visitors.map((row) => row.id) } }]
        : []),
    ];
    if (!or.length) return { empty: true, where: {} };
    return { empty: false, where: { OR: or } };
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
        programme: student?.programVersion?.program?.name ?? null,
        semester: student?.academicStanding?.currentSemesterSequence ?? null,
        zoneName: zone?.name ?? null,
        purpose: visitor?.purpose ?? null,
        institution: visitor?.institution ?? null,
        ...visitPresentation(v.entryAt, v.exitAt, v.durationMinutes),
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

  async accessDeskDashboard(
    tenantId: string,
    period: 'today' | 'week' | 'month' = 'today',
  ) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const yesterdayStart = new Date(startOfDay);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const occupancy = await this.analytics.getOccupancy(tenantId);

    const [
      entriesToday,
      exitsToday,
      completedToday,
      overdueLoans,
      unpaidFinesCount,
      booksIssuedToday,
      booksReturnedToday,
      entriesYesterday,
      exitsYesterday,
      visitorsToday,
      visitorsYesterday,
      completedYesterday,
      autoSignedOutToday,
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
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: yesterdayStart, lt: startOfDay } },
      }),
      this.prisma.libraryVisit.count({
        where: { tenantId, exitAt: { gte: yesterdayStart, lt: startOfDay } },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          memberType: 'VISITOR',
          entryAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          memberType: 'VISITOR',
          entryAt: { gte: yesterdayStart, lt: startOfDay },
        },
      }),
      this.prisma.libraryVisit.findMany({
        where: {
          tenantId,
          exitAt: { gte: yesterdayStart, lt: startOfDay },
          durationMinutes: { not: null },
        },
        select: { durationMinutes: true },
      }),
      this.prisma.libraryVisit.count({
        where: {
          tenantId,
          exitMethod: 'AUTO',
          exitAt: { gte: startOfDay, lt: endOfDay },
        },
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
    const avgStayYesterday = completedYesterday.length
      ? Math.round(
          completedYesterday.reduce((s, v) => s + (v.durationMinutes ?? 0), 0) /
            completedYesterday.length,
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
        visitorsToday,
        avgStayMinutes,
        scansToday: entriesToday + exitsToday,
        booksIssuedToday,
        booksReturnedToday,
        peakHour,
        entriesChange: percentChange(entriesToday, entriesYesterday),
        exitsChange: percentChange(exitsToday, exitsYesterday),
        visitorsChange: percentChange(visitorsToday, visitorsYesterday),
        avgStayChange:
          completedYesterday.length > 0
            ? percentChange(avgStayMinutes, avgStayYesterday)
            : null,
        autoSignedOutToday,
      },
      footfallPeriod: period,
      footfall: await this.hourlyFootfall(tenantId, period),
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

  private async hourlyFootfall(
    tenantId: string,
    period: 'today' | 'week' | 'month',
  ) {
    const range = visitRange({ period });
    const [entries, exits] = await Promise.all([
      this.prisma.libraryVisit.findMany({
        where: { tenantId, entryAt: { gte: range.from, lte: range.to } },
        select: { entryAt: true },
      }),
      this.prisma.libraryVisit.findMany({
        where: { tenantId, exitAt: { gte: range.from, lte: range.to } },
        select: { exitAt: true },
      }),
    ]);
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      entries: entries.filter((row) => row.entryAt.getHours() === hour).length,
      exits: exits.filter((row) => row.exitAt && row.exitAt.getHours() === hour)
        .length,
    }));
  }
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
