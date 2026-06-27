'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { DirectoryAttendanceBadge } from '@/components/students-module/directory/ui/directory-attendance-badge';
import { DirectoryFeeBadge } from '@/components/students-module/directory/ui/directory-fee-badge';
import { DirectoryRowPreview } from '@/components/students-module/directory/directory-row-preview';
import { DirectorySemesterChip } from '@/components/students-module/directory/ui/directory-semester-chip';
import { DirectoryStatusPill } from '@/components/students-module/directory/ui/directory-status-pill';
import { DirectoryStudentAvatar } from '@/components/students-module/directory/ui/directory-student-avatar';
import { StudentName } from '@/components/students/student-name';
import { useStudentNameFormat } from '@/components/providers/student-name-format-provider';
import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { DirectoryStudentHoverCard } from '@/components/students-module/directory/directory-student-hover-card';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  rows: StudentDirectoryRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
};

export function DirectoryMobileList({ rows, selectedIds, onToggleRow, onOpenProfile }: Props) {
  const { formatStudentName } = useStudentNameFormat();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <DirectoryGlassCard className="py-12 text-center">
        <p className="text-sm font-medium">No students found</p>
        <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or search.</p>
      </DirectoryGlassCard>
    );
  }

  return (
    <div className="space-y-2 md:hidden">
      {rows.map((row) => {
        const expanded = expandedIds.has(row.id);
        const selected = selectedIds.has(row.id);
        const statusLabel = row.studentStatus ?? row.academicStatus;
        const displayName = formatStudentName(row.displayFullName ?? row.fullName);

        return (
          <DirectoryGlassCard
            key={row.id}
            className={cn(
              'overflow-hidden p-3 transition-all',
              selected && 'ring-1 ring-primary/30',
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-2 h-4 w-4 rounded border-border"
                checked={selected}
                onChange={() => onToggleRow(row.id)}
                aria-label={`Select ${displayName}`}
              />
              <DirectoryStudentAvatar row={row} size="md" />
              <div className="min-w-0 flex-1">
                <DirectoryStudentHoverCard row={row}>
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.(row)}
                    className="truncate text-left text-sm font-semibold hover:text-primary"
                  >
                    <StudentName
                      name={row.fullName}
                      displayFullName={row.displayFullName}
                      className="truncate text-left text-sm font-semibold hover:text-primary"
                    />
                  </button>
                </DirectoryStudentHoverCard>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Roll {row.rollNumber ?? '—'}
                  {row.universityRollNumber?.trim() || row.admissionNumber?.trim()
                    ? ` · NEHU ${row.universityRollNumber?.trim() || row.admissionNumber?.trim()}`
                    : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <DirectoryStatusPill label={statusLabel} />
                  <DirectorySemesterChip semester={row.semester} />
                  <DirectoryFeeBadge row={row} />
                  <DirectoryAttendanceBadge row={row} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {row.programme ?? '—'}
                  {row.majorSubject ? ` · Major: ${row.majorSubject}` : ''}
                  {row.shift ? ` · ${row.shift}` : ''}
                </p>
                {row.mobileNumber ? (
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {row.mobileNumber}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => toggleExpanded(row.id)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden motion-reduce:transition-none"
                >
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <DirectoryRowPreview row={row} expanded={expanded} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </DirectoryGlassCard>
        );
      })}
    </div>
  );
}
