'use client';

import { CURRICULUM_QUICK_TOGGLES } from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';

type Props = {
  activeToggle: string;
  onToggle: (quickToggle: string) => void;
};

const DESCRIPTIONS: Record<string, string> = {
  SHARED_POOLS: 'Inherited pool mappings',
  COMMON_FYUGP: 'Standard FYUGP categories',
  MINOR_TRACK: 'Minor pathway papers',
  HONOURS: 'Honours track courses',
  LABS: 'Lab delivery types',
  HAS_PRACTICAL: 'Courses with practical component',
  MISSING_FACULTY: 'Sections without assigned faculty',
};

export function CurriculumQuickToggleCards({ activeToggle, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CURRICULUM_QUICK_TOGGLES.map((chip) => {
        const disabled = 'disabled' in chip && chip.disabled;
        const toggleKey = 'quickToggle' in chip ? chip.quickToggle : undefined;
        const active = !disabled && toggleKey != null && activeToggle === toggleKey;

        return (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            title={disabled ? 'Coming soon' : undefined}
            onClick={() => {
              if (disabled || !toggleKey) return;
              onToggle(active ? '' : toggleKey);
            }}
            className={cn(
              'glass-card rounded-xl border p-3 text-left transition-all',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-primary/50 bg-primary/10 shadow-[var(--shadow-glow)] ring-1 ring-primary/30'
                : 'border-border/60 hover:border-primary/30 hover:bg-muted/30',
            )}
          >
            <p className="text-xs font-semibold">{chip.label}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {disabled ? 'Coming soon' : toggleKey ? DESCRIPTIONS[toggleKey] : 'Toggle filter'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
