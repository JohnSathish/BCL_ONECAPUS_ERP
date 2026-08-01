'use client';

import { CalendarPlus, Download, FileDown, Printer, RefreshCw, Search, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  CALENDAR_FILTER_LABELS,
  FILTER_ACCENT,
  type CalendarFilterKey,
} from '@/lib/academic-calendar-ui';
import { cn } from '@/utils/cn';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<CalendarFilterKey, boolean>;
  filterCounts: Partial<Record<CalendarFilterKey, number>>;
  onToggleFilter: (key: CalendarFilterKey, value: boolean) => void;
  canEdit: boolean;
  onAddEvent: () => void;
  onImportHolidays: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

const LEGEND = [
  { label: 'Working Day', color: '#16a34a' },
  { label: 'Holiday / Weekend', color: '#dc2626' },
  { label: 'Exam', color: '#ea580c' },
  { label: 'Meeting', color: '#7c3aed' },
  { label: 'Event', color: '#3b82f6' },
  { label: 'Admission', color: '#06b6d4' },
  { label: 'Leave', color: '#eab308' },
];

export function CalendarSidebar({
  search,
  onSearchChange,
  filters,
  filterCounts,
  onToggleFilter,
  canEdit,
  onAddEvent,
  onImportHolidays,
  onPrint,
  onExport,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const body = (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Search</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events..."
            className="h-10 rounded-xl border-[#E5E7EB] bg-[#F8FAFC] pl-9"
            aria-label="Search events"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <div className="space-y-2.5">
          {(Object.keys(CALENDAR_FILTER_LABELS) as CalendarFilterKey[]).map((key) => {
            const accent = FILTER_ACCENT[key];
            const count = filterCounts[key] ?? 0;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-xl px-1 py-0.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent.dot }}
                  />
                  <span className="truncate text-sm text-slate-700">
                    {CALENDAR_FILTER_LABELS[key]}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      accent.badge,
                    )}
                  >
                    {count}
                  </span>
                </div>
                <Switch
                  checked={filters[key]}
                  onCheckedChange={(v) => onToggleFilter(key, v)}
                  aria-label={`Toggle ${CALENDAR_FILTER_LABELS[key]}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Legend</p>
        <div className="space-y-2">
          {LEGEND.map((row) => (
            <div key={row.label} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              {row.label}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick Actions
        </p>
        <div className="grid gap-2">
          {canEdit ? (
            <Button className="justify-start rounded-xl" variant="outline" onClick={onAddEvent}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              className="justify-start rounded-xl"
              variant="outline"
              onClick={onImportHolidays}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Holidays
            </Button>
          ) : null}
          <Button
            className="justify-start rounded-xl"
            variant="outline"
            onClick={() => onPrint?.() ?? window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Calendar
          </Button>
          <Button
            className="justify-start rounded-xl"
            variant="outline"
            onClick={onExport}
            disabled={!onExport}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button className="justify-start rounded-xl" variant="outline" disabled>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Calendar
          </Button>
          <Button className="justify-start rounded-xl" variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Download ICS
          </Button>
        </div>
      </section>
    </div>
  );

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block">{body}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close filters"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,20rem)] overflow-y-auto bg-[#F8FAFC] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Filters & actions</p>
              <Button size="sm" variant="ghost" onClick={onCloseMobile}>
                Close
              </Button>
            </div>
            {body}
          </div>
        </div>
      ) : null}
    </>
  );
}
