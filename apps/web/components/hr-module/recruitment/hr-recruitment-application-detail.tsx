'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchRecruitmentApplication } from '@/services/hr';
import { PUBLIC_STATUS_STEPS } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';
import { Mail, Phone, FileText } from 'lucide-react';

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
  const appQ = useQuery({
    queryKey: ['hr', 'recruitment', 'application', applicationId],
    queryFn: () => fetchRecruitmentApplication(applicationId!),
    enabled: enabled && open && Boolean(applicationId),
  });
  const app = appQ.data;

  const statusIdx = app ? STATUS_ORDER.indexOf(app.status) : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-y-0 right-0 left-auto top-0 flex h-full w-full max-w-xl translate-x-0 translate-y-0 flex-col rounded-none border-l p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{app?.fullName ?? 'Candidate Profile'}</DialogTitle>
          {app?.applicationNo ? (
            <p className="font-mono text-xs text-muted-foreground">{app.applicationNo}</p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {appQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : app ? (
            <div className="space-y-5 text-sm">
              <div className="flex items-center gap-4">
                {app.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={app.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
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

              <div>
                <p className="mb-2 font-semibold">Application Timeline</p>
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
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-xl border p-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Qualification</dt>
                  <dd className="font-medium">{app.qualification ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Experience</dt>
                  <dd className="font-medium">
                    {app.experienceYears != null ? `${app.experienceYears} years` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd>{app.source ?? 'INTERNAL'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Applied</dt>
                  <dd>{new Date(app.appliedAt).toLocaleDateString('en-IN')}</dd>
                </div>
              </dl>

              {app.resumeUrl ? (
                <div>
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4" />
                    Resume Preview
                  </p>
                  <div className="overflow-hidden rounded-xl border bg-muted/20">
                    <iframe title="Resume preview" src={app.resumeUrl} className="h-64 w-full" />
                  </div>
                  <Button size="sm" variant="outline" className="mt-2" asChild>
                    <a href={app.resumeUrl} target="_blank" rel="noreferrer">
                      Open full resume
                    </a>
                  </Button>
                </div>
              ) : null}

              {app.interviews?.length ? (
                <div>
                  <p className="mb-2 font-semibold">Interview Notes</p>
                  <ul className="space-y-2 text-xs">
                    {app.interviews.map((iv) => (
                      <li key={iv.id} className="rounded-lg border p-2">
                        {new Date(iv.scheduledAt).toLocaleString('en-IN')}
                        {iv.venue ? ` · ${iv.venue}` : ''}
                        <span className="ml-2 font-medium">{iv.status}</span>
                        {iv.score != null ? ` · Score: ${iv.score}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {app.certificatesJson?.length ? (
                <div>
                  <p className="mb-2 font-semibold">Documents</p>
                  <ul className="space-y-1 text-xs">
                    {app.certificatesJson.map((c, i) => (
                      <li key={i}>
                        <a
                          className="text-primary underline"
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
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
