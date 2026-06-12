import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  assertPoolEligibleCategory,
  MAPPING_SOURCE,
} from '../domain/category-pools';
import { resolveTenantSharedPoolCapacity } from '../domain/section-capacity';
import type {
  AddPoolCourseDto,
  AssignPoolDto,
  CreateCategoryPoolDto,
  PoolAssignmentItemDto,
  UpdateCategoryPoolDto,
  UpsertPoolExclusionDto,
} from '../dto/category-pool.dto';
import { CurriculumResolutionService } from './curriculum-resolution.service';
import { PoolSectionProvisioningService } from './pool-section-provisioning.service';

export type PoolAssignPreviewItem = {
  programVersionId: string;
  programCode: string;
  programName: string;
  version: number;
  assigned: boolean;
  skippedReason?: string;
};

@Injectable()
export class CategoryPoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly poolSections: PoolSectionProvisioningService,
  ) {}

  async getPoolUtilization(
    tenantId: string,
    filters: { institutionId?: string },
  ) {
    const pools = await this.prisma.categoryPool.findMany({
      where: {
        tenantId,
        active: true,
        ...(filters.institutionId
          ? { institutionId: filters.institutionId }
          : {}),
      },
      select: {
        id: true,
        poolName: true,
        offerings: {
          where: { deletedAt: null, mappingSource: MAPPING_SOURCE.SHARED_POOL },
          select: {
            sections: {
              where: { deletedAt: null },
              select: {
                id: true,
                sectionCode: true,
                capacity: true,
                shift: { select: { code: true } },
                seatLedger: {
                  select: { confirmedCount: true, waitlistCount: true },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { categoryType: 'asc' },
        { semesterNo: 'asc' },
        { poolName: 'asc' },
      ],
    });

    return pools.map((pool) => ({
      poolId: pool.id,
      poolName: pool.poolName,
      sections: pool.offerings.flatMap((offering) =>
        offering.sections.map((section) => ({
          sectionId: section.id,
          sectionCode: section.sectionCode,
          shift: section.shift.code,
          capacity: section.capacity,
          confirmed: section.seatLedger?.confirmedCount ?? 0,
          waitlisted: section.seatLedger?.waitlistCount ?? 0,
        })),
      ),
    }));
  }

  listPools(
    tenantId: string,
    filters: {
      institutionId?: string;
      categoryType?: string;
      semesterNo?: number;
      activeOnly?: boolean;
    },
  ) {
    return this.prisma.categoryPool.findMany({
      where: {
        tenantId,
        ...(filters.institutionId
          ? { institutionId: filters.institutionId }
          : {}),
        ...(filters.categoryType
          ? { categoryType: assertPoolEligibleCategory(filters.categoryType) }
          : {}),
        ...(filters.semesterNo != null
          ? { semesterNo: filters.semesterNo }
          : {}),
        ...(filters.activeOnly !== false ? { active: true } : {}),
      },
      include: {
        _count: {
          select: { courses: true, assignments: true, offerings: true },
        },
        createdBy: { select: { id: true, email: true } },
      },
      orderBy: [
        { categoryType: 'asc' },
        { semesterNo: 'asc' },
        { poolName: 'asc' },
      ],
    });
  }

  async getPool(tenantId: string, poolId: string) {
    const pool = await this.prisma.categoryPool.findFirst({
      where: { id: poolId, tenantId },
      include: {
        courses: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: { course: true },
        },
        offerings: {
          where: { deletedAt: null, mappingSource: MAPPING_SOURCE.SHARED_POOL },
          include: {
            course: true,
            sections: {
              where: { deletedAt: null },
              include: { shift: true, seatLedger: true },
            },
          },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
        assignments: {
          where: { active: true },
          include: {
            programVersion: {
              include: { program: { select: { code: true, name: true } } },
            },
          },
        },
        createdBy: { select: { id: true, email: true } },
      },
    });
    if (!pool) throw new NotFoundException('Category pool not found');
    return pool;
  }

  async createPool(
    tenantId: string,
    userId: string | undefined,
    dto: CreateCategoryPoolDto,
  ) {
    let categoryType: string;
    try {
      categoryType = assertPoolEligibleCategory(dto.categoryType);
    } catch {
      throw new BadRequestException(
        `Category "${dto.categoryType}" is not eligible for shared pools`,
      );
    }
    await this.assertInstitution(tenantId, dto.institutionId);

    try {
      return await this.prisma.categoryPool.create({
        data: {
          tenantId,
          institutionId: dto.institutionId,
          poolName: dto.poolName.trim(),
          semesterNo: dto.semesterNo,
          categoryType,
          active: dto.active ?? true,
          createdById: userId,
        },
        include: {
          _count: { select: { courses: true, assignments: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A pool with this name already exists for the institution',
        );
      }
      throw error;
    }
  }

  async updatePool(
    tenantId: string,
    poolId: string,
    dto: UpdateCategoryPoolDto,
  ) {
    const current = await this.getPool(tenantId, poolId);
    const categoryType = dto.categoryType
      ? assertPoolEligibleCategory(dto.categoryType)
      : current.categoryType;
    const semesterNo = dto.semesterNo ?? current.semesterNo;

    if (dto.categoryType != null || dto.semesterNo != null) {
      const assignmentCount = await this.prisma.programmePoolAssignment.count({
        where: { poolId, active: true },
      });
      if (assignmentCount > 0) {
        throw new BadRequestException(
          'Cannot change semester or category while pool is assigned to programmes',
        );
      }
    }

    try {
      return await this.prisma.categoryPool.update({
        where: { id: poolId },
        data: {
          ...(dto.poolName != null ? { poolName: dto.poolName.trim() } : {}),
          ...(dto.categoryType != null ? { categoryType } : {}),
          ...(dto.semesterNo != null ? { semesterNo } : {}),
          ...(dto.active != null ? { active: dto.active } : {}),
        },
        include: {
          courses: { include: { course: true } },
          _count: { select: { courses: true, assignments: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A pool with this name already exists for the institution',
        );
      }
      throw error;
    }
  }

  async deletePool(tenantId: string, poolId: string) {
    await this.getPool(tenantId, poolId);
    const regCount = await this.prisma.semesterRegistrationLine.count({
      where: {
        offering: { categoryPoolId: poolId, deletedAt: null },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    if (regCount > 0) {
      throw new BadRequestException(
        'Cannot delete pool with active registration lines',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseOffering.updateMany({
        where: { categoryPoolId: poolId, tenantId },
        data: { deletedAt: new Date() },
      });
      await tx.categoryPool.delete({ where: { id: poolId } });
    });
    return { deleted: true };
  }

  async provisionMissingPoolSections(
    tenantId: string,
    dto: {
      semesterNo?: number;
      categories?: string[];
      shiftCode?: string;
      institutionId?: string;
      poolId?: string;
    },
  ) {
    return this.poolSections.provisionPoolOfferings(tenantId, dto);
  }

  async addPoolCourse(tenantId: string, poolId: string, dto: AddPoolCourseDto) {
    const pool = await this.getPool(tenantId, poolId);
    await this.assertCourse(tenantId, dto.courseId);
    await this.syncCanonicalOffering(
      tenantId,
      pool,
      dto.courseId,
      dto.displayOrder ?? 0,
    );

    return this.prisma.categoryPoolCourse.upsert({
      where: {
        poolId_courseId: { poolId, courseId: dto.courseId },
      },
      create: {
        poolId,
        courseId: dto.courseId,
        displayOrder: dto.displayOrder ?? 0,
        active: dto.active ?? true,
      },
      update: {
        displayOrder: dto.displayOrder ?? undefined,
        active: dto.active ?? true,
      },
      include: { course: true },
    });
  }

  async removePoolCourse(tenantId: string, poolId: string, courseId: string) {
    await this.getPool(tenantId, poolId);
    const regCount = await this.prisma.semesterRegistrationLine.count({
      where: {
        offering: {
          categoryPoolId: poolId,
          courseId,
          deletedAt: null,
        },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    if (regCount > 0) {
      throw new BadRequestException(
        'Cannot remove course from pool with active registrations',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseOffering.updateMany({
        where: {
          tenantId,
          categoryPoolId: poolId,
          courseId,
          mappingSource: MAPPING_SOURCE.SHARED_POOL,
        },
        data: { deletedAt: new Date() },
      });
      await tx.categoryPoolCourse.deleteMany({ where: { poolId, courseId } });
    });
    return { removed: true };
  }

  async getProgramAssignments(tenantId: string, programVersionId: string) {
    await this.assertProgramVersion(tenantId, programVersionId);
    return this.prisma.programmePoolAssignment.findMany({
      where: { tenantId, programVersionId },
      include: {
        pool: {
          include: {
            _count: { select: { courses: { where: { active: true } } } },
          },
        },
      },
      orderBy: [{ semesterNo: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async upsertProgramAssignments(
    tenantId: string,
    programVersionId: string,
    assignments: PoolAssignmentItemDto[],
  ) {
    const version = await this.assertProgramVersion(tenantId, programVersionId);
    const institutionId =
      await this.curriculum.resolveProgramVersionInstitutionId(
        tenantId,
        programVersionId,
      );

    for (const item of assignments) {
      const pool = await this.prisma.categoryPool.findFirst({
        where: { id: item.poolId, tenantId, active: true },
      });
      if (!pool) throw new NotFoundException(`Pool ${item.poolId} not found`);
      if (institutionId && pool.institutionId !== institutionId) {
        throw new BadRequestException(
          `Pool "${pool.poolName}" belongs to a different institution`,
        );
      }
      if (pool.semesterNo !== item.semesterNo) {
        throw new BadRequestException(
          `Pool "${pool.poolName}" is for semester ${pool.semesterNo}, not ${item.semesterNo}`,
        );
      }
    }

    await this.prisma.$transaction(
      assignments.map((item) =>
        this.prisma.programmePoolAssignment.upsert({
          where: {
            programVersionId_semesterNo_poolId: {
              programVersionId,
              semesterNo: item.semesterNo,
              poolId: item.poolId,
            },
          },
          create: {
            tenantId,
            programVersionId,
            semesterNo: item.semesterNo,
            poolId: item.poolId,
            active: item.active,
          },
          update: { active: item.active },
        }),
      ),
    );

    return this.getProgramAssignments(tenantId, programVersionId);
  }

  async upsertPoolExclusion(
    tenantId: string,
    programVersionId: string,
    dto: UpsertPoolExclusionDto,
  ) {
    await this.assertProgramVersion(tenantId, programVersionId);
    await this.getPool(tenantId, dto.poolId);
    await this.assertCourse(tenantId, dto.courseId);

    return this.prisma.programmePoolCourseExclusion.upsert({
      where: {
        programVersionId_poolId_courseId: {
          programVersionId,
          poolId: dto.poolId,
          courseId: dto.courseId,
        },
      },
      create: {
        tenantId,
        programVersionId,
        poolId: dto.poolId,
        courseId: dto.courseId,
        active: dto.active,
      },
      update: { active: dto.active },
      include: { course: true, pool: { select: { poolName: true } } },
    });
  }

  async listProgramExclusions(tenantId: string, programVersionId: string) {
    await this.assertProgramVersion(tenantId, programVersionId);
    return this.prisma.programmePoolCourseExclusion.findMany({
      where: { tenantId, programVersionId, active: true },
      include: {
        course: { select: { id: true, code: true, title: true } },
        pool: {
          select: {
            id: true,
            poolName: true,
            categoryType: true,
            semesterNo: true,
          },
        },
      },
    });
  }

  async resolveAssignTargets(tenantId: string, dto: AssignPoolDto) {
    if (dto.mode === 'SELECTED_VERSIONS') {
      if (!dto.programVersionIds?.length) {
        throw new BadRequestException('programVersionIds required');
      }
      return this.prisma.programVersion.findMany({
        where: {
          tenantId,
          deletedAt: null,
          id: { in: dto.programVersionIds },
        },
        include: { program: true },
      });
    }

    if (dto.mode === 'SELECTED_PROGRAMS') {
      if (!dto.programIds?.length) {
        throw new BadRequestException('programIds required');
      }
      return this.prisma.programVersion.findMany({
        where: {
          tenantId,
          deletedAt: null,
          programId: { in: dto.programIds },
        },
        include: { program: true },
      });
    }

    return this.prisma.programVersion.findMany({
      where: {
        tenantId,
        deletedAt: null,
        program: { level: 'UG' },
      },
      include: { program: true },
    });
  }

  async previewAssignPool(
    tenantId: string,
    poolId: string,
    dto: AssignPoolDto,
  ) {
    const pool = await this.getPool(tenantId, poolId);
    const targets = await this.resolveAssignTargets(tenantId, dto);
    const items: PoolAssignPreviewItem[] = [];

    for (const target of targets) {
      const institutionId =
        await this.curriculum.resolveProgramVersionInstitutionId(
          tenantId,
          target.id,
        );
      if (institutionId && institutionId !== pool.institutionId) {
        items.push({
          programVersionId: target.id,
          programCode: target.program.code,
          programName: target.program.name,
          version: target.version,
          assigned: false,
          skippedReason: 'Different institution',
        });
        continue;
      }

      const existing = await this.prisma.programmePoolAssignment.findUnique({
        where: {
          programVersionId_semesterNo_poolId: {
            programVersionId: target.id,
            semesterNo: pool.semesterNo,
            poolId,
          },
        },
      });

      items.push({
        programVersionId: target.id,
        programCode: target.program.code,
        programName: target.program.name,
        version: target.version,
        assigned: !existing?.active,
        skippedReason: existing?.active ? 'Already assigned' : undefined,
      });
    }

    return { poolId, poolName: pool.poolName, items };
  }

  async assignPool(tenantId: string, poolId: string, dto: AssignPoolDto) {
    const preview = await this.previewAssignPool(tenantId, poolId, dto);
    const pool = await this.getPool(tenantId, poolId);
    const toAssign = preview.items.filter((item) => item.assigned);

    await this.prisma.$transaction(
      toAssign.map((item) =>
        this.prisma.programmePoolAssignment.upsert({
          where: {
            programVersionId_semesterNo_poolId: {
              programVersionId: item.programVersionId,
              semesterNo: pool.semesterNo,
              poolId,
            },
          },
          create: {
            tenantId,
            programVersionId: item.programVersionId,
            semesterNo: pool.semesterNo,
            poolId,
            active: true,
          },
          update: { active: true },
        }),
      ),
    );

    return {
      assigned: toAssign.length,
      skipped: preview.items.length - toAssign.length,
      items: preview.items,
    };
  }

  async getCurriculumCoverageReport(
    tenantId: string,
    programVersionId: string,
    semesterSequence?: number,
  ) {
    await this.assertProgramVersion(tenantId, programVersionId);
    const rules = await this.prisma.semesterStructureRule.findMany({
      where: {
        tenantId,
        programVersionId,
        ...(semesterSequence != null ? { semesterSequence } : {}),
      },
      orderBy: { semesterSequence: 'asc' },
    });

    const rows = [];
    for (const rule of rules) {
      const counts = rule.categoryCounts as Record<string, number>;
      const resolved = await this.curriculum.resolveProgrammeCurriculum(
        tenantId,
        programVersionId,
        rule.semesterSequence,
      );

      const byCategory: Record<
        string,
        { direct: number; pool: number; total: number; required: number }
      > = {};

      for (const [cat, required] of Object.entries(counts)) {
        const direct = resolved.directOfferings.filter(
          (o) => o.category === cat,
        ).length;
        const pool = resolved.inheritedPoolOfferings.filter(
          (o) => o.offering.category === cat,
        ).length;
        byCategory[cat] = { direct, pool, total: direct + pool, required };
      }

      rows.push({
        semesterSequence: rule.semesterSequence,
        byCategory,
      });
    }

    return { programVersionId, rows };
  }

  private async syncCanonicalOffering(
    tenantId: string,
    pool: { id: string; semesterNo: number; categoryType: string },
    courseId: string,
    displayOrder: number,
  ) {
    const sharedPoolCapacity = await resolveTenantSharedPoolCapacity(
      this.prisma,
      tenantId,
    );
    const existing = await this.prisma.courseOffering.findFirst({
      where: {
        tenantId,
        categoryPoolId: pool.id,
        courseId,
        mappingSource: MAPPING_SOURCE.SHARED_POOL,
      },
    });

    let offeringId: string;

    if (existing?.deletedAt) {
      await this.prisma.courseOffering.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          semesterSequence: pool.semesterNo,
          category: pool.categoryType,
          displayOrder,
        },
      });
      offeringId = existing.id;
    } else {
      const row = await this.prisma.courseOffering.upsert({
        where: {
          categoryPoolId_courseId: { categoryPoolId: pool.id, courseId },
        },
        create: {
          tenantId,
          categoryPoolId: pool.id,
          mappingSource: MAPPING_SOURCE.SHARED_POOL,
          courseId,
          semesterSequence: pool.semesterNo,
          category: pool.categoryType,
          displayOrder,
          programVersionId: null,
          capacity: sharedPoolCapacity,
        },
        update: {
          deletedAt: null,
          semesterSequence: pool.semesterNo,
          category: pool.categoryType,
          displayOrder,
        },
      });
      offeringId = row.id;
    }

    await this.poolSections.ensureDefaultSection(tenantId, offeringId, {
      shiftCode: 'DAY',
      sectionCode: 'A',
    });
  }

  private async assertInstitution(tenantId: string, institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
    if (!institution) throw new NotFoundException('Institution not found');
    return institution;
  }

  private async assertCourse(tenantId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async assertProgramVersion(
    tenantId: string,
    programVersionId: string,
  ) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: { program: true },
    });
    if (!version) throw new NotFoundException('Program version not found');
    return version;
  }
}
