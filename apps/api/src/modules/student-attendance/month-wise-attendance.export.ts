import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { attendanceBandCounts } from './month-wise-attendance.logic';

export type MonthWiseExportRow = {
  fullName: string;
  rollNumber: string | null;
  departmentName: string | null;
  programmeName: string | null;
  semesterNo: number | null;
  months: Array<{
    key: string;
    label: string;
    conducted: number;
    attended: number;
    percentage: number | null;
    display: string;
    tone: string;
  }>;
  overall: {
    conducted: number;
    attended: number;
    percentage: number | null;
    display: string;
    tone: string;
  };
};

export type MonthWiseExportModel = {
  institutionName: string;
  academicYear: string | null;
  programme: string | null;
  department: string | null;
  semester: string | null;
  section: string | null;
  subject: string | null;
  shift: string | null;
  monthRange: string;
  from: string;
  to: string;
  generatedAt: string;
  attendanceFilter: string;
  calculation?: string;
  months: Array<{ key: string; label: string; conducted: number }>;
  summary: { students: number; conductedClasses: number };
  rows: MonthWiseExportRow[];
};

const NAVY = 'FF1E3A8A';
const TEAL = 'FF0F766E';
const BLUE = 'FF1D4ED8';
const GREEN = 'FF14532D';
const THIN = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export async function buildMonthWiseExcel(report: MonthWiseExportModel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.institutionName;
  workbook.created = new Date(report.generatedAt);
  const sheet = workbook.addWorksheet('Cumulative attendance', {
    pageSetup: {
      paperSize: 9,
      orientation: report.months.length >= 3 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
    headerFooter: {
      oddFooter: `&L${report.institutionName}&CPage &P of &N&R${formatGenerated(report.generatedAt)}`,
      evenFooter: `&L${report.institutionName}&CPage &P of &N&R${formatGenerated(report.generatedAt)}`,
    },
    properties: { defaultRowHeight: 18 },
  });
  sheet.pageSetup.margins = {
    left: 0.4,
    right: 0.4,
    top: 0.55,
    bottom: 0.55,
    header: 0.25,
    footer: 0.25,
  };

  const columns = excelColumns(report);
  sheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width,
  }));
  const lastColumn = columns.length;
  const bands = attendanceBandCounts(
    report.rows.map((row) => row.overall.percentage),
  );

  sheet.getRow(1).height = 28;
  writeMerged(sheet, 1, 2, lastColumn, report.institutionName, {
    bold: true,
    size: 18,
    color: { argb: NAVY },
  });
  writeMerged(
    sheet,
    2,
    2,
    lastColumn,
    'Month-wise Cumulative Attendance Report',
    {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    },
  );
  sheet.getRow(2).eachCell({ includeEmpty: true }, (cell, index) => {
    if (index < 2) return;
    cell.fill = solid(NAVY);
  });
  writeMerged(
    sheet,
    3,
    2,
    lastColumn,
    joinParts([
      report.academicYear ? `Academic year ${report.academicYear}` : '',
      report.programme ? `Programme ${report.programme}` : '',
      report.semester,
      report.monthRange ? `Months ${report.monthRange}` : '',
    ]),
    { size: 11 },
  );
  paint(sheet, 3, 2, lastColumn, 'FFE0E7FF');
  writeMerged(
    sheet,
    4,
    2,
    lastColumn,
    joinParts([
      report.department ? `Department ${report.department}` : '',
      report.section,
      report.subject ? `Subject ${report.subject}` : '',
      report.shift,
      `Attendance filter: ${report.attendanceFilter}`,
    ]),
    { size: 11 },
  );
  paint(sheet, 4, 2, lastColumn, 'FFE0E7FF');
  writeMerged(
    sheet,
    5,
    2,
    lastColumn,
    `Generated ${formatGenerated(report.generatedAt)}`,
    { size: 10, color: { argb: 'FF475569' } },
  );
  writeMerged(
    sheet,
    6,
    2,
    lastColumn,
    report.calculation ??
      'Overall percentage = total classes attended ÷ total classes conducted. Filters use the unrounded percentage.',
    { size: 9, color: { argb: 'FF475569' }, italic: true },
  );
  sheet.getRow(6).height = 32;
  sheet.getRow(6).alignment = { wrapText: true, vertical: 'middle' };

  const summaryLabels = [
    'Total students',
    'Below 50%',
    'Below 60%',
    'Below 75%',
    '75% and above',
    'No attendance',
    'Classes conducted',
  ];
  const summaryValues = [
    bands.students,
    bands.below50,
    bands.below60,
    bands.below75,
    bands.atLeast75,
    bands.unmarked,
    report.summary.conductedClasses,
  ];
  const summaryColors = [
    'FFE2E8F0',
    'FFFECACA',
    'FFFEE2E2',
    'FFFFEDD5',
    'FFDCFCE7',
    'FFF1F5F9',
    'FFDBEAFE',
  ];
  summaryLabels.forEach((label, index) => {
    const cell = sheet.getCell(8, index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 9, color: { argb: 'FF0F172A' } };
    cell.fill = solid(summaryColors[index]);
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = BORDER;
    const value = sheet.getCell(9, index + 1);
    value.value = summaryValues[index];
    value.font = { bold: true, size: 14 };
    value.fill = solid(summaryColors[index]);
    value.alignment = { horizontal: 'center' };
    value.border = BORDER;
  });
  sheet.getRow(8).height = 22;

  const groupRow = 11;
  const headerRow = 12;
  let cursor = 1;
  for (const group of columnGroups(columns)) {
    const cell = sheet.getCell(groupRow, cursor);
    cell.value = group.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = solid(group.color);
    if (group.span > 1) {
      sheet.mergeCells(groupRow, cursor, groupRow, cursor + group.span - 1);
    }
    for (let offset = 0; offset < group.span; offset += 1) {
      const header = sheet.getCell(groupRow, cursor + offset);
      header.fill = solid(group.color);
      header.border = BORDER;
      header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    }
    cursor += group.span;
  }
  sheet.getRow(groupRow).height = 20;

  columns.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = solid(column.headerColor);
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = BORDER;
  });
  sheet.getRow(headerRow).height = 30;
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: lastColumn },
  };
  sheet.views = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: headerRow,
      topLeftCell: 'C13',
      activeCell: 'C13',
    },
  ];
  sheet.pageSetup.printTitlesRow = `${groupRow}:${headerRow}`;

  const percentColumns = columns
    .map((column, index) => (column.kind === 'percent' ? index + 1 : 0))
    .filter((index) => index > 0);

  report.rows.forEach((row) => {
    const added = sheet.addRow(columns.map((column) => column.value(row)));
    added.height = 18;
    added.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const column = columns[columnNumber - 1];
      if (!column) return;
      cell.border = BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: column.kind === 'text' ? 'left' : 'center',
      };
      if (column.bold) cell.font = { bold: true, size: 10 };
      if (column.kind === 'percent') {
        const raw = column.raw(row);
        if (raw == null) {
          cell.value = 'N/A';
          cell.font = { color: { argb: 'FF64748B' } };
          cell.fill = solid('FFF8FAFC');
        } else {
          cell.value = raw;
          cell.numFmt = '0.00';
          const tone = percentTone(raw);
          cell.font = { bold: true, color: { argb: tone.font } };
          cell.fill = solid(tone.fill);
        }
      }
    });
  });

  if (report.rows.length) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + report.rows.length, column: lastColumn },
    };
    percentColumns.forEach((columnNumber) => {
      const letter = sheet.getColumn(columnNumber).letter;
      const ref = `${letter}${headerRow + 1}:${letter}${headerRow + report.rows.length}`;
      sheet.addConditionalFormatting({
        ref,
        rules: percentRules(),
      });
    });
  }

  const logo = readCollegeLogo();
  if (logo) {
    const image = workbook.addImage({
      buffer: logo,
      extension: 'png',
    } as unknown as Parameters<ExcelJS.Workbook['addImage']>[0]);
    sheet.addImage(image, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 52, height: 52 },
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    filename: `cumulative-attendance-${report.from}-to-${report.to}.xlsx`,
  };
}

export async function buildMonthWisePdf(report: MonthWiseExportModel) {
  const doc = await PDFDocument.create();
  doc.setTitle('Month-wise Cumulative Attendance Report');
  doc.setAuthor(report.institutionName);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const layout = pdfLayout(report.months.length);
  const logoBytes = readCollegeLogo();
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;
  const columns = pdfColumns(report, layout);
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rowHeight = layout.fontSize + 7;
  let page = doc.addPage([layout.pageWidth, layout.pageHeight]);
  let y = layout.pageHeight - 28;

  const drawTableHeader = () => {
    let x = layout.margin;
    page.drawRectangle({
      x,
      y: y - 4,
      width: tableWidth,
      height: rowHeight + 2,
      color: rgb(0.12, 0.23, 0.54),
    });
    columns.forEach((column) => {
      page.drawText(
        fitText(column.label, bold, layout.fontSize, column.width - 4),
        {
          x: x + 2,
          y,
          size: layout.fontSize,
          font: bold,
          color: rgb(1, 1, 1),
        },
      );
      x += column.width;
    });
    y -= rowHeight + 2;
  };

  const drawHeader = (continued: boolean) => {
    if (logo) {
      page.drawImage(logo, {
        x: layout.pageWidth - layout.margin - 36,
        y: y - 24,
        width: 36,
        height: 36,
      });
    }
    const titleWidth = layout.pageWidth - layout.margin * 2 - 44;
    page.drawText(fitText(report.institutionName, bold, 13, titleWidth), {
      x: layout.margin,
      y,
      size: 13,
      font: bold,
      color: rgb(0.12, 0.23, 0.54),
    });
    y -= 15;
    page.drawText('Month-wise Cumulative Attendance Report', {
      x: layout.margin,
      y,
      size: 11,
      font: bold,
    });
    y -= 13;
    const context = joinParts([
      report.academicYear ? `Academic year ${report.academicYear}` : '',
      report.programme,
      report.semester,
      report.monthRange,
      `Filter: ${report.attendanceFilter}`,
    ]);
    page.drawText(fitText(context, font, 8, titleWidth), {
      x: layout.margin,
      y,
      size: 8,
      font,
    });
    y -= 11;
    if (!continued) {
      const detail = joinParts([
        report.department,
        report.section,
        report.subject,
        report.shift,
        `Students ${report.summary.students}`,
        `Classes conducted ${report.summary.conductedClasses}`,
        `Generated ${formatGenerated(report.generatedAt)}`,
      ]);
      page.drawText(fitText(detail, font, 8, titleWidth), {
        x: layout.margin,
        y,
        size: 8,
        font,
        color: rgb(0.28, 0.33, 0.41),
      });
      y -= 14;
    } else {
      y -= 8;
    }
    drawTableHeader();
  };

  drawHeader(false);
  if (!report.rows.length) {
    page.drawText('No students match the selected attendance filters.', {
      x: layout.margin,
      y,
      size: 10,
      font,
    });
  }
  report.rows.forEach((row, index) => {
    if (y < 40) {
      page = doc.addPage([layout.pageWidth, layout.pageHeight]);
      y = layout.pageHeight - 28;
      drawHeader(true);
    }
    if (index % 2 === 0) {
      page.drawRectangle({
        x: layout.margin,
        y: y - 4,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.96, 0.97, 0.99),
      });
    }
    let x = layout.margin;
    columns.forEach((column) => {
      const tone = column.tone(row);
      page.drawText(
        fitText(
          column.text(row),
          column.bold ? bold : font,
          layout.fontSize,
          column.width - 4,
        ),
        {
          x: x + 2,
          y,
          size: layout.fontSize,
          font: column.bold ? bold : font,
          color: toneColor(tone),
        },
      );
      x += column.width;
    });
    page.drawLine({
      start: { x: layout.margin, y: y - 4 },
      end: { x: layout.margin + tableWidth, y: y - 4 },
      thickness: 0.3,
      color: rgb(0.8, 0.84, 0.88),
    });
    y -= rowHeight;
  });

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = font.widthOfTextAtSize(label, 8);
    item.drawText(label, {
      x: (layout.pageWidth - width) / 2,
      y: 16,
      size: 8,
      font,
      color: rgb(0.28, 0.33, 0.41),
    });
  });

  const buffer = Buffer.from(await doc.save());
  return {
    buffer,
    filename: `cumulative-attendance-${report.from}-to-${report.to}.pdf`,
  };
}

function excelColumns(report: MonthWiseExportModel) {
  const student = NAVY;
  const studentHeader = 'FF1E40AF';
  const columns: ExcelColumn[] = [
    textColumn(
      'roll',
      'Roll No',
      16,
      'Student',
      student,
      studentHeader,
      (row) => row.rollNumber ?? '',
      true,
    ),
    textColumn(
      'name',
      'Student Name',
      28,
      'Student',
      student,
      studentHeader,
      (row) => row.fullName,
      true,
    ),
    textColumn(
      'department',
      'Department',
      22,
      'Student',
      student,
      studentHeader,
      (row) => row.departmentName ?? '',
    ),
    textColumn(
      'programme',
      'Programme',
      24,
      'Student',
      student,
      studentHeader,
      (row) => row.programmeName ?? '',
    ),
    textColumn(
      'semester',
      'Semester',
      12,
      'Student',
      student,
      studentHeader,
      (row) => (row.semesterNo ? String(row.semesterNo) : ''),
    ),
  ];
  report.months.forEach((month, index) => {
    const color = index % 2 === 0 ? TEAL : BLUE;
    const header = index % 2 === 0 ? 'FF115E59' : 'FF1E40AF';
    const group = month.label;
    columns.push(
      numberColumn(
        `${month.key}-conducted`,
        'Conducted',
        13,
        group,
        color,
        header,
        (row) => {
          const cell = monthCell(row, month.key);
          return cell && cell.conducted > 0 ? cell.conducted : null;
        },
      ),
      numberColumn(
        `${month.key}-attended`,
        'Attended',
        13,
        group,
        color,
        header,
        (row) => {
          const cell = monthCell(row, month.key);
          return cell && cell.conducted > 0 ? cell.attended : null;
        },
      ),
      percentColumn(
        `${month.key}-percent`,
        'Percentage',
        12,
        group,
        color,
        header,
        (row) => monthCell(row, month.key)?.percentage ?? null,
      ),
    );
  });
  columns.push(
    numberColumn(
      'total-conducted',
      'Total conducted',
      16,
      'Overall',
      GREEN,
      'FF166534',
      (row) => row.overall.conducted,
    ),
    numberColumn(
      'total-attended',
      'Total attended',
      16,
      'Overall',
      GREEN,
      'FF166534',
      (row) => row.overall.attended,
    ),
    percentColumn(
      'overall-percent',
      'Overall %',
      14,
      'Overall',
      GREEN,
      'FF166534',
      (row) => row.overall.percentage,
    ),
  );
  return columns;
}

type ExcelColumn = {
  key: string;
  header: string;
  width: number;
  group: string;
  color: string;
  headerColor: string;
  kind: 'text' | 'number' | 'percent';
  bold?: boolean;
  value: (row: MonthWiseExportRow) => string | number;
  raw: (row: MonthWiseExportRow) => number | null;
};

function textColumn(
  key: string,
  header: string,
  width: number,
  group: string,
  color: string,
  headerColor: string,
  read: (row: MonthWiseExportRow) => string,
  bold = false,
): ExcelColumn {
  return {
    key,
    header,
    width,
    group,
    color,
    headerColor,
    kind: 'text',
    bold,
    value: read,
    raw: () => null,
  };
}

function numberColumn(
  key: string,
  header: string,
  width: number,
  group: string,
  color: string,
  headerColor: string,
  read: (row: MonthWiseExportRow) => number | null,
): ExcelColumn {
  return {
    key,
    header,
    width,
    group,
    color,
    headerColor,
    kind: 'number',
    value: (row) => read(row) ?? '',
    raw: read,
  };
}

function percentColumn(
  key: string,
  header: string,
  width: number,
  group: string,
  color: string,
  headerColor: string,
  read: (row: MonthWiseExportRow) => number | null,
): ExcelColumn {
  return {
    key,
    header,
    width,
    group,
    color,
    headerColor,
    kind: 'percent',
    value: (row) => read(row) ?? 'N/A',
    raw: read,
  };
}

function columnGroups(columns: ExcelColumn[]) {
  const groups: Array<{ label: string; color: string; span: number }> = [];
  columns.forEach((column) => {
    const last = groups[groups.length - 1];
    if (last && last.label === column.group) last.span += 1;
    else groups.push({ label: column.group, color: column.color, span: 1 });
  });
  return groups;
}

function monthCell(row: MonthWiseExportRow, key: string) {
  return row.months.find((month) => month.key === key);
}

function percentRules(): ExcelJS.ConditionalFormattingRule[] {
  const rule = (
    operator: 'lessThan' | 'between' | 'greaterThan',
    formulae: string[],
    fill: string,
    font: string,
    priority: number,
  ): ExcelJS.ConditionalFormattingRule => ({
    type: 'cellIs',
    operator,
    formulae,
    priority,
    style: {
      fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: fill } },
      font: { bold: true, color: { argb: font } },
    },
  });
  return [
    rule('lessThan', ['50'], 'FFFECACA', 'FF991B1B', 1),
    rule('between', ['50', '59.999999'], 'FFFEE2E2', 'FFB91C1C', 2),
    rule('between', ['60', '74.999999'], 'FFFFEDD5', 'FFC2410C', 3),
    rule('greaterThan', ['74.999999'], 'FFDCFCE7', 'FF166534', 4),
  ];
}

function percentTone(value: number) {
  if (value < 50) return { fill: 'FFFECACA', font: 'FF991B1B' };
  if (value < 60) return { fill: 'FFFEE2E2', font: 'FFB91C1C' };
  if (value < 75) return { fill: 'FFFFEDD5', font: 'FFC2410C' };
  return { fill: 'FFDCFCE7', font: 'FF166534' };
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function paint(
  sheet: ExcelJS.Worksheet,
  row: number,
  from: number,
  to: number,
  color: string,
) {
  for (let column = from; column <= to; column += 1) {
    sheet.getCell(row, column).fill = solid(color);
  }
}

function writeMerged(
  sheet: ExcelJS.Worksheet,
  row: number,
  from: number,
  to: number,
  value: string,
  font: Partial<ExcelJS.Font>,
) {
  if (to > from) sheet.mergeCells(row, from, row, to);
  const cell = sheet.getCell(row, from);
  cell.value = value;
  cell.font = font;
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function pdfLayout(monthCount: number) {
  const shortSide = 595.28;
  const longSide = 841.89;
  const margin = 28;
  const roll = 62;
  const overall = 68;
  const portraitInner = shortSide - margin * 2;
  const landscape =
    roll + 110 + 78 + overall + Math.max(monthCount, 1) * 56 > portraitInner;
  const pageWidth = landscape ? longSide : shortSide;
  const pageHeight = landscape ? shortSide : longSide;
  const inner = pageWidth - margin * 2;
  let deptW = 78;
  let nameW = 120;
  let monthW = monthCount ? 64 : 0;
  const width = () => roll + nameW + deptW + monthW * monthCount + overall;
  if (width() > inner) deptW = 0;
  if (width() > inner && monthCount) {
    monthW = Math.max(46, (inner - roll - 90 - overall) / monthCount);
    nameW = inner - roll - monthW * monthCount - overall;
  }
  if (nameW < 72 && monthCount) {
    monthW = Math.max(42, (inner - roll - 72 - overall) / monthCount);
    nameW = inner - roll - monthW * monthCount - overall;
  }
  const fontSize = monthW > 0 && monthW < 52 ? 7 : 8;
  return {
    landscape,
    pageWidth,
    pageHeight,
    margin,
    roll,
    nameW,
    deptW,
    monthW,
    overall,
    fontSize,
  };
}

function pdfColumns(
  report: MonthWiseExportModel,
  layout: ReturnType<typeof pdfLayout>,
) {
  const columns: Array<{
    label: string;
    width: number;
    bold: boolean;
    text: (row: MonthWiseExportRow) => string;
    tone: (row: MonthWiseExportRow) => string;
  }> = [
    {
      label: 'Roll No',
      width: layout.roll,
      bold: true,
      text: (row) => row.rollNumber ?? '',
      tone: () => 'text',
    },
    {
      label: 'Student Name',
      width: layout.nameW,
      bold: true,
      text: (row) => row.fullName,
      tone: () => 'text',
    },
  ];
  if (layout.deptW) {
    columns.push({
      label: 'Department',
      width: layout.deptW,
      bold: false,
      text: (row) => row.departmentName ?? '',
      tone: () => 'text',
    });
  }
  report.months.forEach((month) => {
    columns.push({
      label: month.label,
      width: layout.monthW,
      bold: false,
      text: (row) => monthCell(row, month.key)?.display ?? 'N/A',
      tone: (row) => monthCell(row, month.key)?.tone ?? 'muted',
    });
  });
  columns.push({
    label: 'Overall',
    width: layout.overall,
    bold: true,
    text: (row) => row.overall.display,
    tone: (row) => row.overall.tone,
  });
  return columns;
}

function toneColor(tone: string) {
  if (tone === 'red') return rgb(0.6, 0.11, 0.11);
  if (tone === 'light-red') return rgb(0.72, 0.11, 0.11);
  if (tone === 'orange') return rgb(0.76, 0.25, 0.05);
  if (tone === 'green') return rgb(0.09, 0.4, 0.2);
  if (tone === 'muted') return rgb(0.39, 0.45, 0.55);
  return rgb(0.06, 0.09, 0.16);
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let end = text.length;
  while (
    end > 1 &&
    font.widthOfTextAtSize(`${text.slice(0, end)}...`, size) > maxWidth
  ) {
    end -= 1;
  }
  return `${text.slice(0, Math.max(1, end))}...`;
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join('   ·   ');
}

function formatGenerated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function readCollegeLogo() {
  const candidates = [
    join(process.cwd(), 'apps/web/public/branding/college-logo.png'),
    join(process.cwd(), '../web/public/branding/college-logo.png'),
    join(process.cwd(), 'public/branding/college-logo.png'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path);
  }
  return null;
}
