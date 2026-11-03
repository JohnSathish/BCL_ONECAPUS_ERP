'use client';

import type { ErpUserRow } from '@/types/erp-users';
import { cn } from '@/utils/cn';

const STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-700 ring-amber-500/30',
  locked: 'bg-red-500/15 text-red-700 ring-red-500/30',
  inactive: 'bg-slate-500/15 text-slate-600 ring-slate-500/30',
};

const LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending activation',
  locked: 'Locked',
  inactive: 'Inactive',
};

export function ErpUserStatusPill({
  row,
}: {
  row: Pick<ErpUserRow, 'status' | 'pendingActivation' | 'erpAccessEnabled'>;
}) {
  const key = row.status === 'active' && row.pendingActivation ? 'pending' : row.status;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
          STYLES[key] ?? STYLES.inactive,
        )}
      >
        {LABELS[key] ?? key}
      </span>
      {!row.erpAccessEnabled ? (
        <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-500/30">
          No ERP access
        </span>
      ) : null}
    </span>
  );
}
