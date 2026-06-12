import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import type { RegistrationLineDto } from '../dto/academic-engine.dto';

import { slugifySubject } from '../domain/nep-categories';
import { courseMatchesSubjectPath } from '../domain/course-subject-slug';

import { categorySlotKeys } from '../domain/fyugp-templates';
import { requiredMajorPaperCount } from '../domain/major-paper-assignment';

import { AcademicEngineService } from '../academic-engine.service';

import { AdminRegistrationService } from './admin-registration.service';

import { MajorMinorEligibilityService } from './major-minor-eligibility.service';

import { SemesterRulesService } from './semester-rules.service';

export type GenerateSemesterRegistrationParams = {
  tenantId: string;

  studentId: string;

  programVersionId: string;

  semesterSequence: number;

  shiftId?: string | null;

  streamId?: string | null;

  /** Pre-selected pool category sections from admission basket (MDC, AEC, etc.) */

  subjectSelections?: Record<string, string>;

  assignedById?: string;
};

function slotCategory(slotKey: string): string {
  return slotKey.startsWith('MAJOR') ? 'MAJOR' : slotKey.split('-')[0]!;
}

function assignGeneratedLinesToSlotKeys(
  generated: RegistrationLineDto[],
  slotKeys: string[],
): Map<string, RegistrationLineDto> {
  const merged = new Map<string, RegistrationLineDto>();
  const byCategory = new Map<string, RegistrationLineDto[]>();
  for (const line of generated) {
    const list = byCategory.get(line.category) ?? [];
    list.push(line);
    byCategory.set(line.category, list);
  }
  const categoryOccurrence = new Map<string, number>();
  for (const slotKey of slotKeys) {
    const cat = slotCategory(slotKey);
    const idx = categoryOccurrence.get(cat) ?? 0;
    categoryOccurrence.set(cat, idx + 1);
    const lines = byCategory.get(cat) ?? [];
    if (lines[idx]) merged.set(slotKey, lines[idx]!);
  }
  return merged;
}

@Injectable()
export class SubjectRegistrationEngineService {
  private readonly logger = new Logger(SubjectRegistrationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly engine: AcademicEngineService,

    private readonly adminRegistration: AdminRegistrationService,

    private readonly eligibility: MajorMinorEligibilityService,

    private readonly semesterRules: SemesterRulesService,
  ) {}

  async generateSemesterRegistrationLines(
    params: GenerateSemesterRegistrationParams,
  ): Promise<RegistrationLineDto[]> {
    const {
      tenantId,

      studentId,

      programVersionId,

      semesterSequence,

      shiftId,

      streamId,

      subjectSelections = {},
    } = params;

    const choices = await this.prisma.studentProgramChoice.findMany({
      where: { tenantId, studentId, status: 'active', deletedAt: null },
    });

    const majorChoice = choices.find((c) => c.choiceType === 'MAJOR');

    const minorChoice = choices.find((c) => c.choiceType === 'MINOR');

    if (!majorChoice?.subjectSlug) {
      throw new BadRequestException('Student major subject path is not set.');
    }

    const honoursTrack = await this.semesterRules.resolveHonoursTrackForStudent(
      tenantId,

      studentId,

      semesterSequence,
    );

    const resolvedRule = await this.semesterRules.getSemesterRule(
      tenantId,

      programVersionId,

      semesterSequence,

      honoursTrack,
    );

    const categoryCounts = resolvedRule.categoryCounts;

    const needsMinor = (categoryCounts.MINOR ?? 0) > 0;

    if (needsMinor && !minorChoice?.subjectSlug) {
      throw new BadRequestException(
        'Student minor subject path is required for this semester.',
      );
    }

    if (needsMinor && minorChoice?.subjectSlug) {
      await this.eligibility.assertValidMajorMinorPair(
        tenantId,

        majorChoice.subjectSlug,

        minorChoice.subjectSlug,
      );
    }

    const selectionLines = await this.linesFromSubjectSelections(
      tenantId,

      subjectSelections,

      categoryCounts,

      { majorChoice, minorChoice },
    );

    const filledCategories = new Set(
      selectionLines.map((line) => line.category),
    );

    const autoLines =
      await this.adminRegistration.buildAutoAssignLinesForStudent(
        tenantId,

        studentId,

        programVersionId,

        semesterSequence,

        {
          shiftId: shiftId ?? undefined,
          streamId: streamId ?? undefined,
          skipCategories: [...filledCategories],
        },
      );

    const lines: RegistrationLineDto[] = autoLines.map((line) => ({
      ...line,

      registrationSource: 'ADMIN_ASSIGNED',
    }));

    for (const selectionLine of selectionLines) {
      const slotKeys = categorySlotKeys(categoryCounts);

      const slotIndex = slotKeys.findIndex(
        (key) => slotCategory(key) === selectionLine.category,
      );

      if (slotIndex >= 0) {
        const categoryLines = lines.filter(
          (l) => l.category === selectionLine.category,
        );

        if (categoryLines[slotIndex]) {
          const lineIndex = lines.indexOf(categoryLines[slotIndex]!);

          lines[lineIndex] = selectionLine;
        } else {
          lines.push(selectionLine);
        }
      } else {
        const existingIdx = lines.findIndex(
          (l) => l.category === selectionLine.category,
        );

        if (existingIdx >= 0) lines[existingIdx] = selectionLine;
        else lines.push(selectionLine);
      }
    }

    for (const [slotKey, sectionId] of Object.entries(subjectSelections)) {
      if (!sectionId) continue;

      const category = slotCategory(slotKey);

      if (category === 'MAJOR' || category === 'MINOR') continue;

      const section = await this.prisma.offeringSection.findFirst({
        where: { id: sectionId, tenantId, deletedAt: null },

        include: { courseOffering: true },
      });

      if (!section) continue;

      const newLine: RegistrationLineDto = {
        category,

        offeringId: section.courseOfferingId,

        offeringSectionId: sectionId,

        registrationSource: 'ADMIN_ASSIGNED',
      };

      const slotKeys = categorySlotKeys(categoryCounts);

      const slotIndex = slotKeys.indexOf(slotKey);

      if (slotIndex >= 0) {
        const categoryLines = lines.filter((l) => l.category === category);

        if (categoryLines[slotIndex]) {
          const lineIndex = lines.indexOf(categoryLines[slotIndex]!);

          lines[lineIndex] = newLine;
        } else {
          lines.push(newLine);
        }
      } else {
        const existingIdx = lines.findIndex((l) => l.category === category);

        if (existingIdx >= 0) lines[existingIdx] = newLine;
        else lines.push(newLine);
      }
    }

    this.logger.debug(
      `generateSemesterRegistrationLines: auto-assigned ${autoLines.length} lines for sem ${semesterSequence}`,
    );
    this.logger.debug(
      `generateSemesterRegistrationLines: MAJOR offering IDs ${lines
        .filter((l) => l.category === 'MAJOR')
        .map((l) => l.offeringId)
        .join(', ')}`,
    );

    await this.assertUniqueMajorPaperAssignments(
      tenantId,
      lines,
      categoryCounts,
    );

    return lines;
  }

  private async assertUniqueMajorPaperAssignments(
    tenantId: string,
    lines: RegistrationLineDto[],
    categoryCounts: Record<string, number>,
  ) {
    const majorLines = lines.filter((l) => l.category === 'MAJOR');
    const required = requiredMajorPaperCount(categoryCounts);
    if (required <= 0) return;

    if (majorLines.length !== required) {
      throw new BadRequestException(
        `Expected ${required} MAJOR paper assignment(s), got ${majorLines.length}`,
      );
    }

    const sectionIds = majorLines
      .map((l) => l.offeringSectionId)
      .filter((id): id is string => Boolean(id));
    if (sectionIds.length === 0) return;

    const sections = await this.prisma.offeringSection.findMany({
      where: { tenantId, id: { in: sectionIds }, deletedAt: null },
      include: { courseOffering: { include: { course: true } } },
    });
    const courseIds = sections.map((s) => s.courseOffering.courseId);
    const uniqueCourseIds = new Set(courseIds);
    if (uniqueCourseIds.size !== courseIds.length) {
      throw new BadRequestException(
        'Duplicate major paper assignment detected',
      );
    }

    const uniqueOfferings = new Set(majorLines.map((l) => l.offeringId));
    if (uniqueOfferings.size !== majorLines.length) {
      throw new BadRequestException(
        'Duplicate major paper assignment detected',
      );
    }
  }

  async applyGeneratedLines(
    tenantId: string,

    registrationId: string,

    lines: RegistrationLineDto[],

    opts?: { assignedById?: string },
  ) {
    return this.engine.updateRegistrationLines(
      tenantId,
      registrationId,
      lines,
      {
        registrationSource: 'ADMIN_ASSIGNED',

        assignedById: opts?.assignedById,

        generatedBy: 'AUTO_ENGINE',
      },
    );
  }

  /** Merge subject selections from admission with auto-generated MAJOR/MINOR lines. */

  async buildAdmitRegistrationLines(
    params: GenerateSemesterRegistrationParams,
  ) {
    const generated = await this.generateSemesterRegistrationLines(params);

    const choices = await this.prisma.studentProgramChoice.findMany({
      where: {
        tenantId: params.tenantId,

        studentId: params.studentId,

        status: 'active',

        deletedAt: null,
      },
    });

    const majorChoice = choices.find((c) => c.choiceType === 'MAJOR');

    const minorChoice = choices.find((c) => c.choiceType === 'MINOR');

    const honoursTrack = await this.semesterRules.resolveHonoursTrackForStudent(
      params.tenantId,

      params.studentId,

      params.semesterSequence,
    );

    const resolvedRule = await this.semesterRules.getSemesterRule(
      params.tenantId,

      params.programVersionId,

      params.semesterSequence,

      honoursTrack,
    );

    const slotKeys = categorySlotKeys(resolvedRule.categoryCounts);

    const merged = assignGeneratedLinesToSlotKeys(generated, slotKeys);

    this.logger.debug(
      `buildAdmitRegistrationLines: merged ${merged.size} slot keys from ${generated.length} generated lines`,
    );

    for (const [slotKey, sectionId] of Object.entries(
      params.subjectSelections ?? {},
    )) {
      if (!sectionId) continue;

      const category = slotCategory(slotKey);

      const section = await this.prisma.offeringSection.findFirst({
        where: { id: sectionId, tenantId: params.tenantId, deletedAt: null },

        include: {
          courseOffering: {
            include: { course: { include: { department: true } } },
          },
        },
      });

      if (!section) continue;

      if (category === 'MAJOR' || category === 'MINOR') {
        const choiceSlug =
          category === 'MAJOR'
            ? majorChoice?.subjectSlug
            : minorChoice?.subjectSlug;

        if (
          choiceSlug &&
          !courseMatchesSubjectPath(section.courseOffering.course, choiceSlug)
        ) {
          continue;
        }
      }

      merged.set(slotKey, {
        category,

        offeringId: section.courseOfferingId,

        offeringSectionId: sectionId,

        registrationSource: 'ADMIN_ASSIGNED',
      });
    }

    return [...merged.values()];
  }

  private async linesFromSubjectSelections(
    tenantId: string,

    subjectSelections: Record<string, string>,

    categoryCounts: Record<string, number>,

    choices: {
      majorChoice?: { subjectSlug: string } | null;

      minorChoice?: { subjectSlug: string } | null;
    },
  ): Promise<RegistrationLineDto[]> {
    const lines: RegistrationLineDto[] = [];

    const slotKeys = categorySlotKeys(categoryCounts);

    for (const slotKey of slotKeys) {
      const sectionId = subjectSelections[slotKey];

      if (!sectionId) continue;

      const category = slotCategory(slotKey);

      const section = await this.prisma.offeringSection.findFirst({
        where: { id: sectionId, tenantId, deletedAt: null },

        include: {
          courseOffering: {
            include: { course: { include: { department: true } } },
          },
        },
      });

      if (!section) continue;

      if (category === 'MAJOR' || category === 'MINOR') {
        const choiceSlug =
          category === 'MAJOR'
            ? choices.majorChoice?.subjectSlug
            : choices.minorChoice?.subjectSlug;

        if (
          choiceSlug &&
          !courseMatchesSubjectPath(section.courseOffering.course, choiceSlug)
        ) {
          continue;
        }
      }

      lines.push({
        category,

        offeringId: section.courseOfferingId,

        offeringSectionId: sectionId,

        registrationSource: 'ADMIN_ASSIGNED',
      });
    }

    return lines;
  }
}
