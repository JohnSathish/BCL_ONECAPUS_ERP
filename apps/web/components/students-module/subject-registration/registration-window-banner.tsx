'use client';

import Link from 'next/link';
import type { RegistrationWindow } from '@/types/academic-engine';
import { formatDisplayDate } from '@/utils/format-date';

type RegistrationWindowBannerProps = {
  window: RegistrationWindow | undefined;
  semesterSequence: number;
};

export function RegistrationWindowBanner({
  window,
  semesterSequence,
}: RegistrationWindowBannerProps) {
  if (!window) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        No registration window configured.{' '}
        <Link href="/admin/academic-engine" className="font-medium text-primary underline">
          Configure in Academic Engine
        </Link>
      </div>
    );
  }

  const status = window.status ?? (window.locked ? 'LOCKED' : 'CLOSED');
  const statusClass =
    status === 'OPEN'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : status === 'LOCKED'
        ? 'border-destructive/30 bg-destructive/10'
        : 'border-border bg-muted/40';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${statusClass}`}
    >
      <div>
        <p className="font-medium">{window.name}</p>
        <p className="text-xs opacity-80">
          Semester {semesterSequence} · {window.semester.name} · {formatDisplayDate(window.opensAt)}{' '}
          – {formatDisplayDate(window.closesAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-current px-2 py-0.5 text-xs font-semibold uppercase">
          {status}
        </span>
        <Link href="/admin/academic-engine" className="text-xs text-primary underline">
          Manage windows
        </Link>
      </div>
    </div>
  );
}
