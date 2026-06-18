import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GovernanceMemberService } from '../../governance/services/governance-member.service';
import { LibraryMemberLookupService } from '../../library/services/library-member-lookup.service';
import { StaffPortalService } from '../../staff/services/staff-portal.service';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class PrincipalStaffCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly staffPortal: StaffPortalService,
    private readonly governanceMembers: GovernanceMemberService,
  ) {}

  async resolve(tenantId: string, query: string) {
    const code = this.lookup.normalizeScanCode(query);
    if (!code) throw new NotFoundException('Search query required');

    let staffProfileId: string;
    try {
      const profile = await this.lookup.lookup(tenantId, code);
      if (profile.memberType !== 'STAFF' && profile.memberType !== 'FACULTY') {
        throw new NotFoundException('Staff not found');
      }
      if (!profile.staffProfileId)
        throw new NotFoundException('Staff not found');
      staffProfileId = profile.staffProfileId;
    } catch {
      const byName = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          fullName: { contains: code, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!byName) throw new NotFoundException(`No staff found for: ${code}`);
      staffProfileId = byName.id;
    }

    return this.buildCommandCard(tenantId, staffProfileId);
  }

  async buildCommandCard(tenantId: string, staffProfileId: string) {
    const today = startOfDay();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [staff, todaySchedule, attendanceRecords, leaves, committees] =
      await Promise.all([
        this.prisma.staffProfile.findFirst({
          where: { tenantId, id: staffProfileId, deletedAt: null },
          include: {
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        }),
        this.staffPortal.getTodaySchedule(tenantId, staffProfileId),
        this.prisma.staffAttendanceDailyRecord.findMany({
          where: {
            tenantId,
            staffProfileId,
            attendanceDate: { gte: monthStart, lte: today },
          },
        }),
        this.prisma.staffLeaveApplication.findMany({
          where: { tenantId, staffProfileId },
          include: {
            leaveType: { select: { code: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.governanceMembers.listByStaff(tenantId, staffProfileId),
      ]);

    if (!staff) throw new NotFoundException('Staff not found');

    let presentDays = 0;
    let absentDays = 0;
    let lateArrivals = 0;
    let earlyExits = 0;
    let workingMinutes = 0;

    for (const row of attendanceRecords) {
      const status = String(row.status ?? '').toUpperCase();
      if (['PRESENT', 'LATE', 'HALF_DAY', 'ON_DUTY'].includes(status)) {
        presentDays += 1;
      }
      if (status === 'ABSENT') absentDays += 1;
      if (status === 'LATE') lateArrivals += 1;
      if (row.earlyMinutes && Number(row.earlyMinutes) > 0) {
        earlyExits += 1;
      }
      workingMinutes += Number(row.workedMinutes ?? 0);
    }

    const pendingLeaves = leaves.filter((l: { status: string }) =>
      ['PENDING', 'HOD_APPROVED'].includes(l.status),
    );
    const approvedLeaves = leaves.filter(
      (l: { status: string }) => l.status === 'APPROVED',
    );
    const rejectedLeaves = leaves.filter(
      (l: { status: string }) => l.status === 'REJECTED',
    );

    return {
      staffProfileId,
      profile: {
        photoUrl: staff.photoUrl,
        fullName: staff.fullName,
        employeeCode: staff.employeeCode,
        department: staff.department?.name ?? null,
        designation: staff.designation?.label ?? null,
        joiningDate: staff.joiningDate,
        staffType: staff.staffType,
        status: staff.status,
      },
      attendanceSummary: {
        presentDays,
        absentDays,
        lateArrivals,
        earlyExits,
        workingHours: Math.round(workingMinutes / 60),
        monthLabel: today.toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric',
        }),
      },
      todaySchedule: todaySchedule.map(
        (
          slot: {
            subject: string;
            classroom?: string | null;
            startTime: string;
            endTime: string;
            sectionCode?: string | null;
          },
          idx: number,
        ) => ({
          period: idx + 1,
          subject: slot.subject,
          room: slot.classroom,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sectionCode: slot.sectionCode,
        }),
      ),
      leave: {
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
      },
      committees: committees.map((c: Record<string, unknown>) => ({
        id: c.id,
        committeeName:
          (c.committeeName as string | undefined) ??
          (c.committee as { name?: string } | undefined)?.name ??
          null,
        role: c.role,
        memberType: c.memberType,
        status: c.status,
      })),
      scannedAt: new Date().toISOString(),
    };
  }
}
