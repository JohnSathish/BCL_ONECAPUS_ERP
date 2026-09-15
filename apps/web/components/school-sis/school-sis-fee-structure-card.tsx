'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { apiErrorMessage } from '@/utils/api-error';
import {
  updateSchoolSisFeeInstallment,
  updateSchoolSisFeeLine,
  type SchoolSisFeeLine,
  type SchoolSisFeeStructure,
} from '@/services/school-sis';

export function formatInr(amount: number | null | undefined) {
  if (amount == null) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function notes(value: SchoolSisFeeStructure['notesJson']): string[] {
  return Array.isArray(value) ? value.map((n) => String(n)) : [];
}

function LineTable({
  title,
  rows,
  structureId,
  canManage,
  scheduleLabel,
}: {
  title: string;
  rows: SchoolSisFeeLine[];
  structureId: string;
  canManage: boolean;
  scheduleLabel: string;
}) {
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
            {canManage ? <th className="w-24 px-3 py-2 print:hidden" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <EditableFeeRow
              key={line.id}
              line={line}
              structureId={structureId}
              canManage={canManage}
              scheduleLabel={scheduleLabel}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EditableFeeRow({
  line,
  structureId,
  canManage,
  scheduleLabel,
}: {
  line: SchoolSisFeeLine;
  structureId: string;
  canManage: boolean;
  scheduleLabel: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(line.amount == null ? '' : String(line.amount));
  const [unspecified, setUnspecified] = useState(line.unspecified);
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setAmount(line.amount == null ? '' : String(line.amount));
    setUnspecified(line.unspecified);
    setApplyAll(false);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateSchoolSisFeeLine(structureId, line.id, {
        amount: unspecified ? null : Math.round(Number(amount || 0)),
        unspecified,
        applyToSameSchedule: applyAll,
      });
      await qc.invalidateQueries({ queryKey: ['school-sis-fee-structures'] });
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 align-top">
        <p className="font-medium text-slate-800">{line.label}</p>
        {line.remarks ? <p className="text-xs text-slate-400">{line.remarks}</p> : null}
        {editing ? (
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-500 print:hidden">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={applyAll}
              onChange={(e) => setApplyAll(e.target.checked)}
            />
            <span>Apply this amount to every class on {scheduleLabel}</span>
          </label>
        ) : null}
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </td>
      <td className="px-4 py-2 text-right align-top">
        {editing ? (
          <div className="space-y-2 print:hidden">
            <label className="flex items-center justify-end gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={unspecified}
                onChange={(e) => setUnspecified(e.target.checked)}
              />
              Not specified
            </label>
            <input
              className="ml-auto h-9 w-28 rounded-xl border border-slate-200 px-2 text-right text-sm tabular-nums disabled:bg-slate-50"
              inputMode="numeric"
              value={amount}
              disabled={unspecified}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
        ) : (
          <span className="font-medium tabular-nums">
            {line.unspecified ? 'Not specified' : formatInr(line.amount)}
          </span>
        )}
      </td>
      {canManage ? (
        <td className="px-3 py-2 text-right align-top print:hidden">
          {editing ? (
            <div className="inline-flex gap-1">
              <button
                type="button"
                disabled={saving}
                className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                onClick={() => void save()}
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                onClick={() => setEditing(false)}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#2563eb] hover:bg-blue-50"
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function EditableInstallment({
  structureId,
  row,
  canManage,
}: {
  structureId: string;
  row: SchoolSisFeeStructure['installments'][number];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateSchoolSisFeeInstallment(structureId, row.id, Math.round(Number(amount || 0)));
      await qc.invalidateQueries({ queryKey: ['school-sis-fee-structures'] });
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>{row.label}</span>
      <span className="inline-flex items-center gap-2">
        {editing ? (
          <>
            <input
              className="h-9 w-28 rounded-xl border px-2 text-right text-sm tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
            <button
              type="button"
              disabled={saving}
              className="text-emerald-700"
              onClick={() => void save()}
            >
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <span className="font-medium tabular-nums">{formatInr(row.amount)}</span>
            {canManage ? (
              <button
                type="button"
                className="text-xs font-semibold text-[#2563eb] print:hidden"
                onClick={() => {
                  setAmount(String(row.amount));
                  setEditing(true);
                }}
              >
                Edit
              </button>
            ) : null}
          </>
        )}
      </span>
      {error ? <p className="w-full text-xs text-rose-600">{error}</p> : null}
    </li>
  );
}

export function SchoolSisFeeStructureCard({ structure }: { structure: SchoolSisFeeStructure }) {
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const annual = structure.lines.filter((l) => l.kind === 'ANNUAL');
  const uniform = structure.lines.filter((l) => l.kind === 'UNIFORM');
  const monthly = structure.lines.filter((l) => l.kind === 'MONTHLY');
  const showUniform = structure.totals.uniform > 0 || uniform.some((l) => l.unspecified);
  const scheduleLabel =
    structure.code === '2026-NEW'
      ? 'New Admission 2026'
      : structure.code === '2026-READMIT'
        ? 'Re-admission 2026'
        : structure.name;

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
        {canManage ? (
          <p className="mt-2 text-xs text-slate-400 print:hidden">
            Click Edit on a fee head to change its amount. Totals update after you save. Monthly
            collection plans are still set under Configuration.
          </p>
        ) : null}
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

      <LineTable
        title="Fee heads"
        rows={annual}
        structureId={structure.id}
        canManage={canManage}
        scheduleLabel={scheduleLabel}
      />
      <LineTable
        title="Uniform (issued at admission)"
        rows={uniform}
        structureId={structure.id}
        canManage={canManage}
        scheduleLabel={scheduleLabel}
      />
      <LineTable
        title="Monthly fee slip"
        rows={monthly}
        structureId={structure.id}
        canManage={canManage}
        scheduleLabel={scheduleLabel}
      />

      {structure.installments.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1a365d]">Installments</h3>
          <p className="mt-1 text-xs text-slate-500">
            Amounts as printed in the Class XI 2026–27 workbook (not listed in the Nursery–X 2026
            sheet).
          </p>
          <ul className="mt-3 divide-y">
            {structure.installments.map((row) => (
              <EditableInstallment
                key={row.id}
                structureId={structure.id}
                row={row}
                canManage={canManage}
              />
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
