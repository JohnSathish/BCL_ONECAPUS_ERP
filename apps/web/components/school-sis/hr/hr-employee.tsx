'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createHrExit,
  fetchHrEmployee,
  fetchHrEmployeeTypes,
  fetchHrDepartments,
  fetchHrDesignations,
  saveHrBank,
  saveHrEmployment,
} from '@/services/school-sis';
import { btn, field, HrBadge, HrShell, inrPaise } from './hr-ui';

const TABS = [
  'Overview',
  'Personal',
  'Employment',
  'Attendance',
  'Leave',
  'Salary',
  'Payslips',
  'Documents',
  'Loans',
  'Reimbursements',
  'Timeline',
] as const;

export function HrEmployeeProfile({ id }: { id: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const emp = useQuery({
    queryKey: ['hr-emp', id],
    queryFn: () => fetchHrEmployee(id),
    enabled,
  });
  const depts = useQuery({ queryKey: ['hr-depts'], queryFn: fetchHrDepartments, enabled });
  const desigs = useQuery({ queryKey: ['hr-desigs'], queryFn: fetchHrDesignations, enabled });
  const types = useQuery({ queryKey: ['hr-types'], queryFn: fetchHrEmployeeTypes, enabled });
  const s = emp.data;
  const empment = s?.hrEmployment;
  const [eform, setEform] = useState<Record<string, string>>({});
  const saveEmp = useMutation({
    mutationFn: () =>
      saveHrEmployment(id, {
        departmentId: eform.departmentId || empment?.departmentId,
        designationId: eform.designationId || empment?.designationId,
        employeeTypeId: eform.employeeTypeId || empment?.employeeTypeId,
        panFull: eform.panFull || undefined,
        workLocation: eform.workLocation || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-emp', id] }),
  });
  const [bank, setBank] = useState({
    holderName: '',
    bankName: '',
    accountFull: '',
    ifsc: '',
    branch: '',
  });
  const saveBank = useMutation({
    mutationFn: () => saveHrBank(id, bank),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-emp', id] }),
  });
  const exit = useMutation({
    mutationFn: () =>
      createHrExit({ staffId: id, kind: 'RESIGNATION', reason: 'Recorded from profile' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-emp', id] }),
  });

  if (emp.isLoading) {
    return (
      <HrShell title="Employee">
        <p className="text-sm text-slate-500">Loading profile…</p>
      </HrShell>
    );
  }
  if (!s) {
    return (
      <HrShell title="Employee">
        <p className="text-sm text-rose-600">Employee not found.</p>
      </HrShell>
    );
  }

  return (
    <HrShell title={s.fullName} subtitle={`${s.employeeCode} · ${s.designation || s.staffType}`}>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e3a8a] text-xl font-semibold text-white">
          {String(s.fullName || '?')
            .split(' ')
            .map((p: string) => p[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div>
          <p className="text-lg font-semibold">{s.fullName}</p>
          <p className="text-sm text-slate-500">
            {s.employeeCode} · {empment?.department?.name || s.department || 'Unassigned'}
          </p>
        </div>
        <HrBadge tone={s.status === 'ACTIVE' ? 'green' : 'slate'}>{s.status}</HrBadge>
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Info k="Phone" v={s.phone} />
          <Info k="Email" v={s.email} />
          <Info k="Gender" v={s.gender} />
          <Info k="PAN" v={s.pan} />
          <Info k="Joining" v={s.joiningDate ? String(s.joiningDate).slice(0, 10) : '—'} />
        </div>
      ) : null}
      {tab === 'Employment' ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <select
            className={field}
            defaultValue={empment?.departmentId || ''}
            onChange={(e) => setEform({ ...eform, departmentId: e.target.value })}
          >
            <option value="">Department</option>
            {(depts.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className={field}
            defaultValue={empment?.designationId || ''}
            onChange={(e) => setEform({ ...eform, designationId: e.target.value })}
          >
            <option value="">Designation</option>
            {(desigs.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className={field}
            defaultValue={empment?.employeeTypeId || ''}
            onChange={(e) => setEform({ ...eform, employeeTypeId: e.target.value })}
          >
            <option value="">Type</option>
            {(types.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            className={field}
            placeholder="Work location"
            defaultValue={empment?.workLocation || ''}
            onChange={(e) => setEform({ ...eform, workLocation: e.target.value })}
          />
          <input
            className={field}
            placeholder="PAN (authorized only)"
            onChange={(e) => setEform({ ...eform, panFull: e.target.value })}
          />
          <button type="button" className={btn} onClick={() => saveEmp.mutate()}>
            Save employment
          </button>
        </div>
      ) : null}
      {tab === 'Personal' ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Bank accounts</h3>
            {(s.hrBankAccounts ?? []).map(
              (b: { id: string; bankName: string; accountFull: string; ifsc: string }) => (
                <p key={b.id} className="mt-1 text-sm text-slate-600">
                  {b.bankName} · {b.accountFull} · {b.ifsc}
                </p>
              ),
            )}
            <div className="mt-3 grid gap-2">
              {(['holderName', 'bankName', 'accountFull', 'ifsc', 'branch'] as const).map((k) => (
                <input
                  key={k}
                  className={field}
                  placeholder={k}
                  value={bank[k]}
                  onChange={(e) => setBank({ ...bank, [k]: e.target.value })}
                />
              ))}
              <button type="button" className={btn} onClick={() => saveBank.mutate()}>
                Save bank
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Emergency / nominees</h3>
            {(s.hrContacts ?? []).map((c: { id: string; name: string; mobile: string }) => (
              <p key={c.id} className="text-sm">
                {c.name} · {c.mobile}
              </p>
            ))}
            {(s.hrNominees ?? []).map((c: { id: string; name: string; percentage: number }) => (
              <p key={c.id} className="text-sm">
                Nominee {c.name} ({c.percentage}%)
              </p>
            ))}
          </div>
        </div>
      ) : null}
      {tab === 'Attendance' ? (
        <SimpleList
          rows={s.hrAttendance ?? []}
          render={(r: { id: string; date: string; status: string }) =>
            `${String(r.date).slice(0, 10)} · ${r.status}`
          }
        />
      ) : null}
      {tab === 'Leave' ? (
        <SimpleList
          rows={s.hrLeaveRequests ?? []}
          render={(r: { id: string; status: string; leaveType?: { name: string } }) =>
            `${r.leaveType?.name} · ${r.status}`
          }
        />
      ) : null}
      {tab === 'Salary' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          {(s.hrSalaries ?? []).map(
            (r: {
              id: string;
              basicPaise: number;
              effectiveFrom: string;
              structure?: { name: string };
            }) => (
              <p key={r.id}>
                {r.structure?.name} · Basic {inrPaise(r.basicPaise)} from{' '}
                {String(r.effectiveFrom).slice(0, 10)}
              </p>
            ),
          )}
          {(s.hrRevisions ?? []).map(
            (r: { id: string; previousPaise: number; newPaise: number; effectiveDate: string }) => (
              <p key={r.id} className="text-slate-600">
                Revision {String(r.effectiveDate).slice(0, 10)} {inrPaise(r.previousPaise)} →{' '}
                {inrPaise(r.newPaise)}
              </p>
            ),
          )}
        </div>
      ) : null}
      {tab === 'Payslips' ? (
        <SimpleList
          rows={s.hrPayrollLines ?? []}
          render={(r: { id: string; netPaise: number; run?: { periodMonth: string } }) =>
            `${r.run?.periodMonth} · ${inrPaise(r.netPaise)}`
          }
        />
      ) : null}
      {tab === 'Documents' ? (
        <SimpleList
          rows={s.hrDocuments ?? []}
          render={(r: { id: string; docType: string; expiryDate?: string }) =>
            `${r.docType}${r.expiryDate ? ` · exp ${String(r.expiryDate).slice(0, 10)}` : ''}`
          }
        />
      ) : null}
      {tab === 'Loans' ? (
        <SimpleList
          rows={s.hrLoans ?? []}
          render={(r: { id: string; loanType: string; outstandingPaise: number }) =>
            `${r.loanType} outstanding ${inrPaise(r.outstandingPaise)}`
          }
        />
      ) : null}
      {tab === 'Reimbursements' ? (
        <SimpleList
          rows={s.hrReimbursements ?? []}
          render={(r: { id: string; category: string; status: string; amountPaise: number }) =>
            `${r.category} · ${inrPaise(r.amountPaise)} · ${r.status}`
          }
        />
      ) : null}
      {tab === 'Timeline' ? (
        <div className="space-y-2">
          {(s.hrTimeline ?? []).map(
            (t: { id: string; event: string; detail?: string; createdAt: string }) => (
              <div
                key={t.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                <p className="font-medium">{t.event}</p>
                <p className="text-slate-500">
                  {new Date(t.createdAt).toLocaleDateString('en-IN')} {t.detail || ''}
                </p>
              </div>
            ),
          )}
          <button type="button" className={btn} onClick={() => exit.mutate()}>
            Record resignation
          </button>
        </div>
      ) : null}
    </HrShell>
  );
}

function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase text-slate-400">{k}</p>
      <p className="text-sm font-medium">{v || '—'}</p>
    </div>
  );
}

function SimpleList({
  rows,
  render,
}: {
  rows: Array<{ id: string }>;
  render: (r: never) => string;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No records.</p>;
  return (
    <ul className="space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      {rows.map((r) => (
        <li key={r.id}>{render(r as never)}</li>
      ))}
    </ul>
  );
}
