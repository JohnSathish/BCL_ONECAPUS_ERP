'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  bulkGenerateRollNumbers,
  fetchRollNumberDataCleanup,
  fetchRollNumberHistory,
} from '@/services/roll-number';

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const body = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RollNumberReportsPage() {
  useRequireAuth();

  const cleanupQ = useQuery({
    queryKey: ['admin', 'roll-number-cleanup'],
    queryFn: fetchRollNumberDataCleanup,
  });
  const historyQ = useQuery({
    queryKey: ['admin', 'roll-number-history'],
    queryFn: fetchRollNumberHistory,
  });

  const exportIneligible = async () => {
    const result = await bulkGenerateRollNumbers({ dryRun: true });
    const blocked = result.preview.filter((r) => r.generationStatus === 'BLOCKED');
    exportCsv(
      'roll-number-ineligible.csv',
      ['Name', 'Application', 'Programme', 'Department', 'Status', 'Remarks'],
      blocked.map((r) => [
        r.fullName ?? '',
        r.applicationNumber ?? '',
        r.programme ?? '',
        r.department ?? '',
        r.generationStatus,
        r.remarks.join('; '),
      ]),
    );
  };

  const exportEligible = async () => {
    const result = await bulkGenerateRollNumbers({ dryRun: true });
    const ready = result.preview.filter((r) => r.generationStatus === 'READY');
    exportCsv(
      'roll-number-eligible.csv',
      ['Name', 'Application', 'Programme', 'Department', 'New Roll', 'Status'],
      ready.map((r) => [
        r.fullName ?? '',
        r.applicationNumber ?? '',
        r.programme ?? '',
        r.department ?? '',
        r.newRollNumber ?? '',
        r.generationStatus,
      ]),
    );
  };

  const exportHistory = () => {
    exportCsv(
      'roll-number-generation-history.csv',
      ['Batch', 'Date', 'User', 'Year', 'Students', 'First Roll', 'Last Roll'],
      (historyQ.data ?? []).map((b) => [
        String(b.batchNumber),
        new Date(b.generatedAt).toISOString(),
        b.generatedBy,
        String(b.admissionYear ?? ''),
        String(b.studentsProcessed),
        b.firstRollNumber ?? '',
        b.lastRollNumber ?? '',
      ]),
    );
  };

  return (
    <DashboardShell role="admin" title="Roll Number Reports">
      <AdminShell>
        <AdminPageHeader
          title="Roll Number Reports"
          subtitle="Export eligibility, validation, and generation reports for office records and NAAC documentation."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Generation Reports</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Export lists from the current validation engine (preview dry-run).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportEligible}>
                <Download className="mr-1 h-3 w-3" />
                Eligible Students (CSV)
              </Button>
              <Button size="sm" variant="outline" onClick={exportIneligible}>
                <Download className="mr-1 h-3 w-3" />
                Ineligible Students (CSV)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportHistory}
                disabled={!historyQ.data?.length}
              >
                <FileSpreadsheet className="mr-1 h-3 w-3" />
                Generation History (CSV)
              </Button>
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Data Quality Summary</h2>
            {cleanupQ.data ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Test records</dt>
                  <dd className="font-semibold">{cleanupQ.data.totals.testRecords}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Missing programmes</dt>
                  <dd className="font-semibold">{cleanupQ.data.totals.missingProgrammes}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Missing departments</dt>
                  <dd className="font-semibold">{cleanupQ.data.totals.missingDepartments}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duplicate roll numbers</dt>
                  <dd className="font-semibold">{cleanupQ.data.totals.duplicateRollNumbers}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Loading scan…</p>
            )}
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
