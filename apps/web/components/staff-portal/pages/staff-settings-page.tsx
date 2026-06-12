'use client';

import { useTheme } from 'next-themes';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import {
  useStaffPortalLayoutStore,
  type StaffPortalWidgetKey,
} from '@/store/staff-portal-layout-store';

const WIDGET_LABELS: Record<StaffPortalWidgetKey, string> = {
  header: 'Profile header',
  kpis: 'KPI snapshot cards',
  schedule: "Today's schedule",
  subjects: 'My subjects',
  attendance: 'Attendance summary',
  leave: 'Leave summary',
  notifications: 'Notifications panel',
  calendar: 'Calendar widget',
};

export function StaffPortalSettingsPage() {
  useRequireStaffPortal();
  const { theme, setTheme } = useTheme();
  const widgets = useStaffPortalLayoutStore((s) => s.widgets);
  const editMode = useStaffPortalLayoutStore((s) => s.editMode);
  const pinnedWidgets = useStaffPortalLayoutStore((s) => s.pinnedWidgets);
  const toggleWidget = useStaffPortalLayoutStore((s) => s.toggleWidget);
  const setEditMode = useStaffPortalLayoutStore((s) => s.setEditMode);
  const togglePin = useStaffPortalLayoutStore((s) => s.togglePin);
  const moveWidget = useStaffPortalLayoutStore((s) => s.moveWidget);
  const widgetOrder = useStaffPortalLayoutStore((s) => s.widgetOrder);
  const resetLayout = useStaffPortalLayoutStore((s) => s.resetLayout);

  return (
    <DashboardShell role="staff" title="Portal Settings">
      <ErpWorkspace className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <div className="mt-4 flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
            >
              System
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Email and in-app notification preferences will sync when the notifications service is
            connected.
          </p>
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dashboard Layout</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? 'Done editing' : 'Customize widgets'}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetLayout}>
                Reset layout
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {widgetOrder.map((key) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span>{WIDGET_LABELS[key]}</span>
                <div className="flex items-center gap-2">
                  {editMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => moveWidget(key, 'up')}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => moveWidget(key, 'down')}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => togglePin(key)}
                      >
                        {pinnedWidgets.includes(key) ? 'Unpin' : 'Pin'}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant={widgets[key] ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleWidget(key)}
                  >
                    {widgets[key] ? 'Visible' : 'Hidden'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
