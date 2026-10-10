import ExcelJS from 'exceljs';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';

export type IaMarkImportStudent = {
  rollNumber?: string | null;
  fullName?: string | null;
  shiftName?: string | null;
  marks: Array<{ code: string; marks: number | null; remarks?: string | null }>;
};

export type IaMarkImportComponent = {
  code: string;
  label: string;
  maxMarks: number;
};

export type IaMarkImportWorkbookInput = {
  collegeName: string;
  motto?: string | null;
  logoUrl?: string | null;
  academicYear: string;
  programme: string;
  examName: string;
  shiftName: string;
  subject: string;
  components: IaMarkImportComponent[];
  students: IaMarkImportStudent[];
};

export type IaMarkImportParsedRow = {
  rollNumber: string;
  componentCode: string;
  marks: number;
  remarks?: string;
};

const NAVY = 'FF1E4E8C';
const TITLE = 'FF2F6FE0';
const INK = 'FF1E293B';
const MUTED = 'FF64748B';
const LINE = 'FFD6E0EA';
const IDENTITY = 'FFEAF2FB';
const WHITE = 'FFFFFFFF';
const INSTRUCTION = 'FFE8F4FC';
const IMPORTANT = 'FFFFF6E5';

export async function buildIaMarkImportWorkbook(
  input: IaMarkImportWorkbookInput,
) {
  const components = input.components.length
    ? input.components
    : [{ code: 'IA', label: 'Marks', maxMarks: 0 }];
  const lastCol = 5 + components.length;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.collegeName;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('IA Marks', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 11 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 32;
  sheet.getColumn(4).width = 16;
  for (let index = 0; index < components.length; index++) {
    sheet.getColumn(5 + index).width = 34;
  }
  sheet.getColumn(lastCol).width = 24;

  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 18;
  sheet.mergeCells(1, 2, 2, 3);
  sheet.mergeCells(3, 2, 3, 3);
  sheet.mergeCells(1, 4, 3, lastCol);

  const nameCell = sheet.getCell(1, 2);
  nameCell.value = input.collegeName.toUpperCase();
  nameCell.font = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: NAVY },
  };
  nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const mottoCell = sheet.getCell(3, 2);
  mottoCell.value = (input.motto || '').toUpperCase();
  mottoCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
  mottoCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const titleCell = sheet.getCell(1, 4);
  titleCell.value = {
    richText: [
      {
        text: 'Internal Assessment Marks\n',
        font: { name: 'Calibri', size: 18, bold: true, color: { argb: WHITE } },
      },
      {
        text: 'Import Template (Excel)',
        font: { name: 'Calibri', size: 12, color: { argb: 'FFE0ECFF' } },
      },
    ],
  };
  titleCell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
    indent: 1,
  };
  for (let col = 4; col <= lastCol; col++) {
    for (let row = 1; row <= 3; row++) {
      const cell = sheet.getCell(row, col);
      cell.fill = solid(TITLE);
    }
  }
  for (let col = 1; col <= 3; col++) {
    for (let row = 1; row <= 3; row++) {
      sheet.getCell(row, col).fill = solid(WHITE);
    }
  }

  await embedLogo(workbook, sheet, input.logoUrl);

  const meta: Array<[string, string]> = [
    ['Academic Year', input.academicYear || '—'],
    ['Programme', input.programme || '—'],
    ['IA Exam', input.examName || '—'],
    ['Shift', input.shiftName || '—'],
    ['Subject', input.subject || '—'],
  ];
  meta.forEach(([label, value], index) => {
    const row = 5 + index;
    sheet.getRow(row).height = 18;
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: MUTED } };
    labelCell.alignment = { vertical: 'middle' };
    const valueCell = sheet.getCell(row, 2);
    valueCell.value = `:  ${value}`;
    valueCell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: INK },
    };
    valueCell.alignment = { vertical: 'middle' };
  });

  const maxShown = components.map((component) => Number(component.maxMarks));
  const maxLabel =
    maxShown.length === 1
      ? String(maxShown[0])
      : 'the maximum shown in each column';
  sheet.mergeCells(5, 3, 9, 4);
  const instructions = sheet.getCell(5, 3);
  instructions.value = {
    richText: [
      {
        text: 'Instructions:\n',
        font: { bold: true, size: 11, color: { argb: NAVY }, name: 'Calibri' },
      },
      {
        text: [
          '1. Do not change the column headers.',
          `2. Enter marks only in the marks column (numbers from 0 to ${maxLabel}).`,
          '3. Keep Roll Number and Shift exactly as per student records.',
          '4. Student Name is filled from the college record.',
          '5. Remarks are optional.',
          '6. Do not add or delete columns.',
        ].join('\n'),
        font: { size: 9, color: { argb: 'FF334155' }, name: 'Calibri' },
      },
    ],
  };
  instructions.alignment = { wrapText: true, vertical: 'top', indent: 1 };
  paint(sheet, 5, 9, 3, 4, INSTRUCTION, 'FF7EB6E0');

  sheet.mergeCells(5, 5, 9, lastCol);
  const important = sheet.getCell(5, 5);
  important.value = {
    richText: [
      {
        text: 'Important:\n',
        font: {
          bold: true,
          size: 11,
          color: { argb: 'FFB45309' },
          name: 'Calibri',
        },
      },
      {
        text: [
          `• Marks must be numbers only (0 to ${maxLabel}).`,
          '• Do not use text or special characters in the marks column.',
          '• Do not leave extra spaces in Roll Number.',
          '• Keep the file in .xlsx format.',
          '• Do not change the header names.',
          '• Leave a marks cell blank to keep the mark already saved.',
        ].join('\n'),
        font: { size: 9, color: { argb: 'FF78350F' }, name: 'Calibri' },
      },
    ],
  };
  important.alignment = { wrapText: true, vertical: 'top', indent: 1 };
  paint(sheet, 5, 9, 5, lastCol, IMPORTANT, 'FFF5CBA7');

  const headerRow = 11;
  const headers = [
    '#',
    'Roll Number',
    'Student Name',
    'Shift',
    ...components.map((component) => marksHeader(input, component)),
    'Remarks',
  ];
  sheet.getRow(headerRow).height = 34;
  headers.forEach((header, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: WHITE },
    };
    cell.fill = solid(NAVY);
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = thin(NAVY);
  });

  const students = [...input.students].sort((a, b) =>
    String(a.rollNumber ?? '').localeCompare(
      String(b.rollNumber ?? ''),
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      },
    ),
  );
  students.forEach((student, index) => {
    const rowNumber = headerRow + 1 + index;
    const row = sheet.getRow(rowNumber);
    row.height = 20;
    const remarks =
      student.marks.find((cell) => cell.remarks?.trim())?.remarks?.trim() ?? '';
    const values: Array<string | number> = [
      index + 1,
      student.rollNumber ?? '',
      student.fullName ?? '',
      student.shiftName ?? '',
    ];
    components.forEach((component) => {
      const saved = student.marks.find((cell) => cell.code === component.code);
      values.push(saved?.marks == null ? '' : saved.marks);
    });
    values.push(remarks);
    values.forEach((value, columnIndex) => {
      const column = columnIndex + 1;
      const cell = row.getCell(column);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: column === 3 ? 'left' : 'center',
        indent: column === 3 ? 1 : 0,
      };
      const isMark = column >= 5 && column < lastCol;
      const isRemark = column === lastCol;
      cell.fill = solid(isMark || isRemark ? WHITE : IDENTITY);
      cell.border = thin(LINE);
      if (isMark) cell.numFmt = '0.##';
    });
  });

  const firstData = headerRow + 1;
  const lastData = Math.max(firstData, headerRow + students.length);
  const extraUntil = lastData + 25;
  for (let rowNumber = lastData + 1; rowNumber <= extraUntil; rowNumber++) {
    for (let column = 5; column < lastCol; column++) {
      const cell = sheet.getCell(rowNumber, column);
      cell.border = thin(LINE);
      cell.fill = solid(WHITE);
    }
    sheet.getCell(rowNumber, lastCol).border = thin(LINE);
  }
  components.forEach((component, index) => {
    const column = 5 + index;
    for (let rowNumber = firstData; rowNumber <= extraUntil; rowNumber++) {
      sheet.getCell(rowNumber, column).dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: ['0', String(component.maxMarks)],
        showErrorMessage: true,
        errorTitle: 'Invalid marks',
        error: `Enter a number from 0 to ${component.maxMarks}, or leave the cell blank.`,
      };
    }
  });

  if (students.length) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: lastData, column: lastCol },
    };
  }

  const codes = workbook.addWorksheet('_codes');
  codes.state = 'veryHidden';
  codes.addRow(['column', 'componentCode', 'maxMarks']);
  components.forEach((component, index) => {
    codes.addRow([5 + index, component.code, component.maxMarks]);
  });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer;
}

export async function parseIaMarkImportWorkbook(
  buffer: Buffer,
): Promise<IaMarkImportParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet =
    workbook.worksheets.find((item) => item.name !== '_codes') ??
    workbook.worksheets[0];
  if (!sheet) return [];
  const codeByColumn = new Map<number, string>();
  const codes = workbook.getWorksheet('_codes');
  codes?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const column = Number(cellText(row.getCell(1).value));
    const code = cellText(row.getCell(2).value);
    if (column && code) codeByColumn.set(column, code);
  });

  let headerRow = 0;
  let rollColumn = 2;
  let remarksColumn = 0;
  const markColumns: number[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (headerRow) return;
    row.eachCell((cell, column) => {
      if (cellText(cell.value).toLowerCase() === 'roll number') {
        headerRow = rowNumber;
        rollColumn = column;
      }
    });
  });
  if (!headerRow) return [];
  const header = sheet.getRow(headerRow);
  header.eachCell((cell, column) => {
    const label = cellText(cell.value).toLowerCase();
    if (label === 'remarks') remarksColumn = column;
    if (column > rollColumn + 2 && label !== 'remarks' && label !== '#') {
      markColumns.push(column);
    }
  });

  const parsed: IaMarkImportParsedRow[] = [];
  for (
    let rowNumber = headerRow + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const rollNumber = cellText(row.getCell(rollColumn).value);
    if (!rollNumber) continue;
    const remarks = remarksColumn
      ? cellText(row.getCell(remarksColumn).value)
      : '';
    for (const column of markColumns) {
      const raw = cellText(row.getCell(column).value);
      if (!raw) continue;
      const marks = Number(raw);
      if (!Number.isFinite(marks)) {
        throw new Error(
          `Marks for ${rollNumber} must be a number. Found "${raw}".`,
        );
      }
      const componentCode =
        codeByColumn.get(column) || cellText(header.getCell(column).value);
      parsed.push({
        rollNumber,
        componentCode,
        marks,
        remarks: remarks || undefined,
      });
    }
  }
  return parsed;
}

function marksHeader(
  input: IaMarkImportWorkbookInput,
  component: IaMarkImportComponent,
) {
  const title =
    input.components.length === 1
      ? input.examName || component.label
      : component.label;
  return `${title}\n(Marks out of ${component.maxMarks})`;
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thin(argb: string): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = { style: 'thin', color: { argb } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function paint(
  sheet: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number,
  fill: string,
  border: string,
) {
  for (let row = fromRow; row <= toRow; row++) {
    for (let col = fromCol; col <= toCol; col++) {
      const cell = sheet.getCell(row, col);
      cell.fill = solid(fill);
      cell.border = thin(border);
    }
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'text' in value && value.text)
    return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value)
    return cellText(value.result as ExcelJS.CellValue);
  if (
    typeof value === 'object' &&
    'richText' in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return '';
}

async function embedLogo(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  logoUrl?: string | null,
) {
  const image = readLogo(logoUrl);
  if (!image) return;
  const imageId = workbook.addImage({
    buffer: image.buffer as unknown as ExcelJS.Buffer,
    extension: image.extension,
  });
  sheet.addImage(imageId, {
    tl: { col: 0.15, row: 0.15 },
    ext: { width: 54, height: 64 },
  });
}

function readLogo(
  logoUrl?: string | null,
): { buffer: Buffer; extension: 'png' | 'jpeg' } | null {
  const src = resolvePdfImageSrc(logoUrl);
  if (!src?.startsWith('data:')) return null;
  const match = src.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;
  const extension = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
  return { buffer: Buffer.from(match[2], 'base64'), extension };
}

export function safeWorkbookName(value: string) {
  const cleaned = value
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'ia-marks';
}
