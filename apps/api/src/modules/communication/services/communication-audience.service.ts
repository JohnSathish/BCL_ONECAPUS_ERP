import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

export type AudienceFilter = {
  departmentIds?: string[];
  programVersionIds?: string[];
  /** @deprecated Do not use for student targeting — institutional setting only. Ignored. */
  academicYearIds?: string[];
  userIds?: string[];
  studentIds?: string[];
  excludeStudentIds?: string[];
  staffProfileIds?: string[];
  /** @deprecated Calendar semester UUIDs — prefer semesterSequences. */
  semesterIds?: string[];
  /**
   * Programme semester sequences (1–8) for the active cycle.
   * Resolves via StudentAcademicStanding.currentSemesterSequence.
   */
  semesterSequences?: number[];
  sectionIds?: string[];
  /** Admission batch IDs (permanent cohort). Prefer admissionBatchIds. */
  batchIds?: string[];
  admissionBatchIds?: string[];
  shiftIds?: string[];
  gender?: string;
  studentStatus?: string;
  admissionCategory?: string;
  residenceType?: string;
  hosteller?: boolean;
  dayScholar?: boolean;
  attendanceBelowPct?: number;
  attendanceAbovePct?: number;
  feeDue?: boolean;
  defaulters?: boolean;
  feeStatus?: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'DEFAULTERS';
  rollNumberFrom?: string;
  rollNumberTo?: string;
  designationIds?: string[];
  committeeIds?: string[];
  teaching?: boolean;
  nonTeaching?: boolean;
  permanent?: boolean;
  contract?: boolean;
};

export type AudienceCountResult = {
  total: number;
  byAudienceType: Record<string, number>;
  withEmail: number;
  withPhone: number;
};

export type AudienceContext = {
  institutionId: string | null;
  activeAcademicYear: { id: string; name: string; status: string } | null;
  currentCycle: 'ODD' | 'EVEN';
  currentSemesterSequences: number[];
  admissionBatches: {
    id: string;
    batchCode: string;
    admissionYear: number;
    currentSemester: number;
    label: string;
  }[];
};

const OPEN_DEMAND_STATUSES = ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] as const;
const ACTIVE_STUDENT_LIFECYCLES = ['ACTIVE', 'DETAINED'] as const;

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
      case 'ALUMNI':
        return this.resolveStudents(tenantId, {
          ...audienceFilter,
          studentStatus: audienceFilter.studentStatus || 'ALUMNI',
        });
      case 'APPLICANTS':
        return [];
      case 'PARENTS':
        return this.resolveParents(tenantId, audienceFilter);
      case 'FACULTY':
        return this.resolveFaculty(tenantId, audienceFilter);
      case 'TEACHING_STAFF':
        return this.resolveFaculty(tenantId, {
          ...audienceFilter,
          teaching: true,
        });
      case 'NON_TEACHING_STAFF':
        return this.resolveFaculty(tenantId, {
          ...audienceFilter,
          nonTeaching: true,
        });
      case 'DEPARTMENTS':
        return this.resolveDepartments(tenantId, audienceFilter);
      case 'INDIVIDUAL':
        return this.resolveIndividuals(tenantId, audienceFilter);
      case 'COMMITTEE':
        return this.resolveCommittee(tenantId, audienceFilter);
      case 'ALL_USERS': {
        const [students, faculty, parents] = await Promise.all([
          this.resolveStudents(tenantId, audienceFilter),
          this.resolveFaculty(tenantId, audienceFilter),
          this.resolveParents(tenantId, audienceFilter),
        ]);
        return this.dedupe([...students, ...faculty, ...parents]);
      }
      default:
        return [];
    }
  }

  async count(
    tenantId: string,
    audienceType: string,
    audienceFilter: AudienceFilter = {},
  ): Promise<AudienceCountResult> {
    const recipients = await this.resolve(
      tenantId,
      audienceType,
      audienceFilter,
    );
    const byAudienceType: Record<string, number> = {};
    let withEmail = 0;
    let withPhone = 0;
    for (const r of recipients) {
      byAudienceType[r.recipientType] =
        (byAudienceType[r.recipientType] ?? 0) + 1;
      if (r.email?.trim()) withEmail += 1;
      if (r.phone?.trim()) withPhone += 1;
    }
    return {
      total: recipients.length,
      byAudienceType,
      withEmail,
      withPhone,
    };
  }

  /**
   * Context for Communication Center filters — driven by the academic engine,
   * not by picking an academic year as a student attribute.
   */
  async getAudienceContext(tenantId: string): Promise<AudienceContext> {
    const institution = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!institution) {
      return {
        institutionId: null,
        activeAcademicYear: null,
        currentCycle: 'ODD',
        currentSemesterSequences: [1, 3, 5, 7],
        admissionBatches: [],
      };
    }

    const [config, activeYear, batches, activeSemesters] = await Promise.all([
      this.prisma.institutionAcademicConfig.findUnique({
        where: { institutionId: institution.id },
        select: { currentCycle: true, maxActiveSemesters: true },
      }),
      this.prisma.academicYear.findFirst({
        where: {
          tenantId,
          institutionId: institution.id,
          deletedAt: null,
          OR: [{ isPrimarySession: true }, { status: 'ACTIVE' }],
        },
        orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
        select: { id: true, name: true, status: true },
      }),
      this.prisma.admissionBatch.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        orderBy: { admissionYear: 'desc' },
        select: {
          id: true,
          batchCode: true,
          admissionYear: true,
          currentSemester: true,
        },
        take: 50,
      }),
      this.prisma.semester.findMany({
        where: {
          tenantId,
          institutionId: institution.id,
          deletedAt: null,
          isActive: true,
          status: 'ACTIVE',
        },
        select: { semesterNumber: true },
        orderBy: { semesterNumber: 'asc' },
      }),
    ]);

    const cycle =
      config?.currentCycle?.toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
    const maxSem = config?.maxActiveSemesters ?? 8;
    const cycleSequences = cycle === 'EVEN' ? [2, 4, 6, 8] : [1, 3, 5, 7];
    const fromActive = activeSemesters
      .map((s) => s.semesterNumber)
      .filter((n) => n >= 1 && n <= maxSem);
    const currentSemesterSequences = (
      fromActive.length ? fromActive : cycleSequences
    ).filter((n) => n <= maxSem);

    return {
      institutionId: institution.id,
      activeAcademicYear: activeYear,
      currentCycle: cycle,
      currentSemesterSequences: [...new Set(currentSemesterSequences)].sort(
        (a, b) => a - b,
      ),
      admissionBatches: batches.map((b) => ({
        id: b.id,
        batchCode: b.batchCode,
        admissionYear: b.admissionYear,
        currentSemester: b.currentSemester,
        label: `${b.admissionYear} Batch`,
      })),
    };
  }

  private dedupe(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((r) => {
      const key =
        r.userId ??
        `${r.recipientType}:${r.studentId ?? r.staffProfileId ?? r.email ?? r.phone ?? r.displayName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async buildStudentWhere(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<Prisma.StudentWhereInput> {
    const and: Prisma.StudentWhereInput[] = [];
    const where: Prisma.StudentWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (filter.departmentIds?.length) {
      // Directory "Major" is usually major-subject department, not students.department_id
      // (most FYUGP rows leave home department null). Match home dept, major track,
      // and MAJOR program choices (by department id or subject slug).
      const majorSubjects = await this.prisma.academicSubject.findMany({
        where: {
          tenantId,
          deletedAt: null,
          departmentId: { in: filter.departmentIds },
        },
        select: { slug: true },
      });
      const majorSlugs = [
        ...new Set(majorSubjects.map((s) => s.slug).filter(Boolean)),
      ];

      const deptOr: Prisma.StudentWhereInput[] = [
        { departmentId: { in: filter.departmentIds } },
        {
          majorMinorTrack: {
            majorSubject: {
              departmentId: { in: filter.departmentIds },
              deletedAt: null,
            },
          },
        },
        {
          programChoices: {
            some: {
              choiceType: 'MAJOR',
              status: 'active',
              deletedAt: null,
              departmentId: { in: filter.departmentIds },
            },
          },
        },
      ];
      if (majorSlugs.length) {
        deptOr.push({
          programChoices: {
            some: {
              choiceType: 'MAJOR',
              status: 'active',
              deletedAt: null,
              subjectSlug: { in: majorSlugs },
            },
          },
        });
      }
      and.push({ OR: deptOr });
    }
    if (filter.programVersionIds?.length) {
      where.programVersionId = { in: filter.programVersionIds };
    }
    if (filter.studentIds?.length || filter.excludeStudentIds?.length) {
      const idFilter: Prisma.StringFilter<'Student'> = {};
      if (filter.studentIds?.length) idFilter.in = filter.studentIds;
      if (filter.excludeStudentIds?.length) {
        idFilter.notIn = filter.excludeStudentIds;
      }
      where.id = idFilter;
    }

    if (filter.shiftIds?.length) {
      and.push({
        OR: [
          { primaryShiftId: { in: filter.shiftIds } },
          {
            academicProfile: {
              preferredShiftId: { in: filter.shiftIds },
            },
          },
        ],
      });
    }

    const sequences = (filter.semesterSequences ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);

    const batchIds = [
      ...(filter.admissionBatchIds ?? []),
      ...(filter.batchIds ?? []),
    ].filter(Boolean);
    const uniqueBatchIds = [...new Set(batchIds)];

    const isAlumni = filter.studentStatus?.toUpperCase() === 'ALUMNI';

    // Current students: standing is the academic-engine source of truth
    // (same as Student Directory / promotion). Never filter by Academic Year.
    if (!isAlumni) {
      const standing: Prisma.StudentAcademicStandingWhereInput = {
        lifecycleState: { in: [...ACTIVE_STUDENT_LIFECYCLES] },
        programmeStatus: { not: 'COMPLETED' },
      };
      if (sequences.length) {
        standing.currentSemesterSequence = { in: sequences };
      }
      and.push({ academicStanding: standing });
    } else if (sequences.length) {
      // Alumni + semester is not a valid academic-engine combo — ignore sequences.
    }

    if (uniqueBatchIds.length) {
      and.push({
        academicProfile: { admissionBatchId: { in: uniqueBatchIds } },
      });
    }

    // Intentionally ignore academicYearIds — Academic Year is institutional
    // config, not a student attribute for communication targeting.
    // Legacy calendar semesterIds are also ignored so old saved segments
    // cannot silently target the wrong cohort after this redesign.

    const profileWhere: Prisma.StudentProfileWhereInput = {};
    if (filter.gender) {
      profileWhere.gender = { equals: filter.gender, mode: 'insensitive' };
    }
    if (filter.studentStatus) {
      profileWhere.studentStatus = filter.studentStatus;
    }
    if (filter.admissionCategory) {
      profileWhere.admissionCategory = {
        equals: filter.admissionCategory,
        mode: 'insensitive',
      };
    }
    if (Object.keys(profileWhere).length) {
      and.push({ masterProfile: profileWhere });
    }

    const residence = this.normalizeResidence(filter);
    if (residence) {
      and.push({
        academicProfile: {
          residenceType: { equals: residence, mode: 'insensitive' },
        },
      });
    }

    if (and.length) where.AND = and;
    return where;
  }

  private normalizeResidence(filter: AudienceFilter): string | undefined {
    if (filter.residenceType) return filter.residenceType.toUpperCase();
    if (filter.hosteller) return 'HOSTELLER';
    if (filter.dayScholar) return 'DAY_SCHOLAR';
    return undefined;
  }

  private async resolveStudents(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const where = await this.buildStudentWhere(tenantId, filter);

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
            studentStatus: true,
            admissionCategory: true,
          },
        },
        academicProfile: {
          select: { residenceType: true },
        },
      },
      take: 5000,
    });

    let filtered = students.filter((s) => s.user.isActive);

    if (filter.rollNumberFrom || filter.rollNumberTo) {
      filtered = filtered.filter((s) => {
        const roll = (s.rollNumber ?? '').trim();
        if (!roll) return false;
        if (
          filter.rollNumberFrom &&
          roll.localeCompare(filter.rollNumberFrom, undefined, {
            numeric: true,
            sensitivity: 'base',
          }) < 0
        ) {
          return false;
        }
        if (
          filter.rollNumberTo &&
          roll.localeCompare(filter.rollNumberTo, undefined, {
            numeric: true,
            sensitivity: 'base',
          }) > 0
        ) {
          return false;
        }
        return true;
      });
    }

    filtered = await this.applyFeeFilters(tenantId, filtered, filter);
    filtered = await this.applyAttendanceFilters(tenantId, filtered, filter);

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

  private async applyFeeFilters<T extends { id: string }>(
    tenantId: string,
    students: T[],
    filter: AudienceFilter,
  ): Promise<T[]> {
    const feeStatus =
      filter.feeStatus ??
      (filter.defaulters
        ? 'DEFAULTERS'
        : filter.feeDue
          ? 'PENDING'
          : undefined);
    if (!feeStatus) return students;

    const ids = students.map((s) => s.id);
    if (!ids.length) return [];

    const demands = await this.prisma.studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId: { in: ids },
        status: { in: [...OPEN_DEMAND_STATUSES, 'PAID'] },
      },
      select: {
        studentId: true,
        balanceAmount: true,
        paidAmount: true,
        totalAmount: true,
        dueDate: true,
        status: true,
      },
    });

    const now = new Date();
    const byStudent = new Map<string, typeof demands>();
    for (const d of demands) {
      const list = byStudent.get(d.studentId) ?? [];
      list.push(d);
      byStudent.set(d.studentId, list);
    }

    return students.filter((s) => {
      const rows = byStudent.get(s.id) ?? [];
      const open = rows.filter(
        (r) =>
          OPEN_DEMAND_STATUSES.includes(
            r.status as (typeof OPEN_DEMAND_STATUSES)[number],
          ) && Number(r.balanceAmount) > 0,
      );
      const hasOverdue = open.some((r) => r.dueDate != null && r.dueDate < now);
      const hasPartial = open.some(
        (r) => Number(r.paidAmount) > 0 && Number(r.balanceAmount) > 0,
      );
      const allPaid =
        rows.length > 0 &&
        rows.every(
          (r) =>
            r.status === 'PAID' ||
            (Number(r.balanceAmount) <= 0 && Number(r.totalAmount) > 0),
        );

      switch (feeStatus) {
        case 'PAID':
          return allPaid && open.length === 0;
        case 'PARTIAL':
          return hasPartial;
        case 'PENDING':
          return open.length > 0;
        case 'OVERDUE':
          return hasOverdue;
        case 'DEFAULTERS':
          return hasOverdue || open.length > 0;
        default:
          return true;
      }
    });
  }

  private async applyAttendanceFilters<T extends { id: string }>(
    tenantId: string,
    students: T[],
    filter: AudienceFilter,
  ): Promise<T[]> {
    if (
      filter.attendanceBelowPct == null &&
      filter.attendanceAbovePct == null
    ) {
      return students;
    }

    const ids = students.map((s) => s.id);
    if (!ids.length) return [];

    const summaries = await this.prisma.studentAttendanceSummary.findMany({
      where: {
        tenantId,
        studentId: { in: ids },
        periodKey: 'SEMESTER',
        courseId: null,
      },
      select: { studentId: true, percentage: true, calculatedAt: true },
      orderBy: { calculatedAt: 'desc' },
    });

    const latest = new Map<string, number>();
    for (const row of summaries) {
      if (!latest.has(row.studentId)) {
        latest.set(row.studentId, Number(row.percentage));
      }
    }

    return students.filter((s) => {
      const pct = latest.get(s.id);
      if (pct == null) return false;
      if (
        filter.attendanceBelowPct != null &&
        !(pct < filter.attendanceBelowPct)
      ) {
        return false;
      }
      if (
        filter.attendanceAbovePct != null &&
        !(pct > filter.attendanceAbovePct)
      ) {
        return false;
      }
      return true;
    });
  }

  private async resolveParents(
    tenantId: string,
    filter: AudienceFilter,
  ): Promise<ResolvedRecipient[]> {
    const students = await this.resolveStudents(tenantId, filter);
    const studentIds = students
      .map((s) => s.studentId)
      .filter((id): id is string => Boolean(id));
    if (!studentIds.length) return [];

    const guardians = await this.prisma.studentGuardian.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
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
    const where: Prisma.StaffProfileWhereInput = {
      tenantId,
      deletedAt: null,
      status: 'ACTIVE',
    };
    if (filter.departmentIds?.length) {
      where.departmentId = { in: filter.departmentIds };
    }
    if (filter.staffProfileIds?.length) {
      where.id = { in: filter.staffProfileIds };
    }
    if (filter.shiftIds?.length) {
      where.primaryShiftId = { in: filter.shiftIds };
    }
    if (filter.designationIds?.length) {
      where.designationId = { in: filter.designationIds };
    }
    if (filter.teaching && !filter.nonTeaching) {
      where.staffType = 'TEACHING';
    } else if (filter.nonTeaching && !filter.teaching) {
      where.staffType = { not: 'TEACHING' };
    }
    if (filter.permanent && !filter.contract) {
      where.employmentType = 'PERMANENT';
    } else if (filter.contract && !filter.permanent) {
      where.employmentType = { not: 'PERMANENT' };
    }
    if (filter.gender) {
      where.gender = { equals: filter.gender, mode: 'insensitive' };
    }

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
      staff
        .filter((s) => !s.portalUser || s.portalUser.isActive)
        .map((s) => ({
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
      this.resolveStudents(tenantId, { ...filter, departmentIds }),
      this.resolveFaculty(tenantId, { ...filter, departmentIds }),
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
        ? ('STUDENT' as const)
        : u.staffProfile
          ? ('FACULTY' as const)
          : ('USER' as const),
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
