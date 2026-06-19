import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NavRecentEntry = {
  id: string;
  href: string;
  label: string;
  visitedAt: number;
};

type NavPreferencesState = {
  favoritesByRole: Record<string, string[]>;
  recentsByRole: Record<string, NavRecentEntry[]>;
  toggleFavorite: (role: string, id: string) => void;
  isFavorite: (role: string, id: string) => boolean;
  recordVisit: (role: string, entry: Omit<NavRecentEntry, 'visitedAt'>) => void;
  setFavorites: (role: string, ids: string[]) => void;
};

const MAX_RECENTS = 8;

export const useNavPreferencesStore = create<NavPreferencesState>()(
  persist(
    (set, get) => ({
      favoritesByRole: {},
      recentsByRole: {},
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
    }),
    { name: 'onecampus-nav-preferences' },
  ),
);
