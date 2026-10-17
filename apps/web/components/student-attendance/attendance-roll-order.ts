type AttendanceRollFields = {
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  admissionNumber?: string | null;
  fullName?: string | null;
};

function compareText(left?: string | null, right?: string | null) {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Roll number order, with the number in PS26-02 before PS26-10. */
export function compareAttendanceRoll(left: AttendanceRollFields, right: AttendanceRollFields) {
  const roll = compareText(left.rollNumber, right.rollNumber);
  if (roll !== 0) return roll;
  const enrollment = compareText(left.enrollmentNumber, right.enrollmentNumber);
  if (enrollment !== 0) return enrollment;
  const admission = compareText(left.admissionNumber, right.admissionNumber);
  if (admission !== 0) return admission;
  return compareText(left.fullName, right.fullName);
}
