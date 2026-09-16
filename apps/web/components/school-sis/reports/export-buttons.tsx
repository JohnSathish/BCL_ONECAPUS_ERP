'use client';

import { useState } from 'react';
import { GhostButton } from '../academic/academic-ui';

export type ReportExportKind =
  | 'pdf-portrait'
  | 'pdf-landscape'
  | 'xlsx'
  | 'xlsx-summary'
  | 'print'
  | 'preview';

export function ReportExportButtons({
  onExport,
}: {
  onExport: (kind: ReportExportKind) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<'pdf' | 'xlsx' | null>(null);

  const run = async (kind: ReportExportKind, label: string) => {
    setError(null);
    setBusy(label);
    setOpen(null);
    try {
      await onExport(kind);
    } catch {
      setError('Unable to generate the report. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2 print:hidden">
      <div className="relative">
        <GhostButton disabled={!!busy} onClick={() => setOpen(open === 'pdf' ? null : 'pdf')}>
          Export PDF ▾
        </GhostButton>
        {open === 'pdf' ? (
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white p-1 shadow-md">
            <button
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => void run('pdf-portrait', 'Generating PDF...')}
            >
              Portrait
            </button>
            <button
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => void run('pdf-landscape', 'Generating PDF...')}
            >
              Landscape
            </button>
            <button
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => void run('preview', 'Preparing preview...')}
            >
              Preview
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <GhostButton disabled={!!busy} onClick={() => setOpen(open === 'xlsx' ? null : 'xlsx')}>
          Export Excel ▾
        </GhostButton>
        {open === 'xlsx' ? (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white p-1 shadow-md">
            <button
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => void run('xlsx', 'Preparing Excel report...')}
            >
              Complete report
            </button>
            <button
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => void run('xlsx-summary', 'Preparing Excel report...')}
            >
              Summary only
            </button>
          </div>
        ) : null}
      </div>
      <GhostButton disabled={!!busy} onClick={() => void run('print', 'Preparing print...')}>
        Print
      </GhostButton>
      {busy ? <span className="text-sm text-slate-500">{busy}</span> : null}
      {error ? <span className="text-sm text-rose-700">{error}</span> : null}
    </div>
  );
}
