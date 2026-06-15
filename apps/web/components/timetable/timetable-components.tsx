'use client';

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileDown,
  Play,
  Printer,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  TimetableConflictSummary,
  TimetableContext,
  TimetableDashboard,
  TimetableEntry,
  TimetableMatrix,
  TimetablePlan,
} from '@/services/timetable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  openTimetablePrint,
  type TimetablePrintParams,
} from '@/lib/timetable/open-timetable-print';
import { cn } from '@/utils/cn';

const categoryClasses: Record<string, string> = {
  MAJOR: 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100',
  MINOR: 'border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100',
  MDC: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
  AEC: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  SEC: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100',
  VAC: 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100',
  LAB: 'border-slate-500/30 bg-slate-500/10 text-slate-900 dark:text-slate-100',
};

export function TimetableStudioShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              FYUGP timetable engine
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {['Draft', 'Review', 'Published'].map((label) => (
              <div key={label} className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function TimetableFilterBar({
  shiftId,
  setShiftId,
  streamId,
  setStreamId,
  semesterMode,
  setSemesterMode,
  academicYearId,
  setAcademicYearId,
  selectedPlanId,
  setSelectedPlanId,
  plans,
  context,
  onDeletePlan,
  deleteBusy,
}: {
  shiftId: string;
  setShiftId: (value: string) => void;
  streamId: string;
  setStreamId: (value: string) => void;
  semesterMode: 'ODD' | 'EVEN';
  setSemesterMode: (value: 'ODD' | 'EVEN') => void;
  academicYearId: string;
  setAcademicYearId: (value: string) => void;
  selectedPlanId: string;
  setSelectedPlanId: (value: string) => void;
  plans: TimetablePlan[];
  context?: TimetableContext;
  onDeletePlan?: (planId: string) => void;
  deleteBusy?: boolean;
}) {
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const canDeletePlan = Boolean(
    selectedPlanId && selectedPlan && selectedPlan.status !== 'PUBLISHED' && onDeletePlan,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Semester Mode
          <select
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={semesterMode}
            onChange={(event) => setSemesterMode(event.target.value as 'ODD' | 'EVEN')}
          >
            <option value="ODD">ODD Semester Mode</option>
            <option value="EVEN">EVEN Semester Mode</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Stream
          <select
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={streamId}
            onChange={(event) => setStreamId(event.target.value)}
          >
            <option value="">All streams</option>
            {(context?.streams ?? []).map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Academic Year
          <select
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
          >
            <option value="">Current / default year</option>
            {(context?.academicYears ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Shift
          <select
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={shiftId}
            onChange={(event) => setShiftId(event.target.value)}
          >
            <option value="">All / plan default shifts</option>
            {(context?.shifts ?? []).map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} · {formatShiftClock(shift.startTime)}–{formatShiftClock(shift.endTime)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground md:col-span-2">
          Active Plan
          <div className="flex gap-2">
            <select
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm"
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
            >
              <option value="">Select a timetable plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {plan.status}
                </option>
              ))}
            </select>
            {canDeletePlan ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 shrink-0 text-destructive hover:text-destructive"
                disabled={deleteBusy}
                title="Delete draft plan"
                onClick={() => {
                  const plan = plans.find((row) => row.id === selectedPlanId);
                  if (!plan) return;
                  const ok = window.confirm(
                    `Delete "${plan.name}"?\n\nThis removes the draft plan and its slots. Published plans cannot be deleted.`,
                  );
                  if (ok) onDeletePlan?.(selectedPlanId);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {selectedPlan?.status === 'PUBLISHED' ? (
            <p className="text-[11px] text-muted-foreground">
              Published plans stay active for student portals. Create a new plan instead of
              deleting.
            </p>
          ) : null}
        </label>
      </CardContent>
    </Card>
  );
}

export function TimetableCyclePanel({
  context,
  dashboard,
}: {
  context?: TimetableContext;
  dashboard?: TimetableDashboard;
}) {
  const mode = context?.currentAcademicMode ?? dashboard?.currentActiveCycle ?? 'ODD';
  return (
    <Card className={streamBorderClass(undefined)}>
      <CardContent className="grid gap-3 p-4 md:grid-cols-4">
        <Metric label="Current Academic Mode" value={mode === 'ODD' ? 1 : 2} displayValue={mode} />
        <Metric
          label="Allowed Semesters"
          value={context?.allowedSemesters?.length ?? 0}
          displayValue={(context?.allowedSemesters ?? []).join(', ')}
        />
        <Metric
          label="Blocked Semesters"
          value={context?.blockedSemesters?.length ?? 0}
          displayValue={(context?.blockedSemesters ?? []).join(', ')}
        />
        <Metric label="Published Timetables" value={dashboard?.publishedTimetables ?? 0} />
      </CardContent>
    </Card>
  );
}

export function TimetableGenerationPanel({
  onCreate,
  onGenerate,
  busy,
}: {
  onCreate: (name: string) => void;
  onGenerate: () => void;
  busy?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Generation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const input = form.elements.namedItem('name') as HTMLInputElement;
            onCreate(input.value);
            input.value = '';
          }}
        >
          <Input name="name" placeholder="Plan name, e.g. FYUGP Day Shift Odd Semester" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} size="sm">
              Create Plan
            </Button>
            <Button type="button" onClick={onGenerate} disabled={busy} size="sm" variant="outline">
              <Play className="mr-2 h-3.5 w-3.5" />
              Generate Draft
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TimetableApprovalPanel({
  plan,
  onValidate,
  onSubmit,
  onApprove,
  onPublish,
  busy,
  validation,
}: {
  plan?: TimetablePlan;
  onValidate: () => void;
  onSubmit: () => void;
  onApprove: (override?: { acknowledgeWarnings: boolean; overrideReason: string }) => void;
  onPublish: (override?: { acknowledgeWarnings: boolean; overrideReason: string }) => void;
  busy?: boolean;
  validation?: TimetableConflictSummary;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'publish' | null>(null);
  const warnings = (validation?.totalConflicts ?? 0) - (validation?.blockingConflicts ?? 0);

  const runWithOverride = (action: 'approve' | 'publish') => {
    if (warnings > 0 && !overrideReason.trim()) {
      setPendingAction(action);
      setOverrideOpen(true);
      return;
    }
    const payload =
      warnings > 0
        ? {
            acknowledgeWarnings: true,
            overrideReason: overrideReason.trim() || 'Acknowledged warnings',
          }
        : undefined;
    if (action === 'approve') onApprove(payload);
    else onPublish(payload);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approval Workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-border/70 p-3 text-sm">
          <p className="font-medium">{plan?.name ?? 'No plan selected'}</p>
          <p className="text-xs text-muted-foreground">
            {plan ? `${plan.status} · ${plan.approvalState}` : 'Create or select a plan first.'}
          </p>
        </div>
        {warnings > 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
            {warnings} non-blocking warning(s). You may approve or publish with an override reason.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={!plan || busy} onClick={onValidate}>
            Validate
          </Button>
          <Button size="sm" variant="outline" disabled={!plan || busy} onClick={onSubmit}>
            Submit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!plan || busy}
            onClick={() => runWithOverride('approve')}
          >
            Approve
          </Button>
          <Button size="sm" disabled={!plan || busy} onClick={() => runWithOverride('publish')}>
            Publish
          </Button>
        </div>
        {overrideOpen ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs font-medium">Override reason required for warnings</p>
            <Input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Reason for publishing with warnings"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!overrideReason.trim() || busy}
                onClick={() => {
                  const payload = {
                    acknowledgeWarnings: true,
                    overrideReason: overrideReason.trim(),
                  };
                  if (pendingAction === 'approve') onApprove(payload);
                  else onPublish(payload);
                  setOverrideOpen(false);
                  setPendingAction(null);
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOverrideOpen(false);
                  setPendingAction(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TimetableConflictPanel({ validation }: { validation?: TimetableConflictSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Conflict Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Entries" value={validation?.totalEntries ?? 0} />
          <Metric label="Conflicts" value={validation?.totalConflicts ?? 0} />
          <Metric label="Blocking" value={validation?.blockingConflicts ?? 0} />
        </div>
        <div className="max-h-56 space-y-2 overflow-auto">
          {(validation?.conflicts ?? []).slice(0, 12).map((conflict, index) => (
            <div
              key={`${conflict.conflictType}-${index}`}
              className="rounded-xl border border-border/70 p-3 text-xs"
            >
              <p className="font-semibold">{conflict.conflictType}</p>
              <p className="mt-1 text-muted-foreground">{conflict.message}</p>
            </div>
          ))}
          {!validation?.conflicts?.length ? (
            <p className="text-sm text-muted-foreground">No validation result yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function TimetableMatrixGrid({
  matrix,
  editable,
  printOptions,
  onCellClick,
  onEntryClick,
}: {
  matrix?: TimetableMatrix;
  editable?: boolean;
  printOptions?: TimetablePrintParams;
  onCellClick?: (args: {
    dayOfWeek: number;
    periodNo?: number | null;
    startTime: string;
    endTime: string;
    slotTemplateId?: string;
  }) => void;
  onEntryClick?: (entry: TimetableEntry) => void;
}) {
  const rows = matrix?.rows ?? [];
  const days = matrix?.days ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {matrix?.summary?.title ??
            `${matrix?.summary?.streamName ?? 'FYUGP'} Consolidated Routine`}
        </CardTitle>
        <div className="flex gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            disabled={!printOptions?.planId}
            onClick={() => {
              if (!printOptions?.planId) return;
              openTimetablePrint(printOptions);
            }}
          >
            <Printer className="mr-2 h-3.5 w-3.5" />
            Print
          </Button>
          <Button size="sm" variant="outline">
            <FileDown className="mr-2 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="border-b border-r border-border px-3 py-3 text-left">Time</th>
                {days.map((day) => (
                  <th
                    key={day.value}
                    className="border-b border-r border-border px-3 py-3 text-left"
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupRowsByTime(rows).map((timeRow) => (
                <tr
                  key={timeRow.key}
                  className={cn('align-top', timeRow.isBreak && 'bg-amber-500/5')}
                >
                  <td className="w-40 border-r border-t border-border bg-muted/30 px-3 py-3 font-medium">
                    {timeRow.label}
                  </td>
                  {days.map((day) => (
                    <td
                      key={`${timeRow.key}-${day.value}`}
                      className="min-w-40 border-r border-t border-border p-2"
                    >
                      {renderTimeCell(timeRow, day.value, { editable, onCellClick, onEntryClick })}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    {editable
                      ? 'Create a manual plan or import Excel to start building the timetable.'
                      : 'Select a plan and generate a draft to view the timetable matrix.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimetableSlotCell({ entry }: { entry: TimetableEntry }) {
  const category = (entry.fyugpCategory || entry.slotType || 'GENERAL').toUpperCase();
  const overlay = entry.replacementOverlay;
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 text-xs shadow-sm',
        categoryClasses[category] ?? 'border-border bg-card',
        overlay ? 'border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/20' : '',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{entry.course?.code ?? entry.slotType}</span>
        <span className="rounded-full bg-background/70 px-2 py-0.5">{category}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] opacity-90">
        {entry.course?.title ?? 'Manual / library / tutorial slot'}
      </p>
      <p className="mt-2 text-[11px]">
        Sem {entry.semesterSequence ?? '-'} · Sec {entry.sectionCode ?? '-'}
      </p>
      {overlay ? (
        <div className="mt-2 space-y-0.5 text-[11px]">
          <p className="opacity-90">
            <span className="font-medium">Original Faculty:</span> {overlay.originalStaffName}
          </p>
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Handled By: {overlay.handledByName}
          </p>
          <p className="text-[10px] opacity-75">{overlay.reasonLabel}</p>
        </div>
      ) : (
        <p className="text-[11px] opacity-80">
          {entry.staffProfile?.shortCode ?? entry.staffProfile?.fullName ?? 'Faculty TBA'} ·{' '}
          {entry.classroom?.code ?? 'Room TBA'}
        </p>
      )}
      {!overlay ? null : (
        <p className="mt-1 text-[11px] opacity-80">{entry.classroom?.code ?? 'Room TBA'}</p>
      )}
      {entry.isCombined ? <p className="mt-1 text-[10px] font-semibold">Combined class</p> : null}
    </div>
  );
}

export function TimetablePrintLayout({
  matrix,
  title,
  printOptions,
}: {
  matrix?: TimetableMatrix;
  title: string;
  printOptions?: TimetablePrintParams;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Institutional Routine
          </p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
        {printOptions?.planId ? (
          <Button size="sm" variant="outline" onClick={() => openTimetablePrint(printOptions)}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Print
          </Button>
        ) : null}
      </div>
      <TimetableMatrixGrid matrix={matrix} printOptions={printOptions} />
    </div>
  );
}

function formatShiftClock(value?: string | null) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const isoMatch = value.match(/T(\d{2}:\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(11, 16);
  }
  return value.slice(0, 5);
}

function Metric({
  label,
  value,
  displayValue,
}: {
  label: string;
  value: number;
  displayValue?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <p className="text-lg font-semibold">{displayValue ?? value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

function streamBorderClass(stream?: string) {
  const key = String(stream ?? '').toUpperCase();
  if (key.includes('ART')) return 'border-amber-500/30 bg-amber-500/5';
  if (key.includes('SCI')) return 'border-cyan-500/30 bg-cyan-500/5';
  if (key.includes('COM')) return 'border-emerald-500/30 bg-emerald-500/5';
  return 'border-border/70';
}

function groupRowsByTime(rows: TimetableMatrix['rows']) {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      isBreak: boolean;
      isLunch: boolean;
      byDay: Map<number, TimetableMatrix['rows']>;
    }
  >();
  for (const row of rows) {
    const key = `${row.startTime}-${row.endTime}`;
    const existing = map.get(key) ?? {
      key,
      label:
        row.isBreak || row.isLunch
          ? `BREAK · ${row.startTime.slice(0, 5)} - ${row.endTime.slice(0, 5)}`
          : `${row.label} · ${row.startTime.slice(0, 5)} - ${row.endTime.slice(0, 5)}`,
      isBreak: Boolean(row.isBreak),
      isLunch: Boolean(row.isLunch),
      byDay: new Map<number, TimetableMatrix['rows']>(),
    };
    existing.byDay.set(row.dayOfWeek, [...(existing.byDay.get(row.dayOfWeek) ?? []), row]);
    map.set(key, existing);
  }
  return Array.from(map.values());
}

function renderTimeCell(
  timeRow: ReturnType<typeof groupRowsByTime>[number],
  dayValue: number,
  options?: {
    editable?: boolean;
    onCellClick?: (args: {
      dayOfWeek: number;
      periodNo?: number | null;
      startTime: string;
      endTime: string;
      slotTemplateId?: string;
    }) => void;
    onEntryClick?: (entry: TimetableEntry) => void;
  },
) {
  const rows = timeRow.byDay.get(dayValue) ?? [];
  if (rows.some((row) => row.isBreak || row.isLunch)) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Lunch Break
      </div>
    );
  }
  if (!rows.length && dayValue === 6) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground',
          options?.editable && 'cursor-pointer hover:border-primary/40 hover:bg-primary/5',
        )}
        onClick={() => {
          if (!options?.editable || !options.onCellClick) return;
          options.onCellClick({
            dayOfWeek: dayValue,
            startTime: timeRow.key.split('-')[0] ?? '09:45:00',
            endTime: timeRow.key.split('-')[1] ?? '10:30:00',
          });
        }}
      >
        {options?.editable ? '+ Add slot' : 'Half Day'}
      </div>
    );
  }
  const entries = rows.flatMap((row) => row.entries);
  return (
    <div
      className={cn(
        'space-y-2',
        options?.editable &&
          !entries.length &&
          'min-h-[72px] cursor-pointer rounded-xl border border-dashed border-border p-2 hover:border-primary/40 hover:bg-primary/5',
      )}
      onClick={() => {
        if (!options?.editable || entries.length || !options.onCellClick) return;
        const row = rows[0];
        options.onCellClick({
          dayOfWeek: dayValue,
          periodNo: row?.periodNo,
          startTime: row?.startTime ?? timeRow.key.split('-')[0] ?? '09:45:00',
          endTime: row?.endTime ?? timeRow.key.split('-')[1] ?? '10:30:00',
          slotTemplateId: row?.id,
        });
      }}
    >
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={cn('w-full text-left', options?.editable && 'cursor-pointer')}
          onClick={(event) => {
            if (!options?.editable || !options.onEntryClick) return;
            event.stopPropagation();
            options.onEntryClick(entry);
          }}
        >
          <TimetableSlotCell entry={entry} />
        </button>
      ))}
      {options?.editable && !entries.length ? (
        <p className="text-center text-[11px] text-muted-foreground">+ Add slot</p>
      ) : null}
    </div>
  );
}
