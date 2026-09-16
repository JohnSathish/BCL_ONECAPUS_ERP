'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchHrDepartments,
  fetchHrDesignations,
  fetchHrEmployeeTypes,
  saveHrDepartment,
  saveHrDesignation,
  saveHrEmployeeType,
} from '@/services/school-sis';
import { btn, field, HrShell } from './hr-ui';

export function HrOrgDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const tab = useSearchParams().get('tab') || 'departments';
  const depts = useQuery({ queryKey: ['hr-depts'], queryFn: fetchHrDepartments, enabled });
  const desigs = useQuery({ queryKey: ['hr-desigs'], queryFn: fetchHrDesignations, enabled });
  const types = useQuery({ queryKey: ['hr-types'], queryFn: fetchHrEmployeeTypes, enabled });
  const [d, setD] = useState({ code: '', name: '', parentId: '' });
  const [g, setG] = useState({ code: '', name: '', departmentId: '' });
  const [t, setT] = useState({ code: '', name: '' });
  const saveD = useMutation({
    mutationFn: () => saveHrDepartment({ ...d, parentId: d.parentId || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-depts'] }),
  });
  const saveG = useMutation({
    mutationFn: () => saveHrDesignation({ ...g, departmentId: g.departmentId || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-desigs'] }),
  });
  const saveT = useMutation({
    mutationFn: () => saveHrEmployeeType(t),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-types'] }),
  });

  return (
    <HrShell title="Organisation">
      {tab !== 'designations' && tab !== 'types' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Departments</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveD.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code"
              value={d.code}
              onChange={(e) => setD({ ...d, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={d.name}
              onChange={(e) => setD({ ...d, name: e.target.value })}
            />
            <select
              className={field}
              value={d.parentId}
              onChange={(e) => setD({ ...d, parentId: e.target.value })}
            >
              <option value="">Parent (optional)</option>
              {(depts.data ?? []).map((x: { id: string; name: string }) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button className={btn}>Save department</button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(depts.data ?? []).map(
              (x: { id: string; code: string; name: string; parent?: { name: string } | null }) => (
                <li key={x.id}>
                  {x.parent ? `${x.parent.name} / ` : ''}
                  {x.name} <span className="text-slate-400">{x.code}</span>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}
      {tab !== 'departments' && tab !== 'types' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Designations</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveG.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code"
              value={g.code}
              onChange={(e) => setG({ ...g, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={g.name}
              onChange={(e) => setG({ ...g, name: e.target.value })}
            />
            <select
              className={field}
              value={g.departmentId}
              onChange={(e) => setG({ ...g, departmentId: e.target.value })}
            >
              <option value="">Department</option>
              {(depts.data ?? []).map((x: { id: string; name: string }) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button className={btn}>Save designation</button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(desigs.data ?? []).map((x: { id: string; name: string; code: string }) => (
              <li key={x.id}>
                {x.name} <span className="text-slate-400">{x.code}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === 'types' || tab === 'departments' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Employee types</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveT.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code"
              value={t.code}
              onChange={(e) => setT({ ...t, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={t.name}
              onChange={(e) => setT({ ...t, name: e.target.value })}
            />
            <button className={btn}>Save type</button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(types.data ?? []).map((x: { id: string; name: string; code: string }) => (
              <li key={x.id}>
                {x.name} <span className="text-slate-400">{x.code}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </HrShell>
  );
}
