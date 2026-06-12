import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type AllocationFilters = {
  academicYearId?: string;
  streamId?: string;
  shiftId?: string;
  semesterMode?: string;
  departmentId?: string;
};

type SaveAllocationDto = {
  offeringSectionId: string;
  staffProfileId?: string | null;
  workloadHours?: number | string | null;
  role?: string | null;
  allocationPercent?: number | string | null;
  preferredRoomId?: string | null;
  facultyInitial?: string | null;
  combinedClass?: boolean;
  combinedGroupId?: string | null;
  leadFacultyId?: string | null;
  sharedHallId?: string | null;
  labRequired?: boolean;
  status?: string;
  notes?: string | null;
};

const FYUGP_SEMESTERS_BY_MODE: Record<'ODD' | 'EVEN', number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

const STREAM_DEPARTMENT_MAP: Record<string, string[]> = {
  ARTS: [
    'ECONOMICS',
    'EDUCATION',
    'ENGLISH',
    'GARO',
    'GEOGRAPHY',
    'HISTORY',
    'PHILOSOPHY',
    'POLITICAL SCIENCE',
    'SOCIOLOGY',
  ],
  SCIENCE: ['BOTANY', 'CHEMISTRY', 'MATHEMATICS', 'PHYSICS', 'ZOOLOGY'],
  COMMERCE: ['COMMERCE'],
};

@Injectable()
export class TimetableAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  async listRows(tenantId: string, filters: AllocationFilters = {}) {
    const semesterMode = this.normalizeSemesterMode(filters.semesterMode);
    const allowedSemesters = FYUGP_SEMESTERS_BY_MODE[semesterMode];
    const stream = filters.streamId
      ? await this.prisma.academicStream.findFirst({
          where: { tenantId, id: filters.streamId, deletedAt: null },
        })
      : null;
    const sections = await this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['active', 'ACTIVE'] },
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
        courseOffering: {
          deletedAt: null,
          semesterSequence: { in: allowedSemesters },
          course: {
            deletedAt: null,
            requiresTimetableSlots: true,
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
          },
        },
      },
      include: {
        shift: true,
        classroom: { include: { roomType: true } },
        staffProfile: { include: { department: true } },
        eligibleStreams: { include: { stream: true } },
        subjectAssignments: {
          where: {
            ...(filters.academicYearId
              ? {
                  OR: [
                    { academicYearId: filters.academicYearId },
                    { academicYearId: null },
                  ],
                }
              : {}),
          },
          include: {
            staffProfile: { include: { department: true, workloads: true } },
          },
          orderBy: [{ isPrimaryFaculty: 'desc' }, { createdAt: 'desc' }],
        },
        courseOffering: {
          include: {
            course: { include: { department: true } },
            programVersion: {
              include: {
                program: { include: { department: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { courseOffering: { semesterSequence: 'asc' } },
        { courseOffering: { category: 'asc' } },
        { sectionCode: 'asc' },
      ],
    });

    return sections
      .filter((section: any) => this.sectionMatchesStream(section, stream))
      .map((section: any) => this.toAllocationRow(section));
  }

  async departmentIdsForUser(tenantId: string, userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId, portalUserId: userId, deletedAt: null },
      include: { headedDepartments: { select: { id: true } } },
    });
    return staff?.headedDepartments?.map((department) => department.id) ?? [];
  }

  async saveRow(tenantId: string, dto: SaveAllocationDto) {
    const section = await this.prisma.offeringSection.findFirst({
      where: {
        tenantId,
        id: dto.offeringSectionId,
        deletedAt: null,
        status: { in: ['active', 'ACTIVE'] },
      },
      include: {
        courseOffering: { include: { course: true } },
      },
    });
    if (!section?.courseOffering) {
      throw new NotFoundException('Teaching allocation section not found');
    }
    if (!dto.staffProfileId) {
      await this.prisma.staffSubjectAssignment.deleteMany({
        where: { tenantId, offeringSectionId: section.id },
      });
      await (this.prisma as any).subjectTeachingAssignment.updateMany({
        where: { tenantId, offeringSectionId: section.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await this.prisma.offeringSection.update({
        where: { id: section.id },
        data: {
          staffProfileId: null,
          classroomId: dto.preferredRoomId ?? section.classroomId,
        },
      });
      return this.rowBySectionId(tenantId, section.id);
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        id: dto.staffProfileId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!staff)
      throw new BadRequestException('Invalid or inactive faculty selected');

    const metadata = {
      allocationStatus: dto.status ?? 'DRAFT',
      facultyInitial: dto.facultyInitial ?? staff.shortCode ?? null,
      preferredRoomId: dto.preferredRoomId ?? null,
      combinedClass: Boolean(dto.combinedClass),
      combinedGroupId: dto.combinedGroupId ?? null,
      leadFacultyId: dto.leadFacultyId ?? null,
      sharedHallId: dto.sharedHallId ?? null,
      labRequired: Boolean(dto.labRequired),
      notes: dto.notes ?? null,
    };
    const existingPrimary = await (
      this.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId,
        offeringSectionId: section.id,
        deletedAt: null,
        isPrimary: true,
      },
      select: { staffProfileId: true },
    });
    const role = this.normalizeRole(dto.role, !existingPrimary);
    const isPrimary = role === 'PRIMARY_FACULTY' || !existingPrimary;

    await this.prisma.$transaction(async (tx) => {
      await tx.staffSubjectAssignment.upsert({
        where: {
          staffProfileId_offeringSectionId: {
            staffProfileId: dto.staffProfileId as string,
            offeringSectionId: section.id,
          },
        },
        create: {
          tenantId,
          staffProfileId: dto.staffProfileId as string,
          programVersionId: section.courseOffering.programVersionId,
          semesterNo: section.courseOffering.semesterSequence ?? 0,
          courseId: section.courseOffering.courseId,
          offeringSectionId: section.id,
          shiftId: section.shiftId,
          category: section.courseOffering.category,
          workloadHours:
            dto.workloadHours == null ? undefined : String(dto.workloadHours),
          isPrimaryFaculty: isPrimary,
        },
        update: {
          workloadHours:
            dto.workloadHours == null ? undefined : String(dto.workloadHours),
          category: section.courseOffering.category,
          shiftId: section.shiftId,
          programVersionId: section.courseOffering.programVersionId,
          isPrimaryFaculty: isPrimary,
        },
      });
      await (tx as any).subjectTeachingAssignment.upsert({
        where: {
          staffProfileId_offeringSectionId: {
            staffProfileId: dto.staffProfileId as string,
            offeringSectionId: section.id,
          },
        },
        create: {
          tenantId,
          staffProfileId: dto.staffProfileId as string,
          courseId: section.courseOffering.courseId,
          courseOfferingId: section.courseOfferingId,
          offeringSectionId: section.id,
          programVersionId: section.courseOffering.programVersionId,
          academicYearId: filtersAcademicYear(dto),
          semesterNo: section.courseOffering.semesterSequence ?? 0,
          shiftId: section.shiftId,
          sectionCode: section.sectionCode,
          role,
          allocationPercent:
            dto.allocationPercent == null
              ? undefined
              : String(dto.allocationPercent),
          weeklyHours:
            dto.workloadHours == null ? undefined : String(dto.workloadHours),
          isPrimary,
          canMarkAttendance: true,
          canEnterInternalMarks: isPrimary,
          canUploadLessonPlan: true,
          canAccessSubjectWorkspace: true,
        },
        update: {
          role,
          allocationPercent:
            dto.allocationPercent == null
              ? undefined
              : String(dto.allocationPercent),
          weeklyHours:
            dto.workloadHours == null ? undefined : String(dto.workloadHours),
          isPrimary,
          canEnterInternalMarks: isPrimary,
        },
      });
      await tx.offeringSection.update({
        where: { id: section.id },
        data: {
          staffProfileId: isPrimary
            ? dto.staffProfileId
            : (section.staffProfileId ??
              existingPrimary?.staffProfileId ??
              null),
          classroomId:
            dto.sharedHallId ?? dto.preferredRoomId ?? section.classroomId,
          reservationRules: metadata as any,
        },
      });
    });

    return this.rowBySectionId(tenantId, section.id);
  }

  async submitRows(
    tenantId: string,
    sectionIds: string[],
    status = 'SUBMITTED',
  ) {
    const sections = await this.prisma.offeringSection.findMany({
      where: { tenantId, id: { in: sectionIds }, deletedAt: null },
      select: { id: true, reservationRules: true },
    });
    await Promise.all(
      sections.map((section) =>
        this.prisma.offeringSection.update({
          where: { id: section.id },
          data: {
            reservationRules: {
              ...((section.reservationRules ?? {}) as any),
              allocationStatus: status,
            } as any,
          },
        }),
      ),
    );
    return { updated: sections.length, status };
  }

  async autoAssign(tenantId: string, filters: AllocationFilters = {}) {
    const rows = await this.listRows(tenantId, filters);
    let assigned = 0;
    for (const row of rows.filter((item) => !item.staffProfileId)) {
      const candidate = await this.findAutoFaculty(
        tenantId,
        row.departmentId,
        row.shiftId,
        row.subjectName,
      );
      if (!candidate) continue;
      await this.saveRow(tenantId, {
        offeringSectionId: row.offeringSectionId,
        staffProfileId: candidate.id,
        workloadHours: row.weeklyHours,
        facultyInitial: candidate.shortCode,
        status: 'DRAFT',
      });
      assigned += 1;
    }
    return { considered: rows.length, assigned };
  }

  async clonePrevious(
    tenantId: string,
    sourcePlanId: string,
    targetPlanId: string,
  ) {
    const [source, target] = await Promise.all([
      this.prisma.timetablePlan.findFirst({
        where: { tenantId, id: sourcePlanId, deletedAt: null },
      }),
      this.prisma.timetablePlan.findFirst({
        where: { tenantId, id: targetPlanId, deletedAt: null },
      }),
    ]);
    if (!source || !target)
      throw new NotFoundException('Source or target plan not found');
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId: sourcePlanId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
    });
    if (!entries.length) return { clonedEntries: 0 };

    await this.prisma.timetablePlanEntry.deleteMany({
      where: {
        tenantId,
        planId: targetPlanId,
        source: 'CLONED',
        isLocked: false,
      },
    });
    await this.prisma.timetablePlanEntry.createMany({
      data: entries.map((entry) => ({
        tenantId,
        planId: targetPlanId,
        slotTemplateId: entry.slotTemplateId,
        shiftId: target.shiftId ?? entry.shiftId,
        dayOfWeek: entry.dayOfWeek,
        periodNo: entry.periodNo,
        startTime: entry.startTime,
        endTime: entry.endTime,
        offeringSectionId: entry.offeringSectionId,
        courseOfferingId: entry.courseOfferingId,
        courseId: entry.courseId,
        staffProfileId: entry.staffProfileId,
        classroomId: entry.classroomId,
        semesterSequence: entry.semesterSequence,
        sectionCode: entry.sectionCode,
        slotType: entry.slotType,
        fyugpCategory: entry.fyugpCategory,
        combinedGroupKey: entry.combinedGroupKey,
        isCombined: entry.isCombined,
        isLocked: false,
        status: 'SCHEDULED',
        source: 'CLONED',
        notes: entry.notes,
        metadata: {
          ...((entry.metadata ?? {}) as any),
          clonedFromPlanId: sourcePlanId,
          clonedFromEntryId: entry.id,
        },
      })),
    });
    return { clonedEntries: entries.length };
  }

  private async rowBySectionId(tenantId: string, sectionId: string) {
    const rows = await this.listRows(tenantId, {});
    return rows.find((row) => row.offeringSectionId === sectionId) ?? null;
  }

  private toAllocationRow(section: any) {
    const offering = section.courseOffering;
    const course = offering.course;
    const assignment = section.subjectAssignments?.[0];
    const staff = assignment?.staffProfile ?? section.staffProfile;
    const facultyTeam =
      section.subjectAssignments?.map((item: any) => ({
        staffProfileId: item.staffProfileId,
        staffCode: item.staffProfile?.employeeCode ?? null,
        staffName: item.staffProfile?.fullName ?? null,
        shortCode: item.staffProfile?.shortCode ?? null,
        role: item.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY',
        allocationPercent: item.isPrimaryFaculty ? 100 : null,
        weeklyHours:
          item.workloadHours == null ? null : Number(item.workloadHours),
        isPrimary: item.isPrimaryFaculty,
      })) ?? [];
    const rules = (section.reservationRules ?? {}) as any;
    const weeklyHours =
      Number(assignment?.workloadHours ?? 0) ||
      Number(course.theoryHoursPerWeek ?? 0) ||
      Number(course.totalTheoryContactHours ?? 0) ||
      Number(course.credits ?? 0) ||
      0;
    const maxWeeklyHours = Number(staff?.workloads?.[0]?.weeklyHours ?? 24);
    const assignedWeeklyHours = Number(
      assignment?.workloadHours ?? weeklyHours,
    );

    return {
      id: section.id,
      offeringSectionId: section.id,
      departmentId:
        course.departmentId ??
        offering.programVersion?.program?.departmentId ??
        null,
      department:
        course.department?.name ??
        offering.programVersion?.program?.department?.name ??
        null,
      programme:
        offering.programVersion?.program?.code ??
        offering.programVersion?.program?.name ??
        null,
      programmeName: offering.programVersion?.program?.name ?? null,
      semester: offering.semesterSequence,
      sectionCode: section.sectionCode,
      subjectCode: course.code,
      subjectName: course.title,
      paperType: offering.category ?? course.courseType,
      staffProfileId: staff?.id ?? null,
      staffCode: staff?.employeeCode ?? null,
      staffName: staff?.fullName ?? null,
      facultyInitial: rules.facultyInitial ?? staff?.shortCode ?? null,
      facultyTeam,
      weeklyHours,
      maxWeeklyHours,
      assignedWeeklyHours,
      workloadStatus: this.workloadStatus(assignedWeeklyHours, maxWeeklyHours),
      shiftId: section.shiftId,
      shift: section.shift?.name ?? null,
      preferredRoomId: rules.preferredRoomId ?? section.classroomId ?? null,
      preferredRoom: section.classroom?.code ?? null,
      labRequired: Boolean(
        rules.labRequired ?? course.labRequired ?? course.hasPractical,
      ),
      combinedClass: Boolean(rules.combinedClass),
      combinedGroupId: rules.combinedGroupId ?? null,
      leadFacultyId: rules.leadFacultyId ?? null,
      sharedHallId: rules.sharedHallId ?? null,
      status: rules.allocationStatus ?? (staff ? 'DRAFT' : 'PENDING'),
      streams: section.eligibleStreams?.map((item: any) => item.stream) ?? [],
    };
  }

  private async findAutoFaculty(
    tenantId: string,
    departmentId?: string | null,
    shiftId?: string | null,
    subjectName?: string | null,
  ) {
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        staffType: { in: ['TEACHING', 'teaching'] },
        ...(departmentId ? { departmentId } : {}),
      },
      include: { workloads: true, shiftAssignments: true },
      take: 50,
    });
    const normalizedSubject = this.normalize(subjectName);
    return staff
      .map((row) => {
        const specialization = this.normalize(
          row.specialization ?? row.qualification,
        );
        const shiftScore =
          !shiftId ||
          row.primaryShiftId === shiftId ||
          row.shiftAssignments?.some(
            (assignment) => assignment.shiftId === shiftId,
          )
            ? 20
            : 0;
        const expertiseScore =
          normalizedSubject &&
          specialization.includes(normalizedSubject.slice(0, 5))
            ? 20
            : 0;
        return { ...row, score: shiftScore + expertiseScore };
      })
      .sort(
        (a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName),
      )[0];
  }

  private sectionMatchesStream(section: any, stream: any) {
    if (!stream) return true;
    const streamCode = this.normalize(stream.code ?? stream.name);
    const explicit = section.eligibleStreams?.some(
      (item: any) =>
        this.normalize(item.stream?.code ?? item.stream?.name) === streamCode,
    );
    if (explicit) return true;
    const departmentName = this.normalize(
      section.courseOffering?.course?.department?.name ??
        section.courseOffering?.course?.department?.code ??
        section.courseOffering?.programVersion?.program?.department?.name,
    );
    return (STREAM_DEPARTMENT_MAP[streamCode] ?? []).includes(departmentName);
  }

  private workloadStatus(assigned: number, max: number) {
    if (!max) return 'GREEN';
    if (assigned > max) return 'RED';
    if (assigned >= max * 0.85) return 'YELLOW';
    return 'GREEN';
  }

  private normalizeSemesterMode(value: unknown): 'ODD' | 'EVEN' {
    return String(value ?? 'ODD').toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
  }

  private normalize(value: unknown) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private normalizeRole(
    role: string | null | undefined,
    defaultPrimary = false,
  ) {
    const normalized = (
      role || (defaultPrimary ? 'PRIMARY_FACULTY' : 'CO_FACULTY')
    )
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    const allowed = new Set([
      'PRIMARY_FACULTY',
      'CO_FACULTY',
      'LAB_INSTRUCTOR',
      'PRACTICAL_FACULTY',
      'GUEST_FACULTY',
      'TUTOR',
      'MENTOR',
      'EVALUATOR',
      'INTERNSHIP_SUPERVISOR',
    ]);
    if (!allowed.has(normalized))
      return defaultPrimary ? 'PRIMARY_FACULTY' : 'CO_FACULTY';
    return normalized;
  }
}

function filtersAcademicYear(dto: SaveAllocationDto) {
  return (
    (dto as SaveAllocationDto & { academicYearId?: string | null })
      .academicYearId ?? undefined
  );
}
