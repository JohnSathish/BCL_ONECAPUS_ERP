export const APPOINTMENT_ORDER_STYLES = `
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; color: #111; margin: 0; }
  .letter { max-width: 180mm; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 16px; }
  .header img { height: 72px; }
  .header h1 { margin: 4px 0; font-size: 20pt; letter-spacing: 1px; }
  .header .sub { font-size: 10pt; color: #444; }
  .meta { display: flex; justify-content: space-between; margin: 16px 0; font-size: 11pt; }
  .address { margin: 16px 0; line-height: 1.5; }
  .subject { margin: 20px 0; font-weight: bold; text-decoration: underline; }
  .body { line-height: 1.7; text-align: justify; }
  .body p { margin: 0 0 12px; }
  .salary-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  .salary-table th, .salary-table td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  .terms { margin-top: 16px; font-size: 10.5pt; }
  .terms ol { padding-left: 20px; }
  .acceptance { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 10pt; }
  .signature { margin-top: 40px; text-align: right; }
  .verify { margin-top: 24px; text-align: center; font-size: 9pt; color: #555; }
  .verify img { width: 80px; height: 80px; }
`;

export const DEFAULT_APPOINTMENT_BODY = `
<p>Dear {{staff_name}},</p>
<p>
  With reference to your application for the post of <strong>{{designation}}</strong> in the
  <strong>{{department}}</strong> Department ({{shift}} Shift), I am pleased to inform you that you have been
  appointed as <strong>{{designation}}</strong> in this College with effect from
  <strong>{{joining_date}}</strong> on a consolidated salary of <strong>{{salary}}</strong> per month.
</p>
{{salary_table}}
{{terms_block}}
<p>You are to join duty on <strong>{{joining_date}}</strong> and submit a Joining Report.</p>
`;

export const DEFAULT_TERMS_TEACHING = `
<ol>
  <li>The appointment is purely temporary and subject to approval by the Governing Body.</li>
  <li>You will perform duties as assigned by the Principal in the Degree or Higher Secondary Section.</li>
  <li>You shall practice Don Bosco's Preventive System of education.</li>
  <li>Either party may terminate with one month's notice or pay in lieu thereof.</li>
</ol>
`;

export const DEFAULT_TERMS_NON_TEACHING = `
<ol>
  <li>The appointment is subject to verification of documents and Governing Body approval.</li>
  <li>You will perform duties as assigned by the Principal or Head of Office.</li>
  <li>Either party may terminate with one month's notice or pay in lieu thereof.</li>
</ol>
`;

export function renderTemplate(html: string, vars: Record<string, string>) {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value ?? '');
  }
  return out.replace(/\{\{[a-z_]+\}\}/g, '');
}

export function buildSalaryTableHtml(
  lines: Array<{ name: string; amount: number; componentType?: string }>,
) {
  if (!lines.length) return '';
  const rows = lines
    .map(
      (l) =>
        `<tr><td>${l.name}</td><td>${l.componentType ?? ''}</td><td style="text-align:right">₹${Number(l.amount).toLocaleString('en-IN')}</td></tr>`,
    )
    .join('');
  return `<table class="salary-table"><thead><tr><th>Component</th><th>Type</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function buildAppointmentOrderHtml(input: {
  collegeName: string;
  collegeAddress: string;
  naacInfo: string;
  logoSrc?: string | null;
  referenceNo: string;
  dateLabel: string;
  candidateName: string;
  addressText: string;
  subject: string;
  bodyHtml: string;
  principalName: string;
  verifyUrl: string;
  verifyCode: string;
}) {
  const logo = input.logoSrc ? `<img src="${input.logoSrc}" alt="Logo"/>` : '';
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(input.verifyUrl)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${APPOINTMENT_ORDER_STYLES}</style></head><body>
<div class="letter">
  <div class="header">
    ${logo}
    <h1>${input.collegeName}</h1>
    <div class="sub">${input.collegeAddress}</div>
    <div class="sub">${input.naacInfo}</div>
  </div>
  <div class="meta">
    <div>Ref. No. ${input.referenceNo}</div>
    <div>Dated ${input.dateLabel}</div>
  </div>
  <div class="address">
    <strong>${input.candidateName}</strong><br/>
    ${input.addressText.replace(/\n/g, '<br/>')}
  </div>
  <div class="subject">Subject: ${input.subject}</div>
  <div class="body">${input.bodyHtml}</div>
  <div class="acceptance">
    <div>
      <p><strong>Copy Received:</strong> I agree with the terms and conditions.</p>
      <p>Name & Signature: ____________________</p>
      <p>Date: ____________________</p>
    </div>
    <div class="signature">
      <p>Yours sincerely,</p>
      <p><strong>${input.principalName}</strong><br/>Principal cum Secretary</p>
    </div>
  </div>
  <div class="verify">
    <img src="${qr}" alt="Verify QR"/>
    <p>Verification ID: ${input.verifyCode}</p>
    <p>${input.verifyUrl}</p>
  </div>
</div></body></html>`;
}
