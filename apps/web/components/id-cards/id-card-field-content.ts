import type { IdCardFieldKey, IdCardLayoutMeta } from '@/types/id-card-template';
import type { IdCardModel, StaffIdCardModel, StudentIdCardModel } from '@/types/id-card';
import {
  formatPursuitValidUntilDate,
  formatDisplayGender,
  institutionContactLines,
  isPursuitExcellence,
  PE_NAVY,
  pursuitCenterWatermarkHtml,
  pursuitContactLineHtml,
  pursuitDepartmentSubtitle,
  pursuitFrontAddressLine,
  pursuitFrontFooterSvg,
  pursuitFrontHeaderSvg,
  pursuitGridRowHtml,
  pursuitHologramPlaceholderHtml,
  pursuitPhotoBorderStyle,
  pursuitQrFrameCss,
  pursuitTermsHtml,
  pursuitValidityHtml,
  pursuitVerificationPath,
  pursuitVerificationUrlHtml,
  pursuitWatermarkText,
  resolvePursuitTypeScale,
} from './id-card-pursuit-excellence';
import { renderBarcodePrintHtml } from './build-barcode-svg';
import { renderPursuitStaffFieldHtml } from './id-card-pursuit-staff-fields';
import { isPursuitStaff } from './id-card-pursuit-staff';
import {
  abbreviateProgramme,
  cleanInstitutionLocation,
  isAcademicSessionText,
} from './id-card-programme-utils';
import type { IdCardTypeScale } from './id-card-typography';

export type FieldRenderOptions = {
  stylePreset?: IdCardLayoutMeta['stylePreset'];
  photoShape?: 'square' | 'circle' | 'rounded';
  signatureUrl?: string | null;
  side?: 'front' | 'back';
  /** Designer element style.fontSize (pt) — scales Pursuit type when set. */
  fontSize?: number | null;
};

export type FieldRenderCtx = {
  model: IdCardModel;
  primary: string;
  accent: string;
} & FieldRenderOptions;

function headerGradient(
  preset: IdCardLayoutMeta['stylePreset'] | undefined,
  primary: string,
  accent: string,
) {
  switch (preset) {
    case 'gradient':
      return `linear-gradient(135deg, ${accent} 0%, ${primary} 45%, #ec4899 100%)`;
    case 'corporate':
      return `linear-gradient(180deg, ${primary} 0%, #334155 100%)`;
    case 'minimal':
      return primary;
    case 'gold':
      return `linear-gradient(135deg, #111827 0%, ${primary} 35%, #ca8a04 100%)`;
    case 'geometric':
      return `linear-gradient(120deg, ${primary} 0%, ${accent} 55%, #06b6d4 100%)`;
    case 'academic':
      return `linear-gradient(135deg, #7f1d1d 0%, ${primary} 50%, #ca8a04 100%)`;
    case 'rfid':
      return `linear-gradient(180deg, ${primary} 0%, #0ea5e9 100%)`;
    case 'elite':
      return `linear-gradient(135deg, ${primary} 0%, ${accent} 70%, ${primary} 100%)`;
    default:
      return `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`;
  }
}

function photoRadius(shape: FieldRenderOptions['photoShape']) {
  if (shape === 'circle') return '50%';
  if (shape === 'rounded') return '2.5mm';
  return '1.2mm';
}

export function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isBlank(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  return !t || t === '—' || t === '-';
}

export function formatCollegeAddress(institution: IdCardModel['institution']): string {
  return cleanInstitutionLocation(institution.address, institution.campusName);
}

export function affiliationLine(model: IdCardModel): string {
  const inst = model.institution as IdCardModel['institution'] & {
    affiliationLine?: string | null;
  };
  const custom = inst.affiliationLine?.trim();
  if (custom && !isAcademicSessionText(custom)) return custom;
  return 'Affiliated to North-Eastern Hill University (NEHU)';
}

export function accreditationLine(model: IdCardModel): string {
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

export function studentHolder(model: IdCardModel): StudentIdCardModel['holder'] | null {
  return model.cardType === 'student' ? model.holder : null;
}

export function displayProgramme(student: StudentIdCardModel['holder']): string | null {
  return abbreviateProgramme(student.programme ?? student.subtitle);
}

export function labelValueHtml(
  label: string,
  value: string | null | undefined,
  _primary: string,
  opts?: { multiline?: boolean; typeScale?: IdCardTypeScale },
) {
  if (isBlank(value)) return '';
  const text = value!.trim();
  const labelSize = opts?.typeScale?.label ?? '3.8pt';
  const valueSize = opts?.multiline
    ? (opts?.typeScale?.address ?? opts?.typeScale?.value ?? '5.2pt')
    : (opts?.typeScale?.value ?? '5.2pt');
  return `<div style="display:flex;gap:1.2mm;align-items:baseline;line-height:1.25;width:100%;">
    <span style="flex:0 0 16mm;font-size:${labelSize};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">${escHtml(label)}</span>
    <span style="flex:1;font-size:${valueSize};font-weight:700;color:#0f172a;${opts?.multiline ? 'white-space:pre-wrap;word-break:break-word;' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'}">${escHtml(text)}</span>
  </div>`;
}

export function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
}

export function fieldHasContent(fieldKey: IdCardFieldKey, ctx: FieldRenderCtx): boolean {
  return renderFieldHtml(fieldKey, ctx).length > 0;
}

export function renderFieldHtml(fieldKey: IdCardFieldKey, ctx: FieldRenderCtx): string {
  if (isPursuitStaff(ctx.stylePreset)) {
    const staffHtml = renderPursuitStaffFieldHtml(fieldKey, ctx);
    if (staffHtml !== null) return staffHtml;
  }

  const { model, primary, accent, stylePreset, photoShape, signatureUrl, side, fontSize } = ctx;
  const inst = model.institution;
  const student = studentHolder(model);
  const holder = model.holder;
  const name = student?.displayFullName ?? holder.fullName;
  const collegeAddr = formatCollegeAddress(inst);
  const affil = affiliationLine(model);
  const accredit = accreditationLine(model);
  const v = model.validity;
  const pe = isPursuitExcellence(stylePreset);
  const ts = pe ? resolvePursuitTypeScale(fontSize) : null;

  switch (fieldKey) {
    case 'headerBand':
      if (isPursuitExcellence(stylePreset) && side !== 'back') {
        return `<div style="width:100%;height:100%;overflow:hidden;">${pursuitFrontHeaderSvg()}</div>`;
      }
      if (isPursuitExcellence(stylePreset)) return '';
      return `<div style="width:100%;height:100%;background:${headerGradient(stylePreset, primary, accent)};"></div>`;
    case 'footerBand':
      if (isPursuitExcellence(stylePreset)) {
        return `<div style="width:100%;height:100%;overflow:hidden;">${pursuitFrontFooterSvg()}</div>`;
      }
      return '';
    case 'watermark':
      if (isPursuitExcellence(stylePreset)) {
        const wmText = escHtml(pursuitWatermarkText(inst.displayName || 'Don Bosco College, Tura'));
        return pursuitCenterWatermarkHtml(wmText);
      }
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.018;font-size:24pt;font-weight:900;text-transform:uppercase;color:${primary};letter-spacing:0.1em;">${escHtml(inst.shortName || 'DBC')}</div>`;
    case 'logo':
      return inst.logoUrl
        ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fff;padding:0.6mm;box-sizing:border-box;box-shadow:0 1px 2px rgba(0,0,0,0.12);"><img src="${escHtml(inst.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" /></div>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fff;font-size:6pt;font-weight:800;color:${primary};">${escHtml(inst.shortName?.slice(0, 3) ?? 'DBC')}</div>`;
    case 'collegeName':
      if (pe && side === 'back') {
        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <p style="margin:0;font-size:${ts!.header};font-weight:900;text-transform:uppercase;color:${PE_NAVY};text-align:center;">${escHtml(inst.displayName)}</p>
          <div style="margin-top:0.8mm;display:flex;width:70%;align-items:center;gap:1mm;">
            <span style="flex:1;height:0.3mm;background:${PE_NAVY};"></span><span style="color:${PE_NAVY};font-size:${ts!.headerSub};">★</span><span style="flex:1;height:0.3mm;background:${PE_NAVY};"></span>
          </div>
        </div>`;
      }
      if (pe) {
        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 0.5mm;">
          <p style="margin:0;font-size:${ts!.header};font-weight:900;text-transform:uppercase;color:#fff;text-align:center;line-height:1.05;">${escHtml(inst.displayName)}</p>
          <p style="margin:0.4mm 0 0;font-size:${ts!.headerSub};font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:rgba(255,255,255,0.95);text-align:center;">— Pursuit of Excellence —</p>
        </div>`;
      }
      return `<p style="margin:0;font-size:7pt;font-weight:900;text-transform:uppercase;color:#ffffff;line-height:1.05;letter-spacing:0.04em;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${escHtml(inst.displayName)}</p>`;
    case 'collegeAddress':
      if (pe && side !== 'back') {
        const line = pursuitFrontAddressLine(collegeAddr);
        return line
          ? `<p style="margin:0;font-size:${ts!.headerSub};font-weight:500;color:rgba(255,255,255,0.95);line-height:1.25;text-align:center;">${escHtml(line)}</p>`
          : '';
      }
      return collegeAddr
        ? `<p style="margin:0;font-size:3.8pt;font-weight:500;color:rgba(255,255,255,0.95);line-height:1.25;text-align:center;">${escHtml(collegeAddr)}</p>`
        : '';
    case 'affiliationLine':
      return affil
        ? `<p style="margin:0;font-size:3.2pt;font-weight:600;color:rgba(255,255,255,0.9);line-height:1.15;text-align:center;">${escHtml(affil)}</p>`
        : '';
    case 'accreditationLine':
      return accredit
        ? `<p style="margin:0;font-size:3pt;font-weight:500;color:rgba(255,255,255,0.82);line-height:1.15;text-align:center;font-style:italic;">${escHtml(accredit)}</p>`
        : '';
    case 'photo': {
      const pePhoto = isPursuitExcellence(stylePreset);
      const radius = photoRadius(photoShape);
      const peStyle = pePhoto ? pursuitPhotoBorderStyle() : null;
      if (holder.photoUrl) {
        const border = peStyle
          ? `border:${peStyle.borderWidth} ${peStyle.borderStyle} ${peStyle.borderColor};border-radius:${peStyle.borderRadius};`
          : `border:0.5mm solid ${stylePreset === 'gold' ? '#ca8a04' : accent};border-radius:${radius};`;
        return `<img src="${escHtml(holder.photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;${border}box-shadow:0 1px 3px rgba(0,0,0,0.08);display:block;" />`;
      }
      const border = peStyle
        ? `border:${peStyle.borderWidth} ${peStyle.borderStyle} ${peStyle.borderColor};border-radius:${peStyle.borderRadius};`
        : `border:0.5mm solid ${stylePreset === 'gold' ? '#ca8a04' : accent};border-radius:${radius};`;
      return `<div style="width:100%;height:100%;${border}background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:12pt;font-weight:800;color:${primary};">${escHtml(name.charAt(0))}</div>`;
    }
    case 'name':
      return pe
        ? `<p style="margin:0;font-size:${ts!.name};font-weight:900;text-transform:uppercase;color:${PE_NAVY};line-height:1.05;letter-spacing:0.035em;text-align:center;">${escHtml(name)}</p>`
        : `<p style="margin:0;font-size:7.5pt;font-weight:900;text-transform:uppercase;color:${primary};line-height:1.05;letter-spacing:0.035em;text-align:center;">${escHtml(name)}</p>`;
    case 'roleLabel':
      return pe
        ? `<p style="margin:0;font-size:${ts!.role};font-weight:700;text-transform:uppercase;color:${PE_NAVY};text-align:center;letter-spacing:0.16em;">${escHtml(holder.roleLabel)}</p>`
        : `<p style="margin:0;font-size:4pt;font-weight:700;text-transform:uppercase;color:${accent};text-align:center;letter-spacing:0.14em;">${escHtml(holder.roleLabel)}</p>`;
    case 'registrationNumber':
      return student
        ? pe
          ? pursuitGridRowHtml('Reg No', (student.registrationNumber ?? student.rollNumber)!, ts!)
          : labelValueHtml('Reg No', student.registrationNumber ?? student.rollNumber, primary)
        : '';
    case 'rollNumber':
      return student ? labelValueHtml('Roll No', student.rollNumber, primary) : '';
    case 'department':
      return pe && !isBlank(holder.department)
        ? pursuitGridRowHtml('Department', holder.department!, ts!)
        : labelValueHtml('Department', holder.department, primary);
    case 'programme':
      if (student) {
        if (pe) {
          if (side !== 'back') return '';
          const prog = displayProgramme(student);
          return !isBlank(prog) ? pursuitGridRowHtml('Programme', prog!, ts!) : '';
        }
        return labelValueHtml('Programme', displayProgramme(student) ?? '', primary);
      }
      return '';
    case 'semester':
    case 'academicYear':
      return '';
    case 'gender':
      return student
        ? pe && !isBlank(student.gender)
          ? pursuitGridRowHtml('Gender', formatDisplayGender(student.gender), ts!)
          : labelValueHtml('Gender', formatDisplayGender(student.gender) || student.gender, primary)
        : '';
    case 'bloodGroup':
      if (pe) return '';
      return labelValueHtml('Blood Group', holder.bloodGroup, primary);
    case 'validity': {
      const dateLabel = formatPursuitValidUntilDate(v.validTo, v.validToLabel);
      if (!dateLabel && !v.validToLabel) return '';
      return pe
        ? pursuitValidityHtml(escHtml(dateLabel || v.validToLabel!), ts!)
        : v.validToLabel
          ? `<div style="width:100%;display:flex;justify-content:center;"><span style="display:inline-block;padding:0.8mm 2.5mm;border-radius:999px;background:${primary};color:#fff;font-size:4.5pt;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${escHtml(v.validToLabel)}</span></div>`
          : '';
    }
    case 'validityBlock': {
      const rows = [
        { label: 'Valid Until', value: v.validUntil ?? v.validTo },
        { label: 'Course End', value: v.courseCompletion ?? v.validTo },
        { label: 'Card Expires', value: v.expiryDate ?? v.validTo },
      ].filter((r) => !isBlank(r.value));
      if (rows.length === 0) return '';
      return `<div style="width:100%;border:0.3mm solid ${primary};border-radius:1mm;padding:1mm 1.5mm;background:linear-gradient(180deg,#f8fafc,#fff);">
        ${rows
          .map(
            (r) =>
              `<div style="display:flex;justify-content:space-between;gap:2mm;line-height:1.3;margin-bottom:0.4mm;">
                <span style="font-size:3.5pt;font-weight:700;text-transform:uppercase;color:#64748b;">${escHtml(r.label)}</span>
                <span style="font-size:4.5pt;font-weight:800;color:${primary};">${escHtml(r.value!)}</span>
              </div>`,
          )
          .join('')}
      </div>`;
    }
    case 'rfidNumber': {
      const rfid = holder.rfidNumber;
      if (isBlank(rfid)) return '';
      return pe
        ? pursuitGridRowHtml('RFID', rfid!, ts!)
        : `<div style="width:100%;text-align:center;border:0.3mm dashed ${primary};border-radius:1mm;padding:1mm;background:#f8fafc;">
        <p style="margin:0;font-size:3.2pt;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.08em;">RFID</p>
        <p style="margin:0.5mm 0 0;font-size:6pt;font-weight:900;font-family:monospace;color:${primary};">${escHtml(rfid!)}</p>
      </div>`;
    }
    case 'memberId':
      return labelValueHtml(
        'Member ID',
        (holder as { memberId?: string | null }).memberId ?? student?.registrationNumber,
        primary,
      );
    case 'principalSignature': {
      const url =
        signatureUrl ??
        (model.branding as { principalSignatureUrl?: string | null } | undefined)
          ?.principalSignatureUrl ??
        null;
      const peSig = pe;
      const align = peSig ? 'align-items:flex-end;' : 'align-items:center;';
      if (url) {
        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;${align}justify-content:flex-end;">
          <img src="${escHtml(url)}" alt="" style="max-width:90%;max-height:70%;object-fit:contain;" />
          <p style="margin:0.5mm 0 0;font-size:${peSig ? ts!.fine : '3.2pt'};font-weight:700;color:${PE_NAVY};border-top:0.3mm solid rgba(0,27,68,0.25);padding-top:0.5mm;width:80%;text-align:center;">${peSig ? 'Principal' : 'Authorized Signatory'}</p>
        </div>`;
      }
      return `<div style="width:100%;height:100%;display:flex;flex-direction:column;${align}justify-content:flex-end;">
        <p style="margin:0;font-size:8pt;font-style:italic;color:#94a3b8;">Signature</p>
        <p style="margin:0.5mm 0 0;font-size:${peSig ? ts!.fine : '3.2pt'};font-weight:700;color:${PE_NAVY};border-top:0.3mm solid rgba(0,27,68,0.25);padding-top:0.5mm;width:80%;text-align:center;">${peSig ? 'Principal' : 'Authorized Signatory'}</p>
      </div>`;
    }
    case 'fatherName':
      return student ? labelValueHtml('Father', student.fatherName, primary) : '';
    case 'motherName':
      return student ? labelValueHtml('Mother', student.motherName, primary) : '';
    case 'holderAddress':
      return student
        ? labelValueHtml('Address', student.holderAddress, primary, {
            multiline: true,
            typeScale: ts ?? undefined,
          })
        : '';
    case 'emergencyContact':
      if (pe) {
        const ec =
          student && !isBlank(student.emergencyContact)
            ? student.emergencyContact!
            : model.cardType === 'staff' &&
                !isBlank((model.holder as StaffIdCardModel['holder']).emergencyContact)
              ? (model.holder as StaffIdCardModel['holder']).emergencyContact!
              : null;
        return ec ? pursuitGridRowHtml('Emergency', ec, ts!) : '';
      }
      return student && !isBlank(student.emergencyContact)
        ? labelValueHtml('Emergency', student.emergencyContact!, primary)
        : model.cardType === 'staff' &&
            !isBlank((model.holder as StaffIdCardModel['holder']).emergencyContact)
          ? labelValueHtml(
              'Emergency',
              (model.holder as StaffIdCardModel['holder']).emergencyContact!,
              primary,
            )
          : '';
    case 'qr': {
      if (!model.verification.qrPayload) return '';
      const qrImg = `<img src="${qrImageUrl(model.verification.qrPayload)}" alt="QR" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
      if (pe) {
        return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <div style="width:88%;height:88%;${pursuitQrFrameCss()}">${qrImg}</div>
        </div>`;
      }
      return qrImg;
    }
    case 'barcode':
      return model.verification.barcodeValue
        ? renderBarcodePrintHtml(model.verification.barcodeValue)
        : '';
    case 'verificationInfo': {
      if (pe) {
        const code = pursuitVerificationPath(
          model.verification.qrPayload ?? model.verification.barcodeValue,
          student?.registrationNumber ?? student?.rollNumber,
        );
        if (isBlank(code)) return '';
        return pursuitVerificationUrlHtml(escHtml(code), ts!);
      }
      const code = model.verification.qrPayload ?? model.verification.barcodeValue;
      if (isBlank(code)) return '';
      return `<div style="font-size:3.8pt;line-height:1.3;color:#475569;">
        <p style="margin:0;font-weight:700;color:#0f172a;">Verification ID</p>
        <p style="margin:0.3mm 0 0;font-family:monospace;font-weight:700;font-size:4pt;">${escHtml(code)}</p>
      </div>`;
    }
    case 'address': {
      const line = formatCollegeAddress(inst);
      return line
        ? labelValueHtml('College', line, primary, { multiline: true, typeScale: ts ?? undefined })
        : '';
    }
    case 'contact':
      return institutionContactLines(model)
        .map((line) => pursuitContactLineHtml(line.icon, escHtml(line.text), ts ?? undefined))
        .join('');
    case 'terms':
      if (pe) {
        return pursuitTermsHtml(ts!);
      }
      return `<ul style="margin:0;padding-left:2.5mm;font-size:3.2pt;color:#475569;line-height:1.3;">
        <li>Property of ${escHtml(inst.displayName)}.</li>
        <li>If found, return to college office.</li>
        <li>Unauthorized use is prohibited.</li>
      </ul>`;
    case 'validityFooter':
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${primary};color:#fff;font-size:3.8pt;font-weight:700;">${escHtml(v.validToLabel)}</div>`;
    case 'subtitle': {
      if (pe && !isBlank(holder.department)) {
        const line = pursuitDepartmentSubtitle(holder.department!);
        return `<p style="margin:0;font-size:${ts!.subtitle};font-weight:600;color:#475569;text-align:center;line-height:1.2;">${escHtml(line)}</p>`;
      }
      const subtitle = student?.subtitle;
      return !isBlank(subtitle)
        ? `<p style="margin:0;font-size:4.8pt;font-weight:500;color:#475569;text-align:center;">${escHtml(subtitle!)}</p>`
        : '';
    }
    case 'securityHologram':
      return pe ? pursuitHologramPlaceholderHtml() : '';
    default:
      return '';
  }
}
