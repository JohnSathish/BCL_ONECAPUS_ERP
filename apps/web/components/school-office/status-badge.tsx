import { cn } from '@/utils/cn';
import type { SchoolOfficeBadgeTone } from '@/lib/school-office/application-status';

const TONE_CLASS: Record<SchoolOfficeBadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function SchoolOfficeStatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: SchoolOfficeBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function SchoolOfficeStatusBadgeRow({
  badges,
}: {
  badges: Array<{ label: string; tone?: SchoolOfficeBadgeTone }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <SchoolOfficeStatusBadge
          key={`${badge.label}-${badge.tone ?? 'neutral'}`}
          label={badge.label}
          tone={badge.tone}
        />
      ))}
    </div>
  );
}
