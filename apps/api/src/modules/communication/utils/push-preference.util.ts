/** Push preference category keys stored in NotificationPreference.settings (channel PUSH). */
export const PUSH_CATEGORY_KEYS = [
  'fee',
  'attendance',
  'examination',
  'assignment',
  'circulars',
  'timetable',
  'leave',
  'general',
] as const;

export type PushCategoryKey = (typeof PUSH_CATEGORY_KEYS)[number];

export const DEFAULT_PUSH_CATEGORY_SETTINGS: Record<PushCategoryKey, boolean> =
  {
    fee: true,
    attendance: true,
    examination: true,
    assignment: true,
    circulars: true,
    timetable: true,
    leave: true,
    general: true,
  };

/** Map campaign / trigger metadata to a preference category. */
export function resolvePushCategory(input: {
  triggerKey?: string;
  entityType?: string;
  messageType?: string;
  subject?: string;
}): PushCategoryKey {
  const hay = [
    input.triggerKey,
    input.entityType,
    input.messageType,
    input.subject,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    hay.includes('fee') ||
    hay.includes('due') ||
    hay.includes('payment') ||
    hay.includes('scholarship')
  ) {
    return 'fee';
  }
  if (hay.includes('attendance') || hay.includes('shortfall')) {
    return 'attendance';
  }
  if (
    hay.includes('exam') ||
    hay.includes('result') ||
    hay.includes('hall') ||
    hay.includes('marks')
  ) {
    return 'examination';
  }
  if (hay.includes('assignment') || hay.includes('homework')) {
    return 'assignment';
  }
  if (
    hay.includes('timetable') ||
    hay.includes('schedule') ||
    hay.includes('substitute') ||
    hay.includes('class')
  ) {
    return 'timetable';
  }
  if (hay.includes('leave')) {
    return 'leave';
  }
  if (
    hay.includes('circular') ||
    hay.includes('notice') ||
    hay.includes('holiday') ||
    hay.includes('announcement') ||
    hay.includes('meeting')
  ) {
    return 'circulars';
  }
  return 'general';
}

export function isPushCategoryEnabled(
  settings: unknown,
  category: PushCategoryKey,
): boolean {
  if (!settings || typeof settings !== 'object') return true;
  const map = settings as Record<string, unknown>;
  if (!(category in map)) return true;
  return map[category] !== false;
}
