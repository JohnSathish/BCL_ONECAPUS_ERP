'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchHrLeaveRequests,
  fetchHrLeaveTypes,
  requestHrLeave,
  reviewHrLeave,
  saveHrLeavePolicy,
  saveHrLeaveType,
} from '@/services/school-sis';
import { btn, field, HrBadge, HrShell } from './hr-ui';

export function HrLeaveDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const tab = useSearchParams().get('tab') || 'requests';
  const types = useQuery({ queryKey: ['hr-leave-types'], queryFn: fetchHrLeaveTypes, enabled });
  const reqs = useQuery({
    queryKey: ['hr-leave-reqs'],
    queryFn: () => fetchHrLeaveRequests(),
    enabled,
  });
  const [lt, setLt] = useState({ code: '', name: '' });
  const [req, setReq] = useState({
    staffId: '',
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const saveT = useMutation({
    mutationFn: () => saveHrLeaveType(lt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave-types'] }),
  });
  const saveP = useMutation({
    mutationFn: () =>
      saveHrLeavePolicy({ leaveTypeId: req.leaveTypeId, annualEntitlement: 12, monthlyAccrual: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave-types'] }),
  });
  const apply = useMutation({
    mutationFn: () => requestHrLeave(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave-reqs'] }),
  });
  const review = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) => reviewHrLeave(id, ok),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave-reqs'] }),
  });
  const tone = (s: string) => (s === 'APPROVED' ? 'green' : s === 'REJECTED' ? 'red' : 'amber');

  return (
    <HrShell title="Leave management">
      {tab === 'types' || tab === 'policies' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <form
            className="grid gap-2 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveT.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code"
              value={lt.code}
              onChange={(e) => setLt({ ...lt, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={lt.name}
              onChange={(e) => setLt({ ...lt, name: e.target.value })}
            />
            <button className={btn}>Add leave type</button>
          </form>
          <ul className="mt-3 text-sm">
            {(types.data ?? []).map((t: { id: string; name: string; code: string }) => (
              <li key={t.id} className="flex items-center justify-between py-1">
                <span>
                  {t.name} <span className="text-slate-400">{t.code}</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-[#1e3a8a]"
                  onClick={() => {
                    setReq({ ...req, leaveTypeId: t.id });
                    saveP.mutate();
                  }}
                >
                  Default policy 12/year
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Apply leave</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate();
          }}
        >
          <input
            className={field}
            placeholder="Staff ID"
            value={req.staffId}
            onChange={(e) => setReq({ ...req, staffId: e.target.value })}
          />
          <select
            className={field}
            value={req.leaveTypeId}
            onChange={(e) => setReq({ ...req, leaveTypeId: e.target.value })}
          >
            <option value="">Leave type</option>
            {(types.data ?? []).map((t: { id: string; name: string }) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            className={field}
            type="date"
            value={req.fromDate}
            onChange={(e) => setReq({ ...req, fromDate: e.target.value })}
          />
          <input
            className={field}
            type="date"
            value={req.toDate}
            onChange={(e) => setReq({ ...req, toDate: e.target.value })}
          />
          <input
            className={field}
            placeholder="Reason"
            value={req.reason}
            onChange={(e) => setReq({ ...req, reason: e.target.value })}
          />
          <button className={btn}>Submit</button>
        </form>
      </section>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Dates</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(reqs.data ?? []).map(
              (r: {
                id: string;
                status: string;
                fromDate: string;
                toDate: string;
                staff: { fullName: string };
                leaveType: { name: string };
              }) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.staff.fullName}</td>
                  <td className="px-3 py-2">{r.leaveType.name}</td>
                  <td className="px-3 py-2">
                    {String(r.fromDate).slice(0, 10)} → {String(r.toDate).slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <HrBadge tone={tone(r.status)}>{r.status}</HrBadge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-emerald-700"
                          onClick={() => review.mutate({ id: r.id, ok: true })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose-700"
                          onClick={() => review.mutate({ id: r.id, ok: false })}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </HrShell>
  );
}
