import { create } from 'zustand';
import type { SchoolPersona } from '@/api/school-mobile';

export type SchoolFeatures = {
  transport?: boolean;
  library?: boolean;
  onlineFees?: boolean;
  homework?: boolean;
  chat?: boolean;
  gpsTracking?: boolean;
  hr?: boolean;
  payroll?: boolean;
};

type SchoolSessionState = {
  persona: SchoolPersona | null;
  permissions: string[];
  childId: string | null;
  displayName: string;
  schoolName: string;
  primaryColor: string;
  features: SchoolFeatures;
  lastSyncedAt: string | null;
  offline: boolean;
  setFromHome: (home: Record<string, unknown>) => void;
  setChildId: (id: string | null) => void;
  setFeatures: (features: SchoolFeatures) => void;
  setPermissions: (permissions: string[]) => void;
  setOffline: (offline: boolean) => void;
  setLastSynced: (iso: string) => void;
  reset: () => void;
};

export const useSchoolSession = create<SchoolSessionState>((set) => ({
  persona: null,
  permissions: [],
  childId: null,
  displayName: '',
  schoolName: '',
  primaryColor: '#1a237e',
  features: {},
  lastSyncedAt: null,
  offline: false,
  setFromHome: (home) => {
    const me = (home.me ?? {}) as Record<string, unknown>;
    const site = (home.site ?? {}) as Record<string, unknown>;
    set({
      persona: (me.persona as SchoolPersona) ?? null,
      displayName: String(me.displayName ?? ''),
      schoolName: String(site.displayName ?? ''),
      childId: (me.activeStudentId as string | null) ?? null,
    });
  },
  setChildId: (id) => set({ childId: id }),
  setFeatures: (features) => set({ features }),
  setPermissions: (permissions) => set({ permissions }),
  setOffline: (offline) => set({ offline }),
  setLastSynced: (iso) => set({ lastSyncedAt: iso }),
  reset: () =>
    set({
      persona: null,
      permissions: [],
      childId: null,
      displayName: '',
      lastSyncedAt: null,
      offline: false,
    }),
}));
