'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, History, IdCard, Layers } from 'lucide-react';

import { fetchStudentRollShiftHistory } from '@/services/roll-number';
import { formatDisplayDateTime } from '@/utils/format-date';

export function StudentRollShiftHistoryCard({ studentId }: { studentId: string }) {
  const historyQ = useQuery({
    queryKey: ['students', studentId, 'roll-shift-history'],
    queryFn: () => fetchStudentRollShiftHistory(studentId),
  });

  const data = historyQ.data;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3 bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <IdCard className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Roll Number & Shift</h2>
          <p className="text-sm text-white/85">
            Current assignment, previous roll/shift, and permanent transfer history.
          </p>
        </div>
      </div>
      {historyQ.isLoading ? (
        <p className="px-5 py-6 text-sm text-slate-500">Loading…</p>
      ) : !data ? (
        <p className="px-5 py-6 text-sm text-slate-500">No roll history available.</p>
      ) : (
        <div className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <RollTile
              icon={IdCard}
              label="Current Roll Number"
              value={data.currentRollNumber ?? '—'}
              emphasize
            />
            <RollTile
              icon={CalendarDays}
              label="Current Shift"
              value={data.currentShift?.name ?? '—'}
              pill
            />
            <RollTile
              icon={History}
              label="Previous Roll Number"
              value={data.previousRollNumber ?? '—'}
            />
            <RollTile
              icon={Layers}
              label="Previous Shift"
              value={data.previousShift?.name ?? '—'}
            />
          </div>

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
    </section>
  );
}

function RollTile({
  icon: Icon,
  label,
  value,
  emphasize,
  pill,
}: {
  icon: typeof IdCard;
  label: string;
  value: string;
  emphasize?: boolean;
  pill?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        {pill && value !== '—' ? (
          <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-700">
            {value}
          </span>
        ) : (
          <p
            className={
              emphasize
                ? 'font-mono text-lg font-semibold text-slate-900'
                : 'text-sm font-medium text-slate-700'
            }
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
