import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  BUILTIN_REPORT_MAP,
  BUILTIN_STUDENT_REPORTS,
  type BuiltinReportKey,
} from '../domain/builtin-report-templates';
import {
  STUDENT_REPORT_FIELDS,
  resolveFieldLabels,
} from '../domain/student-report-field-registry';
import type {
  CreateSavedReportDto,
  ExecuteCustomReportDto,
  TabularReportExportDto,
  UpdateSavedReportDto,
} from '../dto/custom-report.dto';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import { StudentMasterAssemblerService } from './student-master-assembler.service';
import { StudentSubjectReportService } from './student-subject-report.service';
import { StudentTabularExportService } from './student-tabular-export.service';

@Injectable()
export class CustomReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterAssembler: StudentMasterAssemblerService,
    private readonly subjectReports: StudentSubjectReportService,
    private readonly tabularExport: StudentTabularExportService,
  ) {}

  listFieldRegistry(module = 'STUDENTS') {
    if (module !== 'STUDENTS') {
      throw new BadRequestException(`Unsupported report module: ${module}`);
    }
    return {
      module,
      groups: STUDENT_REPORT_FIELDS.reduce(
        (acc, field) => {
          if (!acc[field.group]) acc[field.group] = [];
          acc[field.group].push(field);
          return acc;
        },
        {} as Record<string, typeof STUDENT_REPORT_FIELDS>,
      ),
      fields: STUDENT_REPORT_FIELDS,
    };
  }

  listBuiltinTemplates() {
    return BUILTIN_STUDENT_REPORTS;
  }

  async listSavedReports(
    tenantId: string,
    userId: string,
    module = 'STUDENTS',
  ) {
    await this.ensureSystemTemplates(tenantId);
    const rows = await this.prisma.savedReport.findMany({
      where: { tenantId, module, deletedAt: null },
      include: {
        favorites: { where: { userId }, select: { id: true } },
      },
      orderBy: [{ isSystemTemplate: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.mapSavedReport(row, userId));
  }

  async createSavedReport(
    tenantId: string,
    userId: string,
    dto: CreateSavedReportDto,
  ) {
    const created = await this.prisma.savedReport.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        module: dto.module ?? 'STUDENTS',
        reportKind: 'CUSTOM',
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        columns: (dto.columns ?? []) as Prisma.InputJsonValue,
        sortBy: dto.sortBy,
        sortDirection: dto.sortDirection,
        groupBy: dto.groupBy,
      },
    });
    return this.mapSavedReport(created, userId);
  }

  async updateSavedReport(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateSavedReportDto,
  ) {
    const existing = await this.requireSavedReport(tenantId, id);
    if (existing.isSystemTemplate) {
      throw new BadRequestException('System templates cannot be edited');
    }
    const updated = await this.prisma.savedReport.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.filters !== undefined
          ? { filters: dto.filters as Prisma.InputJsonValue }
          : {}),
        ...(dto.columns !== undefined
          ? { columns: dto.columns as Prisma.InputJsonValue }
          : {}),
        ...(dto.sortBy !== undefined ? { sortBy: dto.sortBy } : {}),
        ...(dto.sortDirection !== undefined
          ? { sortDirection: dto.sortDirection }
          : {}),
        ...(dto.groupBy !== undefined ? { groupBy: dto.groupBy } : {}),
      },
    });
    return this.mapSavedReport(updated, userId);
  }

  async deleteSavedReport(tenantId: string, id: string) {
    const existing = await this.requireSavedReport(tenantId, id);
    if (existing.isSystemTemplate) {
      throw new BadRequestException('System templates cannot be deleted');
    }
    await this.prisma.savedReport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async toggleFavorite(tenantId: string, userId: string, id: string) {
    await this.requireSavedReport(tenantId, id);
    const existing = await this.prisma.savedReportFavorite.findUnique({
      where: { userId_savedReportId: { userId, savedReportId: id } },
    });
    if (existing) {
      await this.prisma.savedReportFavorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    }
    await this.prisma.savedReportFavorite.create({
      data: { tenantId, userId, savedReportId: id },
    });
    return { favorited: true };
  }

  async previewBuiltin(
    tenantId: string,
    key: BuiltinReportKey,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
    columns?: string[],
  ) {
    return this.runBuiltin(tenantId, key, filters, user, columns);
  }

  async exportBuiltin(
    tenantId: string,
    key: BuiltinReportKey,
    dto: TabularReportExportDto,
    user?: JwtUser,
  ) {
    const result = await this.runBuiltin(tenantId, key, dto, user, dto.columns);
    const template = BUILTIN_REPORT_MAP.get(key);
    const columnDefs =
      key === 'student-master'
        ? resolveFieldLabels(
            dto.columns?.length
              ? dto.columns
              : (result.columns as { key: string }[]).map((c) => c.key),
          )
        : (result.columns as { key: string; label: string }[]);

    const exportResult = await this.tabularExport.toBuffer(
      {
        sheetName: template?.name ?? key,
        columns: columnDefs,
        rows: result.rows as Record<string, unknown>[],
      },
      dto.format ?? 'xlsx',
    );
    return { ...exportResult, meta: result };
  }

  async executeCustom(
    tenantId: string,
    dto: ExecuteCustomReportDto,
    user?: JwtUser,
  ) {
    const filters = await this.applyOperationalFilters(tenantId, dto);
    const columns = dto.columns ?? [];
    if (!columns.length) {
      throw new BadRequestException('At least one column is required');
    }
    return this.masterAssembler.assemble(tenantId, filters, user, columns);
  }

  async exportCustom(
    tenantId: string,
    dto: ExecuteCustomReportDto,
    user?: JwtUser,
  ) {
    const result = await this.executeCustom(tenantId, dto, user);
    const columnDefs = resolveFieldLabels(
      dto.columns ?? (result.columns as { key: string }[]).map((c) => c.key),
    );
    const exportResult = await this.tabularExport.toBuffer(
      {
        sheetName: dto.name ?? 'Custom Student Report',
        columns: columnDefs,
        rows: result.rows as Record<string, unknown>[],
      },
      dto.format ?? 'xlsx',
    );
    return { ...exportResult, meta: result };
  }

  private async runBuiltin(
    tenantId: string,
    key: BuiltinReportKey,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
    columns?: string[],
  ) {
    const resolvedFilters = await this.applyOperationalFilters(
      tenantId,
      filters,
    );
    if (key === 'student-master') {
      const template = BUILTIN_REPORT_MAP.get(key);
      return this.masterAssembler.assemble(
        tenantId,
        resolvedFilters,
        user,
        columns?.length ? columns : template?.defaultColumns,
      );
    }
    if (key === 'subject-summary') {
      return this.subjectReports.subjectSummary(
        tenantId,
        resolvedFilters,
        user,
      );
    }
    if (key === 'subject-papers') {
      return this.subjectReports.subjectPapers(tenantId, resolvedFilters, user);
    }
    throw new BadRequestException(`Unknown built-in report: ${key}`);
  }

  private async applyOperationalFilters(
    tenantId: string,
    filters: StudentReportFiltersDto,
  ): Promise<StudentReportFiltersDto> {
    return filters;
  }

  private async ensureSystemTemplates(tenantId: string) {
    for (const template of BUILTIN_STUDENT_REPORTS) {
      const existing = await this.prisma.savedReport.findFirst({
        where: {
          tenantId,
          builtinKey: template.key,
          isSystemTemplate: true,
          deletedAt: null,
        },
      });
      if (existing) continue;
      await this.prisma.savedReport.create({
        data: {
          tenantId,
          name: template.name,
          module: template.module,
          reportKind: 'BUILTIN',
          builtinKey: template.key,
          isSystemTemplate: true,
          filters: {},
          columns: template.defaultColumns,
        },
      });
    }
  }

  private async requireSavedReport(tenantId: string, id: string) {
    const row = await this.prisma.savedReport.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Saved report not found');
    return row;
  }

  private mapSavedReport(
    row: {
      id: string;
      name: string;
      module: string;
      reportKind: string;
      builtinKey: string | null;
      isSystemTemplate: boolean;
      filters: unknown;
      columns: unknown;
      sortBy: string | null;
      sortDirection: string | null;
      groupBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      favorites?: { id: string }[];
    },
    userId: string,
  ) {
    return {
      id: row.id,
      name: row.name,
      module: row.module,
      reportKind: row.reportKind,
      builtinKey: row.builtinKey,
      isSystemTemplate: row.isSystemTemplate,
      filters: row.filters,
      columns: row.columns,
      sortBy: row.sortBy,
      sortDirection: row.sortDirection,
      groupBy: row.groupBy,
      isFavorite: Boolean(row.favorites?.length),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
