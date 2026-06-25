import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

type ExportRow = Record<string, unknown>;

@Injectable()
export class AttendanceExportService {
  buildCsv(title: string, rows: ExportRow[]) {
    const normalized = this.normalizeRows(rows);
    if (!normalized.length) {
      return `${this.escapeCsv(title)}\nNo records for the selected period.\n`;
    }
    const headers = Object.keys(normalized[0] ?? {});
    const lines = [
      this.escapeCsv(title),
      headers.map((h) => this.escapeCsv(this.headerLabel(h))).join(','),
      ...normalized.map((row) =>
        headers
          .map((header) => this.escapeCsv(this.cellValue(row[header])))
          .join(','),
      ),
    ];
    return `${lines.join('\n')}\n`;
  }

  async buildExcel(
    title: string,
    rows: ExportRow[],
    summary?: Record<string, unknown>,
  ) {
    const normalized = this.normalizeRows(rows);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OneCampus ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Report');
    sheet.mergeCells(
      1,
      1,
      1,
      Math.max(6, normalized[0] ? Object.keys(normalized[0]).length : 6),
    );
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 14 };
    sheet.getCell(2, 1).value = `Generated: ${new Date().toLocaleString()}`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: '666666' } };

    let rowIndex = 4;
    if (summary && Object.keys(summary).length) {
      sheet.getCell(rowIndex, 1).value = 'Summary';
      sheet.getCell(rowIndex, 1).font = { bold: true };
      rowIndex += 1;
      for (const [key, value] of Object.entries(summary)) {
        sheet.getCell(rowIndex, 1).value = this.headerLabel(key);
        sheet.getCell(rowIndex, 2).value = String(this.cellValue(value));
        rowIndex += 1;
      }
      rowIndex += 1;
    }

    if (!normalized.length) {
      sheet.getCell(rowIndex, 1).value = 'No records for the selected period.';
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    const headers = Object.keys(normalized[0] ?? {});
    sheet.getRow(rowIndex).values = headers.map((h) => this.headerLabel(h));
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex += 1;

    for (const row of normalized) {
      sheet.getRow(rowIndex).values = headers.map((header) =>
        String(this.cellValue(row[header])),
      );
      rowIndex += 1;
    }

    sheet.columns.forEach((column) => {
      let max = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const length = String(cell.value ?? '').length;
        if (length > max) max = Math.min(length + 2, 40);
      });
      column.width = max;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private normalizeRows(rows: ExportRow[]) {
    return rows.map((row) => this.flattenRow(row));
  }

  private flattenRow(row: ExportRow): ExportRow {
    const staff = row.staff as Record<string, unknown> | undefined;
    const device = row.device as Record<string, unknown> | undefined;
    const department =
      (staff?.department as { name?: string } | undefined)?.name ??
      row.department ??
      '';
    const shift =
      (staff?.primaryShift as { name?: string } | undefined)?.name ??
      row.shift ??
      '';

    return {
      employeeCode: staff?.employeeCode ?? row.employeeCode ?? '',
      staffName: staff?.fullName ?? row.fullName ?? row.name ?? '',
      department,
      shift,
      attendanceDate: this.formatDate(row.attendanceDate ?? row.date),
      punchTimestamp: this.formatDateTime(row.punchTimestamp),
      firstInAt: this.formatDateTime(row.firstInAt ?? row.in),
      lastOutAt: this.formatDateTime(row.lastOutAt ?? row.out),
      workedMinutes: row.workedMinutes ?? '',
      lateMinutes: row.lateMinutes ?? '',
      earlyMinutes: row.earlyMinutes ?? '',
      overtimeMinutes: row.overtimeMinutes ?? '',
      status: row.status ?? '',
      deviceName: device?.name ?? row.deviceName ?? '',
      deviceUserId: row.deviceUserId ?? '',
      correctionType: row.correctionType ?? '',
      reason: row.reason ?? '',
      networkStatus: row.networkStatus ?? '',
      syncHealthStatus: row.syncHealthStatus ?? '',
      ipAddress: row.ipAddress ?? '',
      lastSyncAt: this.formatDateTime(row.lastSyncAt),
    };
  }

  private headerLabel(key: string) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  }

  private cellValue(value: unknown) {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return value;
  }

  private formatDate(value: unknown) {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
  }

  private formatDateTime(value: unknown) {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  private escapeCsv(value: unknown) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }
}
