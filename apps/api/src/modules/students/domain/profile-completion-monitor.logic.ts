export const PROFILE_MONITOR_FIELDS = [
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'permanentAddress', label: 'Permanent Address' },
  { key: 'presentAddress', label: 'Present Address' },
  { key: 'fatherName', label: "Father's Name" },
  { key: 'motherName', label: "Mother's Name" },
  { key: 'photo', label: 'Student Photograph' },
] as const;

export type ProfileMonitorFieldKey =
  (typeof PROFILE_MONITOR_FIELDS)[number]['key'];

export const DEFAULT_PROFILE_REMINDER = `Dear {student_name},

Our records show that you have not updated the following profile details: {missing_fields}.

Please log in to the Don Bosco College App and update them as soon as possible.

Thank you.

IT Team
Don Bosco College, Tura`;

const FIELD_SET = new Set<string>(
  PROFILE_MONITOR_FIELDS.map((field) => field.key),
);

export function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  const text = String(value).trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return (
    lowered !== 'null' &&
    lowered !== 'undefined' &&
    lowered !== 'n/a' &&
    lowered !== '-'
  );
}

export function isValidMobile(value: unknown): boolean {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith('91'))
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  return false;
}

export function normalizeMobile(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return digits;
  if (
    digits.length === 12 &&
    digits.startsWith('91') &&
    /^[6-9]\d{9}$/.test(digits.slice(2))
  ) {
    return digits.slice(2);
  }
  if (
    digits.length === 11 &&
    digits.startsWith('0') &&
    /^[6-9]\d{9}$/.test(digits.slice(1))
  ) {
    return digits.slice(1);
  }
  return null;
}

export function isValidEmail(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function normalizeRequiredKeys(keys: unknown): ProfileMonitorFieldKey[] {
  const incoming = Array.isArray(keys) ? keys.map((key) => String(key)) : [];
  const picked = PROFILE_MONITOR_FIELDS.map((field) => field.key).filter(
    (key) => incoming.includes(key),
  );
  return picked.length
    ? picked
    : PROFILE_MONITOR_FIELDS.map((field) => field.key);
}

export function fieldLabel(key: string): string {
  return (
    PROFILE_MONITOR_FIELDS.find((field) => field.key === key)?.label ?? key
  );
}

export function isMonitorFieldKey(key: string): key is ProfileMonitorFieldKey {
  return FIELD_SET.has(key);
}

export type MonitorPresence = Record<ProfileMonitorFieldKey, boolean>;

export function missingFields(
  presence: MonitorPresence,
  required: ProfileMonitorFieldKey[],
) {
  return required
    .filter((key) => !presence[key])
    .map((key) => ({ key, label: fieldLabel(key) }));
}

export function completionPercent(missingCount: number, requiredCount: number) {
  if (requiredCount <= 0) return 100;
  return Math.round(((requiredCount - missingCount) / requiredCount) * 100);
}

export function personalizeReminder(
  template: string,
  input: {
    studentName: string;
    rollNumber: string;
    missingFields: string[];
    collegeName?: string;
  },
) {
  return template
    .replaceAll('{student_name}', input.studentName || 'Student')
    .replaceAll('{roll_number}', input.rollNumber || '—')
    .replaceAll(
      '{missing_fields}',
      input.missingFields.join(', ') || 'required profile details',
    )
    .replaceAll(
      '{college_name}',
      input.collegeName || 'Don Bosco College, Tura',
    );
}
