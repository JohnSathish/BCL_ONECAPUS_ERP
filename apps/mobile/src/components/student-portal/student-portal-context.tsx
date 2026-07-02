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

export type StudentHomeSnapshot = {
  profile?: {
    displayFullName?: string;
    programName?: string;
    programLabel?: string;
    semesterLabel?: string;
    semesterSequence?: number;
    rollNumber?: string;
    status?: string;
    department?: string;
    photoUrl?: string | null;
  };
  fees?: { due?: number; paid?: number; status?: string; semesterLabel?: string };
  attendance?: { percentage?: number | null };
  academicChips?: { category: string; label: string; courseTitle: string }[];
  unreadNotificationCount?: number;
  quickStats?: { key: string; title: string; value: string; tone?: string }[];
};

type StudentPortalContextValue = {
  drawerOpen: boolean;
  expandedSectionId: string | null;
  home: StudentHomeSnapshot | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleSection: (sectionId: string) => void;
  refreshHome: () => Promise<void>;
};

const StudentPortalContext = createContext<StudentPortalContextValue | null>(null);

export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [home, setHome] = useState<StudentHomeSnapshot | null>(null);

  const refreshHome = useCallback(async () => {
    try {
      const data = await apiFetch<StudentHomeSnapshot>('/v1/mobile-app/student/home');
      setHome(data);
    } catch {
      // optional endpoint
    }
  }, []);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  const value = useMemo<StudentPortalContextValue>(
    () => ({
      drawerOpen,
      expandedSectionId,
      home,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      toggleSection: (sectionId) =>
        setExpandedSectionId((current) => (current === sectionId ? null : sectionId)),
      refreshHome,
    }),
    [drawerOpen, expandedSectionId, home, refreshHome],
  );

  return <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>;
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) {
    throw new Error('useStudentPortal must be used within StudentPortalProvider');
  }
  return ctx;
}
