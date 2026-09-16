'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolAttendanceCorrections,
  reviewSchoolAttendanceCorrection,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { AttendanceShell, StatusChip } from './attendance-ui';

export function AttendanceCorrectionsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['school-att-corr', status],
    queryFn: () => fetchSchoolAttendanceCorrections(status || undefined),
    enabled,
  });
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewSchoolAttendanceCorrection(id, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-att-corr'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <AttendanceShell
      title="Attendance corrections"
      subtitle="Locked attendance is changed only through approval."
    >
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs ring-1 ${status === s ? 'bg-[#1e3a8a] text-white' : 'bg-white'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map(
              (row: {
                id: string;
                fromStatus: string;
                toStatus: string;
                reason: string;
                status: string;
                student: { fullName: string };
                session: { date: string; section: { name: string; grade: { name: string } } };
              }) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.student.fullName}</td>
                  <td className="px-3 py-2">
                    {row.session.section.grade.name} {row.session.section.name}
                    <div className="text-xs text-slate-500">
                      {String(row.session.date).slice(0, 10)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.fromStatus}</td>
                  <td className="px-3 py-2">{row.toStatus}</td>
                  <td className="px-3 py-2">{row.reason}</td>
                  <td className="px-3 py-2">
                    <StatusChip code={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="text-emerald-700"
                          onClick={() => review.mutate({ id: row.id, approve: true })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-rose-700"
                          onClick={() => review.mutate({ id: row.id, approve: false })}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {!list.data?.length ? (
          <p className="p-6 text-sm text-slate-500">No correction requests.</p>
        ) : null}
      </div>
    </AttendanceShell>
  );
}
