import type { SchoolSisStaff } from '@/services/school-sis';

export type StaffExtras = {
  subjectsTaught?: string[];
  emergencyPhone?: string;
  emergencyName?: string;
  payroll?: {
    epfNo?: string;
    basicSalary?: string;
    contractType?: string;
    workShift?: string;
    workLocation?: string;
    dateOfLeaving?: string;
  };
  leaves?: {
    medical?: string;
    casual?: string;
    maternity?: string;
    sick?: string;
  };
  bank?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifsc?: string;
    branchName?: string;
  };
  transport?: {
    route?: string;
    vehicleNumber?: string;
    pickupPoint?: string;
  };
  hostel?: {
    hostel?: string;
    roomNo?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    twitter?: string;
  };
  documents?: {
    resume?: { fileName?: string; url?: string };
    joiningLetter?: { fileName?: string; url?: string };
  };
};

export function staffInitials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''}`;
  return letters.toUpperCase() || 'T';
}

export function isoDateInput(value?: string | Date | null) {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function asStaffExtras(raw: unknown): StaffExtras {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as StaffExtras & { subjectsTaught?: unknown };
  const subjects = row.subjectsTaught;
  const subjectsTaught = Array.isArray(subjects)
    ? subjects.map((s) => String(s).trim()).filter(Boolean)
    : typeof subjects === 'string'
      ? subjects
          .split(/[,;|/]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  return { ...row, subjectsTaught };
}

function filled(obj?: Record<string, unknown> | null) {
  if (!obj) return false;
  return Object.values(obj).some((v) => {
    if (v == null) return false;
    if (typeof v === 'object') return filled(v as Record<string, unknown>);
    return String(v).trim().length > 0;
  });
}

export function compactStaffExtras(extras: StaffExtras): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (['payroll', 'leaves', 'bank', 'transport', 'hostel', 'social', 'documents'] as const).forEach(
    (key) => {
      const value = extras[key];
      if (filled(value as Record<string, unknown> | undefined)) out[key] = value;
    },
  );
  const subjects = (extras.subjectsTaught ?? []).map((s) => s.trim()).filter(Boolean);
  if (subjects.length) out.subjectsTaught = subjects;
  const emergencyPhone = extras.emergencyPhone?.trim();
  const emergencyName = extras.emergencyName?.trim();
  if (emergencyPhone) out.emergencyPhone = emergencyPhone;
  if (emergencyName) out.emergencyName = emergencyName;
  return out;
}

export function staffProfileGaps(s: SchoolSisStaff): string[] {
  const gaps: string[] = [];
  if (!s.photoUrl) gaps.push('Photo');
  if (!s.gender) gaps.push('Gender');
  if (!s.phone) gaps.push('Phone');
  if (!s.email) gaps.push('Email');
  if (!s.dateOfBirth) gaps.push('Date of birth');
  if (!s.joiningDate) gaps.push('Appointment date');
  if (!s.academicQualification) gaps.push('Academic qualification');
  if (!s.address) gaps.push('Address');
  if (!s.bloodGroup) gaps.push('Blood group');
  return gaps;
}

export function staffProfileCompletion(s: SchoolSisStaff) {
  const checks = [
    Boolean(s.fullName?.trim()),
    Boolean(s.employeeCode?.trim()),
    Boolean(s.dateOfBirth),
    Boolean(s.joiningDate),
    Boolean(s.academicQualification || s.professionalQualification),
    Boolean(s.phone),
    Boolean(s.email),
    Boolean(s.gender),
    Boolean(s.photoUrl),
    Boolean(s.address),
  ];
  const filledCount = checks.filter(Boolean).length;
  return {
    percent: Math.round((filledCount / checks.length) * 100),
    filled: filledCount,
    total: checks.length,
    missing: staffProfileGaps(s),
  };
}
