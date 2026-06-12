import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { MAPPING_SOURCE } from '../academic-engine/domain/category-pools';
import { CurriculumResolutionService } from '../academic-engine/services/curriculum-resolution.service';
import { PrismaService } from '../../database/prisma.service';
import {
  applyQuickToggle,
  computeEnrollmentStatus,
  computeHasFaculty,
  computeIsHonours,
  computeMappingStatus,
  dedupeCurriculumOfferingRows,
  matchesEnrollmentStatusFilter,
  matchesFacultyFilter,
  matchesHonoursQuickToggle,
  matchesMappingStatusFilter,
} from './domain/curriculum-offering-list.helpers';
import type { CurriculumOfferingListQueryDto } from './dto/curriculum-offering-list-query.dto';
import { offeringIncludeWithSections } from './academic-catalog.service';

type MergedOfferingMeta = {
  poolId?: string;
  poolName?: string;
};

@Injectable()
export class CurriculumOfferingListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
  ) {}

  async listCurriculumOfferings(
    tenantId: string,
    rawQuery: CurriculumOfferingListQueryDto,
  ) {
    const query = applyQuickToggle(rawQuery);
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;

    const mergedMeta = await this.resolveMergedOfferingMeta(
      tenantId,
      query.programVersionId,
      query.semesterSequence,
    );
    const mergedIds = mergedMeta ? [...mergedMeta.keys()] : undefined;

    const where = this.buildWhereClause(tenantId, query, mergedIds);
    const needsMemoryFilter = Boolean(
      query.mappingStatus ||
      query.enrollmentStatus ||
      query.facultyAssigned !== undefined ||
      query.quickToggle === 'HONOURS',
    );

    const orderBy: Prisma.CourseOfferingOrderByWithRelationInput[] = [
      { semesterSequence: 'asc' },
      { category: 'asc' },
      { course: { code: 'asc' } },
    ];

    if (needsMemoryFilter) {
      const rows = await this.prisma.courseOffering.findMany({
        where,
        include: {
          ...offeringIncludeWithSections,
          sections: {
            ...offeringIncludeWithSections.sections,
            include: {
              ...offeringIncludeWithSections.sections.include,
              subjectAssignments: { select: { id: true } },
            },
          },
        },
        orderBy,
      });

      const filtered = dedupeCurriculumOfferingRows(
        rows.filter((row) => this.matchesMemoryFilters(row, query)),
      );
      const total = filtered.length;
      const slice = filtered.slice((page - 1) * limit, page * limit);
      const data = slice.map((row) => this.toCurriculumRow(row, mergedMeta));
      return paginate(data, total, page, limit);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.courseOffering.count({ where }),
      this.prisma.courseOffering.findMany({
        where,
        include: offeringIncludeWithSections,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = dedupeCurriculumOfferingRows(
      rows.map((row) => this.toCurriculumRow(row, mergedMeta)),
    );
    return paginate(data, total, page, limit);
  }

  private async resolveMergedOfferingMeta(
    tenantId: string,
    programVersionId?: string,
    semesterFilter?: number[],
  ): Promise<Map<string, MergedOfferingMeta> | null> {
    if (!programVersionId) return null;

    const semesters =
      (semesterFilter?.length ?? 0) > 0
        ? semesterFilter!
        : await this.resolveProgramSemesters(tenantId, programVersionId);

    const meta = new Map<string, MergedOfferingMeta>();
    for (const semesterSequence of semesters) {
      const resolved = await this.curriculum.resolveProgrammeCurriculum(
        tenantId,
        programVersionId,
        semesterSequence,
      );
      for (const offering of resolved.directOfferings) {
        meta.set(offering.id, {});
      }
      for (const row of resolved.inheritedPoolOfferings) {
        meta.set(row.offering.id, {
          poolId: row.poolId,
          poolName: row.poolName,
        });
      }
    }
    return meta;
  }

  private async resolveProgramSemesters(
    tenantId: string,
    programVersionId: string,
  ): Promise<number[]> {
    const [assignments, direct, rules] = await Promise.all([
      this.prisma.programmePoolAssignment.findMany({
        where: { tenantId, programVersionId, active: true },
        select: { semesterNo: true },
      }),
      this.prisma.courseOffering.findMany({
        where: {
          tenantId,
          programVersionId,
          deletedAt: null,
          mappingSource: MAPPING_SOURCE.DIRECT,
        },
        select: { semesterSequence: true },
      }),
      this.prisma.semesterStructureRule.findMany({
        where: { tenantId, programVersionId },
        select: { semesterSequence: true },
      }),
    ]);

    const set = new Set<number>();
    for (const row of assignments) set.add(row.semesterNo);
    for (const row of direct) {
      if (row.semesterSequence != null) set.add(row.semesterSequence);
    }
    for (const row of rules) set.add(row.semesterSequence);
    if (!set.size) {
      for (let i = 1; i <= 8; i += 1) set.add(i);
    }
    return [...set].sort((a, b) => a - b);
  }

  private buildWhereClause(
    tenantId: string,
    query: CurriculumOfferingListQueryDto,
    mergedIds?: string[],
  ): Prisma.CourseOfferingWhereInput {
    const sectionActive: Prisma.OfferingSectionWhereInput = {
      deletedAt: null,
      status: 'active',
    };

    const courseWhere: Prisma.CourseWhereInput = {
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.deliveryType ? { deliveryType: query.deliveryType } : {}),
      ...(query.credits === 'gt4'
        ? { credits: { gt: 4 } }
        : query.credits
          ? { credits: Number(query.credits) }
          : {}),
      ...(query.quickToggle === 'LABS' ? { labRequired: true } : {}),
      ...(query.quickToggle === 'HAS_PRACTICAL' ? { hasPractical: true } : {}),
    };

    const versionStatusWhere = this.versionStatusWhere(query.versionStatus);

    const hasCourseFilter = Boolean(
      query.departmentId ||
      query.deliveryType ||
      query.credits ||
      query.quickToggle === 'LABS' ||
      query.quickToggle === 'HAS_PRACTICAL',
    );

    const and: Prisma.CourseOfferingWhereInput[] = [
      { tenantId, deletedAt: null },
      ...(mergedIds ? [{ id: { in: mergedIds } }] : []),
      ...(query.category?.length ? [{ category: { in: query.category } }] : []),
      ...(query.semesterSequence?.length
        ? [{ semesterSequence: { in: query.semesterSequence } }]
        : []),
      ...(query.isSharedPool === true
        ? [{ mappingSource: MAPPING_SOURCE.SHARED_POOL }]
        : query.isSharedPool === false
          ? [
              {
                mappingSource: MAPPING_SOURCE.DIRECT,
                programVersionId: { not: null },
              },
            ]
          : []),
      ...(query.streamId
        ? [
            {
              sections: {
                some: {
                  ...sectionActive,
                  eligibleStreams: {
                    some: { academicStreamId: query.streamId },
                  },
                },
              },
            },
          ]
        : []),
      ...(query.shiftId
        ? [{ sections: { some: { ...sectionActive, shiftId: query.shiftId } } }]
        : []),
      ...(query.mappingStatus === 'UNMAPPED'
        ? [{ sections: { none: sectionActive } }]
        : []),
      ...(hasCourseFilter ? [{ course: courseWhere }] : []),
      ...(versionStatusWhere ? [versionStatusWhere] : []),
      ...(query.search?.trim()
        ? [{ OR: this.buildSearchOr(query.search.trim(), sectionActive) }]
        : []),
    ];

    return { AND: and };
  }

  private versionStatusWhere(
    status?: CurriculumOfferingListQueryDto['versionStatus'],
  ): Prisma.CourseOfferingWhereInput | null {
    if (!status || status === 'ALL') return null;
    if (status === 'ACTIVE') {
      return {
        OR: [
          { programVersion: { status: 'PUBLISHED', deletedAt: null } },
          { mappingSource: MAPPING_SOURCE.SHARED_POOL },
        ],
      };
    }
    if (status === 'DRAFT') {
      return { programVersion: { status: 'DRAFT', deletedAt: null } };
    }
    if (status === 'ARCHIVED') {
      return { programVersion: { status: 'ARCHIVED', deletedAt: null } };
    }
    return null;
  }

  private buildSearchOr(
    term: string,
    sectionActive: Prisma.OfferingSectionWhereInput,
  ): Prisma.CourseOfferingWhereInput[] {
    const contains = { contains: term, mode: 'insensitive' as const };
    return [
      { course: { code: contains } },
      { course: { title: contains } },
      {
        course: {
          department: { OR: [{ name: contains }, { code: contains }] },
        },
      },
      {
        sections: {
          some: {
            ...sectionActive,
            OR: [
              { sectionCode: contains },
              {
                staffProfile: {
                  OR: [
                    { fullName: contains },
                    { employeeCode: contains },
                    { portalUser: { email: contains } },
                  ],
                },
              },
            ],
          },
        },
      },
      {
        programVersion: {
          program: { OR: [{ code: contains }, { name: contains }] },
        },
      },
    ];
  }

  private matchesMemoryFilters(
    row: Prisma.CourseOfferingGetPayload<{
      include: typeof offeringIncludeWithSections & {
        sections: {
          include: {
            subjectAssignments: { select: { id: true } };
          };
        };
      };
    }>,
    query: CurriculumOfferingListQueryDto,
  ): boolean {
    const sections = (row.sections ?? []).map((section) => ({
      sectionCode: section.sectionCode,
      shiftId: section.shiftId,
      capacity: section.capacity,
      studentGroup: section.studentGroup,
      staffProfileId: section.staffProfileId,
      seatLedger: section.seatLedger,
      subjectAssignments: section.subjectAssignments,
    }));

    const mappingStatus = computeMappingStatus(sections);
    const enrollmentStatus = computeEnrollmentStatus(sections);
    const hasFaculty = computeHasFaculty(sections);

    if (!matchesMappingStatusFilter(mappingStatus, query.mappingStatus)) {
      return false;
    }
    if (
      !matchesEnrollmentStatusFilter(enrollmentStatus, query.enrollmentStatus)
    ) {
      return false;
    }
    if (!matchesFacultyFilter(hasFaculty, query.facultyAssigned)) {
      return false;
    }
    if (
      query.quickToggle === 'HONOURS' &&
      !matchesHonoursQuickToggle({
        majorPaperIndex: row.majorPaperIndex,
        sections,
      })
    ) {
      return false;
    }
    return true;
  }

  private toCurriculumRow(
    row: Prisma.CourseOfferingGetPayload<{
      include: typeof offeringIncludeWithSections;
    }>,
    mergedMeta: Map<string, MergedOfferingMeta> | null,
  ) {
    const sections = (row.sections ?? []).map((section) => ({
      sectionCode: section.sectionCode,
      shiftId: section.shiftId,
      capacity: section.capacity,
      studentGroup: section.studentGroup,
      staffProfileId: section.staffProfileId,
      seatLedger: section.seatLedger,
    }));
    const meta = mergedMeta?.get(row.id);
    const mappingStatus = computeMappingStatus(sections);
    const enrollmentStatus = computeEnrollmentStatus(sections);
    const hasFaculty = computeHasFaculty(
      sections.map((section) => ({ ...section, subjectAssignments: [] })),
    );

    return {
      ...row,
      mappingSource:
        row.mappingSource ??
        (row.programVersionId
          ? MAPPING_SOURCE.DIRECT
          : MAPPING_SOURCE.SHARED_POOL),
      poolId: meta?.poolId ?? row.categoryPoolId ?? null,
      poolName: meta?.poolName ?? null,
      mappingStatus,
      enrollmentStatus,
      hasFaculty,
      isHonours: computeIsHonours({
        majorPaperIndex: row.majorPaperIndex,
        sections,
      }),
      isCrossListed: false,
      faculty: row.sections?.[0]?.staffProfile ?? null,
    };
  }
}
