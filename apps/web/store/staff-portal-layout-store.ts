import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StaffPortalWidgets = {
  header: boolean;
  kpis: boolean;
  schedule: boolean;
  subjects: boolean;
  attendance: boolean;
  leave: boolean;
  notifications: boolean;
  calendar: boolean;
};

export type StaffPortalWidgetKey = keyof StaffPortalWidgets;

const defaultWidgets: StaffPortalWidgets = {
  header: true,
  kpis: true,
  schedule: true,
  subjects: true,
  attendance: true,
  leave: true,
  notifications: true,
  calendar: true,
};

const defaultOrder: StaffPortalWidgetKey[] = [
  'header',
  'kpis',
  'schedule',
  'subjects',
  'attendance',
  'leave',
  'notifications',
  'calendar',
];

type StaffPortalLayoutState = {
  widgets: StaffPortalWidgets;
  widgetOrder: StaffPortalWidgetKey[];
  editMode: boolean;
  pinnedWidgets: StaffPortalWidgetKey[];
  setWidget: (key: StaffPortalWidgetKey, visible: boolean) => void;
  toggleWidget: (key: StaffPortalWidgetKey) => void;
  setWidgetOrder: (order: StaffPortalWidgetKey[]) => void;
  moveWidget: (key: StaffPortalWidgetKey, direction: 'up' | 'down') => void;
  togglePin: (key: StaffPortalWidgetKey) => void;
  setEditMode: (v: boolean) => void;
  resetLayout: () => void;
};

export const useStaffPortalLayoutStore = create<StaffPortalLayoutState>()(
  persist(
    (set, get) => ({
      widgets: defaultWidgets,
      widgetOrder: defaultOrder,
      editMode: false,
      pinnedWidgets: ['schedule', 'subjects'],
      setWidget: (key, visible) => set((s) => ({ widgets: { ...s.widgets, [key]: visible } })),
      toggleWidget: (key) => set((s) => ({ widgets: { ...s.widgets, [key]: !s.widgets[key] } })),
      setWidgetOrder: (widgetOrder) => set({ widgetOrder }),
      moveWidget: (key, direction) => {
        const order = [...get().widgetOrder];
        const idx = order.indexOf(key);
        if (idx < 0) return;
        const swap = direction === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= order.length) return;
        [order[idx], order[swap]] = [order[swap], order[idx]];
        set({ widgetOrder: order });
      },
      togglePin: (key) =>
        set((s) => ({
          pinnedWidgets: s.pinnedWidgets.includes(key)
            ? s.pinnedWidgets.filter((k) => k !== key)
            : [...s.pinnedWidgets, key],
        })),
      setEditMode: (editMode) => set({ editMode }),
      resetLayout: () =>
        set({
          widgets: defaultWidgets,
          widgetOrder: defaultOrder,
          pinnedWidgets: ['schedule', 'subjects'],
        }),
    }),
    { name: 'onecampus-staff-portal-layout' },
  ),
);
