import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PoolSectionProvisioningService } from './pool-section-provisioning.service';
import type {
  AutoDivideSubjectSectionsDto,
  BulkProvisionSubjectSectionsDto,
  CreateSubjectSectionDto,
  ImportSectionAllocationsDto,
  MoveStudentSectionDto,
  SectionAllocationStrategy,
  SubjectSectionFiltersDto,
  UpdateSubjectSectionDto,
} from '../dto/subject-section.dto';

type StudentSortRow = {
  lineId: string;
  studentId: string;
  rollNumber: string;
  fullName: string;
  gender: string | null;
  status: string;
  offeringSectionId: string | null;
  registrationId: string;
};

@Injectable()
export class SubjectSectionManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly poolSections: PoolSectionProvisioningService,
  ) {}

  async getDashboard(tenantId: string, filters: SubjectSectionFiltersDto) {
    const offeringWhere = this.buildOfferingWhere(tenantId, filters);
    const offerings = await this.prisma.courseOffering.findMany({
      where: offeringWhere,
      select: {
        id: true,
        sections: {
          where: { deletedAt: null, status: 'active' },
          select: {
            id: true,
            seatLedger: { select: { confirmedCount: true } },
          },
        },
      },
    });

    const sectionIds = offerings.flatMap((o) => o.sections.map((s) => s.id));
    const totalSections = sectionIds.length;
    const subjectsWithMultipleSections = offerings.filter(
      (o) => o.sections.length > 1,
    ).length;

    const lineStats = sectionIds.length
      ? await this.prisma.semesterRegistrationLine.groupBy({
          by: ['status'],
          where: {
            tenantId,
            offeringSectionId: { in: sectionIds },
            status: { in: ['pending', 'confirmed', 'waitlisted'] },
          },
          _count: { _all: true },
        })
      : [];

    const studentsAllocated = lineStats
      .filter((r) => r.status === 'confirmed' || r.status === 'waitlisted')
      .reduce((sum, r) => sum + r._count._all, 0);
    const pendingAllocation =
      lineStats.find((r) => r.status === 'pending')?._count._all ?? 0;

    return {
      totalSubjects: offerings.length,
      subjectsWithMultipleSections,
      totalSections,
      studentsAllocated,
      pendingAllocation,
    };
  }

  async listSubjects(tenantId: string, filters: SubjectSectionFiltersDto) {
    const offerings = await this.prisma.courseOffering.findMany({
      where: this.buildOfferingWhere(tenantId, filters),
      include: {
        course: { select: { id: true, code: true, title: true } },
        categoryPool: { select: { id: true, poolName: true } },
        sections: {
          where: { deletedAt: null, status: 'active' },
          include: {
            shift: { select: { id: true, code: true, name: true } },
            seatLedger: true,
            staffProfile: {
              select: { id: true, fullName: true, employeeCode: true },
            },
            classroom: {
              select: { id: true, name: true, code: true, capacity: true },
            },
            _count: {
              select: {
                registrationLines: {
                  where: {
                    status: { in: ['pending', 'confirmed', 'waitlisted'] },
                  },
                },
              },
            },
          },
          orderBy: [{ shift: { sortOrder: 'asc' } }, { sectionCode: 'asc' }],
        },
      },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    return offerings.map((offering) => {
      const sections = offering.sections.map((section) => {
        const allocated =
          section.seatLedger?.confirmedCount ??
          section._count.registrationLines;
        const capacity = section.capacity;
        return {
          id: section.id,
          sectionCode: section.sectionCode,
          shift: section.shift,
          capacity,
          waitlistCapacity: section.waitlistCapacity,
          allocated,
          waitlisted: section.seatLedger?.waitlistCount ?? 0,
          vacancy: Math.max(0, capacity - allocated),
          isFull: allocated >= capacity,
          faculty: section.staffProfile,
          classroom: section.classroom,
        };
      });
      const totalAllocated = sections.reduce((sum, s) => sum + s.allocated, 0);
      return {
        id: offering.id,
        category: offering.category,
        semesterSequence: offering.semesterSequence,
        mappingSource: offering.mappingSource,
        poolName: offering.categoryPool?.poolName ?? null,
        course: offering.course,
        sectionCount: sections.length,
        totalAllocated,
        sections,
      };
    });
  }

  async listSectionStudents(tenantId: string, sectionId: string) {
    const section = await this.prisma.offeringSection.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      include: {
        courseOffering: {
          include: { course: { select: { code: true, title: true } } },
        },
        shift: true,
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringSectionId: sectionId,
        status: { in: ['pending', 'confirmed', 'waitlisted'] },
      },
      include: {
        registration: {
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                masterProfile: { select: { fullName: true, gender: true } },
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: [{ registration: { student: { rollNumber: 'asc' } } }],
    });

    return {
      section: {
        id: section.id,
        sectionCode: section.sectionCode,
        shift: section.shift,
        capacity: section.capacity,
        course: section.courseOffering.course,
        category: section.courseOffering.category,
      },
      students: lines.map((line) => ({
        lineId: line.id,
        status: line.status,
        student: {
          id: line.registration.student.id,
          rollNumber: line.registration.student.rollNumber,
          fullName: line.registration.student.masterProfile?.fullName ?? '',
          gender: line.registration.student.masterProfile?.gender ?? null,
          department: line.registration.student.department,
        },
      })),
    };
  }

  async bulkProvisionSections(
    tenantId: string,
    dto: BulkProvisionSubjectSectionsDto,
  ) {
    const sectionCodes = dto.sectionCodes.map((c) => c.trim().toUpperCase());
    if (!sectionCodes.length) {
      throw new BadRequestException('At least one section code is required');
    }

    const shiftId =
      dto.shiftId ??
      (await this.poolSections.resolveDefaultShiftId(
        tenantId,
        dto.shiftCode ?? 'DAY',
      ));

    let offeringIds = dto.offeringIds ?? [];
    if (!offeringIds.length) {
      const categories = dto.categories?.map((c) => c.trim().toUpperCase());
      const where: Prisma.CourseOfferingWhereInput = {
        tenantId,
        deletedAt: null,
        ...(dto.semesterNo != null ? { semesterSequence: dto.semesterNo } : {}),
        ...(categories?.length ? { category: { in: categories } } : {}),
      };
      const rows = await this.prisma.courseOffering.findMany({
        where,
        select: { id: true },
      });
      offeringIds = rows.map((r) => r.id);
    }

    let created = 0;
    let skipped = 0;
    const details: Array<{
      offeringId: string;
      sectionCode: string;
      created: boolean;
      sectionId: string;
    }> = [];

    for (const offeringId of offeringIds) {
      for (const sectionCode of sectionCodes) {
        const result = await this.poolSections.ensureDefaultSection(
          tenantId,
          offeringId,
          {
            shiftId,
            sectionCode,
            capacity: dto.capacityPerSection,
          },
        );
        if (result.created) created += 1;
        else skipped += 1;
        details.push({
          offeringId,
          sectionCode,
          created: result.created,
          sectionId: result.sectionId,
        });
      }
    }

    return { created, skipped, total: details.length, details };
  }

  async createSection(tenantId: string, dto: CreateSubjectSectionDto) {
    const result = await this.poolSections.ensureDefaultSection(
      tenantId,
      dto.offeringId,
      {
        shiftId: dto.shiftId,
        sectionCode: dto.sectionCode,
        capacity: dto.capacity,
        waitlistCapacity: dto.waitlistCapacity,
      },
    );

    if (dto.facultyId || dto.classroomId) {
      await this.prisma.offeringSection.update({
        where: { id: result.sectionId },
        data: {
          staffProfileId: dto.facultyId ?? undefined,
          classroomId: dto.classroomId ?? undefined,
        },
      });
    }

    return this.getSectionById(tenantId, result.sectionId);
  }

  async updateSection(
    tenantId: string,
    sectionId: string,
    dto: UpdateSubjectSectionDto,
  ) {
    const section = await this.prisma.offeringSection.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      include: { seatLedger: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    if (dto.capacity != null) {
      const allocated = section.seatLedger?.confirmedCount ?? 0;
      if (dto.capacity < allocated) {
        throw new BadRequestException(
          `Capacity cannot be less than current allocation (${allocated})`,
        );
      }
    }

    await this.prisma.offeringSection.update({
      where: { id: sectionId },
      data: {
        capacity: dto.capacity,
        waitlistCapacity: dto.waitlistCapacity,
        staffProfileId:
          dto.facultyId === null ? null : (dto.facultyId ?? undefined),
        classroomId:
          dto.classroomId === null ? null : (dto.classroomId ?? undefined),
      },
    });

    return this.getSectionById(tenantId, sectionId);
  }

  async autoDivideStudents(
    tenantId: string,
    dto: AutoDivideSubjectSectionsDto,
    actorId?: string,
  ) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: dto.offeringId, tenantId, deletedAt: null },
    });
    if (!offering) throw new NotFoundException('Offering not found');

    const shiftId =
      dto.shiftId ??
      (await this.poolSections.resolveDefaultShiftId(tenantId, 'DAY'));

    const sections = await this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        courseOfferingId: dto.offeringId,
        shiftId,
        deletedAt: null,
        status: 'active',
      },
      include: { seatLedger: true },
      orderBy: { sectionCode: 'asc' },
    });
    if (sections.length < 2) {
      throw new BadRequestException(
        'Create at least two sections (A, B) before auto-dividing students',
      );
    }

    const lines = await this.findOfferingLines(tenantId, dto);
    if (!lines.length) {
      return { assigned: 0, sections: sections.length, preview: [] };
    }

    const sorted = this.sortStudentsForStrategy(lines, dto.strategy);
    const buckets = this.distributeEvenly(sorted, sections.length);
    const preview: Array<{
      lineId: string;
      rollNumber: string;
      fullName: string;
      fromSection: string | null;
      toSection: string;
      toSectionId: string;
    }> = [];

    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i]!;
      for (const row of buckets[i] ?? []) {
        preview.push({
          lineId: row.lineId,
          rollNumber: row.rollNumber,
          fullName: row.fullName,
          fromSection:
            sections.find((s) => s.id === row.offeringSectionId)?.sectionCode ??
            null,
          toSection: section.sectionCode,
          toSectionId: section.id,
        });
      }
    }

    if (dto.dryRun) {
      return {
        assigned: preview.length,
        sections: sections.length,
        strategy: dto.strategy,
        preview,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of preview) {
        const line = lines.find((l) => l.lineId === item.lineId);
        const target = sections.find((s) => s.id === item.toSectionId);
        if (!line || !target) continue;
        await this.transferLineSection(tx, tenantId, line, target);
      }

      await tx.registrationAuditLog.createMany({
        data: [...new Set(lines.map((l) => l.registrationId))].map(
          (registrationId) => ({
            tenantId,
            registrationId,
            action: 'section_auto_divided',
            actorId,
            metadata: {
              offeringId: dto.offeringId,
              strategy: dto.strategy,
              sectionCount: sections.length,
            },
          }),
        ),
      });
    });

    return {
      assigned: preview.length,
      sections: sections.length,
      strategy: dto.strategy,
      preview,
    };
  }

  async moveStudentToSection(
    tenantId: string,
    dto: MoveStudentSectionDto,
    actorId?: string,
  ) {
    const line = await this.prisma.semesterRegistrationLine.findFirst({
      where: { id: dto.lineId, tenantId },
      include: {
        registration: { select: { id: true, studentId: true } },
      },
    });
    if (!line) throw new NotFoundException('Registration line not found');

    const target = await this.prisma.offeringSection.findFirst({
      where: { id: dto.targetSectionId, tenantId, deletedAt: null },
      include: { seatLedger: true },
    });
    if (!target) throw new NotFoundException('Target section not found');
    if (target.courseOfferingId !== line.offeringId) {
      throw new BadRequestException(
        'Target section must belong to the same subject offering',
      );
    }

    const sortRow: StudentSortRow = {
      lineId: line.id,
      studentId: line.registration.studentId,
      rollNumber: '',
      fullName: '',
      gender: null,
      status: line.status,
      offeringSectionId: line.offeringSectionId,
      registrationId: line.registrationId,
    };

    await this.prisma.$transaction(async (tx) => {
      await this.transferLineSection(tx, tenantId, sortRow, target);
      await tx.registrationAuditLog.create({
        data: {
          tenantId,
          registrationId: line.registrationId,
          action: 'section_moved',
          actorId,
          metadata: {
            lineId: line.id,
            fromSectionId: line.offeringSectionId,
            toSectionId: target.id,
          },
        },
      });
    });

    return { ok: true, lineId: line.id, sectionId: target.id };
  }

  async importSectionAllocations(
    tenantId: string,
    dto: ImportSectionAllocationsDto,
    actorId?: string,
  ) {
    const shiftId =
      dto.shiftId ??
      (await this.poolSections.resolveDefaultShiftId(tenantId, 'DAY'));

    const sections = await this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        courseOfferingId: dto.offeringId,
        shiftId,
        deletedAt: null,
        status: 'active',
      },
      include: { seatLedger: true },
    });
    const sectionByCode = new Map(
      sections.map((s) => [s.sectionCode.toUpperCase(), s]),
    );

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringId: dto.offeringId,
        status: { in: ['pending', 'confirmed', 'waitlisted'] },
      },
      include: {
        registration: {
          include: {
            student: { select: { rollNumber: true } },
          },
        },
      },
    });
    const lineByRoll = new Map<string, (typeof lines)[0]>();
    for (const line of lines) {
      const roll = line.registration.student.rollNumber?.trim().toUpperCase();
      if (roll) lineByRoll.set(roll, line);
    }

    const results: Array<{
      rollNumber: string;
      sectionCode: string;
      ok: boolean;
      error?: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const roll = row.rollNumber.trim().toUpperCase();
        const code = row.sectionCode.trim().toUpperCase();
        const line = lineByRoll.get(roll);
        const section = sectionByCode.get(code);

        if (!line) {
          results.push({
            rollNumber: row.rollNumber,
            sectionCode: row.sectionCode,
            ok: false,
            error: 'Student not registered for this subject',
          });
          continue;
        }
        if (!section) {
          results.push({
            rollNumber: row.rollNumber,
            sectionCode: row.sectionCode,
            ok: false,
            error: `Section ${code} not found`,
          });
          continue;
        }

        try {
          await this.transferLineSection(
            tx,
            tenantId,
            {
              lineId: line.id,
              studentId: line.registration.studentId,
              rollNumber: roll,
              fullName: '',
              gender: null,
              status: line.status,
              offeringSectionId: line.offeringSectionId,
              registrationId: line.registrationId,
            },
            section,
          );
          results.push({
            rollNumber: row.rollNumber,
            sectionCode: row.sectionCode,
            ok: true,
          });
        } catch (error) {
          results.push({
            rollNumber: row.rollNumber,
            sectionCode: row.sectionCode,
            ok: false,
            error:
              error instanceof BadRequestException
                ? String(error.message)
                : 'Allocation failed',
          });
        }
      }

      if (results.some((r) => r.ok)) {
        await tx.registrationAuditLog.create({
          data: {
            tenantId,
            registrationId: lines[0]?.registrationId ?? '',
            action: 'section_imported',
            actorId,
            metadata: {
              offeringId: dto.offeringId,
              imported: results.filter((r) => r.ok).length,
              failed: results.filter((r) => !r.ok).length,
            },
          },
        });
      }
    });

    return {
      imported: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private buildOfferingWhere(
    tenantId: string,
    filters: SubjectSectionFiltersDto,
  ): Prisma.CourseOfferingWhereInput {
    const category = filters.category?.trim().toUpperCase();

    return {
      tenantId,
      deletedAt: null,
      ...(filters.semesterNo != null
        ? { semesterSequence: filters.semesterNo }
        : {}),
      ...(category
        ? { category: { equals: category, mode: 'insensitive' as const } }
        : {}),
      ...(filters.search
        ? {
            course: {
              OR: [
                { code: { contains: filters.search, mode: 'insensitive' } },
                { title: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
  }

  private async findOfferingLines(
    tenantId: string,
    dto: AutoDivideSubjectSectionsDto,
  ): Promise<StudentSortRow[]> {
    const studentWhere: Prisma.StudentWhereInput = {};
    if (dto.programVersionId)
      studentWhere.programVersionId = dto.programVersionId;
    if (dto.admissionBatchId) {
      studentWhere.academicProfile = { admissionBatchId: dto.admissionBatchId };
    }

    const registrationWhere: Prisma.SemesterRegistrationWhereInput = {};
    if (dto.semesterId) registrationWhere.semesterId = dto.semesterId;
    if (Object.keys(studentWhere).length) {
      registrationWhere.student = studentWhere;
    }

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringId: dto.offeringId,
        status: { in: ['pending', 'confirmed', 'waitlisted'] },
        ...(Object.keys(registrationWhere).length
          ? { registration: registrationWhere }
          : {}),
      },
      include: {
        registration: {
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                masterProfile: { select: { fullName: true, gender: true } },
              },
            },
          },
        },
      },
    });

    return lines.map((line) => ({
      lineId: line.id,
      registrationId: line.registrationId,
      studentId: line.registration.student.id,
      rollNumber: line.registration.student.rollNumber ?? '',
      fullName: line.registration.student.masterProfile?.fullName ?? '',
      gender: line.registration.student.masterProfile?.gender ?? null,
      status: line.status,
      offeringSectionId: line.offeringSectionId,
    }));
  }

  private sortStudentsForStrategy(
    rows: StudentSortRow[],
    strategy: SectionAllocationStrategy,
  ) {
    const copy = [...rows];
    switch (strategy) {
      case 'ROLL_NUMBER':
        return copy.sort((a, b) =>
          a.rollNumber.localeCompare(b.rollNumber, undefined, {
            numeric: true,
            sensitivity: 'base',
          }),
        );
      case 'ALPHABET':
        return copy.sort((a, b) =>
          a.fullName.localeCompare(b.fullName, undefined, {
            sensitivity: 'base',
          }),
        );
      case 'GENDER':
        return copy.sort((a, b) => {
          const ga = (a.gender ?? '').toUpperCase();
          const gb = (b.gender ?? '').toUpperCase();
          if (ga !== gb) return ga.localeCompare(gb);
          return a.rollNumber.localeCompare(b.rollNumber, undefined, {
            numeric: true,
          });
        });
      case 'RANDOM':
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j]!, copy[i]!];
        }
        return copy;
      case 'EQUAL':
      default:
        return copy.sort((a, b) =>
          a.rollNumber.localeCompare(b.rollNumber, undefined, {
            numeric: true,
          }),
        );
    }
  }

  private distributeEvenly<T>(rows: T[], bucketCount: number): T[][] {
    const buckets = Array.from({ length: bucketCount }, () => [] as T[]);
    rows.forEach((row, index) => {
      buckets[index % bucketCount]!.push(row);
    });
    return buckets;
  }

  private async transferLineSection(
    tx: Prisma.TransactionClient,
    tenantId: string,
    line: StudentSortRow & { registrationId?: string },
    target: {
      id: string;
      capacity: number;
      sectionCode: string;
      seatLedger?: { confirmedCount: number; waitlistCount: number } | null;
    },
  ) {
    if (line.offeringSectionId === target.id) return;

    const targetLedger =
      target.seatLedger ??
      (await tx.offeringSeatLedger.findUnique({
        where: { offeringSectionId: target.id },
      }));

    const targetConfirmed = targetLedger?.confirmedCount ?? 0;
    if (line.status === 'confirmed' && targetConfirmed >= target.capacity) {
      throw new BadRequestException(
        `Section ${target.sectionCode} is full (${target.capacity} seats)`,
      );
    }

    if (line.offeringSectionId) {
      const sourceLedger = await tx.offeringSeatLedger.findUnique({
        where: { offeringSectionId: line.offeringSectionId },
      });
      if (sourceLedger) {
        if (line.status === 'confirmed' && sourceLedger.confirmedCount > 0) {
          await tx.offeringSeatLedger.update({
            where: { offeringSectionId: line.offeringSectionId },
            data: { confirmedCount: { decrement: 1 } },
          });
        } else if (
          line.status === 'waitlisted' &&
          sourceLedger.waitlistCount > 0
        ) {
          await tx.offeringSeatLedger.update({
            where: { offeringSectionId: line.offeringSectionId },
            data: { waitlistCount: { decrement: 1 } },
          });
        }
      }
    }

    if (line.status === 'confirmed') {
      await tx.offeringSeatLedger.upsert({
        where: { offeringSectionId: target.id },
        create: { tenantId, offeringSectionId: target.id, confirmedCount: 1 },
        update: { confirmedCount: { increment: 1 } },
      });
    } else if (line.status === 'waitlisted') {
      await tx.offeringSeatLedger.upsert({
        where: { offeringSectionId: target.id },
        create: { tenantId, offeringSectionId: target.id, waitlistCount: 1 },
        update: { waitlistCount: { increment: 1 } },
      });
    }

    await tx.semesterRegistrationLine.update({
      where: { id: line.lineId },
      data: { offeringSectionId: target.id },
    });
  }

  private async getSectionById(tenantId: string, sectionId: string) {
    const section = await this.prisma.offeringSection.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        classroom: {
          select: { id: true, name: true, code: true, capacity: true },
        },
        courseOffering: {
          include: { course: { select: { code: true, title: true } } },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }
}
