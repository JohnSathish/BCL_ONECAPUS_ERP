'use client';

import { CATEGORY_COLORS } from '@/components/students-module/add-student/constants';
import type { CatalogSectionRow } from '@/types/academic-engine';
import {
  assignmentDebugMeta,
  formatAssignmentMeta,
  formatCourseLine,
} from '@/utils/assigned-subject-display';
import { cn } from '@/utils/cn';
import { AlertTriangle } from 'lucide-react';

type Props = {
  category: string;
  label?: string;
  pathName: string;
  section?: CatalogSectionRow;
  pending?: boolean;
  assignmentMode?: 'auto' | 'manual';
  showDebug?: boolean;
  duplicateWarning?: boolean;
  lockNote?: string;
};

export function AutoAssignedSubjectCard({
  category,
  label,
  pathName,
  section,
  pending,
  assignmentMode = 'auto',
  showDebug = true,
  duplicateWarning,
  lockNote,
}: Props) {
  const course = section?.courseOffering.course;
  const displayLabel = label ?? category;
  const debug = section ? assignmentDebugMeta(section) : null;

  return (
    <div
      className={cn(
        'glass-card rounded-lg border p-2.5',
        duplicateWarning && 'border-amber-500/60 bg-amber-500/5',
        CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? 'border-border/60',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide">{displayLabel}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {duplicateWarning ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-2.5 w-2.5" />
              Duplicate subject assignment detected
            </span>
          ) : null}
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
            {assignmentMode === 'auto' ? 'Auto-assigned' : 'Selected'}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-medium">{pathName || '—'}</p>
      {lockNote ? <p className="text-[9px] text-muted-foreground">{lockNote}</p> : null}
      {course ? (
        <>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug">
            {formatCourseLine(section!)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatAssignmentMeta(section!, assignmentMode)}
          </p>
        </>
      ) : pending ? (
        <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
          Resolving semester paper from subject path…
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Paper will register automatically from your subject path.
        </p>
      )}
      {showDebug && debug && section ? (
        <dl className="mt-2 space-y-0.5 border-t border-border/40 pt-1.5 text-[9px] text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Mapping source</dt>
            <dd className="text-right font-medium text-foreground">{debug.mappingSource}</dd>
          </div>
          {debug.poolName ? (
            <div className="flex justify-between gap-2">
              <dt>Curriculum pool</dt>
              <dd className="text-right font-medium text-foreground">{debug.poolName}</dd>
            </div>
          ) : null}
          {debug.majorPaperIndex != null ? (
            <div className="flex justify-between gap-2">
              <dt>Paper index</dt>
              <dd className="text-right font-medium text-foreground">{debug.majorPaperIndex}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <dt>Section selected</dt>
            <dd className="text-right font-medium text-foreground">{debug.sectionCode ?? '—'}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
