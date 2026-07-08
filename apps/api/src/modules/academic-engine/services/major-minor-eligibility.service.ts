import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { slugifySubject } from '../domain/nep-categories';
import { CurriculumResolutionService } from './curriculum-resolution.service';
import { ShiftCurriculumService } from './shift-curriculum.service';
import { StudentMajorMinorOverrideService } from './student-major-minor-override.service';

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
    private readonly shiftCurriculum: ShiftCurriculumService,
    private readonly majorMinorOverride: StudentMajorMinorOverrideService,
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
    shiftId?: string,
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
        { category, shiftId },
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

  async listMajorMinorRules(
    tenantId: string,
    filters?: {
      institutionId?: string;
      shiftId?: string;
      majorSubjectId?: string;
    },
  ) {
    return this.prisma.majorMinorRule.findMany({
      where: {
        tenantId,
        ...(filters?.majorSubjectId
          ? { majorSubjectId: filters.majorSubjectId }
          : {}),
        ...(filters?.shiftId
          ? { OR: [{ shiftId: filters.shiftId }, { shiftId: null }] }
          : {}),
        ...(filters?.institutionId
          ? {
              majorSubject: {
                institutionId: filters.institutionId,
                deletedAt: null,
              },
            }
          : {}),
      },
      include: {
        majorSubject: { include: { department: true } },
        allowedMinorSubject: { include: { department: true } },
        shift: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [
        { majorSubject: { name: 'asc' } },
        { allowedMinorSubject: { name: 'asc' } },
      ],
    });
  }

  async syncMajorMinorRules(
    tenantId: string,
    input: {
      majorSubjectId: string;
      allowedMinorSubjectIds: string[];
      shiftId?: string | null;
      academicYearId?: string | null;
      isActive?: boolean;
    },
  ) {
    const {
      majorSubjectId,
      allowedMinorSubjectIds,
      shiftId = null,
      academicYearId = null,
      isActive = true,
    } = input;
    const uniqueMinorIds = [...new Set(allowedMinorSubjectIds.filter(Boolean))];

    const majorSubject = await this.prisma.academicSubject.findFirst({
      where: { id: majorSubjectId, tenantId, deletedAt: null },
    });
    if (!majorSubject) {
      throw new BadRequestException('Major subject not found.');
    }

    if (uniqueMinorIds.includes(majorSubjectId)) {
      throw new BadRequestException(
        'Major and minor subjects must be different.',
      );
    }

    const existing = await this.prisma.majorMinorRule.findMany({
      where: {
        tenantId,
        majorSubjectId,
        shiftId,
        academicYearId,
      },
    });
    const allowedSet = new Set(uniqueMinorIds);

    for (const rule of existing) {
      if (!allowedSet.has(rule.allowedMinorSubjectId)) {
        await this.prisma.majorMinorRule.update({
          where: { id: rule.id },
          data: { isActive: false },
        });
      }
    }

    for (const minorSubjectId of uniqueMinorIds) {
      const found = existing.find(
        (rule) => rule.allowedMinorSubjectId === minorSubjectId,
      );
      if (found) {
        await this.prisma.majorMinorRule.update({
          where: { id: found.id },
          data: { isActive },
        });
      } else {
        await this.prisma.majorMinorRule.create({
          data: {
            tenantId,
            majorSubjectId,
            allowedMinorSubjectId: minorSubjectId,
            shiftId,
            academicYearId,
            isActive,
          },
        });
      }
    }

    return this.listMajorMinorRules(tenantId, {
      shiftId: shiftId ?? undefined,
      majorSubjectId,
    });
  }

  async setMajorMinorRuleActive(
    tenantId: string,
    ruleId: string,
    isActive: boolean,
  ) {
    const rule = await this.prisma.majorMinorRule.findFirst({
      where: { id: ruleId, tenantId },
    });
    if (!rule) {
      throw new BadRequestException('Major/minor rule not found.');
    }
    return this.prisma.majorMinorRule.update({
      where: { id: ruleId },
      data: { isActive },
      include: {
        majorSubject: { include: { department: true } },
        allowedMinorSubject: { include: { department: true } },
        shift: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  async listEligibleMajors(
    tenantId: string,
    programVersionId: string,
    semesterSequence = 1,
    opts?: { shiftId?: string },
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

    return this.shiftCurriculum.filterSubjectPathsByShift(
      tenantId,
      opts?.shiftId,
      subjects.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        programmeGroup: s.programmeGroup,
        departmentId: s.departmentId,
        department: s.department,
      })),
    );
  }

  async listEligibleMinors(
    tenantId: string,
    programVersionId: string,
    majorSubjectSlug: string,
    semesterSequence = 1,
    academicYearId?: string,
    shiftId?: string,
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
        AND: [
          {
            OR: [
              { academicYearId: academicYearId ?? undefined },
              { academicYearId: null },
            ],
          },
          ...(shiftId ? [{ OR: [{ shiftId }, { shiftId: null }] }] : []),
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
      shiftId,
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

    return this.shiftCurriculum.filterSubjectPathsByShift(
      tenantId,
      shiftId,
      subjects.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        programmeGroup: s.programmeGroup,
        departmentId: s.departmentId,
        department: s.department,
      })),
    );
  }

  async validateMajorMinorPair(
    tenantId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
    shiftId?: string,
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

    const rules = await this.prisma.majorMinorRule.findMany({
      where: {
        tenantId,
        majorSubjectId: majorSubject.id,
        allowedMinorSubjectId: minorSubject.id,
        isActive: true,
        AND: [
          {
            OR: [
              { academicYearId: academicYearId ?? undefined },
              { academicYearId: null },
            ],
          },
          ...(shiftId ? [{ OR: [{ shiftId }, { shiftId: null }] }] : []),
        ],
      },
    });

    if (rules.length === 0) {
      const minorRules = await this.prisma.majorMinorRule.findMany({
        where: {
          tenantId,
          majorSubjectId: majorSubject.id,
          isActive: true,
          AND: [
            {
              OR: [
                { academicYearId: academicYearId ?? undefined },
                { academicYearId: null },
              ],
            },
            ...(shiftId ? [{ OR: [{ shiftId }, { shiftId: null }] }] : []),
          ],
        },
        include: {
          allowedMinorSubject: { include: { department: true } },
        },
      });
      const allowedNames = [
        ...new Set(
          minorRules.map(
            (rule) =>
              rule.allowedMinorSubject.department?.name ??
              rule.allowedMinorSubject.name,
          ),
        ),
      ].sort((a, b) => a.localeCompare(b));
      const allowedLines = allowedNames.map((name) => `• ${name}`).join('\n');
      issues.push({
        code: 'INVALID_MAJOR_MINOR_PAIR',
        message: [
          'Invalid Minor Subject.',
          '',
          `For ${majorSubject.name} Major, allowed Minor subjects are:`,
          '',
          allowedLines || '• (none configured)',
        ].join('\n'),
      });
    }

    return { ok: issues.length === 0, issues };
  }

  async assertValidMajorMinorPair(
    tenantId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
    shiftId?: string,
  ) {
    const result = await this.validateMajorMinorPair(
      tenantId,
      majorSubjectSlug,
      minorSubjectSlug,
      academicYearId,
      shiftId,
    );
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Invalid major/minor combination',
        issues: result.issues,
      });
    }
  }

  async validateMajorMinorPairForStudent(
    tenantId: string,
    studentId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
    shiftId?: string,
    options?: { semesterSequence?: number; programVersionId?: string },
  ): Promise<{
    ok: boolean;
    source: 'RULES' | 'STUDENT_OVERRIDE';
    issues: { code: string; message: string }[];
  }> {
    const base = await this.validateMajorMinorPair(
      tenantId,
      majorSubjectSlug,
      minorSubjectSlug,
      academicYearId,
      shiftId,
    );
    if (base.ok) return { ...base, source: 'RULES' };

    const override = await this.majorMinorOverride.getActiveOverride(
      tenantId,
      studentId,
      {
        semesterSequence: options?.semesterSequence,
        programVersionId: options?.programVersionId,
        shiftId,
        academicYearId,
      },
    );
    if (!override) return { ...base, source: 'RULES' };

    const [major, minor] = await Promise.all([
      this.prisma.academicSubject.findFirst({
        where: { id: override.majorSubjectId, tenantId, deletedAt: null },
        select: { slug: true },
      }),
      this.prisma.academicSubject.findFirst({
        where: { id: override.minorSubjectId, tenantId, deletedAt: null },
        select: { slug: true },
      }),
    ]);
    const majorSlug = this.normalizeSlug(majorSubjectSlug);
    const minorSlug = this.normalizeSlug(minorSubjectSlug);
    if (
      major?.slug &&
      minor?.slug &&
      major.slug === majorSlug &&
      minor.slug === minorSlug
    ) {
      return { ok: true, source: 'STUDENT_OVERRIDE', issues: [] };
    }
    return { ...base, source: 'RULES' };
  }

  async assertValidMajorMinorPairForStudent(
    tenantId: string,
    studentId: string,
    majorSubjectSlug: string,
    minorSubjectSlug: string,
    academicYearId?: string,
    shiftId?: string,
    options?: { semesterSequence?: number; programVersionId?: string },
  ) {
    const result = await this.validateMajorMinorPairForStudent(
      tenantId,
      studentId,
      majorSubjectSlug,
      minorSubjectSlug,
      academicYearId,
      shiftId,
      options,
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
