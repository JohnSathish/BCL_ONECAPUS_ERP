import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_SEMESTER_CREDIT_TARGET,
  formatSemesterSummary,
  resolveSemesterRuleWithPathway,
  type HonoursTrack,
  type PathwayVariants,
  type SemesterRulePayload,
} from '../domain/fyugp-templates';
import { ruleRecordToPayload } from './structure-rules.helper';

export type ResolvedSemesterRule = SemesterRulePayload & {
  summary: string;
  honoursTrack?: HonoursTrack | null;
  pathwayVariants?: PathwayVariants;
};

@Injectable()
export class SemesterRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSemesterRule(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    honoursTrack?: HonoursTrack | null,
  ): Promise<ResolvedSemesterRule> {
    const rule = await this.prisma.semesterStructureRule.findFirst({
      where: { tenantId, programVersionId, semesterSequence },
      include: {
        lines: { orderBy: [{ uiOrder: 'asc' }, { categoryType: 'asc' }] },
      },
    });
    if (!rule) {
      throw new NotFoundException(
        `No semester structure rule for semester ${semesterSequence}`,
      );
    }

    const template = await this.prisma.programStructureTemplate.findFirst({
      where: { tenantId, programVersionId },
      select: { semesterCreditTarget: true },
    });
    const fallbackCreditTarget =
      template?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET;

    const basePayload = ruleRecordToPayload(rule, fallbackCreditTarget);
    const pathwayVariants =
      (rule.pathwayVariants as PathwayVariants | null) ?? undefined;
    const resolved = resolveSemesterRuleWithPathway(
      basePayload,
      pathwayVariants,
      honoursTrack,
    );

    return {
      ...resolved,
      summary: formatSemesterSummary(resolved),
      honoursTrack: honoursTrack ?? null,
      pathwayVariants,
    };
  }

  async listSemesterRules(
    tenantId: string,
    programVersionId: string,
    honoursTrack?: HonoursTrack | null,
  ): Promise<ResolvedSemesterRule[]> {
    const rules = await this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId },
      include: {
        lines: { orderBy: [{ uiOrder: 'asc' }, { categoryType: 'asc' }] },
      },
      orderBy: { semesterSequence: 'asc' },
    });

    const template = await this.prisma.programStructureTemplate.findFirst({
      where: { tenantId, programVersionId },
      select: { semesterCreditTarget: true },
    });
    const fallbackCreditTarget =
      template?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET;

    return rules.map((rule) => {
      const basePayload = ruleRecordToPayload(rule, fallbackCreditTarget);
      const pathwayVariants =
        (rule.pathwayVariants as PathwayVariants | null) ?? undefined;
      const resolved = resolveSemesterRuleWithPathway(
        basePayload,
        pathwayVariants,
        rule.semesterSequence === 8 ? honoursTrack : null,
      );
      return {
        ...resolved,
        summary: formatSemesterSummary(resolved),
        honoursTrack:
          rule.semesterSequence === 8 ? (honoursTrack ?? null) : null,
        pathwayVariants,
      };
    });
  }

  async resolveHonoursTrackForStudent(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
  ): Promise<HonoursTrack | null> {
    if (semesterSequence !== 8) return null;
    const track = await this.prisma.studentAcademicTrack.findFirst({
      where: { tenantId, studentId, effectiveFromSemester: 8 },
      orderBy: { updatedAt: 'desc' },
    });
    if (!track) return 'HONOURS';
    return track.track as HonoursTrack;
  }
}
