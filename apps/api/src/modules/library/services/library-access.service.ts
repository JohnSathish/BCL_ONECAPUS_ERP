import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
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
    const settings = await this.settings.getSettings(tenantId);
    if (entryMethod === 'QR' && !settings.qrEntryEnabled) {
      throw new BadRequestException('QR entry is disabled');
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
        zoneName: zone?.name ?? null,
      };
    });
  }
}
