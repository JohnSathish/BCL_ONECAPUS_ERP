import ExcelJS from 'exceljs';

/** Shared institutional theme for all BCL OneCampus ERP Excel exports. */
export const INSTITUTIONAL_EXCEL_THEME = {
  headerBg: 'FF1E3A8A',
  headerFg: 'FFFFFFFF',
  zebraBg: 'FFF7FAFF',
  border: 'FFD6D6D6',
  titleFg: 'FF1E3A8A',
  mutedFg: 'FF475569',
  highlight: {
    rollNumber: 'FFDBEAFE',
    fullName: 'FFFEF9C3',
    majorDepartment: 'FFDCFCE7',
    currentSemester: 'FFEDE9FE',
    abcId: 'FFFFEDD5',
  } as Record<string, string>,
  status: {
    PRESENT: 'FFDCFCE7',
    PAID: 'FFDCFCE7',
    PASS: 'FFDCFCE7',
    CLEAR: 'FFDCFCE7',
    ABSENT: 'FFFEE2E2',
    FAIL: 'FFFEE2E2',
    OVERDUE: 'FFFEE2E2',
    LEAVE: 'FFFEF9C3',
    PENDING: 'FFFFEDD5',
    DUE: 'FFFFEDD5',
    PARTIAL: 'FFFFEDD5',
  } as Record<string, string>,
};

export type InstitutionalReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
};

export type InstitutionalReportMeta = {
  institutionName?: string;
  institutionTagline?: string;
  productName?: string;
  reportTitle: string;
  reportIcon?: string;
  academicYear?: string;
  semester?: string;
  programme?: string;
  department?: string;
  shift?: string;
  generatedBy?: string;
  generatedAt?: Date;
  /** Extra filter lines shown under the header. */
  filterLines?: Array<{ label: string; value: string }>;
  /** Summary stats (right-side style block under header). */
  summary?: Record<string, string | number>;
  author?: string;
  company?: string;
};

export type InstitutionalSheetInput = {
  name: string;
  columns: InstitutionalReportColumn[];
  rows: Record<string, unknown>[];
};

export type InstitutionalWorkbookInput = {
  meta: InstitutionalReportMeta;
  sheets: InstitutionalSheetInput[];
  filenameBase?: string;
};

const CENTER_KEYS = new Set([
  'rollnumber',
  'enrollmentnumber',
  'universityrollnumber',
  'universityregistrationnumber',
  'gender',
  'bloodgroup',
  'dateofbirth',
  'admissiondate',
  'mobilenumber',
  'mobile',
  'currentsemester',
  'semester',
  'age',
  'feestatus',
  'abcverified',
  'category',
]);

const RIGHT_KEYS = new Set([
  'feedueamount',
  'percentage',
  'boardpercentage',
  'cuetscore',
  'attendancepercent',
  'marks',
  'amount',
  'total',
]);

const WRAP_KEYS = new Set([
  'permanentaddress',
  'presentaddress',
  'address',
  'fullname',
]);

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function cellText(value: unknown): string | number | boolean {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  return iso?.[1] ?? text;
}

function alignmentFor(key: string): 'left' | 'center' | 'right' {
  const n = normalizeKey(key);
  if (CENTER_KEYS.has(n)) return 'center';
  if (RIGHT_KEYS.has(n)) return 'right';
  return 'left';
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: INSTITUTIONAL_EXCEL_THEME.border },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function formatGeneratedAt(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function slugFilename(name: string) {
  const slug = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'institutional-report';
}

function buildDefaultSummary(
  rows: Record<string, unknown>[],
): Record<string, string | number> {
  const summary: Record<string, string | number> = {
    Students: rows.length,
  };
  let male = 0;
  let female = 0;
  const departments = new Set<string>();
  for (const row of rows) {
    const gender = String(row.gender ?? '')
      .trim()
      .toUpperCase();
    if (gender === 'MALE' || gender === 'M') male += 1;
    if (gender === 'FEMALE' || gender === 'F') female += 1;
    const dept = String(row.department ?? row.majorDepartment ?? '').trim();
    if (dept) departments.add(dept);
  }
  if (male || female) {
    summary.Male = male;
    summary.Female = female;
  }
  if (departments.size) summary.Departments = departments.size;
  return summary;
}

/**
 * Global Excel report builder for BCL OneCampus ERP.
 * Use for Students, Staff, Finance, Attendance, Examinations, Library, etc.
 */
export async function buildInstitutionalExcelReport(
  input: InstitutionalWorkbookInput,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = input.meta.generatedAt ?? new Date();
  const institutionName =
    input.meta.institutionName?.trim() || 'Don Bosco College, Tura';
  const productName = input.meta.productName?.trim() || 'BCL OneCampus ERP';
  const reportTitle = input.meta.reportTitle.trim() || 'Institutional Report';
  const icon = input.meta.reportIcon ? `${input.meta.reportIcon} ` : '';

  workbook.creator = input.meta.author ?? productName;
  workbook.lastModifiedBy = input.meta.author ?? productName;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.company = input.meta.company ?? 'BaseCode Labs Pvt. Ltd.';
  workbook.title = reportTitle;
  workbook.subject = `${institutionName} — ${reportTitle}`;
  workbook.description = `Generated by ${productName}`;
  workbook.keywords = 'BCL OneCampus ERP, BaseCode Labs, institutional report';

  for (const sheetInput of input.sheets) {
    const sheetName = sheetInput.name.slice(0, 31) || 'Report';
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 0 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        paperSize: 9,
      },
      headerFooter: {
        oddFooter: `&LGenerated by ${productName} — Powered by BaseCode Labs Pvt. Ltd.&C&D &T&RPage &P of &N`,
      },
    });

    const colCount = Math.max(sheetInput.columns.length, 1);
    const summary = input.meta.summary ?? buildDefaultSummary(sheetInput.rows);

    // Institution header block
    const r1 = sheet.addRow([institutionName.toUpperCase()]);
    r1.font = {
      bold: true,
      size: 16,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.titleFg },
    };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(r1.number, 1, r1.number, colCount);

    const r2 = sheet.addRow([
      input.meta.institutionTagline ??
        'Affiliated to NEHU | NAAC Accredited | Meghalaya',
    ]);
    r2.font = {
      size: 10,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.mutedFg },
    };
    r2.alignment = { horizontal: 'center' };
    sheet.mergeCells(r2.number, 1, r2.number, colCount);

    sheet.addRow([]);

    const r4 = sheet.addRow([productName]);
    r4.font = {
      bold: true,
      size: 12,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.titleFg },
    };
    r4.alignment = { horizontal: 'center' };
    sheet.mergeCells(r4.number, 1, r4.number, colCount);

    const r5 = sheet.addRow([`${icon}${reportTitle}`]);
    r5.font = {
      bold: true,
      size: 14,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.titleFg },
    };
    r5.alignment = { horizontal: 'center' };
    sheet.mergeCells(r5.number, 1, r5.number, colCount);

    sheet.addRow([]);

    const metaLines: Array<[string, string]> = [];
    if (input.meta.academicYear) {
      metaLines.push(['Academic Year', input.meta.academicYear]);
    }
    if (input.meta.semester) metaLines.push(['Semester', input.meta.semester]);
    if (input.meta.programme) {
      metaLines.push(['Programme', input.meta.programme]);
    }
    if (input.meta.department) {
      metaLines.push(['Department', input.meta.department]);
    }
    if (input.meta.shift) metaLines.push(['Shift', input.meta.shift]);
    for (const line of input.meta.filterLines ?? []) {
      if (line.value) metaLines.push([line.label, line.value]);
    }
    metaLines.push(['Generated On', formatGeneratedAt(generatedAt)]);
    if (input.meta.generatedBy) {
      metaLines.push(['Generated By', input.meta.generatedBy]);
    }
    metaLines.push(['Total Records', String(sheetInput.rows.length)]);

    const summaryEntries = Object.entries(summary);
    const metaStart = sheet.rowCount + 1;
    const metaRows = Math.max(metaLines.length, summaryEntries.length);
    for (let i = 0; i < metaRows; i++) {
      const left = metaLines[i];
      const right = summaryEntries[i];
      const values: (string | number)[] = new Array(colCount).fill('');
      if (left) {
        values[0] = `${left[0]} :`;
        values[1] = left[1];
      }
      if (right && colCount >= 4) {
        values[colCount - 2] = `${right[0]} :`;
        values[colCount - 1] = right[1];
      }
      const row = sheet.addRow(values);
      row.font = { size: 10 };
      if (left) {
        row.getCell(1).font = { bold: true, size: 10 };
      }
      if (right && colCount >= 4) {
        row.getCell(colCount - 1).font = { bold: true, size: 10 };
        row.getCell(colCount).font = {
          bold: true,
          size: 10,
          color: { argb: INSTITUTIONAL_EXCEL_THEME.titleFg },
        };
      }
    }

    sheet.addRow([]);

    const headerRowNumber = sheet.rowCount + 1;
    const headerRow = sheet.addRow(sheetInput.columns.map((c) => c.label));
    headerRow.height = 25;
    headerRow.font = {
      bold: true,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.headerFg },
      size: 11,
    };
    for (let i = 1; i <= colCount; i++) {
      const cell = headerRow.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: INSTITUTIONAL_EXCEL_THEME.headerBg },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = thinBorder();
    }

    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: colCount },
    };
    sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

    sheetInput.rows.forEach((rowData, index) => {
      const values = sheetInput.columns.map((col) =>
        cellText(rowData[col.key]),
      );
      const row = sheet.addRow(values);
      row.height = 22;
      const zebra = index % 2 === 1;
      sheetInput.columns.forEach((col, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        const key = col.key;
        const align = col.align ?? alignmentFor(key);
        cell.alignment = {
          vertical: 'middle',
          horizontal: align,
          wrapText: WRAP_KEYS.has(normalizeKey(key)),
        };
        cell.border = thinBorder();
        cell.font = { size: 10 };

        const highlight = INSTITUTIONAL_EXCEL_THEME.highlight[key];
        if (highlight) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: highlight },
          };
        } else if (zebra) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: INSTITUTIONAL_EXCEL_THEME.zebraBg },
          };
        }

        const statusKey = String(cellText(rowData[key])).trim().toUpperCase();
        const statusFill = INSTITUTIONAL_EXCEL_THEME.status[statusKey];
        if (statusFill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusFill },
          };
          cell.font = { size: 10, bold: true };
        }
      });
    });

    sheet.addRow([]);
    const footer1 = sheet.addRow([
      `Generated by ${productName} — Powered by BaseCode Labs Pvt. Ltd.`,
    ]);
    footer1.font = {
      italic: true,
      size: 9,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.mutedFg },
    };
    sheet.mergeCells(footer1.number, 1, footer1.number, colCount);

    const footer2 = sheet.addRow([
      `https://basecodelabs.com  |  Generated on ${formatGeneratedAt(generatedAt)}  |  ${institutionName}`,
    ]);
    footer2.font = {
      size: 9,
      color: { argb: INSTITUTIONAL_EXCEL_THEME.mutedFg },
    };
    sheet.mergeCells(footer2.number, 1, footer2.number, colCount);

    // Auto width with sensible bounds
    sheetInput.columns.forEach((col, index) => {
      const column = sheet.getColumn(index + 1);
      let max = col.label.length;
      for (const row of sheetInput.rows.slice(0, 200)) {
        const text = String(cellText(row[col.key]) ?? '');
        max = Math.max(max, Math.min(text.length, 48));
      }
      column.width = Math.min(42, Math.max(12, max + 2));
    });

    // Light separator under meta block (row above column headers)
    const separatorRow = headerRowNumber - 1;
    if (separatorRow >= metaStart) {
      for (let c = 1; c <= colCount; c++) {
        sheet.getRow(separatorRow).getCell(c).border = {
          bottom: {
            style: 'thin',
            color: { argb: INSTITUTIONAL_EXCEL_THEME.headerBg },
          },
        };
      }
    }
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    filename: `${slugFilename(input.filenameBase ?? reportTitle)}.xlsx`,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
