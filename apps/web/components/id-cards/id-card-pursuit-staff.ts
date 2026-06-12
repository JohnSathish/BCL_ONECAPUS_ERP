/** Don Bosco College — Pursuit Staff ID (Navy + Gold) */
import {
  institutionContactLines,
  pursuitCenterWatermarkHtml,
  pursuitFrontAddressLine,
  pursuitVerificationPath,
  pursuitVerificationUrlHtml,
  pursuitWatermarkText,
} from './id-card-pursuit-excellence';

export const PS_NAVY = '#001B44';
export const PS_GOLD = '#C5A028';
export const PS_GOLD_BRIGHT = '#D4AF37';

export function isPursuitStaff(preset?: string) {
  return preset === 'pursuit-staff';
}

export {
  institutionContactLines,
  pursuitCenterWatermarkHtml,
  pursuitFrontAddressLine,
  pursuitVerificationPath,
  pursuitVerificationUrlHtml,
  pursuitWatermarkText,
};

export function staffFrontHeaderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 204 72" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
    <defs>
      <linearGradient id="psGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${PS_GOLD}"/><stop offset="100%" stop-color="${PS_GOLD_BRIGHT}"/></linearGradient>
    </defs>
    <path fill="${PS_NAVY}" d="M0,0 H204 V48 C170,54 140,42 102,48 C64,54 34,66 0,56 Z"/>
    <path fill="url(#psGold)" d="M0,56 C34,66 64,54 102,48 C140,42 170,54 204,48 V58 C174,68 146,56 102,52 C58,58 30,68 0,62 Z"/>
    <path fill="#fff" d="M0,54 C30,62 58,50 102,46 C146,50 174,62 204,56 V60 C174,66 146,54 102,50 C58,56 30,64 0,58 Z"/>
  </svg>`;
}

export function staffFrontFooterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 204 28" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
    <path fill="${PS_NAVY}" d="M0,28 H204 V8 C170,2 140,18 102,12 C64,6 34,0 0,8 Z"/>
    <path fill="${PS_GOLD}" d="M0,8 C34,0 64,14 102,8 C140,2 170,0 204,8 V28 H0 Z"/>
  </svg>`;
}

export function staffPhotoBorderStyle() {
  return {
    borderWidth: '0.35mm',
    borderStyle: 'solid' as const,
    borderColor: PS_NAVY,
    borderRadius: '1.6mm',
  };
}

export function staffQrFrameStyle() {
  return {
    border: `0.45mm solid transparent`,
    borderRadius: '1.4mm',
    background: `linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, ${PS_GOLD}, ${PS_NAVY}) border-box`,
    padding: '0.6mm',
  };
}

export function staffQrFrameCss() {
  const s = staffQrFrameStyle();
  return `border:${s.border};border-radius:${s.borderRadius};background:${s.background};padding:${s.padding};box-sizing:border-box;`;
}

export function staffIconRowHtml(label: string, value: string) {
  return `<div style="display:flex;align-items:center;gap:0.9mm;width:100%;line-height:1.05;margin-bottom:0.25mm;">
    <span style="flex:0 0 3.6mm;width:3.6mm;height:3.6mm;border-radius:0.45mm;background:${PS_NAVY};display:inline-flex;align-items:center;justify-content:center;font-size:2.2pt;color:#fff;">▣</span>
    <span style="flex:0 0 13.5mm;font-size:3pt;font-weight:800;text-transform:uppercase;color:${PS_NAVY};letter-spacing:0.02em;">${label}</span>
    <span style="font-size:3pt;font-weight:800;color:${PS_GOLD};">:</span>
    <span style="flex:1;min-width:0;font-size:3.6pt;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</span>
  </div>`;
}

export function staffRoleBadgeHtml() {
  return `<div style="width:100%;display:flex;justify-content:center;">
    <span style="display:inline-block;padding:0.5mm 3mm;border-radius:999px;background:${PS_NAVY};color:#fff;font-size:3.6pt;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;">Staff</span>
  </div>`;
}

export function formatStaffJoiningDate(raw?: string | null) {
  if (!raw?.trim()) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatStaffValidUntil(validTo?: string | null, validToLabel?: string | null) {
  if (validTo) {
    const d = new Date(validTo);
    if (!Number.isNaN(d.getTime())) {
      const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
      return `${month} ${d.getFullYear()}`;
    }
  }
  const yearMatch = validToLabel?.match(/\d{4}/);
  if (yearMatch) return `DEC ${yearMatch[0]}`;
  return validToLabel?.replace(/^VALID\s+UP\s+TO\s+/i, '') ?? '';
}

export function staffValidityHtml(dateLabel: string) {
  return `<div style="width:100%;display:flex;justify-content:center;">
    <div style="display:inline-block;padding:0.75mm 3.5mm;border-radius:999px;background:linear-gradient(135deg,${PS_GOLD},${PS_GOLD_BRIGHT});color:#fff;text-align:center;line-height:1.15;box-shadow:0 1px 2px rgba(0,0,0,0.12);">
      <p style="margin:0;font-size:2.6pt;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">Valid Up To</p>
      <p style="margin:0.3mm 0 0;font-size:4.2pt;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;">${dateLabel}</p>
    </div>
  </div>`;
}

export function staffTermsHtml() {
  const items = [
    'This card is the property of Don Bosco College, Tura',
    'This card is non-transferable',
    'Misuse of this card is a punishable offence',
    'If found, please return to the College Office',
  ];
  return `<div style="width:100%;">
    <div style="margin-bottom:0.8mm;border-radius:999px;background:${PS_NAVY};color:#fff;font-size:3pt;font-weight:800;text-transform:uppercase;text-align:center;padding:0.55mm 2mm;">Important</div>
    <ul style="margin:0;padding-left:2.5mm;font-size:2.8pt;color:#334155;line-height:1.35;list-style-type:disc;">
      ${items.map((t) => `<li style="margin-bottom:0.3mm;">${t}</li>`).join('')}
    </ul>
  </div>`;
}

export function staffContactLineHtml(icon: string, text: string) {
  return `<div style="display:flex;align-items:flex-start;gap:1.2mm;margin-bottom:0.9mm;line-height:1.2;">
    <span style="flex:0 0 3.6mm;width:3.6mm;height:3.6mm;border-radius:0.5mm;background:${PS_NAVY};display:inline-flex;align-items:center;justify-content:center;font-size:2.4pt;color:#fff;">${icon}</span>
    <span style="flex:1;font-size:3.2pt;font-weight:600;color:#1e293b;">${text}</span>
  </div>`;
}
