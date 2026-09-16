'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createHrEmployee,
  fetchHrDepartments,
  fetchHrDesignations,
  fetchHrEmployeeTypes,
  fetchHrEmployees,
  fetchHrNextCode,
} from '@/services/school-sis';
import { btn, field, HrBadge, HrShell } from './hr-ui';

export function HrEmployeesDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const type = sp.get('type') || '';
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    staffType: 'TEACHING',
    phone: '',
    email: '',
    departmentId: '',
    designationId: '',
    employeeTypeId: '',
  });
  const employees = useQuery({
    queryKey: ['hr-employees', type, search],
    queryFn: () => fetchHrEmployees({ staffType: type || undefined, search: search || undefined }),
    enabled,
  });
  const depts = useQuery({ queryKey: ['hr-depts'], queryFn: fetchHrDepartments, enabled });
  const desigs = useQuery({ queryKey: ['hr-desigs'], queryFn: fetchHrDesignations, enabled });
  const types = useQuery({ queryKey: ['hr-types'], queryFn: fetchHrEmployeeTypes, enabled });
  const create = useMutation({
    mutationFn: () => createHrEmployee({ ...form, departmentId: form.departmentId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      setOpen(false);
    },
  });
  const rows = employees.data?.rows ?? [];
  const title = useMemo(() => {
    if (type === 'TEACHING') return 'Teaching staff';
    if (type === 'NON_TEACHING') return 'Non-teaching staff';
    return 'All employees';
  }, [type]);

  return (
    <HrShell
      title={title}
      extra={
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, phone"
            className={field + ' w-56'}
          />
          <button type="button" className={btn} onClick={() => setOpen(true)}>
            Add employee
          </button>
        </div>
      }
    >
      {open ? (
        <form
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <input
            className={field}
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <select
            className={field}
            value={form.staffType}
            onChange={(e) => setForm({ ...form, staffType: e.target.value })}
          >
            <option value="TEACHING">Teaching</option>
            <option value="NON_TEACHING">Non-teaching</option>
          </select>
          <input
            className={field}
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className={field}
            placeholder="Official email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <select
            className={field}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
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
            value={form.designationId}
            onChange={(e) => setForm({ ...form, designationId: e.target.value })}
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
            value={form.employeeTypeId}
            onChange={(e) => setForm({ ...form, employeeTypeId: e.target.value })}
          >
            <option value="">Employment type</option>
            {(types.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-3">
            <button className={btn} disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create'}
            </button>
            <button type="button" className="text-sm text-slate-500" onClick={() => setOpen(false)}>
              Cancel
            </button>
            {create.error ? (
              <p className="text-sm text-rose-600">Could not create employee.</p>
            ) : null}
          </div>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Record<string, string>) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.employeeCode}</td>
                <td className="px-3 py-2">
                  <Link
                    className="font-medium text-[#1e3a8a]"
                    href={`/admin/school-sis/hr/employees/${r.id}`}
                  >
                    {r.fullName}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.staffType}</td>
                <td className="px-3 py-2">{r.department || '—'}</td>
                <td className="px-3 py-2">{r.designation || '—'}</td>
                <td className="px-3 py-2">
                  <HrBadge tone={r.status === 'ACTIVE' ? 'green' : 'slate'}>{r.status}</HrBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !employees.isLoading ? (
          <p className="p-6 text-sm text-slate-500">No employees match these filters.</p>
        ) : null}
      </div>
      <NextCodeHint enabled={enabled} />
    </HrShell>
  );
}

function NextCodeHint({ enabled }: { enabled: boolean }) {
  const q = useQuery({ queryKey: ['hr-next-code'], queryFn: fetchHrNextCode, enabled });
  return q.data?.code ? (
    <p className="text-xs text-slate-500">Next employee code: {q.data.code}</p>
  ) : null;
}
