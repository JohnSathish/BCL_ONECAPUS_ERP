'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createHrLoan,
  createHrReimbursement,
  fetchHrLoans,
  fetchHrMe,
  fetchHrReimbursements,
  fetchHrStaffAttendance,
  finalizeHrAttendanceMonth,
  importHrEmployees,
  markHrStaffAttendance,
} from '@/services/school-sis';
import { btn, field, HrBadge, HrShell, inrPaise, rupeesToPaise } from './hr-ui';

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function HrAttendanceDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const q = useQuery({
    queryKey: ['hr-att', date],
    queryFn: () => fetchHrStaffAttendance(date),
    enabled,
  });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      markHrStaffAttendance({
        date,
        rows: (q.data ?? []).map((r: { staffId: string; status: string }) => ({
          staffId: r.staffId,
          status: marks[r.staffId] || r.status || 'PRESENT',
        })),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-att', date] }),
  });
  const fin = useMutation({
    mutationFn: () => finalizeHrAttendanceMonth(date.slice(0, 7)),
  });
  return (
    <HrShell
      title="Staff attendance"
      extra={
        <input
          type="date"
          className={field + ' w-40'}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      }
    >
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => save.mutate()}>
          Save day
        </button>
        <button type="button" className="text-sm text-slate-600" onClick={() => fin.mutate()}>
          Finalize {date.slice(0, 7)}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map(
              (r: { staffId: string; fullName: string; employeeCode: string; status: string }) => (
                <tr key={r.staffId} className="border-t">
                  <td className="px-3 py-2">
                    {r.fullName} <span className="text-xs text-slate-400">{r.employeeCode}</span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={field + ' w-40'}
                      value={marks[r.staffId] || r.status || 'PRESENT'}
                      onChange={(e) => setMarks({ ...marks, [r.staffId]: e.target.value })}
                    >
                      {[
                        'PRESENT',
                        'ABSENT',
                        'LATE',
                        'HALF_DAY',
                        'LEAVE',
                        'WEEKLY_OFF',
                        'HOLIDAY',
                        'ON_DUTY',
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
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

export function HrLoansDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['hr-loans'], queryFn: () => fetchHrLoans(), enabled });
  const [f, setF] = useState({
    staffId: '',
    loanType: 'ADVANCE',
    principal: '',
    startDate: '',
    tenureMonths: '6',
    installment: '',
  });
  const create = useMutation({
    mutationFn: () =>
      createHrLoan({
        staffId: f.staffId,
        loanType: f.loanType,
        principalPaise: rupeesToPaise(f.principal),
        startDate: f.startDate,
        tenureMonths: Number(f.tenureMonths),
        installmentPaise: rupeesToPaise(f.installment),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-loans'] }),
  });
  return (
    <HrShell title="Loans & advances">
      <form
        className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input
          className={field}
          placeholder="Staff ID"
          value={f.staffId}
          onChange={(e) => setF({ ...f, staffId: e.target.value })}
        />
        <input
          className={field}
          placeholder="Type"
          value={f.loanType}
          onChange={(e) => setF({ ...f, loanType: e.target.value })}
        />
        <input
          className={field}
          placeholder="Principal ₹"
          value={f.principal}
          onChange={(e) => setF({ ...f, principal: e.target.value })}
        />
        <input
          className={field}
          type="date"
          value={f.startDate}
          onChange={(e) => setF({ ...f, startDate: e.target.value })}
        />
        <input
          className={field}
          placeholder="Tenure months"
          value={f.tenureMonths}
          onChange={(e) => setF({ ...f, tenureMonths: e.target.value })}
        />
        <input
          className={field}
          placeholder="Installment ₹"
          value={f.installment}
          onChange={(e) => setF({ ...f, installment: e.target.value })}
        />
        <button className={btn}>Create</button>
      </form>
      <ul className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        {(q.data ?? []).map(
          (l: {
            id: string;
            loanType: string;
            outstandingPaise: number;
            status: string;
            staff?: { fullName: string };
          }) => (
            <li key={l.id} className="flex justify-between py-1">
              <span>
                {l.staff?.fullName || l.id} · {l.loanType}
              </span>
              <span>
                {inrPaise(l.outstandingPaise)} <HrBadge>{l.status}</HrBadge>
              </span>
            </li>
          ),
        )}
      </ul>
    </HrShell>
  );
}

export function HrReimbDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['hr-reimb'], queryFn: () => fetchHrReimbursements(), enabled });
  const [f, setF] = useState({
    staffId: '',
    category: 'TRAVEL',
    amount: '',
    expenseDate: todayIso(),
    description: '',
  });
  const create = useMutation({
    mutationFn: () =>
      createHrReimbursement({
        staffId: f.staffId,
        category: f.category,
        amountPaise: rupeesToPaise(f.amount),
        expenseDate: f.expenseDate,
        description: f.description,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-reimb'] }),
  });
  return (
    <HrShell title="Reimbursements">
      <form
        className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input
          className={field}
          placeholder="Staff ID"
          value={f.staffId}
          onChange={(e) => setF({ ...f, staffId: e.target.value })}
        />
        <select
          className={field}
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {['TRAVEL', 'MEDICAL', 'COMMUNICATION', 'TRAINING', 'OFFICIAL', 'OTHER'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          className={field}
          placeholder="Amount ₹"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
        <input
          className={field}
          type="date"
          value={f.expenseDate}
          onChange={(e) => setF({ ...f, expenseDate: e.target.value })}
        />
        <input
          className={field}
          placeholder="Description"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <button className={btn}>Submit</button>
      </form>
      <ul className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        {(q.data ?? []).map(
          (l: { id: string; category: string; amountPaise: number; status: string }) => (
            <li key={l.id} className="flex justify-between py-1">
              <span>{l.category}</span>
              <span>
                {inrPaise(l.amountPaise)} {l.status}
              </span>
            </li>
          ),
        )}
      </ul>
    </HrShell>
  );
}

export function HrMeDesk() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({ queryKey: ['hr-me'], queryFn: fetchHrMe, enabled });
  const s = q.data?.staff === null ? null : q.data;
  return (
    <HrShell title="My HR">
      {!s ? (
        <p className="text-sm text-slate-500">No staff profile is linked to this login.</p>
      ) : null}
      {s ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-lg font-semibold">{s.fullName}</p>
          <p className="text-slate-500">{s.employeeCode}</p>
          <p>Leave requests: {(s.hrLeaveRequests ?? []).length}</p>
          <p>Payslips: {(s.hrPayrollLines ?? []).length}</p>
          <p>Documents: {(s.hrDocuments ?? []).length}</p>
        </div>
      ) : null}
    </HrShell>
  );
}

export function HrImportDesk() {
  const [text, setText] = useState('Full Name,Employee ID,Gender,Mobile,Email,Employment Type\n');
  const [result, setResult] = useState<{
    ok?: boolean;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);
  const mut = useMutation({
    mutationFn: async () => {
      const lines = text.trim().split(/\r?\n/);
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const c = line.split(',');
        const get = (k: string) => c[header.indexOf(k)]?.trim();
        return {
          fullName: get('full name'),
          employeeCode: get('employee id'),
          gender: get('gender'),
          phone: get('mobile'),
          email: get('email'),
          employeeTypeCode: get('employment type'),
        };
      });
      return importHrEmployees({ rows });
    },
    onSuccess: setResult,
  });
  return (
    <HrShell title="Employee import">
      <p className="text-sm text-slate-500">
        Paste CSV. Validation runs on every row. Nothing is created if any row fails.
      </p>
      <textarea
        className="h-48 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="button" className={btn} onClick={() => mut.mutate()}>
        Validate and import
      </button>
      {result && !result.ok ? (
        <ul className="text-sm text-rose-700">
          {(result.errors ?? []).map((e) => (
            <li key={e.row}>
              Row {e.row}: {e.error}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.ok ? <p className="text-sm text-emerald-700">Import completed.</p> : null}
    </HrShell>
  );
}
