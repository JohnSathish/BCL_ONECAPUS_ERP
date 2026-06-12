import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  buildCategoryRequirements,
  type PathwayVariants,
  type RuleLineInput,
  type SemesterRulePayload,
  semesterRulesToRuleLines,
} from '../domain/fyugp-templates';

type StructureDb = PrismaService | Prisma.TransactionClient;

export type PersistedStructureRule = {
  id: string;
  semesterSequence: number;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categoryMeta: Record<
    string,
    { creditRule?: number; mandatory?: boolean; optional?: boolean }
  >;
  pathwayVariants?: import('../domain/fyugp-templates').PathwayVariants | null;
  semesterCreditTarget: number | null;
  lines: Array<{
    categoryType: string;
    requiredSubjectCount: number;
    requiredCredits: number | null;
    continuityRule: string | null;
    mandatoryFlag: boolean;
    uiOrder?: number | null;
  }>;
};

export function payloadToRuleLines(rule: SemesterRulePayload): RuleLineInput[] {
  return semesterRulesToRuleLines([rule]).map(
    ({ semesterNo: _sem, ...line }) => line,
  );
}

export function ruleRecordToPayload(
  rule: {
    semesterSequence: number;
    categoryCounts: Prisma.JsonValue;
    continuityRules: Prisma.JsonValue;
    categoryMeta: Prisma.JsonValue | null;
    pathwayVariants?: Prisma.JsonValue | null;
    semesterCreditTarget?: number | null;
    lines?: Array<{
      categoryType: string;
      requiredSubjectCount: number;
      requiredCredits: Prisma.Decimal | null;
      continuityRule: string | null;
      mandatoryFlag: boolean;
      uiOrder?: number | null;
    }>;
  },
  fallbackCreditTarget: number,
): SemesterRulePayload {
  if (rule.lines?.length) {
    const categoryCounts: Record<string, number> = {};
    const continuityRules: Record<string, string> = {};
    const categoryMeta: SemesterRulePayload['categoryMeta'] = {};
    for (const line of rule.lines) {
      if (line.requiredSubjectCount > 0) {
        categoryCounts[line.categoryType] = line.requiredSubjectCount;
      }
      if (line.continuityRule) {
        continuityRules[line.categoryType] = line.continuityRule;
      }
      if (line.requiredCredits != null || !line.mandatoryFlag) {
        categoryMeta[line.categoryType] = {
          ...(line.requiredCredits != null
            ? { creditRule: Number(line.requiredCredits) }
            : {}),
          mandatory: line.mandatoryFlag,
        };
      }
    }
    return {
      semesterSequence: rule.semesterSequence,
      semesterCreditTarget: rule.semesterCreditTarget ?? fallbackCreditTarget,
      categoryCounts,
      continuityRules,
      categoryMeta,
      pathwayVariants:
        (rule.pathwayVariants as PathwayVariants | null) ?? undefined,
    };
  }

  return {
    semesterSequence: rule.semesterSequence,
    semesterCreditTarget: rule.semesterCreditTarget ?? fallbackCreditTarget,
    categoryCounts: (rule.categoryCounts as Record<string, number>) ?? {},
    continuityRules: (rule.continuityRules as Record<string, string>) ?? {},
    categoryMeta:
      (rule.categoryMeta as SemesterRulePayload['categoryMeta']) ?? {},
    pathwayVariants:
      (rule.pathwayVariants as PathwayVariants | null) ?? undefined,
  };
}

export function buildPersistedRequirements(
  rule: SemesterRulePayload,
  fallbackCreditTarget: number,
  degreeMinCredits: number,
) {
  const payload = {
    ...rule,
    semesterCreditTarget: rule.semesterCreditTarget ?? fallbackCreditTarget,
  };
  return {
    payload,
    categoryRequirements: buildCategoryRequirements(payload),
    semesterCreditTarget: payload.semesterCreditTarget ?? fallbackCreditTarget,
    degreeMinCredits,
    lines: payloadToRuleLines(payload),
  };
}

export function lineCreateData(line: RuleLineInput) {
  return {
    categoryType: line.categoryType,
    requiredSubjectCount: line.requiredSubjectCount,
    requiredCredits: line.requiredCredits ?? null,
    continuityRule: line.continuityRule ?? null,
    mandatoryFlag: line.mandatoryFlag ?? true,
  };
}

export async function upsertSemesterStructureRules(
  db: StructureDb,
  tenantId: string,
  programVersionId: string,
  rules: SemesterRulePayload[],
  fallbackCreditTarget = DEFAULT_SEMESTER_CREDIT_TARGET,
) {
  for (const rule of rules) {
    const semesterCreditTarget =
      rule.semesterCreditTarget ?? fallbackCreditTarget;
    const saved = await db.semesterStructureRule.upsert({
      where: {
        programVersionId_semesterSequence: {
          programVersionId,
          semesterSequence: rule.semesterSequence,
        },
      },
      create: {
        tenantId,
        programVersionId,
        semesterSequence: rule.semesterSequence,
        categoryCounts: rule.categoryCounts,
        continuityRules: rule.continuityRules,
        categoryMeta: rule.categoryMeta ?? Prisma.JsonNull,
        pathwayVariants: rule.pathwayVariants ?? Prisma.JsonNull,
        semesterCreditTarget,
      },
      update: {
        categoryCounts: rule.categoryCounts,
        continuityRules: rule.continuityRules,
        categoryMeta: rule.categoryMeta ?? Prisma.JsonNull,
        pathwayVariants: rule.pathwayVariants ?? Prisma.JsonNull,
        semesterCreditTarget,
      },
    });

    const lines = payloadToRuleLines(rule);
    if (db.semesterStructureRuleLine) {
      await db.semesterStructureRuleLine.deleteMany({
        where: { ruleId: saved.id },
      });
      if (lines.length) {
        await db.semesterStructureRuleLine.createMany({
          data: lines.map((line) => ({
            ruleId: saved.id,
            ...lineCreateData(line),
          })),
        });
      }
    }
  }
}

export async function resolveSemesterCreditTarget(
  db: StructureDb,
  tenantId: string,
  programVersionId: string,
  semesterSequence: number,
): Promise<number> {
  const rule = await db.semesterStructureRule.findFirst({
    where: { tenantId, programVersionId, semesterSequence },
    select: { semesterCreditTarget: true },
  });
  if (rule?.semesterCreditTarget != null) return rule.semesterCreditTarget;

  const template = await db.programStructureTemplate.findFirst({
    where: { tenantId, programVersionId },
    select: { semesterCreditTarget: true },
  });

  return template?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET;
}

export async function resolveDegreeMinCredits(
  db: StructureDb,
  tenantId: string,
  programVersionId: string,
): Promise<number> {
  const template = await db.programStructureTemplate.findFirst({
    where: { tenantId, programVersionId },
    select: { degreeMinCredits: true },
  });
  return template?.degreeMinCredits ?? DEFAULT_DEGREE_MIN_CREDITS;
}
