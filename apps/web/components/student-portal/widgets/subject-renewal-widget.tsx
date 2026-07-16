'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchMyRegistration, fetchRegistrationWindows } from '@/services/academic-engine';

type MeData = Awaited<ReturnType<typeof fetchMyRegistration>> & {
  electiveSlots?: { category: string; remaining: number }[] | null;
};

/**
 * Shown when the standing semester registration window is OPEN and the student
 * still has a draft with unfilled elective slots (subject renewal).
 */
export function SubjectRenewalWidget() {
  const session = useRequireAuth();

  const windows = useQuery({
    queryKey: ['academic-engine', 'windows', 'dashboard-renewal'],
    queryFn: fetchRegistrationWindows,
    enabled: Boolean(session),
  });

  const me = useQuery({
    queryKey: ['academic-engine', 'me', 'dashboard-renewal'],
    queryFn: () => fetchMyRegistration(),
    enabled: Boolean(session),
  });

  const meData = me.data as MeData | undefined;
  const seq = meData?.standing?.currentSemesterSequence;

  const openWindow = useMemo(() => {
    if (!windows.data?.length || !seq) return null;
    return (
      windows.data.find((w) => {
        const status = w.status ?? (w.locked ? 'LOCKED' : 'CLOSED');
        return status === 'OPEN' && w.semester.sequence === seq;
      }) ?? null
    );
  }, [windows.data, seq]);

  const draft = meData?.registration?.status === 'draft';
  const remaining =
    meData?.electiveSlots?.reduce((sum, s) => sum + Math.max(0, s.remaining), 0) ?? 0;
  const incomplete = draft && remaining > 0;

  if (me.isLoading || windows.isLoading) return null;

  if (!openWindow || !incomplete) return null;

  const deadline = openWindow.closesAt
    ? new Date(openWindow.closesAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <GlassCard className="border-primary/25 bg-primary/5 p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Subject renewal</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Semester {seq}
        {deadline ? ` · due by ${deadline}` : ''}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Major/Minor are locked. Choose your remaining electives ({remaining} slot
        {remaining === 1 ? '' : 's'}) and submit before the window closes.
      </p>
      <Button asChild className="mt-4 w-full rounded-xl" size="sm">
        <Link href="/student/registration?renewal=1">Continue renewal</Link>
      </Button>
    </GlassCard>
  );
}
