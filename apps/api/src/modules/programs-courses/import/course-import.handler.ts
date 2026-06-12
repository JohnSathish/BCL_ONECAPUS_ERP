import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CBCS_COURSE_TYPES,
  isNepCurriculumCategory,
  NEP_CATEGORY_ON_MASTER_MESSAGE,
} from '../../../common/constants/academic-categories';
import {
  COURSE_DELIVERY_TYPES,
  formatDeliveryTypeLabel,
  getDeliveryProfile,
  isManualCreditDelivery,
  normalizeCourseDeliveryInput,
  resolveDeliveryType,
  type CourseDeliveryType,
} from '../../../common/constants/course-delivery';
import {
  createWorkbookWithSheets,
  DATA_SHEET_NAME,
  INSTRUCTIONS_SHEET_NAME,
} from '../../../common/import/excel.util';
import { NEP_FORBIDDEN_HEADER_KEYS } from '../../../common/import/import-column-map';
import type {
  ImportColumnDef,
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ParsedImportRow,
  ImportValidateOptions,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import { isAcademicDepartment } from '../../organization/department-rules';
import {
  computeTotalContactHours,
  validateCourseAcademicStructure,
} from '../../../common/services/course-academic-structure.validator';
import { resolveVtcTrackFields } from '../../../common/services/vtc-track-metadata';
export type NormalizedCourseImportRow = {
  code: string;
  title: string;
  deliveryType: CourseDeliveryType;
  creditCalculationMode: string;
  requiresTheorySplit: boolean;
  requiresPracticalSplit: boolean;
  theoryCredits: number;
  practicalCredits: number;
  theoryHoursPerWeek: number;
  practicalHoursPerWeek: number;
  totalTheoryContactHours: number;
  totalPracticalContactHours: number;
  totalContactHours: number;
  courseType: string;
  departmentId: string;
  description?: string;
  credits: number;
  hasPractical: boolean;
};

@Injectable()
export class CourseImportHandler implements ImportModuleHandler<NormalizedCourseImportRow> {
  readonly module = 'COURSE_MASTER' as const;

  readonly columnDefs: ImportColumnDef[] = [
    { key: 'courseCode', header: 'Course Code', required: true },
    { key: 'courseTitle', header: 'Course Title', required: true },
    { key: 'deliveryType', header: 'Delivery Type', required: true },
    { key: 'totalCredits', header: 'Total Credits', required: false },
    { key: 'theoryCredits', header: 'Theory Credits', required: false },
    { key: 'practicalCredits', header: 'Practical Credits', required: false },
    {
      key: 'theoryHoursPerWeek',
      header: 'Weekly Theory Hours',
      required: false,
    },
    {
      key: 'practicalHoursPerWeek',
      header: 'Weekly Practical Hours',
      required: false,
    },
    {
      key: 'totalTheoryContactHours',
      header: 'Total Theory Contact Hours',
      required: false,
    },
    {
      key: 'totalPracticalContactHours',
      header: 'Total Practical Contact Hours',
      required: false,
    },
    {
      key: 'totalContactHours',
      header: 'Total Contact Hours',
      required: false,
    },
    { key: 'courseType', header: 'CBCS Catalog Type', required: true },
    { key: 'departmentCode', header: 'Department Code', required: true },
    { key: 'description', header: 'Description', required: false },
  ];

  readonly nepForbiddenHeaders = [...NEP_FORBIDDEN_HEADER_KEYS];

  constructor(private readonly prisma: PrismaService) {}

  async parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
    _options?: ImportValidateOptions,
  ): Promise<ImportRowValidationResult[]> {
    const [departments, existingCourses, settings] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, departmentType: true },
      }),
      this.prisma.course.findMany({
        where: { tenantId, deletedAt: null },
        select: { code: true },
      }),
      this.prisma.tenantAcademicSettings.findUnique({
        where: { tenantId },
      }),
    ]);

    const deptByCode = new Map(
      departments
        .filter((d) => isAcademicDepartment(d.departmentType))
        .map((d) => [d.code.trim().toUpperCase(), d.id]),
    );
    const adminDeptCodes = new Set(
      departments
        .filter((d) => !isAcademicDepartment(d.departmentType))
        .map((d) => d.code.trim().toUpperCase()),
    );
    const existingCodes = new Set(
      existingCourses.map((c) => c.code.trim().toUpperCase()),
    );
    const fileCodes = new Set<string>();
    const allowFractional =
      (settings?.creditPolicy as { allowFractionalCredits?: boolean } | null)
        ?.allowFractionalCredits !== false;

    return rows.map((row) =>
      this.validateRow(row, {
        deptByCode,
        adminDeptCodes,
        existingCodes,
        fileCodes,
        allowFractional,
      }),
    );
  }

  private validateRow(
    row: ParsedImportRow,
    ctx: {
      deptByCode: Map<string, string>;
      adminDeptCodes: Set<string>;
      existingCodes: Set<string>;
      fileCodes: Set<string>;
      allowFractional: boolean;
    },
  ): ImportRowValidationResult {
    const errors: string[] = [];
    const raw = row.raw;

    for (const key of Object.keys(raw)) {
      if (NEP_FORBIDDEN_HEADER_KEYS.has(key.toLowerCase())) {
        errors.push(
          `Column "${key}" belongs on Curriculum Mapping, not Course Master. ${NEP_CATEGORY_ON_MASTER_MESSAGE}`,
        );
      }
    }

    const codeRaw = str(raw.courseCode);
    const title = str(raw.courseTitle);
    const deliveryRaw = str(raw.deliveryType)
      .toUpperCase()
      .replace(/\s+/g, '_');
    const deptCode = str(raw.departmentCode).toUpperCase();
    const courseTypeRaw = str(raw.courseType).toUpperCase();

    if (!codeRaw) errors.push('Course code is required');
    if (!title) errors.push('Course title is required');
    if (!deliveryRaw) errors.push('Delivery type is required');
    if (!deptCode) errors.push('Department code is required');
    if (!courseTypeRaw) errors.push('CBCS catalog type is required');

    if (isNepCurriculumCategory(courseTypeRaw)) {
      errors.push(NEP_CATEGORY_ON_MASTER_MESSAGE);
    } else if (
      !(CBCS_COURSE_TYPES as readonly string[]).includes(courseTypeRaw)
    ) {
      errors.push(
        `Invalid CBCS catalog type. Allowed: ${CBCS_COURSE_TYPES.join(', ')}`,
      );
    }

    const code = codeRaw.trim().toUpperCase();
    if (code) {
      if (ctx.existingCodes.has(code)) {
        errors.push('Duplicate course code — already exists in catalog');
      }
      if (ctx.fileCodes.has(code)) {
        errors.push('Duplicate course code within uploaded file');
      } else {
        ctx.fileCodes.add(code);
      }
    }

    const deliveryType = resolveDeliveryType(deliveryRaw);
    if (deliveryRaw && !deliveryType) {
      errors.push(
        `Invalid delivery type. Allowed: ${COURSE_DELIVERY_TYPES.join(', ')} (aliases: FIELDWORK, MIXED, COMMUNITY ENGAGEMENT)`,
      );
    }

    const isManual = deliveryType
      ? isManualCreditDelivery(deliveryType)
      : false;
    const theoryCredits = num(raw.theoryCredits) ?? 0;
    const practicalCredits = num(raw.practicalCredits) ?? 0;
    const theoryHours = intNum(raw.theoryHoursPerWeek) ?? 0;
    const practicalHours = intNum(raw.practicalHoursPerWeek) ?? 0;
    const theoryContact = intNum(raw.totalTheoryContactHours) ?? 0;
    const practicalContact = intNum(raw.totalPracticalContactHours) ?? 0;
    const totalCreditsInput = num(raw.totalCredits) ?? num(raw.credits);
    const totalContactInput = intNum(raw.totalContactHours);

    if (isManual) {
      if (totalCreditsInput == null || totalCreditsInput <= 0) {
        errors.push(
          'Total credits is required for experiential delivery types',
        );
      }
      if (totalContactInput == null || totalContactInput <= 0) {
        errors.push(
          'Total contact hours is required for experiential delivery types',
        );
      }
    } else {
      if (raw.theoryCredits === '' || raw.theoryCredits == null) {
        errors.push('Theory credits is required');
      } else if (theoryCredits < 0) {
        errors.push('Theory credits must be a non-negative number');
      }

      if (raw.practicalCredits === '' || raw.practicalCredits == null) {
        errors.push('Practical credits is required');
      } else if (practicalCredits < 0) {
        errors.push('Practical credits must be a non-negative number');
      }

      if (raw.theoryHoursPerWeek === '' || raw.theoryHoursPerWeek == null) {
        errors.push('Weekly theory hours is required');
      } else if (intNum(raw.theoryHoursPerWeek) == null) {
        errors.push('Weekly theory hours must be a non-negative integer');
      }

      if (
        raw.practicalHoursPerWeek === '' ||
        raw.practicalHoursPerWeek == null
      ) {
        errors.push('Weekly practical hours is required');
      } else if (intNum(raw.practicalHoursPerWeek) == null) {
        errors.push('Weekly practical hours must be a non-negative integer');
      }

      if (
        raw.totalTheoryContactHours === '' ||
        raw.totalTheoryContactHours == null
      ) {
        errors.push('Total theory contact hours is required');
      } else if (theoryContact < 0) {
        errors.push(
          'Total theory contact hours must be a non-negative integer',
        );
      }

      if (
        raw.totalPracticalContactHours === '' ||
        raw.totalPracticalContactHours == null
      ) {
        errors.push('Total practical contact hours is required');
      } else if (practicalContact < 0) {
        errors.push(
          'Total practical contact hours must be a non-negative integer',
        );
      }
    }

    if (!ctx.allowFractional) {
      if (theoryCredits != null && !Number.isInteger(theoryCredits)) {
        errors.push('Theory credits must be a whole number');
      }
      if (practicalCredits != null && !Number.isInteger(practicalCredits)) {
        errors.push('Practical credits must be a whole number');
      }
      if (totalCreditsInput != null && !Number.isInteger(totalCreditsInput)) {
        errors.push('Total credits must be a whole number');
      }
    }

    let departmentId: string | undefined;
    if (deptCode) {
      if (ctx.adminDeptCodes.has(deptCode)) {
        errors.push(
          `Department ${deptCode} is administrative; courses require an academic department`,
        );
      } else {
        departmentId = ctx.deptByCode.get(deptCode);
        if (!departmentId) {
          errors.push(`Invalid department code: ${deptCode}`);
        }
      }
    }

    let normalized: NormalizedCourseImportRow | undefined;
    if (errors.length === 0 && deliveryType && departmentId) {
      const profile = getDeliveryProfile(deliveryType);
      const delivery = normalizeCourseDeliveryInput({
        deliveryType,
        creditCalculationMode: profile.creditCalculationMode,
        theoryCredits,
        practicalCredits,
        theoryHoursPerWeek: theoryHours,
        practicalHoursPerWeek: practicalHours,
        credits: isManual ? (totalCreditsInput ?? 0) : undefined,
        totalContactHours: isManual ? (totalContactInput ?? 0) : undefined,
        totalTheoryContactHours: theoryContact,
        totalPracticalContactHours: practicalContact,
      });

      const totalContactHours = isManual
        ? (totalContactInput ?? delivery.totalContactHours)
        : computeTotalContactHours(
            delivery.totalTheoryContactHours,
            delivery.totalPracticalContactHours,
          );

      try {
        validateCourseAcademicStructure({
          deliveryType,
          creditCalculationMode: delivery.creditCalculationMode,
          credits: delivery.credits,
          theoryCredits: delivery.theoryCredits,
          practicalCredits: delivery.practicalCredits,
          theoryHoursPerWeek: delivery.theoryHoursPerWeek,
          practicalHoursPerWeek: delivery.practicalHoursPerWeek,
          totalTheoryContactHours: delivery.totalTheoryContactHours,
          totalPracticalContactHours: delivery.totalPracticalContactHours,
          totalContactHours,
        });
      } catch (e) {
        errors.push(
          e instanceof BadRequestException
            ? e.message
            : 'Invalid academic structure',
        );
      }

      if (errors.length === 0) {
        if (
          !isManual &&
          delivery.theoryCredits + delivery.practicalCredits <= 0
        ) {
          errors.push('Total credits must be greater than zero');
        } else {
          normalized = {
            code,
            title: title.trim(),
            deliveryType: delivery.deliveryType,
            creditCalculationMode: delivery.creditCalculationMode,
            requiresTheorySplit: delivery.requiresTheorySplit,
            requiresPracticalSplit: delivery.requiresPracticalSplit,
            theoryCredits: delivery.theoryCredits,
            practicalCredits: delivery.practicalCredits,
            theoryHoursPerWeek: delivery.theoryHoursPerWeek,
            practicalHoursPerWeek: delivery.practicalHoursPerWeek,
            totalTheoryContactHours: delivery.totalTheoryContactHours,
            totalPracticalContactHours: delivery.totalPracticalContactHours,
            totalContactHours,
            courseType: courseTypeRaw,
            departmentId,
            description: str(raw.description) || undefined,
            credits: delivery.credits,
            hasPractical: delivery.hasPractical,
          };
        }
      }
    }

    return {
      rowNumber: row.rowNumber,
      status: errors.length === 0 ? 'VALID' : 'INVALID',
      raw,
      normalized,
      errors,
      displayCode: code || codeRaw,
      displayTitle: title,
    };
  }

  async commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: NormalizedCourseImportRow }[],
  ): Promise<{ rowNumber: number; entityId: string }[]> {
    const results: { rowNumber: number; entityId: string }[] = [];
    for (const row of rows) {
      const n = row.normalized;
      const vtcFields = resolveVtcTrackFields({ code: n.code, title: n.title });
      const created = await this.prisma.course.create({
        data: {
          tenantId: ctx.tenantId,
          code: n.code,
          title: n.title,
          credits: n.credits,
          deliveryType: n.deliveryType,
          creditCalculationMode: n.creditCalculationMode,
          requiresTheorySplit: n.requiresTheorySplit,
          requiresPracticalSplit: n.requiresPracticalSplit,
          hasPractical: n.hasPractical,
          theoryCredits: n.theoryCredits,
          practicalCredits: n.practicalCredits,
          theoryHoursPerWeek: n.theoryHoursPerWeek,
          practicalHoursPerWeek: n.practicalHoursPerWeek,
          totalTheoryContactHours: n.totalTheoryContactHours,
          totalPracticalContactHours: n.totalPracticalContactHours,
          totalContactHours: n.totalContactHours,
          courseType: n.courseType,
          departmentId: n.departmentId,
          description: n.description,
          vtcTrackGroupCode: vtcFields.vtcTrackGroupCode,
          vtcTrackStage: vtcFields.vtcTrackStage,
          status: 'ACTIVE',
        },
      });
      results.push({ rowNumber: row.rowNumber, entityId: created.id });
    }
    return results;
  }

  async buildTemplateWorkbook(): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: INSTRUCTIONS_SHEET_NAME,
        headers: [],
        notes: [
          'Course Master Import Template',
          'Do not add NEP columns (Major, MDC, AEC, etc.) — use Curriculum Mapping.',
          `Delivery types: ${COURSE_DELIVERY_TYPES.join(', ')} (FIELDWORK accepted as alias)`,
          `CBCS types: ${CBCS_COURSE_TYPES.join(', ')}`,
          'For theory/practical courses: total credits = theory + practical (computed).',
          'For INTERNSHIP, PROJECT, etc.: set Total Credits and Total Contact Hours; theory/practical may be 0.',
          'Contact hours are semester totals for university compliance.',
        ],
      },
      {
        name: DATA_SHEET_NAME,
        headers: this.columnDefs.map((c) => c.header),
        rows: [
          [
            'ECO-100',
            'Microeconomics I',
            'THEORY',
            4,
            4,
            0,
            4,
            0,
            60,
            0,
            60,
            'CORE',
            'ECO',
            'Arts FYUGP Sem 1 Major',
          ],
          [
            'MDC-111',
            'Culture and Society',
            'THEORY',
            3,
            3,
            0,
            3,
            0,
            45,
            0,
            45,
            'CORE',
            'ENG',
            'Arts FYUGP Sem 1 MDC pool',
          ],
          [
            'VAC-140',
            'Environmental Studies',
            'THEORY',
            3,
            3,
            0,
            3,
            0,
            45,
            0,
            45,
            'CORE',
            'ENG',
            'Arts FYUGP Sem 1 VAC',
          ],
          [
            'ECO-304',
            'Economics Internship',
            'INTERNSHIP',
            4,
            0,
            0,
            '',
            '',
            '',
            '',
            120,
            'SKILL',
            'ECO',
            'Arts FYUGP Sem 5 Internship',
          ],
          [
            'GEO-250',
            'Geography Theory',
            'THEORY',
            4,
            4,
            0,
            4,
            0,
            60,
            0,
            60,
            'CORE',
            'GEO',
            '',
          ],
          [
            'GEO-252',
            'Statistical Techniques in Geography',
            'PRACTICAL',
            4,
            0,
            4,
            0,
            6,
            0,
            120,
            120,
            'CORE',
            'GEO',
            '',
          ],
          [
            'SUB-303',
            'Internship',
            'INTERNSHIP',
            4,
            0,
            0,
            '',
            '',
            '',
            '',
            120,
            'CORE',
            'ENG',
            '',
          ],
          [
            'VTC-260',
            'VTC Mixed Skills',
            'THEORY_PRACTICAL',
            4,
            1,
            3,
            1,
            4,
            30,
            75,
            105,
            'SKILL',
            'ENG',
            '',
          ],
        ],
      },
    ]);
  }

  async buildErrorReportWorkbook(
    rows: ImportRowValidationResult[],
  ): Promise<Buffer> {
    const failed = rows.filter((r) => r.status === 'INVALID');
    return createWorkbookWithSheets([
      {
        name: 'Errors',
        headers: ['Row', 'Course Code', 'Course Title', 'Errors'],
        rows: failed.map((r) => [
          r.rowNumber,
          r.displayCode ?? '',
          r.displayTitle ?? '',
          r.errors.join('; '),
        ]),
      },
    ]);
  }

  async buildExportWorkbook(tenantId: string): Promise<Buffer> {
    const courses = await this.prisma.course.findMany({
      where: { tenantId, deletedAt: null },
      include: { department: { select: { code: true, name: true } } },
      orderBy: { code: 'asc' },
    });

    return createWorkbookWithSheets([
      {
        name: 'Courses',
        headers: [
          'Course Code',
          'Course Title',
          'Delivery Type',
          'Theory Credits',
          'Practical Credits',
          'Total Credits',
          'Weekly Theory Hours',
          'Weekly Practical Hours',
          'Total Theory Contact Hours',
          'Total Practical Contact Hours',
          'Total Contact Hours',
          'CBCS Catalog Type',
          'Department Code',
          'Department Name',
          'Description',
        ],
        rows: courses.map((c) => [
          c.code,
          c.title,
          formatDeliveryTypeLabel(c.deliveryType),
          decimalToNumber(c.theoryCredits),
          decimalToNumber(c.practicalCredits),
          decimalToNumber(c.credits),
          c.theoryHoursPerWeek,
          c.practicalHoursPerWeek,
          c.totalTheoryContactHours,
          c.totalPracticalContactHours,
          c.totalContactHours,
          c.courseType,
          c.department?.code ?? '',
          c.department?.name ?? '',
          c.description ?? '',
        ]),
      },
    ]);
  }
}

function decimalToNumber(value: { toString(): string } | number): number {
  return Number(value);
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intNum(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  return Math.floor(n) === n ? n : null;
}
