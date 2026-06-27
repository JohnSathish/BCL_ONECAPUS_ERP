import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { JwtUser } from '../../../common/decorators/current-user.decorator';
import { parseFlexibleDate } from '../../../common/utils/parse-flexible-date';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { StudentsService } from '../students.service';
import { StudentProfileSectionsService } from '../services/student-profile-sections.service';
import {
  BULK_UPDATE_FIELD_MAP,
  getBulkUpdateFieldsGrouped,
  serializeFieldValue,
} from './bulk-update-fields';
import type { BulkUpdatePreviewDto } from './dto/bulk-update.dto';
import { StudentBulkSectionWriterService } from './student-bulk-section-writer.service';
import { toStudentListQuery } from '../dto/students.dto';

const MAX_STUDENTS = 5000;
const ASYNC_THRESHOLD = 200;

@Injectable()
export class StudentBulkUpdateService {
  private readonly logger = new Logger(StudentBulkUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly sections: StudentProfileSectionsService,
    private readonly sectionWriter: StudentBulkSectionWriterService,
    private readonly academicEngine: AcademicEngineService,
  ) {}

  getFields() {
    return getBulkUpdateFieldsGrouped();
  }

  async listBatches(tenantId: string, limit = 20) {
    return this.prisma.studentBulkUpdateBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, email: true } },
        _count: { select: { changes: true } },
      },
    });
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.prisma.studentBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        actor: { select: { id: true, email: true } },
        changes: {
          take: 500,
          orderBy: { fieldKey: 'asc' },
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                enrollmentNumber: true,
                masterProfile: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Bulk update batch not found');
    return batch;
  }

  async resolveStudentIds(
    user: JwtUser,
    scope: BulkUpdatePreviewDto['scope'],
    options?: Pick<BulkUpdatePreviewDto, 'updateMode' | 'csvRows'>,
  ) {
    if (options?.updateMode === 'CSV' && options.csvRows?.length) {
      return this.resolveCsvStudentIds(user.tid, options.csvRows);
    }
    if (scope.studentIds?.length) {
      if (scope.studentIds.length > MAX_STUDENTS) {
        throw new BadRequestException(
          `Maximum ${MAX_STUDENTS} students per batch`,
        );
      }
      return scope.studentIds;
    }
    if (!scope.filter) {
      throw new BadRequestException('Provide studentIds or filter scope');
    }
    const query = toStudentListQuery(scope.filter);
    const result = await this.students.list(user, {
      ...query,
      page: 1,
      limit: MAX_STUDENTS,
    });
    const ids = result.data.map((s) => s.id);
    if (ids.length >= MAX_STUDENTS) {
      throw new BadRequestException(
        `Scope exceeds ${MAX_STUDENTS} students — narrow filters`,
      );
    }
    return ids;
  }

  async preview(user: JwtUser, dto: BulkUpdatePreviewDto, ipAddress?: string) {
    this.validateFieldKeys(dto.fieldKeys);
    const studentIds = await this.resolveStudentIds(user, dto.scope, {
      updateMode: dto.updateMode,
      csvRows: dto.csvRows,
    });
    if (studentIds.length === 0) {
      throw new BadRequestException('No students matched the scope');
    }

    const rows: Array<{
      studentId: string;
      fullName: string;
      rollNumber: string | null;
      enrollmentNumber: string;
      changes: {
        fieldKey: string;
        label: string;
        before: unknown;
        after: unknown;
      }[];
      errors: string[];
    }> = [];

    let valid = 0;
    let invalid = 0;
    const changeRecords: Prisma.StudentBulkUpdateChangeCreateManyInput[] = [];

    for (const studentId of studentIds) {
      const student = await this.sections.loadStudentForBulk(
        user.tid,
        studentId,
      );
      const rowValues = this.resolveValuesForStudent(
        dto,
        student.enrollmentNumber,
        student.rollNumber,
      );
      const current: Record<string, unknown> = {};
      const changes: (typeof rows)[0]['changes'] = [];
      const errors: string[] = [];

      for (const fieldKey of dto.fieldKeys) {
        const def = BULK_UPDATE_FIELD_MAP.get(fieldKey);
        if (!def) continue;
        const before = await this.sectionWriter.readFieldValue(
          student,
          fieldKey,
        );
        current[fieldKey] = before;
        let after = rowValues[fieldKey];
        if (after === undefined || after === null || after === '') continue;

        if (
          dto.updateMode === 'APPEND' &&
          def.supportsAppend &&
          typeof after === 'string'
        ) {
          after = `${before ? String(before) + ' ' : ''}${after}`.trim();
        }

        changes.push({
          fieldKey,
          label: def.label,
          before,
          after,
        });

        changeRecords.push({
          tenantId: user.tid,
          batchId: '',
          studentId,
          fieldKey,
          sectionKey: def.sectionKey,
          oldValue: before as Prisma.InputJsonValue,
          newValue: after as Prisma.InputJsonValue,
          status: 'PREVIEW',
        });
      }

      const validationErrors = await this.validateStudentChanges(
        user.tid,
        student,
        dto.fieldKeys,
        rowValues,
        dto.allowVtcOverride,
      );
      errors.push(...validationErrors);

      if (errors.length) invalid += 1;
      else valid += 1;

      rows.push({
        studentId,
        fullName: student.masterProfile?.fullName ?? '—',
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        changes,
        errors,
      });
    }

    const batch = await this.prisma.studentBulkUpdateBatch.create({
      data: {
        tenantId: user.tid,
        status: 'PREVIEWED',
        updateMode: dto.updateMode,
        fieldKeys: dto.fieldKeys,
        scopeFilter: (dto.scope.filter ?? {
          studentIds: dto.scope.studentIds,
        }) as Prisma.InputJsonValue,
        valuesPayload: (dto.values ?? {}) as Prisma.InputJsonValue,
        csvPayload: dto.csvRows
          ? (dto.csvRows as Prisma.InputJsonValue)
          : undefined,
        studentCount: studentIds.length,
        validCount: valid,
        invalidCount: invalid,
        actorId: user.sub,
        ipAddress,
      },
    });

    if (changeRecords.length) {
      await this.prisma.studentBulkUpdateChange.createMany({
        data: changeRecords.map((c) => ({ ...c, batchId: batch.id })),
      });
    }

    return {
      batchId: batch.id,
      total: studentIds.length,
      valid,
      invalid,
      rows: rows.slice(0, 200),
      rowsTruncated: rows.length > 200,
    };
  }

  async apply(
    user: JwtUser,
    batchId: string,
    forceApply = false,
    ipAddress?: string,
  ) {
    const batch = await this.prisma.studentBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const stuckProcessing =
      batch.status === 'PROCESSING' &&
      !batch.appliedAt &&
      Date.now() - new Date(batch.updatedAt).getTime() > 10_000;

    const started = await this.prisma.studentBulkUpdateBatch.updateMany({
      where: {
        id: batchId,
        tenantId: user.tid,
        OR: [
          { status: 'PREVIEWED' },
          ...(stuckProcessing
            ? [{ status: 'PROCESSING', appliedAt: null }]
            : []),
        ],
      },
      data: {
        status: 'PROCESSING',
        ...(stuckProcessing ? {} : { appliedCount: 0, errorCount: 0 }),
        ipAddress: ipAddress ?? batch.ipAddress,
      },
    });

    if (started.count === 0) {
      if (batch.status === 'PROCESSING') {
        throw new BadRequestException('Bulk update is already in progress');
      }
      throw new BadRequestException(
        `Batch status is ${batch.status}, cannot apply`,
      );
    }

    if (batch.invalidCount > 0 && !forceApply) {
      await this.prisma.studentBulkUpdateBatch.update({
        where: { id: batchId },
        data: { status: 'PREVIEWED' },
      });
      throw new BadRequestException(
        `${batch.invalidCount} students have validation errors — use forceApply to override`,
      );
    }

    if (batch.studentCount > ASYNC_THRESHOLD) {
      void this.applyBatchInternal(
        user.tid,
        batchId,
        user.sub,
        forceApply,
      ).catch(async (err) => {
        this.logger.error(
          `Bulk update failed for batch ${batchId}`,
          err instanceof Error ? err.stack : String(err),
        );
        await this.prisma.studentBulkUpdateBatch.update({
          where: { id: batchId },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : 'Apply failed',
          },
        });
      });
      return {
        batchId,
        async: true,
        total: batch.validCount || batch.studentCount,
        message: 'Bulk update started',
      };
    }

    return this.applyBatchInternal(user.tid, batchId, user.sub, forceApply);
  }

  async applyBatchInternal(
    tenantId: string,
    batchId: string,
    actorId: string,
    forceApply = false,
  ) {
    try {
      return await this.runApplyBatch(tenantId, batchId, actorId, forceApply);
    } catch (err) {
      this.logger.error(
        `Bulk update apply crashed for batch ${batchId}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.prisma.studentBulkUpdateBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Apply failed',
        },
      });
      throw err;
    }
  }

  private async runApplyBatch(
    tenantId: string,
    batchId: string,
    actorId: string,
    forceApply = false,
  ) {
    const batch = await this.prisma.studentBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const fieldKeys = batch.fieldKeys as string[];
    const values = (batch.valuesPayload ?? {}) as Record<string, unknown>;
    const csvRows = batch.csvPayload as Record<string, string>[] | null;
    const updateMode = batch.updateMode as 'REPLACE' | 'APPEND' | 'CSV';

    const changes = await this.prisma.studentBulkUpdateChange.findMany({
      where: { batchId, status: 'PREVIEW' },
    });

    const byStudent = new Map<string, typeof changes>();
    for (const c of changes) {
      const list = byStudent.get(c.studentId) ?? [];
      list.push(c);
      byStudent.set(c.studentId, list);
    }

    let applied = batch.appliedCount;
    let errors = batch.errorCount;
    const studentIds = [...byStudent.keys()];
    const flushEvery = 5;

    const flushProgress = async () => {
      await this.prisma.studentBulkUpdateBatch.update({
        where: { id: batchId },
        data: { appliedCount: applied, errorCount: errors },
      });
    };

    this.logger.log(
      `Applying bulk update batch ${batchId} for ${studentIds.length} students`,
    );

    for (let index = 0; index < studentIds.length; index += 1) {
      const studentId = studentIds[index]!;
      try {
        const student = await this.sections.loadStudentForBulk(
          tenantId,
          studentId,
        );
        const rowValues = this.resolveValuesForStudent(
          { updateMode, values, csvRows: csvRows ?? undefined, fieldKeys },
          student.enrollmentNumber,
          student.rollNumber,
        );

        if (!forceApply) {
          const validationErrors = await this.validateStudentChanges(
            tenantId,
            student,
            fieldKeys,
            rowValues,
            false,
          );
          if (validationErrors.length) {
            errors += 1;
            await this.prisma.studentBulkUpdateChange.updateMany({
              where: { batchId, studentId, status: 'PREVIEW' },
              data: {
                status: 'ERROR',
                errorMessage: validationErrors.join('; '),
              },
            });
            continue;
          }
        }

        const current: Record<string, unknown> = {};
        for (const fk of fieldKeys) {
          current[fk] = await this.sectionWriter.readFieldValue(student, fk);
        }

        const nepFields = fieldKeys.filter((k) =>
          ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'].includes(k),
        );
        const profileFields = fieldKeys.filter((k) => !nepFields.includes(k));

        if (profileFields.length) {
          const patches = this.sectionWriter.buildSectionPatches(
            profileFields,
            rowValues,
            updateMode,
            current,
          );
          await this.sectionWriter.applySectionPatches(
            tenantId,
            studentId,
            patches,
            actorId,
          );
        }

        for (const nepKey of nepFields) {
          const offeringId = rowValues[nepKey];
          if (offeringId) {
            await this.applyNepCategory(
              tenantId,
              studentId,
              nepKey,
              String(offeringId),
            );
          }
        }

        const auditChanges = profileFields.map((fk) => ({
          fieldKey: fk,
          sectionKey: BULK_UPDATE_FIELD_MAP.get(fk)?.sectionKey ?? 'basic',
          oldValue: current[fk],
          newValue: rowValues[fk],
        }));

        await this.sectionWriter.writeAuditLogs(
          this.prisma,
          tenantId,
          studentId,
          actorId,
          auditChanges,
        );

        await this.prisma.studentBulkUpdateChange.updateMany({
          where: { batchId, studentId, status: 'PREVIEW' },
          data: { status: 'APPLIED' },
        });

        applied += 1;
      } catch (err) {
        errors += 1;
        const msg = err instanceof Error ? err.message : 'Apply failed';
        await this.prisma.studentBulkUpdateChange.updateMany({
          where: { batchId, studentId, status: 'PREVIEW' },
          data: { status: 'ERROR', errorMessage: msg },
        });
      }

      if ((index + 1) % flushEvery === 0 || index === studentIds.length - 1) {
        await flushProgress();
      }
    }

    await this.prisma.studentBulkUpdateBatch.update({
      where: { id: batchId },
      data: {
        status: errors === studentIds.length ? 'FAILED' : 'APPLIED',
        appliedCount: applied,
        errorCount: errors,
        appliedAt: new Date(),
      },
    });

    return { batchId, async: false, applied, errors, total: studentIds.length };
  }

  async rollback(user: JwtUser, batchId: string) {
    const batch = await this.prisma.studentBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'APPLIED') {
      throw new BadRequestException('Only applied batches can be rolled back');
    }

    const changes = await this.prisma.studentBulkUpdateChange.findMany({
      where: { batchId, status: 'APPLIED' },
    });

    const byStudent = new Map<string, typeof changes>();
    for (const c of changes) {
      const list = byStudent.get(c.studentId) ?? [];
      list.push(c);
      byStudent.set(c.studentId, list);
    }

    let rolledBack = 0;
    for (const [studentId, studentChanges] of byStudent) {
      const revertValues: Record<string, unknown> = {};
      const fieldKeys: string[] = [];
      for (const c of studentChanges) {
        revertValues[c.fieldKey] = c.oldValue;
        fieldKeys.push(c.fieldKey);
      }
      const patches = this.sectionWriter.buildSectionPatches(
        fieldKeys,
        revertValues,
        'REPLACE',
        {},
      );
      await this.sectionWriter.applySectionPatches(
        user.tid,
        studentId,
        patches,
        user.sub,
      );
      rolledBack += 1;
    }

    await this.prisma.studentBulkUpdateBatch.update({
      where: { id: batchId },
      data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
    });

    return { batchId, rolledBackStudents: rolledBack };
  }

  async importCsvPreview(
    user: JwtUser,
    fieldKeys: string[],
    csvRows: Record<string, string>[],
  ) {
    if (!csvRows.length) {
      throw new BadRequestException('CSV must contain at least one row');
    }
    return this.preview(user, {
      scope: {},
      fieldKeys,
      updateMode: 'CSV',
      csvRows,
      values: {},
    });
  }

  private async resolveCsvStudentIds(
    tenantId: string,
    csvRows: Record<string, string>[],
  ) {
    const rollNumbers = new Set<string>();
    const enrollmentNumbers = new Set<string>();
    for (const row of csvRows) {
      const roll = String(row.RollNumber ?? row.rollNumber ?? '').trim();
      const enrollment = String(
        row.EnrollmentNumber ?? row.enrollmentNumber ?? '',
      ).trim();
      if (roll) rollNumbers.add(roll);
      if (enrollment) enrollmentNumbers.add(enrollment);
    }
    if (rollNumbers.size === 0 && enrollmentNumbers.size === 0) {
      throw new BadRequestException(
        'CSV rows must include RollNumber or EnrollmentNumber',
      );
    }
    const or: Prisma.StudentWhereInput[] = [];
    if (rollNumbers.size) {
      or.push({ rollNumber: { in: [...rollNumbers] } });
    }
    if (enrollmentNumbers.size) {
      or.push({ enrollmentNumber: { in: [...enrollmentNumbers] } });
    }
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null, OR: or },
      select: { id: true },
    });
    if (!students.length) {
      throw new BadRequestException('No students matched CSV identifiers');
    }
    return students.map((s) => s.id);
  }

  private validateFieldKeys(fieldKeys: string[]) {
    if (!fieldKeys.length) {
      throw new BadRequestException('Select at least one field to update');
    }
    for (const key of fieldKeys) {
      if (!BULK_UPDATE_FIELD_MAP.has(key)) {
        throw new BadRequestException(`Unknown field: ${key}`);
      }
    }
  }

  private resolveValuesForStudent(
    dto: Pick<
      BulkUpdatePreviewDto,
      'updateMode' | 'values' | 'csvRows' | 'fieldKeys'
    >,
    enrollmentNumber: string,
    rollNumber: string | null,
  ) {
    if (dto.updateMode === 'CSV' && dto.csvRows?.length) {
      const row =
        dto.csvRows.find(
          (r) =>
            r.RollNumber === rollNumber ||
            r.rollNumber === rollNumber ||
            r.EnrollmentNumber === enrollmentNumber ||
            r.enrollmentNumber === enrollmentNumber,
        ) ?? {};
      const out: Record<string, unknown> = {};
      for (const key of dto.fieldKeys) {
        if (row[key] === undefined) continue;
        if (key === 'dateOfBirth') {
          const parsed = parseFlexibleDate(row[key]);
          if (parsed) out[key] = parsed;
          else if (String(row[key] ?? '').trim()) out[key] = row[key];
          continue;
        }
        out[key] = row[key];
      }
      return out;
    }
    return { ...(dto.values ?? {}) };
  }

  private async validateStudentChanges(
    tenantId: string,
    student: Awaited<
      ReturnType<StudentProfileSectionsService['loadStudentForBulk']>
    >,
    fieldKeys: string[],
    values: Record<string, unknown>,
    allowVtcOverride?: boolean,
  ): Promise<string[]> {
    const errors: string[] = [];

    if (
      fieldKeys.includes('majorSubjectSlug') &&
      fieldKeys.includes('minorSubjectSlug')
    ) {
      const major = String(values.majorSubjectSlug ?? '');
      const minor = String(values.minorSubjectSlug ?? '');
      if (major && minor && major === minor) {
        errors.push('Major and minor cannot be the same');
      }
    }

    if (values.rollNumber && values.rollNumber !== student.rollNumber) {
      const clash = await this.prisma.student.findFirst({
        where: {
          tenantId,
          rollNumber: String(values.rollNumber),
          id: { not: student.id },
          deletedAt: null,
        },
      });
      if (clash) errors.push('Roll number already assigned to another student');
    }

    if (
      values.enrollmentNumber &&
      values.enrollmentNumber !== student.enrollmentNumber
    ) {
      const clash = await this.prisma.student.findFirst({
        where: {
          tenantId,
          enrollmentNumber: String(values.enrollmentNumber),
          id: { not: student.id },
          deletedAt: null,
        },
      });
      if (clash)
        errors.push('Registration number already assigned to another student');
    }

    if (fieldKeys.includes('VTC') && values.VTC && !allowVtcOverride) {
      const sem = student.academicStanding?.currentSemesterSequence ?? 1;
      const vtcTrack = await this.prisma.studentVtcTrack.findUnique({
        where: { studentId: student.id },
      });
      if (vtcTrack && [4, 6].includes(sem)) {
        errors.push(
          'VTC track change blocked in semester 4/6 without override',
        );
      }
    }

    return errors;
  }

  private async applyNepCategory(
    tenantId: string,
    studentId: string,
    category: string,
    offeringId: string,
  ) {
    const reg = await this.prisma.semesterRegistration.findFirst({
      where: { tenantId, studentId },
      orderBy: { semesterSequence: 'desc' },
    });
    if (!reg) return;
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: { registrationId: reg.id },
    });
    const updated = lines
      .filter((l) => l.category !== category)
      .map((l) => ({
        category: l.category,
        offeringId: l.offeringId ?? undefined,
        offeringSectionId: l.offeringSectionId ?? undefined,
      }));
    updated.push({ category, offeringId, offeringSectionId: undefined });
    await this.academicEngine.updateRegistrationLines(
      tenantId,
      reg.id,
      updated,
    );
  }
}
