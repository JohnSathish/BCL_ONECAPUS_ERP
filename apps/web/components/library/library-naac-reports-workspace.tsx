'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, FileSpreadsheet, FileText, Link2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadLibraryNaacReport,
  fetchLibraryNaacReportSummary,
  linkLibraryNaacEvidence,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

const currentYear = new Date().getFullYear();
const defaultFrom = `${currentYear}-01-01`;
const defaultTo = new Date().toISOString().slice(0, 10);
const defaultAy = `${currentYear - 1}-${String(currentYear).slice(2)}`;

export function LibraryNaacReportsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [academicYear, setAcademicYear] = useState(defaultAy);
  const [metricCode, setMetricCode] = useState('4.2.1');
  const [message, setMessage] = useState('');

  const summary = useQuery({
    queryKey: ['library', 'naac-reports', from, to],
    queryFn: () => fetchLibraryNaacReportSummary({ from, to, academicYear }),
    enabled,
  });

  const exportMut = useMutation({
    mutationFn: async (format: 'pdf' | 'xlsx' | 'csv') => {
      const blob = await downloadLibraryNaacReport(format, { from, to, academicYear });
      const ext = format === 'csv' ? 'zip' : format;
      downloadBlob(blob, `library-naac-${to}.${ext}`);
    },
    onSuccess: (_, format) => setMessage(`Downloaded ${format.toUpperCase()} bundle`),
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const linkMut = useMutation({
    mutationFn: () =>
      linkLibraryNaacEvidence({
        academicYear,
        from,
        to,
        criterion: 4,
        metricCode,
        format: 'pdf',
        evidenceNotes: `Smart Library NAAC bundle ${from} to ${to}`,
      }),
    onSuccess: (r) =>
      setMessage(`Linked to IQAC evidence repository (tag ${r.tag.id.slice(0, 8)}…)`),
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const b = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">NAAC Library Reports</h1>
          <p className="text-sm text-muted-foreground">
            Audit-ready bundle for Criterion 4 — footfall, acquisitions, usage, e-resources, and
            reading statistics
          </p>
        </div>
        <Link
          href="/admin/naac/evidence"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          IQAC Evidence Repository
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section className="flex flex-wrap gap-2 rounded-xl border p-4">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Input
          placeholder="Academic year e.g. 2025-26"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="w-36"
        />
        <Input
          placeholder="Metric code"
          value={metricCode}
          onChange={(e) => setMetricCode(e.target.value)}
          className="w-28"
        />
      </section>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button disabled={exportMut.isPending} onClick={() => exportMut.mutate('pdf')}>
          <FileText className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          disabled={exportMut.isPending}
          onClick={() => exportMut.mutate('xlsx')}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
        <Button
          variant="outline"
          disabled={exportMut.isPending}
          onClick={() => exportMut.mutate('csv')}
        >
          Export CSV (ZIP)
        </Button>
        <Button
          variant="secondary"
          disabled={linkMut.isPending || !academicYear.trim()}
          onClick={() => linkMut.mutate()}
        >
          <Link2 className="mr-2 h-4 w-4" />
          Link PDF to IQAC Evidence
        </Button>
      </div>

      {summary.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading report preview…</p>
      ) : null}

      {b ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">Collection summary</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Titles</dt>
                <dd className="font-semibold">{b.summary.totalTitles.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Copies</dt>
                <dd className="font-semibold">{b.summary.totalCopies.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Digital assets</dt>
                <dd className="font-semibold">{b.summary.digitalAssets}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Active loans</dt>
                <dd className="font-semibold">{b.summary.activeLoans}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">
              Footfall ({b.period.from} – {b.period.to})
            </h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Total visits</dt>
                <dd className="font-semibold">{b.footfall.totalVisits}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Male / Female</dt>
                <dd className="font-semibold">
                  {b.footfall.male} / {b.footfall.female}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peak hour</dt>
                <dd className="font-semibold">
                  {b.footfall.peakHour}:00 ({b.footfall.peakCount} visits)
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border p-4 lg:col-span-2">
            <h2 className="text-sm font-medium">Department usage</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Department</th>
                    <th className="p-2">Visits</th>
                    <th className="p-2">Issues</th>
                    <th className="p-2">Readers</th>
                  </tr>
                </thead>
                <tbody>
                  {b.departmentUsage.slice(0, 15).map((row) => (
                    <tr key={row.departmentName} className="border-b">
                      <td className="p-2">{row.departmentName}</td>
                      <td className="p-2">{row.visits}</td>
                      <td className="p-2">{row.issues}</td>
                      <td className="p-2">{row.uniqueReaders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">E-resources</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Downloads: {b.eResourceUsage.digitalDownloads}</li>
              <li>Views: {b.eResourceUsage.digitalViews}</li>
              <li>Research access: {b.eResourceUsage.researchAccess}</li>
            </ul>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">Journals</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Print journal titles: {b.journalSubscriptions.printJournalTitles}</li>
              <li>Digital journal assets: {b.journalSubscriptions.digitalJournalAssets}</li>
              <li>E-journal downloads: {b.journalSubscriptions.eJournalDownloads}</li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
