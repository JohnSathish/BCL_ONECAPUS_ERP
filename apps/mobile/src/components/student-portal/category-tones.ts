/** Shared FYUGP category colors for student portal cards (match dashboard mockups). */
export const CATEGORY_TONES: Record<string, { fg: string; bg: string; soft: string; dot: string }> =
  {
    MAJOR: { fg: '#047857', bg: '#d1fae5', soft: '#ecfdf5', dot: '#10b981' },
    MINOR: { fg: '#5b21b6', bg: '#ede9fe', soft: '#f5f3ff', dot: '#8b5cf6' },
    MDC: { fg: '#c2410c', bg: '#ffedd5', soft: '#fff7ed', dot: '#f97316' },
    AEC: { fg: '#6d28d9', bg: '#ede9fe', soft: '#f5f3ff', dot: '#8b5cf6' },
    SEC: { fg: '#be185d', bg: '#fce7f3', soft: '#fdf2f8', dot: '#ec4899' },
    VTC: { fg: '#0f766e', bg: '#ccfbf1', soft: '#f0fdfa', dot: '#14b8a6' },
    VAC: { fg: '#334155', bg: '#e2e8f0', soft: '#f8fafc', dot: '#64748b' },
  };

export function categoryTone(category?: string | null) {
  const key = String(category ?? '').toUpperCase();
  return (
    CATEGORY_TONES[key] ?? {
      fg: '#1d4ed8',
      bg: '#dbeafe',
      soft: '#eff6ff',
      dot: '#3b82f6',
    }
  );
}

export const CALENDAR_TYPE_TONES: Record<
  string,
  { fg: string; bg: string; icon: string; label: string }
> = {
  exam: { fg: '#b45309', bg: '#ffedd5', icon: '📝', label: 'Exam' },
  holiday: { fg: '#047857', bg: '#d1fae5', icon: '🎉', label: 'Holiday' },
  assignment: { fg: '#1d4ed8', bg: '#dbeafe', icon: '📋', label: 'Assignment' },
  fee: { fg: '#c2410c', bg: '#ffedd5', icon: '₹', label: 'Fee' },
  event: { fg: '#1d4ed8', bg: '#dbeafe', icon: '👥', label: 'Meeting' },
  meeting: { fg: '#1d4ed8', bg: '#dbeafe', icon: '👥', label: 'Meeting' },
  prayer: { fg: '#6d28d9', bg: '#ede9fe', icon: '🙏', label: 'Prayer' },
};

export function calendarTypeTone(type?: string | null) {
  const key = String(type ?? 'event').toLowerCase();
  if (key.includes('pray')) return CALENDAR_TYPE_TONES.prayer;
  if (key.includes('meet')) return CALENDAR_TYPE_TONES.meeting;
  return (
    CALENDAR_TYPE_TONES[key] ?? {
      fg: '#1d4ed8',
      bg: '#dbeafe',
      icon: '📅',
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Event',
    }
  );
}
