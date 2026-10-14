/**
 * Resolve a scanned student ID QR/barcode payload against a session roster.
 * Accepts LIB:E:{enrollment} (ID-card studio QR) and raw enrollment/roll/admission.
 */

export type AttendanceScanRosterStudent = {
  id: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  admissionNumber?: string | null;
  fullName?: string | null;
};

function normalizeKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

/** Strip known prefixes and return candidate identifier keys to match. */
export function parseAttendanceScanPayload(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const keys = new Set<string>();
  const add = (value: string) => {
    const n = normalizeKey(value);
    if (n) keys.add(n);
  };

  add(trimmed);

  const libMatch = /^LIB:E:(.+)$/i.exec(trimmed);
  if (libMatch?.[1]) add(libMatch[1]);

  // Issued-card QR sometimes stores card number only — still try as-is (already added).
  // Also accept LIB:C: / bare prefixes without inventing library semantics.
  const libAny = /^LIB:[A-Z]:(.+)$/i.exec(trimmed);
  if (libAny?.[1]) add(libAny[1]);

  return [...keys];
}

export function resolveAttendanceScan<T extends AttendanceScanRosterStudent>(
  raw: string,
  roster: T[],
): T | null {
  const candidates = parseAttendanceScanPayload(raw);
  if (!candidates.length) return null;

  const candidateSet = new Set(candidates);

  for (const student of roster) {
    const fields = [student.enrollmentNumber, student.admissionNumber, student.rollNumber];
    for (const field of fields) {
      if (!field) continue;
      if (candidateSet.has(normalizeKey(field))) return student;
    }
  }

  return null;
}
