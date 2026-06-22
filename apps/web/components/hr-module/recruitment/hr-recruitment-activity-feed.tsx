'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Calendar, FileText, UserPlus } from 'lucide-react';
import { fetchRecruitmentApplications, fetchRecruitmentInterviews } from '@/services/hr';
import { useAuthQueryEnabled } from '@/hooks/use-auth';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function HrRecruitmentActivityFeed() {
  const enabled = useAuthQueryEnabled();
  const appsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'applications', 'recent'],
    queryFn: () => fetchRecruitmentApplications(),
    enabled,
  });
  const interviewsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'interviews'],
    queryFn: () => fetchRecruitmentInterviews('SCHEDULED'),
    enabled,
  });

  const apps = (appsQ.data ?? []).slice(0, 6);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const upcomingInterviews = (interviewsQ.data ?? []).filter((i) => {
    const d = new Date(i.scheduledAt);
    return d <= tomorrow && d >= new Date();
  }).length;

  const items = [
    ...apps.map((a) => ({
      id: a.id,
      icon: UserPlus,
      text: `${a.fullName} applied for ${a.vacancy?.title ?? 'a position'}`,
      time: timeAgo(a.appliedAt),
    })),
  ].slice(0, 5);

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Recent Activity</p>
        <Bell className="h-4 w-4 text-muted-foreground" />
      </div>
      {upcomingInterviews > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/40">
          <Calendar className="mb-1 inline h-3.5 w-3.5 text-amber-600" />{' '}
          <strong>{upcomingInterviews}</strong> interview{upcomingInterviews === 1 ? '' : 's'}{' '}
          tomorrow
        </div>
      ) : null}
      <ul className="space-y-3">
        {items.length ? (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="flex gap-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="leading-snug">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="flex gap-3 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            Activity will appear when applications are received.
          </li>
        )}
      </ul>
    </div>
  );
}
