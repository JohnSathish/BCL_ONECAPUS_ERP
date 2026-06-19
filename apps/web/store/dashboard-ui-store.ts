import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardWidgets = {
  hero: boolean;
  kpis: boolean;
  charts: boolean;
  aiInsights: boolean;
  activity: boolean;
};

const defaultWidgets: DashboardWidgets = {
  hero: true,
  kpis: true,
  charts: true,
  aiInsights: true,
  activity: true,
};

type DashboardUiState = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  campusId: string;
  widgets: DashboardWidgets;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (v: boolean) => void;
  toggleMobileNavOpen: () => void;
  setCampusId: (id: string) => void;
  setWidget: (key: keyof DashboardWidgets, visible: boolean) => void;
  resetWidgets: () => void;
};

export const useDashboardUiStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      campusId: 'tura',
      widgets: defaultWidgets,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      toggleMobileNavOpen: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
      setCampusId: (campusId) => set({ campusId }),
      setWidget: (key, visible) => set((s) => ({ widgets: { ...s.widgets, [key]: visible } })),
      resetWidgets: () => set({ widgets: defaultWidgets }),
    }),
    { name: 'onecampus-dashboard-ui' },
  ),
);
