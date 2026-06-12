import ExcelJS from 'exceljs';
import { mapRowHeaders } from './import-column-map';
import type { ParsedImportRow } from './import.types';

const DATA_SHEET_NAME = 'Courses';
const INSTRUCTIONS_SHEET_NAME = 'Instructions';

export async function parseExcelDataSheet(
  buffer: Buffer,
  sheetName = DATA_SHEET_NAME,
): Promise<ParsedImportRow[]> {
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

export { DATA_SHEET_NAME, INSTRUCTIONS_SHEET_NAME };
