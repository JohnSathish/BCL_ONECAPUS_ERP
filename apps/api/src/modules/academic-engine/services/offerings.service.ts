import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { OfferingSectionStreamsService } from '../../../common/services/offering-section-streams.service';
import { ShiftScopeService } from '../../../common/services/shift-scope.service';
import {
  isStudentEligibleForSection,
  formatStreamIneligibleMessage,
} from '../../../common/utils/stream-eligibility';
import { PrismaService } from '../../../database/prisma.service';
import {
  AcademicCatalogService,
  sectionStreamInclude,
} from '../../programs-courses/academic-catalog.service';
import type { CreateOfferingSectionDto } from '../dto/academic-engine.dto';
import { CurriculumResolutionService } from './curriculum-resolution.service';
import { CourseEligibilityService } from './course-eligibility.service';
import type { EligibilityPreviewInput } from './course-eligibility.service';
import { LmsWorkspaceService } from '../../lms/services/lms-workspace.service';

export type CatalogFilters = {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  category?: string;
  studentId?: string;
  streamId?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  class12Subjects?: string;
  includeIneligible?: boolean;
};

@Injectable()
export class OfferingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicCatalog: AcademicCatalogService,
    private readonly shiftScope: ShiftScopeService,
    private readonly sectionStreams: OfferingSectionStreamsService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly courseEligibility: CourseEligibilityService,
    private readonly lmsWorkspaces: LmsWorkspaceService,
  ) {}

  listShifts(tenantId: string, campusId?: string) {
    return this.prisma.shift.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        campus: { deletedAt: null },
        ...(campusId ? { campusId } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listClassrooms(tenantId: string) {
    return this.prisma.classroom.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async listOfferings(
    tenantId: string,
    filters: {
      programVersionId?: string;
      semesterSequence?: number;
      category?: string;
    },
  ) {
    if (!filters.programVersionId) {
      return this.academicCatalog.listOfferingsForEngine(tenantId, filters);
    }

    const semesters = filters.semesterSequence
      ? [filters.semesterSequence]
      : await this.resolveProgramSemesters(tenantId, filters.programVersionId);

    const results = [];
    for (const semesterSequence of semesters) {
      const resolved = await this.curriculum.resolveProgrammeCurriculum(
        tenantId,
        filters.programVersionId,
        semesterSequence,
        filters.category ? { category: filters.category } : undefined,
      );

      for (const offering of resolved.directOfferings) {
        results.push({
          ...offering,
          mappingSource: 'DIRECT',
          sections: [],
        });
      }
      for (const row of resolved.inheritedPoolOfferings) {
        results.push({
          ...row.offering,
          mappingSource: 'SHARED_POOL',
          poolId: row.poolId,
          poolName: row.poolName,
          sections: row.offering.sections ?? [],
        });
      }
    }

    return results;
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
          mappingSource: 'DIRECT',
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
    return [...set].sort((a, b) => a - b);
  }

  async catalog(user: JwtUser, filters: CatalogFilters) {
    let shiftId = filters.shiftId;
    if (user.roles.includes('student') && !shiftId) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
        select: { primaryShiftId: true },
      });
      shiftId = student?.primaryShiftId ?? user.primaryShiftId ?? shiftId;
    }
    shiftId = this.shiftScope.assertCanUseShiftId(user, shiftId);

    let studentStreamId: string | null = null;
    if (user.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
        select: {
          academicProfile: { select: { streamId: true } },
        },
      });
      studentStreamId = student?.academicProfile?.streamId ?? null;
    }

    const baseWhere = await this.curriculum.resolveCatalogSectionWhere(
      user.tid,
      filters.programVersionId,
      filters.semesterSequence,
      filters.category ? { category: filters.category } : undefined,
    );

    let sections = await this.prisma.offeringSection.findMany({
      where: {
        ...baseWhere,
        ...(shiftId ? { shiftId } : {}),
        ...(studentStreamId
          ? {
              OR: [
                { eligibleStreams: { none: {} } },
                {
                  eligibleStreams: {
                    some: { academicStreamId: studentStreamId },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        shift: true,
        seatLedger: true,
        courseOffering: { include: { course: true } },
        staffProfile: true,
        classroom: true,
        ...sectionStreamInclude,
      },
      orderBy: [
        { courseOffering: { category: 'asc' } },
        { sectionCode: 'asc' },
      ],
    });

    sections = await this.curriculum.filterSectionsByPoolExclusions(
      user.tid,
      filters.programVersionId,
      sections,
    );

    const eligibilityCtx = await this.resolveCatalogEligibilityContext(
      user,
      filters,
    );

    let eligibleSections = sections;
    let ineligibleSections: Array<{
      section: (typeof sections)[number];
      reasons: string[];
      codes: string[];
    }> = [];

    if (eligibilityCtx) {
      if (filters.includeIneligible) {
        const partitioned = this.courseEligibility.partitionSections(
          sections,
          eligibilityCtx,
        );
        eligibleSections = partitioned.eligible;
        ineligibleSections = partitioned.ineligible;
      } else {
        eligibleSections = this.courseEligibility.filterSections(
          sections,
          eligibilityCtx,
        );
      }
    }

    const poolIds = [
      ...new Set(
        [...eligibleSections, ...ineligibleSections.map((row) => row.section)]
          .map((s) => s.courseOffering.categoryPoolId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const pools =
      poolIds.length > 0
        ? await this.prisma.categoryPool.findMany({
            where: { id: { in: poolIds } },
            select: { id: true, poolName: true },
          })
        : [];
    const poolMeta = new Map(pools.map((p) => [p.id, p]));

    const annotate = (section: (typeof sections)[number]) =>
      this.curriculum.annotateSection(section, poolMeta);

    if (filters.includeIneligible) {
      return {
        eligible: eligibleSections.map(annotate),
        ineligible: ineligibleSections.map((row) => ({
          section: annotate(row.section),
          reasons: row.reasons,
          codes: row.codes,
        })),
      };
    }

    return eligibleSections.map(annotate);
  }

  async listSections(user: JwtUser, offeringId: string) {
    await this.academicCatalog.assertOffering(user.tid, offeringId);
    const scope = this.shiftScope.resolveScope(user);
    let where = {
      courseOfferingId: offeringId,
      tenantId: user.tid,
      deletedAt: null,
    };
    where = this.shiftScope.applyToWhere(where, scope);
    return this.prisma.offeringSection.findMany({
      where,
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: true,
        classroom: true,
      },
    });
  }

  async createSection(
    user: JwtUser,
    offeringId: string,
    dto: CreateOfferingSectionDto,
  ) {
    await this.academicCatalog.assertOffering(user.tid, offeringId);
    const shiftId =
      this.shiftScope.assertCanUseShiftId(user, dto.shiftId) ?? dto.shiftId;
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      shiftId,
    );

    const section = await this.prisma.offeringSection.create({
      data: {
        tenantId: user.tid,
        courseOfferingId: offeringId,
        shiftId,
        sectionCode: dto.sectionCode ?? 'A',
        studentGroup: dto.studentGroup?.trim() || null,
        capacity: dto.capacity ?? 80,
        waitlistCapacity: dto.waitlistCapacity ?? 10,
        staffProfileId: dto.staffProfileId ?? dto.facultyId,
        classroomId: dto.classroomId,
      },
      include: { shift: true, seatLedger: true },
    });

    await this.prisma.offeringSeatLedger.create({
      data: { tenantId: user.tid, offeringSectionId: section.id },
    });

    await this.sectionStreams.syncForSection(
      user.tid,
      section.id,
      dto.streamIds,
    );

    void this.lmsWorkspaces.provisionSectionWorkspace(user.tid, section.id);

    return this.prisma.offeringSection.findUniqueOrThrow({
      where: { id: section.id },
      include: { shift: true, seatLedger: true, ...sectionStreamInclude },
    });
  }

  async resolveSectionForLine(
    tenantId: string,
    line: { offeringSectionId?: string; offeringId?: string },
    preferredShiftId?: string | null,
    studentStreamId?: string | null,
  ) {
    const studentStream = studentStreamId
      ? await this.prisma.academicStream.findFirst({
          where: { id: studentStreamId, tenantId },
          select: { code: true, name: true },
        })
      : null;
    const studentStreamLabel =
      studentStream?.code ??
      studentStream?.name ??
      studentStreamId ??
      'unknown';

    const streamError = (section: {
      sectionCode: string;
      courseOffering: {
        category: string | null;
        course: { code: string; title: string };
      };
      eligibleStreams?: Array<{
        academicStreamId: string;
        stream?: { code?: string; name?: string } | null;
      }>;
    }) =>
      formatStreamIneligibleMessage({
        courseCode: section.courseOffering.course.code,
        courseTitle: section.courseOffering.course.title,
        category: section.courseOffering.category ?? 'ELECTIVE',
        sectionCode: section.sectionCode,
        studentStreamLabel,
        allowedStreamLabels: (section.eligibleStreams ?? []).map(
          (row) => row.stream?.code ?? row.stream?.name ?? row.academicStreamId,
        ),
      });

    if (line.offeringSectionId) {
      const section = await this.prisma.offeringSection.findFirst({
        where: { id: line.offeringSectionId, tenantId, deletedAt: null },
        include: {
          courseOffering: { include: { course: true } },
          ...sectionStreamInclude,
        },
      });
      if (!section) throw new NotFoundException('Offering section not found');
      const eligibleIds =
        this.sectionStreams.eligibleStreamIdsFromSection(section);
      if (
        studentStreamId &&
        !isStudentEligibleForSection(studentStreamId, eligibleIds)
      ) {
        throw new BadRequestException(streamError(section));
      }
      return section;
    }
    if (!line.offeringId)
      throw new NotFoundException('offeringSectionId or offeringId required');

    const sections = await this.prisma.offeringSection.findMany({
      where: {
        courseOfferingId: line.offeringId,
        tenantId,
        deletedAt: null,
        status: 'active',
      },
      include: {
        shift: true,
        courseOffering: { include: { course: true } },
        ...sectionStreamInclude,
      },
    });
    if (sections.length === 0)
      throw new NotFoundException('No sections for offering');

    const eligible = studentStreamId
      ? sections.filter((s) =>
          isStudentEligibleForSection(
            studentStreamId,
            this.sectionStreams.eligibleStreamIdsFromSection(s),
          ),
        )
      : sections;

    if (eligible.length === 0) {
      const sample = sections[0]!;
      throw new BadRequestException(streamError(sample));
    }

    if (preferredShiftId) {
      const match = eligible.find((s) => s.shiftId === preferredShiftId);
      if (match) return match;
    }
    const day = eligible.find((s) => s.shift.code === 'DAY');
    return day ?? eligible[0];
  }

  private async resolveCatalogEligibilityContext(
    user: JwtUser,
    filters: CatalogFilters,
  ) {
    if (user.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
        select: { id: true },
      });
      if (student) {
        return this.courseEligibility.buildContextFromStudent(
          user.tid,
          student.id,
        );
      }
    }

    const hasDraftContext =
      filters.studentId ||
      filters.streamId ||
      filters.majorSubjectSlug ||
      filters.minorSubjectSlug ||
      filters.class12Subjects;

    if (!hasDraftContext) {
      return null;
    }

    if (filters.studentId) {
      return this.courseEligibility.buildContextFromStudent(
        user.tid,
        filters.studentId,
      );
    }

    let class12Subjects: EligibilityPreviewInput['class12Subjects'];
    if (filters.class12Subjects) {
      try {
        const parsed = JSON.parse(filters.class12Subjects) as unknown;
        class12Subjects = Array.isArray(parsed)
          ? (parsed as EligibilityPreviewInput['class12Subjects'])
          : [];
      } catch {
        class12Subjects = [];
      }
    }

    return this.courseEligibility.resolveContext(user.tid, {
      programVersionId: filters.programVersionId,
      streamId: filters.streamId,
      majorSubjectSlug: filters.majorSubjectSlug,
      minorSubjectSlug: filters.minorSubjectSlug,
      class12Subjects,
    });
  }
}
