function dayKey(d: Date | string) {
  if (typeof d === 'string') return d.slice(0, 10);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export type HomeworkListStatus = 'draft' | 'active' | 'pending' | 'completed';

export function homeworkListStatus(input: {
  status: string;
  dueDate: Date | string;
  today?: Date | string;
}): HomeworkListStatus {
  if (input.status === 'DRAFT') return 'draft';
  const due = dayKey(input.dueDate);
  const today = dayKey(input.today ?? new Date());
  if (due < today) return 'completed';
  const days =
    (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
    86_400_000;
  if (days <= 2) return 'pending';
  return 'active';
}
