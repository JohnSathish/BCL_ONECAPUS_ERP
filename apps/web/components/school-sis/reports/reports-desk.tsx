'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { fetchSchoolSisMasters } from '@/services/school-sis';
import {
  downloadSchoolReport,
  fetchSchoolReportCatalog,
  fetchSchoolReportHtml,
  fetchSchoolReportPreview,
  kindToSchoolReportExport,
} from '@/services/school-reports';
import { GhostButton } from '../academic/academic-ui';
import { WaCard } from '../whatsapp/whatsapp-ui';
import { ReportExportButtons } from './export-buttons';
import { formatInr } from './report-format';
import { AttendanceReportsDesk } from './attendance-reports-desk';

export function SchoolReportsDesk() {
  const ready = useAuthQueryEnabled();
  const params = useSearchParams();
  const catalog = useQuery({
    queryKey: ['school-report-cat'],
    queryFn: fetchSchoolReportCatalog,
    enabled: ready,
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled: ready,
  });
  const [moduleId, setModuleId] = useState(params.get('module') || 'fees');
  const [key, setKey] = useState(params.get('key') || 'fee_collection');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const reports = useMemo(() => {
    const all = catalog.data?.reports ?? [];
    const byMod = !moduleId ? all : all.filter((r) => r.module === moduleId);
    const needle = q.trim().toLowerCase();
    if (!needle) return byMod;
    return byMod.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.key.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle),
    );
  }, [catalog.data, moduleId, q]);

  const selected = (catalog.data?.reports ?? []).find((r) => r.key === key);
  const need = new Set(selected?.filters ?? []);

  useEffect(() => {
    if (!reports.length) return;
    if (!reports.some((r) => r.key === key)) setKey(reports[0].key);
  }, [reports, key]);

  const filters: Record<string, string> = {
    ...(need.has('month') ? { month } : {}),
    ...(need.has('gradeId') && gradeId ? { gradeId } : {}),
    ...(need.has('sectionId') && sectionId ? { sectionId } : {}),
    ...(need.has('status') && status ? { status } : {}),
    ...(need.has('paymentMode') && paymentMode ? { paymentMode } : {}),
    ...(need.has('dateFrom') && dateFrom ? { dateFrom } : {}),
    ...(need.has('dateTo') && dateTo ? { dateTo } : {}),
    ...(need.has('academicYearId') && masters.data?.academicYear.id
      ? { academicYearId: masters.data.academicYear.id }
      : {}),
  };

  const preview = useQuery({
    queryKey: ['school-report-preview', key, filters],
    queryFn: () => fetchSchoolReportPreview(key, filters),
    enabled: ready && !!key,
  });

  const sections = (masters.data?.sections ?? []).filter((s) => !gradeId || s.grade.id === gradeId);

  if (moduleId === 'attendance') {
    return (
      <div className="space-y-4 bg-[#f4f7fb] p-4 md:p-6">
        <div className="flex flex-wrap gap-2 print:hidden">
          {(catalog.data?.modules ?? []).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setModuleId(m.id);
                const first = (catalog.data?.reports ?? []).find((r) => r.module === m.id);
                if (first) setKey(first.key);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${
                moduleId === m.id
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <AttendanceReportsDesk />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            Every PDF, Excel and print uses the school report engine — logo, header, filters and
            footer.
          </p>
        </div>
        <ReportExportButtons
          onExport={async (kind) => {
            setNotice(null);
            if (kind === 'preview') {
              const html = await fetchSchoolReportHtml({ key, filters, orientation: 'portrait' });
              setPreviewHtml(html);
              return;
            }
            const mapped = kindToSchoolReportExport(kind);
            await downloadSchoolReport({
              key,
              format: mapped.format,
              orientation: mapped.orientation,
              filters,
              summaryOnly: mapped.summaryOnly,
            });
            if (kind !== 'print') setNotice('Report generated successfully.');
          }}
        />
      </div>

      {notice ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {catalog.error ? (
        <p className="text-sm text-rose-700">{apiErrorMessage(catalog.error)}</p>
      ) : null}

      <WaCard className="flex flex-wrap items-end gap-2 p-3">
        <label className="text-xs text-slate-500">
          Search reports
          <input
            className="mt-1 block h-9 rounded-md border px-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Fee, student, exam…"
          />
        </label>
        {need.has('month') ? (
          <label className="text-xs text-slate-500">
            Month
            <input
              type="month"
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        ) : null}
        {need.has('dateFrom') ? (
          <label className="text-xs text-slate-500">
            From
            <input
              type="date"
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
        ) : null}
        {need.has('dateTo') ? (
          <label className="text-xs text-slate-500">
            To
            <input
              type="date"
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        ) : null}
        {need.has('gradeId') ? (
          <label className="text-xs text-slate-500">
            Class
            <select
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={gradeId}
              onChange={(e) => {
                setGradeId(e.target.value);
                setSectionId('');
              }}
            >
              <option value="">All classes</option>
              {(masters.data?.grades ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {need.has('sectionId') ? (
          <label className="text-xs text-slate-500">
            Section
            <select
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {need.has('paymentMode') ? (
          <label className="text-xs text-slate-500">
            Payment mode
            <select
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="">All</option>
              {['CASH', 'UPI', 'ONLINE', 'BANK', 'CHEQUE', 'CARD'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        ) : null}
        {need.has('status') ? (
          <label className="text-xs text-slate-500">
            Status
            <select
              className="mt-1 block h-9 rounded-md border px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              {['PAID', 'PENDING', 'PARTIAL', 'OVERDUE', 'ACTIVE'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : null}
      </WaCard>

      <div className="flex flex-wrap gap-2">
        {(catalog.data?.modules ?? []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setModuleId(m.id);
              const first = (catalog.data?.reports ?? []).find((r) => r.module === m.id);
              if (first) setKey(first.key);
            }}
            className={`rounded-full border px-3 py-1 text-sm ${
              moduleId === m.id
                ? 'border-blue-700 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <WaCard className="max-h-[70vh] overflow-auto p-2">
          {reports.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setKey(r.key)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                key === r.key ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-slate-500">{r.description}</div>
            </button>
          ))}
        </WaCard>
        <WaCard className="overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{preview.data?.report.title || 'Preview'}</h2>
            <GhostButton onClick={() => void preview.refetch()}>Refresh</GhostButton>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(preview.data?.kpis ?? []).map((k) => (
              <div key={k.label} className="rounded-lg border bg-[#EAF2F8] px-3 py-2">
                <div className="text-[10px] uppercase text-slate-500">{k.label}</div>
                <div className="font-semibold">{String(k.value)}</div>
              </div>
            ))}
          </div>
          {preview.isFetching ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading preview…</p>
          ) : preview.data?.empty ? (
            <p className="py-10 text-center text-sm text-slate-500">
              NO RECORDS FOUND for the selected filters.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#163A63] text-xs text-white">
                  {(preview.data?.columns ?? []).map((c) => (
                    <th key={c.key} className="px-2 py-1">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(preview.data?.rows ?? []).slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {(preview.data?.columns ?? []).map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        {/₹|amount|fee|total|collection|cash|upi/i.test(c.label)
                          ? formatInr(row[c.key]) || String(row[c.key] ?? '—')
                          : String(row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.data?.total ? (
            <p className="mt-2 text-xs text-slate-500">
              Showing {Math.min(50, preview.data.rows.length)} of {preview.data.total} records. Full
              export uses the report engine on the server.
            </p>
          ) : null}
        </WaCard>
      </div>
      {previewHtml ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Report preview</h2>
              <button type="button" onClick={() => setPreviewHtml(null)}>
                ✕
              </button>
            </div>
            <iframe title="Report preview" className="flex-1" srcDoc={previewHtml} />
            <div className="flex justify-end gap-2 border-t p-3">
              <GhostButton onClick={() => setPreviewHtml(null)}>Cancel</GhostButton>
              <GhostButton
                onClick={async () => {
                  await downloadSchoolReport({ key, format: 'pdf', filters });
                  setPreviewHtml(null);
                  setNotice('Report generated successfully.');
                }}
              >
                Download PDF
              </GhostButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
