import { DOCUMENT_TYPE_LABELS } from '../constants/official-documents.constants';

export const OFFICIAL_NOTICE_STYLES = `
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; color: #111; margin: 0; line-height: 1.5; }
  .letter { max-width: 180mm; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 8px; }
  .header img { height: 68px; margin-bottom: 4px; }
  .header h1 { margin: 2px 0; font-size: 18pt; font-weight: bold; letter-spacing: 0.5px; }
  .header .address { font-size: 11pt; margin: 2px 0; }
  .header .contact { font-size: 10pt; color: #333; margin-top: 2px; }
  .header .contact a { color: #1a56db; text-decoration: none; }
  .rule { border: none; border-top: 1px dashed #666; margin: 10px 0 14px; }
  .meta { display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 16px; }
  .doc-type { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 12px 0 16px; letter-spacing: 1px; }
  .salutation { margin-bottom: 12px; font-weight: bold; }
  .body { text-align: justify; }
  .body p { margin: 0 0 10px; }
  .closing { margin-top: 20px; }
  .signature-block { margin-top: 36px; display: flex; justify-content: flex-end; }
  .signature-inner { position: relative; text-align: center; min-width: 200px; }
  .signature-inner img.sig { max-height: 56px; display: block; margin: 0 auto 4px; }
  .signature-inner img.seal { position: absolute; right: -20px; bottom: -8px; width: 72px; opacity: 0.85; }
  .signature-inner .name { font-weight: bold; font-size: 11pt; }
  .signature-inner .designation { font-size: 10.5pt; }
  .verify { margin-top: 28px; text-align: right; font-size: 8.5pt; color: #555; }
  .verify img { width: 72px; height: 72px; }
`;

export function renderTemplateVars(html: string, vars: Record<string, string>) {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value ?? '');
  }
  return out.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '');
}

export function buildOfficialNoticeHtml(input: {
  collegeName: string;
  addressLine: string;
  contactLine?: string | null;
  logoSrc?: string | null;
  referenceNo: string;
  dateLabel: string;
  documentType: string;
  title?: string | null;
  salutation?: string | null;
  bodyHtml: string;
  issuerName: string;
  designation: string;
  signatureSrc?: string | null;
  sealSrc?: string | null;
  verifyUrl: string;
  verifyCode: string;
}) {
  const logo = input.logoSrc
    ? `<img src="${input.logoSrc}" alt="College Logo"/>`
    : '';
  const typeLabel =
    DOCUMENT_TYPE_LABELS[input.documentType] ?? input.documentType;
  const salutation = input.salutation?.trim()
    ? `<div class="salutation">${input.salutation}</div>`
    : '';
  const sig = input.signatureSrc
    ? `<img class="sig" src="${input.signatureSrc}" alt="Signature"/>`
    : '';
  const seal = input.sealSrc
    ? `<img class="seal" src="${input.sealSrc}" alt="Seal"/>`
    : '';
  const contact = input.contactLine ?? '';
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(input.verifyUrl)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${OFFICIAL_NOTICE_STYLES}</style></head><body>
<div class="letter">
  <div class="header">
    ${logo}
    <h1>${input.collegeName}</h1>
    <div class="address">${input.addressLine}</div>
    ${contact ? `<div class="contact">${contact}</div>` : ''}
  </div>
  <hr class="rule"/>
  <div class="meta">
    <div>Ref. No.: ${input.referenceNo}</div>
    <div>Date: ${input.dateLabel}</div>
  </div>
  <div class="doc-type">${typeLabel}</div>
  ${salutation}
  <div class="body">${input.bodyHtml}</div>
  <div class="closing"><p>Thank you</p></div>
  <div class="signature-block">
    <div class="signature-inner">
      ${sig}
      ${seal}
      <div class="name">${input.issuerName}</div>
      <div class="designation">${input.designation}</div>
    </div>
  </div>
  <div class="verify">
    <img src="${qr}" alt="Verify QR"/>
    <p>Verification: ${input.verifyCode}</p>
    <p>${input.verifyUrl}</p>
  </div>
</div></body></html>`;
}
