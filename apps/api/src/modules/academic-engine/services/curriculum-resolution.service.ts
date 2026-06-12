import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MAPPING_SOURCE } from '../domain/category-pools';

export type ResolvedPoolOffering = {
  offering: Prisma.CourseOfferingGetPayload<{
    include: {
      course: true;
      sections: { include: { shift: true; seatLedger: true } };
    };
  }>;
  poolId: string;
  poolName: string;
  mappingSource: typeof MAPPING_SOURCE.SHARED_POOL;
  effectiveProgramVersionId: string;
};

export type ResolvedCurriculum = {
  directOfferings: Prisma.CourseOfferingGetPayload<{
    include: {
      course: {
        include: {
          department: { select: { id: true; name: true; code: true } };
        };
      };
    };
  }>[];
  inheritedPoolOfferings: ResolvedPoolOffering[];
};

const courseWithDepartmentInclude = {
  department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CourseInclude;

const offeringInclude = {
  course: { include: courseWithDepartmentInclude },
  sections: {
    where: { deletedAt: null },
    include: { shift: true, seatLedger: true },
  },
} satisfies Prisma.CourseOfferingInclude;

const directOfferingInclude = {
  course: { include: courseWithDepartmentInclude },
} satisfies Prisma.CourseOfferingInclude;

@Injectable()
export class CurriculumResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCategory(category?: string) {
    return category?.trim().toUpperCase();
  }

  /** Programme-scoped DIRECT mappings, including legacy rows without explicit mappingSource. */
  private directOfferingWhere(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    filters?: { category?: string },
  ): Prisma.CourseOfferingWhereInput {
    const normalizedCategory = this.normalizeCategory(filters?.category);
    return {
      tenantId,
      deletedAt: null,
      programVersionId,
      semesterSequence,
      OR: [{ mappingSource: MAPPING_SOURCE.DIRECT }, { categoryPoolId: null }],
      ...(normalizedCategory
        ? { category: { equals: normalizedCategory, mode: 'insensitive' } }
        : {}),
    };
  }

  async resolveProgramVersionInstitutionId(
    tenantId: string,
    programVersionId: string,
  ): Promise<string | null> {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: {
        program: {
          include: { department: { select: { institutionId: true } } },
        },
      },
    });
    return version?.program?.department?.institutionId ?? null;
  }

  async getAssignedPoolIds(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
  ): Promise<string[]> {
    const rows = await this.prisma.programmePoolAssignment.findMany({
      where: {
        tenantId,
        programVersionId,
        semesterNo: semesterSequence,
        active: true,
        pool: { active: true },
      },
      select: { poolId: true },
    });
    return rows.map((row) => row.poolId);
  }

  async getExcludedCourseIdsByPool(
    tenantId: string,
    programVersionId: string,
    poolIds: string[],
  ): Promise<Map<string, Set<string>>> {
    if (!poolIds.length) return new Map();
    const rows = await this.prisma.programmePoolCourseExclusion.findMany({
      where: {
        tenantId,
        programVersionId,
        poolId: { in: poolIds },
        active: true,
      },
      select: { poolId: true, courseId: true },
    });
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = map.get(row.poolId) ?? new Set<string>();
      set.add(row.courseId);
      map.set(row.poolId, set);
    }
    return map;
  }

  async resolveProgrammeCurriculum(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    filters?: { category?: string },
  ): Promise<ResolvedCurriculum> {
    const poolIds = await this.getAssignedPoolIds(
      tenantId,
      programVersionId,
      semesterSequence,
    );
    const exclusions = await this.getExcludedCourseIdsByPool(
      tenantId,
      programVersionId,
      poolIds,
    );

    const normalizedCategory = this.normalizeCategory(filters?.category);

    const [directOfferings, poolRows] = await Promise.all([
      this.prisma.courseOffering.findMany({
        where: this.directOfferingWhere(
          tenantId,
          programVersionId,
          semesterSequence,
          filters,
        ),
        include: directOfferingInclude,
        orderBy: [
          { category: 'asc' },
          { majorPaperIndex: 'asc' },
          { displayOrder: 'asc' },
          { course: { code: 'asc' } },
          { createdAt: 'asc' },
        ],
      }),
      poolIds.length
        ? this.prisma.categoryPool.findMany({
            where: {
              tenantId,
              id: { in: poolIds },
              active: true,
              semesterNo: semesterSequence,
              ...(normalizedCategory
                ? { categoryType: normalizedCategory }
                : {}),
            },
            include: {
              offerings: {
                where: {
                  tenantId,
                  deletedAt: null,
                  mappingSource: MAPPING_SOURCE.SHARED_POOL,
                  semesterSequence,
                },
                include: offeringInclude,
                orderBy: [
                  { majorPaperIndex: 'asc' },
                  { displayOrder: 'asc' },
                  { course: { code: 'asc' } },
                  { createdAt: 'asc' },
                ],
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const inheritedPoolOfferings: ResolvedPoolOffering[] = [];
    for (const pool of poolRows) {
      const excluded = exclusions.get(pool.id) ?? new Set<string>();
      for (const offering of pool.offerings) {
        if (excluded.has(offering.courseId)) continue;
        inheritedPoolOfferings.push({
          offering,
          poolId: pool.id,
          poolName: pool.poolName,
          mappingSource: MAPPING_SOURCE.SHARED_POOL,
          effectiveProgramVersionId: programVersionId,
        });
      }
    }

    return { directOfferings, inheritedPoolOfferings };
  }

  async resolveCatalogSectionWhere(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    filters?: { category?: string },
  ): Promise<Prisma.OfferingSectionWhereInput> {
    const poolIds = await this.getAssignedPoolIds(
      tenantId,
      programVersionId,
      semesterSequence,
    );

    const normalizedCategory = this.normalizeCategory(filters?.category);
    const poolOfferingFilter: Prisma.CourseOfferingWhereInput = poolIds.length
      ? {
          mappingSource: MAPPING_SOURCE.SHARED_POOL,
          categoryPoolId: { in: poolIds },
          semesterSequence,
          deletedAt: null,
          ...(normalizedCategory
            ? { category: { equals: normalizedCategory, mode: 'insensitive' } }
            : {}),
        }
      : { id: { in: [] } };

    return {
      tenantId,
      deletedAt: null,
      status: 'active',
      courseOffering: {
        deletedAt: null,
        OR: [
          this.directOfferingWhere(
            tenantId,
            programVersionId,
            semesterSequence,
            filters,
          ),
          poolOfferingFilter,
        ],
      },
    };
  }

  async filterSectionsByPoolExclusions<
    T extends {
      courseOffering: {
        id: string;
        courseId: string;
        categoryPoolId: string | null;
      };
    },
  >(tenantId: string, programVersionId: string, sections: T[]): Promise<T[]> {
    const poolIds = [
      ...new Set(
        sections
          .map((s) => s.courseOffering.categoryPoolId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!poolIds.length) return sections;

    const exclusions = await this.getExcludedCourseIdsByPool(
      tenantId,
      programVersionId,
      poolIds,
    );
    if (!exclusions.size) return sections;

    return sections.filter((section) => {
      const poolId = section.courseOffering.categoryPoolId;
      if (!poolId) return true;
      const excluded = exclusions.get(poolId);
      return !excluded?.has(section.courseOffering.courseId);
    });
  }

  annotateSection<
    T extends {
      courseOffering: {
        mappingSource: string;
        categoryPoolId: string | null;
      };
    },
  >(
    section: T,
    poolMeta?: Map<string, { poolName: string }>,
  ): T & {
    mappingSource: string;
    poolId?: string;
    poolName?: string;
  } {
    const poolId = section.courseOffering.categoryPoolId ?? undefined;
    return {
      ...section,
      mappingSource: section.courseOffering.mappingSource,
      poolId,
      poolName: poolId ? poolMeta?.get(poolId)?.poolName : undefined,
    };
  }
}

export { offeringInclude as curriculumOfferingInclude };
