import { Injectable } from '@nestjs/common';
import {
  buildInstitutionalExcelReport,
  type InstitutionalReportMeta,
} from '../../../common/reports/institutional-excel-report.engine';
import { PrismaService } from '../../../database/prisma.service';
import { resolveFieldLabels } from '../domain/student-report-field-registry';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';

export type TabularColumn = { key: string; label: string };

export type TabularExportInput = {
  sheetName: string;
  columns: TabularColumn[];
  rows: Record<string, unknown>[];
  tenantId?: string;
  generatedBy?: string;
  filters?: StudentReportFiltersDto;
  reportTitle?: string;
  reportIcon?: string;
};

@Injectable()
export class StudentTabularExportService {
  constructor(private readonly prisma: PrismaService) {}

  async toBuffer(
    input: TabularExportInput,
    format: 'xlsx' | 'csv',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const reportTitle =
      input.reportTitle?.trim() || input.sheetName || 'Student Report';

    if (format === 'csv') {
      const headers = input.columns.map((c) => c.label);
      const dataRows = input.rows.map((row) =>
        input.columns.map((col) => this.cellValue(row[col.key])),
      );
      const lines = [
        headers.map((h) => this.csvEscape(h)).join(','),
        ...dataRows.map((row) =>
          row.map((v) => this.csvEscape(String(v ?? ''))).join(','),
        ),
      ];
      const buffer = Buffer.from(lines.join('\n'), 'utf8');
      return {
        buffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `${this.slug(reportTitle)}.csv`,
      };
    }

    const meta = await this.buildMeta(input, reportTitle);
    return buildInstitutionalExcelReport({
      meta,
      filenameBase: reportTitle,
      sheets: [
        {
          name: 'Student Register',
          columns: input.columns,
          rows: input.rows,
        },
        {
          name: 'Summary',
          columns: [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ],
          rows: Object.entries(meta.summary ?? {}).map(([metric, value]) => ({
            metric,
            value,
          })),
        },
      ],
    });
  }

  pickColumns(
    allKeys: string[],
    selected?: string[],
    labelResolver?: (key: string) => string,
  ): TabularColumn[] {
    const keys = selected?.length ? selected : allKeys;
    const resolved = resolveFieldLabels(keys);
    return resolved.map((col) => ({
      key: col.key,
      label: labelResolver ? labelResolver(col.key) : col.label,
    }));
  }

  private async buildMeta(
    input: TabularExportInput,
    reportTitle: string,
  ): Promise<InstitutionalReportMeta> {
    const tenantId = input.tenantId;
    let institutionName = 'Don Bosco College, Tura';
    if (tenantId) {
      const [tenant, branding] = await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        }),
        this.prisma.tenantBranding.findUnique({
          where: { tenantId },
          select: { displayName: true },
        }),
      ]);
      institutionName =
        branding?.displayName ?? tenant?.name ?? institutionName;
    }

    const filterLines = await this.resolveFilterLines(tenantId, input.filters);
    const summary = this.buildSummary(input.rows);

    return {
      institutionName,
      institutionTagline: 'Affiliated to NEHU | NAAC Accredited | Meghalaya',
      productName: 'BCL OneCampus ERP',
      reportTitle,
      reportIcon: '🎓',
      academicYear: filterLines.academicYear,
      semester: filterLines.semester,
      programme: filterLines.programme,
      department: filterLines.department,
      shift: filterLines.shift,
      generatedBy: input.generatedBy ?? 'Admin',
      generatedAt: new Date(),
      summary,
      author: 'BCL OneCampus ERP',
      company: 'BaseCode Labs Pvt. Ltd.',
      filterLines: filterLines.extra,
    };
  }

  private buildSummary(rows: Record<string, unknown>[]) {
    const summary: Record<string, string | number> = {
      Students: rows.length,
    };
    let male = 0;
    let female = 0;
    const departments = new Set<string>();
    const semesters = new Set<string>();
    for (const row of rows) {
      const gender = String(row.gender ?? '')
        .trim()
        .toUpperCase();
      if (gender === 'MALE' || gender === 'M') male += 1;
      if (gender === 'FEMALE' || gender === 'F') female += 1;
      const dept = String(row.department ?? row.majorDepartment ?? '').trim();
      if (dept) departments.add(dept);
      const sem = String(row.currentSemester ?? '').trim();
      if (sem) semesters.add(sem);
    }
    if (male || female) {
      summary.Male = male;
      summary.Female = female;
    }
    if (departments.size) summary.Departments = departments.size;
    if (semesters.size === 1) {
      summary.Semester = [...semesters][0]!;
    }
    return summary;
  }

  private async resolveFilterLines(
    tenantId: string | undefined,
    filters?: StudentReportFiltersDto,
  ) {
    const result: {
      academicYear?: string;
      semester?: string;
      programme?: string;
      department?: string;
      shift?: string;
      extra: Array<{ label: string; value: string }>;
    } = { extra: [] };

    if (!filters || !tenantId) return result;

    if (filters.semester != null) {
      result.semester = `Sem ${filters.semester}`;
    }

    const [programme, department, shift, batch] = await Promise.all([
      filters.programVersionId
        ? this.prisma.programVersion.findFirst({
            where: { id: filters.programVersionId, tenantId },
            select: { program: { select: { name: true } } },
          })
        : null,
      filters.departmentId
        ? this.prisma.department.findFirst({
            where: { id: filters.departmentId, tenantId },
            select: { name: true },
          })
        : null,
      filters.shiftId
        ? this.prisma.shift.findFirst({
            where: { id: filters.shiftId, tenantId },
            select: { name: true },
          })
        : null,
      filters.batchId
        ? this.prisma.admissionBatch.findFirst({
            where: { id: filters.batchId, tenantId },
            select: {
              batchCode: true,
              admissionYear: true,
              entrySession: { select: { name: true } },
            },
          })
        : null,
    ]);

    if (programme?.program?.name) result.programme = programme.program.name;
    if (department?.name) result.department = department.name;
    if (shift?.name) result.shift = shift.name;
    if (batch?.entrySession?.name) {
      result.academicYear = batch.entrySession.name;
    } else if (batch?.admissionYear) {
      result.academicYear = `${batch.admissionYear}-${String(batch.admissionYear + 1).slice(-2)}`;
    }
    if (batch?.batchCode) {
      result.extra.push({ label: 'Batch', value: batch.batchCode });
    }
    if (filters.studentStatus) {
      result.extra.push({ label: 'Status', value: filters.studentStatus });
    }
    if (filters.gender) {
      result.extra.push({ label: 'Gender', value: filters.gender });
    }

    return result;
  }

  private cellValue(value: unknown): string | number {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return this.formatDateOnly(value);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const dateOnly = this.asDateOnlyString(value);
      if (dateOnly) return dateOnly;
    }
    return String(value);
  }

  private formatDateOnly(value: Date): string {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private asDateOnlyString(value: string): string | null {
    const trimmed = value.trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
    if (!iso) return null;
    return iso[1];
  }

  private csvEscape(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private slug(name: string) {
    const slug = name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || 'student-report';
  }
}
