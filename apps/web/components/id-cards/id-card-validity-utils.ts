import type { StudentProfile } from '@/types/students';

function formatMonthYear(d: Date) {
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatCardDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function computeStudentCardValidity(
  profile?: Pick<StudentProfile, 'batch' | 'programme'> | null,
) {
  const now = new Date();
  const validFrom = now;

  const validUntil = new Date(now.getFullYear(), 5, 30);
  if (validUntil <= now) validUntil.setFullYear(validUntil.getFullYear() + 1);

  const batchYear = Number(profile?.batch?.match(/\d{4}/)?.[0]) || now.getFullYear();
  const prog = profile?.programme?.toLowerCase() ?? '';
  const durationYears = prog.includes('phd')
    ? 5
    : prog.includes('master') || prog.includes(' m.')
      ? 2
      : 3;
  const courseEndYear = batchYear + durationYears;
  const courseEnd = new Date(courseEndYear, 5, 30);

  return {
    validFrom: formatCardDate(validFrom),
    validTo: formatCardDate(courseEnd),
    validToLabel: `VALID UP TO ${courseEndYear}`,
    validUntil: formatMonthYear(validUntil),
    courseCompletion: `Jun ${courseEndYear}`,
    expiryDate: `Jun ${courseEndYear}`,
  };
}
