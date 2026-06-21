import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NavRecentEntry = {
  id: string;
  href: string;
  label: string;
  visitedAt: number;
};

export type SidebarLayoutPrefs = {
  showFavorites: boolean;
  showRecentItems: boolean;
  showQuickCreate: boolean;
  favoritesExpanded: boolean;
  recentExpanded: boolean;
};

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayoutPrefs = {
  showFavorites: true,
  showRecentItems: true,
  showQuickCreate: true,
  favoritesExpanded: false,
  recentExpanded: false,
};

type NavPreferencesState = {
  favoritesByRole: Record<string, string[]>;
  recentsByRole: Record<string, NavRecentEntry[]>;
  sidebarLayout: SidebarLayoutPrefs;
  toggleFavorite: (role: string, id: string) => void;
  isFavorite: (role: string, id: string) => boolean;
  recordVisit: (role: string, entry: Omit<NavRecentEntry, 'visitedAt'>) => void;
  setFavorites: (role: string, ids: string[]) => void;
  setSidebarLayout: (patch: Partial<SidebarLayoutPrefs>) => void;
  toggleFavoritesExpanded: () => void;
  toggleRecentExpanded: () => void;
};

const MAX_RECENTS = 8;

export const useNavPreferencesStore = create<NavPreferencesState>()(
  persist(
    (set, get) => ({
      favoritesByRole: {},
      recentsByRole: {},
      sidebarLayout: { ...DEFAULT_SIDEBAR_LAYOUT },
      toggleFavorite: (role, id) => {
        const current = get().favoritesByRole[role] ?? [];
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        set((s) => ({
          favoritesByRole: { ...s.favoritesByRole, [role]: next },
        }));
      },
      isFavorite: (role, id) => (get().favoritesByRole[role] ?? []).includes(id),
      recordVisit: (role, entry) => {
        const list = get().recentsByRole[role] ?? [];
        const filtered = list.filter((r) => r.href !== entry.href);
        const next: NavRecentEntry[] = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(
          0,
          MAX_RECENTS,
        );
        set((s) => ({
          recentsByRole: { ...s.recentsByRole, [role]: next },
        }));
      },
      setFavorites: (role, ids) =>
        set((s) => ({
          favoritesByRole: { ...s.favoritesByRole, [role]: ids },
        })),
      setSidebarLayout: (patch) =>
        set((s) => ({
          sidebarLayout: { ...s.sidebarLayout, ...patch },
        })),
      toggleFavoritesExpanded: () =>
        set((s) => ({
          sidebarLayout: {
            ...s.sidebarLayout,
            favoritesExpanded: !s.sidebarLayout.favoritesExpanded,
          },
        })),
      toggleRecentExpanded: () =>
        set((s) => ({
          sidebarLayout: {
            ...s.sidebarLayout,
            recentExpanded: !s.sidebarLayout.recentExpanded,
          },
        })),
    }),
    {
      name: 'onecampus-nav-preferences',
      merge: (persisted, current) => {
        const p = persisted as Partial<NavPreferencesState> | undefined;
        return {
          ...current,
          ...p,
          sidebarLayout: {
            ...DEFAULT_SIDEBAR_LAYOUT,
            ...p?.sidebarLayout,
          },
        };
      },
    },
  ),
);
