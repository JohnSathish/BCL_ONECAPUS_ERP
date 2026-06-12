import { BadRequestException, Injectable } from '@nestjs/common';
import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import type {
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ImportValidateOptions,
  ParsedImportRow,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import { isNepCategory } from '../domain/nep-categories';
import { AcademicEngineService } from '../academic-engine.service';
import { AdminRegistrationService } from '../services/admin-registration.service';
import { CurriculumResolutionService } from '../services/curriculum-resolution.service';
import { AcademicLifecycleService } from '../../academic-lifecycle/academic-lifecycle.service';
import {
  isWideRegistrationFormat,
  unpivotWideRowsToParsedImportRows,
} from './wide-registration-import.handler';

export type RegistrationImportOptions = {
  semesterId: string;
  semesterSequence: number;
  submitAfterImport?: boolean;
  freezeAfterImport?: boolean;
};

export type NormalizedRegistrationImportRow = {
  studentId: string;
  enrollmentNumber: string;
  semesterSequence: number;
  semesterId: string;
  category: string;
  courseCode: string;
  majorPaperIndex?: number;
  offeringId: string;
  offeringSectionId: string;
  slotKey: string;
};

type StudentRecord = {
  id: string;
  enrollmentNumber: string;
  programVersionId: string | null;
  primaryShiftId: string | null;
  academicProfile: {
    preferredShiftId: string | null;
    streamId: string | null;
    admissionBatch: { institutionId: string } | null;
  } | null;
  academicStanding: {
    currentSemesterSequence: number;
    registrationLocked: boolean;
  } | null;
};

type OfferingRecord = {
  id: string;
  category: string | null;
  majorPaperIndex: number | null;
  semesterSequence: number | null;
  programVersionId: string | null;
  course: { code: string };
  sections: {
    id: string;
    sectionCode: string;
    shiftId: string;
  }[];
};

@Injectable()
export class RegistrationImportHandler implements ImportModuleHandler<NormalizedRegistrationImportRow> {
  readonly module = 'REGISTRATION_IMPORT' as const;

  readonly columnDefs = [
    {
      key: 'registrationNumber',
      header: 'Registration Number',
      required: true,
    },
    { key: 'category', header: 'Category', required: true },
    { key: 'courseCode', header: 'Course Code', required: true },
    { key: 'sectionCode', header: 'Section Code', required: false },
    { key: 'majorPaperIndex', header: 'Major Paper Index', required: false },
  ];

  readonly nepForbiddenHeaders: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AcademicEngineService,
    private readonly adminRegistration: AdminRegistrationService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly lifecycle: AcademicLifecycleService,
  ) {}

  private parseOptions(
    options?: ImportValidateOptions,
  ): RegistrationImportOptions {
    const semesterId = String(options?.semesterId ?? '').trim();
    const semesterSequence = Number(options?.semesterSequence);
    if (
      !semesterId ||
      !Number.isFinite(semesterSequence) ||
      semesterSequence < 1
    ) {
      throw new BadRequestException(
        'semesterId and semesterSequence are required for registration import',
      );
    }
    return {
      semesterId,
      semesterSequence,
      submitAfterImport: options?.submitAfterImport === true,
      freezeAfterImport: options?.freezeAfterImport === true,
    };
  }

  async parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
    options?: ImportValidateOptions,
  ): Promise<ImportRowValidationResult[]> {
    const wideFormat =
      rows.length > 0 && isWideRegistrationFormat({ sampleRaw: rows[0].raw });
    const inputRows = wideFormat
      ? unpivotWideRowsToParsedImportRows(rows)
      : rows;
    const ctx = this.parseOptions(options);

    if (!wideFormat) {
      const calendarSem = await this.prisma.semester.findFirst({
        where: { id: ctx.semesterId, tenantId, deletedAt: null },
      });
      if (!calendarSem) {
        throw new BadRequestException('Calendar semester not found');
      }
      if (calendarSem.semesterNumber !== ctx.semesterSequence) {
        throw new BadRequestException(
          'semesterSequence does not match the selected calendar semester',
        );
      }
    }

    const semesterSequences = wideFormat
      ? [
          ...new Set(
            inputRows
              .map((r) => Number(r.raw.semesterSequence))
              .filter((seq) => Number.isFinite(seq) && seq >= 1),
          ),
        ]
      : [ctx.semesterSequence];

    const enrollmentNumbers = [
      ...new Set(
        inputRows
          .map((r) =>
            String(r.raw.registrationNumber ?? r.raw.enrollmentNumber ?? '')
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      ),
    ];

    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        enrollmentNumber: { in: enrollmentNumbers, mode: 'insensitive' },
      },
      include: {
        academicProfile: {
          select: {
            preferredShiftId: true,
            streamId: true,
            admissionBatch: { select: { institutionId: true } },
          },
        },
        academicStanding: {
          select: {
            currentSemesterSequence: true,
            registrationLocked: true,
          },
        },
      },
    });

    const studentByReg = new Map<string, StudentRecord>();
    for (const s of students) {
      studentByReg.set(s.enrollmentNumber.trim().toUpperCase(), s);
    }

    const programVersionIds = [
      ...new Set(
        students
          .map((s) => s.programVersionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const offeringByKey = new Map<string, OfferingRecord>();
    for (const semesterSequence of semesterSequences) {
      const offerings = await this.prisma.courseOffering.findMany({
        where: {
          tenantId,
          deletedAt: null,
          semesterSequence,
          mappingSource: 'DIRECT',
          programVersionId: {
            in: programVersionIds.length ? programVersionIds : [''],
          },
        },
        include: {
          course: { select: { code: true } },
          sections: {
            where: { deletedAt: null, status: 'active' },
            select: { id: true, sectionCode: true, shiftId: true },
          },
        },
      });

      for (const o of offerings) {
        const code = o.course.code.trim().toUpperCase();
        const cat = (o.category ?? '').toUpperCase();
        const mpi = o.majorPaperIndex ?? '';
        if (!o.programVersionId) continue;
        offeringByKey.set(
          `${semesterSequence}:${o.programVersionId}:${code}:${cat}:${mpi}`,
          o,
        );
      }

      for (const programVersionId of programVersionIds) {
        const resolved = await this.curriculum.resolveProgrammeCurriculum(
          tenantId,
          programVersionId,
          semesterSequence,
        );
        for (const row of resolved.inheritedPoolOfferings) {
          const o = row.offering;
          const code = o.course.code.trim().toUpperCase();
          const cat = (o.category ?? '').toUpperCase();
          const mpi = o.majorPaperIndex ?? '';
          offeringByKey.set(
            `${semesterSequence}:${programVersionId}:${code}:${cat}:${mpi}`,
            {
              ...o,
              programVersionId: null,
            },
          );
        }
      }
    }

    const structureRules = await this.prisma.semesterStructureRule.findMany({
      where: {
        programVersionId: {
          in: programVersionIds.length ? programVersionIds : [''],
        },
        semesterSequence: { in: semesterSequences },
      },
    });
    const ruleByProgramSem = new Map(
      structureRules.map((r) => [
        `${r.programVersionId}:${r.semesterSequence}`,
        r.categoryCounts as Record<string, number>,
      ]),
    );

    const calendarSemesterBySequence = new Map<number, string>();
    if (wideFormat) {
      const institutionIds = [
        ...new Set(
          students
            .map((s) => s.academicProfile?.admissionBatch?.institutionId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      for (const semesterSequence of semesterSequences) {
        let calendarSemId: string | undefined;
        for (const institutionId of institutionIds) {
          const operational = await this.lifecycle.resolveOperationalSemester(
            tenantId,
            institutionId,
            semesterSequence,
          );
          if (operational) {
            calendarSemId = operational.id;
            break;
          }
        }
        if (!calendarSemId) {
          const fallback = await this.prisma.semester.findFirst({
            where: {
              tenantId,
              semesterNumber: semesterSequence,
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
          });
          calendarSemId = fallback?.id;
        }
        if (calendarSemId) {
          calendarSemesterBySequence.set(semesterSequence, calendarSemId);
        }
      }
    } else {
      calendarSemesterBySequence.set(ctx.semesterSequence, ctx.semesterId);
    }

    const fileSlotKeys = new Set<string>();
    const rowResults: ImportRowValidationResult[] = inputRows.map((row) => {
      const rowSemesterSequence = wideFormat
        ? Number(row.raw.semesterSequence)
        : ctx.semesterSequence;
      return this.validateRow(row, {
        ctx,
        wideFormat,
        rowSemesterSequence,
        calendarSemesterBySequence,
        studentByReg,
        offeringByKey,
        fileSlotKeys,
      });
    });

    const linesByStudentSem = new Map<
      string,
      NormalizedRegistrationImportRow[]
    >();
    for (const result of rowResults) {
      if (result.status !== 'VALID' || !result.normalized) continue;
      const n = result.normalized as NormalizedRegistrationImportRow;
      const key = `${n.studentId}:${n.semesterSequence}`;
      const list = linesByStudentSem.get(key) ?? [];
      list.push(n);
      linesByStudentSem.set(key, list);
    }

    for (const [key, lines] of linesByStudentSem) {
      const [studentId, semStr] = key.split(':');
      const semesterSequence = Number(semStr);
      const student = students.find((s) => s.id === studentId);
      if (!student?.programVersionId) continue;
      const expected = ruleByProgramSem.get(
        `${student.programVersionId}:${semesterSequence}`,
      );
      if (!expected) {
        this.appendStudentSemesterError(
          rowResults,
          studentId,
          semesterSequence,
          'No semester structure rule for student programme',
        );
        continue;
      }

      const counts: Record<string, number> = {};
      for (const line of lines) {
        counts[line.category] = (counts[line.category] ?? 0) + 1;
      }

      for (const [cat, expectedCount] of Object.entries(expected)) {
        const actual = counts[cat] ?? 0;
        if (actual !== expectedCount) {
          this.appendStudentSemesterError(
            rowResults,
            studentId,
            semesterSequence,
            `Category ${cat}: expected ${expectedCount}, found ${actual}`,
          );
        }
      }

      for (const cat of Object.keys(counts)) {
        if (!(cat in expected)) {
          this.appendStudentSemesterError(
            rowResults,
            studentId,
            semesterSequence,
            `Unexpected category ${cat} for this semester`,
          );
        }
      }
    }

    return rowResults;
  }

  private appendStudentSemesterError(
    results: ImportRowValidationResult[],
    studentId: string,
    semesterSequence: number,
    message: string,
  ) {
    for (const result of results) {
      const n = result.normalized as
        | NormalizedRegistrationImportRow
        | undefined;
      if (
        n?.studentId !== studentId ||
        n.semesterSequence !== semesterSequence
      ) {
        continue;
      }
      if (!result.errors.includes(message)) {
        result.errors.push(message);
      }
      result.status = 'INVALID';
      result.normalized = undefined;
    }
  }

  private validateRow(
    row: ParsedImportRow,
    ctx: {
      ctx: RegistrationImportOptions;
      wideFormat: boolean;
      rowSemesterSequence: number;
      calendarSemesterBySequence: Map<number, string>;
      studentByReg: Map<string, StudentRecord>;
      offeringByKey: Map<string, OfferingRecord>;
      fileSlotKeys: Set<string>;
    },
  ): ImportRowValidationResult {
    const errors: string[] = [];
    const raw = row.raw;

    const enrollmentNumber = String(
      raw.registrationNumber ?? raw.enrollmentNumber ?? '',
    ).trim();
    const categoryRaw = String(raw.category ?? '')
      .trim()
      .toUpperCase();
    const courseCode = String(raw.courseCode ?? raw.code ?? '')
      .trim()
      .toUpperCase();
    const sectionCode =
      String(raw.sectionCode ?? '')
        .trim()
        .toUpperCase() || 'A';
    const majorPaperRaw = raw.majorPaperIndex;
    const majorPaperIndex =
      majorPaperRaw === '' || majorPaperRaw == null
        ? undefined
        : Number(majorPaperRaw);
    const semesterSequence = ctx.rowSemesterSequence;
    const semesterId = ctx.calendarSemesterBySequence.get(semesterSequence);

    if (!enrollmentNumber) errors.push('Registration number is required');
    if (ctx.wideFormat) {
      if (!Number.isFinite(semesterSequence) || semesterSequence < 1) {
        errors.push('Valid semester is required');
      } else if (!semesterId) {
        errors.push(
          `No active calendar semester found for programme semester ${semesterSequence}`,
        );
      }
    }
    if (!categoryRaw) errors.push('Category is required');
    else if (!isNepCategory(categoryRaw)) {
      errors.push(`Invalid NEP category: ${categoryRaw}`);
    }
    if (!courseCode) errors.push('Course code is required');

    if (
      categoryRaw === 'MAJOR' &&
      semesterSequence > 1 &&
      (majorPaperIndex == null || !Number.isFinite(majorPaperIndex))
    ) {
      errors.push(
        'Major paper index (1 or 2) is required for MAJOR in this semester',
      );
    }

    const student = enrollmentNumber
      ? ctx.studentByReg.get(enrollmentNumber.toUpperCase())
      : undefined;
    if (enrollmentNumber && !student) {
      errors.push(`Student not found: ${enrollmentNumber}`);
    }

    if (student) {
      if (!student.programVersionId) {
        errors.push('Student has no programme assigned');
      }
      if (student.academicStanding?.registrationLocked) {
        errors.push('Registration is locked for this student');
      }
      if (
        student.academicStanding &&
        student.academicStanding.currentSemesterSequence !== semesterSequence
      ) {
        errors.push(
          `Student standing is semester ${student.academicStanding.currentSemesterSequence}, not ${semesterSequence}`,
        );
      }
    }

    let offering: OfferingRecord | undefined;
    let offeringSectionId: string | undefined;

    if (
      student?.programVersionId &&
      courseCode &&
      categoryRaw &&
      isNepCategory(categoryRaw)
    ) {
      const mpiKey =
        categoryRaw === 'MAJOR' && majorPaperIndex != null
          ? majorPaperIndex
          : '';
      const key = `${semesterSequence}:${student.programVersionId}:${courseCode}:${categoryRaw}:${mpiKey}`;
      offering = ctx.offeringByKey.get(key);
      if (!offering) {
        errors.push(
          `No curriculum mapping for ${courseCode} as ${categoryRaw} in semester ${semesterSequence}`,
        );
      } else if (offering.category?.toUpperCase() !== categoryRaw) {
        errors.push(
          `Course ${courseCode} is not mapped to category ${categoryRaw}`,
        );
      } else {
        const shiftId =
          student.primaryShiftId ?? student.academicProfile?.preferredShiftId;
        const matching = offering.sections.filter((s) => {
          if (s.sectionCode.toUpperCase() !== sectionCode) return false;
          if (shiftId) return s.shiftId === shiftId;
          return true;
        });
        const section =
          matching[0] ??
          offering.sections.find(
            (s) => s.sectionCode.toUpperCase() === sectionCode,
          ) ??
          (shiftId
            ? offering.sections.find((s) => s.shiftId === shiftId)
            : undefined) ??
          offering.sections[0];

        if (!section) {
          errors.push(
            `No section ${sectionCode} found for ${courseCode} on student shift`,
          );
        } else {
          offeringSectionId = section.id;
        }
      }
    }

    const slotKey =
      student && categoryRaw
        ? `${student.id}:${semesterSequence}:${categoryRaw}:${majorPaperIndex ?? ''}`
        : '';
    if (slotKey) {
      if (ctx.fileSlotKeys.has(slotKey)) {
        errors.push(`Duplicate category slot for this student in file`);
      } else {
        ctx.fileSlotKeys.add(slotKey);
      }
    }

    const normalized: NormalizedRegistrationImportRow | undefined =
      errors.length === 0 &&
      student &&
      offering &&
      offeringSectionId &&
      semesterId
        ? {
            studentId: student.id,
            enrollmentNumber: student.enrollmentNumber,
            semesterSequence,
            semesterId,
            category: categoryRaw,
            courseCode,
            majorPaperIndex:
              majorPaperIndex != null && Number.isFinite(majorPaperIndex)
                ? majorPaperIndex
                : undefined,
            offeringId: offering.id,
            offeringSectionId,
            slotKey,
          }
        : undefined;

    return {
      rowNumber: row.rowNumber,
      status: errors.length ? 'INVALID' : 'VALID',
      raw,
      normalized,
      errors,
      displayCode: enrollmentNumber || undefined,
      displayTitle: courseCode
        ? `Sem ${semesterSequence} ${categoryRaw} — ${courseCode}`
        : categoryRaw || undefined,
    };
  }

  async commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: NormalizedRegistrationImportRow }[],
  ) {
    const options = this.parseOptions(ctx.options);
    const byStudentSem = new Map<string, NormalizedRegistrationImportRow[]>();

    for (const row of rows) {
      const key = `${row.normalized.studentId}:${row.normalized.semesterSequence}`;
      const list = byStudentSem.get(key) ?? [];
      list.push(row.normalized);
      byStudentSem.set(key, list);
    }

    const regIdByStudentSem = new Map<string, string>();
    const studentIds = new Set<string>();

    for (const [key, lines] of byStudentSem) {
      const [studentId] = key.split(':');
      studentIds.add(studentId);
      const semesterId = lines[0]?.semesterId ?? options.semesterId;
      const semesterSequence =
        lines[0]?.semesterSequence ?? options.semesterSequence;

      let registration = await this.prisma.semesterRegistration.findFirst({
        where: {
          tenantId: ctx.tenantId,
          studentId,
          semesterId,
        },
      });

      if (registration && registration.status !== 'draft') {
        throw new BadRequestException(
          `Student ${lines[0]?.enrollmentNumber} already has a submitted registration for semester ${semesterSequence}`,
        );
      }

      if (!registration) {
        registration = await this.engine.createRegistration(
          ctx.tenantId,
          studentId,
          {
            semesterId,
            semesterSequence,
          },
        );
      }

      const registrationLines = lines.map((l) => ({
        category: l.category,
        offeringId: l.offeringId,
        offeringSectionId: l.offeringSectionId,
        registrationSource: 'IMPORTED',
      }));

      await this.engine.updateRegistrationLines(
        ctx.tenantId,
        registration.id,
        registrationLines,
        { registrationSource: 'IMPORTED', assignedById: ctx.userId },
      );

      const validation = await this.engine.validateRegistration(
        ctx.tenantId,
        registration.id,
      );
      if (!validation.ok) {
        const msgs = validation.issues.map((i) => i.message).join('; ');
        throw new BadRequestException(
          `Validation failed for ${lines[0]?.enrollmentNumber}: ${msgs}`,
        );
      }

      if (options.submitAfterImport) {
        await this.engine.submitRegistration(
          ctx.tenantId,
          registration.id,
          ctx.userId,
        );
      }

      regIdByStudentSem.set(key, registration.id);
    }

    if (options.freezeAfterImport && studentIds.size > 0) {
      await this.adminRegistration.setRegistrationFrozen(ctx.tenantId, true, {
        studentIds: [...studentIds],
      });
    }

    return rows.map((row) => {
      const key = `${row.normalized.studentId}:${row.normalized.semesterSequence}`;
      return {
        rowNumber: row.rowNumber,
        entityId: regIdByStudentSem.get(key) ?? row.normalized.studentId,
      };
    });
  }

  async buildTemplateWorkbook(): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Registrations',
        headers: this.columnDefs.map((c) => c.header),
        rows: [
          ['REG2026001', 'MAJOR', 'BCA-M101', 'A', ''],
          ['REG2026001', 'MINOR', 'MAT-M101', 'A', ''],
          ['REG2026001', 'MDC', 'MDC101', 'A', ''],
          ['REG2026001', 'AEC', 'AEC-ENG', 'A', ''],
          ['REG2026001', 'SEC', 'SEC-PY', 'A', ''],
          ['REG2026001', 'VAC', 'VAC-ENV', 'A', ''],
          ['REG2024001', 'MAJOR', 'BCA-M501', 'A', '1'],
          ['REG2024001', 'MAJOR', 'BCA-M502', 'A', '2'],
          ['REG2024001', 'MDC', 'MDC501', 'A', ''],
          ['REG2024001', 'AEC', 'AEC-ENG3', 'A', ''],
          ['REG2024001', 'SEC', 'SEC-501', 'A', ''],
          ['REG2024001', 'VTC', 'INT501', 'A', ''],
        ],
        notes: [
          'One row per student per NEP category.',
          'Select semester on upload — do not add semester columns.',
          'Major Paper Index: required for MAJOR in semesters 3 and 5 (use 1 and 2).',
          'Internship courses: use VTC category with the internship course code.',
        ],
      },
      {
        name: 'Instructions',
        headers: ['Column', 'Description'],
        rows: this.columnDefs.map((c) => [
          `${c.header}${c.required ? ' (required)' : ''}`,
          c.key,
        ]),
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
        headers: ['Row', 'Registration', 'Selection', 'Errors'],
        rows: failed.map((r) => [
          r.rowNumber,
          r.displayCode ?? '',
          r.displayTitle ?? '',
          r.errors.join('; '),
        ]),
      },
    ]);
  }
}
