'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import type { IdCardFieldKey } from '@/types/id-card-template';
import type { IdCardModel, StaffIdCardModel, StudentIdCardModel } from '@/types/id-card';
import { Cr80Barcode } from './cr80-barcode';
import {
  accreditationLine,
  affiliationLine,
  displayProgramme,
  formatCollegeAddress,
  isBlank,
  qrImageUrl,
  studentHolder,
  type FieldRenderOptions,
} from './id-card-field-content';
import { renderPursuitStaffFieldHtml } from './id-card-pursuit-staff-fields';
import { isPursuitStaff } from './id-card-pursuit-staff';
import {
  formatPursuitValidUntilDate,
  formatDisplayGender,
  institutionContactLines,
  isPursuitExcellence,
  PE_NAVY,
  PE_RED,
  PE_RED_BRIGHT,
  PURSUIT_TERMS,
  pursuitCenterWatermarkHtml,
  pursuitDepartmentSubtitle,
  pursuitFrontAddressLine,
  pursuitFrontFooterSvg,
  pursuitFrontHeaderSvg,
  pursuitPhotoBorderStyle,
  pursuitQrFrameStyle,
  pursuitVerificationPath,
  pursuitWatermarkText,
} from './id-card-pursuit-excellence';

function isStaff(model: IdCardModel): model is StaffIdCardModel {
  return model.cardType === 'staff';
}

function isStudent(model: IdCardModel): model is StudentIdCardModel {
  return model.cardType === 'student';
}

function PursuitGridRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (isBlank(value)) return null;
  return (
    <div className="mb-[0.6mm] flex w-full items-baseline gap-[2mm] leading-[1.15]">
      <span className="w-[16mm] shrink-0 text-[3.6px] font-bold text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[4.4px] font-extrabold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function LabelValueRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  if (isBlank(value)) return null;
  return (
    <div className="flex w-full gap-[1.2mm] leading-[1.15]">
      <span className="w-[16mm] shrink-0 text-[3.8px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span
        className={
          multiline
            ? 'min-w-0 flex-1 text-[5.2px] font-bold leading-snug text-slate-900'
            : 'min-w-0 flex-1 truncate text-[5.2px] font-bold text-slate-900'
        }
      >
        {value}
      </span>
    </div>
  );
}

function headerStyle(preset: FieldRenderOptions['stylePreset'], primary: string, accent: string) {
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

export function renderIdCardField(
  fieldKey: IdCardFieldKey,
  model: IdCardModel,
  accent: string,
  primary: string,
  options: FieldRenderOptions = {},
): React.ReactNode {
  const { stylePreset, photoShape, signatureUrl, side } = options;
  const { institution, verification, validity } = model;
  const student = studentHolder(model);
  const displayName = student?.displayFullName ?? model.holder.fullName;
  const collegeAddr = formatCollegeAddress(institution);
  const affil = affiliationLine(model);
  const accredit = accreditationLine(model);

  if (isPursuitStaff(stylePreset)) {
    const html = renderPursuitStaffFieldHtml(fieldKey, {
      model,
      primary,
      accent,
      stylePreset,
      photoShape,
      signatureUrl,
      side,
    });
    if (html !== null) {
      return html ? (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null;
    }
  }

  switch (fieldKey) {
    case 'headerBand':
      if (isPursuitExcellence(stylePreset) && side !== 'back') {
        return (
          <div
            className="h-full w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: pursuitFrontHeaderSvg() }}
          />
        );
      }
      if (isPursuitExcellence(stylePreset)) return null;
      return (
        <div
          className="h-full w-full"
          style={{ background: headerStyle(stylePreset, primary, accent) }}
        />
      );
    case 'footerBand':
      if (isPursuitExcellence(stylePreset)) {
        return (
          <div
            className="h-full w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: pursuitFrontFooterSvg() }}
          />
        );
      }
      return null;
    case 'watermark':
      if (isPursuitExcellence(stylePreset)) {
        if (side === 'back') {
          const wmText = pursuitWatermarkText(institution.displayName || 'Don Bosco College, Tura');
          return (
            <div
              className="h-full w-full"
              dangerouslySetInnerHTML={{ __html: pursuitCenterWatermarkHtml(wmText) }}
            />
          );
        }
        const wmText = pursuitWatermarkText(institution.displayName || 'Don Bosco College, Tura');
        return (
          <div
            className="h-full w-full"
            dangerouslySetInnerHTML={{ __html: pursuitCenterWatermarkHtml(wmText) }}
          />
        );
      }
      return (
        <div
          className="flex h-full w-full items-center justify-center text-[24px] font-black uppercase tracking-[0.1em] opacity-[0.018]"
          style={{ color: primary }}
        >
          {institution.shortName || 'DBC'}
        </div>
      );
    case 'logo':
      return (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[0.6mm] shadow-sm">
          <BrandingLogoImage
            src={institution.logoUrl ?? DEFAULT_LOGIN_LOGO}
            className="h-full w-full rounded-full object-contain"
          />
        </div>
      );
    case 'collegeName':
      if (isPursuitExcellence(stylePreset) && side === 'back') {
        return (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <p
              className="text-center font-black uppercase leading-[1.05] tracking-wide"
              style={{ color: PE_NAVY, fontSize: '6px' }}
            >
              {institution.displayName}
            </p>
            <div className="mt-[0.8mm] flex w-[70%] items-center gap-[1mm]">
              <span className="h-px flex-1" style={{ backgroundColor: PE_RED }} />
              <span style={{ color: PE_NAVY, fontSize: '4px' }}>★</span>
              <span className="h-px flex-1" style={{ backgroundColor: PE_RED }} />
            </div>
          </div>
        );
      }
      if (isPursuitExcellence(stylePreset)) {
        return (
          <div className="flex h-full w-full flex-col items-center justify-center px-[0.5mm]">
            <p
              className="text-center font-black uppercase leading-[1.05] tracking-wide text-white drop-shadow-sm"
              style={{ fontSize: '6.2px' }}
            >
              {institution.displayName}
            </p>
            <p
              className="mt-[0.4mm] text-center font-semibold uppercase tracking-[0.18em] text-white/95"
              style={{ fontSize: '2.8px' }}
            >
              — Pursuit of Excellence —
            </p>
          </div>
        );
      }
      return (
        <p
          className="text-center font-black uppercase leading-[1.05] tracking-wide text-white drop-shadow-sm"
          style={{ fontSize: '7px' }}
        >
          {institution.displayName}
        </p>
      );
    case 'collegeAddress':
      if (isPursuitExcellence(stylePreset) && side !== 'back') {
        const line = pursuitFrontAddressLine(collegeAddr);
        return line ? (
          <p
            className="text-center font-medium leading-snug text-white/95"
            style={{ fontSize: '3.6px' }}
          >
            {line}
          </p>
        ) : null;
      }
      return collegeAddr ? (
        <p
          className="text-center font-medium leading-snug text-white/95"
          style={{ fontSize: '3.8px' }}
        >
          {collegeAddr}
        </p>
      ) : null;
    case 'affiliationLine':
      if (isPursuitExcellence(stylePreset)) {
        return affil ? (
          <p
            className="flex items-center justify-center gap-[0.8mm] text-center font-semibold leading-snug text-white/92"
            style={{ fontSize: '2.8px' }}
          >
            <span>🎓</span> {affil}
          </p>
        ) : null;
      }
      return affil ? (
        <p
          className="text-center font-semibold leading-snug text-white/90"
          style={{ fontSize: '3.2px' }}
        >
          {affil}
        </p>
      ) : null;
    case 'accreditationLine':
      if (isPursuitExcellence(stylePreset)) {
        return accredit ? (
          <p
            className="flex items-center justify-center gap-[0.8mm] text-center font-medium leading-snug text-white/88"
            style={{ fontSize: '2.7px' }}
          >
            <span>★</span> {accredit}
          </p>
        ) : null;
      }
      return accredit ? (
        <p
          className="text-center font-medium italic leading-snug text-white/82"
          style={{ fontSize: '3px' }}
        >
          {accredit}
        </p>
      ) : null;
    case 'photo': {
      const peBorder = isPursuitExcellence(stylePreset) ? pursuitPhotoBorderStyle() : null;
      const borderColor =
        stylePreset === 'gold' ? '#ca8a04' : isPursuitExcellence(stylePreset) ? PE_NAVY : accent;
      const radius =
        photoShape === 'circle' ? '50%' : isPursuitExcellence(stylePreset) ? '1.4mm' : '1.2mm';
      if (model.holder.photoUrl) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.holder.photoUrl}
            alt=""
            className="h-full w-full object-cover shadow-sm"
            style={
              peBorder ?? {
                borderColor,
                borderWidth: '0.5mm',
                borderStyle: 'solid',
                borderRadius: radius,
              }
            }
          />
        );
      }
      return (
        <div
          className="flex h-full w-full items-center justify-center border bg-slate-100 font-bold"
          style={
            peBorder ?? {
              borderColor,
              borderWidth: '0.5mm',
              color: primary,
              fontSize: '12px',
              borderRadius: radius,
            }
          }
        >
          {displayName.charAt(0)}
        </div>
      );
    }
    case 'name':
      if (isPursuitExcellence(stylePreset)) {
        return (
          <p
            className="text-center font-black uppercase leading-[1.05] tracking-wide"
            style={{ color: PE_NAVY, fontSize: '9px' }}
          >
            {displayName}
          </p>
        );
      }
      return (
        <p
          className="text-center font-black uppercase leading-[1.05] tracking-wide"
          style={{ color: primary, fontSize: '7.5px' }}
        >
          {displayName}
        </p>
      );
    case 'roleLabel':
      if (isPursuitExcellence(stylePreset)) {
        return (
          <p
            className="text-center font-bold uppercase tracking-[0.16em]"
            style={{ color: PE_NAVY, fontSize: '5.5px' }}
          >
            {model.holder.roleLabel}
          </p>
        );
      }
      return (
        <p
          className="text-center font-bold uppercase tracking-[0.14em]"
          style={{ color: accent, fontSize: '4px' }}
        >
          {model.holder.roleLabel}
        </p>
      );
    case 'registrationNumber':
      return student ? (
        isPursuitExcellence(stylePreset) ? (
          <PursuitGridRow label="Reg No" value={student.registrationNumber ?? student.rollNumber} />
        ) : (
          <LabelValueRow label="Reg No" value={student.registrationNumber ?? student.rollNumber} />
        )
      ) : null;
    case 'rollNumber':
      return student ? <LabelValueRow label="Roll No" value={student.rollNumber} /> : null;
    case 'department':
      return isPursuitExcellence(stylePreset) ? (
        <PursuitGridRow label="Department" value={model.holder.department} />
      ) : (
        <LabelValueRow label="Department" value={model.holder.department} />
      );
    case 'programme':
      if (!student) return null;
      if (isPursuitExcellence(stylePreset)) {
        if (side !== 'back') return null;
        return <PursuitGridRow label="Programme" value={displayProgramme(student)} />;
      }
      return <LabelValueRow label="Programme" value={displayProgramme(student)} />;
    case 'semester':
    case 'academicYear':
      return null;
    case 'gender':
      return student ? (
        isPursuitExcellence(stylePreset) ? (
          <PursuitGridRow label="Gender" value={formatDisplayGender(student.gender)} />
        ) : (
          <LabelValueRow
            label="Gender"
            value={formatDisplayGender(student.gender) || student.gender}
          />
        )
      ) : null;
    case 'bloodGroup':
      if (isPursuitExcellence(stylePreset)) return null;
      return <LabelValueRow label="Blood Group" value={model.holder.bloodGroup} />;
    case 'validity': {
      const dateLabel = formatPursuitValidUntilDate(validity.validTo, validity.validToLabel);
      if (!dateLabel && !validity.validToLabel) return null;
      if (isPursuitExcellence(stylePreset)) {
        return (
          <div className="flex w-full justify-center">
            <div
              className="inline-block rounded-full px-[3.5mm] py-[0.8mm] text-center leading-[1.15] text-white"
              style={{ background: PE_RED_BRIGHT }}
            >
              <p className="text-[2.8px] font-bold uppercase tracking-[0.14em]">Valid Until</p>
              <p className="mt-[0.3mm] text-[4.6px] font-black uppercase tracking-wide">
                {dateLabel || validity.validToLabel}
              </p>
            </div>
          </div>
        );
      }
      return validity.validToLabel ? (
        <div className="flex w-full justify-center">
          <span
            className="inline-block rounded-full px-2 py-0.5 font-extrabold uppercase tracking-wide text-white"
            style={{
              background:
                stylePreset === 'gold' ? 'linear-gradient(90deg,#ca8a04,#eab308)' : primary,
              fontSize: '4.5px',
            }}
          >
            {validity.validToLabel}
          </span>
        </div>
      ) : null;
    }
    case 'validityBlock': {
      const rows = [
        { label: 'Valid Until', value: validity.validUntil ?? validity.validTo },
        { label: 'Course End', value: validity.courseCompletion ?? validity.validTo },
        { label: 'Card Expires', value: validity.expiryDate ?? validity.validTo },
      ].filter((r) => !isBlank(r.value));
      if (rows.length === 0) return null;
      return (
        <div
          className="w-full rounded-[1mm] bg-gradient-to-b from-slate-50 to-white px-[1.5mm] py-[1mm]"
          style={{ border: `0.3mm solid ${primary}` }}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              className="mb-[0.4mm] flex justify-between gap-[2mm] leading-[1.3] last:mb-0"
            >
              <span className="text-[3.5px] font-bold uppercase text-slate-500">{r.label}</span>
              <span className="text-[4.5px] font-extrabold" style={{ color: primary }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case 'rfidNumber':
      return !isBlank(model.holder.rfidNumber) ? (
        isPursuitExcellence(stylePreset) ? (
          <PursuitGridRow label="RFID" value={model.holder.rfidNumber} />
        ) : (
          <div
            className="w-full rounded-[1mm] border border-dashed bg-slate-50 px-[1mm] py-[1mm] text-center"
            style={{ borderColor: primary }}
          >
            <p className="text-[3.2px] font-bold uppercase tracking-wider text-slate-500">RFID</p>
            <p className="mt-[0.5mm] font-mono text-[6px] font-black" style={{ color: primary }}>
              {model.holder.rfidNumber}
            </p>
          </div>
        )
      ) : null;
    case 'memberId':
      return <LabelValueRow label="Member ID" value={student?.registrationNumber ?? null} />;
    case 'principalSignature': {
      const url =
        signatureUrl ??
        (model.branding as { principalSignatureUrl?: string | null } | undefined)
          ?.principalSignatureUrl ??
        null;
      const pe = isPursuitExcellence(stylePreset);
      return (
        <div
          className={`flex h-full w-full flex-col justify-end ${pe ? 'items-end' : 'items-center'}`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-[70%] max-w-[90%] object-contain" />
          ) : (
            <p className="text-[8px] italic text-slate-400">Signature</p>
          )}
          <p
            className="mt-[0.5mm] w-[80%] pt-[0.5mm] text-center text-[3.2px] font-bold"
            style={{ color: PE_NAVY, borderTop: `0.3mm solid ${PE_NAVY}33` }}
          >
            {isPursuitExcellence(stylePreset) ? 'Principal' : 'Authorized Signatory'}
          </p>
        </div>
      );
    }
    case 'fatherName':
      return student ? <LabelValueRow label="Father" value={student.fatherName} /> : null;
    case 'motherName':
      return student ? <LabelValueRow label="Mother" value={student.motherName} /> : null;
    case 'holderAddress':
      return student ? (
        <LabelValueRow label="Address" value={student.holderAddress} multiline />
      ) : null;
    case 'emergencyContact':
      if (isPursuitExcellence(stylePreset)) {
        const ec =
          student && !isBlank(student.emergencyContact)
            ? student.emergencyContact
            : isStaff(model) && !isBlank(model.holder.emergencyContact)
              ? model.holder.emergencyContact
              : null;
        return ec ? <PursuitGridRow label="Emergency" value={ec} /> : null;
      }
      if (student && !isBlank(student.emergencyContact)) {
        return <LabelValueRow label="Emergency" value={student.emergencyContact} />;
      }
      if (isStaff(model) && !isBlank(model.holder.emergencyContact)) {
        return <LabelValueRow label="Emergency" value={model.holder.emergencyContact} />;
      }
      return null;
    case 'qr': {
      const url =
        verification.qrImageUrl ??
        (verification.qrPayload ? qrImageUrl(verification.qrPayload) : null);
      if (!url) return null;
      if (isPursuitExcellence(stylePreset)) {
        return (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="h-[82%] w-[82%]" style={pursuitQrFrameStyle()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="QR" className="h-full w-full object-contain" />
            </div>
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="QR" className="h-full w-full object-contain" />
      );
    }
    case 'barcode':
      return verification.barcodeValue ? (
        <Cr80Barcode value={verification.barcodeValue} className="h-full w-full" />
      ) : null;
    case 'verificationInfo': {
      const code = pursuitVerificationPath(
        verification.qrPayload ?? verification.barcodeValue,
        student?.registrationNumber ?? student?.rollNumber,
      );
      if (isPursuitExcellence(stylePreset)) {
        if (isBlank(code)) return null;
        return (
          <div className="w-full text-center leading-snug">
            <p className="text-[2.8px] font-semibold text-slate-500">Verify:</p>
            <p className="mt-[0.2mm] break-all text-[3.1px] font-bold" style={{ color: PE_NAVY }}>
              id.dbctura.ac.in/verify/{code}
            </p>
          </div>
        );
      }
      if (isBlank(code)) return null;
      return (
        <div className="text-[3.8px] leading-snug text-slate-600">
          <p className="font-bold text-slate-900">Verification ID</p>
          <p className="mt-[0.3mm] font-mono text-[4px] font-bold">{code}</p>
        </div>
      );
    }
    case 'contact': {
      const lines = institutionContactLines(model);
      return (
        <div className="w-full">
          {lines.map((line) => (
            <div key={line.text} className="mb-[0.9mm] flex items-start gap-[1.2mm] leading-snug">
              <span
                className="inline-flex h-[3.6mm] w-[3.6mm] shrink-0 items-center justify-center rounded-full text-[2.4px] text-white"
                style={{ backgroundColor: PE_NAVY }}
              >
                {line.icon}
              </span>
              <span className="text-[3.2px] font-semibold text-slate-800">{line.text}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'address': {
      const line = formatCollegeAddress(institution);
      return line ? <LabelValueRow label="College" value={line} multiline /> : null;
    }
    case 'employeeId':
      return isStaff(model) ? (
        <LabelValueRow label="Employee ID" value={model.holder.employeeId} />
      ) : null;
    case 'designation':
      return isStaff(model) ? (
        <LabelValueRow label="Designation" value={model.holder.designation} />
      ) : null;
    case 'subtitle':
      if (isPursuitExcellence(stylePreset) && !isBlank(model.holder.department)) {
        return (
          <p
            className="text-center font-semibold leading-snug text-slate-600"
            style={{ fontSize: '6px' }}
          >
            {pursuitDepartmentSubtitle(model.holder.department!)}
          </p>
        );
      }
      return isStudent(model) && !isBlank(model.holder.subtitle) ? (
        <p className="line-clamp-2 font-medium text-slate-600" style={{ fontSize: '4.8px' }}>
          {model.holder.subtitle}
        </p>
      ) : null;
    case 'securityHologram':
      if (!isPursuitExcellence(stylePreset)) return null;
      return (
        <div className="flex h-full w-full items-center justify-center rounded-[0.8mm] border border-dashed border-[rgba(0,27,68,0.35)] bg-gradient-to-br from-white/70 to-slate-100/90">
          <p className="text-center text-[2.2px] font-extrabold uppercase leading-tight tracking-wide text-[rgba(0,27,68,0.55)]">
            Security
            <br />
            Hologram
          </p>
        </div>
      );
    case 'terms':
      if (isPursuitExcellence(stylePreset)) {
        return (
          <div className="w-full">
            <p
              className="mb-[0.8mm] font-black uppercase tracking-wide"
              style={{ color: PE_NAVY, fontSize: '3.2px' }}
            >
              Important
            </p>
            <ul
              className="list-disc space-y-[0.3mm] pl-[2.5mm] leading-snug text-slate-700"
              style={{ fontSize: '2.8px' }}
            >
              {PURSUIT_TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        );
      }
      return (
        <ul
          className="list-disc space-y-0 pl-[2.5mm] leading-snug text-slate-600"
          style={{ fontSize: '3.2px' }}
        >
          <li>Property of {institution.displayName}.</li>
          <li>If found, return to college office.</li>
          <li>Unauthorized use is prohibited.</li>
        </ul>
      );
    case 'validityFooter':
      return (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ backgroundColor: primary, fontSize: '3.8px' }}
        >
          {validity.validToLabel}
        </div>
      );
    default:
      return null;
  }
}

export function paletteKeysForHolderType(holderType: string): IdCardFieldKey[] {
  if (
    holderType === 'STAFF' ||
    holderType === 'CONTRACT' ||
    holderType === 'VISITING' ||
    holderType === 'RESEARCH'
  ) {
    return [
      'headerBand',
      'footerBand',
      'watermark',
      'logo',
      'collegeName',
      'collegeAddress',
      'affiliationLine',
      'accreditationLine',
      'photo',
      'name',
      'subtitle',
      'roleLabel',
      'employeeId',
      'designation',
      'department',
      'email',
      'phone',
      'joiningDate',
      'rfidNumber',
      'validity',
      'principalSignature',
      'qr',
      'barcode',
      'verificationInfo',
      'contact',
      'terms',
    ];
  }
  return [
    'headerBand',
    'watermark',
    'logo',
    'collegeName',
    'collegeAddress',
    'affiliationLine',
    'accreditationLine',
    'photo',
    'name',
    'roleLabel',
    'subtitle',
    'registrationNumber',
    'department',
    'programme',
    'gender',
    'bloodGroup',
    'validity',
    'rfidNumber',
    'securityHologram',
    'validityBlock',
    'qr',
    'barcode',
    'holderAddress',
    'fatherName',
    'motherName',
    'emergencyContact',
    'verificationInfo',
    'terms',
    'validityFooter',
    'principalSignature',
    'footerBand',
    'contact',
  ];
}
