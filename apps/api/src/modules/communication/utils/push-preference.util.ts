/** Push preference category keys stored in NotificationPreference.settings (channel PUSH). */
export const PUSH_CATEGORY_KEYS = [
  'fee',
  'attendance',
  'examination',
  'assignment',
  'circulars',
  'timetable',
  'leave',
  'birthday',
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
    birthday: true,
    general: true,
  };

const COMPOSE_MESSAGE_TYPES = new Set([
  'push',
  'in_app',
  'email',
  'sms',
  'whatsapp',
  'circular',
  'notice',
]);

/** Map campaign / trigger metadata to a preference category. */
export function resolvePushCategory(input: {
  triggerKey?: string;
  entityType?: string;
  messageType?: string;
  subject?: string;
  /** Explicit category from system jobs — wins when valid. */
  category?: string;
}): PushCategoryKey {
  const explicit = (input.category ?? '').toLowerCase().trim();
  if ((PUSH_CATEGORY_KEYS as readonly string[]).includes(explicit)) {
    return explicit as PushCategoryKey;
  }

  const messageType = (input.messageType ?? '').toLowerCase().trim();
  const triggerKey = (input.triggerKey ?? '').trim();
  const entityType = (input.entityType ?? '').trim();

  // Manual Compose campaigns: do not sniff free-text subjects into fee/timetable
  // (e.g. "class of 2026" → timetable SKIP). System triggers still categorize.
  if (COMPOSE_MESSAGE_TYPES.has(messageType) && !triggerKey && !entityType) {
    const subject = (input.subject ?? '').toLowerCase();
    if (
      /\b(holiday|circular|notice|announcement|vacation|closure)\b/.test(
        subject,
      )
    ) {
      return 'circulars';
    }
    return 'general';
  }

  const hay = [triggerKey, entityType, messageType, input.subject]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    hay.includes('fee') ||
    hay.includes('payment') ||
    hay.includes('scholarship') ||
    /\bdue\b/.test(hay)
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
    hay.includes('substitute')
  ) {
    return 'timetable';
  }
  if (hay.includes('leave')) {
    return 'leave';
  }
  if (hay.includes('birthday')) {
    return 'birthday';
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
