import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/api/client';
import type { FacultyHomeSnapshot } from '@/types/faculty-home';

type FacultyPortalContextValue = {
  drawerOpen: boolean;
  home: FacultyHomeSnapshot | null;
  loading: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refreshHome: () => Promise<void>;
};

const FacultyPortalContext = createContext<FacultyPortalContextValue | null>(null);

export function FacultyPortalProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [home, setHome] = useState<FacultyHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshHome = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<FacultyHomeSnapshot>('/v1/mobile-app/staff/home');
      setHome(data);
    } catch {
      setHome(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  const value = useMemo<FacultyPortalContextValue>(
    () => ({
      drawerOpen,
      home,
      loading,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      refreshHome,
    }),
    [drawerOpen, home, loading, refreshHome],
  );

  return <FacultyPortalContext.Provider value={value}>{children}</FacultyPortalContext.Provider>;
}

export function useFacultyPortal() {
  const ctx = useContext(FacultyPortalContext);
  if (!ctx) {
    throw new Error('useFacultyPortal must be used within FacultyPortalProvider');
  }
  return ctx;
}
