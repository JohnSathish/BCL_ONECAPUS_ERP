'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, UploadCloud } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { bulkUploadAbcIds, downloadAbcUploadTemplate, fetchAbcCoverage } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function parseCsv(text: string): Array<{ rollNumber: string; abcId: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('roll') && header.includes('abc');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const [rollNumber, abcId] = line.split(/[,;\t]/).map((c) => c.trim());
      return { rollNumber: rollNumber ?? '', abcId: abcId ?? '' };
    })
    .filter((r) => r.rollNumber && r.abcId);
}

export function AbcIdBulkUploadPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Array<{ rollNumber: string; message: string }>>([]);

  const coverage = useQuery({
    queryKey: ['students', 'abc', 'coverage'],
    queryFn: fetchAbcCoverage,
    enabled: Boolean(session) && perms.canRead,
  });

  const uploadMut = useMutation({
    mutationFn: bulkUploadAbcIds,
    onSuccess: (res) => {
      setMessage(`Updated ${res.updated} of ${res.total} row(s).`);
      setErrors(res.errors ?? []);
      void coverage.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Upload failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Upload ABC IDs">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 text-xs')}
        >
          ← Student directory
        </Link>
        <Link
          href="/admin/students/reports"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
        >
          ABC coverage report
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CompactCard>
          <CompactCardHeader
            title="ABC Coverage"
            description="Institution-wide Academic Bank of Credits ID status"
          />
          <CompactCardBody className="space-y-2 text-sm">
            {coverage.isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : coverage.data ? (
              <>
                <p>
                  Total students:{' '}
                  <strong>{coverage.data.totalStudents.toLocaleString('en-IN')}</strong>
                </p>
                <p>
                  ABC available: <strong>{coverage.data.withAbcId.toLocaleString('en-IN')}</strong>
                </p>
                <p>
                  Missing ABC: <strong>{coverage.data.missingAbcId.toLocaleString('en-IN')}</strong>
                </p>
                <p>
                  Coverage: <strong>{coverage.data.coveragePct}%</strong>
                </p>
              </>
            ) : null}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Upload ABC IDs"
            description="Map college roll numbers to ABC IDs received later from students or UGC"
          />
          <CompactCardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void downloadAbcUploadTemplate()}
              >
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Download the Excel template, fill Roll Number and ABC ID, then save as CSV for upload.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center hover:bg-muted/30">
              <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Choose CSV or Excel file</span>
              <span className="mt-1 text-xs text-muted-foreground">Roll Number, ABC ID</span>
              <input
                type="file"
                accept=".csv,.txt"
                className="sr-only"
                disabled={!perms.canManage || uploadMut.isPending}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setMessage('');
                  setErrors([]);
                  try {
                    const rows = parseCsv(await file.text());
                    if (rows.length === 0) {
                      setMessage('No valid rows found. Use columns: Roll Number, ABC ID');
                      return;
                    }
                    uploadMut.mutate(rows);
                  } catch (err) {
                    setMessage(apiErrorMessage(err, 'Could not read file'));
                  }
                }}
              />
            </label>
            {message ? <p className="text-sm">{message}</p> : null}
            {errors.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-2 text-xs">
                {errors.slice(0, 20).map((err) => (
                  <p key={`${err.rollNumber}-${err.message}`} className="text-destructive">
                    {err.rollNumber}: {err.message}
                  </p>
                ))}
                {errors.length > 20 ? (
                  <p className="text-muted-foreground">…and {errors.length - 20} more</p>
                ) : null}
              </div>
            ) : null}
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}
