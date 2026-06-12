import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import { JwtUser } from '../../../common/decorators/current-user.decorator';
import { QueueService } from '../../../shared/queue/queue.service';
import { StaffService } from '../staff.service';
import {
  StaffBulkMatchingKey,
  StaffBulkUpdateTemplateQueryDto,
  StaffBulkUpdatePreviewDto,
} from './dto/staff-bulk-update.dto';
import {
  getStaffBulkUpdateFieldsGrouped,
  resolveStaffBulkFieldKey,
  serializeStaffBulkValue,
  STAFF_BULK_UPDATE_FIELD_CATALOG,
  STAFF_BULK_UPDATE_FIELD_MAP,
} from './staff-bulk-update-fields';
import { StaffBulkSectionWriterService } from './staff-bulk-section-writer.service';

const MAX_STAFF = 5000;
const CHUNK_SIZE = 50;
const ASYNC_THRESHOLD = 250;
const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

type CsvRow = Record<string, string>;

@Injectable()
export class StaffBulkUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffService,
    private readonly writer: StaffBulkSectionWriterService,
    private readonly queue: QueueService,
  ) {}

  getFields() {
    return getStaffBulkUpdateFieldsGrouped();
  }

  async listBatches(tenantId: string, limit = 20) {
    return this.prisma.staffBulkUpdateBatch.findMany({
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
    const batch = await this.prisma.staffBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        actor: { select: { id: true, email: true } },
        changes: {
          take: 500,
          orderBy: { fieldKey: 'asc' },
          include: {
            staff: {
              select: {
                id: true,
                employeeCode: true,
                shortCode: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!batch)
      throw new NotFoundException('Staff bulk update batch not found');
    return batch;
  }

  async buildTemplate(
    tenantId: string,
    fieldKeys: string[],
    matchingKey: StaffBulkMatchingKey = 'employeeCode',
    filters: StaffBulkUpdateTemplateQueryDto,
  ) {
    this.validateFieldKeys(fieldKeys);
    matchingKey = this.safeMatchingKey(fieldKeys, matchingKey);
    const staffRows = await this.loadTemplateStaffRows(tenantId, filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Staff Bulk Update');
    const compact = filters.templateMode === 'COMPACT';
    const helperHeaders = compact
      ? [this.matchingHeader(matchingKey)]
      : [
          this.matchingHeader(matchingKey),
          'Staff Name',
          'Department',
          'Designation',
          'Staff Type',
        ];
    const fieldHeaders = fieldKeys.flatMap((key) => {
      const label = this.templateFieldLabel(key);
      return compact ? [`New ${label}`] : [`Current ${label}`, `New ${label}`];
    });
    sheet.addRow([...helperHeaders, ...fieldHeaders]);

    for (const staff of staffRows) {
      const helperValues = compact
        ? [this.matchingValue(staff, matchingKey)]
        : [
            this.matchingValue(staff, matchingKey),
            staff.fullName,
            staff.department?.name ?? '',
            staff.designation?.label ?? '',
            staff.staffType,
          ];
      const fieldValues = fieldKeys.flatMap((key) => {
        const current = this.templateCurrentValue(staff, key);
        return compact ? [''] : [current ?? '', ''];
      });
      sheet.addRow([...helperValues, ...fieldValues]);
    }

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: helperHeaders.length + fieldHeaders.length },
    };
    sheet.columns.forEach((col) => {
      col.width = 24;
    });
    const editableColumns: number[] = [];
    fieldHeaders.forEach((header, index) => {
      if (header.startsWith('New '))
        editableColumns.push(helperHeaders.length + index + 1);
    });
    for (let rowNo = 1; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      row.eachCell((cell, colNo) => {
        const editable = rowNo > 1 && editableColumns.includes(colNo);
        cell.protection = { locked: !editable };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: editable ? 'FFFFF2CC' : 'FFE7E6E6' },
        };
      });
    }
    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatColumns: true,
      autoFilter: true,
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async parseWorkbook(buffer: Buffer, filename: string) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv')) {
      return this.parseCsv(buffer.toString('utf8'));
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Workbook has no worksheets');
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((h) => String(h ?? '').trim());
    const rows: CsvRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const out: CsvRow = {};
      let hasValue = false;
      headers.forEach((header, i) => {
        const raw = row.getCell(i + 1).value;
        const value = this.cellToString(raw);
        out[header] = value;
        if (value) hasValue = true;
      });
      if (hasValue) rows.push(out);
    });
    return rows;
  }

  async preview(
    user: JwtUser,
    dto: StaffBulkUpdatePreviewDto,
    ipAddress?: string,
  ) {
    this.validateFieldKeys(dto.fieldKeys);
    const matchingKey = this.safeMatchingKey(
      dto.fieldKeys,
      dto.matchingKey ?? 'employeeCode',
    );
    const staffIds = await this.resolveStaffIds(user, dto, matchingKey);
    if (staffIds.length === 0) {
      throw new BadRequestException(
        'No staff matched the selected scope or uploaded identifiers',
      );
    }

    const duplicateErrors = await this.findInputDuplicateErrors(
      user.tid,
      dto,
      matchingKey,
    );
    const rows: Array<{
      staffId: string;
      employeeCode: string;
      fullName: string;
      changes: {
        fieldKey: string;
        label: string;
        before: unknown;
        after: unknown;
      }[];
      errors: string[];
      warnings: string[];
    }> = [];
    const changeRecords: Prisma.StaffBulkUpdateChangeCreateManyInput[] = [];
    let valid = 0;
    let invalid = 0;
    let skipped = 0;

    for (const staffId of staffIds) {
      const staff = await this.writer.loadStaffForBulk(user.tid, staffId);
      const rowValues = await this.resolveValuesForStaff(
        user.tid,
        dto,
        staff,
        matchingKey,
      );
      const errors = [...duplicateErrors];
      const warnings: string[] = [];
      const changes: (typeof rows)[0]['changes'] = [];
      const current: Record<string, unknown> = {};

      errors.push(
        ...(await this.validateStaffChanges(
          user.tid,
          staff.id,
          dto.fieldKeys,
          rowValues,
        )),
      );

      for (const fieldKey of dto.fieldKeys) {
        const def = STAFF_BULK_UPDATE_FIELD_MAP.get(fieldKey);
        if (!def) continue;
        const before = this.writer.readFieldValue(staff, fieldKey);
        current[fieldKey] = before;
        const after = rowValues[fieldKey];
        if (after === undefined || after === null || after === '') continue;
        if (
          serializeStaffBulkValue(before) === serializeStaffBulkValue(after)
        ) {
          warnings.push(`${def.label} unchanged`);
          continue;
        }
        changes.push({ fieldKey, label: def.label, before, after });
        changeRecords.push({
          tenantId: user.tid,
          batchId: '',
          staffProfileId: staff.id,
          fieldKey,
          sectionKey: def.sectionKey,
          oldValue: this.toJson(before),
          newValue: this.toJson(after),
          status: 'PREVIEW',
        });
      }

      if (errors.length) invalid += 1;
      else if (!changes.length) skipped += 1;
      else valid += 1;

      rows.push({
        staffId: staff.id,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        changes,
        errors,
        warnings,
      });
    }

    const batch = await this.prisma.staffBulkUpdateBatch.create({
      data: {
        tenantId: user.tid,
        status: 'PREVIEWED',
        updateMode: dto.updateMode,
        matchingKey,
        fieldKeys: dto.fieldKeys,
        scopeFilter: (dto.scope.filter ?? {
          staffIds: dto.scope.staffIds,
        }) as Prisma.InputJsonValue,
        valuesPayload: (dto.values ?? {}) as Prisma.InputJsonValue,
        csvPayload: dto.csvRows
          ? (dto.csvRows as Prisma.InputJsonValue)
          : undefined,
        staffCount: staffIds.length,
        validCount: valid,
        invalidCount: invalid,
        skippedCount: skipped,
        actorId: user.sub,
        ipAddress,
      },
    });

    if (changeRecords.length) {
      await this.prisma.staffBulkUpdateChange.createMany({
        data: changeRecords.map((record) => ({ ...record, batchId: batch.id })),
      });
    }

    return {
      batchId: batch.id,
      total: staffIds.length,
      valid,
      invalid,
      skipped,
      rows: rows.slice(0, 250),
      rowsTruncated: rows.length > 250,
    };
  }

  async apply(
    user: JwtUser,
    batchId: string,
    forceApply = false,
    ipAddress?: string,
  ) {
    const batch = await this.prisma.staffBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'PREVIEWED') {
      throw new BadRequestException(
        `Batch status is ${batch.status}, cannot apply`,
      );
    }
    if (batch.invalidCount > 0 && !forceApply) {
      throw new BadRequestException(
        `${batch.invalidCount} staff rows have validation errors`,
      );
    }
    if (batch.staffCount > ASYNC_THRESHOLD) {
      await this.queue.enqueueStaffBulkUpdateApply({
        tenantId: user.tid,
        batchId,
        userId: user.sub,
        ipAddress,
        forceApply,
      });
      await this.prisma.staffBulkUpdateBatch.update({
        where: { id: batchId },
        data: { status: 'PROCESSING' },
      });
      return {
        batchId,
        async: true,
        message: 'Staff bulk update queued for processing',
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
    const batch = await this.prisma.staffBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const fieldKeys = batch.fieldKeys as string[];
    const values = (batch.valuesPayload ?? {}) as Record<string, unknown>;
    const csvRows = batch.csvPayload as CsvRow[] | null;
    const updateMode = batch.updateMode as 'REPLACE' | 'APPEND' | 'CSV';
    const matchingKey = batch.matchingKey as StaffBulkMatchingKey;
    const changes = await this.prisma.staffBulkUpdateChange.findMany({
      where: { batchId, status: 'PREVIEW' },
    });
    const byStaff = new Map<string, typeof changes>();
    for (const change of changes) {
      const list = byStaff.get(change.staffProfileId) ?? [];
      list.push(change);
      byStaff.set(change.staffProfileId, list);
    }

    let applied = 0;
    let errors = 0;
    const staffIds = [...byStaff.keys()];
    for (let i = 0; i < staffIds.length; i += CHUNK_SIZE) {
      const chunk = staffIds.slice(i, i + CHUNK_SIZE);
      for (const staffId of chunk) {
        try {
          const staff = await this.writer.loadStaffForBulk(tenantId, staffId);
          const rowValues = await this.resolveValuesForStaff(
            tenantId,
            {
              updateMode,
              values,
              csvRows: csvRows ?? undefined,
              fieldKeys,
              matchingKey,
            },
            staff,
            matchingKey,
          );
          if (!forceApply) {
            const validationErrors = await this.validateStaffChanges(
              tenantId,
              staffId,
              fieldKeys,
              rowValues,
            );
            if (validationErrors.length) {
              errors += 1;
              await this.prisma.staffBulkUpdateChange.updateMany({
                where: { batchId, staffProfileId: staffId, status: 'PREVIEW' },
                data: {
                  status: 'ERROR',
                  errorMessage: validationErrors.join('; '),
                },
              });
              continue;
            }
          }
          const current: Record<string, unknown> = {};
          for (const fieldKey of fieldKeys) {
            current[fieldKey] = this.writer.readFieldValue(staff, fieldKey);
          }
          const patches = this.writer.buildPatches(
            fieldKeys,
            rowValues,
            updateMode,
            current,
          );
          await this.writer.applyPatches(tenantId, staffId, patches);
          const auditChanges = fieldKeys.map((fieldKey) => ({
            fieldKey,
            sectionKey:
              STAFF_BULK_UPDATE_FIELD_MAP.get(fieldKey)?.sectionKey ?? 'basic',
            oldValue: current[fieldKey],
            newValue: rowValues[fieldKey],
          }));
          await this.prisma.$transaction(async (tx) => {
            await this.writer.writeAuditLogs(
              tx,
              tenantId,
              actorId,
              batchId,
              auditChanges,
            );
            await tx.staffBulkUpdateChange.updateMany({
              where: { batchId, staffProfileId: staffId, status: 'PREVIEW' },
              data: { status: 'APPLIED' },
            });
          });
          applied += 1;
        } catch (error) {
          errors += 1;
          const message =
            error instanceof Error ? error.message : 'Apply failed';
          await this.prisma.staffBulkUpdateChange.updateMany({
            where: { batchId, staffProfileId: staffId, status: 'PREVIEW' },
            data: { status: 'ERROR', errorMessage: message },
          });
        }
      }
    }

    await this.prisma.staffBulkUpdateBatch.update({
      where: { id: batchId },
      data: {
        status: errors === staffIds.length ? 'FAILED' : 'APPLIED',
        appliedCount: applied,
        errorCount: errors,
        appliedAt: new Date(),
      },
    });
    return { batchId, async: false, applied, errors, total: staffIds.length };
  }

  async rollback(user: JwtUser, batchId: string) {
    const batch = await this.prisma.staffBulkUpdateBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'APPLIED') {
      throw new BadRequestException('Only applied batches can be rolled back');
    }
    if (Date.now() - batch.appliedAt!.getTime() > ROLLBACK_WINDOW_MS) {
      throw new BadRequestException(
        'Rollback window expired. Staff bulk updates can be rolled back within 24 hours.',
      );
    }

    const changes = await this.prisma.staffBulkUpdateChange.findMany({
      where: { batchId, status: 'APPLIED' },
    });
    const byStaff = new Map<string, typeof changes>();
    for (const change of changes) {
      const list = byStaff.get(change.staffProfileId) ?? [];
      list.push(change);
      byStaff.set(change.staffProfileId, list);
    }
    let rolledBack = 0;
    for (const [staffId, staffChanges] of byStaff) {
      const revertValues: Record<string, unknown> = {};
      const fieldKeys: string[] = [];
      for (const change of staffChanges) {
        revertValues[change.fieldKey] = change.oldValue;
        fieldKeys.push(change.fieldKey);
      }
      const patches = this.writer.buildPatches(
        fieldKeys,
        revertValues,
        'REPLACE',
        {},
      );
      await this.writer.applyPatches(user.tid, staffId, patches);
      rolledBack += 1;
    }
    await this.prisma.staffBulkUpdateBatch.update({
      where: { id: batchId },
      data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
    });
    return { batchId, rolledBackStaff: rolledBack };
  }

  async importRowsPreview(
    user: JwtUser,
    fieldKeys: string[],
    rows: CsvRow[],
    matchingKey: StaffBulkMatchingKey,
  ) {
    const effectiveMatchingKey = this.safeMatchingKey(fieldKeys, matchingKey);
    return this.preview(user, {
      scope: {},
      fieldKeys,
      updateMode: 'CSV',
      csvRows: rows,
      values: {},
      matchingKey: effectiveMatchingKey,
    });
  }

  async buildErrorReport(tenantId: string, batchId: string) {
    const batch = await this.getBatch(tenantId, batchId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Validation Report');
    sheet.addRow([
      'Employee Code',
      'Staff',
      'Field',
      'Submitted Value',
      'Status',
      'Error',
    ]);
    for (const change of batch.changes) {
      sheet.addRow([
        change.staff.employeeCode,
        change.staff.fullName,
        change.fieldKey,
        serializeStaffBulkValue(change.newValue),
        change.status,
        change.errorMessage ?? '',
      ]);
    }
    sheet.getRow(1).font = { bold: true };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async resolveStaffIds(
    user: JwtUser,
    dto: StaffBulkUpdatePreviewDto,
    matchingKey: StaffBulkMatchingKey,
  ) {
    if (dto.updateMode === 'CSV' && dto.csvRows?.length) {
      return this.resolveCsvStaffIds(user.tid, dto.csvRows, matchingKey);
    }
    if (dto.scope.staffIds?.length) {
      if (dto.scope.staffIds.length > MAX_STAFF)
        throw new BadRequestException(`Maximum ${MAX_STAFF} staff per batch`);
      return dto.scope.staffIds;
    }
    if (!dto.scope.filter)
      throw new BadRequestException(
        'Provide staffIds, filter scope, or uploaded rows',
      );
    const result = await this.staff.listDirectory(user, {
      ...dto.scope.filter,
      page: 1,
      limit: MAX_STAFF,
    });
    return result.data.map((row) => row.id);
  }

  private async loadTemplateStaffRows(
    tenantId: string,
    filters: StaffBulkUpdateTemplateQueryDto,
  ) {
    const ids = filters.ids
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
        ...(filters.staffType ? { staffType: filters.staffType } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.designationId
          ? { designationId: filters.designationId }
          : {}),
        ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  employeeCode: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
                {
                  shortCode: { contains: filters.search, mode: 'insensitive' },
                },
                { fullName: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { mobile: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ employeeCode: 'asc' }],
      take: 5000,
      include: {
        department: { select: { name: true } },
        designation: { select: { label: true } },
        primaryShift: { select: { name: true, code: true } },
        portalUser: { select: { email: true, isActive: true } },
        additionalRoles: { where: { active: true } },
      },
    });
  }

  private async resolveCsvStaffIds(
    tenantId: string,
    rows: CsvRow[],
    matchingKey: StaffBulkMatchingKey,
  ) {
    const values = rows
      .map((row) => this.rowIdentifier(row, matchingKey))
      .filter(Boolean);
    if (!values.length)
      throw new BadRequestException(
        `Uploaded rows must include ${this.matchingHeader(matchingKey)}`,
      );
    const where = this.identifierWhere(matchingKey, values);
    const staff = await this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null, ...where },
      select: { id: true },
    });
    return staff.map((row) => row.id);
  }

  private async resolveValuesForStaff(
    tenantId: string,
    dto: Pick<
      StaffBulkUpdatePreviewDto,
      'updateMode' | 'values' | 'csvRows' | 'fieldKeys' | 'matchingKey'
    >,
    staff: {
      id: string;
      employeeCode: string;
      shortCode: string | null;
      portalUser?: { email: string } | null;
    },
    matchingKey: StaffBulkMatchingKey,
  ) {
    const source =
      dto.updateMode === 'CSV'
        ? (dto.csvRows?.find((row) =>
            this.rowMatchesStaff(row, matchingKey, staff),
          ) ?? {})
        : (dto.values ?? {});
    const out: Record<string, unknown> = {};
    for (const key of dto.fieldKeys) {
      const raw = source[key] ?? this.valueByFieldAlias(source as CsvRow, key);
      if (raw === undefined || raw === '') continue;
      out[key] = await this.resolveFieldValue(tenantId, key, raw);
    }
    return out;
  }

  private async resolveFieldValue(
    tenantId: string,
    fieldKey: string,
    value: unknown,
  ) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    switch (fieldKey) {
      case 'departmentId':
        return this.lookupDepartment(tenantId, text);
      case 'designationId':
        return this.lookupDesignation(tenantId, text);
      case 'primaryShiftId':
        return this.lookupShift(tenantId, text);
      default:
        return value;
    }
  }

  private async validateStaffChanges(
    tenantId: string,
    staffId: string,
    fieldKeys: string[],
    values: Record<string, unknown>,
  ) {
    const errors: string[] = [];
    const email = String(values.email ?? values.portalEmail ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('Invalid email address');
    const mobile = String(values.mobile ?? '').trim();
    if (mobile && !/^[0-9+\-\s]{6,20}$/.test(mobile))
      errors.push('Invalid mobile number');
    for (const key of ['dateOfBirth', 'joiningDate']) {
      if (values[key] && Number.isNaN(new Date(String(values[key])).getTime()))
        errors.push(`Invalid ${key} date`);
    }
    for (const key of [
      'email',
      'shortCode',
      'employeeCode',
      'rfidNo',
      'biometricId',
    ] as const) {
      if (!fieldKeys.includes(key) || !values[key]) continue;
      const clash = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,
          id: { not: staffId },
          deletedAt: null,
          [key]: String(values[key]).trim(),
        },
      });
      if (clash)
        errors.push(
          `${STAFF_BULK_UPDATE_FIELD_MAP.get(key)?.label ?? key} already belongs to another staff member`,
        );
    }
    return errors;
  }

  private async findInputDuplicateErrors(
    _tenantId: string,
    dto: StaffBulkUpdatePreviewDto,
    matchingKey: StaffBulkMatchingKey,
  ) {
    if (dto.updateMode !== 'CSV' || !dto.csvRows?.length) return [];
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of dto.csvRows) {
      const id = this.rowIdentifier(row, matchingKey);
      if (!id) continue;
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    return duplicates.size
      ? [
          `Duplicate ${this.matchingHeader(matchingKey)} values: ${[...duplicates].join(', ')}`,
        ]
      : [];
  }

  private validateFieldKeys(fieldKeys: string[]) {
    if (!fieldKeys.length)
      throw new BadRequestException('Select at least one field to update');
    for (const key of fieldKeys) {
      if (!STAFF_BULK_UPDATE_FIELD_MAP.has(key))
        throw new BadRequestException(`Unknown staff update field: ${key}`);
    }
  }

  private safeMatchingKey(
    fieldKeys: string[],
    matchingKey: StaffBulkMatchingKey,
  ): StaffBulkMatchingKey {
    const conflicts: Partial<Record<StaffBulkMatchingKey, string>> = {
      employeeCode: 'employeeCode',
      shortCode: 'shortCode',
      portalEmail: 'portalEmail',
    };
    const matchingField = conflicts[matchingKey];
    if (matchingField && fieldKeys.includes(matchingField)) {
      return fieldKeys.includes('employeeCode') ? 'staffId' : 'employeeCode';
    }
    return matchingKey;
  }

  private parseCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0]!
      .split(',')
      .map((header) => header.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const cells = line
        .split(',')
        .map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const row: CsvRow = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? '';
      });
      return row;
    });
  }

  private valueByFieldAlias(row: CsvRow, fieldKey: string) {
    const field = STAFF_BULK_UPDATE_FIELD_MAP.get(fieldKey);
    const label = this.templateFieldLabel(fieldKey);
    const baseHeaders = [
      fieldKey,
      field?.label,
      label,
      ...(field?.aliases ?? []),
    ].filter(Boolean) as string[];
    const headers = [
      ...baseHeaders.map((header) => `New ${header}`),
      ...baseHeaders,
    ];
    for (const header of headers) {
      if (row[header] !== undefined) return row[header];
    }
    const matchedNewHeader = Object.keys(row).find(
      (key) =>
        key.trim().toLowerCase().startsWith('new ') &&
        resolveStaffBulkFieldKey(key.replace(/^new\s+/i, '')) === fieldKey,
    );
    if (matchedNewHeader) return row[matchedNewHeader];
    const matched = Object.keys(row).find(
      (key) => resolveStaffBulkFieldKey(key) === fieldKey,
    );
    if (matched) return row[matched];
    return undefined;
  }

  private rowIdentifier(row: CsvRow, matchingKey: StaffBulkMatchingKey) {
    const header = this.matchingHeader(matchingKey);
    const fallbackHeader =
      matchingKey === 'employeeCode' ? 'Employee Code' : undefined;
    const match =
      row[matchingKey] ??
      row[header] ??
      (fallbackHeader ? row[fallbackHeader] : undefined) ??
      row[header.replace(/\s+/g, '')];
    return String(match ?? '').trim();
  }

  private rowMatchesStaff(
    row: CsvRow,
    matchingKey: StaffBulkMatchingKey,
    staff: {
      id: string;
      employeeCode: string;
      shortCode: string | null;
      portalUser?: { email: string } | null;
    },
  ) {
    const id = this.rowIdentifier(row, matchingKey);
    if (matchingKey === 'staffId') return id === staff.id;
    if (matchingKey === 'shortCode') return id === staff.shortCode;
    if (matchingKey === 'portalEmail')
      return id.toLowerCase() === (staff.portalUser?.email ?? '').toLowerCase();
    return id === staff.employeeCode;
  }

  private identifierWhere(
    matchingKey: StaffBulkMatchingKey,
    values: string[],
  ): Prisma.StaffProfileWhereInput {
    if (matchingKey === 'staffId') return { id: { in: values } };
    if (matchingKey === 'shortCode') return { shortCode: { in: values } };
    if (matchingKey === 'portalEmail')
      return { portalUser: { email: { in: values } } };
    return { employeeCode: { in: values } };
  }

  private matchingHeader(matchingKey: StaffBulkMatchingKey) {
    if (matchingKey === 'shortCode') return 'Staff Short Code';
    if (matchingKey === 'portalEmail') return 'Portal Email';
    if (matchingKey === 'staffId') return 'Internal Staff ID';
    return 'Staff Code';
  }

  private matchingValue(
    staff: {
      id: string;
      employeeCode: string;
      shortCode: string | null;
      portalUser?: { email: string } | null;
    },
    matchingKey: StaffBulkMatchingKey,
  ) {
    if (matchingKey === 'staffId') return staff.id;
    if (matchingKey === 'shortCode') return staff.shortCode ?? '';
    if (matchingKey === 'portalEmail') return staff.portalUser?.email ?? '';
    return staff.employeeCode;
  }

  private templateFieldLabel(fieldKey: string) {
    const label = STAFF_BULK_UPDATE_FIELD_MAP.get(fieldKey)?.label ?? fieldKey;
    return label
      .replace(/^Staff\s+/i, '')
      .replace(/^Employment\s+/i, '')
      .trim();
  }

  private templateCurrentValue(
    staff: Awaited<
      ReturnType<StaffBulkUpdateService['loadTemplateStaffRows']>
    >[number],
    fieldKey: string,
  ) {
    switch (fieldKey) {
      case 'departmentId':
        return staff.department?.name ?? '';
      case 'designationId':
        return staff.designation?.label ?? '';
      case 'primaryShiftId':
        return staff.primaryShift?.name ?? staff.primaryShift?.code ?? '';
      case 'additionalRoleCodes':
        return staff.additionalRoles.map((role) => role.roleCode).join(', ');
      case 'portalEmail':
        return staff.portalUser?.email ?? '';
      case 'portalActive':
        return staff.portalUser?.isActive ? 'Active' : 'Inactive';
      case 'alternateEmail':
        return (
          serializeStaffBulkValue(
            this.readTemplateJsonField(staff.addressJson, 'alternateEmail'),
          ) ?? ''
        );
      case 'address':
      case 'city':
      case 'state':
      case 'postalCode':
        return (
          serializeStaffBulkValue(
            this.readTemplateJsonField(staff.addressJson, fieldKey),
          ) ?? ''
        );
      case 'teachingType':
      case 'eligibleSubjects':
      case 'researchRole':
      case 'facultyCategory':
        return (
          serializeStaffBulkValue(
            this.readTemplateJsonField(staff.attendanceDeviceMapping, fieldKey),
          ) ?? ''
        );
      default:
        return (
          serializeStaffBulkValue(
            (staff as unknown as Record<string, unknown>)[fieldKey],
          ) ?? ''
        );
    }
  }

  private readTemplateJsonField(
    json: Prisma.JsonValue | null,
    fieldKey: string,
  ) {
    return json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)[fieldKey]
      : null;
  }

  private async lookupDepartment(tenantId: string, value: string) {
    const row = await this.prisma.department.findFirst({
      where: {
        tenantId,
        OR: [
          { id: value },
          { code: { equals: value, mode: 'insensitive' } },
          { name: { equals: value, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown department: ${value}`);
    return row.id;
  }

  private async lookupDesignation(tenantId: string, value: string) {
    const row = await this.prisma.designation.findFirst({
      where: {
        tenantId,
        OR: [
          { id: value },
          { code: { equals: value, mode: 'insensitive' } },
          { label: { equals: value, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown designation: ${value}`);
    return row.id;
  }

  private async lookupShift(tenantId: string, value: string) {
    const row = await this.prisma.shift.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { id: value },
          { code: { equals: value, mode: 'insensitive' } },
          { name: { equals: value, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown shift: ${value}`);
    return row.id;
  }

  private cellToString(value: ExcelJS.CellValue) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object' && 'text' in value)
      return String(value.text ?? '').trim();
    if (typeof value === 'object' && 'result' in value)
      return String(value.result ?? '').trim();
    return String(value).trim();
  }

  private toJson(
    value: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) return Prisma.JsonNull;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value as Prisma.InputJsonValue;
  }
}
