'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import {
  downloadSchoolReport,
  fetchSchoolReportCatalog,
  fetchSchoolReportPreview,
  kindToSchoolReportExport,
} from '@/services/school-reports';
import { GhostButton } from '../academic/academic-ui';
import { WaCard } from '../whatsapp/whatsapp-ui';
import { ReportExportButtons } from './export-buttons';

export function SchoolReportsDesk() {
  const ready = useAuthQueryEnabled();
  const catalog = useQuery({
    queryKey: ['school-report-cat'],
    queryFn: fetchSchoolReportCatalog,
    enabled: ready,
  });
  const [moduleId, setModuleId] = useState('fees');
  const [key, setKey] = useState('fee_monthly');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const reports = useMemo(
    () => (catalog.data?.reports ?? []).filter((r) => !moduleId || r.module === moduleId),
    [catalog.data, moduleId],
  );
  const filters = { month };
  const preview = useQuery({
    queryKey: ['school-report-preview', key, month],
    queryFn: () => fetchSchoolReportPreview(key, filters),
    enabled: ready && !!key,
  });

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            Every PDF and Excel uses the school report engine — logo, header, filters and footer.
          </p>
        </div>
        <ReportExportButtons
          onExport={async (kind) => {
            setNotice(null);
            await downloadSchoolReport({
              key,
              ...kindToSchoolReportExport(kind),
              filters,
            });
            if (kind !== 'print') setNotice('Report generated successfully.');
          }}
        />
      </div>
      <label className="text-sm text-slate-600">
        Month
        <input
          type="month"
          className="ml-2 rounded border px-2 py-1"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      {notice ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {catalog.error ? (
        <p className="text-sm text-rose-700">{apiErrorMessage(catalog.error)}</p>
      ) : null}

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
          {preview.data?.empty ? (
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
                        {String(row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </WaCard>
      </div>
    </div>
  );
}
