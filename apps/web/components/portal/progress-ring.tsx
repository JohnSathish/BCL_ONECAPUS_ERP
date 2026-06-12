'use client';

import { cn } from '@/utils/cn';

type Props = {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  tone?: 'good' | 'warn' | 'bad' | 'primary';
};

const TONE_STROKE: Record<NonNullable<Props['tone']>, string> = {
  good: 'stroke-emerald-500',
  warn: 'stroke-amber-500',
  bad: 'stroke-rose-500',
  primary: 'stroke-primary',
};

export function ProgressRing({
  value,
  max = 100,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  className,
  tone = 'primary',
}: Props) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700 ease-out', TONE_STROKE[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold leading-none">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          {max === 100 ? '%' : ''}
        </span>
        {label ? <span className="mt-0.5 text-[10px] text-muted-foreground">{label}</span> : null}
      </div>
      {sublabel ? <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p> : null}
    </div>
  );
}

export function attendanceTone(pct: number | null | undefined): Props['tone'] {
  if (pct == null) return 'primary';
  if (pct >= 75) return 'good';
  if (pct >= 65) return 'warn';
  return 'bad';
}
