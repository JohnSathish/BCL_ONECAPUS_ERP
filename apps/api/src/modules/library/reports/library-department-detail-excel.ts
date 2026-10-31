import ExcelJS from 'exceljs';
import {
  copyTypeSummary,
  excelSheetName,
  publicationYearSummary,
  rowsForDepartment,
  sortCopies,
  subjectSummary,
  summarizeCopies,
  type DetailCopy,
} from './library-department-detail.logic';

const NAVY = 'FF123B70';
const HEADER = 'FF164E83';
const LIGHT = 'FFEAF4FF';
const WHITE = 'FFFFFFFF';
const GREY = 'FFF3F4F6';
const LINE = 'FFCBD5E1';
const GREEN = 'FFDCFCE7';
const GREEN_TEXT = 'FF166534';
const BLUE = 'FFDBEAFE';
const BLUE_TEXT = 'FF1D4ED8';
const ORANGE = 'FFFFEDD5';
const ORANGE_TEXT = 'FF9A3412';
const RED = 'FFFEE2E2';
const RED_TEXT = 'FFB91C1C';
const DARK_RED = 'FFFECACA';
const DARK_RED_TEXT = 'FF7F1D1D';
const MUTED = 'FFE5E7EB';

const COLUMNS = [
  'S.No.',
  'Department',
  'Book Title',
  'Author',
  'ISBN',
  'Edition',
  'Publisher',
  'Publication Year',
  'Subject',
  'Accession Number',
  'Barcode',
  'Call Number',
  'Copy Type',
  'Availability Status',
] as const;

const WIDTHS = [8, 18, 36, 26, 18, 14, 20, 16, 20, 18, 16, 16, 14, 20];

export type DepartmentDetailWorkbookInput = {
  collegeName: string;
  address: string;
  generatedAt: string;
  generatedBy: string;
  academicYear: string;
  period: string;
  layout: 'selected' | 'consolidated' | 'sheets';
  departmentLabel: string;
  rows: DetailCopy[];
  logo?: { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' } | null;
};

export async function buildDepartmentDetailWorkbook(
  input: DepartmentDetailWorkbookInput,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.collegeName;
  workbook.created = new Date();
  const used = new Set<string>();
  const logoId = input.logo
    ? workbook.addImage({
        buffer: input.logo.buffer as unknown as ExcelJS.Buffer,
        extension: input.logo.extension,
      })
    : null;

  if (input.layout === 'sheets') {
    const summary = workbook.addWorksheet(excelSheetName('Summary', used));
    paintSummarySheet(summary, input);
    const names = departmentNames(input.rows);
    for (const name of names) {
      const sheet = workbook.addWorksheet(excelSheetName(name, used));
      paintDetailSheet(
        sheet,
        input,
        name,
        sortCopies(rowsForDepartment(input.rows, name)),
        logoId,
      );
    }
  } else {
    const name =
      input.layout === 'consolidated'
        ? 'All departments'
        : input.departmentLabel;
    const sheet = workbook.addWorksheet(excelSheetName(name, used));
    paintDetailSheet(
      sheet,
      input,
      input.departmentLabel,
      sortCopies(input.rows),
      logoId,
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function paintSummarySheet(
  sheet: ExcelJS.Worksheet,
  input: DepartmentDetailWorkbookInput,
) {
  prepareSheet(sheet, input);
  writeBanner(sheet, input, 'All departments', null);
  const once = summarizeCopies(input.rows);
  writeCards(sheet, 'All departments', once);
  const names = departmentNames(input.rows);
  let row = 12;
  sectionTitle(sheet, row, 'Department-wise totals');
  row += 1;
  const head = sheet.getRow(row);
  [
    'Department',
    'Unique titles',
    'Physical copies',
    'Available',
    'Issued',
    'Reference',
    'Reserved',
    'Damaged',
    'Lost',
    'Withdrawn',
  ].forEach((label, index) => {
    const cell = head.getCell(index + 1);
    cell.value = label;
    styleHeaderCell(cell);
  });
  row += 1;
  for (const name of names) {
    const metrics = summarizeCopies(rowsForDepartment(input.rows, name));
    const line = sheet.getRow(row);
    [
      name,
      metrics.titles,
      metrics.copies,
      metrics.available,
      metrics.issued,
      metrics.reference,
      metrics.reserved,
      metrics.damaged,
      metrics.lost,
      metrics.withdrawn,
    ].forEach((value, index) => {
      const cell = line.getCell(index + 1);
      cell.value = value;
      styleBody(cell, row % 2 === 0);
    });
    row += 1;
  }
  const total = sheet.getRow(row);
  [
    'Each copy once',
    once.titles,
    once.copies,
    once.available,
    once.issued,
    once.reference,
    once.reserved,
    once.damaged,
    once.lost,
    once.withdrawn,
  ].forEach((value, index) => {
    const cell = total.getCell(index + 1);
    cell.value = value;
    cell.font = {
      name: 'Calibri',
      bold: true,
      size: 10,
      color: { argb: NAVY },
    };
    cell.fill = solid(LIGHT);
  });
  sheet.getCell(`A${row + 2}`).value =
    'A title mapped to more than one department is listed on each of those sheets. The “Each copy once” row does not count that copy twice.';
  sheet.getCell(`A${row + 2}`).font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF475569' },
  };
  sheet.mergeCells(`A${row + 2}:J${row + 2}`);
}

function paintDetailSheet(
  sheet: ExcelJS.Worksheet,
  input: DepartmentDetailWorkbookInput,
  departmentLabel: string,
  rows: DetailCopy[],
  logoId: number | null,
) {
  prepareSheet(sheet, input);
  writeBanner(sheet, input, departmentLabel, logoId);
  writeCards(sheet, departmentLabel, summarizeCopies(rows));
  const headerRow = 11;
  const listed =
    departmentLabel === 'All departments'
      ? rows
      : rows.map((row) => ({ ...row, department: departmentLabel }));
  if (!listed.length) {
    sheet.getCell('A12').value = 'No physical copies match this department.';
    sheet.getCell('A12').font = { name: 'Calibri', size: 11, italic: true };
    return;
  }
  const tableRows = listed.map((row, index) => [
    index + 1,
    row.department,
    row.title,
    row.author,
    row.isbn,
    row.edition,
    row.publisher,
    row.year,
    row.subject,
    row.accession,
    row.barcode,
    row.callNumber,
    row.copyType,
    row.status,
  ]);
  sheet.addTable({
    name: `BookList${sheet.id}`,
    ref: `A${headerRow}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: COLUMNS.map((name) => ({ name, filterButton: true })),
    rows: tableRows,
  });
  const header = sheet.getRow(headerRow);
  header.height = 22;
  header.eachCell((cell) => styleHeaderCell(cell));
  listed.forEach((row, index) => {
    const line = sheet.getRow(headerRow + 1 + index);
    line.height = 18;
    const stripe = index % 2 === 1;
    for (let column = 1; column <= COLUMNS.length; column += 1) {
      const cell = line.getCell(column);
      styleBody(cell, stripe);
      if (column === 3 || column === 4)
        cell.alignment = { wrapText: true, vertical: 'middle' };
      if (column === 5 || column === 10 || column === 11) {
        cell.numFmt = '@';
        cell.value = String(tableRows[index][column - 1] ?? '');
      }
      if (column === 14) paintStatus(cell, row.status);
    }
  });
  const statusRange = `N${headerRow + 1}:N${headerRow + listed.length}`;
  addStatusRules(sheet, statusRange);
  sheet.views = [
    { state: 'frozen', ySplit: headerRow, activeCell: `A${headerRow + 1}` },
  ];
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  writeAnalytics(sheet, rows, headerRow + rows.length + 2);
}

function writeAnalytics(
  sheet: ExcelJS.Worksheet,
  rows: DetailCopy[],
  start: number,
) {
  const metrics = summarizeCopies(rows);
  sectionTitle(sheet, start, 'Department Summary');
  const metricRows: [string, number][] = [
    ['Total Unique Titles', metrics.titles],
    ['Total Physical Copies', metrics.copies],
    ['Available Copies', metrics.available],
    ['Issued Copies', metrics.issued],
    ['Reference Copies', metrics.reference],
    ['Reserved Copies', metrics.reserved],
    ['Damaged Copies', metrics.damaged],
    ['Lost / Missing Copies', metrics.lost],
    ['Withdrawn Copies', metrics.withdrawn],
  ];
  metricRows.forEach((pair, index) => {
    const row = sheet.getRow(start + 1 + index);
    row.getCell(1).value = pair[0];
    row.getCell(2).value = pair[1];
    styleBody(row.getCell(1), index % 2 === 1);
    styleBody(row.getCell(2), index % 2 === 1);
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(2).font = {
      name: 'Calibri',
      bold: true,
      size: 10,
      color: { argb: NAVY },
    };
  });

  sectionTitle(sheet, start, 'Publication Year Summary', 4);
  const years = publicationYearSummary(rows);
  sheet.getRow(start + 1).getCell(4).value = 'Publication Year';
  sheet.getRow(start + 1).getCell(5).value = 'No. of Copies';
  styleHeaderCell(sheet.getRow(start + 1).getCell(4));
  styleHeaderCell(sheet.getRow(start + 1).getCell(5));
  years.forEach((item, index) => {
    const row = sheet.getRow(start + 2 + index);
    row.getCell(4).value = item.year;
    row.getCell(5).value = item.copies;
    styleBody(row.getCell(4), index % 2 === 1);
    styleBody(row.getCell(5), index % 2 === 1);
  });
  const yearTotal = sheet.getRow(start + 2 + years.length);
  yearTotal.getCell(4).value = 'Total';
  yearTotal.getCell(5).value = rows.length;
  yearTotal.getCell(4).font = { name: 'Calibri', bold: true, size: 10 };
  yearTotal.getCell(5).font = { name: 'Calibri', bold: true, size: 10 };

  sectionTitle(sheet, start, 'Subject / Category', 7);
  const subjects = subjectSummary(rows);
  ['Subject', 'Titles', 'Copies', 'Available', 'Issued', 'Reference'].forEach(
    (label, index) => {
      const cell = sheet.getRow(start + 1).getCell(7 + index);
      cell.value = label;
      styleHeaderCell(cell);
    },
  );
  subjects.forEach((item, index) => {
    const row = sheet.getRow(start + 2 + index);
    [
      item.subject,
      item.titles,
      item.copies,
      item.available,
      item.issued,
      item.reference,
    ].forEach((value, column) => {
      const cell = row.getCell(7 + column);
      cell.value = value;
      styleBody(cell, index % 2 === 1);
    });
  });

  const typeStart =
    start +
    Math.max(metricRows.length, years.length + 2, subjects.length + 2) +
    2;
  sectionTitle(sheet, typeStart, 'Copy Type Summary');
  ['Copy type', 'Total copies', 'Available for issue', 'Not for issue'].forEach(
    (label, index) => {
      const cell = sheet.getRow(typeStart + 1).getCell(index + 1);
      cell.value = label;
      styleHeaderCell(cell);
    },
  );
  copyTypeSummary(rows).forEach((item, index) => {
    const row = sheet.getRow(typeStart + 2 + index);
    [item.copyType, item.copies, item.available, item.notForIssue].forEach(
      (value, column) => {
        const cell = row.getCell(column + 1);
        cell.value = value;
        styleBody(cell, index % 2 === 1);
      },
    );
  });
}

function writeBanner(
  sheet: ExcelJS.Worksheet,
  input: DepartmentDetailWorkbookInput,
  departmentLabel: string,
  logoId: number | null,
) {
  sheet.mergeCells('A1:B4');
  sheet.mergeCells('C1:H1');
  sheet.mergeCells('C2:H2');
  sheet.mergeCells('C3:H3');
  sheet.mergeCells('I1:N1');
  sheet.mergeCells('I2:N2');
  sheet.mergeCells('I3:N4');
  sheet.getCell('C1').value = input.collegeName.toUpperCase();
  sheet.getCell('C1').font = {
    name: 'Calibri',
    bold: true,
    size: 20,
    color: { argb: NAVY },
  };
  sheet.getCell('C1').alignment = { vertical: 'middle' };
  sheet.getCell('C2').value = input.address;
  sheet.getCell('C2').font = {
    name: 'Calibri',
    size: 11,
    color: { argb: 'FF334155' },
  };
  sheet.getCell('C3').value = input.academicYear
    ? `Academic year ${input.academicYear}`
    : '';
  sheet.getCell('C3').font = {
    name: 'Calibri',
    size: 11,
    color: { argb: NAVY },
  };
  sheet.getCell('I1').value = 'DEPARTMENT-WISE DETAILED BOOK LIST';
  sheet.getCell('I1').font = {
    name: 'Calibri',
    bold: true,
    size: 16,
    color: { argb: NAVY },
  };
  sheet.getCell('I1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('I1').fill = solid(LIGHT);
  sheet.getCell('I2').value = 'Library Collection Report';
  sheet.getCell('I2').font = {
    name: 'Calibri',
    bold: true,
    size: 12,
    color: { argb: HEADER },
  };
  sheet.getCell('I2').alignment = { horizontal: 'center' };
  sheet.getCell('I2').fill = solid(LIGHT);
  sheet.getCell('I3').value = [
    `Generated on: ${input.generatedAt}`,
    `Generated by: ${input.generatedBy}`,
    `Department: ${departmentLabel}`,
    `Period: ${input.period}`,
    'Note: Each row is one physical copy.',
  ].join('\n');
  sheet.getCell('I3').alignment = { wrapText: true, vertical: 'top' };
  sheet.getCell('I3').font = {
    name: 'Calibri',
    size: 10,
    color: { argb: 'FF1E293B' },
  };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 18;
  if (logoId != null) {
    sheet.addImage(logoId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 58, height: 58 },
    });
  }
}

function writeCards(
  sheet: ExcelJS.Worksheet,
  departmentLabel: string,
  metrics: ReturnType<typeof summarizeCopies>,
) {
  const cards: {
    label: string;
    value: string | number;
    fill: string;
    from: string;
    to: string;
  }[] = [
    {
      label: 'Department',
      value: departmentLabel,
      fill: 'FFDBEAFE',
      from: 'A6',
      to: 'B7',
    },
    {
      label: 'Total Unique Titles',
      value: metrics.titles,
      fill: 'FFDCFCE7',
      from: 'C6',
      to: 'D7',
    },
    {
      label: 'Total Physical Copies',
      value: metrics.copies,
      fill: 'FFEDE9FE',
      from: 'E6',
      to: 'F7',
    },
    {
      label: 'Total Accession Numbers',
      value: metrics.accessions,
      fill: 'FFFFEDD5',
      from: 'G6',
      to: 'H7',
    },
    {
      label: 'Publication Years',
      value: metrics.yearRange || '—',
      fill: 'FFFCE7F3',
      from: 'I6',
      to: 'J7',
    },
    {
      label: 'Available',
      value: metrics.available,
      fill: GREEN,
      from: 'K6',
      to: 'K7',
    },
    {
      label: 'Issued',
      value: metrics.issued,
      fill: BLUE,
      from: 'L6',
      to: 'L7',
    },
    {
      label: 'Reference',
      value: metrics.reference,
      fill: RED,
      from: 'M6',
      to: 'M7',
    },
    {
      label: 'Damaged / Missing',
      value: metrics.damaged + metrics.lost,
      fill: 'FFFFE4E6',
      from: 'N6',
      to: 'N7',
    },
  ];
  for (const card of cards) {
    if (card.from !== card.to) sheet.mergeCells(`${card.from}:${card.to}`);
    const cell = sheet.getCell(card.from);
    cell.value = `${card.label}\n${card.value}`;
    cell.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center',
    };
    cell.font = {
      name: 'Calibri',
      bold: true,
      size: 11,
      color: { argb: NAVY },
    };
    cell.fill = solid(card.fill);
    cell.border = thin();
  }
  sheet.getRow(6).height = 20;
  sheet.getRow(7).height = 22;
}

function prepareSheet(
  sheet: ExcelJS.Worksheet,
  input: DepartmentDetailWorkbookInput,
) {
  sheet.properties.tabColor = { argb: NAVY };
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.7,
      bottom: 0.6,
      header: 0.28,
      footer: 0.28,
    },
  };
  sheet.headerFooter = {
    oddHeader: `&L&B${input.collegeName}&CDepartment-Wise Detailed Book List`,
    oddFooter: `&LGenerated ${input.generatedAt}&RPage &P of &N`,
  };
  sheet.pageSetup.printTitlesRow = '11:11';
  WIDTHS.forEach((width, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = width;
    column.font = { name: 'Calibri', size: 10 };
  });
}

function sectionTitle(
  sheet: ExcelJS.Worksheet,
  row: number,
  title: string,
  column = 1,
) {
  const cell = sheet.getRow(row).getCell(column);
  cell.value = title;
  cell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: NAVY } };
  cell.fill = solid(LIGHT);
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: WHITE } };
  cell.fill = solid(HEADER);
  cell.alignment = { vertical: 'middle', wrapText: true };
  cell.border = thin();
}

function styleBody(cell: ExcelJS.Cell, stripe: boolean) {
  cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
  cell.fill = solid(stripe ? GREY : WHITE);
  cell.alignment = { vertical: 'middle', wrapText: false };
  cell.border = thin();
}

function paintStatus(cell: ExcelJS.Cell, status: string) {
  const tone =
    status === 'Available'
      ? { fill: GREEN, text: GREEN_TEXT }
      : status === 'Issued'
        ? { fill: BLUE, text: BLUE_TEXT }
        : status === 'Reserved'
          ? { fill: ORANGE, text: ORANGE_TEXT }
          : status === 'Not for Issue'
            ? { fill: RED, text: RED_TEXT }
            : status === 'Damaged'
              ? { fill: RED, text: RED_TEXT }
              : status === 'Lost'
                ? { fill: DARK_RED, text: DARK_RED_TEXT }
                : status === 'Withdrawn'
                  ? { fill: MUTED, text: 'FF475569' }
                  : null;
  if (!tone) return;
  cell.fill = solid(tone.fill);
  cell.font = {
    name: 'Calibri',
    bold: true,
    size: 10,
    color: { argb: tone.text },
  };
}

function addStatusRules(sheet: ExcelJS.Worksheet, ref: string) {
  const rules: { text: string; fill: string; textColor: string }[] = [
    { text: 'Available', fill: GREEN, textColor: GREEN_TEXT },
    { text: 'Issued', fill: BLUE, textColor: BLUE_TEXT },
    { text: 'Reserved', fill: ORANGE, textColor: ORANGE_TEXT },
    { text: 'Not for Issue', fill: RED, textColor: RED_TEXT },
    { text: 'Damaged', fill: RED, textColor: RED_TEXT },
    { text: 'Lost', fill: DARK_RED, textColor: DARK_RED_TEXT },
    { text: 'Withdrawn', fill: MUTED, textColor: 'FF475569' },
  ];
  sheet.addConditionalFormatting({
    ref,
    rules: rules.map(
      (rule) =>
        ({
          type: 'containsText',
          operator: 'containsText',
          text: rule.text,
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: rule.fill },
            },
            font: { bold: true, color: { argb: rule.textColor } },
          },
        }) as ExcelJS.ConditionalFormattingRule,
    ),
  });
}

function departmentNames(rows: DetailCopy[]) {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.departments.length)
      row.departments.forEach((name) => names.add(name));
    else names.add('(Unmapped)');
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thin(): Partial<ExcelJS.Borders> {
  const edge: ExcelJS.Border = { style: 'thin', color: { argb: LINE } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}
