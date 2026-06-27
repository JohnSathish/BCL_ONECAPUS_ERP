import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { slugifySubject } from '../domain/nep-categories';
import { CurriculumResolutionService } from './curriculum-resolution.service';

export type SubjectPathRow = {
  id: string;
  slug: string;
  name: string;
  programmeGroup: string | null;
  departmentId: string | null;
  department?: { id: string; name: string; code: string } | null;
};

@Injectable()
export class MajorMinorEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
  ) {}

  normalizeSlug(value: string) {
    return slugifySubject(value.trim());
  }

  resolveCourseSubjectSlug(course: {
    subjectSlug?: string | null;
    title?: string;
    department?: { name?: string; code?: string } | null;
  }): string {
    if (course.subjectSlug?.trim())
      return this.normalizeSlug(course.subjectSlug);
    if (course.department?.name)
      return this.normalizeSlug(course.department.name);
    return this.normalizeSlug(course.title ?? '');
  }

  /** All slug candidates for matching curriculum courses to AcademicSubject paths. */
  resolveCourseSubjectSlugCandidates(course: {
    subjectSlug?: string | null;
    title?: string;
    department?: { name?: string; code?: string } | null;
  }): string[] {
    const slugs = new Set<string>();
    if (course.subjectSlug?.trim())
      slugs.add(this.normalizeSlug(course.subjectSlug));
    if (course.title?.trim()) slugs.add(this.normalizeSlug(course.title));
    if (course.department?.name?.trim())
      slugs.add(this.normalizeSlug(course.department.name));
    return [...slugs];
  }

  /** Subject paths are programme-level; union slugs from every configured semester. */
  private addOfferingSlugs(
    slugs: Set<string>,
    offering: {
      course: {
        subjectSlug?: string | null;
        title?: string;
        department?: { name?: string; code?: string } | null;
      };
    },
  ) {
    for (const slug of this.resolveCourseSubjectSlugCandidates(
      offering.course,
    )) {
      slugs.add(slug);
    }
  }

  private async collectProgrammeCategorySlugs(
    tenantId: string,
    programVersionId: string,
    category: string,
  ): Promise<Set<string>> {
    const semesters = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        programVersionId,
        deletedAt: null,
        category: { equals: category, mode: 'insensitive' },
      },
      distinct: ['semesterSequence'],
      select: { semesterSequence: true },
      orderBy: { semesterSequence: 'asc' },
    });

    const slugs = new Set<string>();
    for (const { semesterSequence } of semesters) {
      if (semesterSequence == null) continue;
      const resolved = await this.curriculum.resolveProgrammeCurriculum(
        tenantId,
        programVersionId,
        semesterSequence,
        { category },
      );
      for (const offering of resolved.directOfferings) {
        this.addOfferingSlugs(slugs, offering);
      }
      for (const pooled of resolved.inheritedPoolOfferings) {
        this.addOfferingSlugs(slugs, pooled.offering);
      }
    }
    return slugs;
  }

  async listMajorMinorRules(tenantId: string, institutionId?: string) {
    return this.prisma.majorMinorRule.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(institutionId
          ? { majorSubject: { institutionId, deletedAt: null } }
          : {}),
      },
      include: {
        majorSubject: { include: { department: true } },
        allowedMinorSubject: { include: { department: true } },
      },
      orderBy: [
        { majorSubject: { name: 'asc' } },
        { allowedMinorSubject: { name: 'asc' } },
      ],
    });
  }

  async listEligibleMajors(
    tenantId: string,
    programVersionId: string,
    semesterSequence = 1,
  ): Promise<SubjectPathRow[]> {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: {
        program: {
          include: { department: { select: { institutionId: true } } },
        },
      },
    });
    if (!version) return [];

    const institutionId = version.program?.department?.institutionId;
    if (!institutionId) return [];

    void semesterSequence;
    const majorSlugs = await this.collectProgrammeCategorySlugs(
      tenantId,
      programVersionId,
      'MAJOR',
    );

    if (majorSlugs.size === 0) return [];

    const subjects = await this.prisma.academicSubject.findMany({
      where: {
        tenantId,
        institutionId,
        isActive: true,
        deletedAt: null,
        slug: { in: [...majorSlugs] },
      },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });

    return subjects.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      programmeGroup: s.programmeGroup,
      departmentId: s.departmentId,
      department: s.department,
    }));
  }

  async listEligibleMinors(
    tenantId: string,
    programVersionId: string,
    majorSubjectSlug: string,
    semesterSequence = 1,
    academicYearId?: string,
  ): Promise<SubjectPathRow[]> {
    const majorSlug = this.normalizeSlug(majorSubjectSlug);
    if (!majorSlug) return [];

    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: {
        program: {
          include: { department: { select: { institutionId: true } } },
        },
      },
    });
    if (!version) return [];

    const institutionId = version.program?.department?.institutionId;
    if (!institutionId) return [];

    const majorSubject = await this.prisma.academicSubject.findFirst({
      where: {
        tenantId,
        institutionId,
        slug: majorSlug,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!majorSubject) return [];

    const rules = await this.prisma.majorMinorRule.findMany({
      where: {
        tenantId,
        majorSubjectId: majorSubject.id,
        isActive: true,
        OR: [
          { academicYearId: academicYearId ?? undefined },
          { academicYearId: null },
        ],
      },
      include: {
        allowedMinorSubject: { include: { department: true } },
      },
    });

    const allowedSlugs = new Set(
      rules.map((r) => r.allowedMinorSubject.slug).filter(Boolean),
    );
    if (allowedSlugs.size === 0) return [];

    void semesterSequence;
    const programmeMinorSlugs = await this.collectProgrammeCategorySlugs(
      tenantId,
      programVersionId,
      'MINOR',
    );

    const eligibleSlugs = [...allowedSlugs].filter((slug) =>
      programmeMinorSlugs.has(slug),
    );
    if (eligibleSlugs.length === 0) return [];

    const subjects = await this.prisma.academicSubject.findMany({
      where: {
        tenantId,
        institutionId,
        isActive: true,
        deletedAt: null,
        slug: { in: eligibleSlugs },
      },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });

    return subjects.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      programmeGroup: s.programmeGroup,
      departmentId: s.departmentId,
      department: s.department,
    }));
  }

  async validateMajorMinorPair(
    tenantId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
  ): Promise<{ ok: boolean; issues: { code: string; message: string }[] }> {
    const issues: { code: string; message: string }[] = [];
    const majorSlug = this.normalizeSlug(majorSubjectSlug);
    const minorSlug = this.normalizeSlug(minorSubjectSlug);

    if (!majorSlug || !minorSlug) {
      issues.push({
        code: 'MISSING_SUBJECT',
        message: 'Major and minor subject paths are required.',
      });
      return { ok: false, issues };
    }

    if (majorSlug === minorSlug) {
      issues.push({
        code: 'DUPLICATE_MAJOR_MINOR',
        message: 'Major and minor cannot be the same subject path.',
      });
      return { ok: false, issues };
    }

    const majorSubject = await this.prisma.academicSubject.findFirst({
      where: { tenantId, slug: majorSlug, isActive: true, deletedAt: null },
    });
    const minorSubject = await this.prisma.academicSubject.findFirst({
      where: { tenantId, slug: minorSlug, isActive: true, deletedAt: null },
    });

    if (!majorSubject) {
      issues.push({
        code: 'INVALID_MAJOR',
        message: `Unknown major subject path: ${majorSubjectSlug}`,
      });
    }
    if (!minorSubject) {
      issues.push({
        code: 'INVALID_MINOR',
        message: `Unknown minor subject path: ${minorSubjectSlug}`,
      });
    }
    if (!majorSubject || !minorSubject) return { ok: false, issues };

    const rule = await this.prisma.majorMinorRule.findFirst({
      where: {
        tenantId,
        majorSubjectId: majorSubject.id,
        allowedMinorSubjectId: minorSubject.id,
        isActive: true,
        OR: [
          { academicYearId: academicYearId ?? undefined },
          { academicYearId: null },
        ],
      },
    });

    if (!rule) {
      issues.push({
        code: 'INVALID_MAJOR_MINOR_PAIR',
        message: `${majorSubject.name} cannot be paired with ${minorSubject.name} as minor.`,
      });
    }

    return { ok: issues.length === 0, issues };
  }

  async assertValidMajorMinorPair(
    tenantId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
  ) {
    const result = await this.validateMajorMinorPair(
      tenantId,
      majorSubjectSlug,
      minorSubjectSlug,
      academicYearId,
    );
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Invalid major/minor combination',
        issues: result.issues,
      });
    }
  }

  async resolveSubjectBySlug(tenantId: string, slug: string) {
    return this.prisma.academicSubject.findFirst({
      where: { tenantId, slug: this.normalizeSlug(slug), deletedAt: null },
      include: { department: true },
    });
  }
}
