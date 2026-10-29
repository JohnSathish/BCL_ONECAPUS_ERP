import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';
import {
  csvDocument,
  type ReportPayload,
} from './library-catalogue-report.logic';

export async function exportCatalogueReport(
  payload: ReportPayload,
  format: 'xlsx' | 'csv' | 'pdf',
) {
  if (format === 'csv')
    return {
      body: Buffer.from(toCsv(payload), 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  if (format === 'pdf') {
    return {
      body: await toPdf(payload),
      contentType: 'application/pdf',
      extension: 'pdf',
    };
  }
  return {
    body: await toExcel(payload),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  };
}

function toCsv(payload: ReportPayload) {
  const preamble = [
    payload.institutionName,
    payload.title,
    `Generated ${payload.generatedAt}`,
    payload.filters,
    ...payload.notes,
  ];
  return csvDocument(
    payload.columns.map((column) => column.label),
    payload.rows.map((row) =>
      payload.columns.map((column) => String(row[column.key] ?? '')),
    ),
    preamble,
  );
}

async function toExcel(payload: ReportPayload) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(payload.title.slice(0, 31) || 'Report');
  sheet.addRow([payload.institutionName]);
  sheet.addRow([payload.title]);
  sheet.addRow([`Generated ${payload.generatedAt}`]);
  sheet.addRow([payload.filters]);
  for (const note of payload.notes) sheet.addRow([note]);
  sheet.addRow([]);
  const header = sheet.addRow(payload.columns.map((column) => column.label));
  header.font = { bold: true };
  for (const row of payload.rows) {
    const added = sheet.addRow(
      payload.columns.map((column) => row[column.key] ?? ''),
    );
    payload.columns.forEach((column, index) => {
      if (column.text) {
        const cell = added.getCell(index + 1);
        cell.numFmt = '@';
        cell.value = String(row[column.key] ?? '');
      }
    });
  }
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function toPdf(payload: ReportPayload) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const rowHeight = 14;
  let page = doc.addPage([pageWidth, pageHeight]);
  let pageNumber = 1;
  let y = pageHeight - margin;
  const columns = fitColumns(payload.columns, pageWidth - margin * 2);

  const drawHeader = () => {
    page.drawText(payload.institutionName, {
      x: margin,
      y,
      size: 13,
      font: bold,
      color: rgb(0.1, 0.12, 0.16),
    });
    y -= 16;
    page.drawText(payload.title, { x: margin, y, size: 11, font: bold });
    y -= 13;
    page.drawText(
      `Generated ${payload.generatedAt.slice(0, 16).replace('T', ' ')}    ${payload.filters}`,
      {
        x: margin,
        y,
        size: 8,
        font,
        color: rgb(0.25, 0.28, 0.33),
      },
    );
    y -= 12;
    for (const note of payload.notes.slice(0, 3)) {
      page.drawText(clip(note, 140), {
        x: margin,
        y,
        size: 8,
        font,
        color: rgb(0.25, 0.28, 0.33),
      });
      y -= 11;
    }
    y -= 4;
    drawColumnHeader();
  };

  const drawColumnHeader = () => {
    let x = margin;
    for (const column of columns) {
      page.drawText(clip(column.label, Math.floor(column.width / 4.2)), {
        x,
        y,
        size: 7,
        font: bold,
      });
      x += column.width;
    }
    y -= rowHeight;
  };

  const footer = () => {
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - margin - 40,
      y: 16,
      size: 8,
      font,
    });
    page.drawText(`Rows ${payload.rows.length} of ${payload.total}`, {
      x: margin,
      y: 16,
      size: 8,
      font,
    });
  };

  drawHeader();
  for (const row of payload.rows) {
    if (y < 48) {
      footer();
      pageNumber += 1;
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    let x = margin;
    for (const column of columns) {
      page.drawText(
        clip(String(row[column.key] ?? ''), Math.floor(column.width / 4.2)),
        {
          x,
          y,
          size: 7,
          font,
        },
      );
      x += column.width;
    }
    y -= rowHeight;
  }
  if (payload.formal) {
    y -= 28;
    if (y < 70) {
      footer();
      page = doc.addPage([pageWidth, pageHeight]);
      pageNumber += 1;
      y = pageHeight - margin;
    }
    page.drawText('Librarian _______________________', {
      x: margin,
      y,
      size: 9,
      font,
    });
    page.drawText('Principal _______________________', {
      x: margin + 280,
      y,
      size: 9,
      font,
    });
  }
  footer();
  return Buffer.from(await doc.save());
}

function fitColumns(columns: ReportPayload['columns'], width: number) {
  const share = width / Math.max(columns.length, 1);
  return columns.map((column) => ({ ...column, width: share }));
}

function clip(value: string, length: number) {
  const clean = value.replace(/[^\x20-\x7E]/g, ' ');
  return clean.length > length
    ? `${clean.slice(0, Math.max(1, length - 3))}...`
    : clean;
}
