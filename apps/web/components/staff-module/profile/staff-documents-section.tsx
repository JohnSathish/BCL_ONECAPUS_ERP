'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  RotateCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';

import {
  STAFF_DOCUMENT_CATEGORIES,
  staffDocumentLabel,
} from '@/components/staff-module/constants/staff-document-catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  deleteStaffDocument,
  fetchStaffDocumentAudit,
  fetchStaffDocumentCompliance,
  downloadStaffDocumentsZip,
  uploadStaffDocument,
  verifyStaffDocument,
} from '@/services/staff';
import type { StaffDocumentCompliance, StaffDocumentSlotRow } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

const STATUS_CFG = {
  VERIFIED: {
    label: 'Verified',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
  MISSING: {
    label: 'Missing',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-300',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    dot: 'bg-neutral-400',
  },
} as const;

function complianceTone(score: number) {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CFG }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function UploadDropzone({
  documentType,
  disabled,
  onUpload,
  loading,
}: {
  documentType: string;
  disabled?: boolean;
  onUpload: (file: File) => void;
  loading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
        disabled && 'opacity-50 pointer-events-none',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <Upload className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <p className="text-muted-foreground">Drag file here or</p>
      <button
        type="button"
        className="mt-1 font-medium text-primary hover:underline"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? 'Uploading…' : 'Browse files'}
      </button>
      <p className="mt-1 text-[10px] text-muted-foreground">PDF, JPG, PNG, DOCX · max 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input type="hidden" value={documentType} readOnly />
    </div>
  );
}

function PreviewPanel({
  slot,
  onClose,
}: {
  slot: StaffDocumentSlotRow | null;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  if (!slot?.document) return null;
  const url = resolveUploadAssetUrl(slot.document.fileUrl);
  const isPdf =
    slot.document.mimeType?.includes('pdf') ||
    slot.document.fileName?.toLowerCase().endsWith('.pdf');

  return (
    <div className="sticky top-20 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Document Preview</h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p className="mb-2 text-xs font-medium">{slot.label}</p>
      <div className="mb-3 max-h-[420px] overflow-auto rounded-lg border bg-muted/30">
        {isPdf ? (
          <iframe title="preview" src={url} className="h-[380px] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={slot.label}
            className="mx-auto max-h-[380px] object-contain transition-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!isPdf && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setRotation((r) => r + 90)}
          >
            <RotateCw className="mr-1 h-3 w-3" /> Rotate
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
          <a href={url} download target="_blank" rel="noreferrer">
            <Download className="mr-1 h-3 w-3" /> Download
          </a>
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <Eye className="mr-1 h-3 w-3" /> Print
          </a>
        </Button>
      </div>
    </div>
  );
}

export function StaffDocumentsSection({
  staffId,
  canEdit,
  onRefresh,
}: {
  staffId: string;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [uploadCode, setUploadCode] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const complianceQ = useQuery({
    queryKey: ['staff', staffId, 'documents', 'compliance'],
    queryFn: () => fetchStaffDocumentCompliance(staffId),
  });
  const auditQ = useQuery({
    queryKey: ['staff', staffId, 'documents', 'audit'],
    queryFn: () => fetchStaffDocumentAudit(staffId),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['staff', staffId, 'documents'] });
    onRefresh();
  }, [qc, staffId, onRefresh]);

  const uploadMut = useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      uploadStaffDocument(staffId, documentType, file),
    onSuccess: () => {
      setUploadCode(null);
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Upload failed')),
  });

  const verifyMut = useMutation({
    mutationFn: ({ docId, status, remarks }: { docId: string; status: string; remarks?: string }) =>
      verifyStaffDocument(staffId, docId, status, remarks),
    onSuccess: () => {
      setRejectDocId(null);
      setRejectNotes('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Verification failed')),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: string) => deleteStaffDocument(staffId, docId),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Delete failed')),
  });

  const data = complianceQ.data;
  const previewSlot = useMemo(
    () => data?.slots.find((s) => s.code === previewCode) ?? null,
    [data, previewCode],
  );

  const slotsByCategory = useMemo(() => {
    const map = new Map<string, StaffDocumentSlotRow[]>();
    for (const cat of STAFF_DOCUMENT_CATEGORIES) map.set(cat.key, []);
    for (const slot of data?.slots ?? []) {
      const list = map.get(slot.category) ?? [];
      list.push(slot);
      map.set(slot.category, list);
    }
    return map;
  }, [data]);

  if (complianceQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">Could not load document compliance data.</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Compliance dashboard */}
      <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Documents & Compliance</h2>
            <p className="text-xs text-muted-foreground">
              Digital employee service book & audit-ready repository
            </p>
          </div>
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-center',
              complianceTone(data.complianceScore),
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide">Compliance Score</p>
            <p className="text-2xl font-bold tabular-nums">{data.complianceScore}%</p>
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Total Slots', value: data.totalSlots },
            { label: 'Uploaded', value: data.uploaded },
            { label: 'Pending', value: data.pending },
            { label: 'Verified', value: data.verified },
            { label: 'Expiring Soon', value: data.expiredSoon },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Document Completion</span>
            <span className="tabular-nums text-muted-foreground">{data.completionPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.completionPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => downloadStaffDocumentsZip(staffId, false)}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> All Documents ZIP
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => downloadStaffDocumentsZip(staffId, true)}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Verified ZIP
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* Missing tracker */}
          {data.missing.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-900">
                Missing Documents ({data.missing.length})
              </h3>
              <ul className="grid gap-1 sm:grid-cols-2 text-xs text-amber-800">
                {data.missing.slice(0, 12).map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <span className="text-amber-500">□</span>
                    {m}
                  </li>
                ))}
              </ul>
              {data.missing.length > 12 && (
                <p className="mt-1 text-[10px] text-amber-700">+{data.missing.length - 12} more</p>
              )}
            </div>
          )}

          {/* Category tables */}
          {STAFF_DOCUMENT_CATEGORIES.map((cat) => {
            const rows = slotsByCategory.get(cat.key) ?? [];
            if (!rows.length) return null;
            return (
              <div key={cat.key} className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b bg-muted/40 px-4 py-2">
                  <h3 className="text-sm font-semibold">{cat.label}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Document</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Uploaded On</th>
                        <th className="px-3 py-2 font-medium">Verified By</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.code} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{row.label}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {row.document?.createdAt
                              ? formatDisplayDate(row.document.createdAt)
                              : '—'}
                          </td>
                          <td className="px-3 py-2">{row.document?.verifiedByName ?? '—'}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {row.document ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => setPreviewCode(row.code)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                                    <a
                                      href={resolveUploadAssetUrl(row.document.fileUrl)}
                                      download
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                  {canEdit && row.status === 'PENDING' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-emerald-700"
                                      disabled={verifyMut.isPending}
                                      onClick={() =>
                                        verifyMut.mutate({
                                          docId: row.document!.id,
                                          status: 'VERIFIED',
                                        })
                                      }
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {canEdit && row.status === 'PENDING' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-red-600"
                                      onClick={() => setRejectDocId(row.document!.id)}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-destructive"
                                      onClick={() => deleteMut.mutate(row.document!.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </>
                              ) : canEdit ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() =>
                                    setUploadCode(uploadCode === row.code ? null : row.code)
                                  }
                                >
                                  Upload
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canEdit && rows.some((r) => uploadCode === r.code) && (
                  <div className="border-t p-3">
                    <UploadDropzone
                      documentType={uploadCode!}
                      loading={uploadMut.isPending}
                      onUpload={(file) => uploadMut.mutate({ file, documentType: uploadCode! })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {previewSlot ? (
            <PreviewPanel slot={previewSlot} onClose={() => setPreviewCode(null)} />
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Select View on a document to preview here
            </div>
          )}

          {/* Audit trail */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Audit Trail
            </h3>
            {!auditQ.data?.length ? (
              <p className="text-xs text-muted-foreground">No document activity yet.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto text-xs">
                {auditQ.data.map((entry) => (
                  <li key={entry.id} className="rounded-lg border px-2 py-1.5">
                    <p className="font-medium">{formatDisplayDate(entry.createdAt)}</p>
                    <p className="text-muted-foreground">
                      {entry.action.replace('staff.document_', '').replace(/_/g, ' ')}
                      {entry.metadata?.documentType
                        ? ` · ${staffDocumentLabel(String(entry.metadata.documentType))}`
                        : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.user?.displayName ?? entry.user?.email ?? 'System'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {rejectDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-4 shadow-lg">
            <h3 className="mb-2 font-semibold">Reject Document</h3>
            <Input
              placeholder="Reason (e.g. Blurred copy — upload fresh scan)"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="mb-3"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectDocId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectNotes.trim() || verifyMut.isPending}
                onClick={() =>
                  verifyMut.mutate({
                    docId: rejectDocId,
                    status: 'REJECTED',
                    remarks: rejectNotes.trim(),
                  })
                }
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
