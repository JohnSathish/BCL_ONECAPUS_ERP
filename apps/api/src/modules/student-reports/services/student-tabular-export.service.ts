import { Injectable } from '@nestjs/common';
import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import { resolveFieldLabels } from '../domain/student-report-field-registry';

export type TabularColumn = { key: string; label: string };

export type TabularExportInput = {
  sheetName: string;
  columns: TabularColumn[];
  rows: Record<string, unknown>[];
};

@Injectable()
export class StudentTabularExportService {
  async toBuffer(
    input: TabularExportInput,
    format: 'xlsx' | 'csv',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const headers = input.columns.map((c) => c.label);
    const dataRows = input.rows.map((row) =>
      input.columns.map((col) => this.cellValue(row[col.key])),
    );

    if (format === 'csv') {
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
        filename: `${this.slug(input.sheetName)}.csv`,
      };
    }

    const buffer = await createWorkbookWithSheets([
      {
        name: input.sheetName.slice(0, 31),
        headers,
        rows: dataRows,
      },
    ]);
    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${this.slug(input.sheetName)}.xlsx`,
    };
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

  private cellValue(value: unknown): string | number {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') return value;
    return String(value);
  }

  private csvEscape(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private slug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
