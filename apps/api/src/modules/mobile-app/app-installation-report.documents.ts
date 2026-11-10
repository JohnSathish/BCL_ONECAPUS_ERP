import ExcelJS from 'exceljs';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { AppInstallationReport } from './app-installation-report.service';
import type { InstallationPerson } from './app-installation-report.logic';

export type InstallationFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

type Scope = 'summary' | 'detailed' | 'pending' | 'department';

const NAVY = 'FF0B2A4A';
const GREEN = 'FF166534';
const GREEN_BG = 'FFDCFCE7';
const RED = 'FF9F1239';
const RED_BG = 'FFFFE4E6';
const GREY = 'FF334155';
const GREY_BG = 'FFE2E8F0';
const LINE = 'FFCBD5E1';
const HEADER_BG = 'FF0B2A4A';
const STRIPE = 'FFF8FAFC';

export async function buildInstallationWorkbook(
  report: AppInstallationReport,
  scope: Scope,
): Promise<InstallationFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Don Bosco College ERP';
  workbook.created = new Date(report.generatedAt);
  const summary = workbook.addWorksheet('Department Summary', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
    },
  });
  writeBanner(summary, report, scope);
  const header = summary.addRow([
    'Sl. No.',
    'Department',
    'Total Users',
    'Installed',
    'Not Installed',
    'Unverified',
    'Installation %',
  ]);
  styleHeader(header);
  summary.columns = [
    { width: 12 },
    { width: 36 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 18 },
  ];
  report.departments.forEach((department, index) => {
    const row = summary.addRow([
      department.serial,
      department.name,
      department.total,
      department.installed,
      department.notInstalled,
      department.unverified,
      department.percent,
    ]);
    stripe(row, index);
    row.getCell(7).numFmt = '0.0';
  });
  summary.addRow([]);
  const totals = summary.addRow([
    '',
    'Total',
    report.summary.total,
    report.summary.installed,
    report.summary.notInstalled,
    report.summary.unverified,
    report.summary.percent,
  ]);
  totals.font = { bold: true };
  totals.getCell(7).numFmt = '0.0';
  summary.addRow([]);
  summary.addRow(['Prepared by: IT Department']);
  summary.addRow([report.collegeName]);

  if (scope !== 'summary') {
    const people = report.departments.flatMap(
      (department) => department.people,
    );
    addPeopleSheet(
      workbook,
      scope === 'pending' ? 'Pending Users' : 'People',
      report,
      people,
    );
    if (scope === 'pending') {
      addPeopleSheet(
        workbook,
        'Unverified',
        report,
        report.departments.flatMap((department) => department.followUp),
      );
    }
  }

  const raw = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(raw),
    filename: fileName(report, scope, 'xlsx'),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

function addPeopleSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  report: AppInstallationReport,
  people: Array<InstallationPerson & { departmentName?: string }>,
) {
  const sheet = workbook.addWorksheet(name, {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
    },
  });
  writeBanner(sheet, report, name);
  const header = sheet.addRow([
    'Sl. No.',
    'Department',
    'Name',
    'Roll No. / Staff ID',
    'Designation / Semester',
    'Official Email',
    'Mobile',
    'Status',
    'Last Login',
    'Last Active',
  ]);
  styleHeader(header);
  sheet.columns = [
    { width: 10 },
    { width: 24 },
    { width: 28 },
    { width: 20 },
    { width: 24 },
    { width: 32 },
    { width: 16 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
  ];
  people.forEach((person, index) => {
    const row = sheet.addRow([
      index + 1,
      person.departmentName,
      person.name,
      person.identifier,
      person.roleLabel,
      person.email ?? '',
      person.mobile ?? '',
      statusLabel(person.status),
      displayDay(person.lastLoginAt),
      displayDay(person.lastActiveAt),
    ]);
    stripe(row, index);
    paintStatus(row.getCell(8), person.status);
  });
  if (!people.length) {
    sheet.addRow(['No users in this list.']);
  }
  sheet.addRow([]);
  sheet.addRow(['Prepared by: IT Department']);
  sheet.addRow([report.collegeName]);
}

function writeBanner(
  sheet: ExcelJS.Worksheet,
  report: AppInstallationReport,
  scope: string,
) {
  sheet.addRow([report.headingName]).font = {
    bold: true,
    size: 16,
    color: { argb: NAVY },
  };
  sheet.addRow(['DEPARTMENT-WISE MOBILE APP INSTALLATION STATUS REPORT']).font =
    {
      bold: true,
      size: 12,
      color: { argb: NAVY },
    };
  sheet.addRow([`Academic Year: ${report.academicYear?.name ?? 'Not set'}`]);
  sheet.addRow([`Report Generated On: ${report.generatedLabel}`]);
  sheet.addRow([`View: ${scope}`]);
  sheet.addRow([report.basis]);
  sheet.addRow([]);
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = thin();
  });
  row.height = 22;
}

function stripe(row: ExcelJS.Row, index: number) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = thin();
    cell.alignment = { vertical: 'middle' };
    if (index % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STRIPE },
      };
    }
  });
}

function paintStatus(cell: ExcelJS.Cell, status: InstallationPerson['status']) {
  const tone =
    status === 'INSTALLED'
      ? { color: GREEN, bg: GREEN_BG }
      : status === 'UNVERIFIED'
        ? { color: GREY, bg: GREY_BG }
        : { color: RED, bg: RED_BG };
  cell.font = { bold: true, color: { argb: tone.color } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.bg } };
}

function thin(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: LINE },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 32;
const NAVY_RGB = rgb(0.043, 0.165, 0.29);
const MUTED = rgb(0.28, 0.33, 0.4);
const RULE = rgb(0.8, 0.84, 0.88);
const GREEN_RGB = rgb(0.09, 0.4, 0.2);
const RED_RGB = rgb(0.62, 0.07, 0.22);
const GREY_RGB = rgb(0.2, 0.25, 0.32);

export async function buildInstallationPdf(
  report: AppInstallationReport,
  scope: Scope,
): Promise<InstallationFile> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${report.headingName} — Mobile App Installation`);
  doc.setAuthor('IT Department');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const ensure = (needed: number) => {
    if (y - needed >= MARGIN + 34) return;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(pdfSafe(report.headingName), {
      x: MARGIN,
      y: y - 10,
      size: 9,
      font: bold,
      color: NAVY_RGB,
    });
    page.drawText('DEPARTMENT-WISE MOBILE APP INSTALLATION STATUS REPORT', {
      x: MARGIN,
      y: y - 22,
      size: 8,
      font,
      color: NAVY_RGB,
    });
    y -= 34;
  };

  const text = (
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
    },
  ) => {
    const size = options.size ?? 10;
    page.drawText(pdfSafe(value), {
      x: options.x ?? MARGIN,
      y,
      size,
      font: options.bold ? bold : font,
      color: options.color ?? rgb(0, 0, 0),
    });
    y -= size + 4;
  };

  text(report.headingName, { size: 16, bold: true, color: NAVY_RGB });
  text('DEPARTMENT-WISE MOBILE APP INSTALLATION STATUS REPORT', {
    size: 11,
    bold: true,
    color: NAVY_RGB,
  });
  y -= 4;
  text(`Academic Year: ${report.academicYear?.name ?? 'Not set'}`, {
    size: 10,
  });
  text(`Report Generated On: ${report.generatedLabel}`, { size: 10 });
  y -= 2;
  const note = wrap(font, report.basis, 8, contentWidth);
  for (const line of note) {
    text(line, { size: 8, color: MUTED });
  }
  y -= 6;

  const summaryColumns = [
    { title: 'Sl.', width: 24 },
    { title: 'Department', width: 168 },
    { title: 'Total', width: 52 },
    { title: 'Installed', width: 64 },
    { title: 'Not Installed', width: 80 },
    { title: 'Unverified', width: 78 },
    { title: '%', width: 65 },
  ];
  drawTable(
    summaryColumns,
    report.departments.map((department) => [
      String(department.serial),
      department.name,
      String(department.total),
      String(department.installed),
      String(department.notInstalled),
      String(department.unverified),
      `${department.percent.toFixed(1)}%`,
    ]),
    [false, false, true, true, true, true, true],
  );
  ensure(28);
  text(
    `Total users ${report.summary.total}    Installed ${report.summary.installed}    Not installed ${report.summary.notInstalled}    Unverified ${report.summary.unverified}    Installation ${report.summary.percent.toFixed(1)}%`,
    { size: 9, bold: true },
  );
  if (report.summary.highest) {
    text(
      `Highest: ${report.summary.highest.name} (${report.summary.highest.percent.toFixed(1)}%)    Lowest: ${report.summary.lowest?.name ?? '-'} (${report.summary.lowest?.percent.toFixed(1) ?? '0.0'}%)`,
      { size: 9 },
    );
  }

  const withContacts = scope === 'detailed' || scope === 'department';
  if (scope !== 'summary') {
    for (const department of report.departments) {
      const blocks: Array<{ title: string; rows: InstallationPerson[] }> = [
        {
          title:
            scope === 'pending'
              ? `${department.name} — pending installation`
              : department.name,
          rows: department.people,
        },
      ];
      if (scope === 'pending' && department.followUp.length) {
        blocks.push({
          title: `${department.name} — unverified device information`,
          rows: department.followUp,
        });
      }
      for (const block of blocks) {
        if (!block.rows.length && scope === 'pending') continue;
        ensure(36);
        y -= 8;
        text(block.title, { size: 11, bold: true, color: NAVY_RGB });
        if (!block.rows.length) {
          text('No users in this list.', { size: 9, color: MUTED });
          continue;
        }
        drawPeople(block.rows, withContacts);
      }
    }
  }

  ensure(32);
  y -= 10;
  text('Prepared by: IT Department', { size: 10, bold: true });
  text(report.collegeName, { size: 10 });

  pages.forEach((item, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = font.widthOfTextAtSize(label, 8);
    item.drawLine({
      start: { x: MARGIN, y: 36 },
      end: { x: PAGE_WIDTH - MARGIN, y: 36 },
      thickness: 0.4,
      color: RULE,
    });
    item.drawText(
      `Prepared by: IT Department, ${pdfSafe(report.collegeName)}`,
      {
        x: MARGIN,
        y: 22,
        size: 8,
        font,
        color: MUTED,
      },
    );
    item.drawText(label, {
      x: PAGE_WIDTH - MARGIN - width,
      y: 22,
      size: 8,
      font,
      color: MUTED,
    });
  });

  const bytes = await doc.save();
  return {
    buffer: Buffer.from(bytes),
    filename: fileName(report, scope, 'pdf'),
    contentType: 'application/pdf',
  };

  function drawTable(
    columns: Array<{ title: string; width: number }>,
    rows: string[][],
    right: boolean[],
  ) {
    const paintHeader = () => {
      ensure(18);
      let x = MARGIN;
      page.drawRectangle({
        x: MARGIN,
        y: y - 4,
        width: contentWidth,
        height: 16,
        color: NAVY_RGB,
      });
      columns.forEach((column) => {
        page.drawText(pdfSafe(column.title), {
          x: x + 3,
          y: y,
          size: 8,
          font: bold,
          color: rgb(1, 1, 1),
        });
        x += column.width;
      });
      y -= 16;
    };
    paintHeader();
    rows.forEach((row, index) => {
      if (y - 16 < MARGIN + 34) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        y = PAGE_HEIGHT - MARGIN;
        page.drawText(pdfSafe(report.headingName), {
          x: MARGIN,
          y: y - 10,
          size: 9,
          font: bold,
          color: NAVY_RGB,
        });
        y -= 28;
        paintHeader();
      }
      if (index % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - 4,
          width: contentWidth,
          height: 14,
          color: rgb(0.97, 0.98, 0.99),
        });
      }
      let x = MARGIN;
      row.forEach((value, cell) => {
        const shown = fit(font, value, 8, columns[cell].width - 6);
        const textWidth = font.widthOfTextAtSize(shown, 8);
        const cellX = right[cell]
          ? x + columns[cell].width - textWidth - 4
          : x + 3;
        page.drawText(shown, {
          x: cellX,
          y,
          size: 8,
          font:
            value === 'Installed' ||
            value === 'Not installed' ||
            value === 'Unverified'
              ? bold
              : font,
          color:
            value === 'Installed'
              ? GREEN_RGB
              : value === 'Not installed'
                ? RED_RGB
                : value === 'Unverified'
                  ? GREY_RGB
                  : rgb(0.08, 0.1, 0.14),
        });
        x += columns[cell].width;
      });
      y -= 14;
    });
    if (!rows.length) {
      text('No departments match these filters.', { size: 9, color: MUTED });
    }
  }

  function drawPeople(rows: InstallationPerson[], contacts: boolean) {
    const columns = contacts
      ? [
          { title: 'Sl.', width: 22 },
          { title: 'Name', width: 88 },
          { title: 'Roll / Staff ID', width: 68 },
          { title: 'Designation / Sem', width: 72 },
          { title: 'Email', width: 90 },
          { title: 'Mobile', width: 58 },
          { title: 'Status', width: 52 },
          { title: 'Login', width: 40 },
          { title: 'Active', width: 41 },
        ]
      : [
          { title: 'Sl.', width: 28 },
          { title: 'Name', width: 160 },
          { title: 'Roll / Staff ID', width: 110 },
          { title: 'Designation / Semester', width: 145 },
          { title: 'Status', width: 88 },
        ];
    const body = rows.map((person) =>
      contacts
        ? [
            String(person.serial),
            person.name,
            person.identifier,
            person.roleLabel,
            person.email ?? '-',
            person.mobile ?? '-',
            statusLabel(person.status),
            displayDay(person.lastLoginAt),
            displayDay(person.lastActiveAt),
          ]
        : [
            String(person.serial),
            person.name,
            person.identifier,
            person.roleLabel,
            statusLabel(person.status),
          ],
    );
    const right = columns.map(() => false);
    drawTable(columns, body, right);
  }
}

function statusLabel(status: InstallationPerson['status']) {
  if (status === 'INSTALLED') return 'Installed';
  if (status === 'UNVERIFIED') return 'Unverified';
  return 'Not installed';
}

function displayDay(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function pdfSafe(value: string) {
  const text = value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || '-';
}

function fit(font: PDFFont, value: string, size: number, width: number) {
  const text = pdfSafe(value);
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let next = text;
  while (
    next.length > 1 &&
    font.widthOfTextAtSize(`${next}...`, size) > width
  ) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function wrap(font: PDFFont, value: string, size: number, width: number) {
  const words = pdfSafe(value).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fileName(report: AppInstallationReport, scope: Scope, ext: string) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(report.generatedAt));
  return `dbc-app-installation-${scope}-${day}.${ext}`;
}
