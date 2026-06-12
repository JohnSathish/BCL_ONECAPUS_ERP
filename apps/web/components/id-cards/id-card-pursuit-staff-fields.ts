import type { IdCardFieldKey } from '@/types/id-card-template';
import type { IdCardModel, StaffIdCardModel } from '@/types/id-card';
import type { FieldRenderCtx } from './id-card-field-content';
import { renderBarcodePrintHtml } from './build-barcode-svg';
import { cleanInstitutionLocation, isAcademicSessionText } from './id-card-programme-utils';
import {
  formatStaffJoiningDate,
  formatStaffValidUntil,
  isPursuitStaff,
  PS_GOLD,
  PS_NAVY,
  pursuitCenterWatermarkHtml,
  pursuitFrontAddressLine,
  pursuitVerificationPath,
  pursuitVerificationUrlHtml,
  pursuitWatermarkText,
  staffContactLineHtml,
  staffFrontFooterSvg,
  staffFrontHeaderSvg,
  staffIconRowHtml,
  staffPhotoBorderStyle,
  staffQrFrameCss,
  staffRoleBadgeHtml,
  staffTermsHtml,
  staffValidityHtml,
  institutionContactLines,
} from './id-card-pursuit-staff';

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isBlank(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  return !t || t === '—' || t === '-';
}

function formatCollegeAddress(institution: IdCardModel['institution']): string {
  return cleanInstitutionLocation(institution.address, institution.campusName);
}

function affiliationLine(model: IdCardModel): string {
  const inst = model.institution as IdCardModel['institution'] & {
    affiliationLine?: string | null;
  };
  const custom = inst.affiliationLine?.trim();
  if (custom && !isAcademicSessionText(custom)) return custom;
  return 'Affiliated to North-Eastern Hill University (NEHU)';
}

function accreditationLine(model: IdCardModel): string {
  const inst = model.institution as IdCardModel['institution'] & {
    accreditationLine?: string | null;
  };
  if (inst.accreditationLine?.trim()) return inst.accreditationLine.trim();
  const badges = (model.branding?.badges ?? []).filter(
    (b) => b && !isAcademicSessionText(b) && /naac|ugc|accredit|recogniz/i.test(b),
  );
  if (badges.length > 0) return badges.slice(0, 2).join(' · ');
  return 'Recognized by UGC · NAAC Accredited';
}

function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

function staffModel(model: IdCardModel): StaffIdCardModel | null {
  return model.cardType === 'staff' ? model : null;
}

function staffFieldRow(label: string, value: string | null | undefined): string {
  return !isBlank(value) ? staffIconRowHtml(label, escHtml(value!)) : '';
}

export function renderPursuitStaffFieldHtml(
  fieldKey: IdCardFieldKey,
  ctx: FieldRenderCtx,
): string | null {
  if (!isPursuitStaff(ctx.stylePreset)) return null;

  const { model, side, signatureUrl, photoShape } = ctx;
  const staff = staffModel(model);
  const inst = model.institution;
  const holder = model.holder;
  const v = model.validity;
  const collegeAddr = formatCollegeAddress(inst);
  const affil = affiliationLine(model);
  const accredit = accreditationLine(model);
  const name = holder.fullName;

  switch (fieldKey) {
    case 'headerBand':
      return side !== 'back'
        ? `<div style="width:100%;height:100%;overflow:hidden;">${staffFrontHeaderSvg()}</div>`
        : '';
    case 'footerBand':
      return `<div style="width:100%;height:100%;overflow:hidden;">${staffFrontFooterSvg()}</div>`;
    case 'watermark': {
      const wmText = escHtml(pursuitWatermarkText(inst.displayName || 'Don Bosco College, Tura'));
      return pursuitCenterWatermarkHtml(wmText);
    }
    case 'logo':
      return inst.logoUrl
        ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fff;padding:0.6mm;box-sizing:border-box;box-shadow:0 1px 2px rgba(0,0,0,0.12);"><img src="${escHtml(inst.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" /></div>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fff;font-size:6pt;font-weight:800;color:${PS_NAVY};">${escHtml(inst.shortName?.slice(0, 3) ?? 'DBC')}</div>`;
    case 'collegeName':
      if (side === 'back') {
        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <p style="margin:0;font-size:6pt;font-weight:900;text-transform:uppercase;color:${PS_NAVY};text-align:center;">${escHtml(inst.displayName)}</p>
          <div style="margin-top:0.8mm;display:flex;width:70%;align-items:center;gap:1mm;">
            <span style="flex:1;height:0.3mm;background:${PS_GOLD};"></span><span style="color:${PS_NAVY};font-size:4pt;">★</span><span style="flex:1;height:0.3mm;background:${PS_GOLD};"></span>
          </div>
        </div>`;
      }
      return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 0.5mm;">
        <p style="margin:0;font-size:5.8pt;font-weight:900;text-transform:uppercase;color:#fff;text-align:center;line-height:1.05;">${escHtml(inst.displayName)}</p>
        <p style="margin:0.35mm 0 0;font-size:2.6pt;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:rgba(255,255,255,0.95);text-align:center;">— Pursuit of Excellence —</p>
      </div>`;
    case 'collegeAddress': {
      const line = side === 'back' ? collegeAddr : pursuitFrontAddressLine(collegeAddr);
      return line
        ? `<p style="margin:0;font-size:3.2pt;font-weight:500;color:rgba(255,255,255,0.95);line-height:1.2;text-align:center;">${escHtml(line)}</p>`
        : '';
    }
    case 'affiliationLine':
      return affil
        ? `<p style="margin:0;font-size:2.8pt;font-weight:600;color:rgba(255,255,255,0.92);line-height:1.15;text-align:center;">${escHtml(affil)}</p>`
        : '';
    case 'accreditationLine':
      return accredit
        ? `<p style="margin:0;font-size:2.6pt;font-weight:500;color:rgba(255,255,255,0.88);line-height:1.15;text-align:center;font-style:italic;">${escHtml(accredit)}</p>`
        : '';
    case 'photo': {
      const peStyle = staffPhotoBorderStyle();
      const radius = photoShape === 'circle' ? '50%' : peStyle.borderRadius;
      const border = `border:${peStyle.borderWidth} ${peStyle.borderStyle} ${peStyle.borderColor};border-radius:${radius};`;
      if (holder.photoUrl) {
        return `<img src="${escHtml(holder.photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;${border}display:block;" />`;
      }
      return `<div style="width:100%;height:100%;${border}background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:12pt;font-weight:800;color:${PS_NAVY};">${escHtml(name.charAt(0))}</div>`;
    }
    case 'name':
      return `<p style="margin:0;font-size:8.5pt;font-weight:900;text-transform:uppercase;color:${PS_NAVY};line-height:1.05;letter-spacing:0.035em;text-align:center;">${escHtml(name)}</p>`;
    case 'subtitle':
      return staff && !isBlank(staff.holder.designation)
        ? `<p style="margin:0;font-size:5.5pt;font-weight:800;text-transform:uppercase;color:${PS_GOLD};text-align:center;letter-spacing:0.08em;">${escHtml(staff.holder.designation!)}</p>`
        : '';
    case 'roleLabel':
      return staffRoleBadgeHtml();
    case 'employeeId':
      return staff ? staffFieldRow('Employee ID', staff.holder.employeeId) : '';
    case 'department':
      return staffFieldRow('Department', staff?.holder.department);
    case 'designation':
      return staffFieldRow('Designation', staff?.holder.designation);
    case 'email':
      return staffFieldRow('Email', staff?.holder.email);
    case 'phone':
      return staffFieldRow('Phone', staff?.holder.phone);
    case 'joiningDate':
      return staff
        ? staffFieldRow('Joining Date', formatStaffJoiningDate(staff.holder.joiningDate))
        : '';
    case 'rfidNumber':
      return staffFieldRow('RFID No', staff?.holder.rfidNumber);
    case 'validity': {
      const dateLabel = formatStaffValidUntil(v.validTo, v.validToLabel);
      if (!dateLabel && !v.validToLabel) return '';
      return staffValidityHtml(escHtml(dateLabel || v.validToLabel!));
    }
    case 'principalSignature': {
      const url =
        signatureUrl ??
        (model.branding as { principalSignatureUrl?: string | null } | undefined)
          ?.principalSignatureUrl ??
        null;
      const align = 'align-items:flex-end;';
      if (url) {
        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;${align}justify-content:flex-end;">
          <img src="${escHtml(url)}" alt="" style="max-width:90%;max-height:70%;object-fit:contain;" />
          <p style="margin:0.5mm 0 0;font-size:3.2pt;font-weight:700;color:${PS_NAVY};border-top:0.3mm solid rgba(0,27,68,0.25);padding-top:0.5mm;width:80%;text-align:center;">Principal</p>
        </div>`;
      }
      return `<div style="width:100%;height:100%;display:flex;flex-direction:column;${align}justify-content:flex-end;">
        <p style="margin:0;font-size:8pt;font-style:italic;color:#94a3b8;">Signature</p>
        <p style="margin:0.5mm 0 0;font-size:3.2pt;font-weight:700;color:${PS_NAVY};border-top:0.3mm solid rgba(0,27,68,0.25);padding-top:0.5mm;width:80%;text-align:center;">Principal</p>
      </div>`;
    }
    case 'qr': {
      if (!model.verification.qrPayload) return '';
      const qrImg = `<img src="${qrImageUrl(model.verification.qrPayload)}" alt="QR" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <div style="width:88%;height:88%;${staffQrFrameCss()}">${qrImg}</div>
      </div>`;
    }
    case 'barcode':
      return model.verification.barcodeValue
        ? renderBarcodePrintHtml(model.verification.barcodeValue)
        : '';
    case 'verificationInfo': {
      const code = pursuitVerificationPath(
        model.verification.qrPayload ?? model.verification.barcodeValue,
        staff?.holder.employeeId,
      );
      if (isBlank(code)) return '';
      return pursuitVerificationUrlHtml(escHtml(code!));
    }
    case 'contact':
      return institutionContactLines(model)
        .map((line) => staffContactLineHtml(line.icon, escHtml(line.text)))
        .join('');
    case 'terms':
      return staffTermsHtml();
    default:
      return null;
  }
}
