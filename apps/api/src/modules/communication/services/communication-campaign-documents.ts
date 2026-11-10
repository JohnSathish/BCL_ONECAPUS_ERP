import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

export type CampaignReportFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export type CampaignReportRecipient = {
  name: string;
  email: string;
  identifier: string;
  department: string;
  role: string;
  status: string;
  sentAt: string;
  deliveredAt: string;
  failureReason: string;
};

export type CampaignReportInput = {
  name: string;
  id: string;
  status: string;
  typeLabel: string;
  channels: string;
  audience: string;
  createdBy: string;
  createdAt: string;
  scheduledAt: string;
  sentAt: string;
  subject: string;
  body: string;
  total: number;
  confirmed: number;
  accepted: number;
  pending: number;
  failed: number;
  opened: number;
  recipients: CampaignReportRecipient[];
  recipientTotal: number;
  truncated: boolean;
};

const NAVY = rgb(0.04, 0.11, 0.27);
const BLUE = rgb(0.08, 0.37, 0.94);
const MUTED = rgb(0.28, 0.33, 0.4);
const LINE = rgb(0.86, 0.89, 0.93);

function safeName(value: string) {
  const cleaned = value
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return (cleaned || 'campaign').slice(0, 48);
}

export async function buildCampaignRecipientWorkbook(
  report: CampaignReportInput,
): Promise<CampaignReportFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'College ERP Communication Center';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Recipients');
  sheet.addRow(['Campaign', report.name]);
  sheet.addRow(['Campaign ID', report.id]);
  sheet.addRow(['Status', report.status]);
  sheet.addRow(['Sent', report.sentAt]);
  sheet.addRow(['Subject', report.subject]);
  sheet.addRow(['Message', report.body]);
  sheet.addRow([]);
  const header = sheet.addRow([
    'Sl. No.',
    'Recipient',
    'Email',
    'Roll / Staff ID',
    'Department',
    'Role',
    'Status',
    'Sent at',
    'Delivered at',
    'Failure reason',
  ]);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF155EEF' },
    };
  });
  report.recipients.forEach((row, index) => {
    sheet.addRow([
      index + 1,
      row.name,
      row.email,
      row.identifier,
      row.department,
      row.role,
      row.status,
      row.sentAt,
      row.deliveredAt,
      row.failureReason,
    ]);
  });
  if (report.truncated) {
    sheet.addRow([]);
    sheet.addRow([
      `Export includes ${report.recipients.length.toLocaleString('en-IN')} of ${report.recipientTotal.toLocaleString('en-IN')} matching recipients.`,
    ]);
  }
  sheet.columns = [
    { width: 10 },
    { width: 32 },
    { width: 36 },
    { width: 20 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
    { width: 22 },
    { width: 42 },
  ];
  sheet.getRow(6).alignment = { wrapText: true, vertical: 'top' };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    filename: `${safeName(report.name)}-recipients.xlsx`,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function buildCampaignReportPdf(
  report: CampaignReportInput,
): Promise<CampaignReportFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  const next = (needed = 16) => {
    if (y >= needed) return;
    page = doc.addPage([595, 842]);
    y = 800;
  };

  const write = (
    text: string,
    size: number,
    face: PDFFont = font,
    color = MUTED,
    x = 40,
  ) => {
    const lines = wrap(text, face, size, 515);
    for (const line of lines) {
      next(40);
      page.drawText(line, { x, y, size, font: face, color });
      y -= size + 4;
    }
  };

  page.drawText('Campaign report', {
    x: 40,
    y,
    size: 18,
    font: bold,
    color: NAVY,
  });
  y -= 26;
  write(report.name, 13, bold, NAVY);
  write(`${report.status}  ·  ${report.id}`, 9);
  y -= 6;
  page.drawRectangle({ x: 40, y, width: 515, height: 1, color: LINE });
  y -= 16;
  write(`Type: ${report.typeLabel}`, 10);
  write(`Channel: ${report.channels}`, 10);
  write(`Audience: ${report.audience}`, 10);
  write(`Created by: ${report.createdBy}`, 10);
  write(`Created: ${report.createdAt}`, 10);
  write(`Scheduled: ${report.scheduledAt}`, 10);
  write(`Sent: ${report.sentAt}`, 10);
  y -= 6;
  write('Original message', 12, bold, BLUE);
  write(report.subject || report.name, 11, bold, NAVY);
  write(report.body || 'No message body was stored for this campaign.', 10);
  y -= 8;
  write('Delivery summary', 12, bold, BLUE);
  write(
    `Recipients ${report.total.toLocaleString('en-IN')}   Delivered ${report.confirmed.toLocaleString('en-IN')}   Accepted ${report.accepted.toLocaleString('en-IN')}   Pending ${report.pending.toLocaleString('en-IN')}   Failed ${report.failed.toLocaleString('en-IN')}${report.opened ? `   Opened ${report.opened.toLocaleString('en-IN')}` : ''}`,
    10,
  );
  write(
    'Delivered means an inbox copy or a provider delivery receipt. Accepted means the push service took the request without a delivery receipt.',
    8,
  );
  y -= 8;
  write('Recipients', 12, bold, BLUE);
  if (report.truncated) {
    write(
      `Showing ${report.recipients.length.toLocaleString('en-IN')} of ${report.recipientTotal.toLocaleString('en-IN')} matching recipients. Download the Excel file for the full filtered list.`,
      8,
    );
  }
  for (const [index, row] of report.recipients.entries()) {
    next(36);
    write(
      `${index + 1}. ${row.name}  ·  ${row.role}  ·  ${row.status}`,
      9,
      bold,
      NAVY,
    );
    write(
      [
        row.identifier,
        row.department,
        row.email,
        row.deliveredAt || row.sentAt,
        row.failureReason,
      ]
        .filter(Boolean)
        .join('  ·  '),
      8,
    );
  }

  const bytes = await doc.save();
  return {
    buffer: Buffer.from(bytes),
    filename: `${safeName(report.name)}-report.pdf`,
    contentType: 'application/pdf',
  };
}

function wrap(text: string, face: PDFFont, size: number, width: number) {
  const source = (text || '—').replace(/\s+/g, ' ').trim() || '—';
  const words = source.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (face.widthOfTextAtSize(next, size) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 80);
}
