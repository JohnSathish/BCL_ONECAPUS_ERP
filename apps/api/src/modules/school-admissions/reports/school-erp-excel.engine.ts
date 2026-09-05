import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import {
  SCHOOL_ERP_EXCEL_THEME,
  formatSchoolErpGeneratedAt,
  schoolErpReportFilename,
  schoolErpStatusFill,
  schoolErpThinBorder,
  type SchoolErpExcelColumn,
  type SchoolErpExcelMeta,
  type SchoolErpStatPair,
} from './school-erp-excel.theme';

export type SchoolErpWorkbookResult = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

function resolveSchoolLogoPath(): string | null {
  const candidates = [
    join(__dirname, '..', 'assets', 'tps-logo.png'),
    join(process.cwd(), 'src/modules/school-admissions/assets/tps-logo.png'),
    join(process.cwd(), 'dist/modules/school-admissions/assets/tps-logo.png'),
    join(
      process.cwd(),
      'apps/api/src/modules/school-admissions/assets/tps-logo.png',
    ),
    join(process.cwd(), '../web/public/school-admissions/tps-logo.png'),
    join(process.cwd(), 'apps/web/public/school-admissions/tps-logo.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function createSchoolErpWorkbook(
  meta: SchoolErpExcelMeta,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = meta.generatedAt ?? new Date();
  workbook.creator = 'Tura Public School ERP';
  workbook.lastModifiedBy = meta.generatedBy ?? 'School Administration';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.company = meta.schoolName;
  workbook.title = meta.reportTitle;
  workbook.subject = `${meta.schoolName} — ${meta.reportTitle}`;
  workbook.description = meta.subtitle ?? meta.sessionLabel ?? '';
  return workbook;
}

export async function finalizeSchoolErpWorkbook(
  workbook: ExcelJS.Workbook,
  meta: SchoolErpExcelMeta,
): Promise<SchoolErpWorkbookResult> {
  const generatedAt = meta.generatedAt ?? new Date();
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    filename: schoolErpReportFilename(meta.filenameBase, generatedAt),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export function applySchoolErpPrintSetup(
  sheet: ExcelJS.Worksheet,
  meta: SchoolErpExcelMeta,
  opts?: {
    fitToWidth?: number;
    orientation?: 'landscape' | 'portrait';
    /** When false, avoid forcing all columns onto one page (keeps text readable). */
    fitToPage?: boolean;
  },
) {
  const fitToPage = opts?.fitToPage ?? Boolean(opts?.fitToWidth);
  sheet.pageSetup = {
    orientation: opts?.orientation ?? 'landscape',
    fitToPage,
    fitToWidth: fitToPage ? (opts?.fitToWidth ?? 1) : undefined,
    fitToHeight: fitToPage ? 0 : undefined,
    paperSize: 9,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };
  const left =
    meta.printHeaderLeft ??
    `${meta.schoolName}${meta.schoolLocation ? `, ${meta.schoolLocation}` : ''}`;
  const center =
    meta.printHeaderCenter ??
    meta.moduleLabel ??
    meta.sessionLabel ??
    meta.reportTitle;
  sheet.headerFooter = {
    oddHeader: `&L${left}&C${center}`,
    oddFooter: `&LConfidential — School Administration Use&CPage &P of &N&RGenerated ${formatSchoolErpGeneratedAt(meta.generatedAt ?? new Date())}`,
  };
}

async function embedLogo(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  const logoPath = resolveSchoolLogoPath();
  if (!logoPath) return;
  const imageId = workbook.addImage({
    buffer: readFileSync(logoPath) as unknown as ExcelJS.Buffer,
    extension: 'png',
  });
  sheet.addImage(imageId, {
    tl: { col: 0.15, row: 0.2 },
    ext: { width: 58, height: 72 },
  });
}

/**
 * Brand header block used across School ERP Excel reports.
 * Returns the next free row index (1-based) after the header.
 */
export async function writeSchoolErpReportHeader(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  meta: SchoolErpExcelMeta,
  opts?: {
    mergeThroughCol?: number;
    totalApplications?: number;
    extraLines?: SchoolErpStatPair[];
  },
): Promise<number> {
  const mergeThrough = Math.max(opts?.mergeThroughCol ?? 6, 4);
  await embedLogo(workbook, sheet);

  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 16;

  const title = sheet.getCell(1, 2);
  title.value = `${meta.schoolName.toUpperCase()}${
    meta.schoolLocation ? `, ${meta.schoolLocation.toUpperCase()}` : ''
  }`;
  title.font = {
    bold: true,
    size: 16,
    color: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
    name: 'Calibri',
  };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.mergeCells(1, 2, 1, mergeThrough);

  const session = sheet.getCell(2, 2);
  session.value = meta.sessionLabel ?? meta.subtitle ?? '';
  session.font = {
    bold: true,
    size: 12,
    color: { argb: SCHOOL_ERP_EXCEL_THEME.primaryDeep },
  };
  sheet.mergeCells(2, 2, 2, mergeThrough);

  const report = sheet.getCell(3, 2);
  report.value = meta.reportTitle;
  report.font = {
    bold: true,
    size: 13,
    color: { argb: SCHOOL_ERP_EXCEL_THEME.text },
  };
  sheet.mergeCells(3, 2, 3, mergeThrough);

  const generatedAt = meta.generatedAt ?? new Date();
  const metaLine = sheet.getCell(4, 2);
  const bits = [`Generated On: ${formatSchoolErpGeneratedAt(generatedAt)}`];
  if (opts?.totalApplications != null) {
    bits.push(`Total Applications: ${opts.totalApplications}`);
  }
  if (meta.generatedBy) bits.push(`Generated By: ${meta.generatedBy}`);
  metaLine.value = bits.join('   ·   ');
  metaLine.font = { size: 10, color: { argb: SCHOOL_ERP_EXCEL_THEME.muted } };
  sheet.mergeCells(4, 2, 4, mergeThrough);

  let row = 6;
  for (const line of opts?.extraLines ?? []) {
    sheet.getCell(row, 2).value = line.label;
    sheet.getCell(row, 2).font = { bold: true, size: 10 };
    sheet.getCell(row, 3).value = line.value;
    sheet.getCell(row, 3).font = {
      bold: true,
      size: 10,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
    };
    row += 1;
  }

  return row + (opts?.extraLines?.length ? 1 : 0);
}

export function writeSchoolErpStatCards(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  stats: SchoolErpStatPair[],
  perRow = 4,
): number {
  let row = startRow;
  let col = startCol;
  for (let i = 0; i < stats.length; i++) {
    const labelCell = sheet.getCell(row, col);
    const valueCell = sheet.getCell(row + 1, col);
    labelCell.value = stats[i].label;
    labelCell.font = {
      size: 9,
      bold: true,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.muted },
    };
    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.softGold },
    };
    labelCell.border = schoolErpThinBorder();
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    valueCell.value = stats[i].value;
    valueCell.font = {
      size: 14,
      bold: true,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
    };
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
    valueCell.border = schoolErpThinBorder();
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getColumn(col).width = Math.max(sheet.getColumn(col).width ?? 12, 16);

    col += 1;
    if ((i + 1) % perRow === 0) {
      row += 3;
      col = startCol;
    }
  }
  if (stats.length % perRow !== 0) row += 3;
  return row + 1;
}

export function writeSchoolErpKeyValueTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  rows: SchoolErpStatPair[],
  startCol = 1,
): number {
  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = title;
  titleCell.font = {
    bold: true,
    size: 11,
    color: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
  };
  sheet.mergeCells(startRow, startCol, startRow, startCol + 1);

  const headerRow = startRow + 1;
  sheet.getCell(headerRow, startCol).value = 'Item';
  sheet.getCell(headerRow, startCol + 1).value = 'Count';
  for (const c of [startCol, startCol + 1]) {
    const cell = sheet.getCell(headerRow, c);
    cell.font = {
      bold: true,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.headerFg },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
    };
    cell.border = schoolErpThinBorder();
    cell.alignment = { horizontal: 'center' };
  }

  rows.forEach((item, index) => {
    const r = headerRow + 1 + index;
    const label = sheet.getCell(r, startCol);
    const value = sheet.getCell(r, startCol + 1);
    label.value = item.label;
    value.value = item.value;
    label.border = schoolErpThinBorder();
    value.border = schoolErpThinBorder();
    value.alignment = { horizontal: 'center' };
    if (index % 2 === 1) {
      label.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.zebra },
      };
      value.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.zebra },
      };
    }
  });

  sheet.getColumn(startCol).width = Math.max(
    sheet.getColumn(startCol).width ?? 18,
    28,
  );
  sheet.getColumn(startCol + 1).width = Math.max(
    sheet.getColumn(startCol + 1).width ?? 10,
    12,
  );

  return headerRow + rows.length + 2;
}

function parseToDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    // Local calendar date avoids Excel timezone shifting DOB by one day.
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function writeTypedCell(
  cell: ExcelJS.Cell,
  value: unknown,
  column: SchoolErpExcelColumn,
) {
  const type = column.type ?? 'text';
  cell.border = schoolErpThinBorder();
  cell.alignment = {
    vertical: 'top',
    horizontal:
      column.align ??
      (type === 'number' || type === 'currency'
        ? 'right'
        : type === 'date' ||
            type === 'datetime' ||
            type === 'boolean' ||
            type === 'status'
          ? 'center'
          : 'left'),
    wrapText: Boolean(column.wrap),
  };
  cell.font = {
    size: 10,
    name: 'Calibri',
    color: { argb: SCHOOL_ERP_EXCEL_THEME.text },
  };

  if (value == null || value === '') {
    cell.value = '';
    return;
  }

  if (type === 'boolean') {
    cell.value =
      value === true || value === 'Yes' || value === 'yes' || value === 1
        ? 'Yes'
        : value === false || value === 'No' || value === 'no' || value === 0
          ? 'No'
          : String(value);
    return;
  }

  if (type === 'date') {
    const date = parseToDate(value);
    if (date) {
      cell.value = date;
      cell.numFmt = 'DD-MM-YYYY';
    } else {
      cell.value = String(value);
    }
    return;
  }

  if (type === 'datetime') {
    const date = parseToDate(value);
    if (date) {
      cell.value = date;
      cell.numFmt = 'DD-MM-YYYY hh:mm AM/PM';
    } else {
      cell.value = String(value);
    }
    return;
  }

  if (type === 'number' || type === 'currency') {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(num)) {
      cell.value = num;
      cell.numFmt = type === 'currency' ? '₹#,##0.00' : '0';
    } else {
      cell.value = String(value);
    }
    return;
  }

  if (type === 'phone' || type === 'code') {
    cell.value = String(value);
    cell.numFmt = '@';
    return;
  }

  if (type === 'status') {
    const text = String(value);
    cell.value = text;
    const fill = schoolErpStatusFill(text);
    if (fill) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      };
      cell.font = {
        size: 10,
        bold: true,
        name: 'Calibri',
        color: { argb: SCHOOL_ERP_EXCEL_THEME.text },
      };
    }
    return;
  }

  cell.value = String(value);
}

/**
 * Writes a professional data table with Excel Table features, freeze panes,
 * status colouring, and print title rows. Reusable for future School ERP modules.
 */
export function writeSchoolErpDataTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columns: SchoolErpExcelColumn[],
  rows: Array<Record<string, unknown>>,
  opts?: {
    tableName: string;
    freezeFirstColumn?: boolean;
    emptyMessage?: string;
  },
): number {
  const headerRow = startRow;
  columns.forEach((col, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = col.header;
    cell.font = {
      bold: true,
      size: 10,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.headerFg },
      name: 'Calibri',
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.primary },
    };
    cell.border = schoolErpThinBorder();
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    sheet.getColumn(index + 1).width =
      col.width ?? Math.min(Math.max(col.header.length + 4, 12), 42);
  });
  sheet.getRow(headerRow).height = 32;

  if (!rows.length) {
    const empty = sheet.getCell(headerRow + 1, 1);
    empty.value = opts?.emptyMessage ?? 'No records found.';
    empty.font = {
      italic: true,
      color: { argb: SCHOOL_ERP_EXCEL_THEME.muted },
    };
    sheet.mergeCells(headerRow + 1, 1, headerRow + 1, columns.length);
    sheet.views = [
      {
        state: 'frozen',
        xSplit: opts?.freezeFirstColumn ? 1 : 0,
        ySplit: headerRow,
      },
    ];
    sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
    return headerRow + 2;
  }

  rows.forEach((row, rowIndex) => {
    const excelRow = headerRow + 1 + rowIndex;
    columns.forEach((col, colIndex) => {
      const cell = sheet.getCell(excelRow, colIndex + 1);
      writeTypedCell(cell, row[col.key], col);
      if (col.type !== 'status' && rowIndex % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: SCHOOL_ERP_EXCEL_THEME.zebra },
        };
      }
    });
    sheet.getRow(excelRow).height = 18;
  });

  const lastRow = headerRow + rows.length;
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: lastRow, column: columns.length },
  };

  sheet.views = [
    {
      state: 'frozen',
      xSplit: opts?.freezeFirstColumn ? 1 : 0,
      ySplit: headerRow,
    },
  ];
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  return lastRow + 2;
}
