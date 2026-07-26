'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Mail,
  Package,
  Phone,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadRecruitmentApplicationPdf,
  downloadRecruitmentApplicationZip,
  fetchRecruitmentApplication,
  fetchRecruitmentApplicationDocuments,
  regenerateRecruitmentApplicationPdf,
} from '@/services/hr';
import { PUBLIC_STATUS_STEPS } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { downloadBlob } from '@/utils/download-blob';

const STATUS_ORDER = [
  'SUBMITTED',
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'OFFERED',
  'APPOINTED',
  'HIRED',
];

type TabId = 'info' | 'pdf' | 'docs' | 'timeline';

export function HrRecruitmentApplicationDetail({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('info');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const appQ = useQuery({
    queryKey: ['hr', 'recruitment', 'application', applicationId],
    queryFn: () => fetchRecruitmentApplication(applicationId!),
    enabled: enabled && open && Boolean(applicationId),
  });
  const docsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'application-docs', applicationId],
    queryFn: () => fetchRecruitmentApplicationDocuments(applicationId!),
    enabled: enabled && open && Boolean(applicationId),
  });

  const regenerateMut = useMutation({
    mutationFn: () => regenerateRecruitmentApplicationPdf(applicationId!),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['hr', 'recruitment', 'application', applicationId],
      });
      await qc.invalidateQueries({
        queryKey: ['hr', 'recruitment', 'application-docs', applicationId],
      });
    },
  });

  const app = appQ.data;
  const statusIdx = app ? STATUS_ORDER.indexOf(app.status) : -1;
  const details = (app?.applicationDetailsJson ?? {}) as Record<string, any>;
  const pdfUrl = app?.applicationPdfUrl ? resolveUploadAssetUrl(app.applicationPdfUrl) : null;

  const tabs = useMemo(
    () =>
      [
        { id: 'info' as const, label: 'Candidate' },
        { id: 'pdf' as const, label: 'Application PDF' },
        { id: 'docs' as const, label: 'Documents' },
        { id: 'timeline' as const, label: 'Timeline' },
      ] as const,
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-y-0 right-0 left-auto top-0 flex h-full w-full max-w-2xl translate-x-0 translate-y-0 flex-col rounded-none border-l p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{app?.fullName ?? 'Candidate Profile'}</DialogTitle>
          {app?.applicationNo ? (
            <p className="font-mono text-xs text-muted-foreground">{app.applicationNo}</p>
          ) : null}
        </DialogHeader>

        {app ? (
          <div className="flex flex-wrap gap-2 border-b px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActionError('');
                void downloadRecruitmentApplicationPdf(app.id)
                  .then((blob) =>
                    downloadBlob(blob, `${(app.applicationNo ?? app.id).replace(/\//g, '-')}.pdf`),
                  )
                  .catch((e) => setActionError(apiErrorMessage(e, 'PDF download failed')));
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActionError('');
                void downloadRecruitmentApplicationZip(app.id)
                  .then((blob) =>
                    downloadBlob(blob, `${(app.applicationNo ?? app.id).replace(/\//g, '-')}.zip`),
                  )
                  .catch((e) => setActionError(apiErrorMessage(e, 'ZIP download failed')));
              }}
            >
              <Package className="mr-1.5 h-3.5 w-3.5" />
              ZIP
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pdfUrl}
              onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Button size="sm" variant="outline" asChild disabled={!app.email}>
              <a
                href={
                  app.email
                    ? `mailto:${app.email}?subject=${encodeURIComponent(
                        `Application ${app.applicationNo ?? ''}`,
                      )}`
                    : undefined
                }
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Email
              </a>
            </Button>
          </div>
        ) : null}

        <div className="flex gap-1 border-b px-4 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-t-md px-3 py-2 text-xs font-medium',
                tab === t.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {actionError ? <p className="mb-3 text-sm text-destructive">{actionError}</p> : null}
          {appQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : app ? (
            <>
              {tab === 'info' ? (
                <div className="space-y-5 text-sm">
                  <div className="flex items-center gap-4">
                    {app.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveUploadAssetUrl(app.photoUrl) ?? app.photoUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                        {app.fullName
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{app.fullName}</p>
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {app.mobile ?? '—'}
                      </p>
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {app.email ?? '—'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Current Status
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">
                      {app.status.replace(/_/g, ' ')}
                    </p>
                    {app.vacancy ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Applied for: {app.vacancy.title}
                        {app.vacancy.department?.name ? ` · ${app.vacancy.department.name}` : ''}
                      </p>
                    ) : null}
                  </div>

                  <DetailBlock title="Personal" data={details.personal} />
                  <DetailBlock title="Contact" data={details.contact} />
                  <ArrayBlock
                    title="Education"
                    rows={Array.isArray(details.education) ? details.education : []}
                  />
                  <ArrayBlock
                    title="Experience"
                    rows={Array.isArray(details.experience) ? details.experience : []}
                  />
                  <DetailBlock title="Research" data={details.research} />
                  <DetailBlock title="Skills" data={details.skills} />
                  <ArrayBlock
                    title="References"
                    rows={Array.isArray(details.references) ? details.references : []}
                  />
                </div>
              ) : null}

              {tab === 'pdf' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={regenerateMut.isPending}
                      onClick={() => regenerateMut.mutate()}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {regenerateMut.isPending ? 'Generating…' : 'Regenerate PDF'}
                    </Button>
                    {pdfUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={pdfUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {regenerateMut.isError ? (
                    <p className="text-sm text-destructive">
                      {apiErrorMessage(regenerateMut.error, 'Could not regenerate PDF')}
                    </p>
                  ) : null}
                  {pdfUrl ? (
                    <iframe
                      title="Application PDF"
                      src={pdfUrl}
                      className="h-[70vh] w-full rounded-xl border bg-muted/20"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No application PDF yet. Click Regenerate PDF after documents are uploaded.
                    </p>
                  )}
                </div>
              ) : null}

              {tab === 'docs' ? (
                <div className="space-y-3">
                  {(docsQ.data?.documents ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(docsQ.data?.documents ?? []).map((doc) => {
                        const url = resolveUploadAssetUrl(doc.url) ?? doc.url;
                        const isImage =
                          (doc.mimeType ?? '').startsWith('image/') ||
                          /\.(jpe?g|png|webp|gif)$/i.test(doc.name);
                        return (
                          <li
                            key={doc.key}
                            className="flex items-center justify-between gap-3 rounded-xl border p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{doc.label}</p>
                              <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setPreviewUrl(url)}>
                                {isImage ? (
                                  <ImageIcon className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                                <span className="ml-1">View</span>
                              </Button>
                              <Button size="sm" variant="outline" asChild>
                                <a href={url} download target="_blank" rel="noreferrer">
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {previewUrl ? (
                    <div className="overflow-hidden rounded-xl border">
                      {/\.(pdf)(\?|$)/i.test(previewUrl) ||
                      previewUrl.includes('Application.pdf') ? (
                        <iframe title="Doc preview" src={previewUrl} className="h-80 w-full" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Document preview"
                          className="max-h-80 w-full object-contain bg-muted/30"
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'timeline' ? (
                <div>
                  <ol className="space-y-2 border-l-2 border-primary/20 pl-4">
                    {PUBLIC_STATUS_STEPS.map((step, i) => {
                      const done =
                        statusIdx >= i || app.status === 'HIRED' || app.status === 'APPOINTED';
                      return (
                        <li key={step.id} className="relative">
                          <span
                            className={cn(
                              'absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 bg-background',
                              done ? 'border-primary bg-primary' : 'border-muted-foreground',
                            )}
                          />
                          <p
                            className={cn(
                              'text-xs font-medium',
                              done ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {step.label}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                  {app.interviews?.length ? (
                    <div className="mt-5">
                      <p className="mb-2 font-semibold">Interviews</p>
                      <ul className="space-y-2 text-xs">
                        {app.interviews.map((iv) => (
                          <li key={iv.id} className="rounded-lg border p-2">
                            {new Date(iv.scheduledAt).toLocaleString('en-IN')}
                            {iv.venue ? ` · ${iv.venue}` : ''}
                            <span className="ml-2 font-medium">{iv.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Application not found.</p>
          )}
        </div>

        {app ? (
          <div className="border-t px-6 py-4">
            {(app.status === 'SELECTED' ||
              app.status === 'APPOINTED' ||
              app.status === 'OFFERED') && (
              <Button className="w-full" asChild>
                <Link href={`/admin/hr/appointment-orders/new?applicationId=${app.id}`}>
                  Generate Appointment Order
                </Link>
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailBlock({ title, data }: { title: string; data?: Record<string, unknown> | null }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => String(v ?? '').trim());
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] capitalize text-muted-foreground">
              {k.replace(/([A-Z])/g, ' $1')}
            </dt>
            <dd className="text-sm font-medium">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ArrayBlock({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="rounded-lg bg-muted/40 p-2 text-xs">
            {Object.entries(row)
              .filter(([, v]) => String(v ?? '').trim())
              .map(([k, v]) => (
                <span key={k} className="mr-3 inline-block">
                  <span className="text-muted-foreground">{k}: </span>
                  {String(v)}
                </span>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
