import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { navigation as seedNavigation } from '@/lib/navigation';

export type NavItem = { label: string; href: string; children?: NavItem[] };
export type NavGroup = { label: string; items: Array<[string, string]>; children?: NavItem[] };

function mapTree(items: unknown[]): NavItem[] {
  const rows: NavItem[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === 'string' ? item.label : null;
    const url = typeof item.url === 'string' ? item.url : '/';
    if (!label) continue;
    const children = Array.isArray(item.children) ? mapTree(item.children) : [];
    rows.push({ label, href: url, ...(children.length ? { children } : {}) });
  }
  return rows;
}

function treeToGroups(items: NavItem[]): NavGroup[] {
  return items.map((item) => ({
    label: item.label,
    items: item.children?.length
      ? item.children.map((child) => [child.label, child.href] as [string, string])
      : [[item.label, item.href] as [string, string]],
    children: item.children,
  }));
}

function seedAsGroups(): NavGroup[] {
  return seedNavigation.map((group) => ({
    label: group.label,
    items: group.items.map(([label, href]) => [label, href] as [string, string]),
  }));
}

export async function getHeaderNavigation(): Promise<NavGroup[]> {
  const menus = await fetchCms('menus', { location: 'HEADER' }, 120);
  if (!Array.isArray(menus) || !menus.length) return seedAsGroups();
  const first = menus[0];
  if (!isRecord(first) || !Array.isArray(first.items)) return seedAsGroups();
  const tree = mapTree(first.items);
  if (!tree.length) return seedAsGroups();
  // Flat CMS items (no children): group by top-level only as links under synthetic groups
  const hasNesting = tree.some((item) => (item.children?.length ?? 0) > 0);
  if (hasNesting) return treeToGroups(tree);
  return [
    {
      label: 'Explore',
      items: tree.map((item) => [item.label, item.href] as [string, string]),
    },
  ];
}

export async function getFooterNavigation(): Promise<NavItem[]> {
  const menus = await fetchCms('menus', { location: 'FOOTER' }, 120);
  if (!Array.isArray(menus) || !menus.length) return [];
  const first = menus[0];
  if (!isRecord(first) || !Array.isArray(first.items)) return [];
  return mapTree(first.items);
}

export async function getUtilityNavigation(): Promise<NavItem[]> {
  const seed = [
    { label: 'Students', href: '/students' },
    { label: 'Staff', href: '/staff' },
    { label: 'Alumni', href: '/alumni' },
    { label: 'Careers', href: '/careers' },
    { label: 'DBC Blood Donors', href: '/blood-donors' },
    { label: 'Contact', href: '/contact' },
  ];
  const menus = await fetchCms('menus', { location: 'UTILITY' }, 120);
  if (!Array.isArray(menus) || !menus.length) return seed;
  const first = menus[0];
  if (!isRecord(first) || !Array.isArray(first.items)) return seed;
  const tree = mapTree(first.items);
  return tree.length ? tree : seed;
}
