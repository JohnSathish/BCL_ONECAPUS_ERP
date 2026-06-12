import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AdminAuditHelper } from '../administration/admin-audit.helper';
import { AcademicRoleAdapter } from './adapters/academic-role.adapter';
import { BoardSubjectAdapter } from './adapters/board-subject.adapter';
import { DepartmentAdapter } from './adapters/department.adapter';
import { DesignationAdapter } from './adapters/designation.adapter';
import { LookupAdapter } from './adapters/lookup.adapter';
import { ShiftAdapter } from './adapters/shift.adapter';
import { getCategoryDef, listCategories } from './support-data.registry';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from './support-data.types';

@Injectable()
export class SupportDataService {
  constructor(
    private readonly lookup: LookupAdapter,
    private readonly departments: DepartmentAdapter,
    private readonly designations: DesignationAdapter,
    private readonly academicRoles: AcademicRoleAdapter,
    private readonly shifts: ShiftAdapter,
    private readonly boardSubjects: BoardSubjectAdapter,
    private readonly audit: AdminAuditHelper,
  ) {}

  getCategories(group?: string) {
    return listCategories(group);
  }

  getCategory(category: string) {
    const def = getCategoryDef(category);
    if (!def) throw new NotFoundException(`Unknown category: ${category}`);
    return def;
  }

  private parseQuery(query: {
    q?: string;
    activeOnly?: string;
    campusId?: string;
    institutionId?: string;
  }): SupportDataListQuery {
    return {
      q: query.q,
      activeOnly: query.activeOnly !== 'false',
      campusId: query.campusId,
      institutionId: query.institutionId,
    };
  }

  async list(
    tenantId: string,
    category: string,
    query: {
      q?: string;
      activeOnly?: string;
      campusId?: string;
      institutionId?: string;
    },
  ): Promise<SupportDataRow[]> {
    const def = this.getCategory(category);
    const parsed = this.parseQuery(query);

    switch (category) {
      case 'departments':
        return this.departments.list(tenantId, parsed);
      case 'designations':
        return this.designations.list(tenantId, parsed);
      case 'additional-roles':
        return this.academicRoles.list(tenantId, parsed);
      case 'shifts':
        return this.shifts.list(tenantId, parsed);
      case 'board-subjects':
        return this.boardSubjects.list(tenantId, parsed);
      default:
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.list(tenantId, def.lookupType, parsed);
    }
  }

  async create(
    tenantId: string,
    category: string,
    data: Record<string, unknown>,
    actorUserId?: string,
  ) {
    const def = this.getCategory(category);
    switch (category) {
      case 'departments':
        return this.departments.create(tenantId, data, actorUserId);
      case 'designations':
        return this.designations.create(tenantId, data, actorUserId);
      case 'additional-roles':
        return this.academicRoles.create(tenantId, data, actorUserId);
      case 'shifts':
        return this.shifts.create(tenantId, data, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.create(tenantId, data, actorUserId);
      default:
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.create(
          tenantId,
          def.lookupType,
          category,
          data,
          actorUserId,
        );
    }
  }

  async update(
    tenantId: string,
    category: string,
    id: string,
    data: Record<string, unknown>,
    actorUserId?: string,
  ) {
    const def = this.getCategory(category);
    switch (category) {
      case 'departments':
        return this.departments.update(tenantId, id, data, actorUserId);
      case 'designations':
        return this.designations.update(tenantId, id, data, actorUserId);
      case 'additional-roles':
        return this.academicRoles.update(tenantId, id, data, actorUserId);
      case 'shifts':
        return this.shifts.update(tenantId, id, data, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.update(tenantId, id, data, actorUserId);
      default:
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.update(
          tenantId,
          def.lookupType,
          category,
          id,
          data,
          actorUserId,
        );
    }
  }

  async setStatus(
    tenantId: string,
    category: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ) {
    switch (category) {
      case 'departments':
        return this.departments.setStatus(tenantId, id, isActive, actorUserId);
      case 'designations':
        return this.designations.setStatus(tenantId, id, isActive, actorUserId);
      case 'additional-roles':
        return this.academicRoles.setStatus(
          tenantId,
          id,
          isActive,
          actorUserId,
        );
      case 'shifts':
        return this.shifts.setStatus(tenantId, id, isActive, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.setStatus(
          tenantId,
          id,
          isActive,
          actorUserId,
        );
      default: {
        const def = this.getCategory(category);
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.setStatus(
          tenantId,
          def.lookupType,
          category,
          id,
          isActive,
          actorUserId,
        );
      }
    }
  }

  async archive(
    tenantId: string,
    category: string,
    id: string,
    actorUserId?: string,
  ) {
    switch (category) {
      case 'departments':
        return this.departments.archive(tenantId, id, actorUserId);
      case 'designations':
        return this.designations.archive(tenantId, id, actorUserId);
      case 'additional-roles':
        return this.academicRoles.archive(tenantId, id, actorUserId);
      case 'shifts':
        return this.shifts.archive(tenantId, id, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.archive(tenantId, id, actorUserId);
      default: {
        const def = this.getCategory(category);
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.archive(
          tenantId,
          def.lookupType,
          category,
          id,
          actorUserId,
        );
      }
    }
  }

  async restore(
    tenantId: string,
    category: string,
    id: string,
    actorUserId?: string,
  ) {
    switch (category) {
      case 'departments':
        return this.departments.restore(tenantId, id, actorUserId);
      case 'designations':
        return this.designations.restore(tenantId, id, actorUserId);
      case 'additional-roles':
        return this.academicRoles.restore(tenantId, id, actorUserId);
      case 'shifts':
        return this.shifts.restore(tenantId, id, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.restore(tenantId, id, actorUserId);
      default: {
        const def = this.getCategory(category);
        if (def.source !== 'lookup' || !def.lookupType) {
          throw new NotFoundException(`Unknown category: ${category}`);
        }
        return this.lookup.restore(
          tenantId,
          def.lookupType,
          category,
          id,
          actorUserId,
        );
      }
    }
  }

  async reorder(
    tenantId: string,
    category: string,
    ids: string[],
    actorUserId?: string,
  ) {
    switch (category) {
      case 'designations':
        return this.designations.reorder(tenantId, ids, actorUserId);
      case 'additional-roles':
        return this.academicRoles.reorder(tenantId, ids, actorUserId);
      case 'shifts':
        return this.shifts.reorder(tenantId, ids, actorUserId);
      case 'board-subjects':
        return this.boardSubjects.reorder(tenantId, ids, actorUserId);
      default: {
        const def = this.getCategory(category);
        if (def.source === 'lookup' && def.lookupType) {
          return this.lookup.reorder(
            tenantId,
            def.lookupType,
            category,
            ids,
            actorUserId,
          );
        }
        throw new BadRequestException(
          'Reorder not supported for this category',
        );
      }
    }
  }

  async exportExcel(
    tenantId: string,
    category: string,
    query: { q?: string; activeOnly?: string },
  ): Promise<Buffer> {
    const rows = await this.list(tenantId, category, {
      ...query,
      activeOnly: 'false',
    });
    const def = this.getCategory(category);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(def.label);
    const headers = ['Code', 'Label', 'Sort Order', 'Active'];
    for (const field of def.fields) {
      if (!['code', 'label', 'sortOrder', 'status'].includes(field.key)) {
        headers.push(field.label);
      }
    }
    sheet.addRow(headers);
    for (const row of rows) {
      const cells: (string | number | boolean)[] = [
        row.code,
        row.label,
        row.sortOrder,
        row.isActive,
      ];
      for (const field of def.fields) {
        if (!['code', 'label', 'sortOrder', 'status'].includes(field.key)) {
          cells.push(String(row.metadata?.[field.key] ?? ''));
        }
      }
      sheet.addRow(cells);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async validateImport(tenantId: string, category: string, fileBuffer: Buffer) {
    const def = this.getCategory(category);
    if (!def.features.import) {
      throw new BadRequestException('Import not supported for this category');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Empty spreadsheet');

    const rows: Record<string, unknown>[] = [];
    const errors: { row: number; message: string }[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = String(row.getCell(1).value ?? '').trim();
      const label = String(row.getCell(2).value ?? '').trim();
      if (!code && !label) return;
      if (!code || !label) {
        errors.push({ row: rowNumber, message: 'Code and label are required' });
        return;
      }
      const payload: Record<string, unknown> = {
        code,
        label,
        sortOrder: Number(row.getCell(3).value ?? 0),
        isActive:
          row.getCell(4).value !== false && row.getCell(4).value !== 'false',
      };
      const extraFields = def.fields.filter(
        (field) =>
          !['code', 'label', 'sortOrder', 'status'].includes(field.key),
      );
      extraFields.forEach((field, index) => {
        const value = row.getCell(5 + index).value;
        if (value !== null && value !== undefined && String(value).trim()) {
          payload[field.key] = String(value).trim();
        }
      });
      rows.push(payload);
    });

    return { valid: errors.length === 0, rows, errors, total: rows.length };
  }

  async commitImport(
    tenantId: string,
    category: string,
    rows: Record<string, unknown>[],
    actorUserId?: string,
  ) {
    const created: SupportDataRow[] = [];
    const failed: { code: string; error: string }[] = [];
    for (const row of rows) {
      try {
        const result = await this.create(tenantId, category, row, actorUserId);
        created.push(result);
      } catch (err) {
        failed.push({
          code: String(row.code ?? ''),
          error: err instanceof Error ? err.message : 'Failed',
        });
      }
    }
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'import',
      entityType: category,
      metadata: { created: created.length, failed: failed.length },
    });
    return { created: created.length, failed };
  }
}
