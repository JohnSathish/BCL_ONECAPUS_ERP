'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { STAFF_DOCUMENT_CATEGORIES } from '@/components/staff-module/constants/staff-document-catalog';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { fetchMyStaffDocumentCompliance, uploadMyStaffDocument } from '@/services/staff';
import type { StaffDocumentSlotRow } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STATUS_CFG = {
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  MISSING: 'bg-slate-100 text-slate-600',
  EXPIRED: 'bg-neutral-100 text-neutral-600',
} as const;

export function StaffPortalDocumentsPage() {
  useRequireStaffPortal();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [uploadCode, setUploadCode] = useState<string | null>(null);

  const complianceQ = useQuery({
    queryKey: ['staff', 'me', 'documents', 'compliance'],
    queryFn: fetchMyStaffDocumentCompliance,
  });

  const uploadMut = useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      uploadMyStaffDocument(documentType, file),
    onSuccess: () => {
      setUploadCode(null);
      setError('');
      qc.invalidateQueries({ queryKey: ['staff', 'me', 'documents'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Upload failed')),
  });

  const selfUploadSlots = useMemo(
    () => (complianceQ.data?.slots ?? []).filter((s) => s.staffSelfUpload),
    [complianceQ.data],
  );

  const uploaded = useMemo(
    () => (complianceQ.data?.slots ?? []).filter((s) => s.document),
    [complianceQ.data],
  );

  return (
    <DashboardShell role="staff" title="Documents">
      <ErpWorkspace className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <GlassCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">My Documents</h2>
              <p className="text-sm text-muted-foreground">
                Upload identity and qualification documents for HR verification.
              </p>
            </div>
            {complianceQ.data && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">Compliance</p>
                <p className="text-xl font-bold">{complianceQ.data.complianceScore}%</p>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h3 className="font-semibold">Self-upload documents</h3>
            <p className="mt-1 text-xs text-muted-foreground">HR will verify before approval.</p>
            <ul className="mt-4 space-y-2">
              {selfUploadSlots.map((slot) => (
                <SelfUploadRow
                  key={slot.code}
                  slot={slot}
                  uploadCode={uploadCode}
                  loading={uploadMut.isPending}
                  onToggle={() => setUploadCode(uploadCode === slot.code ? null : slot.code)}
                  onUpload={(file) => uploadMut.mutate({ file, documentType: slot.code })}
                />
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="font-semibold">Uploaded files</h3>
            {!uploaded.length ? (
              <p className="mt-4 text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {uploaded.map((slot) => (
                  <li
                    key={slot.code}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{slot.label}</p>
                      <span
                        className={cn(
                          'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold',
                          STATUS_CFG[slot.status],
                        )}
                      >
                        {slot.status}
                      </span>
                    </div>
                    {slot.document && (
                      <a
                        href={resolveUploadAssetUrl(slot.document.fileUrl)}
                        className="text-xs text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        <GlassCard className="p-6">
          <h3 className="font-semibold">Document categories</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
            {STAFF_DOCUMENT_CATEGORIES.map((c) => (
              <li key={c.key}>· {c.label}</li>
            ))}
          </ul>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}

function SelfUploadRow({
  slot,
  uploadCode,
  loading,
  onToggle,
  onUpload,
}: {
  slot: StaffDocumentSlotRow;
  uploadCode: string | null;
  loading: boolean;
  onToggle: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <li className="rounded-lg border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>{slot.label}</span>
        <span
          className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_CFG[slot.status])}
        >
          {slot.status}
        </span>
      </div>
      {slot.status === 'MISSING' || slot.status === 'REJECTED' ? (
        <div className="mt-2">
          {uploadCode === slot.code ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-primary hover:underline">
              {loading ? 'Uploading…' : 'Choose file'}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
            </label>
          ) : (
            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={onToggle}>
              Upload
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
