'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  History,
  Printer,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import {
  downloadAcademicChangeHistoryCsv,
  exportAcademicChangeHistoryCsv,
  fetchAcademicChangeHistory,
} from '@/services/academic-change-history';
import type {
  AcademicChangeHistoryItem,
  AcademicChangeType,
} from '@/types/academic-change-history';
import { formatDisplayDateTime } from '@/utils/format-date';
import { cn } from '@/utils/cn';

const CHANGE_TYPE_LABELS: Record<AcademicChangeType, string> = {
  PROGRAMME_CHANGED: 'Programme Changed',
  DEPARTMENT_CHANGED: 'Department Changed',
  SHIFT_CHANGED: 'Shift Changed',
  MAJOR_CHANGED: 'Major Changed',
  MINOR_CHANGED: 'Minor Changed',
  MDC_CHANGED: 'MDC Changed',
  AEC_CHANGED: 'AEC Changed',
  SEC_CHANGED: 'SEC Changed',
  VAC_CHANGED: 'VAC Changed',
  VTC_CHANGED: 'VTC Changed',
  SEMESTER_CHANGED: 'Semester Changed',
  SUBJECT_ADDED: 'Subject Added',
  SUBJECT_REMOVED: 'Subject Removed',
  SUBJECT_REPLACED: 'Subject Replaced',
  REGISTRATION_UPDATED: 'Registration Updated',
  ROLL_NUMBER_CHANGED: 'Roll Number Changed',
};

const CHANGE_TYPE_BADGE: Record<string, string> = {
  SHIFT_CHANGED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  MAJOR_CHANGED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  MINOR_CHANGED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  MDC_CHANGED: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  AEC_CHANGED: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  SEC_CHANGED: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  VTC_CHANGED: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  VAC_CHANGED: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  PROGRAMME_CHANGED: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  DEPARTMENT_CHANGED: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  SEMESTER_CHANGED: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  SUBJECT_ADDED: 'bg-green-500/15 text-green-700 dark:text-green-300',
  SUBJECT_REMOVED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  SUBJECT_REPLACED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  REGISTRATION_UPDATED: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ROLL_NUMBER_CHANGED: 'bg-slate-500/15 text-slate-800 dark:text-slate-200',
};

function changeTypeLabel(type: string) {
  return CHANGE_TYPE_LABELS[type as AcademicChangeType] ?? type.replace(/_/g, ' ');
}

function HistoryEntryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: AcademicChangeHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badgeClass = CHANGE_TYPE_BADGE[entry.changeType] ?? 'bg-muted text-muted-foreground';

  return (
    <article
      className={cn(
        'rounded-lg border border-border/70 bg-background/80 p-3 transition-all duration-300',
        expanded && 'ring-1 ring-primary/20',
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              {formatDisplayDateTime(entry.changedOn)}
            </p>
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <User className="h-3 w-3 shrink-0 text-muted-foreground" />
              {entry.changedByName ?? 'Staff'}
              {entry.changedByRole ? (
                <span className="font-normal text-muted-foreground">· {entry.changedByRole}</span>
              ) : null}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <span
          className={cn(
            'mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            badgeClass,
          )}
        >
          {changeTypeLabel(entry.changeType)}
        </span>
        <div className="mt-2 space-y-1 text-xs">
          {entry.oldValue ? (
            <p className="text-muted-foreground line-through decoration-muted-foreground/50">
              {entry.oldValue}
            </p>
          ) : null}
          <p className="text-center text-[10px] text-muted-foreground">↓</p>
          {entry.newValue ? <p className="font-medium">{entry.newValue}</p> : null}
        </div>
        {entry.reason && !expanded ? (
          <p className="mt-2 truncate text-[11px] italic text-muted-foreground">
            Reason: {entry.reason}
          </p>
        ) : null}
      </button>
      {expanded ? (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {entry.fieldName ? <p>Field: {entry.fieldName}</p> : null}
          {entry.reason ? <p>Reason: {entry.reason}</p> : null}
          {entry.ipAddress ? <p>IP: {entry.ipAddress}</p> : null}
          {entry.browser ? <p>Browser: {entry.browser}</p> : null}
          {entry.deviceInfo ? <p className="break-all">Device: {entry.deviceInfo}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

type Props = {
  studentId: string;
  compact?: boolean;
  sticky?: boolean;
  refreshKey?: number;
  className?: string;
};

export function AcademicChangeHistoryPanel({
  studentId,
  compact = false,
  sticky = true,
  refreshKey = 0,
  className,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changeType, setChangeType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const limit = compact && !showFull ? 10 : showFull ? 20 : 10;

  const historyQ = useQuery({
    queryKey: [
      'students',
      studentId,
      'academic-change-history',
      { compact, showFull, changeType, from, to, page, limit, refreshKey },
    ],
    queryFn: () =>
      fetchAcademicChangeHistory(studentId, {
        page,
        limit,
        changeType: changeType || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: Boolean(studentId),
  });

  const items = historyQ.data?.items ?? [];
  const meta = historyQ.data?.meta;

  const changeTypeOptions = useMemo(
    () => Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  const handleExport = async () => {
    const blob = await exportAcademicChangeHistoryCsv(studentId, {
      changeType: changeType || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    downloadAcademicChangeHistoryCsv(blob, studentId);
  };

  const handlePrint = () => {
    window.print();
  };

  if (collapsed) {
    return (
      <div className={cn(sticky && 'sticky top-3', className)}>
        <SectionCard
          title="Academic Change History"
          description="Audit trail of programme, shift, and subject changes"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setCollapsed(false)}
          >
            <History className="mr-1.5 h-3.5 w-3.5" />
            Show history
          </Button>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className={cn(sticky && 'sticky top-3 print:static', className)}>
      <SectionCard
        title="Academic Change History"
        description="Chronological audit trail — newest first"
      >
        <div className="flex justify-end -mt-1 mb-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCollapsed(true)}
          >
            Collapse
          </Button>
        </div>
        {showFull ? (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                Change type
              </label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={changeType}
                onChange={(e) => {
                  setChangeType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {changeTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">To</label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleExport}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handlePrint}
              >
                <Printer className="mr-1 h-3.5 w-3.5" />
                Print
              </Button>
            </div>
          </div>
        ) : null}

        {historyQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading history…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No academic changes recorded yet. Changes appear here when programme, shift, or subjects
            are saved.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((entry) => (
              <HistoryEntryCard
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() =>
                  setExpandedId((current) => (current === entry.id ? null : entry.id))
                }
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          {!showFull && (meta?.total ?? 0) > 10 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowFull(true);
                setPage(1);
              }}
            >
              <Filter className="mr-1 h-3 w-3" />
              View full history
            </Button>
          ) : showFull && meta && meta.totalPages > 1 ? (
            <div className="flex items-center gap-2 text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {meta?.total ?? 0} record{(meta?.total ?? 0) === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
