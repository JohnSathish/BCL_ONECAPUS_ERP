'use client';

import { useState } from 'react';
import { GhostButton } from '../academic/academic-ui';

export function ReportExportButtons({
  busyLabel,
  onExport,
}: {
  busyLabel?: string;
  onExport: (kind: 'pdf-portrait' | 'pdf-landscape' | 'xlsx' | 'print') => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (kind: 'pdf-portrait' | 'pdf-landscape' | 'xlsx' | 'print', label: string) => {
    setError(null);
    setBusy(label);
    try {
      await onExport(kind);
    } catch {
      setError('Unable to generate the report. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <GhostButton disabled={!!busy} onClick={() => void run('pdf-portrait', 'Generating PDF...')}>
        PDF
      </GhostButton>
      <GhostButton disabled={!!busy} onClick={() => void run('pdf-landscape', 'Generating PDF...')}>
        PDF landscape
      </GhostButton>
      <GhostButton disabled={!!busy} onClick={() => void run('xlsx', 'Preparing Excel report...')}>
        Excel
      </GhostButton>
      <GhostButton disabled={!!busy} onClick={() => void run('print', 'Preparing print...')}>
        Print
      </GhostButton>
      {busy ? <span className="text-sm text-slate-500">{busyLabel || busy}</span> : null}
      {error ? <span className="text-sm text-rose-700">{error}</span> : null}
    </div>
  );
}
