'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  SchoolSisFeeStructureCard,
  formatInr,
} from '@/components/school-sis/school-sis-fee-structure-card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolSisFeeStructures, type SchoolSisFeeStructure } from '@/services/school-sis';

export default function SchoolSisFeesPage() {
  const enabled = useAuthQueryEnabled();
  const query = useQuery({
    queryKey: ['school-sis-fee-structures'],
    queryFn: fetchSchoolSisFeeStructures,
    enabled,
  });
  const structures = query.data?.structures ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!structures.length) return null;
    return structures.find((s) => s.id === selectedId) ?? structures[0];
  }, [structures, selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1a365d]">Fee structure</h1>
          <p className="text-sm text-slate-500">
            Nursery–X from <span className="font-medium">St_Lukes_Fee_Structure_2026.xlsx</span>{' '}
            (new and re-admission). Class XI from the 2026–27 workbook. Monthly collection for
            Nursery–X is under Fees → Monthly Fees.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border bg-white px-3 py-1.5 text-sm"
          onClick={() => window.print()}
        >
          Print / PDF
        </button>
      </div>
      {query.isLoading ? <p className="text-sm text-slate-500">Loading fee structure…</p> : null}
      {query.error ? <p className="text-sm text-red-600">Unable to load fee structure.</p> : null}
      {structures.length ? <SummaryTable rows={structures} /> : null}
      {structures.length ? (
        <label className="block text-sm">
          <span className="text-slate-500">Show class schedule</span>
          <select
            className="mt-1 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} · {labelForCode(s.code)} · {formatInr(s.totals.printedGrandTotal)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selected ? <SchoolSisFeeStructureCard structure={selected} /> : null}
      {query.data && !structures.length ? (
        <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
          No fee structure is published for the current academic year.
        </p>
      ) : null}
    </div>
  );
}

function labelForCode(code: string) {
  if (code === '2026-NEW') return 'New Admission 2026';
  if (code === '2026-READMIT') return 'Re-admission 2026';
  if (code === 'XI-2026-27') return 'Class XI 2026–27';
  return code;
}

function SummaryTable({ rows }: { rows: SchoolSisFeeStructure[] }) {
  const groups = [
    { code: '2026-NEW', title: 'New Admission 2026' },
    { code: '2026-READMIT', title: 'Re-admission 2026' },
    { code: 'XI-2026-27', title: 'Class XI 2026–27' },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {groups.map((g) => {
        const items = uniqueTotals(rows.filter((r) => r.code === g.code));
        if (!items.length) return null;
        return (
          <section key={g.code} className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-[#1a365d]">
              {g.title}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {items.map((item) => (
                  <tr key={item.label} className="border-t border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{item.label}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatInr(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function uniqueTotals(rows: SchoolSisFeeStructure[]) {
  const seen = new Map<number, string[]>();
  for (const row of rows) {
    const total = row.totals.printedGrandTotal;
    const names = seen.get(total) ?? [];
    names.push(row.grade.name);
    seen.set(total, names);
  }
  return [...seen.entries()].map(([total, names]) => ({
    label: compactClassRange(names),
    total,
  }));
}

function compactClassRange(names: string[]) {
  if (names.length <= 2) return names.join(', ');
  return `${names[0]} – ${names[names.length - 1]}`;
}
