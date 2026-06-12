'use client';

import { Button } from '@/components/ui/button';
import type { CurriculumFilters } from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';
import { categoryColorToken } from './curriculum-category-tokens';
import { formatSemesterChipLabel } from './curriculum-semester-switcher';

type Option = { id: string; label: string };

type Props = {
  filters: CurriculumFilters;
  onPatch: (patch: Partial<CurriculumFilters>) => void;
  onReset: () => void;
  programOptions: Option[];
  departmentOptions: Option[];
  streamOptions: Option[];
  shiftOptions: Option[];
  batchOptions: Option[];
};

function labelFor(options: Option[], id: string, fallback = id): string {
  return options.find((o) => o.id === id)?.label ?? fallback;
}

export function CurriculumFilterChips({
  filters,
  onPatch,
  onReset,
  programOptions,
  departmentOptions,
  streamOptions,
  shiftOptions,
  batchOptions,
}: Props) {
  const chips: {
    key: string;
    label: string;
    className?: string;
    clear: () => void;
  }[] = [];

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: `"${filters.search.trim()}"`,
      clear: () => onPatch({ search: '' }),
    });
  }
  if (filters.programVersionId) {
    chips.push({
      key: 'program',
      label: labelFor(programOptions, filters.programVersionId),
      clear: () => onPatch({ programVersionId: '' }),
    });
  }
  for (const sem of filters.semesters) {
    chips.push({
      key: `sem-${sem}`,
      label: formatSemesterChipLabel(sem),
      clear: () => onPatch({ semesters: filters.semesters.filter((s) => s !== sem) }),
    });
  }
  for (const category of filters.categories) {
    const token = categoryColorToken(category);
    chips.push({
      key: `cat-${category}`,
      label: category,
      className: token.chip,
      clear: () => onPatch({ categories: filters.categories.filter((c) => c !== category) }),
    });
  }
  if (filters.departmentId) {
    chips.push({
      key: 'dept',
      label: labelFor(departmentOptions, filters.departmentId),
      clear: () => onPatch({ departmentId: '' }),
    });
  }
  if (filters.streamId) {
    chips.push({
      key: 'stream',
      label: labelFor(streamOptions, filters.streamId),
      clear: () => onPatch({ streamId: '' }),
    });
  }
  if (filters.shiftId) {
    chips.push({
      key: 'shift',
      label: labelFor(shiftOptions, filters.shiftId),
      clear: () => onPatch({ shiftId: '' }),
    });
  }
  if (filters.batchId) {
    chips.push({
      key: 'batch',
      label: labelFor(batchOptions, filters.batchId),
      clear: () => onPatch({ batchId: '' }),
    });
  }
  if (filters.sharedPool === 'pool') {
    chips.push({ key: 'pool', label: 'Shared pool', clear: () => onPatch({ sharedPool: '' }) });
  }
  if (filters.sharedPool === 'programme') {
    chips.push({
      key: 'prog-only',
      label: 'Programme-specific',
      clear: () => onPatch({ sharedPool: '' }),
    });
  }
  if (filters.mappingStatus) {
    chips.push({
      key: 'mapping',
      label: filters.mappingStatus.replace('_', ' '),
      clear: () => onPatch({ mappingStatus: '' }),
    });
  }
  if (filters.deliveryType) {
    chips.push({
      key: 'delivery',
      label: filters.deliveryType.replace(/_/g, ' '),
      clear: () => onPatch({ deliveryType: '' }),
    });
  }
  if (filters.credits) {
    chips.push({
      key: 'credits',
      label: filters.credits === 'gt4' ? '>4 credits' : `${filters.credits} credits`,
      clear: () => onPatch({ credits: '' }),
    });
  }
  if (filters.enrollmentStatus) {
    chips.push({
      key: 'enrollment',
      label: filters.enrollmentStatus.replace(/_/g, ' '),
      clear: () => onPatch({ enrollmentStatus: '' }),
    });
  }
  if (filters.facultyAssigned === 'true') {
    chips.push({
      key: 'faculty-yes',
      label: 'Faculty assigned',
      clear: () => onPatch({ facultyAssigned: '' }),
    });
  }
  if (filters.facultyAssigned === 'false') {
    chips.push({
      key: 'faculty-no',
      label: 'Missing faculty',
      clear: () => onPatch({ facultyAssigned: '' }),
    });
  }
  if (filters.versionStatus && filters.versionStatus !== 'ALL') {
    chips.push({
      key: 'version',
      label: filters.versionStatus,
      clear: () => onPatch({ versionStatus: 'ALL' }),
    });
  }
  if (filters.quickToggle) {
    chips.push({
      key: 'quick',
      label: filters.quickToggle.replace(/_/g, ' '),
      clear: () => onPatch({ quickToggle: '' }),
    });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80',
            chip.className ?? 'border-border/60 bg-muted/50',
          )}
          onClick={chip.clear}
        >
          {chip.label}
          <span aria-hidden className="text-muted-foreground">
            ×
          </span>
        </button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px]"
        onClick={onReset}
      >
        Clear all
      </Button>
    </div>
  );
}
