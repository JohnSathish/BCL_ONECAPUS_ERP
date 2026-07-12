import { DOCUMENT_TYPE_LABELS } from '../constants/official-documents.constants';

const NOTICE_TYPE_ICONS: Record<string, string> = {
  HOLIDAY: '◆',
  EXAM: '◆',
  CIRCULAR: '◆',
  NOTICE: '◆',
  MEETING_NOTICE: '◆',
  COMMITTEE_MEETING: '◆',
  OFFICE_ORDER: '◆',
  MEMORANDUM: '◆',
  STAFF: '◆',
  STUDENT: '◆',
  URGENT: '◆',
  TENDER: '◆',
  APPOINTMENT_ORDER: '◆',
};

export const OFFICIAL_NOTICE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap');

  :root {
    --navy: #0b2d5c;
    --navy-deep: #001b44;
    --gold: #b8924a;
    --accent: #eef3f9;
    --ink: #111111;
    --muted: #555555;
    --card-border: #c5d0e0;
  }

  @page {
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Source Sans 3', 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    color: var(--ink);
    margin: 0;
    line-height: 1.48;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { position: relative; }

  .watermark {
    position: fixed;
    top: 52%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.045;
    z-index: 0;
    pointer-events: none;
  }
  .watermark img { width: 240px; height: auto; }

  .content { position: relative; z-index: 1; }

  /* Header ≈ top 18–20% — strong institutional identity */
  .header {
    text-align: center;
    padding: 0 0 6px;
  }
  .header .logo {
    height: 76px;
    width: auto;
    max-width: 92px;
    margin: 0 auto 6px;
    display: block;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
  }
  .header h1 {
    margin: 0;
    font-family: 'Libre Baskerville', Georgia, 'Times New Roman', serif;
    font-size: 29pt;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.85px;
    text-transform: uppercase;
    line-height: 1.12;
  }
  .header .location {
    margin-top: 5px;
    font-size: 11pt;
    color: var(--muted);
    font-weight: 500;
    line-height: 1.35;
  }
  .header .cred-badges {
    margin: 7px auto 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 5px 6px;
    max-width: 170mm;
  }
  .header .cred-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    background: var(--accent);
    border: 1px solid var(--card-border);
    border-radius: 4px;
    font-size: 8.5pt;
    line-height: 1.25;
    color: var(--navy);
    font-weight: 600;
    white-space: nowrap;
  }
  .header .cred-badge .ico {
    color: var(--gold);
    font-size: 9.5pt;
    line-height: 1;
  }
  .header .cred-badge .emph {
    font-weight: 700;
    color: var(--navy-deep);
  }
  .header .cred-note {
    margin-top: 4px;
    font-size: 8pt;
    color: var(--muted);
    font-weight: 500;
  }
  .header .cred-note .emph {
    color: var(--navy);
    font-weight: 600;
  }

  .contact-row {
    margin-top: 7px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px 16px;
    font-size: 10.5pt;
    color: var(--navy-deep);
    line-height: 1.35;
  }
  .contact-row span { white-space: nowrap; }
  .contact-row .ico {
    margin-right: 4px;
    font-size: 11pt;
    color: var(--gold);
  }
  .contact-row .lbl {
    font-weight: 700;
    color: var(--navy-deep);
  }
  .contact-row .val {
    font-weight: 600;
    color: #222;
  }

  .header-divider {
    margin: 8px 0 10px;
  }
  .header-divider .line-navy {
    height: 1.5px;
    background: var(--navy);
    border: none;
    margin: 0;
  }
  .header-divider .line-gold {
    height: 2px;
    background: var(--gold);
    border: none;
    margin: 1.5px 0 0;
  }

  .info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    margin: 0 0 8px;
  }
  .info-card {
    border: 1px solid var(--card-border);
    border-radius: 4px;
    background: #f5f8fc;
    padding: 5px 7px;
    text-align: center;
  }
  .info-card .label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.45px;
    color: #333;
    font-weight: 700;
    margin-bottom: 1px;
    line-height: 1.2;
  }
  .info-card .value {
    font-size: 11pt;
    font-weight: 700;
    color: var(--navy-deep);
    word-break: break-word;
    line-height: 1.25;
  }

  .notice-title {
    text-align: center;
    margin: 2px 0 8px;
  }
  .notice-title .badge {
    display: inline-block;
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 20pt;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 0 6px 2px;
    border-bottom: 2.5px solid var(--gold);
  }
  .notice-title .icon {
    margin-right: 5px;
    color: var(--gold);
    font-size: 12pt;
  }

  .to-block {
    margin: 0 0 8px;
    padding: 0;
    background: transparent;
    border: none;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .to-block .to-label {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--navy-deep);
    margin-bottom: 2px;
  }
  .to-block ul {
    margin: 0;
    padding-left: 14px;
  }
  .to-block li {
    font-size: 10pt;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
    line-height: 1.35;
  }
  .to-block .salutation-fallback {
    font-size: 10pt;
    font-weight: 600;
    margin: 0;
  }

  .body {
    text-align: justify;
    font-size: 10.5pt;
    line-height: 1.5;
    color: var(--ink);
  }
  .body p { margin: 0 0 8px; }
  .body ul, .body ol { margin: 0 0 8px; padding-left: 18px; }
  .body li { margin: 1px 0; }
  .body table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 8px;
    font-size: 9pt;
  }
  .body th, .body td {
    border: 1px solid #94a3b8;
    padding: 4px 6px;
    text-align: left;
  }
  .body th {
    background: var(--accent);
    color: var(--navy-deep);
    font-weight: 700;
  }
  .body .highlight-box,
  .body .callout {
    background: #fffbeb;
    border: 1px solid #d97706;
    border-radius: 4px;
    padding: 6px 8px;
    margin: 8px 0;
  }

  .important-box {
    margin: 8px 0;
    border: 1px solid var(--card-border);
    border-radius: 5px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .important-box .ib-head {
    background: var(--navy);
    color: #fff;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 4px 8px;
  }
  .important-box .ib-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .important-box .ib-item {
    padding: 5px 8px;
    border-top: 1px solid var(--card-border);
    border-right: 1px solid var(--card-border);
    background: #f8fafc;
  }
  .important-box .ib-item:nth-child(2n) { border-right: none; }
  .important-box .ib-item .k {
    font-size: 7pt;
    color: #333;
    font-weight: 700;
    text-transform: uppercase;
  }
  .important-box .ib-item .v {
    font-size: 9.5pt;
    font-weight: 700;
    color: var(--navy-deep);
    margin-top: 1px;
  }

  .attachments {
    margin: 8px 0 4px;
    padding: 5px 8px;
    border: 1px dashed var(--card-border);
    border-radius: 4px;
    background: #fafbfc;
    page-break-inside: avoid;
  }
  .attachments .att-title {
    font-size: 8pt;
    font-weight: 700;
    color: var(--navy-deep);
    margin-bottom: 2px;
  }
  .attachments ul { margin: 0; padding-left: 14px; }
  .attachments li { font-size: 8.5pt; margin: 0; color: #222; }

  .closing {
    margin-top: 4px;
    margin-bottom: 0;
    font-style: italic;
    color: #333;
    font-size: 10pt;
  }
  .closing p { margin: 0; }

  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 14px;
    gap: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .verify-block {
    text-align: center;
    max-width: 100px;
  }
  .verify-block img {
    width: 62px;
    height: 62px;
    border: 1px solid var(--card-border);
    border-radius: 3px;
    padding: 2px;
    background: #fff;
  }
  .verify-block .v-label {
    font-size: 6.5pt;
    color: #333;
    margin-top: 2px;
    line-height: 1.25;
  }
  .verify-block .v-code {
    font-size: 6pt;
    font-family: ui-monospace, monospace;
    color: var(--navy-deep);
    word-break: break-all;
  }

  .signature-block {
    text-align: center;
    min-width: 180px;
    position: relative;
    margin-left: auto;
    page-break-inside: avoid;
  }
  .signature-block .sig-space {
    min-height: 36px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .signature-block img.sig {
    max-height: 40px;
    max-width: 150px;
    display: block;
    margin: 0 auto 1px;
  }
  .signature-block img.seal {
    position: absolute;
    right: -4px;
    bottom: 4px;
    width: 48px;
    opacity: 0.9;
  }
  .signature-block .name {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-weight: 700;
    font-size: 10.5pt;
    color: var(--navy-deep);
    margin-top: 1px;
  }
  .signature-block .designation {
    font-size: 9pt;
    font-weight: 600;
    color: var(--ink);
  }
  .signature-block .org {
    font-size: 8pt;
    color: #333;
    margin-top: 0;
  }
  .signature-block .digital-note {
    margin-top: 3px;
    font-size: 6.5pt;
    color: #333;
    border-top: 1px solid #cbd5e1;
    padding-top: 3px;
    line-height: 1.3;
  }

  .footer {
    margin-top: 10px;
    padding-top: 4px;
    border-top: 1.25px solid var(--navy);
    page-break-inside: avoid;
  }
  .footer-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    font-size: 7pt;
    color: #333;
    line-height: 1.25;
  }
  .footer-inner strong { color: var(--navy-deep); }
  .footer-center { text-align: center; }
  .footer-right { text-align: right; }

  @media print {
    .bottom-row { margin-top: 12px; }
    .header .logo { height: 76px; }
  }

  .meeting-box {
    margin: 0 0 10px;
    border: 1px solid var(--card-border);
    border-radius: 5px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .meeting-box .mb-head {
    background: var(--navy);
    color: #fff;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 5px 10px;
  }
  .meeting-box .mb-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    background: #f8fafc;
  }
  .meeting-box .mb-item {
    padding: 5px 10px;
    border-top: 1px solid var(--card-border);
    border-right: 1px solid var(--card-border);
  }
  .meeting-box .mb-item:nth-child(2n) { border-right: none; }
  .meeting-box .mb-item.full { grid-column: 1 / -1; border-right: none; }
  .meeting-box .k {
    font-size: 7pt;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
  }
  .meeting-box .v {
    font-size: 10pt;
    font-weight: 700;
    color: var(--navy-deep);
    margin-top: 1px;
  }
  .meeting-box .agenda-list {
    margin: 4px 0 0;
    padding-left: 16px;
  }
  .meeting-box .agenda-list li {
    font-size: 9.5pt;
    font-weight: 600;
    color: var(--ink);
    margin: 1px 0;
  }

  .committee-block {
    margin: 10px 0;
    page-break-inside: avoid;
  }
  .committee-block .cb-title {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 11pt;
    font-weight: 700;
    color: var(--navy);
    margin: 0 0 4px;
    padding-bottom: 2px;
    border-bottom: 1.5px solid var(--gold);
  }
  .committee-block table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .committee-block th,
  .committee-block td {
    border: 1px solid #94a3b8;
    padding: 4px 6px;
    text-align: left;
  }
  .committee-block th {
    background: var(--accent);
    color: var(--navy-deep);
    font-weight: 700;
  }
  .committee-block td.sl { width: 36px; text-align: center; }
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

export type OfficialNoticeMeetingInfo = {
  title?: string;
  date?: string;
  time?: string;
  venue?: string;
  duration?: string;
  convenedBy?: string;
  chairperson?: string;
  agenda?: string[];
};

export type OfficialNoticeCommitteeTable = {
  committeeName: string;
  members: Array<{ name: string; designation: string }>;
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
  meetingInfo?: OfficialNoticeMeetingInfo | null;
  committeeTables?: OfficialNoticeCommitteeTable[];
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
      : null;

  const locationLine =
    affiliation?.[0]?.trim() ||
    (input.addressLine?.includes('794002')
      ? input.addressLine.trim()
      : 'Tura, Meghalaya – 794002');

  const credentialBadges = `
    <div class="cred-badges">
      <div class="cred-badge"><span class="ico">✦</span><span>Affiliated to <span class="emph">NEHU</span></span></div>
      <div class="cred-badge"><span class="ico">✦</span><span>Recognised by <span class="emph">UGC</span></span></div>
      <div class="cred-badge"><span class="ico">✦</span><span><span class="emph">NAAC</span> Accredited (Grade 'B')</span></div>
    </div>
  `;

  // Optional custom affiliation lines override the default badge block
  const affiliationBlock = affiliation
    ? `<div class="location">${escapeHtml(locationLine)}</div>
       <div class="cred-note">${affiliation
         .slice(1)
         .map((l) => escapeHtml(l))
         .join('<br/>')}</div>`
    : `<div class="location">${escapeHtml(locationLine)}</div>${credentialBadges}`;

  const c = input.contact;
  const contactParts: string[] = [];
  if (c.landline?.trim()) {
    contactParts.push(
      `<span><span class="ico">☎</span><span class="lbl">Phone:</span> <span class="val">${escapeHtml(c.landline.trim())}</span></span>`,
    );
  }
  if (c.mobile?.trim()) {
    contactParts.push(
      `<span><span class="ico">📱</span><span class="lbl">Mobile:</span> <span class="val">${escapeHtml(c.mobile.trim())}</span></span>`,
    );
  }
  if (c.email?.trim()) {
    contactParts.push(
      `<span><span class="ico">✉</span><span class="val">${escapeHtml(c.email.trim())}</span></span>`,
    );
  }
  if (c.website?.trim()) {
    contactParts.push(
      `<span><span class="ico">🌐</span><span class="val">${escapeHtml(c.website.trim())}</span></span>`,
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

  const m = input.meetingInfo;
  const meetingRows: string[] = [];
  if (m?.title?.trim()) {
    meetingRows.push(
      `<div class="mb-item full"><div class="k">Meeting</div><div class="v">${escapeHtml(m.title.trim())}</div></div>`,
    );
  }
  if (m?.date?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Date</div><div class="v">${escapeHtml(m.date.trim())}</div></div>`,
    );
  }
  if (m?.time?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Time</div><div class="v">${escapeHtml(m.time.trim())}</div></div>`,
    );
  }
  if (m?.venue?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Venue</div><div class="v">${escapeHtml(m.venue.trim())}</div></div>`,
    );
  }
  if (m?.duration?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Duration</div><div class="v">${escapeHtml(m.duration.trim())}</div></div>`,
    );
  }
  if (m?.convenedBy?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Convened By</div><div class="v">${escapeHtml(m.convenedBy.trim())}</div></div>`,
    );
  }
  if (m?.chairperson?.trim()) {
    meetingRows.push(
      `<div class="mb-item"><div class="k">Chairperson</div><div class="v">${escapeHtml(m.chairperson.trim())}</div></div>`,
    );
  }
  if (m?.agenda && m.agenda.length > 0) {
    meetingRows.push(
      `<div class="mb-item full"><div class="k">Agenda</div><ol class="agenda-list">${m.agenda
        .filter((a) => a.trim())
        .map((a) => `<li>${escapeHtml(a.trim())}</li>`)
        .join('')}</ol></div>`,
    );
  }
  const meetingBlock =
    meetingRows.length > 0
      ? `<div class="meeting-box"><div class="mb-head">Meeting Details</div><div class="mb-grid">${meetingRows.join('')}</div></div>`
      : '';

  const committeeBlocks = (input.committeeTables ?? [])
    .filter((t) => t.members.length > 0)
    .map((table) => {
      const rows = table.members
        .map(
          (mem, idx) =>
            `<tr><td class="sl">${idx + 1}</td><td>${escapeHtml(mem.name)}</td><td>${escapeHtml(mem.designation)}</td></tr>`,
        )
        .join('');
      return `<div class="committee-block">
        <div class="cb-title">${escapeHtml(table.committeeName)}</div>
        <table>
          <thead><tr><th class="sl">Sl.No</th><th>Name</th><th>Designation</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join('');

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
      ${affiliationBlock}
      ${
        contactParts.length
          ? `<div class="contact-row">${contactParts.join('')}</div>`
          : ''
      }
    </header>
    <div class="header-divider">
      <hr class="line-navy"/>
      <hr class="line-gold"/>
    </div>

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
    ${meetingBlock}

    <div class="body">${input.bodyHtml}</div>

    ${committeeBlocks}
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
