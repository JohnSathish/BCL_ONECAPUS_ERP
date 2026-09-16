'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  assignHrSalary,
  fetchHrComponents,
  fetchHrEmployees,
  fetchHrStructures,
  reviseHrSalary,
  saveHrComponent,
  saveHrStructure,
} from '@/services/school-sis';
import { btn, field, HrShell, rupeesToPaise } from './hr-ui';

export function HrSalaryDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const tab = useSearchParams().get('tab') || 'components';
  const comps = useQuery({ queryKey: ['hr-comps'], queryFn: fetchHrComponents, enabled });
  const structs = useQuery({ queryKey: ['hr-structs'], queryFn: fetchHrStructures, enabled });
  const emps = useQuery({ queryKey: ['hr-employees'], queryFn: () => fetchHrEmployees(), enabled });
  const [c, setC] = useState({
    code: '',
    name: '',
    kind: 'EARNING',
    calcType: 'FIXED',
    formula: '',
    defaultPaise: '',
  });
  const [st, setSt] = useState({ code: '', name: '', componentId: '', formula: '', amount: '' });
  const [asg, setAsg] = useState({ staffId: '', structureId: '', basic: '', effectiveFrom: '' });
  const saveC = useMutation({
    mutationFn: () =>
      saveHrComponent({
        ...c,
        defaultPaise: rupeesToPaise(c.defaultPaise),
        formula: c.formula || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-comps'] }),
  });
  const saveS = useMutation({
    mutationFn: () =>
      saveHrStructure({
        code: st.code,
        name: st.name,
        lines: st.componentId
          ? [
              {
                componentId: st.componentId,
                formula: st.formula || undefined,
                amountPaise: rupeesToPaise(st.amount),
              },
            ]
          : [],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-structs'] }),
  });
  const assign = useMutation({
    mutationFn: () =>
      assignHrSalary({
        staffId: asg.staffId,
        structureId: asg.structureId,
        basicPaise: rupeesToPaise(asg.basic),
        effectiveFrom: asg.effectiveFrom,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-employees'] }),
  });
  const revise = useMutation({
    mutationFn: () =>
      reviseHrSalary({
        staffId: asg.staffId,
        newPaise: rupeesToPaise(asg.basic),
        effectiveDate: asg.effectiveFrom,
        reason: 'Revision',
      }),
  });
  const rows = emps.data?.rows ?? [];

  return (
    <HrShell title="Salary structures">
      {tab !== 'assign' && tab !== 'revisions' && tab !== 'structures' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Components</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveC.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code e.g. HRA"
              value={c.code}
              onChange={(e) => setC({ ...c, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={c.name}
              onChange={(e) => setC({ ...c, name: e.target.value })}
            />
            <select
              className={field}
              value={c.kind}
              onChange={(e) => setC({ ...c, kind: e.target.value })}
            >
              <option value="EARNING">Earning</option>
              <option value="DEDUCTION">Deduction</option>
            </select>
            <select
              className={field}
              value={c.calcType}
              onChange={(e) => setC({ ...c, calcType: e.target.value })}
            >
              <option value="FIXED">Fixed</option>
              <option value="PERCENT_BASIC">% of basic</option>
              <option value="PERCENT_GROSS">% of gross</option>
              <option value="FORMULA">Formula</option>
              <option value="MANUAL">Manual</option>
            </select>
            <input
              className={field}
              placeholder="Formula e.g. BASIC * 0.20"
              value={c.formula}
              onChange={(e) => setC({ ...c, formula: e.target.value })}
            />
            <input
              className={field}
              placeholder="Default ₹"
              value={c.defaultPaise}
              onChange={(e) => setC({ ...c, defaultPaise: e.target.value })}
            />
            <button className={btn}>Save component</button>
          </form>
          <ul className="mt-3 text-sm">
            {(comps.data ?? []).map(
              (x: { id: string; code: string; name: string; kind: string }) => (
                <li key={x.id}>
                  {x.code} · {x.name} · {x.kind}
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}
      {tab !== 'components' && tab !== 'assign' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Structures</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveS.mutate();
            }}
          >
            <input
              className={field}
              placeholder="Code"
              value={st.code}
              onChange={(e) => setSt({ ...st, code: e.target.value })}
            />
            <input
              className={field}
              placeholder="Name"
              value={st.name}
              onChange={(e) => setSt({ ...st, name: e.target.value })}
            />
            <select
              className={field}
              value={st.componentId}
              onChange={(e) => setSt({ ...st, componentId: e.target.value })}
            >
              <option value="">Line component</option>
              {(comps.data ?? []).map((x: { id: string; name: string }) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <input
              className={field}
              placeholder="Formula"
              value={st.formula}
              onChange={(e) => setSt({ ...st, formula: e.target.value })}
            />
            <input
              className={field}
              placeholder="Amount ₹"
              value={st.amount}
              onChange={(e) => setSt({ ...st, amount: e.target.value })}
            />
            <button className={btn}>Save structure</button>
          </form>
          <ul className="mt-3 text-sm">
            {(structs.data ?? []).map((x: { id: string; name: string; code: string }) => (
              <li key={x.id}>
                {x.name} <span className="text-slate-400">{x.code}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Assign / revise</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
        >
          <select
            className={field}
            value={asg.staffId}
            onChange={(e) => setAsg({ ...asg, staffId: e.target.value })}
          >
            <option value="">Employee</option>
            {rows.map((r: { id: string; fullName: string; employeeCode: string }) => (
              <option key={r.id} value={r.id}>
                {r.employeeCode} {r.fullName}
              </option>
            ))}
          </select>
          <select
            className={field}
            value={asg.structureId}
            onChange={(e) => setAsg({ ...asg, structureId: e.target.value })}
          >
            <option value="">Structure</option>
            {(structs.data ?? []).map((x: { id: string; name: string }) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <input
            className={field}
            placeholder="Basic ₹"
            value={asg.basic}
            onChange={(e) => setAsg({ ...asg, basic: e.target.value })}
          />
          <input
            className={field}
            type="date"
            value={asg.effectiveFrom}
            onChange={(e) => setAsg({ ...asg, effectiveFrom: e.target.value })}
          />
          <button className={btn}>Assign</button>
          <button type="button" className={btn} onClick={() => revise.mutate()}>
            Revise basic
          </button>
        </form>
      </section>
    </HrShell>
  );
}
