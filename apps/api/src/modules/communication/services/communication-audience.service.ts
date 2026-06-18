import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type ResolvedRecipient = {
  recipientType: 'STUDENT' | 'PARENT' | 'FACULTY' | 'USER';
  userId?: string;
  studentId?: string;
  staffProfileId?: string;
  displayName: string;
  email?: string;
  phone?: string;
};

type AudienceFilter = {
  departmentIds?: string[];
  programVersionIds?: string[];
  userIds?: string[];
  studentIds?: string[];
  staffProfileIds?: string[];
  semesterIds?: string[];
  sectionIds?: string[];
  batchIds?: string[];
  shiftIds?: string[];
  gender?: string;
  hosteller?: boolean;
  dayScholar?: boolean;
  attendanceBelowPct?: number;
  feeDue?: boolean;
  defaulters?: boolean;
  designationIds?: string[];
  committeeIds?: string[];
  teaching?: boolean;
  nonTeaching?: boolean;
  permanent?: boolean;
  contract?: boolean;
};

@Injectable()
export class CommunicationAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    tenantId: string,
    audienceType: string,
    audienceFilter: AudienceFilter = {},
  ): Promise<ResolvedRecipient[]> {
    switch (audienceType) {
      case 'STUDENTS':
        return this.resolveStudents(tenantId, audienceFilter);
      case 'PARENTS':
        return this.resolveParents(tenantId, audienceFilter);
      case 'FACULTY':
        return this.resolveFaculty(tenantId, audienceFilter);
      case 'DEPARTMENTS':
        return this.resolveDepartments(tenantId, audienceFilter);
      case 'INDIVIDUAL':
        return this.resolveIndividuals(tenantId, audienceFilter);
      case 'COMMITTEE':
        return this.resolveCommittee(tenantId, audienceFilter);
      default:
        return [];
    }
  }

  private dedupe(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((r) => {
      const key =
        r.userId ?? `${r.recipientType}:${r.email ?? r.phone ?? r.displayName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async resolveStudents(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };
    if (filter.departmentIds?.length)
      where.departmentId = { in: filter.departmentIds };
    if (filter.programVersionIds?.length)
      where.programVersionId = { in: filter.programVersionIds };
    if (filter.studentIds?.length) where.id = { in: filter.studentIds };
    if (filter.shiftIds?.length) where.primaryShiftId = { in: filter.shiftIds };
    if (filter.semesterIds?.length) {
      where.semesterRegistrations = {
        some: { semesterId: { in: filter.semesterIds } },
      };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            displayName: true,
            isActive: true,
          },
        },
        masterProfile: {
          select: {
            fullName: true,
            email: true,
            mobileNumber: true,
            gender: true,
          },
        },
      },
      take: 5000,
    });

    let filtered = students.filter((s) => s.user.isActive);
    if (filter.gender) {
      filtered = filtered.filter(
        (s) =>
          s.masterProfile?.gender?.toLowerCase() ===
          filter.gender?.toLowerCase(),
      );
    }
    if (filter.feeDue || filter.defaulters) {
      const ids = filtered.map((s) => s.id);
      const defaulters = await this.prisma.studentFeeDemand.findMany({
        where: {
          tenantId,
          studentId: { in: ids },
          balanceAmount: { gt: 0 },
          status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      const defaulterSet = new Set(defaulters.map((d) => d.studentId));
      filtered = filtered.filter((s) => defaulterSet.has(s.id));
    }

    return this.dedupe(
      filtered.map((s) => ({
        recipientType: 'STUDENT' as const,
        userId: s.userId,
        studentId: s.id,
        displayName:
          s.masterProfile?.fullName ?? s.user.displayName ?? s.user.email,
        email: s.masterProfile?.email ?? s.user.email,
        phone: s.masterProfile?.mobileNumber ?? s.user.phone ?? undefined,
      })),
    );
  }

  private async resolveParents(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const studentWhere: Record<string, unknown> = { tenantId, deletedAt: null };
    if (filter.departmentIds?.length)
      studentWhere.departmentId = { in: filter.departmentIds };
    if (filter.studentIds?.length) studentWhere.id = { in: filter.studentIds };

    const guardians = await this.prisma.studentGuardian.findMany({
      where: {
        tenantId,
        student: studentWhere,
        contactNumber: { not: null },
      },
      include: {
        student: {
          include: {
            masterProfile: { select: { fullName: true } },
          },
        },
      },
      take: 5000,
    });

    return this.dedupe(
      guardians.map((g) => ({
        recipientType: 'PARENT' as const,
        displayName:
          g.fullName ??
          `Parent of ${g.student.masterProfile?.fullName ?? 'Student'}`,
        phone: g.contactNumber ?? undefined,
        studentId: g.studentId,
      })),
    );
  }

  private async resolveFaculty(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      status: 'ACTIVE',
    };
    if (filter.departmentIds?.length)
      where.departmentId = { in: filter.departmentIds };
    if (filter.staffProfileIds?.length)
      where.id = { in: filter.staffProfileIds };

    const staff = await this.prisma.staffProfile.findMany({
      where,
      include: {
        portalUser: {
          select: {
            id: true,
            email: true,
            phone: true,
            displayName: true,
            isActive: true,
          },
        },
      },
      take: 2000,
    });

    return this.dedupe(
      staff.map((s) => ({
        recipientType: 'FACULTY' as const,
        userId: s.portalUserId ?? undefined,
        staffProfileId: s.id,
        displayName: s.fullName,
        email: s.email ?? s.portalUser?.email ?? undefined,
        phone: s.mobile ?? s.portalUser?.phone ?? undefined,
      })),
    );
  }

  private async resolveDepartments(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const departmentIds = filter.departmentIds ?? [];
    if (!departmentIds.length) return [];

    const [students, faculty] = await Promise.all([
      this.resolveStudents(tenantId, { departmentIds }),
      this.resolveFaculty(tenantId, { departmentIds }),
    ]);
    return this.dedupe([...students, ...faculty]);
  }

  private async resolveIndividuals(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const userIds = filter.userIds ?? [];
    if (!userIds.length) return [];

    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: userIds }, isActive: true, deletedAt: null },
      include: {
        student: { select: { id: true } },
        staffProfile: { select: { id: true } },
      },
    });

    return users.map((u) => ({
      recipientType: u.student
        ? 'STUDENT'
        : u.staffProfile
          ? 'FACULTY'
          : 'USER',
      userId: u.id,
      studentId: u.student?.id,
      staffProfileId: u.staffProfile?.id,
      displayName: u.displayName ?? u.email,
      email: u.email,
      phone: u.phone ?? undefined,
    }));
  }

  private async resolveCommittee(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const committeeIds = filter.committeeIds ?? [];
    if (!committeeIds.length) return [];

    const members = await this.prisma.governanceCommitteeMember.findMany({
      where: {
        tenantId,
        committeeId: { in: committeeIds },
        status: 'ACTIVE',
      },
      take: 500,
    });

    const staffIds = members
      .map((m) => m.staffProfileId)
      .filter((id): id is string => Boolean(id));

    const staffMap = new Map(
      (
        await this.prisma.staffProfile.findMany({
          where: { tenantId, id: { in: staffIds } },
          include: {
            portalUser: {
              select: { id: true, email: true, phone: true, displayName: true },
            },
          },
        })
      ).map((s) => [s.id, s]),
    );

    return this.dedupe(
      members.map((m) => {
        const staff = m.staffProfileId ? staffMap.get(m.staffProfileId) : null;
        return {
          recipientType: 'FACULTY' as const,
          userId: staff?.portalUserId ?? m.userId ?? undefined,
          staffProfileId: m.staffProfileId ?? undefined,
          displayName: staff?.fullName ?? m.displayName,
          email:
            staff?.email ?? m.email ?? staff?.portalUser?.email ?? undefined,
          phone:
            staff?.mobile ?? m.mobile ?? staff?.portalUser?.phone ?? undefined,
        };
      }),
    );
  }
}
