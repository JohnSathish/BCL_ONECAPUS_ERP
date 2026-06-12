'use client';

import { motion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { ROMAN_SEMESTERS, semesterRoman } from './curriculum-category-tokens';

type Props = {
  selected: number[];
  onToggle: (sem: number) => void;
  onClear: () => void;
  className?: string;
};

export function CurriculumSemesterSwitcher({ selected, onToggle, onClear, className }: Props) {
  const allActive = selected.length === 0;

  return (
    <div
      className={cn(
        'relative inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-0.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'relative z-10 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
          allActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {allActive ? (
          <motion.span
            layoutId="curriculum-sem-highlight"
            className="absolute inset-0 rounded-lg bg-primary shadow-[var(--shadow-glow)]"
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          />
        ) : null}
        <span className="relative">ALL</span>
      </button>
      {ROMAN_SEMESTERS.map((label, idx) => {
        const sem = idx + 1;
        const active = selected.includes(sem);
        return (
          <button
            key={sem}
            type="button"
            onClick={() => onToggle(sem)}
            className={cn(
              'relative z-10 min-w-[2rem] rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors',
              active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            title={`Semester ${sem}`}
          >
            {active ? (
              <motion.span
                layoutId="curriculum-sem-highlight"
                className="absolute inset-0 rounded-lg bg-primary shadow-[var(--shadow-glow)]"
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              />
            ) : null}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function formatSemesterChipLabel(sem: number): string {
  return `Sem ${semesterRoman(sem)}`;
}
