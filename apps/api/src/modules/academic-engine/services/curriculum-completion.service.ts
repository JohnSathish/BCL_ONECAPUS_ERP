import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { paginate } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../database/prisma.service';
import {
  POOL_ELIGIBLE_CATEGORIES,
  isPoolEligibleCategory,
} from '../domain/category-pools';
import {
  buildMissingItemsFromCell,
  evaluateCompletionCell,
  expectedCreditsForCategory,
  rollupStatus,
  sortCategories,
} from '../domain/curriculum-completion.helpers';
import type {
  CompletionMissingItem,
  CompletionOfferingSnapshot,
  CompletionProgrammeResult,
  CompletionSummaryResult,
  ResolvedSemesterExpectation,
  SharedPoolAuditRow,
} from '../domain/curriculum-completion.types';
import {
  DEFAULT_FYUGP_SEMESTER_RULES,
  DEFAULT_NEHU_TOTAL_SEMESTERS,
  type CategoryMeta,
  type SemesterRulePayload,
} from '../domain/fyugp-templates';
import type {
  CurriculumCompletionExportQueryDto,
  CurriculumCompletionMissingItemsQueryDto,
  CurriculumCompletionQueryDto,
} from '../dto/curriculum-completion-query.dto';
import { ruleRecordToPayload } from './structure-rules.helper';
import { CurriculumResolutionService } from './curriculum-resolution.service';

type ProgrammeVersionRow = Prisma.ProgramVersionGetPayload<{
  include: {
    program: {
      include: { department: { select: { id: true; institutionId: true } } };
    };
  };
}>;

@Injectable()
export class CurriculumCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
  ) {}

  async getSummary(
    tenantId: string,
    query: CurriculumCompletionQueryDto,
  ): Promise<CompletionSummaryResult> {
    const programmes = await this.buildProgrammeMatrix(tenantId, query);
    const poolAudit = await this.getSharedPoolsAudit(tenantId, query);

    let completedSemesters = 0;
    let missingMappings = 0;
    let unmappedCourses = 0;
    let pendingFacultyAssignment = 0;

    for (const programme of programmes) {
      for (const semester of programme.semesters) {
        if (semester.semesterStatus === 'COMPLETE') completedSemesters += 1;
        for (const cell of semester.cells) {
          if (cell.status !== 'COMPLETE') missingMappings += 1;
        }
      }
    }

    const detail = await this.collectMissingItems(tenantId, query, programmes);
    unmappedCourses = detail.filter(
      (i) => i.issueType === 'MISSING_SECTION',
    ).length;
    pendingFacultyAssignment = detail.filter(
      (i) => i.issueType === 'MISSING_FACULTY',
    ).length;

    const highlightedSemester = query.batchId
      ? await this.resolveBatchSemester(tenantId, query.batchId)
      : null;

    return {
      totalProgrammes: programmes.length,
      completedSemesters,
      missingMappings,
      unmappedCourses,
      sharedPoolsMissing: poolAudit.filter((r) => r.status !== 'COMPLETE')
        .length,
      pendingFacultyAssignment,
      highlightedSemester,
    };
  }

  async getMatrix(tenantId: string, query: CurriculumCompletionQueryDto) {
    const programmes = await this.buildProgrammeMatrix(tenantId, query);
    return { programmes };
  }

  async getMissingItems(
    tenantId: string,
    query: CurriculumCompletionMissingItemsQueryDto,
  ) {
    const programmes = await this.buildProgrammeMatrix(tenantId, query);
    let items = await this.collectMissingItems(tenantId, query, programmes);

    if (query.category) {
      items = items.filter(
        (i) => i.category.toUpperCase() === query.category!.toUpperCase(),
      );
    }
    if (query.issueType) {
      items = items.filter((i) => i.issueType === query.issueType);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const total = items.length;
    const slice = items.slice((page - 1) * limit, page * limit);
    return paginate(slice, total, page, limit);
  }

  async getSharedPoolsAudit(
    tenantId: string,
    query: CurriculumCompletionQueryDto,
  ): Promise<SharedPoolAuditRow[]> {
    const semesters = query.semesterSequence
      ? [query.semesterSequence]
      : Array.from({ length: DEFAULT_NEHU_TOTAL_SEMESTERS }, (_, i) => i + 1);

    const rows: SharedPoolAuditRow[] = [];
    for (const semesterNo of semesters) {
      for (const category of POOL_ELIGIBLE_CATEGORIES) {
        const pools = await this.prisma.categoryPool.findMany({
          where: {
            tenantId,
            semesterNo,
            categoryType: category,
            active: true,
          },
          include: {
            courses: { where: { active: true } },
            offerings: {
              where: {
                tenantId,
                deletedAt: null,
                mappingSource: 'SHARED_POOL',
              },
              include: {
                sections: {
                  where: { deletedAt: null, status: 'active' },
                  select: { id: true },
                },
              },
            },
            assignments: {
              where: { tenantId, active: true },
              select: { programVersionId: true },
            },
          },
        });

        const pool = pools[0];
        const courseCount = pool?.courses.length ?? 0;
        const sectionCount =
          pool?.offerings.reduce((sum, o) => sum + o.sections.length, 0) ?? 0;
        const programmesAssigned = pool?.assignments.length ?? 0;

        let status: SharedPoolAuditRow['status'] = 'COMPLETE';
        if (!pool) status = 'NOT_CONFIGURED';
        else if (courseCount === 0 || sectionCount === 0) status = 'PARTIAL';

        rows.push({
          category,
          semesterNo,
          poolExists: Boolean(pool),
          poolId: pool?.id ?? null,
          poolName: pool?.poolName ?? null,
          courseCount,
          sectionCount,
          programmesAssigned,
          status,
        });
      }
    }
    return rows;
  }

  async exportReport(
    tenantId: string,
    query: CurriculumCompletionExportQueryDto,
  ) {
    const programmes = await this.buildProgrammeMatrix(tenantId, query);
    const missingItems = await this.collectMissingItems(
      tenantId,
      query,
      programmes,
    );
    const poolAudit = await this.getSharedPoolsAudit(tenantId, query);

    if (query.format === 'csv') {
      return this.buildCsv(programmes, missingItems, query.reportType);
    }
    return this.buildXlsx(
      programmes,
      missingItems,
      poolAudit,
      query.reportType,
    );
  }

  private async buildProgrammeMatrix(
    tenantId: string,
    query: CurriculumCompletionQueryDto,
  ): Promise<CompletionProgrammeResult[]> {
    const versions = await this.loadProgrammeVersions(tenantId, query);
    const rulesByVersion = await this.loadRulesByVersion(
      tenantId,
      versions.map((v) => v.id),
    );

    const results: CompletionProgrammeResult[] = [];
    for (const version of versions) {
      const semesters = await this.buildSemestersForVersion(
        tenantId,
        version,
        rulesByVersion.get(version.id) ?? new Map(),
        query,
      );
      results.push({
        programVersionId: version.id,
        programId: version.programId,
        programCode: version.program.code,
        programName: version.program.name,
        version: version.version,
        versionStatus: version.status ?? 'PUBLISHED',
        departmentId: version.program.departmentId,
        overallStatus: rollupStatus(semesters.map((s) => s.semesterStatus)),
        semesters,
      });
    }
    return results;
  }

  private async buildSemestersForVersion(
    tenantId: string,
    version: ProgrammeVersionRow,
    ruleMap: Map<number, SemesterRulePayload & { fromDefaults: boolean }>,
    query: CurriculumCompletionQueryDto,
  ) {
    const semesters = query.semesterSequence
      ? [query.semesterSequence]
      : Array.from({ length: DEFAULT_NEHU_TOTAL_SEMESTERS }, (_, i) => i + 1);

    const semesterResults = [];
    for (const semesterSequence of semesters) {
      const expectation =
        ruleMap.get(semesterSequence) ?? this.defaultRule(semesterSequence);
      const hasStructureRule = ruleMap.has(semesterSequence);
      const poolAssigned =
        (
          await this.curriculum.getAssignedPoolIds(
            tenantId,
            version.id,
            semesterSequence,
          )
        ).length > 0;

      const resolved = await this.curriculum.resolveProgrammeCurriculum(
        tenantId,
        version.id,
        semesterSequence,
      );

      const offeringIds = [
        ...resolved.directOfferings.map((o) => o.id),
        ...resolved.inheritedPoolOfferings.map((o) => o.offering.id),
      ];
      const sectionMap = await this.loadSectionSnapshots(tenantId, offeringIds);

      const directSnapshots = resolved.directOfferings.map((o) =>
        this.toOfferingSnapshot(o, sectionMap.get(o.id) ?? []),
      );
      const poolSnapshots = resolved.inheritedPoolOfferings.map((row) =>
        this.toOfferingSnapshot(
          row.offering,
          sectionMap.get(row.offering.id) ?? [],
        ),
      );

      const categories = sortCategories(
        Object.keys(expectation.categoryCounts).filter(
          (k) => (expectation.categoryCounts[k] ?? 0) > 0,
        ),
      );

      const cells = categories.map((category) => {
        const required = expectation.categoryCounts[category] ?? 0;
        const direct = directSnapshots.filter(
          (o) => (o.category ?? '').toUpperCase() === category,
        );
        const pool = poolSnapshots.filter(
          (o) => (o.category ?? '').toUpperCase() === category,
        );
        return evaluateCompletionCell({
          category,
          required,
          directOfferings: direct,
          poolOfferings: pool,
          poolAssigned: isPoolEligibleCategory(category) ? poolAssigned : false,
          isPoolEligible: isPoolEligibleCategory(category),
          hasStructureRule,
          expectedCredits: expectedCreditsForCategory(
            expectation.categoryMeta,
            category,
          ),
        });
      });

      semesterResults.push({
        semesterSequence,
        semesterStatus: rollupStatus(cells.map((c) => c.status)),
        hasStructureRule,
        cells,
      });
    }
    return semesterResults;
  }

  private async collectMissingItems(
    tenantId: string,
    query: CurriculumCompletionQueryDto,
    programmes: CompletionProgrammeResult[],
  ): Promise<CompletionMissingItem[]> {
    const items: CompletionMissingItem[] = [];
    for (const programme of programmes) {
      for (const semester of programme.semesters) {
        if (
          query.semesterSequence &&
          semester.semesterSequence !== query.semesterSequence
        ) {
          continue;
        }
        const resolved = await this.curriculum.resolveProgrammeCurriculum(
          tenantId,
          programme.programVersionId,
          semester.semesterSequence,
        );
        const offeringIds = [
          ...resolved.directOfferings.map((o) => o.id),
          ...resolved.inheritedPoolOfferings.map((o) => o.offering.id),
        ];
        const sectionMap = await this.loadSectionSnapshots(
          tenantId,
          offeringIds,
        );
        const directSnapshots = resolved.directOfferings.map((o) =>
          this.toOfferingSnapshot(o, sectionMap.get(o.id) ?? []),
        );
        const poolSnapshots = resolved.inheritedPoolOfferings.map((row) =>
          this.toOfferingSnapshot(
            row.offering,
            sectionMap.get(row.offering.id) ?? [],
          ),
        );

        for (const cell of semester.cells) {
          if (cell.status === 'COMPLETE') continue;
          const direct = directSnapshots.filter(
            (o) => (o.category ?? '').toUpperCase() === cell.category,
          );
          const pool = poolSnapshots.filter(
            (o) => (o.category ?? '').toUpperCase() === cell.category,
          );
          items.push(
            ...buildMissingItemsFromCell({
              programVersionId: programme.programVersionId,
              programCode: programme.programCode,
              programName: programme.programName,
              semesterSequence: semester.semesterSequence,
              cell,
              directOfferings: direct,
              poolOfferings: pool,
            }),
          );
        }
      }
    }
    return items;
  }

  private async loadProgrammeVersions(
    tenantId: string,
    query: CurriculumCompletionQueryDto,
  ): Promise<ProgrammeVersionRow[]> {
    const versionWhere: Prisma.ProgramVersionWhereInput = {
      tenantId,
      deletedAt: null,
      program: { deletedAt: null },
      ...(query.programVersionId ? { id: query.programVersionId } : {}),
      ...(query.versionStatus && query.versionStatus !== 'ALL'
        ? {
            status:
              query.versionStatus === 'ACTIVE'
                ? 'PUBLISHED'
                : query.versionStatus,
          }
        : {}),
      ...(query.departmentId
        ? { program: { departmentId: query.departmentId } }
        : {}),
      ...(query.institutionId
        ? { program: { department: { institutionId: query.institutionId } } }
        : {}),
    };

    return this.prisma.programVersion.findMany({
      where: versionWhere,
      include: {
        program: {
          include: {
            department: { select: { id: true, institutionId: true } },
          },
        },
      },
      orderBy: [{ program: { code: 'asc' } }, { version: 'desc' }],
    });
  }

  private async loadRulesByVersion(tenantId: string, versionIds: string[]) {
    if (!versionIds.length)
      return new Map<string, Map<number, ResolvedSemesterExpectation>>();

    const rules = await this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId: { in: versionIds } },
      include: { lines: true },
    });

    const map = new Map<string, Map<number, ResolvedSemesterExpectation>>();
    for (const rule of rules) {
      const payload = ruleRecordToPayload(rule, 20);
      const byVersion = map.get(rule.programVersionId) ?? new Map();
      byVersion.set(rule.semesterSequence, { ...payload, fromDefaults: false });
      map.set(rule.programVersionId, byVersion);
    }
    return map;
  }

  private defaultRule(semesterSequence: number): ResolvedSemesterExpectation {
    const fallback =
      DEFAULT_FYUGP_SEMESTER_RULES.find(
        (r) => r.semesterSequence === semesterSequence,
      ) ?? DEFAULT_FYUGP_SEMESTER_RULES[0]!;
    return { ...fallback, fromDefaults: true };
  }

  private async loadSectionSnapshots(tenantId: string, offeringIds: string[]) {
    const map = new Map<string, CompletionOfferingSnapshot['sections']>();
    if (!offeringIds.length) return map;

    const sections = await this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        courseOfferingId: { in: offeringIds },
        deletedAt: null,
        status: 'active',
      },
      include: {
        subjectAssignments: { select: { id: true } },
      },
    });

    for (const section of sections) {
      const list = map.get(section.courseOfferingId) ?? [];
      list.push({
        id: section.id,
        sectionCode: section.sectionCode,
        shiftId: section.shiftId,
        capacity: section.capacity,
        staffProfileId: section.staffProfileId,
        subjectAssignments: section.subjectAssignments,
      });
      map.set(section.courseOfferingId, list);
    }
    return map;
  }

  private toOfferingSnapshot(
    offering: {
      id: string;
      category: string | null;
      courseId: string;
      mappingSource?: string | null;
      course: {
        id: string;
        code: string;
        title: string;
        credits: number | Prisma.Decimal;
      };
    },
    sections: CompletionOfferingSnapshot['sections'],
  ): CompletionOfferingSnapshot {
    return {
      id: offering.id,
      category: offering.category,
      courseId: offering.courseId,
      mappingSource: offering.mappingSource,
      course: {
        ...offering.course,
        credits: Number(offering.course.credits),
      },
      sections,
    };
  }

  private async resolveBatchSemester(tenantId: string, batchId: string) {
    const mapping = await this.prisma.batchSemesterMapping.findFirst({
      where: { tenantId, admissionBatchId: batchId, isActive: true },
      select: { semesterNumber: true },
    });
    return mapping?.semesterNumber ?? null;
  }

  private buildCsv(
    programmes: CompletionProgrammeResult[],
    missingItems: CompletionMissingItem[],
    reportType: string,
  ): { buffer: Buffer; filename: string; contentType: string } {
    const lines: string[] = [];
    if (reportType === 'missing-setup') {
      lines.push(
        'Programme,Semester,Category,Issue,Message,Course,QuickAction',
      );
      for (const item of missingItems) {
        lines.push(
          [
            item.programCode,
            item.semesterSequence,
            item.category,
            item.issueType,
            `"${item.message.replace(/"/g, '""')}"`,
            item.courseCode ?? '',
            item.quickAction,
          ].join(','),
        );
      }
    } else {
      lines.push('Programme,Semester,Category,Required,Actual,Status');
      for (const programme of programmes) {
        for (const semester of programme.semesters) {
          for (const cell of semester.cells) {
            lines.push(
              [
                programme.programCode,
                semester.semesterSequence,
                cell.category,
                cell.required,
                cell.actual,
                cell.status,
              ].join(','),
            );
          }
        }
      }
    }
    const buffer = Buffer.from(lines.join('\n'), 'utf-8');
    return {
      buffer,
      filename: `curriculum-${reportType}.csv`,
      contentType: 'text/csv',
    };
  }

  private async buildXlsx(
    programmes: CompletionProgrammeResult[],
    missingItems: CompletionMissingItem[],
    poolAudit: SharedPoolAuditRow[],
    reportType: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const workbook = new ExcelJS.Workbook();

    const matrixSheet = workbook.addWorksheet('Matrix');
    matrixSheet.addRow([
      'Programme',
      'Version',
      'Semester',
      'Category',
      'Required',
      'Actual',
      'Direct',
      'Pool',
      'Status',
      'Issues',
    ]);
    for (const programme of programmes) {
      for (const semester of programme.semesters) {
        for (const cell of semester.cells) {
          matrixSheet.addRow([
            programme.programCode,
            programme.version,
            semester.semesterSequence,
            cell.category,
            cell.required,
            cell.actual,
            cell.directCount,
            cell.poolCount,
            cell.status,
            cell.issues.join(', '),
          ]);
        }
      }
    }

    const missingSheet = workbook.addWorksheet('MissingItems');
    missingSheet.addRow([
      'Programme',
      'Semester',
      'Category',
      'Issue',
      'Message',
      'Course',
      'QuickAction',
    ]);
    for (const item of missingItems) {
      missingSheet.addRow([
        item.programCode,
        item.semesterSequence,
        item.category,
        item.issueType,
        item.message,
        item.courseCode ?? '',
        item.quickAction,
      ]);
    }

    if (reportType === 'nep-compliance') {
      const poolSheet = workbook.addWorksheet('SharedPools');
      poolSheet.addRow([
        'Category',
        'Semester',
        'PoolExists',
        'Courses',
        'Sections',
        'ProgrammesAssigned',
        'Status',
      ]);
      for (const row of poolAudit) {
        poolSheet.addRow([
          row.category,
          row.semesterNo,
          row.poolExists ? 'Yes' : 'No',
          row.courseCount,
          row.sectionCount,
          row.programmesAssigned,
          row.status,
        ]);
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `curriculum-${reportType}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
