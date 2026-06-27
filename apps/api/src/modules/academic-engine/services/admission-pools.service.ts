import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import { AcademicEngineService } from '../academic-engine.service';

import {
  categorySlotKeys,
  formatSemesterSummary,
  resolveSemesterRuleWithPathway,
  type HonoursTrack,
  type PathwayVariants,
} from '../domain/fyugp-templates';

import { ruleRecordToPayload } from './structure-rules.helper';

import { OfferingsService } from './offerings.service';

import { MajorMinorEligibilityService } from './major-minor-eligibility.service';

import { SemesterRulesService } from './semester-rules.service';
import { CourseEligibilityService } from './course-eligibility.service';
import {
  evaluateCourseEligibility,
  isRulesEmpty,
  normalizeCourseEligibilityRules,
} from '../domain/course-eligibility.engine';

import {
  isAecSlugAllowed,
  mergeLanguageEligibility,
  resolveAecSubjectSlug,
  type LanguageEligibility,
} from '../domain/aec-eligibility';

import {
  expectedVtcStageForSemester,
  resolveVtcTrackFields,
} from '../../../common/services/vtc-track-metadata';

export type ValidateSubjectBasketDto = {
  programVersionId: string;

  semesterSequence: number;

  shiftId?: string;

  streamId?: string;

  majorSubjectSlug?: string;

  minorSubjectSlug?: string;

  honoursTrack?: HonoursTrack;

  languageEligibility?: LanguageEligibility;

  class12Subjects?: { name: string; code?: string; marks?: number }[];

  selections: Record<string, string>;
};

export type NepPoolOffering = {
  id: string;

  offeringId: string;

  category: string;

  mappingSource?: string;

  course?: {
    id?: string;

    code?: string;

    title?: string;

    credits?: string | number;

    subjectSlug?: string | null;

    department?: { id: string; name: string; code?: string | null } | null;
  };

  poolId?: string;

  poolName?: string;
};

const ELECTIVE_POOL_CATEGORIES = [
  'MDC',

  'AEC',

  'SEC',

  'VAC',

  'VTC',

  'INTERNSHIP',

  'DISSERTATION',
] as const;

@Injectable()
export class AdmissionPoolsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly engine: AcademicEngineService,

    private readonly offerings: OfferingsService,

    private readonly eligibility: MajorMinorEligibilityService,

    private readonly semesterRules: SemesterRulesService,

    private readonly courseEligibility: CourseEligibilityService,
  ) {}

  async getAdmissionPools(
    tenantId: string,

    programVersionId: string,

    semesterSequence: number,

    shiftId?: string,

    majorSubjectSlug?: string,

    opts?: { honoursTrack?: HonoursTrack | null; studentId?: string },
  ) {
    const honoursTrack =
      opts?.honoursTrack ??
      (opts?.studentId
        ? await this.semesterRules.resolveHonoursTrackForStudent(
            tenantId,

            opts.studentId,

            semesterSequence,
          )
        : null);

    const resolvedRule = await this.semesterRules.getSemesterRule(
      tenantId,

      programVersionId,

      semesterSequence,

      honoursTrack,
    );

    const categoryCounts = resolvedRule.categoryCounts;

    const structure = await this.engine.getStructure(
      tenantId,
      programVersionId,
    );

    const majorPaths = await this.eligibility.listEligibleMajors(
      tenantId,

      programVersionId,

      semesterSequence,
    );

    const major = await this.mapSubjectPathsToPoolOfferings(
      tenantId,

      programVersionId,

      semesterSequence,

      'MAJOR',

      majorPaths,
    );

    const needsMinor = (categoryCounts.MINOR ?? 0) > 0;

    const minor = needsMinor
      ? majorSubjectSlug
        ? await this.eligibility

            .listEligibleMinors(
              tenantId,

              programVersionId,

              majorSubjectSlug,

              semesterSequence,
            )

            .then((paths) =>
              this.mapSubjectPathsToPoolOfferings(
                tenantId,

                programVersionId,

                semesterSequence,

                'MINOR',

                paths,
              ),
            )
        : await this.listPoolByNepRole(
            tenantId,

            programVersionId,

            semesterSequence,

            'MINOR',
          )
      : [];

    const pools: Record<string, NepPoolOffering[]> = {};

    for (const cat of ELECTIVE_POOL_CATEGORIES) {
      if ((categoryCounts[cat] ?? 0) > 0) {
        pools[cat] = await this.listPoolByNepRole(
          tenantId,

          programVersionId,

          semesterSequence,

          cat,
        );
      } else {
        pools[cat] = [];
      }
    }

    const structureRules = structure.rules.map((rule) => {
      const payload = ruleRecordToPayload(
        rule,

        structure.template?.semesterCreditTarget ?? 20,
      );

      const pathwayVariants =
        (rule.pathwayVariants as PathwayVariants | null) ?? undefined;

      const resolved =
        rule.semesterSequence === semesterSequence
          ? resolvedRule
          : resolveSemesterRuleWithPathway(
              payload,

              pathwayVariants,

              rule.semesterSequence === 8 ? honoursTrack : null,
            );

      return {
        ...rule,

        categoryCounts: resolved.categoryCounts,

        continuityRules: resolved.continuityRules,

        categoryMeta: resolved.categoryMeta ?? null,

        semesterCreditTarget:
          resolved.semesterCreditTarget ?? rule.semesterCreditTarget,

        summary: formatSemesterSummary(resolved),
      };
    });

    return {
      structureRules,

      semesterRule: {
        ...resolvedRule,

        slotKeys: categorySlotKeys(categoryCounts),
      },

      semesterSummary: resolvedRule.summary,

      creditTarget:
        resolvedRule.semesterCreditTarget ??
        structure.template?.semesterCreditTarget ??
        20,

      categoryCounts,

      major,

      minor,

      pools: {
        MDC: pools.MDC,

        AEC: pools.AEC,

        SEC: pools.SEC,

        VAC: pools.VAC,

        VTC: pools.VTC,

        INTERNSHIP: pools.INTERNSHIP,

        DISSERTATION: pools.DISSERTATION,
      },

      template: structure.template,
    };
  }

  /** Returns all curriculum mappings for programme + semester + NEP role (pool, not single subject). */

  async listPoolByNepRole(
    tenantId: string,

    programVersionId: string,

    semesterSequence: number,

    category: string,
  ): Promise<NepPoolOffering[]> {
    const rows = await this.offerings.listOfferings(tenantId, {
      programVersionId,

      semesterSequence,

      category: category.trim().toUpperCase(),
    });

    return this.dedupeOfferings(rows.map((row) => this.mapToPoolOffering(row)));
  }

  private mapToPoolOffering(row: unknown): NepPoolOffering {
    const r = row as {
      id?: string;

      category?: string;

      mappingSource?: string;

      poolId?: string;

      poolName?: string;

      course?: {
        id?: string;

        code?: string;

        title?: string;

        credits?: string | number;

        subjectSlug?: string | null;

        department?: { id: string; name: string; code?: string | null } | null;
      };
    };

    return {
      id: r.id ?? '',

      offeringId: r.id ?? '',

      category: r.category ?? '',

      mappingSource: r.mappingSource,

      poolId: r.poolId,

      poolName: r.poolName,

      course: r.course
        ? {
            id: r.course.id,

            code: r.course.code,

            title: r.course.title,

            credits: r.course.credits,

            subjectSlug: r.course.subjectSlug,

            department: r.course.department ?? null,
          }
        : undefined,
    };
  }

  async validateSubjectBasket(tenantId: string, dto: ValidateSubjectBasketDto) {
    const issues: { code: string; message: string }[] = [];

    const pools = await this.getAdmissionPools(
      tenantId,

      dto.programVersionId,

      dto.semesterSequence,

      dto.shiftId,

      dto.majorSubjectSlug,

      { honoursTrack: dto.honoursTrack ?? null },
    );

    const sectionIds = Object.values(dto.selections).filter(Boolean);

    const sections =
      sectionIds.length > 0
        ? await this.prisma.offeringSection.findMany({
            where: { id: { in: sectionIds }, tenantId, deletedAt: null },

            include: {
              courseOffering: { include: { course: true } },

              seatLedger: true,
            },
          })
        : [];

    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    const courseCodes = new Set<string>();

    const expectedVtcStage = expectedVtcStageForSemester(dto.semesterSequence);

    for (const [slotKey, sectionId] of Object.entries(dto.selections)) {
      if (!sectionId) {
        issues.push({
          code: 'MISSING_SELECTION',
          message: `Missing selection for ${slotKey}`,
        });

        continue;
      }

      const section = sectionMap.get(sectionId);

      if (!section) {
        issues.push({
          code: 'INVALID_SECTION',
          message: `Invalid section for ${slotKey}`,
        });

        continue;
      }

      const category =
        slotKey === 'VTC' || slotKey.startsWith('VTC-')
          ? 'VTC'
          : slotKey.split('-')[0]!;
      if (category === 'VTC' && expectedVtcStage != null) {
        const vtcMeta = resolveVtcTrackFields({
          code: section.courseOffering.course.code,
          title: section.courseOffering.course.title,
          vtcTrackGroupCode: section.courseOffering.course.vtcTrackGroupCode,
          vtcTrackStage: section.courseOffering.course.vtcTrackStage,
        });
        if (!vtcMeta.vtcTrackGroupCode) {
          issues.push({
            code: 'VTC_TRACK_METADATA_MISSING',
            message: `Course ${section.courseOffering.course.code} is missing VTC track metadata`,
          });
        } else if (vtcMeta.vtcTrackStage !== expectedVtcStage) {
          issues.push({
            code: 'VTC_STAGE_MISMATCH',
            message: `VTC course ${section.courseOffering.course.code} is stage ${vtcMeta.vtcTrackStage ?? '?'}; semester ${dto.semesterSequence} requires stage ${expectedVtcStage}`,
          });
        }
      }

      if (dto.shiftId && section.shiftId !== dto.shiftId) {
        issues.push({
          code: 'SHIFT_MISMATCH',

          message: `${section.courseOffering.course.code} section is not in selected shift`,
        });
      }

      const code = section.courseOffering.course.code;

      if (courseCodes.has(code)) {
        const isMajorSlot = slotKey.startsWith('MAJOR');
        issues.push({
          code: isMajorSlot ? 'DUPLICATE_MAJOR_PAPER' : 'DUPLICATE_COURSE',
          message: isMajorSlot
            ? 'Duplicate major paper assignment detected'
            : `Duplicate course ${code} selected`,
        });
      }

      courseCodes.add(code);

      const confirmed = section.seatLedger?.confirmedCount ?? 0;

      if (section.capacity > 0 && confirmed >= section.capacity) {
        issues.push({
          code: 'SECTION_FULL',

          message: `Section ${section.sectionCode} for ${code} is full`,
        });
      }
    }

    for (const [cat, count] of Object.entries(pools.categoryCounts)) {
      if (count <= 0) continue;

      if (cat === 'MAJOR' && dto.majorSubjectSlug) continue;

      if (cat === 'MINOR' && dto.minorSubjectSlug) continue;

      const selected = Object.keys(dto.selections).filter(
        (k) => k === cat || k.startsWith(`${cat}-`),
      ).length;

      if (selected < count) {
        issues.push({
          code: 'MISSING_CATEGORY',

          message: `${cat}: need ${count}, have ${selected}`,
        });
      }
    }

    const needsMinor = (pools.categoryCounts.MINOR ?? 0) > 0;

    if (needsMinor && dto.majorSubjectSlug && dto.minorSubjectSlug) {
      const pair = await this.eligibility.validateMajorMinorPair(
        tenantId,

        dto.majorSubjectSlug,

        dto.minorSubjectSlug,
      );

      issues.push(...pair.issues);
    }

    const aecEligibility = await this.resolveAdmissionLanguageEligibility(
      tenantId,

      dto.selections,

      dto.languageEligibility,
    );

    for (const [slotKey, sectionId] of Object.entries(dto.selections)) {
      if (!sectionId || (slotKey !== 'AEC' && !slotKey.startsWith('AEC-')))
        continue;

      const section = sectionMap.get(sectionId);

      if (!section) continue;

      const slug = resolveAecSubjectSlug(section.courseOffering.course);

      if (!isAecSlugAllowed(slug, aecEligibility)) {
        issues.push({
          code: 'AEC_INELIGIBLE',

          message: `Not eligible for AEC course ${slug}`,
        });
      }
    }

    const eligibilityCtx = await this.courseEligibility.resolveContext(
      tenantId,
      {
        programVersionId: dto.programVersionId,
        streamId: dto.streamId,
        majorSubjectSlug: dto.majorSubjectSlug,
        minorSubjectSlug: dto.minorSubjectSlug,
        class12Subjects: dto.class12Subjects,
      },
    );

    for (const section of sections) {
      const rules = normalizeCourseEligibilityRules(
        section.courseOffering.course.eligibilityRules,
      );
      if (isRulesEmpty(rules)) continue;
      const result = evaluateCourseEligibility(rules, eligibilityCtx);
      if (!result.eligible) {
        issues.push({
          code: 'COURSE_INELIGIBLE',
          message:
            result.reasons[0] ??
            `Not eligible for ${section.courseOffering.course.code}`,
        });
      }
    }

    return { ok: issues.length === 0, issues };
  }

  /** Admin admission: selecting an AEC declares eligibility for that language slug. */

  async resolveAdmissionLanguageEligibility(
    tenantId: string,

    selections: Record<string, string>,

    base?: LanguageEligibility | null,
  ): Promise<LanguageEligibility> {
    const aecSlugs = await this.resolveAecSlugsFromSelections(
      tenantId,
      selections,
    );

    return mergeLanguageEligibility(base, aecSlugs);
  }

  async resolveAecSlugsFromSelections(
    tenantId: string,

    selections: Record<string, string>,
  ): Promise<string[]> {
    const aecSectionIds = Object.entries(selections)

      .filter(([key]) => key === 'AEC' || key.startsWith('AEC-'))

      .map(([, id]) => id)

      .filter(Boolean);

    if (!aecSectionIds.length) return [];

    const sections = await this.prisma.offeringSection.findMany({
      where: { id: { in: aecSectionIds }, tenantId, deletedAt: null },

      include: { courseOffering: { include: { course: true } } },
    });

    return sections.map((s) => resolveAecSubjectSlug(s.courseOffering.course));
  }

  private async mapSubjectPathsToPoolOfferings(
    tenantId: string,

    programVersionId: string,

    semesterSequence: number,

    category: string,

    paths: {
      id: string;
      slug: string;
      name: string;
      department?: { id: string; name: string; code: string } | null;
    }[],
  ): Promise<NepPoolOffering[]> {
    const allOfferings = await this.listPoolByNepRole(
      tenantId,

      programVersionId,

      semesterSequence,

      category,
    );

    const slugSet = new Set(paths.map((p) => p.slug));
    const departmentIds = new Set(
      paths
        .map((p) => p.department?.id)
        .filter((id): id is string => Boolean(id)),
    );

    return allOfferings.filter((o) => {
      if (!o.course) return false;
      const candidates = this.eligibility.resolveCourseSubjectSlugCandidates({
        subjectSlug: o.course.subjectSlug,
        title: o.course.title ?? undefined,
        department: o.course.department
          ? {
              name: o.course.department.name,
              code: o.course.department.code ?? undefined,
            }
          : undefined,
      });
      if (candidates.some((slug) => slugSet.has(slug))) return true;
      const courseDeptId = o.course?.department?.id;
      return Boolean(courseDeptId && departmentIds.has(courseDeptId));
    });
  }

  private dedupeOfferings(rows: NepPoolOffering[]) {
    const seen = new Set<string>();

    const out: NepPoolOffering[] = [];

    for (const row of rows) {
      const key = row.id || row.course?.code || '';

      if (!key || seen.has(key)) continue;

      seen.add(key);

      out.push(row);
    }

    return out;
  }
}
