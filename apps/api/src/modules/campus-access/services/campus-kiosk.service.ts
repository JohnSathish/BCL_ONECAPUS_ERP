import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LibraryAccessService } from '../../library/services/library-access.service';
import { LibraryMemberLookupService } from '../../library/services/library-member-lookup.service';
import { AccessPointService } from './access-point.service';
import { CampusAccessDashboardService } from './campus-access-dashboard.service';

export type KioskMemberSnapshot = {
  fullName: string;
  photoUrl?: string | null;
  enrollmentNumber?: string | null;
  programme?: string | null;
  semester?: number | null;
  mobile?: string | null;
  gender?: string | null;
  status: string;
  memberType: string;
  hosteller?: boolean;
  libraryMembership?: string | null;
  booksBorrowed?: number;
  booksDue?: number;
  outstandingFine?: number;
};

export type KioskScanResponse = {
  allowed: boolean;
  direction: 'IN' | 'OUT' | 'NONE';
  denialReason?: string;
  member?: KioskMemberSnapshot;
  scannedAt: string;
  voiceMessage?: string;
  stats: Awaited<ReturnType<CampusAccessDashboardService['getLiveStats']>>;
};

@Injectable()
export class CampusKioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPoints: AccessPointService,
    private readonly dashboard: CampusAccessDashboardService,
    private readonly libraryAccess: LibraryAccessService,
    private readonly libraryLookup: LibraryMemberLookupService,
  ) {}

  async bootstrap(code: string, token: string) {
    const device = await this.accessPoints.resolveKioskContext(code, token);
    await this.accessPoints.touchDevice(device.id);
    const stats = await this.dashboard.getLiveStats(
      device.tenantId,
      device.accessPointId,
    );
    const branding = await this.prisma.tenantBranding.findFirst({
      where: { tenantId: device.tenantId },
      select: { displayName: true, logoUrl: true },
    });
    return {
      accessPoint: {
        id: device.accessPoint.id,
        code: device.accessPoint.code,
        name: device.accessPoint.name,
        accessType: device.accessPoint.accessType,
        location: device.accessPoint.location,
        voiceEnabled: device.accessPoint.voiceEnabled,
      },
      institutionName: branding?.displayName ?? 'Campus',
      logoUrl: branding?.logoUrl ?? null,
      stats,
    };
  }

  async live(code: string, token: string) {
    const device = await this.accessPoints.resolveKioskContext(code, token);
    await this.accessPoints.touchDevice(device.id);
    return this.dashboard.getLiveStats(device.tenantId, device.accessPointId);
  }

  async scan(
    code: string,
    token: string,
    scanCode: string,
  ): Promise<KioskScanResponse> {
    const device = await this.accessPoints.resolveKioskContext(code, token);
    await this.accessPoints.touchDevice(device.id);
    const point = device.accessPoint;
    const tenantId = device.tenantId;
    const stats = await this.dashboard.getLiveStats(tenantId, point.id);
    const scannedAt = new Date();

    if (point.accessType === 'LIBRARY') {
      return this.scanLibrary(tenantId, point, scanCode, scannedAt, stats);
    }

    return this.scanGeneric(tenantId, point, scanCode, scannedAt, stats);
  }

  private async scanLibrary(
    tenantId: string,
    point: {
      id: string;
      blockOnFine: boolean;
      blockInactive: boolean;
      voiceEnabled: boolean;
    },
    scanCode: string,
    scannedAt: Date,
    stats: Awaited<ReturnType<CampusAccessDashboardService['getLiveStats']>>,
  ): Promise<KioskScanResponse> {
    let profile;
    try {
      profile = await this.libraryLookup.lookup(tenantId, scanCode);
    } catch {
      throw new NotFoundException('No member found for this scan code');
    }

    const libraryExtras = await this.libraryMemberExtras(tenantId, profile);
    const member = this.toMemberSnapshot(profile, libraryExtras);

    if (point.blockInactive && !profile.active) {
      await this.writeLog(tenantId, point.id, {
        direction: 'NONE',
        allowed: false,
        denialReason: 'Student inactive',
        profile,
        scanCode,
      });
      return {
        allowed: false,
        direction: 'NONE',
        denialReason: 'Student Inactive',
        member,
        scannedAt: scannedAt.toISOString(),
        voiceMessage: point.voiceEnabled
          ? 'Entry denied. Student inactive.'
          : undefined,
        stats,
      };
    }

    if (
      point.blockOnFine &&
      libraryExtras.outstandingFine != null &&
      libraryExtras.outstandingFine > 0
    ) {
      await this.writeLog(tenantId, point.id, {
        direction: 'NONE',
        allowed: false,
        denialReason: 'Outstanding library fine',
        profile,
        scanCode,
        metadata: libraryExtras,
      });
      return {
        allowed: false,
        direction: 'NONE',
        denialReason: 'Outstanding Library Fine — contact librarian',
        member,
        scannedAt: scannedAt.toISOString(),
        voiceMessage: point.voiceEnabled
          ? 'Entry denied. Outstanding library fine.'
          : undefined,
        stats,
      };
    }

    const result = await this.libraryAccess.scan(tenantId, { scanCode });
    const direction = result.action === 'ENTRY' ? 'IN' : 'OUT';
    await this.writeLog(tenantId, point.id, {
      direction,
      allowed: true,
      profile,
      scanCode,
      entryMethod: result.visit.entryMethod ?? 'SCAN',
      metadata: libraryExtras,
    });

    const voiceMessage =
      point.voiceEnabled && direction === 'IN'
        ? `Welcome ${profile.fullName}`
        : point.voiceEnabled && direction === 'OUT'
          ? `Thank you ${profile.fullName}`
          : undefined;

    return {
      allowed: true,
      direction,
      member,
      scannedAt: scannedAt.toISOString(),
      voiceMessage,
      stats: result.occupancy
        ? {
            ...stats,
            studentsInside: {
              male: result.occupancy.maleStudents,
              female: result.occupancy.femaleStudents,
              total:
                result.occupancy.maleStudents + result.occupancy.femaleStudents,
            },
            currentlyInside: result.occupancy.totalInside,
          }
        : stats,
    };
  }

  private async scanGeneric(
    tenantId: string,
    point: {
      id: string;
      blockInactive: boolean;
      voiceEnabled: boolean;
    },
    scanCode: string,
    scannedAt: Date,
    stats: Awaited<ReturnType<CampusAccessDashboardService['getLiveStats']>>,
  ): Promise<KioskScanResponse> {
    let profile;
    try {
      profile = await this.libraryLookup.lookup(tenantId, scanCode);
    } catch {
      throw new NotFoundException('No member found for this scan code');
    }

    const member = this.toMemberSnapshot(profile, {});

    if (point.blockInactive && !profile.active) {
      await this.writeLog(tenantId, point.id, {
        direction: 'NONE',
        allowed: false,
        denialReason: 'Student inactive',
        profile,
        scanCode,
      });
      return {
        allowed: false,
        direction: 'NONE',
        denialReason: 'Student Inactive',
        member,
        scannedAt: scannedAt.toISOString(),
        stats,
      };
    }

    const open = await this.prisma.entryExitLog.findFirst({
      where: {
        tenantId,
        accessPointId: point.id,
        allowed: true,
        direction: 'IN',
        OR: [
          profile.studentId ? { studentId: profile.studentId } : undefined,
          profile.staffProfileId
            ? { staffProfileId: profile.staffProfileId }
            : undefined,
          profile.visitorId ? { visitorId: profile.visitorId } : undefined,
        ].filter(Boolean) as object[],
      },
      orderBy: { scannedAt: 'desc' },
    });

    const hasOpen =
      open &&
      !(await this.prisma.entryExitLog.findFirst({
        where: {
          tenantId,
          accessPointId: point.id,
          allowed: true,
          direction: 'OUT',
          scannedAt: { gt: open.scannedAt },
          OR: [
            profile.studentId ? { studentId: profile.studentId } : undefined,
            profile.staffProfileId
              ? { staffProfileId: profile.staffProfileId }
              : undefined,
            profile.visitorId ? { visitorId: profile.visitorId } : undefined,
          ].filter(Boolean) as object[],
        },
      }));

    const direction: 'IN' | 'OUT' = hasOpen ? 'OUT' : 'IN';
    await this.writeLog(tenantId, point.id, {
      direction,
      allowed: true,
      profile,
      scanCode,
    });

    return {
      allowed: true,
      direction,
      member,
      scannedAt: scannedAt.toISOString(),
      voiceMessage:
        point.voiceEnabled && direction === 'IN'
          ? `Welcome ${profile.fullName}`
          : point.voiceEnabled
            ? `Thank you ${profile.fullName}`
            : undefined,
      stats,
    };
  }

  private async libraryMemberExtras(
    tenantId: string,
    profile: Awaited<ReturnType<LibraryMemberLookupService['lookup']>>,
  ) {
    if (!profile.studentId && !profile.staffProfileId) {
      return {
        booksBorrowed: 0,
        booksDue: 0,
        outstandingFine: 0,
        libraryMembership:
          profile.memberType === 'VISITOR' ? 'VISITOR' : 'ACTIVE',
        hosteller: false,
        mobile: null as string | null,
      };
    }

    const loans = await this.prisma.libraryLoan.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'OVERDUE'] },
        OR: [
          profile.studentId ? { studentId: profile.studentId } : undefined,
          profile.staffProfileId
            ? { staffProfileId: profile.staffProfileId }
            : undefined,
        ].filter(Boolean) as object[],
      },
      select: { dueAt: true },
    });
    const now = new Date();
    const booksDue = loans.filter((l) => l.dueAt < now).length;

    const memberLoans = await this.prisma.libraryLoan.findMany({
      where: {
        tenantId,
        OR: [
          profile.studentId ? { studentId: profile.studentId } : undefined,
          profile.staffProfileId
            ? { staffProfileId: profile.staffProfileId }
            : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true },
    });
    const loanIds = memberLoans.map((l) => l.id);
    const fines = loanIds.length
      ? await this.prisma.libraryFine.findMany({
          where: {
            tenantId,
            loanId: { in: loanIds },
            paidAt: null,
            waivedAt: null,
          },
          select: { amount: true },
        })
      : [];
    const outstandingFine = fines.reduce((sum, f) => sum + Number(f.amount), 0);

    let mobile: string | null = null;
    let hosteller = false;
    if (profile.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: profile.studentId },
        include: {
          masterProfile: { select: { mobileNumber: true } },
          academicProfile: { select: { hostelBlock: true } },
        },
      });
      mobile = student?.masterProfile?.mobileNumber ?? null;
      hosteller = Boolean(student?.academicProfile?.hostelBlock);
    }

    return {
      booksBorrowed: loans.length,
      booksDue,
      outstandingFine,
      libraryMembership: 'ACTIVE',
      hosteller,
      mobile,
    };
  }

  private toMemberSnapshot(
    profile: Awaited<ReturnType<LibraryMemberLookupService['lookup']>>,
    extras: {
      booksBorrowed?: number;
      booksDue?: number;
      outstandingFine?: number;
      libraryMembership?: string | null;
      hosteller?: boolean;
      mobile?: string | null;
    },
  ): KioskMemberSnapshot {
    return {
      fullName: profile.fullName,
      photoUrl: profile.photoUrl,
      enrollmentNumber: profile.registrationNumber ?? null,
      programme: profile.programme ?? null,
      semester: profile.semester ?? null,
      mobile: extras.mobile ?? null,
      gender: profile.gender ?? null,
      status: profile.status,
      memberType: profile.memberType,
      hosteller: extras.hosteller ?? false,
      libraryMembership: extras.libraryMembership ?? null,
      booksBorrowed: extras.booksBorrowed,
      booksDue: extras.booksDue,
      outstandingFine: extras.outstandingFine,
    };
  }

  private writeLog(
    tenantId: string,
    accessPointId: string,
    input: {
      direction: 'IN' | 'OUT' | 'NONE';
      allowed: boolean;
      denialReason?: string;
      profile: Awaited<ReturnType<LibraryMemberLookupService['lookup']>>;
      scanCode: string;
      entryMethod?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.entryExitLog.create({
      data: {
        tenantId,
        accessPointId,
        direction: input.direction === 'NONE' ? 'IN' : input.direction,
        allowed: input.allowed,
        denialReason: input.denialReason ?? null,
        memberType: input.profile.memberType,
        studentId: input.profile.studentId ?? null,
        staffProfileId: input.profile.staffProfileId ?? null,
        visitorId: input.profile.visitorId ?? null,
        displayName: input.profile.fullName,
        enrollmentNumber: input.profile.registrationNumber ?? null,
        programme: input.profile.programme ?? null,
        department: input.profile.department ?? null,
        scanCode: input.scanCode.trim(),
        entryMethod: input.entryMethod ?? 'SCAN',
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
  }
}
