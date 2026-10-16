import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type AttendancePdfColumn = {
  key: string;
  label: string;
  width: number;
};

export async function buildAttendanceReportPdf(input: {
  institutionName: string;
  title: string;
  periodLabel: string;
  generatedAt: Date;
  summaryLines: string[];
  columns: AttendancePdfColumn[];
  rows: Array<Record<string, unknown>>;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const rowHeight = 16;
  const generated = input.generatedAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(input.institutionName, {
      x: margin,
      y,
      size: 14,
      font: bold,
      color: rgb(0.12, 0.23, 0.54),
    });
    y -= 18;
    page.drawText(input.title, { x: margin, y, size: 12, font: bold });
    y -= 14;
    page.drawText(`${input.periodLabel}    Generated ${generated}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.28, 0.33, 0.41),
    });
    y -= 14;
    for (const line of input.summaryLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 8,
        font,
        color: rgb(0.2, 0.24, 0.3),
      });
      y -= 11;
    }
    y -= 6;
    drawTableHeader();
  };

  const drawTableHeader = () => {
    let x = margin;
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: pageWidth - margin * 2,
      height: rowHeight,
      color: rgb(0.12, 0.23, 0.54),
    });
    for (const column of input.columns) {
      page.drawText(column.label, {
        x: x + 2,
        y: y,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    }
    y -= rowHeight;
  };

  drawHeader();
  input.rows.forEach((row, index) => {
    if (y < margin + rowHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    if (index % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(0.95, 0.97, 1),
      });
    }
    let x = margin;
    for (const column of input.columns) {
      const raw = row[column.key];
      const text = String(raw ?? '').slice(
        0,
        Math.max(8, Math.floor(column.width / 5)),
      );
      page.drawText(text, {
        x: x + 2,
        y,
        size: 8,
        font,
        color: rgb(0.1, 0.12, 0.16),
      });
      x += column.width;
    }
    y -= rowHeight;
  });

  if (!input.rows.length) {
    page.drawText('No attendance rows for this period.', {
      x: margin,
      y,
      size: 10,
      font,
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
