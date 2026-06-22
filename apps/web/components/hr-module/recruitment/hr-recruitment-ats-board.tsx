'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchRecruitmentPipeline,
  moveRecruitmentApplication,
  notifyRecruitmentDocuments,
  type RecruitmentApplication,
} from '@/services/hr';
import { RECRUITMENT_PIPELINE_STAGES, MOVE_OPTIONS } from '@/lib/recruitment-pipeline';
import { HrRecruitmentApplicationDetail } from '@/components/hr-module/recruitment/hr-recruitment-application-detail';
import { cn } from '@/utils/cn';

const COLUMN_STYLES: Record<string, string> = {
  APPLIED: 'border-t-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
  UNDER_REVIEW: 'border-t-violet-500 bg-violet-50/50 dark:bg-violet-950/20',
  SHORTLISTED: 'border-t-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  INTERVIEW: 'border-t-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20',
  SELECTED: 'border-t-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
  WAITING_LIST: 'border-t-slate-400 bg-slate-50/50 dark:bg-slate-900/20',
  APPOINTED: 'border-t-[#1e3a5f] bg-slate-50/50 dark:bg-slate-900/20',
  REJECTED: 'border-t-red-400 bg-red-50/30 dark:bg-red-950/20',
};

export function HrRecruitmentAtsBoard({ vacancyId }: { vacancyId?: string }) {
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const pipelineQ = useQuery({
    queryKey: ['hr', 'recruitment', 'pipeline', vacancyId],
    queryFn: () => fetchRecruitmentPipeline(vacancyId),
  });

  const moveMut = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      moveRecruitmentApplication(id, status, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const docsMut = useMutation({
    mutationFn: (id: string) => notifyRecruitmentDocuments(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const columns = pipelineQ.data ?? [];

  if (pipelineQ.isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {RECRUITMENT_PIPELINE_STAGES.map((stage) => {
          const col = columns.find((c) => c.id === stage.id);
          const apps = col?.applications ?? [];
          return (
            <div
              key={stage.id}
              className={cn(
                'w-72 shrink-0 rounded-2xl border border-t-4 shadow-sm',
                COLUMN_STYLES[stage.id] ?? 'border-t-border bg-muted/20',
              )}
            >
              <div className="flex items-center justify-between border-b px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wide">{stage.label}</p>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold shadow-sm">
                  {apps.length}
                </span>
              </div>
              <div className="max-h-[32rem] space-y-2 overflow-y-auto p-2">
                {apps.map((app) => (
                  <AtsCard
                    key={app.id}
                    app={app}
                    onMove={(status) => moveMut.mutate({ id: app.id, status })}
                    onRequestDocs={() => docsMut.mutate(app.id)}
                    docsPending={docsMut.isPending && docsMut.variables === app.id}
                    onView={() => setDetailId(app.id)}
                  />
                ))}
                {!apps.length ? (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                    No candidates
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <HrRecruitmentApplicationDetail
        applicationId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}

function AtsCard({
  app,
  onMove,
  onRequestDocs,
  docsPending,
  onView,
}: {
  app: RecruitmentApplication;
  onMove: (status: string) => void;
  onRequestDocs: () => void;
  docsPending?: boolean;
  onView: () => void;
}) {
  const moves = MOVE_OPTIONS[app.status] ?? ['SHORTLISTED', 'REJECTED'];
  const initials = app.fullName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-md"
      onClick={onView}
      onKeyDown={(e) => e.key === 'Enter' && onView()}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{app.fullName}</p>
          {app.applicationNo ? (
            <p className="font-mono text-[10px] text-muted-foreground">{app.applicationNo}</p>
          ) : null}
          <p className="mt-1 truncate text-xs text-muted-foreground">{app.vacancy?.title}</p>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </div>
      {app.source === 'PUBLIC' ? (
        <span className="mt-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          Careers portal
        </span>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {moves.slice(0, 2).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={() => onMove(s)}
          >
            → {s.replace(/_/g, ' ')}
          </Button>
        ))}
        {['SHORTLISTED', 'INTERVIEW', 'SELECTED', 'OFFERED'].includes(app.status) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            disabled={docsPending}
            onClick={onRequestDocs}
          >
            {docsPending ? '…' : 'Docs'}
          </Button>
        ) : null}
        {app.status === 'SELECTED' || app.status === 'APPOINTED' ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" asChild>
            <Link href={`/admin/hr/appointment-orders/new?applicationId=${app.id}`}>Order</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
