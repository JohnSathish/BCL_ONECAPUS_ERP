import { DOCUMENT_TYPE_LABELS } from '../constants/official-documents.constants';

const NOTICE_TYPE_ICONS: Record<string, string> = {
  HOLIDAY: '🏖',
  EXAM: '🎓',
  CIRCULAR: '📢',
  NOTICE: '📢',
  MEETING_NOTICE: '📅',
  OFFICE_ORDER: '📋',
  MEMORANDUM: '📝',
  STAFF: '👥',
  STUDENT: '🎓',
  URGENT: '⚠',
  TENDER: '📑',
  APPOINTMENT_ORDER: '✉',
};

export const OFFICIAL_NOTICE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap');

  :root {
    --navy: #001b44;
    --navy-mid: #0b2d5c;
    --gold: #c5a46a;
    --accent: #e8f0fa;
    --ink: #1a1a1a;
    --muted: #4b5563;
    --line: #c5a46a;
    --card-border: #c7d4e8;
  }

  @page {
    size: A4 portrait;
    margin: 20mm 18mm 22mm 18mm;
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Source Sans 3', 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: var(--ink);
    margin: 0;
    line-height: 1.55;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    min-height: 250mm;
  }

  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
  }
  .watermark img {
    width: 280px;
    height: auto;
  }

  .content { position: relative; z-index: 1; }

  /* ——— Header ——— */
  .header {
    text-align: center;
    padding-bottom: 10px;
  }
  .header .logo {
    height: 78px;
    width: auto;
    margin: 0 auto 6px;
    display: block;
  }
  .header h1 {
    margin: 0;
    font-family: 'Libre Baskerville', Georgia, 'Times New Roman', serif;
    font-size: 17.5pt;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    line-height: 1.25;
  }
  .header .meta-lines {
    margin-top: 6px;
    font-size: 8.5pt;
    color: var(--muted);
    line-height: 1.45;
  }
  .header .meta-lines div { margin: 1px 0; }

  .contact-row {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 14px;
    font-size: 8.5pt;
    color: var(--navy-mid);
    font-weight: 600;
  }
  .contact-row span { white-space: nowrap; }
  .contact-row .ico { margin-right: 3px; }

  .gold-rule {
    height: 2.5px;
    margin: 10px 0 0;
    background: linear-gradient(90deg, transparent, var(--gold) 12%, var(--navy) 50%, var(--gold) 88%, transparent);
    border: none;
  }
  .navy-rule {
    height: 1px;
    margin: 2px 0 14px;
    background: var(--navy);
    opacity: 0.35;
    border: none;
  }

  /* ——— Info strip ——— */
  .info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin: 0 0 16px;
  }
  .info-card {
    border: 1px solid var(--card-border);
    border-radius: 6px;
    background: linear-gradient(180deg, #f7fafc 0%, #fff 100%);
    padding: 8px 10px;
    text-align: center;
  }
  .info-card .label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    font-weight: 700;
    margin-bottom: 3px;
  }
  .info-card .value {
    font-size: 9.5pt;
    font-weight: 700;
    color: var(--navy);
    word-break: break-word;
    line-height: 1.3;
  }

  /* ——— Title ——— */
  .notice-title {
    text-align: center;
    margin: 4px 0 18px;
  }
  .notice-title .badge {
    display: inline-block;
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 13.5pt;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 0 8px 4px;
    border-bottom: 2.5px solid var(--gold);
  }
  .notice-title .icon { margin-right: 6px; }

  /* ——— Recipients ——— */
  .to-block {
    margin: 0 0 14px;
    padding: 10px 12px;
    background: var(--accent);
    border-left: 3px solid var(--navy);
    border-radius: 0 6px 6px 0;
  }
  .to-block .to-label {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--navy);
    margin-bottom: 4px;
  }
  .to-block ul {
    margin: 0;
    padding-left: 16px;
  }
  .to-block li {
    font-size: 10.5pt;
    font-weight: 600;
    color: var(--ink);
    margin: 2px 0;
  }
  .to-block .salutation-fallback {
    font-size: 10.5pt;
    font-weight: 600;
    margin: 0;
  }

  /* ——— Body ——— */
  .body {
    text-align: justify;
    font-size: 11pt;
    line-height: 1.65;
  }
  .body p { margin: 0 0 11px; }
  .body p:first-of-type::first-letter {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 2.1em;
    font-weight: 700;
    color: var(--navy);
    float: left;
    line-height: 0.85;
    padding: 4px 6px 0 0;
  }
  .body ul, .body ol { margin: 0 0 12px; padding-left: 22px; }
  .body li { margin: 3px 0; }
  .body table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px;
    font-size: 10pt;
  }
  .body th, .body td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
  }
  .body th {
    background: var(--accent);
    color: var(--navy);
    font-weight: 700;
  }
  .body .highlight-box,
  .body .callout {
    background: #fffbeb;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 12px 0;
  }

  .important-box {
    margin: 16px 0;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    overflow: hidden;
  }
  .important-box .ib-head {
    background: var(--navy);
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 7px 12px;
  }
  .important-box .ib-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .important-box .ib-item {
    padding: 10px 12px;
    border-top: 1px solid var(--card-border);
    border-right: 1px solid var(--card-border);
    background: #f8fafc;
  }
  .important-box .ib-item:nth-child(2n) { border-right: none; }
  .important-box .ib-item .k {
    font-size: 8pt;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
  }
  .important-box .ib-item .v {
    font-size: 11pt;
    font-weight: 700;
    color: var(--navy);
    margin-top: 2px;
  }

  .attachments {
    margin: 16px 0 8px;
    padding: 10px 12px;
    border: 1px dashed var(--card-border);
    border-radius: 6px;
    background: #fafbfc;
  }
  .attachments .att-title {
    font-size: 9pt;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 6px;
  }
  .attachments ul { margin: 0; padding-left: 18px; }
  .attachments li { font-size: 9.5pt; margin: 2px 0; }

  .closing {
    margin-top: 8px;
    font-style: italic;
    color: var(--muted);
  }

  /* ——— Signature + QR ——— */
  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 28px;
    gap: 16px;
  }
  .verify-block {
    text-align: center;
    max-width: 120px;
  }
  .verify-block img {
    width: 78px;
    height: 78px;
    border: 1px solid var(--card-border);
    border-radius: 4px;
    padding: 3px;
    background: #fff;
  }
  .verify-block .v-label {
    font-size: 7.5pt;
    color: var(--muted);
    margin-top: 4px;
    line-height: 1.3;
  }
  .verify-block .v-code {
    font-size: 7pt;
    font-family: ui-monospace, monospace;
    color: var(--navy);
    word-break: break-all;
  }

  .signature-block {
    text-align: center;
    min-width: 210px;
    position: relative;
    margin-left: auto;
  }
  .signature-block .sig-space {
    min-height: 52px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .signature-block img.sig {
    max-height: 52px;
    max-width: 180px;
    display: block;
    margin: 0 auto 2px;
  }
  .signature-block img.seal {
    position: absolute;
    right: -8px;
    bottom: 8px;
    width: 64px;
    opacity: 0.88;
  }
  .signature-block .name {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-weight: 700;
    font-size: 11pt;
    color: var(--navy);
    margin-top: 2px;
  }
  .signature-block .designation {
    font-size: 9.5pt;
    font-weight: 600;
    color: var(--ink);
  }
  .signature-block .org {
    font-size: 8.5pt;
    color: var(--muted);
    margin-top: 1px;
  }
  .signature-block .digital-note {
    margin-top: 6px;
    font-size: 7.5pt;
    color: var(--muted);
    border-top: 1px solid #e2e8f0;
    padding-top: 5px;
    line-height: 1.35;
  }

  /* ——— Footer ——— */
  .footer {
    margin-top: 22px;
    padding-top: 8px;
    border-top: 1.5px solid var(--navy);
  }
  .footer-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    font-size: 7.5pt;
    color: var(--muted);
  }
  .footer-inner strong { color: var(--navy); }
  .footer-center { text-align: center; }
  .footer-right { text-align: right; }
`;

export function renderTemplateVars(html: string, vars: Record<string, string>) {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value ?? '');
  }
  return out.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '');
}

export type OfficialNoticeContact = {
  landline?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
};

export type OfficialNoticeImportantItem = {
  label: string;
  value: string;
};

export type OfficialNoticeHtmlInput = {
  collegeName: string;
  addressLine: string;
  affiliationLines?: string[];
  contact: OfficialNoticeContact;
  logoSrc?: string | null;
  referenceNo: string;
  dateLabel: string;
  departmentLabel: string;
  documentType: string;
  title?: string | null;
  salutation?: string | null;
  recipientLines?: string[];
  bodyHtml: string;
  importantItems?: OfficialNoticeImportantItem[];
  attachmentNames?: string[];
  issuerName: string;
  designation: string;
  institutionShortName?: string;
  signatureSrc?: string | null;
  sealSrc?: string | null;
  digitallyApproved?: boolean;
  verifyUrl: string;
  verifyCode: string;
  generatedAtLabel: string;
  pageLabel?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCollegeDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'DON BOSCO COLLEGE, TURA';
  const upper = trimmed.toUpperCase();
  if (upper.includes('DON BOSCO') && !upper.includes(',')) {
    return upper.replace(/\s+TURA\s*$/i, '').trim() + ', TURA';
  }
  return upper;
}

export function buildOfficialNoticeHtml(input: OfficialNoticeHtmlInput) {
  const logo = input.logoSrc
    ? `<img class="logo" src="${input.logoSrc}" alt="College Logo"/>`
    : '';
  const watermark = input.logoSrc
    ? `<div class="watermark"><img src="${input.logoSrc}" alt=""/></div>`
    : '';

  const typeLabel =
    DOCUMENT_TYPE_LABELS[input.documentType] ?? input.documentType;
  const typeIcon = NOTICE_TYPE_ICONS[input.documentType] ?? '📢';
  const collegeDisplay = formatCollegeDisplayName(input.collegeName);

  const affiliation =
    input.affiliationLines && input.affiliationLines.length > 0
      ? input.affiliationLines
      : [
          'Tura, Meghalaya – 794002',
          'Affiliated to North Eastern Hill University (NEHU), Shillong',
          'Recognised by University Grants Commission (UGC), New Delhi',
          "(Re-accredited with 'B' Grade by NAAC Bangalore)",
        ];

  // Prefer structured address as first line when provided
  const metaLines = [...affiliation];
  if (
    input.addressLine?.trim() &&
    !metaLines.some((l) =>
      l.toLowerCase().includes(input.addressLine.trim().toLowerCase()),
    )
  ) {
    metaLines[0] = input.addressLine.trim();
  }

  const c = input.contact;
  const contactParts: string[] = [];
  if (c.landline?.trim()) {
    contactParts.push(
      `<span><span class="ico">☎</span>Phone: ${escapeHtml(c.landline.trim())}</span>`,
    );
  }
  if (c.mobile?.trim()) {
    contactParts.push(
      `<span><span class="ico">📱</span>Mobile: ${escapeHtml(c.mobile.trim())}</span>`,
    );
  }
  if (c.email?.trim()) {
    contactParts.push(
      `<span><span class="ico">✉</span>${escapeHtml(c.email.trim())}</span>`,
    );
  }
  if (c.website?.trim()) {
    contactParts.push(
      `<span><span class="ico">🌐</span>${escapeHtml(c.website.trim())}</span>`,
    );
  }

  const recipients =
    input.recipientLines?.filter((r) => r.trim()).map((r) => r.trim()) ?? [];
  const toBlock =
    recipients.length > 0
      ? `<div class="to-block">
          <div class="to-label">To</div>
          <ul>${recipients.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
        </div>`
      : input.salutation?.trim()
        ? `<div class="to-block"><p class="salutation-fallback">${escapeHtml(input.salutation.trim())}</p></div>`
        : '';

  const important =
    input.importantItems && input.importantItems.length > 0
      ? `<div class="important-box">
          <div class="ib-head">Important Information</div>
          <div class="ib-grid">
            ${input.importantItems
              .map(
                (item) => `<div class="ib-item">
                  <div class="k">${escapeHtml(item.label)}</div>
                  <div class="v">${escapeHtml(item.value)}</div>
                </div>`,
              )
              .join('')}
          </div>
        </div>`
      : '';

  const attachments =
    input.attachmentNames && input.attachmentNames.length > 0
      ? `<div class="attachments">
          <div class="att-title">📎 Attachments</div>
          <ul>${input.attachmentNames.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </div>`
      : '';

  const sig = input.signatureSrc
    ? `<img class="sig" src="${input.signatureSrc}" alt="Signature"/>`
    : '';
  const seal = input.sealSrc
    ? `<img class="seal" src="${input.sealSrc}" alt="Official Seal"/>`
    : '';
  const digitalNote = input.digitallyApproved
    ? `<div class="digital-note">Digitally generated by BCL OneCampus ERP<br/>No wet-ink signature required when digitally approved</div>`
    : '';

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(input.verifyUrl)}`;
  const orgLine =
    input.institutionShortName?.trim() ||
    collegeDisplay.replace(/,\s*TURA$/i, ', Tura');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${OFFICIAL_NOTICE_STYLES}</style></head><body>
<div class="page">
  ${watermark}
  <div class="content">
    <header class="header">
      ${logo}
      <h1>${escapeHtml(collegeDisplay)}</h1>
      <div class="meta-lines">
        ${metaLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
      </div>
      ${
        contactParts.length
          ? `<div class="contact-row">${contactParts.join('')}</div>`
          : ''
      }
    </header>
    <div class="gold-rule"></div>
    <div class="navy-rule"></div>

    <div class="info-strip">
      <div class="info-card">
        <div class="label">Reference No.</div>
        <div class="value">${escapeHtml(input.referenceNo)}</div>
      </div>
      <div class="info-card">
        <div class="label">Department</div>
        <div class="value">${escapeHtml(input.departmentLabel)}</div>
      </div>
      <div class="info-card">
        <div class="label">Date</div>
        <div class="value">${escapeHtml(input.dateLabel)}</div>
      </div>
    </div>

    <div class="notice-title">
      <span class="badge"><span class="icon">${typeIcon}</span>${escapeHtml(typeLabel)}</span>
    </div>

    ${toBlock}

    <div class="body">${input.bodyHtml}</div>

    ${important}
    ${attachments}

    <div class="closing"><p>Thank you.</p></div>

    <div class="bottom-row">
      <div class="verify-block">
        <img src="${qr}" alt="Verify QR"/>
        <div class="v-label">Scan to verify on<br/>ERP Notice Portal</div>
        <div class="v-code">${escapeHtml(input.verifyCode)}</div>
      </div>
      <div class="signature-block">
        <div class="sig-space">${sig}</div>
        ${seal}
        <div class="name">${escapeHtml(input.issuerName)}</div>
        <div class="designation">${escapeHtml(input.designation)}</div>
        <div class="org">${escapeHtml(orgLine)}</div>
        ${digitalNote}
      </div>
    </div>

    <footer class="footer">
      <div class="footer-inner">
        <div>
          Generated by<br/><strong>BCL OneCampus ERP</strong>
        </div>
        <div class="footer-center">
          Generated on<br/><strong>${escapeHtml(input.generatedAtLabel)}</strong>
        </div>
        <div class="footer-right">
          ${escapeHtml(input.pageLabel ?? 'Page 1 of 1')}
        </div>
      </div>
    </footer>
  </div>
</div>
</body></html>`;
}
