'use client';

import { LayoutGrid } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDashboardUiStore, type DashboardWidgets } from '@/store/dashboard-ui-store';

const LABELS: Record<keyof DashboardWidgets, string> = {
  hero: 'Hero & AI welcome',
  kpis: 'KPI analytics cards',
  charts: 'Charts & reports',
  aiInsights: 'AI insights panel',
  activity: 'Activity feed',
};

export function WidgetCustomizer() {
  const widgets = useDashboardUiStore((s) => s.widgets);
  const setWidget = useDashboardUiStore((s) => s.setWidget);
  const resetWidgets = useDashboardUiStore((s) => s.resetWidgets);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dashboard layout</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Toggle widgets to personalize your command center. Layout preferences are saved locally.
        </p>
        <ul className="mt-4 space-y-3">
          {(Object.keys(LABELS) as (keyof DashboardWidgets)[]).map((key) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <span className="text-sm font-medium">{LABELS[key]}</span>
              <input
                type="checkbox"
                checked={widgets[key]}
                onChange={(e) => setWidget(key, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
                aria-label={`Toggle ${LABELS[key]}`}
              />
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-4 w-full" onClick={resetWidgets}>
          Reset to default
        </Button>
      </DialogContent>
    </Dialog>
  );
}
