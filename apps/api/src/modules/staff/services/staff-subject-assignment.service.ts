import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  AssignSubjectDto,
  TeachingAssignmentContextQueryDto,
} from '../dto/staff.dto';

const TEACHING_ROLES = new Set([
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

@Injectable()
export class StaffSubjectAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, staffProfileId: string) {
    await this.assertStaff(tenantId, staffProfileId);
    await this.repairLegacyAssignments(tenantId, staffProfileId);
    const rows = await this.prisma.staffSubjectAssignment.findMany({
      where: { tenantId, staffProfileId },
      include: {
        course: { select: { id: true, code: true, title: true } },
        offeringSection: {
          select: {
            id: true,
            sectionCode: true,
            studentGroup: true,
            status: true,
            shiftId: true,
            courseOfferingId: true,
            shift: { select: { id: true, code: true, name: true } },
            eligibleStreams: {
              select: {
                stream: { select: { id: true, code: true, name: true } },
              },
            },
            courseOffering: {
              select: {
                id: true,
                semesterSequence: true,
                category: true,
                mappingSource: true,
                programVersion: {
                  select: {
                    id: true,
                    version: true,
                    status: true,
                    program: { select: { id: true, code: true, name: true } },
                  },
                },
              },
            },
          },
        },
        shift: { select: { id: true, code: true, name: true } },
        programVersion: {
          select: {
            id: true,
            version: true,
            status: true,
            program: { select: { id: true, code: true, name: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ semesterNo: 'asc' }, { createdAt: 'desc' }],
    });
    const sectionIds = rows.flatMap((row) =>
      row.offeringSectionId ? [row.offeringSectionId] : [],
    );
    const teamRows = sectionIds.length
      ? await (this.prisma as any).subjectTeachingAssignment.findMany({
          where: {
            tenantId,
            staffProfileId,
            offeringSectionId: { in: sectionIds },
            deletedAt: null,
          },
        })
      : [];
    const teamBySection = new Map<string, any>(
      teamRows.map((row: any) => [row.offeringSectionId, row]),
    );
    return rows.map((row) => {
      const team = row.offeringSectionId
        ? teamBySection.get(row.offeringSectionId)
        : null;
      return {
        ...row,
        teachingRole:
          team?.role ??
          (row.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY'),
        allocationPercent:
          team?.allocationPercent == null
            ? null
            : Number(team.allocationPercent),
        weeklyHours:
          team?.weeklyHours == null
            ? Number(row.workloadHours ?? 0) || null
            : Number(team.weeklyHours),
        canMarkAttendance: team?.canMarkAttendance ?? true,
        canEnterInternalMarks:
          team?.canEnterInternalMarks ?? Boolean(row.isPrimaryFaculty),
        canUploadLessonPlan: team?.canUploadLessonPlan ?? true,
        canAccessSubjectWorkspace: team?.canAccessSubjectWorkspace ?? true,
        contextStatus: row.offeringSectionId ? 'COMPLETE' : 'LEGACY_UNRESOLVED',
      };
    });
  }

  async listAssignableContexts(
    tenantId: string,
    staffProfileId: string | null,
    query: TeachingAssignmentContextQueryDto,
  ) {
    if (staffProfileId) {
      await this.assertStaff(tenantId, staffProfileId);
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildAssignableContextWhere(tenantId, query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.offeringSection.count({ where }),
      this.prisma.offeringSection.findMany({
        where,
        include: {
          shift: { select: { id: true, code: true, name: true } },
          staffProfile: {
            select: { id: true, employeeCode: true, fullName: true },
          },
          subjectAssignments: {
            include: {
              staffProfile: {
                select: {
                  id: true,
                  employeeCode: true,
                  shortCode: true,
                  fullName: true,
                },
              },
            },
            orderBy: [{ isPrimaryFaculty: 'desc' }, { createdAt: 'asc' }],
          },
          eligibleStreams: {
            select: {
              stream: { select: { id: true, code: true, name: true } },
            },
          },
          courseOffering: {
            include: {
              course: {
                include: {
                  department: { select: { id: true, code: true, name: true } },
                },
              },
              programVersion: {
                include: {
                  program: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      departmentId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { courseOffering: { programVersion: { program: { code: 'asc' } } } },
          { courseOffering: { semesterSequence: 'asc' } },
          { courseOffering: { category: 'asc' } },
          { courseOffering: { course: { code: 'asc' } } },
          { sectionCode: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return paginate(
      rows.map((row) => this.toTeachingContext(row, staffProfileId)),
      total,
      page,
      limit,
    );
  }

  async assign(
    tenantId: string,
    staffProfileId: string,
    dto: AssignSubjectDto,
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    if (!dto.offeringSectionId) {
      throw new BadRequestException(
        'Teaching assignment must be selected from a programme delivery section',
      );
    }

    const offeringSection = await this.prisma.offeringSection.findFirst({
      where: {
        id: dto.offeringSectionId,
        tenantId,
        deletedAt: null,
        status: 'active',
      },
      include: {
        courseOffering: {
          include: {
            course: { select: { id: true, code: true, title: true } },
            programVersion: {
              select: {
                id: true,
                version: true,
                program: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        shift: { select: { id: true, code: true, name: true } },
      },
    });

    if (!offeringSection?.courseOffering) {
      throw new BadRequestException('Invalid delivery section');
    }

    const offering = offeringSection.courseOffering;
    if (!offering.programVersionId || !offering.programVersion) {
      throw new BadRequestException(
        'Delivery section is not linked to a programme version',
      );
    }
    if (offering.courseId !== dto.courseId) {
      throw new BadRequestException(
        'Selected course does not match delivery section',
      );
    }
    if (offering.semesterSequence == null || !offering.category) {
      throw new BadRequestException(
        'Delivery section is missing semester or curriculum category',
      );
    }
    const semesterNo = offering.semesterSequence;
    const category = offering.category;

    await this.assertStaffShiftAssignment(
      tenantId,
      staffProfileId,
      offeringSection.shiftId,
    );

    const existingForStaff = await (
      this.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId,
        staffProfileId,
        offeringSectionId: dto.offeringSectionId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingForStaff) {
      throw new ConflictException(
        'Subject already assigned to this staff member for this section',
      );
    }

    const existingPrimary = await (
      this.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId,
        offeringSectionId: dto.offeringSectionId,
        deletedAt: null,
        isPrimary: true,
      },
      select: { staffProfileId: true },
    });
    const isPrimary = dto.isPrimaryFaculty ?? !existingPrimary;
    const role = this.normalizeRole(dto.role, isPrimary);
    const allocationPercent =
      dto.allocationPercent ??
      (isPrimary && !existingPrimary ? 100 : undefined);
    if (allocationPercent != null) {
      await this.assertAllocationLimit(
        tenantId,
        dto.offeringSectionId,
        allocationPercent,
      );
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const team = await (tx as any).subjectTeachingAssignment.create({
        data: {
          tenantId,
          staffProfileId,
          courseId: offering.courseId,
          courseOfferingId: offeringSection.courseOfferingId,
          offeringSectionId: offeringSection.id,
          programVersionId: offering.programVersionId,
          academicYearId: dto.academicYearId,
          semesterNo,
          shiftId: offeringSection.shiftId,
          sectionCode: offeringSection.sectionCode,
          role,
          allocationPercent:
            allocationPercent == null ? undefined : String(allocationPercent),
          weeklyHours:
            dto.workloadHours == null ? undefined : String(dto.workloadHours),
          isPrimary,
          canMarkAttendance: dto.canMarkAttendance ?? true,
          canEnterInternalMarks: dto.canEnterInternalMarks ?? isPrimary,
          canUploadLessonPlan: dto.canUploadLessonPlan ?? true,
          canAccessSubjectWorkspace: dto.canAccessSubjectWorkspace ?? true,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      });

      const created = await tx.staffSubjectAssignment.upsert({
        where: {
          staffProfileId_offeringSectionId: {
            staffProfileId,
            offeringSectionId: offeringSection.id,
          },
        },
        create: {
          tenantId,
          staffProfileId,
          courseId: offering.courseId,
          semesterNo,
          programVersionId: offering.programVersionId,
          offeringSectionId: offeringSection.id,
          shiftId: offeringSection.shiftId,
          academicYearId: dto.academicYearId,
          category,
          workloadHours: dto.workloadHours,
          isPrimaryFaculty: isPrimary,
        },
        update: {
          workloadHours: dto.workloadHours,
          isPrimaryFaculty: isPrimary,
          category,
          shiftId: offeringSection.shiftId,
          programVersionId: offering.programVersionId,
        },
        include: {
          course: { select: { id: true, code: true, title: true } },
          programVersion: {
            select: {
              id: true,
              version: true,
              program: { select: { id: true, code: true, name: true } },
            },
          },
          offeringSection: {
            select: {
              id: true,
              sectionCode: true,
              studentGroup: true,
              shift: { select: { id: true, code: true, name: true } },
            },
          },
          shift: { select: { id: true, code: true, name: true } },
        },
      });

      if (isPrimary) {
        await tx.offeringSection.update({
          where: { id: dto.offeringSectionId },
          data: { staffProfileId },
        });
      }

      return { ...created, teachingTeamAssignmentId: team.id };
    });

    return assignment;
  }

  async remove(tenantId: string, staffProfileId: string, assignmentId: string) {
    const assignment = await this.prisma.staffSubjectAssignment.findFirst({
      where: { id: assignmentId, tenantId, staffProfileId },
    });
    if (!assignment)
      throw new NotFoundException('Subject assignment not found');

    await this.prisma.$transaction(async (tx) => {
      if (assignment.offeringSectionId) {
        const section = await tx.offeringSection.findFirst({
          where: { id: assignment.offeringSectionId, tenantId },
          select: { staffProfileId: true },
        });
        if (section?.staffProfileId === staffProfileId) {
          await tx.offeringSection.update({
            where: { id: assignment.offeringSectionId },
            data: { staffProfileId: null },
          });
        }
      }
      if (assignment.offeringSectionId) {
        await (tx as any).subjectTeachingAssignment.updateMany({
          where: {
            tenantId,
            staffProfileId,
            offeringSectionId: assignment.offeringSectionId,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }
      await tx.staffSubjectAssignment.delete({ where: { id: assignmentId } });
    });

    return { ok: true };
  }

  async teachingMatrix(tenantId: string) {
    const rows = await this.prisma.offeringSection.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        subjectAssignments: {
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                shortCode: true,
                employeeCode: true,
              },
            },
          },
          orderBy: [{ isPrimaryFaculty: 'desc' }, { createdAt: 'asc' }],
        },
        courseOffering: {
          include: {
            course: { include: { department: true } },
            programVersion: { include: { program: true } },
          },
        },
        shift: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { courseOffering: { semesterSequence: 'asc' } },
        { courseOffering: { course: { code: 'asc' } } },
        { sectionCode: 'asc' },
      ],
    });
    return rows.map((section) => ({
      offeringSectionId: section.id,
      paperCode: section.courseOffering?.course?.code,
      paperName: section.courseOffering?.course?.title,
      department: section.courseOffering?.course?.department?.name,
      programme: section.courseOffering?.programVersion?.program?.code,
      semesterNo: section.courseOffering?.semesterSequence,
      category: section.courseOffering?.category,
      sectionCode: section.sectionCode,
      shift: section.shift?.name ?? section.shift?.code,
      facultyTeam: section.subjectAssignments.map((assignment) => ({
        staffProfileId: assignment.staffProfileId,
        code:
          assignment.staffProfile.shortCode ??
          assignment.staffProfile.employeeCode,
        name: assignment.staffProfile.fullName,
        role: assignment.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY',
        weeklyHours:
          assignment.workloadHours == null
            ? null
            : Number(assignment.workloadHours),
        isPrimary: assignment.isPrimaryFaculty,
      })),
    }));
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  private buildAssignableContextWhere(
    tenantId: string,
    query: TeachingAssignmentContextQueryDto,
  ): Prisma.OfferingSectionWhereInput {
    const search = query.search?.trim();
    const contains = search
      ? { contains: search, mode: 'insensitive' as const }
      : undefined;

    return {
      tenantId,
      deletedAt: null,
      status: 'active',
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.sectionCode
        ? { sectionCode: { contains: query.sectionCode, mode: 'insensitive' } }
        : {}),
      courseOffering: {
        tenantId,
        deletedAt: null,
        programVersionId: query.programVersionId
          ? query.programVersionId
          : { not: null },
        ...(query.semesterNo != null
          ? { semesterSequence: query.semesterNo }
          : {}),
        ...(query.category ? { category: query.category } : {}),
        course: {
          deletedAt: null,
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        },
      },
      ...(contains
        ? {
            OR: [
              { sectionCode: contains },
              { shift: { OR: [{ code: contains }, { name: contains }] } },
              {
                courseOffering: {
                  OR: [
                    { category: contains },
                    {
                      course: { OR: [{ code: contains }, { title: contains }] },
                    },
                    {
                      course: {
                        department: {
                          OR: [{ code: contains }, { name: contains }],
                        },
                      },
                    },
                    {
                      programVersion: {
                        program: {
                          OR: [{ code: contains }, { name: contains }],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };
  }

  private toTeachingContext(section: any, staffProfileId: string | null) {
    const offering = section.courseOffering;
    const team =
      (section as any).subjectTeachingAssignments ??
      (section as any).subjectAssignments ??
      [];
    const assignedToThis = Boolean(
      staffProfileId &&
      team.some((row: any) => row.staffProfileId === staffProfileId),
    );
    const assignedToOther = team.length > 0 && !assignedToThis;
    return {
      id: section.id,
      offeringSectionId: section.id,
      courseOfferingId: offering.id,
      courseId: offering.courseId,
      course: offering.course,
      programVersionId: offering.programVersionId,
      programVersion: offering.programVersion,
      semesterNo: offering.semesterSequence,
      category: offering.category,
      sectionCode: section.sectionCode,
      studentGroup: section.studentGroup,
      shiftId: section.shiftId,
      shift: section.shift,
      streamScope: section.eligibleStreams.map((row: any) => row.stream),
      assignmentStatus: assignedToOther
        ? 'ASSIGNED_TO_OTHER_STAFF'
        : assignedToThis
          ? 'ASSIGNED_TO_THIS_STAFF'
          : 'AVAILABLE',
      assignedStaff: section.staffProfile,
      teachingTeam: team.map((row: any) => ({
        id: row.id,
        staffProfileId: row.staffProfileId,
        staffName: row.staffProfile?.fullName,
        employeeCode: row.staffProfile?.employeeCode,
        shortCode: row.staffProfile?.shortCode,
        role:
          row.role ?? (row.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY'),
        allocationPercent:
          row.allocationPercent == null ? null : Number(row.allocationPercent),
        weeklyHours:
          row.weeklyHours == null
            ? Number(row.workloadHours ?? 0) || null
            : Number(row.weeklyHours),
        isPrimary: row.isPrimary ?? row.isPrimaryFaculty,
        canMarkAttendance: row.canMarkAttendance ?? true,
        canEnterInternalMarks:
          row.canEnterInternalMarks ?? Boolean(row.isPrimaryFaculty),
        canUploadLessonPlan: row.canUploadLessonPlan ?? true,
        canAccessSubjectWorkspace: row.canAccessSubjectWorkspace ?? true,
      })),
    };
  }

  private normalizeRole(role: string | undefined, isPrimary: boolean) {
    const normalized = (role || (isPrimary ? 'PRIMARY_FACULTY' : 'CO_FACULTY'))
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (!TEACHING_ROLES.has(normalized)) {
      throw new BadRequestException(`Invalid teaching role: ${role}`);
    }
    return normalized;
  }

  private async assertAllocationLimit(
    tenantId: string,
    offeringSectionId: string,
    allocationPercent: number,
  ) {
    if (allocationPercent < 0 || allocationPercent > 100) {
      throw new BadRequestException(
        'Allocation percent must be between 0 and 100',
      );
    }
    const rows = await (this.prisma as any).subjectTeachingAssignment.findMany({
      where: { tenantId, offeringSectionId, deletedAt: null },
      select: { allocationPercent: true },
    });
    const total = rows.reduce(
      (sum: number, row: any) => sum + Number(row.allocationPercent ?? 0),
      0,
    );
    if (total + allocationPercent > 100) {
      throw new BadRequestException(
        `Total allocation cannot exceed 100%. Current allocation is ${total}%.`,
      );
    }
  }

  private async repairLegacyAssignments(
    tenantId: string,
    staffProfileId: string,
  ) {
    const legacy = await this.prisma.staffSubjectAssignment.findMany({
      where: { tenantId, staffProfileId, offeringSectionId: null },
      select: {
        id: true,
        courseId: true,
        semesterNo: true,
        category: true,
        isPrimaryFaculty: true,
      },
      take: 50,
    });

    for (const row of legacy) {
      const matches = await this.prisma.offeringSection.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'active',
          OR: [{ staffProfileId: null }, { staffProfileId }],
          courseOffering: {
            tenantId,
            deletedAt: null,
            courseId: row.courseId,
            programVersionId: { not: null },
            semesterSequence: row.semesterNo,
            ...(row.category ? { category: row.category } : {}),
          },
        },
        select: {
          id: true,
          shiftId: true,
          staffProfileId: true,
          courseOffering: {
            select: {
              programVersionId: true,
              semesterSequence: true,
              category: true,
            },
          },
        },
        take: 2,
      });

      if (matches.length !== 1) continue;
      const match = matches[0]!;
      await this.prisma.$transaction(async (tx) => {
        await tx.staffSubjectAssignment.update({
          where: { id: row.id },
          data: {
            offeringSectionId: match.id,
            shiftId: match.shiftId,
            programVersionId: match.courseOffering.programVersionId,
            semesterNo: match.courseOffering.semesterSequence ?? row.semesterNo,
            category: match.courseOffering.category ?? row.category,
          },
        });
        if (row.isPrimaryFaculty && !match.staffProfileId) {
          await tx.offeringSection.update({
            where: { id: match.id },
            data: { staffProfileId },
          });
        }
      });
    }
  }

  private async assertStaffShiftAssignment(
    tenantId: string,
    staffProfileId: string,
    shiftId: string,
  ) {
    const mapping = await this.prisma.staffShiftAssignment.findFirst({
      where: { tenantId, staffProfileId, shiftId },
    });
    if (!mapping) {
      throw new BadRequestException(
        'Staff member is not assigned to teach in this shift',
      );
    }
  }
}
