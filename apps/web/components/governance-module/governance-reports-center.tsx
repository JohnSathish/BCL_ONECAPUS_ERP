'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { exportGovernanceReport, fetchGovernanceReport } from '@/services/governance';
import type { GovernanceReportDefinition } from '@/types/governance';
import { downloadBlob } from '@/utils/download-blob';

const REPORTS: GovernanceReportDefinition[] = [
  {
    id: 'committee-summary',
    label: 'Committee-wise summary',
    description: 'Active committees, members, meetings',
    category: 'Committees',
  },
  {
    id: 'meeting-register',
    label: 'Meeting register',
    description: 'Scheduled and completed meetings',
    category: 'Meetings',
  },
  {
    id: 'attendance',
    label: 'Attendance report',
    description: 'Meeting-wise attendance register',
    category: 'Meetings',
  },
  {
    id: 'atr-status',
    label: 'ATR status report',
    description: 'Pending and completed action items',
    category: 'ATR',
  },
  {
    id: 'task-completion',
    label: 'Task completion',
    description: 'Committee tasks and overdue items',
    category: 'Tasks',
  },
  {
    id: 'activity',
    label: 'Activity report',
    description: 'Events and activities by committee',
    category: 'Events',
  },
  {
    id: 'member-participation',
    label: 'Member participation',
    description: 'Attendance and task participation',
    category: 'Members',
  },
  {
    id: 'naac-evidence-index',
    label: 'NAAC evidence index',
    description: 'Criterion-wise evidence listing',
    category: 'NAAC',
  },
];

const CATEGORIES = [...new Set(REPORTS.map((r) => r.category))];

function formatCell(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN');
  }
  return String(value);
}

export function GovernanceReportsCenter() {
  const enabled = useAuthQueryEnabled();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [activeReport, setActiveReport] = useState(REPORTS[0].id);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REPORTS.filter(
      (r) =>
        r.category === category &&
        (!q || r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
    );
  }, [category, search]);

  const reportDef = REPORTS.find((r) => r.id === activeReport) ?? REPORTS[0];
  const params = {
    from: from || undefined,
    to: to || undefined,
    academicYear: academicYear || undefined,
  };

  const previewQ = useQuery({
    queryKey: ['governance', 'reports', activeReport, params],
    queryFn: () => fetchGovernanceReport(activeReport, params),
    enabled,
  });

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    setExporting(format);
    try {
      const data = await exportGovernanceReport(activeReport, format, params);
      if (format === 'csv') {
        downloadBlob(new Blob([String(data)], { type: 'text/csv' }), `${activeReport}.csv`);
      } else {
        downloadBlob(data as Blob, `${activeReport}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      }
    } catch {
      window.alert('Export failed. Ensure the governance API is available.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Governance Reports Center</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Export committee registers, meeting attendance, ATR status, activities, and NAAC evidence
          packs.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search reports…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-2.5 py-1 text-xs ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              {filtered.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setActiveReport(report.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    activeReport === report.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="font-medium">{report.label}</p>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{reportDef.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{reportDef.description}</p>
              </div>
              <Badge variant="outline">{reportDef.category}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div>
                  <Label>Academic year</Label>
                  <Input
                    placeholder="2025-26"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!!exporting}
                  onClick={() => handleExport('csv')}
                >
                  {exporting === 'csv' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={!!exporting}
                  onClick={() => handleExport('xlsx')}
                >
                  {exporting === 'xlsx' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  disabled={!!exporting}
                  onClick={() => handleExport('pdf')}
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview…
                </div>
              ) : previewQ.isError ? (
                <p className="text-sm text-muted-foreground">
                  Preview unavailable until governance reports API is connected.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        {(previewQ.data?.columns ?? []).map((col) => (
                          <th key={col} className="px-2 py-2 font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(previewQ.data?.rows ?? []).slice(0, 25).map((row, i) => (
                        <tr key={i} className="border-b">
                          {(previewQ.data?.columns ?? []).map((col) => (
                            <td key={col} className="px-2 py-2">
                              {formatCell(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!previewQ.data?.rows?.length ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No rows for selected filters.
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
