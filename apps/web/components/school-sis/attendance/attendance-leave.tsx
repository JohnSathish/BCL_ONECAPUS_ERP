'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createSchoolAttendanceLeave,
  fetchSchoolAttendanceLeave,
  fetchSchoolAttendanceSettings,
  reviewSchoolAttendanceLeave,
  searchSchoolAttendanceStudents,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { AttendanceShell, StatusChip } from './attendance-ui';
import { PrimaryButton } from '../academic/academic-ui';

export function AttendanceLeaveDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: '',
    studentLabel: '',
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [q, setQ] = useState('');
  const settings = useQuery({
    queryKey: ['school-att-settings'],
    queryFn: () => fetchSchoolAttendanceSettings(),
    enabled,
  });
  const list = useQuery({
    queryKey: ['school-att-leave', status],
    queryFn: () => fetchSchoolAttendanceLeave({ status: status || undefined }),
    enabled,
  });
  const search = useQuery({
    queryKey: ['school-att-search', q],
    queryFn: () => searchSchoolAttendanceStudents(q),
    enabled: q.length >= 2,
  });
  const create = useMutation({
    mutationFn: () => createSchoolAttendanceLeave(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-att-leave'] });
      setForm({
        studentId: '',
        studentLabel: '',
        leaveTypeId: '',
        fromDate: '',
        toDate: '',
        reason: '',
      });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewSchoolAttendanceLeave(id, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-att-leave'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <AttendanceShell
      title="Leave management"
      subtitle="Approved leave updates daily attendance automatically."
    >
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="md:col-span-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search student"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
          {search.data?.length ? (
            <ul className="mt-1 max-h-32 overflow-auto rounded-lg border bg-white text-sm">
              {search.data.map(
                (e: {
                  studentId: string;
                  student: { fullName: string };
                  section: { grade: { name: string }; name: string };
                }) => (
                  <li key={e.studentId}>
                    <button
                      type="button"
                      className="w-full px-3 py-1 text-left hover:bg-slate-50"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          studentId: e.studentId,
                          studentLabel: `${e.student.fullName} · ${e.section.grade.name} ${e.section.name}`,
                        }));
                        setQ('');
                      }}
                    >
                      {e.student.fullName} · {e.section.grade.name} {e.section.name}
                    </button>
                  </li>
                ),
              )}
            </ul>
          ) : null}
          {form.studentLabel ? (
            <p className="mt-1 text-xs text-slate-500">{form.studentLabel}</p>
          ) : null}
        </div>
        <select
          required
          value={form.leaveTypeId}
          onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
          className="h-10 rounded-lg border px-3 text-sm"
        >
          <option value="">Leave type</option>
          {(settings.data?.leaveTypes ?? []).map((t: { id: string; name: string }) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          required
          type="date"
          value={form.fromDate}
          onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
          className="h-10 rounded-lg border px-3 text-sm"
        />
        <input
          required
          type="date"
          value={form.toDate}
          onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
          className="h-10 rounded-lg border px-3 text-sm"
        />
        <input
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          placeholder="Reason"
          className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
        />
        <PrimaryButton type="submit" disabled={!form.studentId || create.isPending}>
          Submit leave
        </PrimaryButton>
      </form>
      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
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
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map(
              (row: {
                id: string;
                status: string;
                fromDate: string;
                toDate: string;
                student: { fullName: string };
                leaveType: { name: string };
              }) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.student.fullName}</td>
                  <td className="px-3 py-2">{row.leaveType.name}</td>
                  <td className="px-3 py-2">{String(row.fromDate).slice(0, 10)}</td>
                  <td className="px-3 py-2">{String(row.toDate).slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <StatusChip code={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.status === 'PENDING' ? (
                      <>
                        <button
                          className="text-emerald-700"
                          type="button"
                          onClick={() => review.mutate({ id: row.id, approve: true })}
                        >
                          Approve
                        </button>
                        <button
                          className="ml-3 text-rose-700"
                          type="button"
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
          <p className="p-6 text-sm text-slate-500">No leave requests.</p>
        ) : null}
      </div>
    </AttendanceShell>
  );
}
