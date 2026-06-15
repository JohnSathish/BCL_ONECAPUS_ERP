'use client';

import { CalendarClock, IndianRupee } from 'lucide-react';
import type { PortalInfo } from '@/services/admissions-portal';
import {
  formatInr,
  resolvePortalCycleSettings,
} from '@/components/admissions-portal/cycle-settings';
import { cn } from '@/utils/cn';

type Props = {
  info?: PortalInfo | null;
  compact?: boolean;
  className?: string;
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AdmissionsScheduleBanner({ info, compact, className }: Props) {
  const settings = resolvePortalCycleSettings({ portalInfo: info });

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md',
        compact ? 'px-4 py-3' : 'px-5 py-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
            info?.isOpen ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-100',
          )}
        >
          {info?.isOpen ? 'Registration Open' : 'Registration Closed'}
        </span>
        {!compact && info?.cycle?.title ? (
          <span className="text-sm text-slate-300">{info.cycle.title}</span>
        ) : null}
      </div>

      <div
        className={cn(
          'mt-3 grid gap-2 text-sm text-slate-300',
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-sky-300" />
          Register by {fmtDate(info?.registrationClosesAt ?? info?.cycle?.registrationClosesAt)}
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-sky-300" />
          Apply by {fmtDate(info?.applicationDeadline ?? info?.cycle?.applicationDeadline)}
        </p>
        <p className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-sky-300" />
          Application fee {formatInr(settings.applicationFee)}
        </p>
        <p className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-sky-300" />
          Min. admission fee {formatInr(settings.admissionFeeMin)}
        </p>
      </div>

      {!info?.isOpen && info?.message ? (
        <p className="mt-2 text-xs text-amber-200/90">{info.message}</p>
      ) : null}
    </div>
  );
}
