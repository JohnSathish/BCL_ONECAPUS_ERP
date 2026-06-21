'use client';

import { useQuery } from '@tanstack/react-query';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { fetchStudentRollShiftHistory } from '@/services/roll-number';
import { formatDisplayDateTime } from '@/utils/format-date';

export function StudentRollShiftHistoryCard({ studentId }: { studentId: string }) {
  const historyQ = useQuery({
    queryKey: ['students', studentId, 'roll-shift-history'],
    queryFn: () => fetchStudentRollShiftHistory(studentId),
  });

  const data = historyQ.data;

  return (
    <SectionCard
      title="Roll number & shift"
      description="Current assignment, previous roll/shift, and permanent transfer history"
    >
      {historyQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !data ? (
        <p className="text-xs text-muted-foreground">No roll history available.</p>
      ) : (
        <div className="space-y-3 text-xs">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Current roll</dt>
              <dd className="font-mono font-medium">{data.currentRollNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current shift</dt>
              <dd>{data.currentShift?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Previous roll</dt>
              <dd className="font-mono">{data.previousRollNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Previous shift</dt>
              <dd>{data.previousShift?.name ?? '—'}</dd>
            </div>
          </dl>

          {data.transferHistory.length > 0 ? (
            <div>
              <p className="mb-1 font-medium">Transfer history</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.transferHistory.map((row) => (
                  <li key={row.id} className="px-2 py-2">
                    <div>
                      {row.fromShift.name} → {row.toShift.name}
                    </div>
                    <div className="font-mono text-muted-foreground">
                      {row.oldRollNumber ?? '—'} → {row.newRollNumber ?? '—'}
                    </div>
                    <div className="text-muted-foreground">
                      {row.changedBy?.displayName ?? row.changedBy?.email ?? 'System'} ·{' '}
                      {formatDisplayDateTime(row.changedAt)}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
