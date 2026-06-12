'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession } from '@/types/auth';

type AuthPrefs = {
  rememberMe?: boolean;
  lastTenantSlug?: string;
};

type AuthState = {
  session: AuthSession | null;
  hasHydrated: boolean;
  isBootstrapping: boolean;
  prefs: AuthPrefs;
  setSession: (session: AuthSession | null) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
  setBootstrapping: (value: boolean) => void;
  setPrefs: (prefs: Partial<AuthPrefs>) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hasHydrated: false,
      isBootstrapping: true,
      prefs: {},
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
      setPrefs: (prefs) => set((state) => ({ prefs: { ...state.prefs, ...prefs } })),
    }),
    {
      name: 'nep-erp-auth-prefs',
      partialize: (state) => ({ prefs: state.prefs }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
