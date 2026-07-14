'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SaaSCard, SectionTitle, fadeUp } from '@/components/dashboard/command-center-ui';
import { usePermissions } from '@/hooks/use-permissions';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { useOptionalWorkspaceContext } from '@/providers/workspace-provider';
import {
  WORKSPACE_ACCENTS,
  WORKSPACE_DEFINITIONS,
  type WorkspaceKind,
} from '@/lib/workspace/workspace-types';
import { fetchShiftOperationsSummary, type ShiftOperationsSummary } from '@/services/shifts';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';

const SHIFT_CARD_ORDER = ['MORNING', 'DAY'] as const;

function workspaceKindForCode(code: string): WorkspaceKind | null {
  const upper = code.toUpperCase();
  if (upper === 'MORNING') return 'morning';
  if (upper === 'DAY') return 'day';
  return null;
}

function sortShiftRows(rows: ShiftOperationsSummary[]) {
  return [...rows].sort((a, b) => {
    const ai = SHIFT_CARD_ORDER.indexOf(a.code.toUpperCase() as (typeof SHIFT_CARD_ORDER)[number]);
    const bi = SHIFT_CARD_ORDER.indexOf(b.code.toUpperCase() as (typeof SHIFT_CARD_ORDER)[number]);
    const aRank = ai === -1 ? 99 : ai;
    const bRank = bi === -1 ? 99 : bi;
    return aRank - bRank || a.name.localeCompare(b.name);
  });
}

type MetricProps = {
  label: string;
  value: number;
  href: string;
  icon: typeof Users;
};

function ShiftMetric({ label, value, href, icon: Icon }: MetricProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition hover:border-slate-200 hover:bg-white dark:border-border/60 dark:bg-muted/20 dark:hover:bg-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-[#94A3B8] transition group-hover:text-[#475569]" />
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-[#0F172A] dark:text-foreground">
        {value.toLocaleString('en-IN')}
      </p>
    </Link>
  );
}

function ShiftOperationsCard({
  row,
  workspaceKind,
  onOpenWorkspace,
  compact = false,
}: {
  row: ShiftOperationsSummary;
  workspaceKind: WorkspaceKind | null;
  onOpenWorkspace?: (kind: WorkspaceKind) => void;
  compact?: boolean;
}) {
  const accent = workspaceKind ? WORKSPACE_ACCENTS[workspaceKind] : WORKSPACE_ACCENTS.institution;
  const definition = workspaceKind ? WORKSPACE_DEFINITIONS[workspaceKind] : null;
  const canSwitch = Boolean(workspaceKind && onOpenWorkspace);

  return (
    <motion.article
      variants={fadeUp}
      className={cn(
        'overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-card',
        compact
          ? 'border-slate-200/80 dark:border-border/60'
          : 'border-slate-200/80 dark:border-border/60',
      )}
      style={{ boxShadow: compact ? undefined : `inset 4px 0 0 0 ${accent.cssVar}` }}
    >
      <div className="border-b border-slate-100 px-4 py-3 dark:border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-foreground">
                {row.name}
              </h3>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  accent.badgeClass,
                )}
              >
                {row.code}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {row.startTime} – {row.endTime}
              {definition ? ` · ${definition.subtitle}` : ''}
            </p>
          </div>
          {canSwitch ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() => onOpenWorkspace?.(workspaceKind!)}
            >
              Open workspace
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'grid gap-2 p-4',
          compact ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        <ShiftMetric
          label="Students"
          value={row.students}
          href="/admin/students"
          icon={GraduationCap}
        />
        <ShiftMetric
          label="Sections"
          value={row.activeSections}
          href="/admin/academics/subject-sections"
          icon={BookOpen}
        />
        <ShiftMetric
          label="Faculty"
          value={row.facultyAssignments}
          href="/admin/academics/shift-faculty"
          icon={Users}
        />
        <ShiftMetric
          label="Timetable slots"
          value={row.timetableEntries}
          href="/admin/academics/timetable"
          icon={CalendarDays}
        />
        <ShiftMetric
          label="Pending approvals"
          value={row.pendingApprovals}
          href="/admin/students"
          icon={ClipboardList}
        />
      </div>
    </motion.article>
  );
}

export function ShiftOperationsSection() {
  const workspace = useOptionalWorkspaceContext();
  const shiftScope = useShiftScope();
  const { can, isAdmin } = usePermissions();

  const canLoad = isAdmin || can('shift:reports:read');

  const summaryQ = useQuery({
    queryKey: ['shift', 'operations-summary', 'dashboard', shiftScope.activeShiftId],
    queryFn: () => fetchShiftOperationsSummary(),
    enabled: canLoad,
    staleTime: 120_000,
    refetchInterval: 180_000,
  });

  const rows = useMemo(() => sortShiftRows(summaryQ.data ?? []), [summaryQ.data]);

  const institutionView = (workspace?.kind ?? 'institution') === 'institution';
  const morningDayRows = useMemo(
    () => rows.filter((row) => workspaceKindForCode(row.code) !== null),
    [rows],
  );

  const activeRow = useMemo(() => {
    if (!shiftScope.activeShiftId) return null;
    return rows.find((row) => row.shiftId === shiftScope.activeShiftId) ?? rows[0] ?? null;
  }, [rows, shiftScope.activeShiftId]);

  if (!canLoad) return null;

  if (summaryQ.isLoading && !rows.length) {
    return (
      <SaaSCard>
        <SectionTitle
          title="Shift Operations"
          subtitle="Loading Morning and Day shift snapshots…"
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-muted/40" />
          ))}
        </div>
      </SaaSCard>
    );
  }

  if (!rows.length) return null;

  if (!institutionView && activeRow) {
    const kind = workspace?.kind ?? workspaceKindForCode(activeRow.code);
    return (
      <SaaSCard
        className={cn(
          workspace?.kind === 'morning' &&
            'border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-white',
          workspace?.kind === 'day' &&
            'border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-white',
        )}
      >
        <SectionTitle
          title={`${activeRow.name} Operations`}
          subtitle="Live snapshot for your active workspace shift"
        />
        <ShiftOperationsCard
          row={activeRow}
          workspaceKind={
            kind && kind !== 'institution' ? kind : workspaceKindForCode(activeRow.code)
          }
          compact
        />
      </SaaSCard>
    );
  }

  if (!morningDayRows.length) return null;

  return (
    <SaaSCard>
      <SectionTitle
        title="Shift Operations"
        subtitle="Morning and Day delivery workspaces — compare load and jump into a shift admin view"
        action={
          workspace?.showWorkspaceSwitcher ? (
            <span className="text-xs text-[#64748B]">
              Use the workspace switcher above to manage a shift
            </span>
          ) : null
        }
      />
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.08 } },
        }}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-2"
      >
        {morningDayRows.map((row) => (
          <ShiftOperationsCard
            key={row.shiftId}
            row={row}
            workspaceKind={workspaceKindForCode(row.code)}
            onOpenWorkspace={workspace?.setWorkspaceKind}
          />
        ))}
      </motion.div>
    </SaaSCard>
  );
}
