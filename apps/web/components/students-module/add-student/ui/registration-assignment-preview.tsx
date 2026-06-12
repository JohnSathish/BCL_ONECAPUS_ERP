'use client';

import { AlertTriangle } from 'lucide-react';

import type { AssignedSubjectRow } from '@/utils/assigned-subject-display';
import {
  assignmentDebugMeta,
  detectDuplicateCourseCodes,
  formatAssignmentMeta,
  formatCourseLine,
} from '@/utils/assigned-subject-display';
import { cn } from '@/utils/cn';

type PreviewProps = {
  title?: string;
  rows: AssignedSubjectRow[];
  compact?: boolean;
  showDebug?: boolean;
  className?: string;
};

export function RegistrationAssignmentPreview({
  title = 'Registration preview',
  rows,
  compact,
  showDebug = false,
  className,
}: PreviewProps) {
  const sections = rows.map((row) => row.section);
  const { duplicateCodes } = detectDuplicateCourseCodes(sections);

  if (rows.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-border/50 bg-muted/10 p-2.5', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className={cn('font-semibold', compact ? 'text-[10px]' : 'text-xs')}>{title}</p>
        {duplicateCodes.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Duplicate subject assignment detected
          </span>
        ) : null}
      </div>
      <ul className={cn('space-y-1.5', compact && 'space-y-1')}>
        {rows.map((row) => {
          const isDuplicate =
            row.section && duplicateCodes.includes(row.section.courseOffering.course.code);
          return (
            <li
              key={row.slotKey}
              className={cn(
                'rounded-md border border-border/40 bg-background/60 px-2 py-1.5',
                isDuplicate && 'border-amber-500/50',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {row.category}
                  {row.slotKey.includes('-') ? ` ${row.slotKey.split('-')[1]}` : ''}
                  {row.badgeLabel ? (
                    <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[8px] font-medium normal-case text-primary">
                      {row.badgeLabel}
                    </span>
                  ) : null}
                </span>
                {row.section ? (
                  <span className="text-[9px] text-muted-foreground">
                    {formatAssignmentMeta(row.section, row.assignmentMode)}
                  </span>
                ) : null}
              </div>
              {row.section ? (
                <p className={cn('font-medium', compact ? 'text-[10px]' : 'text-[11px]')}>
                  {formatCourseLine(row.section)}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Not assigned</p>
              )}
              {row.helperText ? (
                <p className="text-[9px] text-muted-foreground">{row.helperText}</p>
              ) : null}
              {showDebug && row.section ? (
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  {(() => {
                    const debug = assignmentDebugMeta(row.section!);
                    return [
                      debug.mappingSource,
                      debug.poolName,
                      debug.sectionCode ? `Section ${debug.sectionCode}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                  })()}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
