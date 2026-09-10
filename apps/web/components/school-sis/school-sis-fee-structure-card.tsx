'use client';

import type { SchoolSisFeeLine, SchoolSisFeeStructure } from '@/services/school-sis';

export function formatInr(amount: number | null | undefined) {
  if (amount == null) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function notes(value: SchoolSisFeeStructure['notesJson']): string[] {
  return Array.isArray(value) ? value.map((n) => String(n)) : [];
}

function LineTable({ title, rows }: { title: string; rows: SchoolSisFeeLine[] }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-[#1a365d]">
        {title}
      </h3>
      <table className="w-full text-sm">
        <thead className="bg-sky-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Fee head</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <p className="font-medium text-slate-800">{line.label}</p>
                {line.remarks ? <p className="text-xs text-slate-400">{line.remarks}</p> : null}
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {line.unspecified ? 'Not specified' : formatInr(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SchoolSisFeeStructureCard({ structure }: { structure: SchoolSisFeeStructure }) {
  const annual = structure.lines.filter((l) => l.kind === 'ANNUAL');
  const uniform = structure.lines.filter((l) => l.kind === 'UNIFORM');
  const monthly = structure.lines.filter((l) => l.kind === 'MONTHLY');
  const showUniform = structure.totals.uniform > 0 || uniform.some((l) => l.unspecified);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          St. Luke’s Hr. Secondary School, Walbakgre
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#1a365d]">{structure.name}</h2>
        <p className="text-sm text-slate-500">
          {structure.grade.name} · Academic Year {structure.academicYear.name}
          {structure.sourceLabel ? ` · ${structure.sourceLabel}` : ''}
        </p>
        <div className={`mt-3 grid gap-3 ${showUniform ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div className="rounded-xl bg-sky-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-400">Fee items</p>
            <p className="text-lg font-semibold text-[#1a365d]">
              {formatInr(structure.totals.annual)}
            </p>
          </div>
          {showUniform ? (
            <div className="rounded-xl bg-sky-50 px-3 py-2">
              <p className="text-[11px] uppercase text-slate-400">Uniform package</p>
              <p className="text-lg font-semibold text-[#1a365d]">
                {formatInr(structure.totals.uniform)}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl bg-[#1a365d] px-3 py-2 text-white">
            <p className="text-[11px] uppercase text-sky-200">Total</p>
            <p className="text-lg font-semibold">{formatInr(structure.totals.printedGrandTotal)}</p>
          </div>
        </div>
      </div>

      <LineTable title="Fee heads" rows={annual} />
      <LineTable title="Uniform (issued at admission)" rows={uniform} />
      <LineTable title="Monthly fee slip" rows={monthly} />

      {structure.installments.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1a365d]">Installments</h3>
          <p className="mt-1 text-xs text-slate-500">
            Amounts as printed in the Class XI 2026–27 workbook (not listed in the Nursery–X 2026
            sheet).
          </p>
          <ul className="mt-3 divide-y">
            {structure.installments.map((row) => (
              <li key={row.id} className="flex justify-between py-2 text-sm">
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{formatInr(row.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 text-sm font-semibold">
              <span>Total</span>
              <span>{formatInr(structure.totals.installments)}</span>
            </li>
          </ul>
        </section>
      ) : null}

      {notes(structure.notesJson).length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1a365d]">Notes / instructions</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            {notes(structure.notesJson).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
