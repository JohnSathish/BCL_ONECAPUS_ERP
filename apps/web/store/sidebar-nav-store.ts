import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NavChild, NavGroup } from '@/config/navigation';

export type SidebarScrollSection = 'modules' | 'main' | 'system' | 'pinned';

type SidebarNavState = {
  openGroupsByRole: Record<string, Record<string, boolean>>;
  scrollTopByRole: Record<string, Partial<Record<SidebarScrollSection, number>>>;
  setGroupOpen: (role: string, label: string, open: boolean) => void;
  setExclusiveGroupOpen: (role: string, label: string) => void;
  toggleGroup: (role: string, label: string) => void;
  mergeOpenGroups: (role: string, labels: Record<string, boolean>) => void;
  setScrollTop: (role: string, section: SidebarScrollSection, top: number) => void;
  getScrollTop: (role: string, section: SidebarScrollSection) => number;
  isGroupOpen: (role: string, label: string) => boolean;
};

export const useSidebarNavStore = create<SidebarNavState>()(
  persist(
    (set, get) => ({
      openGroupsByRole: {},
      scrollTopByRole: {},
      setGroupOpen: (role, label, open) =>
        set((s) => ({
          openGroupsByRole: {
            ...s.openGroupsByRole,
            [role]: { ...(s.openGroupsByRole[role] ?? {}), [label]: open },
          },
        })),
      setExclusiveGroupOpen: (role, label) => {
        const current = get().openGroupsByRole[role] ?? {};
        const alreadyExclusive =
          current[label] === true &&
          Object.entries(current).every(([key, open]) => (key === label ? open === true : !open));
        if (alreadyExclusive) return;
        set((s) => {
          const prev = s.openGroupsByRole[role] ?? {};
          const next: Record<string, boolean> = {};
          for (const key of Object.keys(prev)) {
            next[key] = false;
          }
          next[label] = true;
          return {
            openGroupsByRole: { ...s.openGroupsByRole, [role]: next },
          };
        });
      },
      toggleGroup: (role, label) => {
        const current = get().openGroupsByRole[role]?.[label] ?? false;
        get().setGroupOpen(role, label, !current);
      },
      mergeOpenGroups: (role, labels) => {
        const current = get().openGroupsByRole[role] ?? {};
        const changed = Object.entries(labels).some(([key, value]) => current[key] !== value);
        if (!changed) return;
        set((s) => ({
          openGroupsByRole: {
            ...s.openGroupsByRole,
            [role]: { ...(s.openGroupsByRole[role] ?? {}), ...labels },
          },
        }));
      },
      setScrollTop: (role, section, top) => {
        const current = get().scrollTopByRole[role]?.[section];
        if (current === top) return;
        set((s) => ({
          scrollTopByRole: {
            ...s.scrollTopByRole,
            [role]: { ...(s.scrollTopByRole[role] ?? {}), [section]: top },
          },
        }));
      },
      getScrollTop: (role, section) => get().scrollTopByRole[role]?.[section] ?? 0,
      isGroupOpen: (role, label) => get().openGroupsByRole[role]?.[label] ?? false,
    }),
    { name: 'onecampus-sidebar-nav' },
  ),
);

export function activeParentLabels(
  groups: NavGroup[],
  pathname: string,
  isChildActive: (pathname: string, child: NavChild, siblings: NavChild[]) => boolean,
): string[] {
  const labels: string[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.children?.some((c) => isChildActive(pathname, c, item.children ?? []))) {
        labels.push(item.label);
      }
    }
  }
  return labels;
}
