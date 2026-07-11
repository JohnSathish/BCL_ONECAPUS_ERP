'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import {
  CLASS12_STREAM_OPTIONS,
  fetchClass12Subjects,
  normalizeClass12Stream,
} from '@/services/class12-subjects';
import { cn } from '@/utils/cn';

export type ClassXiiSubjectMarkRow = {
  subjectName: string;
  marksObtained?: number | null;
  maxMarks?: number | null;
  grade?: string | null;
};

type Props = {
  boardName: string;
  stream: string;
  subjectMarks: ClassXiiSubjectMarkRow[];
  onBoardChange?: (board: string) => void;
  onStreamChange: (stream: string) => void;
  onSubjectMarksChange: (rows: ClassXiiSubjectMarkRow[]) => void;
  boardOptions?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  /** When false, board is controlled externally (no board select rendered). */
  showBoardSelect?: boolean;
  minSubjects?: number;
  className?: string;
  inputClassName?: string;
};

function emptyRows(count: number): ClassXiiSubjectMarkRow[] {
  return Array.from({ length: count }, () => ({
    subjectName: '',
    marksObtained: undefined,
    maxMarks: 100,
    grade: '',
  }));
}

function SubjectSearchSelect({
  value,
  options,
  disabledOptions,
  disabled,
  loading,
  onChange,
  inputClassName,
}: {
  value: string;
  options: Array<{ id: string; subjectName: string }>;
  disabledOptions: Set<string>;
  disabled?: boolean;
  loading?: boolean;
  onChange: (name: string) => void;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return options.filter((o) => {
      if (needle && !o.subjectName.toLowerCase().includes(needle)) return false;
      if (disabledOptions.has(o.subjectName) && o.subjectName !== value) return false;
      return true;
    });
  }, [options, q, disabledOptions, value]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        className={cn(
          inputClassName,
          'flex w-full items-center justify-between text-left',
          !value && 'text-muted-foreground',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">
          {value || (loading ? 'Loading subjects…' : 'Select subject')}
        </span>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <Command shouldFilter={false} className="max-h-56 overflow-auto">
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Search subject…"
              className="w-full border-b border-border px-3 py-2 text-sm outline-none"
            />
            <Command.List>
              {filtered.length === 0 ? (
                <Command.Empty className="px-3 py-2 text-sm text-muted-foreground">
                  No subjects found
                </Command.Empty>
              ) : (
                filtered.map((opt) => (
                  <Command.Item
                    key={opt.id}
                    value={opt.subjectName}
                    onSelect={() => {
                      onChange(opt.subjectName);
                      setOpen(false);
                      setQ('');
                    }}
                    className="cursor-pointer px-3 py-2 text-sm aria-selected:bg-muted"
                  >
                    {opt.subjectName}
                  </Command.Item>
                ))
              )}
            </Command.List>
          </Command>
        </div>
      ) : null}
    </div>
  );
}

export function ClassXiiSubjectMarksEditor({
  boardName,
  stream,
  subjectMarks,
  onBoardChange,
  onStreamChange,
  onSubjectMarksChange,
  boardOptions,
  disabled,
  showBoardSelect = true,
  minSubjects = 5,
  className,
  inputClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
}: Props) {
  const streamCode = normalizeClass12Stream(stream);
  const canFetch = Boolean(boardName?.trim() && streamCode);

  const subjectsQuery = useQuery({
    queryKey: ['class12-subjects', boardName, streamCode],
    queryFn: () => fetchClass12Subjects(boardName, streamCode),
    enabled: canFetch,
  });

  const options = subjectsQuery.data ?? [];

  // Ensure at least minSubjects rows are visible
  useEffect(() => {
    if (subjectMarks.length < minSubjects) {
      onSubjectMarksChange([...subjectMarks, ...emptyRows(minSubjects - subjectMarks.length)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pad once when short
  }, [minSubjects, subjectMarks.length]);

  // Clear invalid subjects when board/stream catalog changes
  useEffect(() => {
    if (!canFetch || subjectsQuery.isLoading || !subjectsQuery.data) return;
    const allowed = new Set(subjectsQuery.data.map((s) => s.subjectName));
    let changed = false;
    const next = subjectMarks.map((row) => {
      if (row.subjectName && !allowed.has(row.subjectName)) {
        changed = true;
        return { ...row, subjectName: '' };
      }
      return row;
    });
    if (changed) onSubjectMarksChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, subjectsQuery.data, subjectsQuery.isLoading]);

  const selectedNames = useMemo(() => {
    const set = new Set<string>();
    for (const row of subjectMarks) {
      if (row.subjectName.trim()) set.add(row.subjectName.trim());
    }
    return set;
  }, [subjectMarks]);

  function updateRow(idx: number, patch: Partial<ClassXiiSubjectMarkRow>) {
    const next = subjectMarks.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onSubjectMarksChange(next);
  }

  function addRow() {
    onSubjectMarksChange([
      ...subjectMarks,
      { subjectName: '', marksObtained: undefined, maxMarks: 100, grade: '' },
    ]);
  }

  function removeRow(idx: number) {
    if (subjectMarks.length <= minSubjects) return;
    onSubjectMarksChange(subjectMarks.filter((_, i) => i !== idx));
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {showBoardSelect && boardOptions ? (
          <label className="space-y-1 text-sm">
            <span className="font-medium">Board</span>
            <select
              className={inputClassName}
              disabled={disabled}
              value={boardName}
              onChange={(e) => onBoardChange?.(e.target.value)}
            >
              <option value="">Select board</option>
              {boardOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-sm">
          <span className="font-medium">Stream</span>
          <select
            className={inputClassName}
            disabled={disabled}
            value={streamCode}
            onChange={(e) => onStreamChange(e.target.value)}
          >
            <option value="">Select stream</option>
            {CLASS12_STREAM_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            {stream && !CLASS12_STREAM_OPTIONS.some((s) => s.value === streamCode) ? (
              <option value={streamCode}>{stream}</option>
            ) : null}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Subject marks (min {minSubjects})</p>
          {subjectsQuery.isFetching ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading subjects…
            </span>
          ) : null}
        </div>

        {!canFetch ? (
          <p className="text-sm text-muted-foreground">
            Select Board and Stream to load Class XII subjects.
          </p>
        ) : subjectsQuery.isError ? (
          <p className="text-sm text-destructive">Could not load subjects. Try again.</p>
        ) : !subjectsQuery.isLoading && options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Class XII subjects configured for this Board and Stream. Ask admin to import the
            Class XII Subject Master.
          </p>
        ) : null}

        {subjectMarks.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 rounded-lg border border-border/70 p-2 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_auto]"
          >
            <SubjectSearchSelect
              value={row.subjectName}
              options={options}
              disabledOptions={selectedNames}
              disabled={disabled || !canFetch || options.length === 0}
              loading={subjectsQuery.isFetching}
              onChange={(name) => updateRow(idx, { subjectName: name })}
              inputClassName={inputClassName}
            />
            <input
              className={inputClassName}
              type="number"
              placeholder="Obtained"
              disabled={disabled}
              value={row.marksObtained ?? ''}
              onChange={(e) =>
                updateRow(idx, {
                  marksObtained: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
            <input
              className={inputClassName}
              type="number"
              placeholder="Max"
              disabled={disabled}
              value={row.maxMarks ?? ''}
              onChange={(e) =>
                updateRow(idx, {
                  maxMarks: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-2 text-destructive disabled:opacity-40"
              disabled={disabled || subjectMarks.length <= minSubjects}
              onClick={() => removeRow(idx)}
              title="Remove subject"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={disabled || !canFetch}
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add subject
        </button>
      </div>
    </div>
  );
}
