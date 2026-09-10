export const SCHOOL_WEB_FLASH_NEWS_MAX = 24;

export const SCHOOL_FLASH_ICONS = [
  'admissions',
  'calendar',
  'exam',
  'people',
  'notice',
  'megaphone',
] as const;

export type SchoolFlashIcon = (typeof SCHOOL_FLASH_ICONS)[number];

export type SchoolFlashNewsItem = {
  id: string;
  title: string;
  href: string;
  icon: SchoolFlashIcon;
  isNew: boolean;
  enabled: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function iconOf(value: unknown): SchoolFlashIcon {
  const raw = String(value || '').trim();
  return (SCHOOL_FLASH_ICONS as readonly string[]).includes(raw)
    ? (raw as SchoolFlashIcon)
    : 'notice';
}

export function parseFlashNewsPayload(payload: Record<string, unknown> | undefined) {
  const bag = payload ?? {};
  const items = (Array.isArray(bag.items) ? bag.items : [])
    .slice(0, SCHOOL_WEB_FLASH_NEWS_MAX)
    .map((row, index) => {
      const item = asRecord(row);
      return {
        id: String(item.id || `flash-${index + 1}`),
        title: String(item.title || '').trim(),
        href: String(item.href || '').trim(),
        icon: iconOf(item.icon),
        isNew: item.isNew === true,
        enabled: item.enabled !== false,
      } satisfies SchoolFlashNewsItem;
    })
    .filter((item) => item.title.length >= 2);
  return {
    label: String(bag.label || 'FLASH NEWS').trim() || 'FLASH NEWS',
    items,
  };
}

export function visibleFlashNews(items: SchoolFlashNewsItem[]) {
  return items.filter((item) => item.enabled !== false);
}
