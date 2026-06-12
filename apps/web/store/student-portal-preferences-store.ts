import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type StudentPortalPreferencesState = {
  compact: boolean;
  largeText: boolean;
  setCompact: (value: boolean) => void;
  setLargeText: (value: boolean) => void;
  toggleCompact: () => void;
  toggleLargeText: () => void;
};

export const useStudentPortalPreferencesStore = create<StudentPortalPreferencesState>()(
  persist(
    (set, get) => ({
      compact: false,
      largeText: false,
      setCompact: (compact) => set({ compact }),
      setLargeText: (largeText) => set({ largeText }),
      toggleCompact: () => set({ compact: !get().compact }),
      toggleLargeText: () => set({ largeText: !get().largeText }),
    }),
    { name: 'onecampus-student-portal-prefs' },
  ),
);
