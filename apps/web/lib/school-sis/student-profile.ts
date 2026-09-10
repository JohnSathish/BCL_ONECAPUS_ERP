export type AddressLike = {
  line?: string | null;
  line1?: string | null;
  house?: string | null;
  postOffice?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pin?: string | null;
};

export type ProfileStudentLike = {
  fullName?: string | null;
  admissionNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  house?: string | null;
  currentAddress?: AddressLike | null;
  enrollments?: Array<{ rollNumber?: string | null }>;
  guardians?: Array<{
    guardian?: { fullName?: string | null; phone?: string | null; email?: string | null } | null;
  }>;
  documents?: Array<{ slot?: string }>;
};

export function studentInitials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''}`;
  return letters.toUpperCase() || 'S';
}

export function formatSchoolDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatSchoolDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ageFromDob(iso?: string | null) {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatSchoolAddress(address?: AddressLike | null, fallback?: string | null) {
  if (!address || typeof address !== 'object') return fallback?.trim() || '';
  const parts = [
    address.house,
    address.line || address.line1,
    address.postOffice,
    address.city,
    address.district,
    address.state,
    address.pin,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  return parts.join(', ') || fallback?.trim() || '';
}

export function houseFromStudent(s: ProfileStudentLike) {
  return s.house?.trim() || '';
}

export function profileGapLabels(s: ProfileStudentLike): string[] {
  const enr = s.enrollments?.[0];
  const guardian = s.guardians?.[0]?.guardian;
  const gaps: string[] = [];
  if (!s.photoUrl) gaps.push('Student photo');
  if (!s.dateOfBirth) gaps.push('Date of birth');
  if (!s.gender) gaps.push('Gender');
  if (!(s.phone || guardian?.phone)) gaps.push('Phone');
  if (!guardian?.fullName) gaps.push('Parent / guardian');
  if (!s.email && !guardian?.email) gaps.push('Parent / student email');
  if (!formatSchoolAddress(s.currentAddress, s.address)) gaps.push('Address');
  if (!enr) gaps.push('Enrollment');
  if (!s.bloodGroup) gaps.push('Blood group');
  if (!s.house) gaps.push('House');
  const docs = s.documents ?? [];
  if (!docs.some((d) => /BIRTH/i.test(d.slot ?? ''))) gaps.push('Birth certificate');
  return gaps;
}

export function profileCompletion(s: ProfileStudentLike) {
  const checks = [
    Boolean(s.fullName?.trim()),
    Boolean(s.admissionNumber),
    Boolean(s.dateOfBirth),
    Boolean(s.gender),
    Boolean(s.phone || s.guardians?.[0]?.guardian?.phone),
    Boolean(s.photoUrl),
    Boolean(formatSchoolAddress(s.currentAddress, s.address)),
    Boolean(s.guardians?.[0]?.guardian?.fullName),
    Boolean(s.enrollments?.[0]),
    Boolean(s.bloodGroup),
  ];
  const filled = checks.filter(Boolean).length;
  const percent = Math.round((filled / checks.length) * 100);
  return { percent, filled, total: checks.length, missing: profileGapLabels(s) };
}

export function indianWhatsAppHref(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const n = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${n}`;
}
