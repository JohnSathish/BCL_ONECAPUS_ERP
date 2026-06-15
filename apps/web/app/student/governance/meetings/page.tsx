'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentGovernanceMeetings } from '@/services/governance';
import { cn } from '@/utils/cn';

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === 'COMPLETED') return 'bg-emerald-100 text-emerald-800';
  if (s === 'SCHEDULED') return 'bg-amber-100 text-amber-800';
  return 'bg-muted text-muted-foreground';
}

export default function StudentGovernanceMeetingsPage() {
  useRequireAuth();
  const enabled = useAuthQueryEnabled();
  const meetingsQ = useQuery({
    queryKey: ['governance', 'student', 'meetings'],
    queryFn: () => fetchStudentGovernanceMeetings({ limit: 50 }),
    enabled,
  });

  return (
    <DashboardShell role="student" title="Committee Meetings">
      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">My committee meetings</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Upcoming and recent meetings for committees where you serve as a student representative.
          </p>
        </section>

        {meetingsQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading meetings…
          </div>
        ) : null}

        <div className="space-y-3">
          {(meetingsQ.data ?? []).map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{meeting.title}</CardTitle>
                  <Badge className={cn('text-xs', statusTone(meeting.status))}>
                    {meeting.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {meeting.committeeName ?? 'Committee'} ·{' '}
                  {new Date(meeting.meetingDate).toLocaleString('en-IN')}
                  {meeting.venue ? ` · ${meeting.venue}` : ''}
                </p>
              </CardHeader>
              {meeting.agenda ? (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{meeting.agenda}</p>
                </CardContent>
              ) : null}
            </Card>
          ))}
          {!meetingsQ.isLoading && !meetingsQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
