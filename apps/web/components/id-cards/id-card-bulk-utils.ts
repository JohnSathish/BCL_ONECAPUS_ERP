export type BulkGenerateIdCardsResult = {
  generated: number;
  skipped?: number;
  total?: number;
};

export function formatBulkGenerateMessage(
  res: BulkGenerateIdCardsResult,
  holderLabel: 'staff' | 'student',
): string {
  const parts = [`Generated ${res.generated} ${holderLabel} card record(s).`];
  if (res.skipped != null && res.skipped > 0) {
    parts.push(`${res.skipped} skipped (already have active cards).`);
  }
  if (res.total != null && res.total !== res.generated) {
    parts.push(`${res.total} eligible in scope.`);
  }
  return parts.join(' ');
}

export function staffBulkScopeLabel(options: {
  departmentName?: string;
  staffTypeLabel?: string;
}): string {
  const parts: string[] = [];
  if (options.departmentName) {
    parts.push(options.departmentName);
  } else {
    parts.push('all active staff');
  }
  if (options.staffTypeLabel) parts.push(options.staffTypeLabel);
  return parts.join(' · ');
}

export function studentBulkScopeLabel(options: {
  departmentName?: string;
  semester?: string | number;
  sessionName?: string;
}): string {
  const parts: string[] = [];
  if (options.departmentName) {
    parts.push(options.departmentName);
  } else {
    parts.push('all active students');
  }
  if (options.semester) parts.push(`Semester ${options.semester}`);
  if (options.sessionName) parts.push(options.sessionName);
  return parts.join(' · ');
}
