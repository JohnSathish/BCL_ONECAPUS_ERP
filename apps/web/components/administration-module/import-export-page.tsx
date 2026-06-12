'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  commitPortalUsersImport,
  downloadPortalUsersTemplate,
  fetchImportBatches,
  fetchImportModules,
  validatePortalUsersImport,
} from '@/services/administration';
import { formatDisplayDateTime } from '@/utils/format-date';

export function ImportExportPage() {
  useRequireAuth();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    summary?: { valid: number; invalid: number; total: number };
  } | null>(null);

  const modulesQ = useQuery({ queryKey: ['admin', 'import-modules'], queryFn: fetchImportModules });
  const batchesQ = useQuery({
    queryKey: ['admin', 'import-batches'],
    queryFn: () => fetchImportBatches({ limit: '20' }),
  });

  const validateMut = useMutation({
    mutationFn: validatePortalUsersImport,
    onSuccess: (data) => {
      setBatchId(data.batchId);
      setPreview(data);
    },
  });

  const commitMut = useMutation({
    mutationFn: () => commitPortalUsersImport(batchId!, 'VALID_ONLY'),
    onSuccess: () => batchesQ.refetch(),
  });

  return (
    <DashboardShell role="admin" title="Import / Export">
      <AdminShell>
        <AdminPageHeader
          title="Import / Export Center"
          subtitle="Centralized bulk data operations"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(modulesQ.data ?? []).map((m) => (
            <AdminGlassCard key={m.id} className="p-5">
              <h3 className="font-semibold">{m.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              {m.available ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {m.id === 'PORTAL_USERS' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const blob = await downloadPortalUsersTemplate();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'portal-users-template.xlsx';
                          a.click();
                        }}
                      >
                        Template
                      </Button>
                      <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                        Upload
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) validateMut.mutate(file);
                          }}
                        />
                      </label>
                    </>
                  ) : m.id === 'STUDENT_MASTER' ? (
                    <Link
                      href="/admin/students/import"
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Open import
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Use module-specific import
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-600">Coming soon</p>
              )}
            </AdminGlassCard>
          ))}
        </div>

        {preview?.summary ? (
          <AdminGlassCard className="mt-6 p-4">
            <h3 className="font-semibold">Validation preview</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {preview.summary.valid} valid · {preview.summary.invalid} invalid ·{' '}
              {preview.summary.total} total
            </p>
            {batchId ? (
              <Button
                className="mt-3"
                size="sm"
                onClick={() => commitMut.mutate()}
                disabled={commitMut.isPending || preview.summary.valid === 0}
              >
                Commit valid rows
              </Button>
            ) : null}
          </AdminGlassCard>
        ) : null}

        <AdminGlassCard className="mt-8 overflow-x-auto p-0">
          <h3 className="border-b px-4 py-3 text-sm font-semibold">Recent batches</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(batchesQ.data?.items ?? []).map(
                (b: {
                  id: string;
                  module: string;
                  fileName: string;
                  status: string;
                  totalRows: number;
                  createdAt: string;
                }) => (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="px-4 py-2">{b.module}</td>
                    <td className="px-4 py-2">{b.fileName}</td>
                    <td className="px-4 py-2">{b.status}</td>
                    <td className="px-4 py-2">{b.totalRows}</td>
                    <td className="px-4 py-2 text-xs">{formatDisplayDateTime(b.createdAt)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
