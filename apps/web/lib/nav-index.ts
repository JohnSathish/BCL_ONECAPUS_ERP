import type { LucideIcon } from 'lucide-react';
import type { NavChild, NavGroup, NavItem } from '@/config/navigation';

export type NavIndexEntry = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  module?: string;
  parentLabel?: string;
  groupLabel?: string;
  keywords?: string[];
};

export function navEntryId(label: string, href: string) {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${href.replace(/\//g, '-')}`;
}

function slugId(label: string, href: string) {
  return navEntryId(label, href);
}

function childId(child: NavChild, parent: NavItem) {
  return slugId(`${parent.label}-${child.label}`, child.href);
}

function itemId(item: NavItem) {
  return slugId(item.label, item.href ?? item.children?.[0]?.href ?? item.label);
}

export function buildNavIndex(groups: NavGroup[]): Map<string, NavIndexEntry> {
  const map = new Map<string, NavIndexEntry>();

  for (const group of groups) {
    for (const item of group.items) {
      const baseId = itemId(item);
      if (item.href) {
        map.set(item.href, {
          id: baseId,
          label: item.label,
          href: item.href,
          icon: item.icon,
          module: item.module,
          groupLabel: group.label,
          keywords: [item.label.toLowerCase(), group.label.toLowerCase()],
        });
      }
      if (item.children?.length) {
        for (const child of item.children) {
          const id = childId(child, item);
          map.set(child.href, {
            id,
            label: child.label,
            href: child.href,
            icon: item.icon,
            module: item.module,
            parentLabel: item.label,
            groupLabel: group.label,
            keywords: [
              child.label.toLowerCase(),
              item.label.toLowerCase(),
              group.label.toLowerCase(),
            ],
          });
        }
      }
    }
  }

  return map;
}

export function resolveNavEntry(
  index: Map<string, NavIndexEntry>,
  href: string,
): NavIndexEntry | undefined {
  if (index.has(href)) return index.get(href);
  const sorted = [...index.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, entry] of sorted) {
    if (href.startsWith(prefix)) return entry;
  }
  return undefined;
}

export function findEntryById(
  index: Map<string, NavIndexEntry>,
  id: string,
): NavIndexEntry | undefined {
  for (const entry of index.values()) {
    if (entry.id === id) return entry;
  }
  return undefined;
}
