'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolAttendanceAbsentees, notifySchoolAttendance } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { AttendanceShell, StatusChip } from './attendance-ui';
import { PrimaryButton } from '../academic/academic-ui';

function todayIso() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function AttendanceAbsenteesDesk() {
  const enabled = useAuthQueryEnabled();
  const [date, setDate] = useState(todayIso());
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['school-att-abs', date],
    queryFn: () => fetchSchoolAttendanceAbsentees({ date }),
    enabled,
  });
  const notify = useMutation({
    mutationFn: () =>
      notifySchoolAttendance({
        studentIds: selected,
        channel: 'PUSH',
        message: `Your child was marked absent on ${date}.`,
      }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <AttendanceShell
      title="Today’s absentees"
      subtitle="Notify parents in bulk. Delivery goes through the school notification / WhatsApp / SMS automations."
    >
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm"
        />
        <PrimaryButton
          type="button"
          disabled={!selected.length || notify.isPending}
          onClick={() => notify.mutate()}
        >
          Send notification ({selected.length})
        </PrimaryButton>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Admission</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Parent</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Remark</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map(
              (r: {
                studentId: string;
                fullName: string;
                admissionNumber: string;
                className: string;
                parentName: string | null;
                parentPhone: string | null;
                status: string;
                remark: string | null;
              }) => (
                <tr key={r.studentId} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.studentId)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, r.studentId]
                            : prev.filter((id) => id !== r.studentId),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.fullName}</td>
                  <td className="px-3 py-2">{r.admissionNumber}</td>
                  <td className="px-3 py-2">{r.className}</td>
                  <td className="px-3 py-2">
                    {r.parentName ?? '—'}
                    <div className="text-xs text-slate-500">{r.parentPhone}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip code={r.status} />
                  </td>
                  <td className="px-3 py-2">{r.remark ?? ''}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {!list.data?.length ? (
          <p className="p-6 text-sm text-slate-500">No absent students today.</p>
        ) : null}
      </div>
    </AttendanceShell>
  );
}
