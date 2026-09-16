'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Info,
  Layers3,
  Pencil,
  Printer,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  fetchMonthlyFeeConfig,
  fetchSchoolSisFeeStructures,
  updateSchoolSisFeeInstallment,
  updateSchoolSisFeeLine,
  type SchoolSisFeeLine,
  type SchoolSisFeeStructure,
} from '@/services/school-sis';
import { MonthlyFeeSubnav } from './monthly-fee-ui';
import { formatInr } from '@/components/school-sis/school-sis-fee-structure-card';
import { downloadSchoolReport, kindToSchoolReportExport } from '@/services/school-reports';
import { ReportExportButtons } from '../reports/export-buttons';

const HEAD_HINT: Record<string, string> = {
  ADM: 'One time admission fee',
  TW: 'Welfare fund for teachers',
  'TUI-JF': 'Tuition fee for January and February',
  'TUI-MJ': 'Tuition fee for May and June',
  'TUI-M': 'Monthly tuition fee',
  EXAM: 'Exam and assessment charges',
  GAMES: 'Sports and games activities',
  MAINT: 'Building and infrastructure maintenance',
  EST: 'Administrative and establishment charges',
  FUNC: 'Cultural and other school functions',
  CARD: 'Admit card and fee card',
  DIARY: 'School diary and ID card',
  FND: 'Foundation fees',
  LIB: 'Library',
  MISC: 'Miscellaneous charges',
  COMP: 'Computer fee',
  LATE: 'Late fee',
  'UNI-SET': 'Regular uniform (1 set)',
  'UNI-JER': 'Jerseys (Tracks, T Shirt & Jacket)',
  'UNI-BLA': 'Blazer',
};

function scheduleLabel(code: string) {
  if (code === '2026-NEW') return 'New Admission 2026';
  if (code === '2026-READMIT') return 'Re-admission 2026';
  if (code === 'XI-2026-27') return 'Class XI 2026–27';
  return code;
}

function hintFor(line: SchoolSisFeeLine) {
  return line.remarks || HEAD_HINT[line.code] || 'Fee head';
}

function bandRows(rows: SchoolSisFeeStructure[]) {
  const seen = new Map<number, { names: string[]; firstId: string }>();
  for (const row of rows) {
    const total = row.totals.printedGrandTotal;
    const cur = seen.get(total);
    if (cur) cur.names.push(row.grade.name);
    else seen.set(total, { names: [row.grade.name], firstId: row.id });
  }
  return [...seen.entries()].map(([total, v]) => ({
    label: compactClassRange(v.names),
    total,
    firstId: v.firstId,
  }));
}

function compactClassRange(names: string[]) {
  if (names.length <= 2) return names.join(', ');
  return `${names[0]} – ${names[names.length - 1]}`;
}

export function SchoolSisFeeStructureDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const query = useQuery({
    queryKey: ['school-sis-fee-structures'],
    queryFn: fetchSchoolSisFeeStructures,
    enabled,
  });
  const config = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const structures = query.data?.structures ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!structures.length) return null;
    return structures.find((s) => s.id === selectedId) ?? structures[0];
  }, [structures, selectedId]);

  const groups = [
    {
      code: '2026-NEW',
      title: 'New Admission 2026',
      subtitle: 'Fee structure for new students',
      icon: Users,
      tone: 'blue' as const,
    },
    {
      code: '2026-READMIT',
      title: 'Re-admission 2026',
      subtitle: 'Fee structure for existing students',
      icon: RefreshCw,
      tone: 'green' as const,
    },
    {
      code: 'XI-2026-27',
      title: 'Class XI 2026–27',
      subtitle: 'Fee structure for higher secondary',
      icon: GraduationCap,
      tone: 'violet' as const,
    },
  ];

  async function exportEngine(kind: 'pdf-portrait' | 'pdf-landscape' | 'xlsx' | 'print') {
    await downloadSchoolReport({
      key: 'fee_structure',
      ...kindToSchoolReportExport(kind),
      filters: selected?.grade?.id ? { gradeId: selected.grade.id } : {},
    });
  }

  return (
    <div className="-mx-1 space-y-4 rounded-[28px] bg-[#f4f7fb] p-3 sm:p-4">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#2563eb]">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee Structure</h1>
            <p className="text-sm text-slate-500">
              Manage and view fee structure for admissions and re-admissions. Select a class to view
              detailed fee heads and amounts.
            </p>
          </div>
        </div>
        <ReportExportButtons onExport={exportEngine} />
      </div>

      {query.isLoading ? <p className="text-sm text-slate-500">Loading fee structure…</p> : null}
      {query.error ? <p className="text-sm text-rose-600">Unable to load fee structure.</p> : null}

      {structures.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {groups.map((g) => {
            const items = bandRows(structures.filter((r) => r.code === g.code));
            if (!items.length) return null;
            const Icon = g.icon;
            const tones = {
              blue: 'text-[#2563eb] bg-[#eef4ff] ring-blue-100',
              green: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
              violet: 'text-violet-600 bg-violet-50 ring-violet-100',
            };
            const selectedHere = selected?.code === g.code;
            return (
              <section
                key={g.code}
                className={cn(
                  'rounded-3xl bg-white p-4 shadow-sm ring-1',
                  selectedHere ? 'ring-[#2563eb]' : 'ring-slate-100',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1',
                      tones[g.tone],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-slate-900">{g.title}</h2>
                    <p className="text-xs text-slate-500">{g.subtitle}</p>
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-slate-50">
                  {items.map((item) => (
                    <li key={`${g.code}-${item.label}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-[#2563eb]"
                        onClick={() => setSelectedId(item.firstId)}
                      >
                        <span className="text-slate-600">{item.label}</span>
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-900">
                          {formatInr(item.total)}
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {structures.length ? (
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-600">Show class fee structure</span>
          <select
            className="h-11 min-w-[18rem] flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} · {scheduleLabel(s.code)} · {formatInr(s.totals.printedGrandTotal)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selected ? (
        <StructureDetail
          structure={selected}
          canManage={canManage}
          schoolName={config.data?.settings.schoolName}
          logoUrl={config.data?.settings.logoUrl}
          onExport={() => void exportEngine('xlsx')}
        />
      ) : null}

      {query.data && !structures.length ? (
        <p className="rounded-3xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
          No fee structure is published for the current academic year.
        </p>
      ) : null}
    </div>
  );
}

function StructureDetail({
  structure,
  canManage,
  schoolName,
  logoUrl,
  onExport,
}: {
  structure: SchoolSisFeeStructure;
  canManage: boolean;
  schoolName?: string;
  logoUrl?: string | null;
  onExport: () => void;
}) {
  const annual = structure.lines.filter((l) => l.kind === 'ANNUAL');
  const extra = structure.lines.filter((l) => l.kind !== 'ANNUAL');
  const updated = structure.updatedAt
    ? new Date(structure.updatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-contain ring-1 ring-slate-100"
                />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1a365d] text-xs font-bold text-white">
                  SLS
                </span>
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {schoolName || "St. Luke's Hr. Secondary School, Walbakgre"}
                </p>
                <h2 className="text-lg font-semibold text-[#1a365d]">
                  {structure.grade.name} · {scheduleLabel(structure.code)}
                </h2>
                <p className="text-sm text-slate-500">
                  Academic Year {structure.academicYear.name}
                  {structure.sourceLabel ? ` · ${structure.sourceLabel}` : ''}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {structure.status === 'PUBLISHED' ? 'Active' : structure.status}
            </span>
          </div>

          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <Stat
              icon={Layers3}
              label="Total Fee (All Heads)"
              value={formatInr(structure.totals.printedGrandTotal)}
              tone="blue"
            />
            <Stat
              icon={ClipboardList}
              label="Fee Heads"
              value={String(annual.length || structure.lines.length)}
              tone="green"
            />
            <Stat
              icon={GraduationCap}
              label="Admission Type"
              value={scheduleLabel(structure.code)}
              tone="violet"
            />
          </div>

          <FeeHeadTable
            title="Fee Heads"
            rows={annual}
            structure={structure}
            canManage={canManage}
          />
          {extra.length ? (
            <FeeHeadTable
              title="Other heads"
              rows={extra}
              structure={structure}
              canManage={canManage}
            />
          ) : null}
          {structure.installments.length ? (
            <InstallmentTable structure={structure} canManage={canManage} />
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 print:hidden">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a365d]">
            <Info className="h-4 w-4" />
            Quick Information
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <InfoRow
              icon={CalendarDays}
              label="Academic Year"
              value={structure.academicYear.name}
            />
            <InfoRow icon={Users} label="Admission Type" value={scheduleLabel(structure.code)} />
            <InfoRow icon={GraduationCap} label="Class" value={structure.grade.name} />
            <InfoRow
              icon={Layers3}
              label="Total Amount"
              value={formatInr(structure.totals.printedGrandTotal)}
            />
            <InfoRow
              icon={ClipboardList}
              label="Number of Fee Heads"
              value={String(structure.lines.length)}
            />
            <InfoRow
              icon={Check}
              label="Status"
              value={structure.status === 'PUBLISHED' ? 'Active' : structure.status}
            />
            <InfoRow icon={CalendarDays} label="Last Updated" value={updated} />
          </dl>
        </section>

        <section className="rounded-3xl bg-[#eef4ff] p-4 text-sm text-slate-600 ring-1 ring-sky-100">
          <h3 className="inline-flex items-center gap-2 font-semibold text-[#1a365d]">
            <BookOpen className="h-4 w-4" />
            Note
          </h3>
          <p className="mt-2 text-xs leading-5">
            This fee structure is based on the file{' '}
            {structure.sourceLabel || 'the official workbook'} (new and re-admission). Class XI from
            the 2026–27 workbook. Monthly collection for Nursery–X is under Fees → Monthly Fees.
          </p>
        </section>

        <section className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
          <h3 className="text-sm font-semibold text-emerald-900">Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl bg-white text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100"
              onClick={onExport}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </button>
          </div>
          <Link
            href="/admin/school-sis/fees/settings"
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            <Settings2 className="h-4 w-4" />
            Manage Fee Structures
          </Link>
        </section>
      </aside>
    </div>
  );
}

function FeeHeadTable({
  title,
  rows,
  structure,
  canManage,
}: {
  title: string;
  rows: SchoolSisFeeLine[];
  structure: SchoolSisFeeStructure;
  canManage: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  return (
    <div className="border-t border-slate-100">
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a365d]">
          <ClipboardList className="h-4 w-4" />
          {title}
        </h3>
        {canManage ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-semibold text-[#2563eb] print:hidden"
            onClick={() => setEditMode((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? 'Done' : 'Edit Fee Structure'}
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-sky-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2">#</th>
              <th className="px-3 py-2">Fee Head</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-5 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line, i) => (
              <EditableAmountRow
                key={`${line.id}-${line.amount ?? 'x'}`}
                index={i + 1}
                line={line}
                structure={structure}
                editing={editMode}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#eef4ff] font-semibold">
              <td className="px-5 py-3" colSpan={3}>
                Total ({rows.length} fee heads)
              </td>
              <td className="px-5 py-3 text-right tabular-nums">{formatInr(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EditableAmountRow({
  index,
  line,
  structure,
  editing,
}: {
  index: number;
  line: SchoolSisFeeLine;
  structure: SchoolSisFeeStructure;
  editing: boolean;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(line.amount == null ? '' : String(line.amount));
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateSchoolSisFeeLine(structure.id, line.id, {
        amount: amount === '' ? null : Math.round(Number(amount || 0)),
        unspecified: amount === '',
        applyToSameSchedule: applyAll,
      });
      await qc.invalidateQueries({ queryKey: ['school-sis-fee-structures'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-5 py-2.5 text-slate-400">{index}</td>
      <td className="px-3 py-2.5 font-medium text-slate-800">{line.label}</td>
      <td className="px-3 py-2.5 text-slate-500">
        {hintFor(line)}
        {editing ? (
          <label className="mt-1 flex items-center gap-1 text-xs text-slate-400 print:hidden">
            <input
              type="checkbox"
              checked={applyAll}
              onChange={(e) => setApplyAll(e.target.checked)}
            />
            Apply to all classes on {scheduleLabel(structure.code)}
          </label>
        ) : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </td>
      <td className="px-5 py-2.5 text-right">
        {editing ? (
          <span className="inline-flex items-center justify-end gap-1 print:hidden">
            <input
              className="h-9 w-24 rounded-xl border border-slate-200 px-2 text-right text-sm tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
            <button
              type="button"
              disabled={saving}
              className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              onClick={() => void save()}
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
          </span>
        ) : (
          <span className="font-semibold tabular-nums text-slate-900">
            {line.unspecified ? 'Not specified' : formatInr(line.amount)}
          </span>
        )}
      </td>
    </tr>
  );
}

function InstallmentTable({
  structure,
  canManage,
}: {
  structure: SchoolSisFeeStructure;
  canManage: boolean;
}) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <h3 className="text-sm font-semibold text-[#1a365d]">Installments</h3>
      <ul className="mt-2 divide-y">
        {structure.installments.map((row) => (
          <InstallmentRow key={row.id} structureId={structure.id} row={row} canManage={canManage} />
        ))}
        <li className="flex justify-between py-2 text-sm font-semibold">
          <span>Total</span>
          <span>{formatInr(structure.totals.installments)}</span>
        </li>
      </ul>
    </div>
  );
}

function InstallmentRow({
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
  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span>{row.label}</span>
      {editing ? (
        <span className="inline-flex gap-1">
          <input
            className="h-8 w-24 rounded-lg border px-2 text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button
            type="button"
            onClick={() => {
              void updateSchoolSisFeeInstallment(
                structureId,
                row.id,
                Math.round(Number(amount || 0)),
              )
                .then(() => qc.invalidateQueries({ queryKey: ['school-sis-fee-structures'] }))
                .then(() => setEditing(false));
            }}
          >
            <Check className="h-4 w-4 text-emerald-700" />
          </button>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 font-medium tabular-nums">
          {formatInr(row.amount)}
          {canManage ? (
            <button
              type="button"
              className="text-xs text-[#2563eb] print:hidden"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : null}
        </span>
      )}
    </li>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'violet';
}) {
  const wrap = {
    blue: 'bg-[#eef4ff] text-[#2563eb]',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl px-3 py-3', wrap[tone])}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-lg font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
