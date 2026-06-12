import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import puppeteer from 'puppeteer';

export type InstitutionHeader = {
  name: string;
  address?: string | null;
  contact?: string | null;
  logoUrl?: string | null;
};

export type LoanReceiptData = {
  receiptNumber: string;
  receiptDate: Date;
  financialYear: string;
  staffName: string;
  employeeCode: string;
  department: string;
  designation: string;
  loanNumber: string;
  loanType: string;
  loanSanctionDate: Date;
  originalAmount: number;
  paymentDate: Date;
  paymentAmount: number;
  paymentMode: string;
  transactionReference?: string | null;
  remarks?: string | null;
  recoveredBefore: number;
  recoveredAfter: number;
  outstandingAfter: number;
  loanStatus: string;
  preparedBy?: string | null;
};

export type LoanClosureCertificateData = {
  certificateNumber: string;
  issueDate: Date;
  staffName: string;
  employeeCode: string;
  department: string;
  loanNumber: string;
  loanType: string;
  originalAmount: number;
  totalRecovered: number;
  closureDate: Date;
  institution: InstitutionHeader;
};

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  SALARY_DEDUCTION: 'Salary Deduction',
};

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function financialYearLabel(d: Date): string {
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  if (m >= 4) return `FY ${y}-${String(y + 1).slice(-2)}`;
  return `FY ${y - 1}-${String(y).slice(-2)}`;
}

@Injectable()
export class LoansReceiptDocumentService {
  private readonly uploadRoot = join(process.cwd(), 'uploads', 'tenants');

  buildReceiptHtml(
    data: LoanReceiptData,
    institution: InstitutionHeader,
  ): string {
    const modeLabel =
      MODE_LABELS[data.paymentMode] ?? data.paymentMode.replace(/_/g, ' ');
    const statusLabel =
      data.loanStatus === 'CLOSED' || data.outstandingAfter <= 0
        ? 'Closed'
        : 'Active';
    const message = `Received with thanks from <strong>${data.staffName}</strong> an amount of <strong>${inr(data.paymentAmount)}</strong> towards repayment of <strong>${data.loanType}</strong>. Outstanding loan balance after this payment: <strong>${inr(data.outstandingAfter)}</strong>.`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.receiptNumber}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px;color:#1a1a2e;font-size:13px}
  .sheet{max-width:720px;margin:0 auto;border:2px solid #1e40af;padding:28px;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #1e40af;padding-bottom:16px;margin-bottom:20px}
  .logo{max-height:56px;max-width:160px}
  .inst-name{font-size:20px;font-weight:700;color:#1e40af;margin:0 0 4px}
  .inst-meta{font-size:11px;color:#555;line-height:1.5}
  .receipt-title{text-align:center;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1e40af;margin:16px 0}
  .receipt-no{text-align:center;font-size:14px;font-weight:600;margin-bottom:4px}
  .meta-row{display:flex;justify-content:space-between;font-size:11px;color:#444;margin-bottom:16px}
  .section{margin-bottom:16px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#1e40af;border-bottom:1px solid #dbeafe;padding-bottom:4px;margin-bottom:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}
  .field{display:flex;gap:8px;font-size:12px}
  .field label{color:#666;min-width:120px}
  .field span{font-weight:500}
  .summary{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;margin:20px 0}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center}
  .summary-grid .val{font-size:15px;font-weight:700;color:#1e40af}
  .summary-grid .lbl{font-size:10px;color:#666;text-transform:uppercase}
  .message{background:#fefce8;border-left:4px solid #eab308;padding:12px 14px;font-size:12px;line-height:1.6;margin:20px 0}
  .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:40px;padding-top:16px}
  .sig{text-align:center;font-size:11px}
  .sig-line{border-top:1px solid #333;margin-top:48px;padding-top:6px;font-weight:600}
  .seal{margin-top:32px;text-align:center;font-size:10px;color:#888;border:1px dashed #ccc;padding:12px;display:inline-block;width:100%}
  .footer{margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px}
  .status-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${statusLabel === 'Closed' ? '#dcfce7' : '#dbeafe'};color:${statusLabel === 'Closed' ? '#166534' : '#1e40af'}}
</style></head><body>
<div class="sheet">
  <div class="header">
    <div>
      ${institution.logoUrl ? `<img class="logo" src="${institution.logoUrl}" alt="" />` : ''}
      <p class="inst-name">${institution.name}</p>
      ${institution.address ? `<p class="inst-meta">${institution.address}</p>` : ''}
      ${institution.contact ? `<p class="inst-meta">${institution.contact}</p>` : ''}
    </div>
    <div style="text-align:right;font-size:11px;color:#555">
      <div>${financialYearLabel(data.receiptDate)}</div>
    </div>
  </div>
  <div class="receipt-title">Loan Repayment Receipt</div>
  <div class="receipt-no">${data.receiptNumber}</div>
  <div class="meta-row">
    <span>Receipt Date: ${fmtDateTime(data.receiptDate)}</span>
    <span>Payment Date: ${fmtDate(data.paymentDate)}</span>
  </div>

  <div class="section">
    <div class="section-title">Staff Information</div>
    <div class="grid">
      <div class="field"><label>Staff Name</label><span>${data.staffName}</span></div>
      <div class="field"><label>Employee ID</label><span>${data.employeeCode}</span></div>
      <div class="field"><label>Department</label><span>${data.department}</span></div>
      <div class="field"><label>Designation</label><span>${data.designation}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Loan Information</div>
    <div class="grid">
      <div class="field"><label>Loan Number</label><span>${data.loanNumber}</span></div>
      <div class="field"><label>Loan Type</label><span>${data.loanType}</span></div>
      <div class="field"><label>Sanction Date</label><span>${fmtDate(data.loanSanctionDate)}</span></div>
      <div class="field"><label>Original Amount</label><span>${inr(data.originalAmount)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Information</div>
    <div class="grid">
      <div class="field"><label>Amount Paid</label><span><strong>${inr(data.paymentAmount)}</strong></span></div>
      <div class="field"><label>Payment Mode</label><span>${modeLabel}</span></div>
      ${data.transactionReference ? `<div class="field"><label>Reference No.</label><span>${data.transactionReference}</span></div>` : ''}
      ${data.remarks ? `<div class="field" style="grid-column:1/-1"><label>Remarks</label><span>${data.remarks}</span></div>` : ''}
    </div>
  </div>

  <div class="summary">
    <div class="section-title" style="border:none;margin-bottom:12px">Loan Status Summary</div>
    <div class="summary-grid">
      <div><div class="lbl">Recovered Before</div><div class="val">${inr(data.recoveredBefore)}</div></div>
      <div><div class="lbl">This Payment</div><div class="val">${inr(data.paymentAmount)}</div></div>
      <div><div class="lbl">Total Recovered</div><div class="val">${inr(data.recoveredAfter)}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid #bae6fd">
      <div><span style="color:#666;font-size:11px">Outstanding Balance</span><br/><strong style="font-size:18px;color:#b45309">${inr(data.outstandingAfter)}</strong></div>
      <div>Status: <span class="status-badge">${statusLabel}</span></div>
    </div>
  </div>

  <div class="message">${message}</div>

  <div class="signatures">
    <div class="sig"><div class="sig-line">Prepared By</div>Administrative Officer</div>
    <div class="sig"><div class="sig-line">Accounts Officer</div></div>
    <div class="sig"><div class="sig-line">Authorized Signatory</div></div>
  </div>
  <div class="seal">Institution Seal</div>
  ${data.preparedBy ? `<p class="footer">Recorded by: ${data.preparedBy}</p>` : ''}
  <p class="footer">This is a computer-generated receipt and is valid without physical signature when digitally issued.</p>
</div></body></html>`;
  }

  buildClosureCertificateHtml(data: LoanClosureCertificateData): string {
    const inst = data.institution;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loan Closure - ${data.loanNumber}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:40px;color:#1a1a2e}
  .cert{max-width:720px;margin:0 auto;border:3px double #1e40af;padding:36px}
  .header{text-align:center;border-bottom:2px solid #1e40af;padding-bottom:20px;margin-bottom:24px}
  .logo{max-height:64px}
  h1{font-size:22px;color:#1e40af;margin:12px 0 4px;letter-spacing:1px}
  h2{font-size:14px;font-weight:normal;color:#555;margin:0}
  .cert-no{text-align:center;font-size:13px;margin:20px 0;font-weight:600}
  .body-text{font-size:13px;line-height:1.8;text-align:justify;margin:24px 0}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{border:1px solid #ddd;padding:8px 12px;font-size:12px;text-align:left}
  th{background:#f0f9ff;width:40%}
  .declaration{background:#f0fdf4;border:1px solid #86efac;padding:16px;border-radius:8px;font-size:13px;margin:24px 0;text-align:center}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
  .sig-line{border-top:1px solid #333;margin-top:56px;padding-top:8px;font-size:12px;font-weight:600;text-align:center}
  .footer{text-align:center;font-size:10px;color:#888;margin-top:32px}
</style></head><body>
<div class="cert">
  <div class="header">
    ${inst.logoUrl ? `<img class="logo" src="${inst.logoUrl}" alt="" />` : ''}
    <h1>${inst.name}</h1>
    ${inst.address ? `<h2>${inst.address}</h2>` : ''}
    <h2 style="margin-top:16px;font-weight:700;color:#1e40af">LOAN CLEARANCE CERTIFICATE</h2>
  </div>
  <div class="cert-no">Certificate No: ${data.certificateNumber} &nbsp;|&nbsp; Date: ${fmtDate(data.issueDate)}</div>
  <table>
    <tr><th>Staff Name</th><td>${data.staffName}</td></tr>
    <tr><th>Employee ID</th><td>${data.employeeCode}</td></tr>
    <tr><th>Department</th><td>${data.department}</td></tr>
    <tr><th>Loan Number</th><td>${data.loanNumber}</td></tr>
    <tr><th>Loan Type</th><td>${data.loanType}</td></tr>
    <tr><th>Original Loan Amount</th><td>${inr(data.originalAmount)}</td></tr>
    <tr><th>Total Amount Recovered</th><td>${inr(data.totalRecovered)}</td></tr>
    <tr><th>Loan Closure Date</th><td>${fmtDate(data.closureDate)}</td></tr>
  </table>
  <div class="declaration">
    This is to certify that the loan availed by the above employee has been <strong>fully repaid</strong>
    and <strong>no outstanding balance remains</strong> as on the date of issue.
  </div>
  <div class="sigs">
    <div><div class="sig-line">Administrative Officer</div></div>
    <div><div class="sig-line">Accounts Officer</div></div>
  </div>
  <p class="footer">Institution Seal — Computer-generated certificate</p>
</div></body></html>`;
  }

  async renderPdfToBuffer(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async persistPdf(
    tenantId: string,
    subfolder: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(this.uploadRoot, tenantId, subfolder);
    await mkdir(dir, { recursive: true });
    const absPath = join(dir, filename);
    await writeFile(absPath, buffer);
    return `/uploads/tenants/${tenantId}/${subfolder}/${filename}`;
  }
}
