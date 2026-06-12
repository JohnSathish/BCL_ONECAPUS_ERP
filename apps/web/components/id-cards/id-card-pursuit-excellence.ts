/** Don Bosco College — Pursuit of Excellence student ID visual system */
export const PE_NAVY = '#001B44';
export const PE_RED = '#8B1538';
export const PE_RED_BRIGHT = '#A50021';

export function isPursuitExcellence(preset?: string) {
  return preset === 'pursuit-excellence';
}

export function pursuitFrontHeaderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 204 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
    <defs>
      <linearGradient id="peRed" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${PE_RED}"/><stop offset="100%" stop-color="${PE_RED_BRIGHT}"/></linearGradient>
    </defs>
    <path fill="${PE_NAVY}" d="M0,0 H204 V36 C170,42 140,28 102,34 C64,40 34,52 0,42 Z"/>
    <path fill="url(#peRed)" d="M0,42 C34,52 64,40 102,34 C140,28 170,42 204,36 V0 H120 C110,14 94,22 102,34 C94,46 78,54 0,42 Z"/>
    <path fill="#fff" d="M0,40 C30,48 58,36 102,32 C146,36 174,48 204,38 V42 C174,52 146,40 102,36 C58,42 30,52 0,44 Z"/>
  </svg>`;
}

export function pursuitFrontFooterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 204 28" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
    <path fill="${PE_NAVY}" d="M0,28 H204 V8 C170,2 140,18 102,12 C64,6 34,0 0,8 Z"/>
    <path fill="${PE_RED}" d="M0,8 C34,0 64,14 102,8 C140,2 170,0 204,8 V28 H0 Z"/>
  </svg>`;
}

export function pursuitBackFooterSvg() {
  return pursuitFrontFooterSvg();
}

export function pursuitCenterWatermarkHtml(text: string) {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;">
    <p style="margin:0;font-size:10pt;font-weight:900;text-transform:uppercase;text-align:center;color:${PE_NAVY};opacity:0.045;letter-spacing:0.1em;line-height:1.15;max-width:92%;">${text}</p>
  </div>`;
}

export function pursuitWatermarkText(displayName: string) {
  return displayName.replace(/,.*$/, '').trim().toUpperCase() || 'DON BOSCO COLLEGE';
}

export function pursuitFrontAddressLine(address?: string | null) {
  if (!address) return 'Tura, Meghalaya';
  const lower = address.toLowerCase();
  if (lower.includes('tura') && lower.includes('meghalaya')) return 'Tura, Meghalaya';
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return address.length > 32 ? 'Tura, Meghalaya' : address;
}

export function formatDisplayGender(raw?: string | null) {
  if (!raw?.trim()) return '';
  const v = raw.trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  if (v === 'O' || v === 'OTHER') return 'Other';
  return raw.trim();
}

export function pursuitVerificationPath(
  payload?: string | null,
  registrationNumber?: string | null,
) {
  const reg = registrationNumber?.replace(/\s+/g, '').trim();
  if (reg) return reg;
  const raw = (payload ?? '').trim();
  if (!raw) return '';
  return raw.replace(/^(LIB|LID):E:/i, '').replace(/\s+/g, '');
}

export function pursuitPhotoBorderStyle() {
  return {
    borderWidth: '0.3mm',
    borderStyle: 'solid' as const,
    borderColor: PE_NAVY,
    borderRadius: '1.6mm',
  };
}

export function pursuitQrFrameStyle() {
  return {
    border: `0.45mm solid transparent`,
    borderRadius: '1.4mm',
    background: `linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, ${PE_RED}, ${PE_NAVY}) border-box`,
    padding: '0.6mm',
  };
}

export function pursuitQrFrameCss() {
  const s = pursuitQrFrameStyle();
  return `border:${s.border};border-radius:${s.borderRadius};background:${s.background};padding:${s.padding};box-sizing:border-box;`;
}

export function pursuitGridRowHtml(label: string, value: string) {
  return `<div style="display:flex;align-items:baseline;gap:2mm;width:100%;line-height:1.15;margin-bottom:0.6mm;">
    <span style="flex:0 0 16mm;font-size:3.6pt;font-weight:700;color:#64748b;">${label}</span>
    <span style="flex:1;font-size:4.4pt;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</span>
  </div>`;
}

export function pursuitContactLineHtml(icon: string, text: string) {
  return `<div style="display:flex;align-items:flex-start;gap:1.2mm;margin-bottom:0.9mm;line-height:1.2;">
    <span style="flex:0 0 3.6mm;width:3.6mm;height:3.6mm;border-radius:50%;background:${PE_NAVY};display:inline-flex;align-items:center;justify-content:center;font-size:2.4pt;color:#fff;">${icon}</span>
    <span style="flex:1;font-size:3.2pt;font-weight:600;color:#1e293b;">${text}</span>
  </div>`;
}

export function pursuitDepartmentSubtitle(department: string) {
  const dept = department.trim();
  if (!dept) return '';
  return /^department\s+of/i.test(dept) ? dept : `Department of ${dept}`;
}

export function formatPursuitValidUntilDate(validTo?: string | null, validToLabel?: string | null) {
  if (validTo) {
    const parsed = new Date(validTo);
    if (!Number.isNaN(parsed.getTime())) {
      const day = parsed.getDate().toString().padStart(2, '0');
      const month = parsed.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
      const year = parsed.getFullYear();
      return `${day} ${month} ${year}`;
    }
  }
  const yearMatch = validToLabel?.match(/\d{4}/);
  if (yearMatch) return `31 DEC ${yearMatch[0]}`;
  return validToLabel?.replace(/^VALID\s+UP\s+TO\s+/i, '') ?? '';
}

export function pursuitValidityHtml(dateLabel: string) {
  return `<div style="width:100%;display:flex;justify-content:center;">
    <div style="display:inline-block;padding:0.8mm 3.5mm;border-radius:999px;background:${PE_RED_BRIGHT};color:#fff;text-align:center;line-height:1.15;">
      <p style="margin:0;font-size:2.8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;">Valid Until</p>
      <p style="margin:0.3mm 0 0;font-size:4.6pt;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;">${dateLabel}</p>
    </div>
  </div>`;
}

export function pursuitVerificationUrlHtml(code: string) {
  const slug = code.replace(/\s+/g, '');
  return `<div style="width:100%;text-align:center;line-height:1.25;">
    <p style="margin:0;font-size:2.8pt;font-weight:600;color:#64748b;">Verify:</p>
    <p style="margin:0.2mm 0 0;font-size:3.1pt;font-weight:700;color:${PE_NAVY};word-break:break-all;">id.dbctura.ac.in/verify/${slug}</p>
  </div>`;
}

export function pursuitHologramPlaceholderHtml() {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:0.25mm dashed rgba(0,27,68,0.35);border-radius:0.8mm;background:linear-gradient(135deg,rgba(255,255,255,0.7),rgba(241,245,249,0.9));">
    <p style="margin:0;font-size:2.2pt;font-weight:800;text-transform:uppercase;text-align:center;color:rgba(0,27,68,0.55);letter-spacing:0.06em;line-height:1.2;">Security<br/>Hologram</p>
  </div>`;
}

export function pursuitTermsHtml() {
  const items = [
    'Card is non-transferable',
    'Carry card at all times',
    'Lost card must be reported immediately',
    'College reserves the right to confiscate misuse',
  ];
  return `<div style="width:100%;">
    <p style="margin:0 0 0.8mm;font-size:3.2pt;font-weight:900;text-transform:uppercase;color:${PE_NAVY};letter-spacing:0.08em;">Important</p>
    <ul style="margin:0;padding-left:2.5mm;font-size:2.8pt;color:#334155;line-height:1.35;list-style-type:disc;">
      ${items.map((t) => `<li style="margin-bottom:0.3mm;">${t}</li>`).join('')}
    </ul>
  </div>`;
}

export const PURSUIT_TERMS = [
  'Card is non-transferable',
  'Carry card at all times',
  'Lost card must be reported immediately',
  'College reserves the right to confiscate misuse',
];

export function institutionContactLines(model: {
  institution: {
    displayName: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
}) {
  const inst = model.institution;
  const lines: { icon: string; text: string }[] = [
    { icon: '⌖', text: inst.displayName || 'Don Bosco College, Tura' },
  ];
  if (inst.phone) lines.push({ icon: '☎', text: inst.phone });
  if (inst.website) lines.push({ icon: '⌁', text: inst.website });
  if (inst.email) lines.push({ icon: '✉', text: inst.email });
  return lines;
}

/** @deprecated Use pursuitGridRowHtml */
export function pursuitIconRowHtml(label: string, value: string, _icon: string, _primary: string) {
  return pursuitGridRowHtml(label, value);
}

/** @deprecated Use pursuitCenterWatermarkHtml */
export function pursuitGeometricWatermarkSvg() {
  return pursuitCenterWatermarkHtml('DON BOSCO COLLEGE');
}
