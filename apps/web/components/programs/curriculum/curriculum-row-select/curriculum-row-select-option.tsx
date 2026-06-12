'use client';

import { Check } from 'lucide-react';
import { Command } from 'cmdk';

import { categoryColorToken } from '@/components/programs/curriculum/curriculum-category-tokens';
import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';

import { formatRowPrimaryLabel, formatRowSecondaryLabel } from './curriculum-row-select-utils';

type Props = {
  row: CurriculumOfferingRow;
  selected: boolean;
  onSelect: () => void;
};

export function CurriculumRowSelectOption({ row, selected, onSelect }: Props) {
  const category = row.category ?? 'OTHER';
  const token = categoryColorToken(category);

  return (
    <Command.Item
      value={row.id}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-lg bg-background px-2 py-2 text-left',
        'aria-selected:bg-muted',
        selected && 'bg-primary/10 ring-1 ring-primary/25',
      )}
    >
      <Check
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 text-primary',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium leading-snug">{formatRowPrimaryLabel(row)}</p>
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              token.chip,
            )}
          >
            {category}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRowSecondaryLabel(row)}</p>
      </div>
    </Command.Item>
  );
}
