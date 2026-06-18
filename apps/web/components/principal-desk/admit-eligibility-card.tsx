'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { cn } from '@/utils/cn';

export function AdmitEligibilityCard({
  eligible,
  reasons,
  attendancePercent,
  outstandingAmount,
}: {
  eligible: boolean;
  reasons: string[];
  attendancePercent: number | null;
  outstandingAmount: number;
}) {
  return (
    <SaaSCard
      className={cn(
        'border-2',
        eligible
          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40'
          : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40',
      )}
    >
      <div className="flex items-start gap-3">
        {eligible ? (
          <CheckCircle2 className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-8 w-8 shrink-0 text-rose-600" />
        )}
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-foreground">
            {eligible ? 'Eligible for Admit Card' : 'Not Eligible for Admit Card'}
          </p>
          {!eligible && reasons.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-rose-700 dark:text-rose-300">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
            <span>
              Attendance:{' '}
              <strong>{attendancePercent != null ? `${attendancePercent}%` : 'N/A'}</strong>
            </span>
            <span>
              Outstanding: <strong>₹{outstandingAmount.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>
      </div>
    </SaaSCard>
  );
}
