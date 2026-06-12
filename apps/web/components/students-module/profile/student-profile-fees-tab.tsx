'use client';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import type { StudentProfile } from '@/types/students';
import { cn } from '@/utils/cn';

const STATUS_LABEL: Record<string, string> = {
  CLEAR: 'Clear',
  DUE: 'Due',
  OVERDUE: 'Overdue',
  PARTIAL: 'Partial',
};

function statusTone(status?: string) {
  if (status === 'OVERDUE') return 'text-rose-600 dark:text-rose-300';
  if (status === 'DUE' || status === 'PARTIAL') return 'text-amber-700 dark:text-amber-300';
  return 'text-emerald-700 dark:text-emerald-300';
}

export function StudentProfileFeesTab({ profile }: { profile: StudentProfile }) {
  const summary = profile.feeSummary;

  if (!summary) {
    return (
      <SectionCard title="Fees" description="Fee ledger and payment history">
        <p className="text-xs text-muted-foreground">No fee data available for this student.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fees" description="Outstanding demands and published fee ledger">
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Status</p>
          <p className={cn('text-sm font-semibold', statusTone(summary.feeStatus))}>
            {STATUS_LABEL[summary.feeStatus] ?? summary.feeStatus}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Balance due</p>
          <p className="text-sm font-semibold">
            ₹{summary.feeDueAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {summary.demands.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active fee demands.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Demand</th>
                <th className="py-2 pr-3 font-medium">Sem</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Due date</th>
                <th className="py-2 pr-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {summary.demands.map((demand) => (
                <tr key={demand.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{demand.demandNo}</td>
                  <td className="py-2 pr-3">{demand.semesterNumber ?? '—'}</td>
                  <td className="py-2 pr-3">{demand.status.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3">
                    {demand.dueDate ? new Date(demand.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    ₹{demand.balanceAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
