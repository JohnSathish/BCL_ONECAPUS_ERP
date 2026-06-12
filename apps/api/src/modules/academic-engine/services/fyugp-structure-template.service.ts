import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicCatalogService } from '../../programs-courses/academic-catalog.service';
import {
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_NEHU_TOTAL_SEMESTERS,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  NEHU_FYUGP_DEFAULT_TEMPLATE_NAME,
  defaultNehuTemplateLines,
  linesToSemesterRules,
  semesterRulesToLines,
  type SemesterRulePayload,
  type TemplateLineInput,
} from '../domain/fyugp-templates';
import { isStructureCategoryType } from '../domain/nep-categories';
import {
  upsertSemesterStructureRules,
  ruleRecordToPayload,
} from './structure-rules.helper';
import type {
  ApplyFyugpTemplateDto,
  CreateFyugpTemplateDto,
  UpdateFyugpTemplateDto,
} from '../dto/fyugp-structure-template.dto';

export type ApplyTargetMode =
  | 'ALL_UG'
  | 'SELECTED_PROGRAMS'
  | 'SELECTED_VERSIONS';
export type ApplyConflictStrategy = 'REPLACE_ALL' | 'SKIP_EXISTING';

export type ResolvedApplyTarget = {
  programVersionId: string;
  programId: string;
  programCode: string;
  programName: string;
  version: number;
  programmeLevel: string | null;
};

export type ApplyPreviewItem = {
  programVersionId: string;
  programCode: string;
  programName: string;
  version: number;
  skipped: boolean;
  skippedReason?: string;
  changedSemesters: number[];
  currentRules: SemesterRulePayload[];
  proposedRules: SemesterRulePayload[];
};

@Injectable()
export class FyugpStructureTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicCatalog: AcademicCatalogService,
  ) {}

  listTemplates(tenantId: string, activeOnly = true) {
    return this.prisma.fyugpStructureTemplate.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { active: true } : {}),
      },
      include: {
        _count: { select: { lines: true } },
        createdBy: { select: { id: true, email: true } },
      },
      orderBy: [{ regulationYear: 'desc' }, { templateName: 'asc' }],
    });
  }

  async getTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.fyugpStructureTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: {
        lines: { orderBy: [{ semesterNo: 'asc' }, { categoryType: 'asc' }] },
        createdBy: { select: { id: true, email: true } },
      },
    });
    if (!template)
      throw new NotFoundException('FYUGP structure template not found');
    return template;
  }

  async createTemplate(
    tenantId: string,
    userId: string | undefined,
    dto: CreateFyugpTemplateDto,
  ) {
    this.validateLines(dto.lines);
    return this.prisma.fyugpStructureTemplate.create({
      data: {
        tenantId,
        templateName: dto.templateName.trim(),
        regulationYear: dto.regulationYear,
        programmeLevel: dto.programmeLevel,
        totalSemesters: dto.totalSemesters ?? 8,
        active: dto.active ?? true,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => this.lineCreateData(line)),
        },
      },
      include: {
        lines: { orderBy: [{ semesterNo: 'asc' }, { categoryType: 'asc' }] },
      },
    });
  }

  async createFromNehuDefaults(tenantId: string, userId: string | undefined) {
    const existing = await this.prisma.fyugpStructureTemplate.findFirst({
      where: { tenantId, templateName: NEHU_FYUGP_DEFAULT_TEMPLATE_NAME },
    });
    if (existing) {
      return this.getTemplate(tenantId, existing.id);
    }
    return this.createTemplate(tenantId, userId, {
      templateName: NEHU_FYUGP_DEFAULT_TEMPLATE_NAME,
      regulationYear: 2026,
      programmeLevel: 'UG',
      totalSemesters: DEFAULT_NEHU_TOTAL_SEMESTERS,
      active: true,
      lines: defaultNehuTemplateLines().map((line) => ({
        semesterNo: line.semesterNo,
        categoryType: line.categoryType,
        subjectCount: line.subjectCount,
        continuityRule: line.continuityRule ?? undefined,
        creditRule: line.creditRule ?? undefined,
        optionalFlag: line.optionalFlag,
      })),
    });
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    dto: UpdateFyugpTemplateDto,
  ) {
    await this.getTemplate(tenantId, templateId);
    if (dto.lines) this.validateLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.fyugpStructureTemplateLine.deleteMany({
          where: { templateId },
        });
        await tx.fyugpStructureTemplateLine.createMany({
          data: dto.lines.map((line) => ({
            templateId,
            ...this.lineCreateData(line),
          })),
        });
      }
      return tx.fyugpStructureTemplate.update({
        where: { id: templateId },
        data: {
          ...(dto.templateName !== undefined
            ? { templateName: dto.templateName.trim() }
            : {}),
          ...(dto.regulationYear !== undefined
            ? { regulationYear: dto.regulationYear }
            : {}),
          ...(dto.programmeLevel !== undefined
            ? { programmeLevel: dto.programmeLevel }
            : {}),
          ...(dto.totalSemesters !== undefined
            ? { totalSemesters: dto.totalSemesters }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        include: {
          lines: { orderBy: [{ semesterNo: 'asc' }, { categoryType: 'asc' }] },
        },
      });
    });
  }

  async deleteTemplate(tenantId: string, templateId: string) {
    await this.getTemplate(tenantId, templateId);
    await this.prisma.fyugpStructureTemplate.delete({
      where: { id: templateId },
    });
    return { deleted: true };
  }

  async resolveApplyTargets(
    tenantId: string,
    dto: Pick<
      ApplyFyugpTemplateDto,
      'mode' | 'programIds' | 'programVersionIds' | 'programmeLevel'
    >,
  ): Promise<ResolvedApplyTarget[]> {
    const programWhere: Prisma.ProgramWhereInput = { deletedAt: null };
    if (dto.mode === 'ALL_UG') {
      programWhere.level = 'UG';
    } else if (dto.programmeLevel) {
      programWhere.level = dto.programmeLevel;
    }

    const where: Prisma.ProgramVersionWhereInput = {
      tenantId,
      deletedAt: null,
      program: programWhere,
    };

    if (dto.mode === 'SELECTED_PROGRAMS') {
      if (!dto.programIds?.length) {
        throw new BadRequestException(
          'programIds required for SELECTED_PROGRAMS mode',
        );
      }
      where.programId = { in: dto.programIds };
    } else if (dto.mode === 'SELECTED_VERSIONS') {
      if (!dto.programVersionIds?.length) {
        throw new BadRequestException(
          'programVersionIds required for SELECTED_VERSIONS mode',
        );
      }
      where.id = { in: dto.programVersionIds };
    }

    const rows = await this.prisma.programVersion.findMany({
      where,
      include: {
        program: { select: { id: true, code: true, name: true, level: true } },
      },
      orderBy: [{ program: { code: 'asc' } }, { version: 'asc' }],
    });

    return rows.map((row) => ({
      programVersionId: row.id,
      programId: row.program.id,
      programCode: row.program.code,
      programName: row.program.name,
      version: row.version,
      programmeLevel: row.program.level,
    }));
  }

  async previewApply(
    tenantId: string,
    templateId: string,
    dto: ApplyFyugpTemplateDto,
  ): Promise<{
    templateId: string;
    templateName: string;
    items: ApplyPreviewItem[];
  }> {
    const template = await this.getTemplate(tenantId, templateId);
    const targets = await this.resolveApplyTargets(tenantId, dto);
    const proposedRules = this.templateToSemesterRules(
      template.lines,
      template.totalSemesters,
    );

    const versionIds = targets.map((t) => t.programVersionId);
    const existingRules = await this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId: { in: versionIds } },
      orderBy: { semesterSequence: 'asc' },
    });
    const rulesByVersion = new Map<string, typeof existingRules>();
    for (const rule of existingRules) {
      const list = rulesByVersion.get(rule.programVersionId) ?? [];
      list.push(rule);
      rulesByVersion.set(rule.programVersionId, list);
    }

    const items: ApplyPreviewItem[] = targets.map((target) => {
      const current = (rulesByVersion.get(target.programVersionId) ?? []).map(
        (rule) => this.dbRuleToPayload(rule),
      );
      const hasExisting = current.length > 0;
      const skipped = dto.conflictStrategy === 'SKIP_EXISTING' && hasExisting;
      const changedSemesters = skipped
        ? []
        : this.diffChangedSemesters(current, proposedRules);
      return {
        programVersionId: target.programVersionId,
        programCode: target.programCode,
        programName: target.programName,
        version: target.version,
        skipped,
        skippedReason: skipped ? 'Existing structure rules present' : undefined,
        changedSemesters,
        currentRules: current,
        proposedRules: skipped ? current : proposedRules,
      };
    });

    return {
      templateId: template.id,
      templateName: template.templateName,
      items,
    };
  }

  async applyTemplate(
    tenantId: string,
    templateId: string,
    dto: ApplyFyugpTemplateDto,
  ) {
    const preview = await this.previewApply(tenantId, templateId, dto);
    const template = await this.getTemplate(tenantId, templateId);
    const proposedRules = this.templateToSemesterRules(
      template.lines,
      template.totalSemesters,
    );

    let applied = 0;
    let skipped = 0;

    for (const item of preview.items) {
      if (item.skipped) {
        skipped += 1;
        continue;
      }
      await this.applyRulesToVersion(
        tenantId,
        item.programVersionId,
        template.id,
        template.totalSemesters,
        proposedRules,
      );
      applied += 1;
    }

    return {
      templateId: template.id,
      templateName: template.templateName,
      applied,
      skipped,
      total: preview.items.length,
    };
  }

  async applyTemplateToVersion(
    tenantId: string,
    templateId: string,
    programVersionId: string,
    conflictStrategy: ApplyConflictStrategy = 'REPLACE_ALL',
  ) {
    await this.academicCatalog.assertProgramVersion(tenantId, programVersionId);
    const template = await this.getTemplate(tenantId, templateId);
    const existingCount = await this.prisma.semesterStructureRule.count({
      where: { tenantId, programVersionId },
    });
    if (conflictStrategy === 'SKIP_EXISTING' && existingCount > 0) {
      return {
        applied: false,
        skipped: true,
        reason: 'Existing structure rules present',
      };
    }
    const proposedRules = this.templateToSemesterRules(
      template.lines,
      template.totalSemesters,
    );
    await this.applyRulesToVersion(
      tenantId,
      programVersionId,
      template.id,
      template.totalSemesters,
      proposedRules,
    );
    return { applied: true, skipped: false };
  }

  async loadNehuDefaultsForVersion(tenantId: string, programVersionId: string) {
    const template = await this.ensureNehuTemplate(tenantId);
    return this.applyTemplateToVersion(
      tenantId,
      template.id,
      programVersionId,
      'REPLACE_ALL',
    );
  }

  async cloneStructureBetweenVersions(
    tenantId: string,
    sourceVersionId: string,
    targetVersionId: string,
  ) {
    if (sourceVersionId === targetVersionId) {
      throw new BadRequestException(
        'Source and target programme versions must differ',
      );
    }
    await this.academicCatalog.assertProgramVersion(tenantId, sourceVersionId);
    await this.academicCatalog.assertProgramVersion(tenantId, targetVersionId);

    const sourceTemplate = await this.prisma.programStructureTemplate.findFirst(
      {
        where: { tenantId, programVersionId: sourceVersionId },
      },
    );
    const sourceRules = await this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId: sourceVersionId },
      include: { lines: true },
      orderBy: { semesterSequence: 'asc' },
    });
    if (!sourceRules.length) {
      throw new BadRequestException(
        'Source programme version has no structure rules',
      );
    }

    const payloads = sourceRules.map((rule) =>
      ruleRecordToPayload(
        rule,
        sourceTemplate?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET,
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.programStructureTemplate.upsert({
        where: { programVersionId: targetVersionId },
        create: {
          tenantId,
          programVersionId: targetVersionId,
          streamId: sourceTemplate?.streamId ?? null,
          structureType: sourceTemplate?.structureType ?? 'FYUGP_4Y_8S',
          totalSemesters: sourceTemplate?.totalSemesters ?? 8,
          degreeMinCredits:
            sourceTemplate?.degreeMinCredits ?? DEFAULT_DEGREE_MIN_CREDITS,
          semesterCreditTarget:
            sourceTemplate?.semesterCreditTarget ??
            DEFAULT_SEMESTER_CREDIT_TARGET,
        },
        update: {
          streamId: sourceTemplate?.streamId ?? null,
          structureType: sourceTemplate?.structureType ?? 'FYUGP_4Y_8S',
          totalSemesters: sourceTemplate?.totalSemesters ?? 8,
          degreeMinCredits:
            sourceTemplate?.degreeMinCredits ?? DEFAULT_DEGREE_MIN_CREDITS,
          semesterCreditTarget:
            sourceTemplate?.semesterCreditTarget ??
            DEFAULT_SEMESTER_CREDIT_TARGET,
          lastAppliedFyugpTemplateId: null,
          lastAppliedAt: null,
        },
      });

      await upsertSemesterStructureRules(
        tx,
        tenantId,
        targetVersionId,
        payloads,
        sourceTemplate?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET,
      );
    });

    return this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId: targetVersionId },
      include: { lines: true },
      orderBy: { semesterSequence: 'asc' },
    });
  }

  async ensureNehuTemplate(tenantId: string) {
    const existing = await this.prisma.fyugpStructureTemplate.findFirst({
      where: { tenantId, templateName: NEHU_FYUGP_DEFAULT_TEMPLATE_NAME },
    });
    if (existing) return existing;
    return this.createFromNehuDefaults(tenantId, undefined);
  }

  private async applyRulesToVersion(
    tenantId: string,
    programVersionId: string,
    templateId: string,
    totalSemesters: number,
    rules: SemesterRulePayload[],
  ) {
    await this.academicCatalog.assertProgramVersion(tenantId, programVersionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.programStructureTemplate.upsert({
        where: { programVersionId },
        create: {
          tenantId,
          programVersionId,
          structureType: 'FYUGP_4Y_8S',
          totalSemesters,
          degreeMinCredits: DEFAULT_DEGREE_MIN_CREDITS,
          semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
          lastAppliedFyugpTemplateId: templateId,
          lastAppliedAt: new Date(),
        },
        update: {
          totalSemesters,
          degreeMinCredits: DEFAULT_DEGREE_MIN_CREDITS,
          semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
          lastAppliedFyugpTemplateId: templateId,
          lastAppliedAt: new Date(),
        },
      });

      await upsertSemesterStructureRules(
        tx,
        tenantId,
        programVersionId,
        rules,
        DEFAULT_SEMESTER_CREDIT_TARGET,
      );
    });
  }

  private templateToSemesterRules(
    lines: Array<{
      semesterNo: number;
      categoryType: string;
      subjectCount: number;
      continuityRule: string | null;
      creditRule: Prisma.Decimal | null;
      optionalFlag: boolean;
    }>,
    totalSemesters: number,
  ): SemesterRulePayload[] {
    return linesToSemesterRules(
      lines.map((line) => ({
        semesterNo: line.semesterNo,
        categoryType: line.categoryType,
        subjectCount: line.subjectCount,
        continuityRule: line.continuityRule,
        creditRule: line.creditRule != null ? Number(line.creditRule) : null,
        optionalFlag: line.optionalFlag,
      })),
      totalSemesters,
      DEFAULT_SEMESTER_CREDIT_TARGET,
    );
  }

  private dbRuleToPayload(rule: {
    semesterSequence: number;
    categoryCounts: Prisma.JsonValue;
    continuityRules: Prisma.JsonValue;
    categoryMeta: Prisma.JsonValue | null;
  }): SemesterRulePayload {
    return {
      semesterSequence: rule.semesterSequence,
      categoryCounts: (rule.categoryCounts as Record<string, number>) ?? {},
      continuityRules: (rule.continuityRules as Record<string, string>) ?? {},
      categoryMeta:
        (rule.categoryMeta as SemesterRulePayload['categoryMeta']) ?? {},
    };
  }

  private diffChangedSemesters(
    current: SemesterRulePayload[],
    proposed: SemesterRulePayload[],
  ): number[] {
    const currentBySem = new Map(current.map((r) => [r.semesterSequence, r]));
    const changed: number[] = [];
    for (const next of proposed) {
      const prev = currentBySem.get(next.semesterSequence);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(next)) {
        changed.push(next.semesterSequence);
      }
    }
    for (const prev of current) {
      if (!proposed.some((p) => p.semesterSequence === prev.semesterSequence)) {
        changed.push(prev.semesterSequence);
      }
    }
    return [...new Set(changed)].sort((a, b) => a - b);
  }

  private validateLines(lines: TemplateLineInput[]) {
    if (!lines.length) {
      throw new BadRequestException('At least one template line is required');
    }
    for (const line of lines) {
      if (!isStructureCategoryType(line.categoryType)) {
        throw new BadRequestException(
          `Invalid category type: ${line.categoryType}`,
        );
      }
      if (line.semesterNo < 1) {
        throw new BadRequestException('semesterNo must be at least 1');
      }
      if (line.subjectCount < 0) {
        throw new BadRequestException('subjectCount cannot be negative');
      }
    }
  }

  private lineCreateData(line: TemplateLineInput) {
    return {
      semesterNo: line.semesterNo,
      categoryType: line.categoryType,
      subjectCount: line.subjectCount,
      continuityRule: line.continuityRule ?? null,
      creditRule: line.creditRule != null ? line.creditRule : null,
      optionalFlag: line.optionalFlag ?? false,
    };
  }
}

export { semesterRulesToLines, linesToSemesterRules };
