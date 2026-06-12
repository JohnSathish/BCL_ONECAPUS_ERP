'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import {
  STAFF_DOCUMENT_CATEGORIES,
  STAFF_SELF_UPLOAD_DOC_TYPES,
  staffDocumentLabel,
} from '@/components/staff-module/constants/staff-document-catalog';
import { Button } from '@/components/ui/button';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { useMyDocuments } from '@/components/staff-portal/hooks/use-staff-dashboard';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { fetchMyDocumentCompliance, uploadMyDocument } from '@/services/staff-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

export function StaffPortalDocumentsPage() {
  useRequireStaffPortal();
  const qc = useQueryClient();
  const docsQ = useMyDocuments();
  const complianceQ = useQuery({
    queryKey: ['staff-portal', 'documents', 'compliance'],
    queryFn: fetchMyDocumentCompliance,
  });

  const uploadMut = useMutation({
    mutationFn: ({ documentType, file }: { documentType: string; file: File }) =>
      uploadMyDocument(documentType, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-portal', 'documents'] });
      qc.invalidateQueries({ queryKey: ['staff-portal', 'documents', 'compliance'] });
    },
  });

  const score = complianceQ.data?.complianceScore ?? 0;

  return (
    <DashboardShell role="staff" title="Documents">
      <ErpWorkspace className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">My Documents</h2>
              <p className="text-sm text-muted-foreground">Upload documents for HR verification</p>
            </div>
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-center text-sm font-bold',
                score >= 80
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : score >= 50
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              Compliance {score}%
            </div>
          </div>

          {!docsQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {docsQ.data.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{staffDocumentLabel(doc.documentType)}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.fileName ?? doc.documentType}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Status: {doc.verificationStatus ?? 'PENDING'}
                      {doc.createdAt ? ` · ${formatDisplayDate(doc.createdAt)}` : ''}
                    </p>
                  </div>
                  <a
                    href={resolveUploadAssetUrl(doc.fileUrl)}
                    className="text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Upload a document</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              HR will verify Aadhaar, PAN, certificates, and bank documents before approval.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STAFF_SELF_UPLOAD_DOC_TYPES.slice(0, 12).map((code) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <span>{staffDocumentLabel(code)}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMut.mutate({ documentType: code, file });
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] pointer-events-none"
                    asChild
                  >
                    <span>{uploadMut.isPending ? '…' : 'Upload'}</span>
                  </Button>
                </label>
              ))}
            </div>
            {uploadMut.error && (
              <p className="mt-2 text-xs text-red-600">
                {apiErrorMessage(uploadMut.error, 'Upload failed')}
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="font-semibold">Document Categories</h3>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {STAFF_DOCUMENT_CATEGORIES.map((c) => (
              <li key={c.key}>· {c.label}</li>
            ))}
          </ul>
          {complianceQ.data?.missing?.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                Missing ({complianceQ.data.missing.length})
              </p>
              <ul className="mt-1 max-h-32 overflow-auto text-[10px] text-amber-800">
                {complianceQ.data.missing.slice(0, 8).map((m: string) => (
                  <li key={m}>□ {m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
