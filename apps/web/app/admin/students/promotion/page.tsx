'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PromotionLogsTable } from '@/components/academic-lifecycle/promotion-logs-table';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchAcademicStructure,
  fetchPromotionLogs,
  previewPromotion,
} from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { cn } from '@/utils/cn';

export default function StudentPromotionPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Promotion">
          <div />
        </DashboardShell>
      }
    >
      <StudentPromotionPageContent />
    </Suspense>
  );
}

function StudentPromotionPageContent() {
  const session = useRequireAuth();
  const searchParams = useSearchParams();
  const selectedStudentIds = useMemo(() => {
    const raw = searchParams.get('studentIds');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });

  const institutionId = institutions.data?.[0]?.id ?? '';

  const structure = useQuery({
    queryKey: ['academic-lifecycle', 'structure', institutionId],
    queryFn: () => fetchAcademicStructure(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const activeSemesters = useMemo(
    () =>
      (structure.data?.years ?? [])
        .flatMap((y) => y.semesters)
        .filter((s) => s.isActive)
        .sort((a, b) => a.semesterNumber - b.semesterNumber),
    [structure.data],
  );

  const fromSequence = activeSemesters[0]?.semesterNumber ?? 1;
  const toSequence = fromSequence + 1;

  const promotionPreview = useQuery({
    queryKey: ['academic-lifecycle', 'promotion-preview', institutionId, fromSequence, toSequence],
    queryFn: () =>
      previewPromotion({
        institutionId,
        fromSequence,
        toSequence,
      }),
    enabled: Boolean(session) && Boolean(institutionId),
    retry: false,
  });

  const promotionLogs = useQuery({
    queryKey: ['academic-lifecycle', 'promotion-logs', institutionId],
    queryFn: () => fetchPromotionLogs(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const loading = promotionLogs.isLoading || institutions.isLoading;

  if (!session) return null;

  const preview = promotionPreview.data as
    | { eligibleCount?: number; detainCount?: number; batches?: unknown[] }
    | undefined;

  return (
    <DashboardShell role="admin" title="Promotion">
      <div className="space-y-4">
        {selectedStudentIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium text-primary">
                {selectedStudentIds.length} student
                {selectedStudentIds.length === 1 ? '' : 's'}
              </span>{' '}
              selected from the directory. Batch promotion runs at institution level in Academic
              Lifecycle.
            </p>
            <Link
              href="/admin/students"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Back to directory
            </Link>
          </div>
        ) : null}

        <Card className="glass-card border-0">
          {' '}
          <CardHeader>
            <CardTitle>Semester promotion</CardTitle>
            <CardDescription>
              Review promotion history for students across batches. Run batch progression and cycle
              actions from Academic Sessions &amp; Lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/admin/academic-lifecycle"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            >
              Open academic lifecycle
            </Link>
            <Link
              href="/admin/academic-lifecycle"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Run promotion batch
            </Link>
          </CardContent>
        </Card>

        {promotionPreview.isError ? null : promotionPreview.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading promotion preview…</p>
        ) : preview ? (
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Promotion preview</CardTitle>
              <CardDescription>
                Sem {fromSequence} → Sem {toSequence}
                {institutionId ? '' : ' (no institution)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground">Eligible to promote</p>
                <p className="text-lg font-semibold">{preview.eligibleCount ?? '—'}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground">To detain</p>
                <p className="text-lg font-semibold">{preview.detainCount ?? '—'}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground">Batches affected</p>
                <p className="text-lg font-semibold">
                  {Array.isArray(preview.batches) ? preview.batches.length : '—'}
                </p>
              </div>
              <Link href="/admin/academic-lifecycle" className="md:col-span-3">
                <Button type="button" size="sm" variant="outline">
                  Review and apply in lifecycle hub
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading promotion logs…</p>
        ) : (
          <PromotionLogsTable rows={promotionLogs.data ?? []} />
        )}
      </div>
    </DashboardShell>
  );
}
