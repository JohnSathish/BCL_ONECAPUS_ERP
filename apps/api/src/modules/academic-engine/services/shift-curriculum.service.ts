import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { assignMajorPaperSlots } from '../domain/major-paper-assignment';
import {
  normalizeCourseEligibilityRules,
  isRulesEmpty,
} from '../domain/course-eligibility.engine';
import type { CourseEligibilityRules } from '../domain/course-eligibility.types';
import type {
  CurriculumManagerCategoryBlock,
  CurriculumManagerMajorDepartment,
  CurriculumManagerMinorDepartment,
  CurriculumManagerView,
} from '../domain/curriculum-manager.types';
import {
  minimumDirectOfferingCounts,
  requiredSemesterCategories,
  semesterCurriculumMode,
} from '../domain/curriculum-semester-requirements';
import { ruleRecordToPayload } from './structure-rules.helper';

export type ShiftAdmissionContext = {
  shift: { id: string; code: string; name: string };
  programVersionId: string | null;
  semesterSequence: number;
  allowedProgramIds: string[];
  allowedProgramVersionIds: string[];
  allowedDepartmentIds: string[];
  autoAssignCategories: string[];
  poolCoursesByCategory: Record<
    string,
    { id: string; code: string; title: string }[]
  >;
};

export type ShiftProgrammeRow = {
  programId: string;
  code: string;
  name: string;
  enabled: boolean;
  publishedVersionIds: string[];
};

export type ShiftDepartmentRow = {
  departmentId: string;
  code: string;
  name: string;
  enabled: boolean;
};

@Injectable()
export class ShiftCurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveShift(tenantId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found or inactive');
    }
    return shift;
  }

  /** Programmes enabled for a shift. When no config rows exist, all programmes are allowed. */
  async listProgrammesForShift(
    tenantId: string,
    shiftId: string,
    institutionId?: string,
  ): Promise<ShiftProgrammeRow[]> {
    await this.assertActiveShift(tenantId, shiftId);

    const configs = await this.prisma.shiftProgrammeConfig.findMany({
      where: { tenantId, shiftId },
      include: {
        program: {
          include: {
            versions: {
              where: { deletedAt: null, status: 'PUBLISHED' },
              select: { id: true, version: true },
              orderBy: { version: 'desc' },
            },
          },
        },
      },
    });

    if (configs.length > 0) {
      return configs
        .filter((c) => c.enabled)
        .map((c) => ({
          programId: c.programId,
          code: c.program.code,
          name: c.program.name,
          enabled: c.enabled,
          publishedVersionIds: c.program.versions.map((v) => v.id),
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    }

    const programs = await this.prisma.program.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId
          ? {
              department: { institutionId, deletedAt: null },
            }
          : {}),
      },
      include: {
        versions: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          select: { id: true },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return programs.map((p) => ({
      programId: p.id,
      code: p.code,
      name: p.name,
      enabled: true,
      publishedVersionIds: p.versions.map((v) => v.id),
    }));
  }

  async isProgramVersionAllowedForShift(
    tenantId: string,
    shiftId: string,
    programVersionId: string,
  ): Promise<boolean> {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      select: { programId: true },
    });
    if (!version) return false;

    const configCount = await this.prisma.shiftProgrammeConfig.count({
      where: { tenantId, shiftId, enabled: true },
    });
    if (configCount === 0) return true;

    const row = await this.prisma.shiftProgrammeConfig.findFirst({
      where: {
        tenantId,
        shiftId,
        programId: version.programId,
        enabled: true,
      },
    });
    return Boolean(row);
  }

  /** Departments enabled for a shift. When no config rows exist, all academic departments are allowed. */
  async listDepartmentsForShift(
    tenantId: string,
    shiftId: string,
    institutionId?: string,
  ): Promise<ShiftDepartmentRow[]> {
    await this.assertActiveShift(tenantId, shiftId);

    const configs = await this.prisma.shiftDepartmentConfig.findMany({
      where: { tenantId, shiftId },
      include: { department: true },
    });

    if (configs.length > 0) {
      return configs
        .filter((c) => c.enabled && !c.department.deletedAt)
        .map((c) => ({
          departmentId: c.departmentId,
          code: c.department.code,
          name: c.department.name,
          enabled: c.enabled,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const departments = await this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        departmentType: 'ACADEMIC',
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: { name: 'asc' },
    });

    return departments.map((d) => ({
      departmentId: d.id,
      code: d.code,
      name: d.name,
      enabled: true,
    }));
  }

  async filterSubjectPathsByShift<T extends { departmentId: string | null }>(
    tenantId: string,
    shiftId: string | undefined,
    paths: T[],
  ): Promise<T[]> {
    if (!shiftId) return paths;
    const allowed = await this.listDepartmentsForShift(tenantId, shiftId);
    if (
      (await this.prisma.shiftDepartmentConfig.count({
        where: { tenantId, shiftId, enabled: true },
      })) === 0
    ) {
      return paths;
    }
    const allowedIds = new Set(allowed.map((d) => d.departmentId));
    return paths.filter(
      (p) => !p.departmentId || allowedIds.has(p.departmentId),
    );
  }

  async getAutoAssignCategories(
    tenantId: string,
    shiftId: string,
    programVersionId: string,
    semesterSequence: number,
  ): Promise<string[]> {
    const policies = await this.prisma.shiftCurriculumPolicy.findMany({
      where: {
        tenantId,
        shiftId,
        semesterNo: semesterSequence,
        autoAssign: true,
        OR: [{ programVersionId }, { programVersionId: null }],
      },
    });
    return [...new Set(policies.map((p) => p.categoryType.toUpperCase()))];
  }

  async getShiftAdmissionContext(
    tenantId: string,
    shiftId: string,
    opts: {
      programVersionId?: string;
      semesterSequence?: number;
      institutionId?: string;
    },
  ): Promise<ShiftAdmissionContext> {
    const shift = await this.assertActiveShift(tenantId, shiftId);
    const semesterSequence = opts.semesterSequence ?? 1;

    const programmes = await this.listProgrammesForShift(
      tenantId,
      shiftId,
      opts.institutionId,
    );
    const departments = await this.listDepartmentsForShift(
      tenantId,
      shiftId,
      opts.institutionId,
    );

    const programVersionId = opts.programVersionId ?? null;
    let autoAssignCategories: string[] = [];
    const poolCoursesByCategory: ShiftAdmissionContext['poolCoursesByCategory'] =
      {};

    if (programVersionId) {
      autoAssignCategories = await this.getAutoAssignCategories(
        tenantId,
        shiftId,
        programVersionId,
        semesterSequence,
      );

      const poolIds = await this.resolveAssignedPoolIds(
        tenantId,
        programVersionId,
        semesterSequence,
        shiftId,
      );

      if (poolIds.length) {
        const pools = await this.prisma.categoryPool.findMany({
          where: { tenantId, id: { in: poolIds }, active: true },
          include: {
            courses: {
              where: { active: true },
              include: {
                course: { select: { id: true, code: true, title: true } },
              },
              orderBy: { displayOrder: 'asc' },
            },
          },
        });

        for (const pool of pools) {
          const cat = pool.categoryType.toUpperCase();
          poolCoursesByCategory[cat] = pool.courses.map((row) => ({
            id: row.course.id,
            code: row.course.code,
            title: row.course.title,
          }));
        }
      }
    }

    return {
      shift: { id: shift.id, code: shift.code, name: shift.name },
      programVersionId,
      semesterSequence,
      allowedProgramIds: programmes.map((p) => p.programId),
      allowedProgramVersionIds: programmes.flatMap(
        (p) => p.publishedVersionIds,
      ),
      allowedDepartmentIds: departments.map((d) => d.departmentId),
      autoAssignCategories,
      poolCoursesByCategory,
    };
  }

  /** Shift-specific pool assignments take precedence over global (shiftId null). */
  async resolveAssignedPoolIds(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    shiftId?: string,
  ): Promise<string[]> {
    const baseWhere = {
      tenantId,
      programVersionId,
      semesterNo: semesterSequence,
      active: true,
      pool: { active: true },
    };

    if (shiftId) {
      const shiftRows = await this.prisma.programmePoolAssignment.findMany({
        where: { ...baseWhere, shiftId },
        select: { poolId: true },
      });
      if (shiftRows.length) {
        return shiftRows.map((r) => r.poolId);
      }
    }

    const globalRows = await this.prisma.programmePoolAssignment.findMany({
      where: { ...baseWhere, shiftId: null },
      select: { poolId: true },
    });
    return globalRows.map((r) => r.poolId);
  }

  async upsertProgrammeConfigs(
    tenantId: string,
    shiftId: string,
    items: { programId: string; enabled: boolean }[],
  ) {
    await this.assertActiveShift(tenantId, shiftId);
    for (const item of items) {
      await this.prisma.shiftProgrammeConfig.upsert({
        where: {
          tenantId_shiftId_programId: {
            tenantId,
            shiftId,
            programId: item.programId,
          },
        },
        create: {
          tenantId,
          shiftId,
          programId: item.programId,
          enabled: item.enabled,
        },
        update: { enabled: item.enabled },
      });
    }
    return this.listProgrammesForShift(tenantId, shiftId);
  }

  async upsertDepartmentConfigs(
    tenantId: string,
    shiftId: string,
    items: { departmentId: string; enabled: boolean }[],
  ) {
    await this.assertActiveShift(tenantId, shiftId);
    for (const item of items) {
      await this.prisma.shiftDepartmentConfig.upsert({
        where: {
          tenantId_shiftId_departmentId: {
            tenantId,
            shiftId,
            departmentId: item.departmentId,
          },
        },
        create: {
          tenantId,
          shiftId,
          departmentId: item.departmentId,
          enabled: item.enabled,
        },
        update: { enabled: item.enabled },
      });
    }
    return this.listDepartmentsForShift(tenantId, shiftId);
  }

  async upsertCurriculumPolicy(
    tenantId: string,
    shiftId: string,
    payload: {
      programVersionId?: string | null;
      semesterNo: number;
      categoryType: string;
      autoAssign: boolean;
    },
  ) {
    await this.assertActiveShift(tenantId, shiftId);
    const existing = await this.prisma.shiftCurriculumPolicy.findFirst({
      where: {
        tenantId,
        shiftId,
        programVersionId: payload.programVersionId ?? null,
        semesterNo: payload.semesterNo,
        categoryType: payload.categoryType.toUpperCase(),
      },
    });

    if (existing) {
      return this.prisma.shiftCurriculumPolicy.update({
        where: { id: existing.id },
        data: { autoAssign: payload.autoAssign },
      });
    }

    return this.prisma.shiftCurriculumPolicy.create({
      data: {
        tenantId,
        shiftId,
        programVersionId: payload.programVersionId ?? null,
        semesterNo: payload.semesterNo,
        categoryType: payload.categoryType.toUpperCase(),
        autoAssign: payload.autoAssign,
      },
    });
  }

  /** Fill compulsory auto-assign categories (e.g. VAC) missing from admission selections. */
  async enrichSubjectSelections(
    tenantId: string,
    params: {
      shiftId: string;
      programVersionId: string;
      semesterSequence: number;
      selections: Record<string, string>;
    },
  ): Promise<Record<string, string>> {
    const autoCategories = await this.getAutoAssignCategories(
      tenantId,
      params.shiftId,
      params.programVersionId,
      params.semesterSequence,
    );
    if (!autoCategories.length) return params.selections;

    const result = { ...params.selections };
    const assignedCategories = new Set(
      Object.keys(result).map((key) => key.replace(/_\d+$/, '').toUpperCase()),
    );

    for (const category of autoCategories) {
      if ([...assignedCategories].some((c) => c === category)) continue;

      const section = await this.prisma.offeringSection.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          status: 'active',
          shiftId: params.shiftId,
          courseOffering: {
            deletedAt: null,
            semesterSequence: params.semesterSequence,
            category: { equals: category, mode: 'insensitive' },
            OR: [
              { programVersionId: params.programVersionId },
              { mappingSource: 'SHARED_POOL' },
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!section) continue;
      const slotKey = category;
      if (!result[slotKey]) {
        result[slotKey] = section.id;
      }
    }

    return result;
  }

  async selectionTriggersNccEnrollment(
    tenantId: string,
    selections: Record<string, string>,
  ): Promise<boolean> {
    const sectionIds = Object.values(selections).filter(Boolean);
    if (!sectionIds.length) return false;

    const sections = await this.prisma.offeringSection.findMany({
      where: { tenantId, id: { in: sectionIds }, deletedAt: null },
      include: { courseOffering: { include: { course: true } } },
    });

    return sections.some((section) => {
      const rules = section.courseOffering.course.eligibilityRules as {
        triggersNccEnrollment?: boolean;
      } | null;
      if (rules?.triggersNccEnrollment) return true;
      return section.courseOffering.course.code === 'MDC-116';
    });
  }

  async getCurriculumConfigurationStatus(
    tenantId: string,
    institutionId?: string,
  ) {
    const semesters = [1, 2, 3, 4, 5, 6] as const;

    const shifts = await this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });

    const programs = await this.prisma.program.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { code: { startsWith: 'BA-' } },
          { code: { startsWith: 'BSC-' } },
          { code: { startsWith: 'BCOM' } },
        ],
      },
      include: {
        versions: {
          where: { deletedAt: null, status: 'PUBLISHED', version: 1 },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const versionIds = programs
      .map((program) => program.versions[0]?.id)
      .filter(Boolean) as string[];

    const assignments = versionIds.length
      ? await this.prisma.programmePoolAssignment.findMany({
          where: {
            tenantId,
            programVersionId: { in: versionIds },
            active: true,
            pool: { active: true, ...(institutionId ? { institutionId } : {}) },
          },
          include: {
            pool: { select: { categoryType: true } },
          },
        })
      : [];

    const directOfferings = versionIds.length
      ? await this.prisma.courseOffering.findMany({
          where: {
            tenantId,
            programVersionId: { in: versionIds },
            deletedAt: null,
            semesterSequence: { in: [...semesters] },
            OR: [{ mappingSource: 'DIRECT' }, { categoryPoolId: null }],
          },
          select: {
            programVersionId: true,
            semesterSequence: true,
            category: true,
          },
        })
      : [];

    const shiftProgrammeConfigs =
      await this.prisma.shiftProgrammeConfig.findMany({
        where: { tenantId },
        select: { shiftId: true, programId: true, enabled: true },
      });

    const programFamily = (code: string) => {
      const upper = code.toUpperCase();
      if (upper.startsWith('BA-')) return 'BA';
      if (upper.startsWith('BSC-')) return 'BSC';
      if (upper.startsWith('BCOM')) return 'BCOM';
      return 'OTHER';
    };

    const families = [
      { key: 'BA', label: 'BA' },
      { key: 'BSC', label: 'B.Sc.' },
      { key: 'BCOM', label: 'B.Com.' },
    ] as const;

    const isDirectSemesterConfigured = (
      programVersionId: string,
      semesterNo: number,
    ) => {
      const rows = directOfferings.filter(
        (row) =>
          row.programVersionId === programVersionId &&
          row.semesterSequence === semesterNo,
      );
      const counts = new Map<string, number>();
      for (const row of rows) {
        const category = String(row.category ?? '').toUpperCase();
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
      const required = requiredSemesterCategories(semesterNo);
      const minimums = minimumDirectOfferingCounts(semesterNo);
      return required.every((category) => {
        const min = minimums[category] ?? 1;
        return (counts.get(category) ?? 0) >= min;
      });
    };

    const isVersionSemesterConfigured = (
      programVersionId: string,
      shiftId: string,
      semesterNo: number,
    ) => {
      if (semesterCurriculumMode(semesterNo) === 'direct-offerings') {
        return isDirectSemesterConfigured(programVersionId, semesterNo);
      }

      const rows = assignments.filter(
        (row) =>
          row.programVersionId === programVersionId &&
          row.semesterNo === semesterNo &&
          row.shiftId === shiftId,
      );
      const categories = new Set(
        rows.map((row) => String(row.pool.categoryType ?? '').toUpperCase()),
      );
      const required = requiredSemesterCategories(semesterNo);
      return required.every((category) => categories.has(category));
    };

    const rows = shifts.flatMap((shift) =>
      families.map((family) => {
        const familyPrograms = programs.filter(
          (program) => programFamily(program.code) === family.key,
        );
        const enabledPrograms = familyPrograms.filter((program) => {
          const config = shiftProgrammeConfigs.find(
            (row) => row.shiftId === shift.id && row.programId === program.id,
          );
          return (
            config?.enabled ?? (family.key === 'BA' || shift.code === 'DAY')
          );
        });

        const semestersStatus = Object.fromEntries(
          semesters.map((semesterNo) => {
            if (!enabledPrograms.length) {
              return [semesterNo, 'na' as const];
            }
            const complete = enabledPrograms.every((program) => {
              const versionId = program.versions[0]?.id;
              if (!versionId) return false;
              return isVersionSemesterConfigured(
                versionId,
                shift.id,
                semesterNo,
              );
            });
            return [
              semesterNo,
              complete ? ('complete' as const) : ('pending' as const),
            ];
          }),
        ) as Record<number, 'complete' | 'pending' | 'na'>;

        return {
          shiftId: shift.id,
          shiftCode: shift.code,
          shiftName: shift.name,
          programmeFamily: family.key,
          programmeLabel: family.label,
          programmeCount: enabledPrograms.length,
          semesters: semestersStatus,
        };
      }),
    );

    return { shifts, rows };
  }

  summarizeEligibilityRules(rulesInput: unknown): string {
    const rules = normalizeCourseEligibilityRules(rulesInput);
    if (isRulesEmpty(rules)) return 'No restrictions';

    const parts: string[] = [];
    if (rules.excludedMajorSubjectSlugs?.length) {
      parts.push(
        `Blocked for major: ${rules.excludedMajorSubjectSlugs.join(', ')}`,
      );
    }
    if (rules.excludedMinorSubjectSlugs?.length) {
      parts.push(
        `Blocked for minor: ${rules.excludedMinorSubjectSlugs.join(', ')}`,
      );
    }
    for (const row of rules.excludedWhenMajorAndClass12 ?? []) {
      parts.push(
        `Blocked when ${row.majorSubjectSlug} major + Class XII ${row.class12SubjectSlug}`,
      );
    }
    for (const row of rules.priorStudyExclusions ?? []) {
      parts.push(
        `Blocked if studied ${row.subjectSlug}${row.semesterSequence ? ` in Sem ${row.semesterSequence}` : ''}`,
      );
    }
    if (rules.class12SubjectExclusions?.length) {
      parts.push(
        `Blocked for Class XII: ${rules.class12SubjectExclusions
          .map((row) => row.label ?? row.subjectSlug)
          .join(', ')}`,
      );
    }
    if (rules.excludedStreams?.length) {
      parts.push(`Blocked streams: ${rules.excludedStreams.join(', ')}`);
    }
    if (rules.allowedStreams?.length) {
      parts.push(`Allowed streams only: ${rules.allowedStreams.join(', ')}`);
    }
    if (rules.triggersNccEnrollment) {
      parts.push('Triggers NCC enrollment');
    }
    return parts.join(' · ');
  }

  private poolCategoriesForSemester(semesterNo: number): string[] {
    if (semesterCurriculumMode(semesterNo) === 'direct-offerings') {
      return [];
    }
    return requiredSemesterCategories(semesterNo);
  }

  private async isDirectSemesterConfigured(
    tenantId: string,
    programVersionId: string,
    semesterNo: number,
  ): Promise<boolean> {
    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        programVersionId,
        semesterSequence: semesterNo,
        deletedAt: null,
        OR: [{ mappingSource: 'DIRECT' }, { categoryPoolId: null }],
      },
      select: { category: true },
    });
    const counts = new Map<string, number>();
    for (const offering of offerings) {
      const category = String(offering.category ?? '').toUpperCase();
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const required = requiredSemesterCategories(semesterNo);
    const minimums = minimumDirectOfferingCounts(semesterNo);
    return required.every((category) => {
      const min = minimums[category] ?? 1;
      return (counts.get(category) ?? 0) >= min;
    });
  }

  private buildMajorDepartmentsWithInternship(
    majorOfferings: Array<{
      id: string;
      majorPaperIndex: number | null;
      courseId: string;
      course: {
        code: string;
        title: string;
        department?: { name: string; code?: string } | null;
      };
    }>,
    internshipOfferings: Array<{
      id: string;
      courseId: string;
      course: {
        code: string;
        title: string;
        department?: { name: string; code?: string } | null;
      };
    }>,
    requiredCount: number,
  ): CurriculumManagerMajorDepartment[] {
    const grouped = new Map<string, typeof majorOfferings>();
    for (const offering of majorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        this.departmentNameFromCode(offering.course.code);
      if (!departmentName) continue;
      const key = departmentName.toLowerCase();
      const bucket = grouped.get(key) ?? [];
      bucket.push(offering);
      grouped.set(key, bucket);
    }

    const departments: CurriculumManagerMajorDepartment[] = [];
    for (const bucket of grouped.values()) {
      const assigned = assignMajorPaperSlots(
        bucket.map((offering) => ({
          majorPaperIndex: offering.majorPaperIndex,
          displayOrder: null,
          courseId: offering.courseId,
          course: { code: offering.course.code },
        })),
        requiredCount,
      );
      if (assigned.length < requiredCount) continue;

      const papers = assigned.map((slot) => {
        const offering = bucket.find((row) => row.courseId === slot.courseId);
        return {
          code: offering!.course.code,
          title: offering!.course.title,
          offeringId: offering!.id,
        };
      });

      const deptCode =
        bucket[0].course.department?.code?.trim().toUpperCase() ??
        bucket[0].course.code.split('-')[0]?.trim().toUpperCase();
      const internshipOffering = internshipOfferings.find((offering) => {
        const offeringDept =
          offering.course.department?.code?.trim().toUpperCase() ??
          offering.course.code.split('-')[0]?.trim().toUpperCase();
        return offeringDept === deptCode;
      });

      departments.push({
        departmentName:
          bucket[0].course.department?.name ??
          this.departmentNameFromCode(bucket[0].course.code) ??
          bucket[0].course.code,
        papers,
        internship: internshipOffering
          ? {
              code: internshipOffering.course.code,
              title: internshipOffering.course.title,
              offeringId: internshipOffering.id,
            }
          : null,
      });
    }

    return departments.sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  private buildMinorDepartments(
    minorOfferings: Array<{
      id: string;
      courseId: string;
      course: {
        code: string;
        title: string;
        department?: { name: string } | null;
      };
    }>,
  ): CurriculumManagerMinorDepartment[] {
    const grouped = new Map<string, (typeof minorOfferings)[number]>();
    for (const offering of minorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        this.departmentNameFromCode(offering.course.code);
      if (!departmentName) continue;
      const key = departmentName.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, offering);
    }

    return [...grouped.values()]
      .map((offering) => ({
        departmentName:
          offering.course.department?.name ??
          this.departmentNameFromCode(offering.course.code) ??
          offering.course.code,
        paper: {
          code: offering.course.code,
          title: offering.course.title,
          offeringId: offering.id,
        },
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }

  private departmentNameFromCode(code: string) {
    const prefix = code.split('-')[0]?.trim().toUpperCase();
    const map: Record<string, string> = {
      ECO: 'Economics',
      EDU: 'Education',
      ENG: 'English',
      GAR: 'Garo',
      GEO: 'Geography',
      HIS: 'History',
      PHI: 'Philosophy',
      POL: 'Political Science',
      SOC: 'Sociology',
      BOT: 'Botany',
      CHE: 'Chemistry',
      MAT: 'Mathematics',
      PHY: 'Physics',
      ZOO: 'Zoology',
      COM: 'Commerce',
      CS: 'Computer Science',
      BCA: 'Computer Science',
    };
    return prefix ? map[prefix] : undefined;
  }

  private buildMajorDepartments(
    majorOfferings: Array<{
      id: string;
      majorPaperIndex: number | null;
      courseId: string;
      course: {
        code: string;
        title: string;
        department?: { name: string } | null;
      };
    }>,
    requiredCount: number,
  ): CurriculumManagerMajorDepartment[] {
    const grouped = new Map<string, typeof majorOfferings>();
    for (const offering of majorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        this.departmentNameFromCode(offering.course.code);
      if (!departmentName) continue;
      const key = departmentName.toLowerCase();
      const bucket = grouped.get(key) ?? [];
      bucket.push(offering);
      grouped.set(key, bucket);
    }

    const departments: CurriculumManagerMajorDepartment[] = [];
    for (const bucket of grouped.values()) {
      const assigned = assignMajorPaperSlots(
        bucket.map((offering) => ({
          majorPaperIndex: offering.majorPaperIndex,
          displayOrder: null,
          courseId: offering.courseId,
          course: { code: offering.course.code },
        })),
        requiredCount,
      );
      if (assigned.length < requiredCount) continue;

      const papers = assigned.map((slot) => {
        const offering = bucket.find((row) => row.courseId === slot.courseId);
        return {
          code: offering!.course.code,
          title: offering!.course.title,
          offeringId: offering!.id,
        };
      });

      departments.push({
        departmentName:
          bucket[0].course.department?.name ??
          this.departmentNameFromCode(bucket[0].course.code) ??
          bucket[0].course.code,
        papers,
      });
    }

    return departments.sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  async getCurriculumManagerView(
    tenantId: string,
    shiftId: string,
    input: {
      programVersionId: string;
      semesterNo: number;
      institutionId?: string;
    },
  ): Promise<CurriculumManagerView> {
    const shift = await this.assertActiveShift(tenantId, shiftId);
    const semesterNo = input.semesterNo;

    const version = await this.prisma.programVersion.findFirst({
      where: {
        id: input.programVersionId,
        tenantId,
        deletedAt: null,
      },
      include: { program: { select: { code: true, name: true } } },
    });
    if (!version) {
      throw new NotFoundException('Programme version not found');
    }

    const allowed = await this.isProgramVersionAllowedForShift(
      tenantId,
      shiftId,
      version.id,
    );
    if (!allowed) {
      throw new BadRequestException(
        'This programme is not enabled for the selected shift',
      );
    }

    const structureRule = await this.prisma.semesterStructureRule.findFirst({
      where: {
        tenantId,
        programVersionId: version.id,
        semesterSequence: semesterNo,
      },
      include: { lines: { orderBy: { uiOrder: 'asc' } } },
    });

    const resolvedRule = structureRule
      ? ruleRecordToPayload(structureRule, 20)
      : {
          semesterSequence: semesterNo,
          categoryCounts: {},
          continuityRules: {},
          categoryMeta: {},
        };

    const categoryCounts = resolvedRule.categoryCounts ?? {};
    const continuityRules = resolvedRule.continuityRules ?? {};
    const minorEnabled = (categoryCounts.MINOR ?? 0) > 0;
    const majorRequired = categoryCounts.MAJOR ?? 0;

    const assignedPoolIds = await this.resolveAssignedPoolIds(
      tenantId,
      version.id,
      semesterNo,
      shiftId,
    );

    const assignedPools = assignedPoolIds.length
      ? await this.prisma.categoryPool.findMany({
          where: { tenantId, id: { in: assignedPoolIds }, active: true },
          include: {
            courses: {
              where: { active: true },
              include: {
                course: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    eligibilityRules: true,
                  },
                },
              },
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        })
      : [];

    const institutionId =
      input.institutionId ??
      (
        await this.prisma.program.findFirst({
          where: { id: version.programId, tenantId },
          select: { department: { select: { institutionId: true } } },
        })
      )?.department?.institutionId;

    const candidatePools = institutionId
      ? await this.prisma.categoryPool.findMany({
          where: {
            tenantId,
            institutionId,
            semesterNo,
            active: true,
            OR: [{ shiftId }, { shiftId: null }],
          },
          include: {
            _count: { select: { courses: { where: { active: true } } } },
          },
          orderBy: [{ categoryType: 'asc' }, { poolName: 'asc' }],
        })
      : [];

    const autoAssignCategories = version
      ? await this.getAutoAssignCategories(
          tenantId,
          shiftId,
          version.id,
          semesterNo,
        )
      : [];

    const poolCategoryOrder = [
      'MAJOR',
      'MINOR',
      'MDC',
      'AEC',
      'SEC',
      'VAC',
      'VTC',
    ] as const;

    const activeCategories = poolCategoryOrder.filter(
      (category) => (categoryCounts[category] ?? 0) > 0,
    );

    const categories: CurriculumManagerCategoryBlock[] = activeCategories.map(
      (categoryType) => {
        const assignedForCategory = assignedPools.filter(
          (pool) => pool.categoryType.toUpperCase() === categoryType,
        );
        const activePool = assignedForCategory[0] ?? null;
        const availablePools = candidatePools
          .filter((pool) => pool.categoryType.toUpperCase() === categoryType)
          .map((pool) => ({
            id: pool.id,
            poolName: pool.poolName,
            courseCount: pool._count.courses,
            assigned: assignedPoolIds.includes(pool.id),
            shiftId: pool.shiftId,
          }));

        const meta = resolvedRule.categoryMeta?.[categoryType];
        return {
          categoryType,
          requiredCount: categoryCounts[categoryType] ?? 0,
          mandatory: meta?.mandatory !== false,
          autoAssign: autoAssignCategories.includes(categoryType),
          continuityRule: continuityRules[categoryType] ?? null,
          pool: activePool
            ? {
                id: activePool.id,
                poolName: activePool.poolName,
                shiftId: activePool.shiftId,
                assigned: true,
              }
            : null,
          courses: (activePool?.courses ?? []).map((row) => ({
            courseId: row.course.id,
            code: row.course.code,
            title: row.course.title,
            displayOrder: row.displayOrder,
            eligibilityRules: normalizeCourseEligibilityRules(
              row.course.eligibilityRules,
            ),
            eligibilitySummary: this.summarizeEligibilityRules(
              row.course.eligibilityRules,
            ),
          })),
          availablePools,
        };
      },
    );

    const directMode =
      semesterCurriculumMode(semesterNo) === 'direct-offerings';

    const directOfferings = directMode
      ? await this.prisma.courseOffering.findMany({
          where: {
            tenantId,
            deletedAt: null,
            programVersionId: version.id,
            semesterSequence: semesterNo,
            OR: [{ mappingSource: 'DIRECT' }, { categoryPoolId: null }],
          },
          include: {
            course: {
              include: {
                department: { select: { name: true, code: true } },
              },
            },
          },
        })
      : [];

    const directByCategory = (category: string) =>
      directOfferings.filter(
        (offering) =>
          String(offering.category ?? '').toUpperCase() === category,
      );

    const majorOfferings = directMode
      ? directByCategory('MAJOR')
      : majorRequired > 0
        ? await this.prisma.courseOffering.findMany({
            where: {
              tenantId,
              deletedAt: null,
              programVersionId: version.id,
              semesterSequence: semesterNo,
              category: { equals: 'MAJOR', mode: 'insensitive' },
            },
            include: {
              course: {
                include: {
                  department: { select: { name: true, code: true } },
                },
              },
            },
          })
        : [];

    const internshipOfferings = directByCategory('INTERNSHIP');
    const minorOfferings = directByCategory('MINOR');

    const majorDepartments =
      majorRequired >= 3 && internshipOfferings.length
        ? this.buildMajorDepartmentsWithInternship(
            majorOfferings,
            internshipOfferings,
            majorRequired,
          )
        : majorRequired >= 2
          ? this.buildMajorDepartments(majorOfferings, majorRequired)
          : majorRequired === 1
            ? majorOfferings
                .filter((offering) => offering.course.department?.name)
                .map((offering) => ({
                  departmentName:
                    offering.course.department?.name ??
                    this.departmentNameFromCode(offering.course.code) ??
                    offering.course.code,
                  papers: [
                    {
                      code: offering.course.code,
                      title: offering.course.title,
                      offeringId: offering.id,
                    },
                  ],
                  internship: null,
                }))
                .sort((a, b) =>
                  a.departmentName.localeCompare(b.departmentName),
                )
            : [];

    const minorDepartments =
      minorEnabled && minorOfferings.length
        ? this.buildMinorDepartments(minorOfferings)
        : [];

    const poolCategories = this.poolCategoriesForSemester(semesterNo).filter(
      (category) => (categoryCounts[category] ?? 0) > 0,
    );
    const configuredPoolCategories = new Set(
      assignedPools.map((pool) => pool.categoryType.toUpperCase()),
    );
    const missingPoolCategories = poolCategories.filter(
      (category) => !configuredPoolCategories.has(category),
    );

    const directCategoryCounts = new Map<string, number>();
    for (const offering of directOfferings) {
      const category = String(offering.category ?? '').toUpperCase();
      directCategoryCounts.set(
        category,
        (directCategoryCounts.get(category) ?? 0) + 1,
      );
    }
    const requiredDirect = requiredSemesterCategories(semesterNo).filter(
      (category) =>
        semesterCurriculumMode(semesterNo) === 'direct-offerings' &&
        !poolCategories.includes(category),
    );
    const minimumDirect = minimumDirectOfferingCounts(semesterNo);
    const missingDirectCategories = requiredDirect.filter((category) => {
      const min = minimumDirect[category] ?? 1;
      return (directCategoryCounts.get(category) ?? 0) < min;
    });

    const missingCategories = [
      ...missingPoolCategories,
      ...missingDirectCategories,
    ];

    let configurationStatus: CurriculumManagerView['configurationStatus'] =
      'empty';
    if (
      (poolCategories.length === 0 || missingPoolCategories.length === 0) &&
      (requiredDirect.length === 0 || missingDirectCategories.length === 0) &&
      (poolCategories.length > 0 || requiredDirect.length > 0)
    ) {
      configurationStatus = 'complete';
    } else if (
      configuredPoolCategories.size > 0 ||
      directOfferings.length > 0
    ) {
      configurationStatus = 'partial';
    }

    const categorySummary = activeCategories
      .map((category) => `${categoryCounts[category]} ${category}`)
      .join(' + ');

    return {
      shift: { id: shift.id, code: shift.code, name: shift.name },
      programVersion: {
        id: version.id,
        code: version.program.code,
        name: version.program.name,
        version: version.version,
      },
      semesterNo,
      curriculumMode: semesterCurriculumMode(semesterNo),
      shiftIndependent: directMode,
      semesterSummary: categorySummary
        ? directMode
          ? `${categorySummary} — same programme mapping for Morning and Day shifts`
          : `${categorySummary} (${semesterNo === 3 ? '20' : '22'} credits typical)`
        : 'No FYUGP structure rule configured for this semester',
      categoryCounts,
      continuityRules,
      categories,
      majorDepartments,
      minorDepartments,
      minorEnabled,
      configurationStatus,
      missingCategories,
    };
  }

  async assignShiftSemesterPool(
    tenantId: string,
    shiftId: string,
    input: {
      programVersionId: string;
      semesterNo: number;
      poolId: string;
    },
  ) {
    await this.assertActiveShift(tenantId, shiftId);

    const pool = await this.prisma.categoryPool.findFirst({
      where: { id: input.poolId, tenantId, active: true },
    });
    if (!pool) {
      throw new NotFoundException('Category pool not found');
    }
    if (pool.semesterNo !== input.semesterNo) {
      throw new BadRequestException(
        `Pool is for semester ${pool.semesterNo}, not ${input.semesterNo}`,
      );
    }
    if (pool.shiftId && pool.shiftId !== shiftId) {
      throw new BadRequestException('Pool belongs to a different shift');
    }

    const categoryType = pool.categoryType.toUpperCase();
    const conflictingAssignments =
      await this.prisma.programmePoolAssignment.findMany({
        where: {
          tenantId,
          programVersionId: input.programVersionId,
          semesterNo: input.semesterNo,
          shiftId,
          active: true,
          pool: { categoryType, active: true },
        },
        include: { pool: { select: { id: true, poolName: true } } },
      });

    await this.prisma.$transaction(async (tx) => {
      for (const row of conflictingAssignments) {
        if (row.poolId === input.poolId) continue;
        await tx.programmePoolAssignment.update({
          where: { id: row.id },
          data: { active: false },
        });
      }

      const existing = await tx.programmePoolAssignment.findFirst({
        where: {
          tenantId,
          programVersionId: input.programVersionId,
          semesterNo: input.semesterNo,
          poolId: input.poolId,
          shiftId,
        },
      });

      if (existing) {
        await tx.programmePoolAssignment.update({
          where: { id: existing.id },
          data: { active: true },
        });
      } else {
        await tx.programmePoolAssignment.create({
          data: {
            tenantId,
            programVersionId: input.programVersionId,
            semesterNo: input.semesterNo,
            poolId: input.poolId,
            shiftId,
            active: true,
          },
        });
      }
    });

    return this.getCurriculumManagerView(tenantId, shiftId, {
      programVersionId: input.programVersionId,
      semesterNo: input.semesterNo,
    });
  }
}
