import ExcelJS from 'exceljs';
import { mapRowHeaders } from './import-column-map';
import type { ParsedImportRow } from './import.types';

const DATA_SHEET_NAME = 'Courses';
const INSTRUCTIONS_SHEET_NAME = 'Instructions';

export async function parseExcelDataSheet(
  buffer: Buffer,
  options?: { sheetName?: string; dataStartRow?: number } | string,
): Promise<ParsedImportRow[]> {
  const resolved =
    typeof options === 'string' ? { sheetName: options } : (options ?? {});
  const sheetName = resolved.sheetName ?? DATA_SHEET_NAME;
  const dataStartRow = resolved.dataStartRow ?? 2;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet =
    workbook.getWorksheet(sheetName) ??
    workbook.worksheets.find((w) => w.name !== INSTRUCTIONS_SHEET_NAME) ??
    workbook.worksheets[0];
  if (!sheet) return [];

  const rows: ParsedImportRow[] = [];
  let headers: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1).map((v) => {
      if (v == null) return '';
      if (typeof v === 'object' && 'result' in (v as object)) {
        return (v as { result: unknown }).result;
      }
      return v;
    });

    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? '').trim());
      return;
    }

    if (rowNumber < dataStartRow) return;

    const allEmpty = values.every(
      (v) => v === '' || v === null || v === undefined,
    );
    if (allEmpty) return;

    rows.push({
      rowNumber,
      raw: mapRowHeaders(headers, values),
    });
  });

  return rows;
}

export async function createWorkbookWithSheets(
  sheets: {
    name: string;
    headers: string[];
    rows?: (string | number)[][];
    notes?: string[];
  }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const def of sheets) {
    const sheet = workbook.addWorksheet(def.name);
    if (def.notes?.length) {
      def.notes.forEach((note, i) => {
        sheet.getCell(i + 1, 1).value = note;
      });
      sheet.addRow([]);
    }
    sheet.addRow(def.headers);
    const headerRow = sheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
    }
    for (const row of def.rows ?? []) {
      sheet.addRow(row);
    }
    sheet.columns.forEach((col) => {
      col.width = 18;
    });
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** 1-based column index → Excel column letter (1 → A, 27 → AA). */
export function excelColumnLetter(columnIndex: number): string {
  let letter = '';
  let index = columnIndex;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

export const IMPORT_TEMPLATE_DATA_FIRST_ROW = 3;
export const IMPORT_TEMPLATE_DATA_LAST_ROW = 500;

type WorksheetWithValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add: (
      address: string,
      validation: {
        type: 'list';
        allowBlank?: boolean;
        formulae: string[];
        showErrorMessage?: boolean;
      },
    ) => void;
  };
};

/** Excel list validation for a whole column range (one rule — avoids corrupt per-cell XML). */
export function applyWorksheetListValidation(
  sheet: ExcelJS.Worksheet,
  columnIndex: number,
  formula: string,
  options?: {
    allowBlank?: boolean;
    firstRow?: number;
    lastRow?: number;
  },
) {
  if (!columnIndex || !formula) return;
  const firstRow = options?.firstRow ?? IMPORT_TEMPLATE_DATA_FIRST_ROW;
  const lastRow = options?.lastRow ?? IMPORT_TEMPLATE_DATA_LAST_ROW;
  const col = excelColumnLetter(columnIndex);
  (sheet as WorksheetWithValidations).dataValidations.add(
    `${col}${firstRow}:${col}${lastRow}`,
    {
      type: 'list',
      allowBlank: options?.allowBlank ?? true,
      formulae: [formula],
      showErrorMessage: true,
    },
  );
}

export function excelSheetListFormula(
  sheetName: string,
  rowCount: number,
  column = 'A',
) {
  if (rowCount <= 0) return '" "';
  const safeName = sheetName.replace(/'/g, "''");
  return `='${safeName}'!$${column}$2:$${column}$${rowCount + 1}`;
}

export { DATA_SHEET_NAME, INSTRUCTIONS_SHEET_NAME };
