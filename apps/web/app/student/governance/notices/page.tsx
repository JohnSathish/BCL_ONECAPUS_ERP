'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Megaphone } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentGovernanceNotices } from '@/services/governance';

export default function StudentGovernanceNoticesPage() {
  useRequireAuth();
  const enabled = useAuthQueryEnabled();
  const noticesQ = useQuery({
    queryKey: ['governance', 'student', 'notices'],
    queryFn: () => fetchStudentGovernanceNotices({ limit: 50 }),
    enabled,
  });

  return (
    <DashboardShell role="student" title="Committee Notices">
      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Notices & circulars</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Published notices for committees where you are a student representative.
          </p>
        </section>

        {noticesQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notices…
          </div>
        ) : null}

        <div className="space-y-3">
          {(noticesQ.data ?? []).map((notice) => (
            <Card key={notice.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{notice.title}</CardTitle>
                  <Badge variant="outline">{notice.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {notice.noticeNo ?? 'Notice'}
                  {notice.publishedAt
                    ? ` · ${new Date(notice.publishedAt).toLocaleDateString('en-IN')}`
                    : ''}
                </p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{notice.body}</p>
              </CardContent>
            </Card>
          ))}
          {!noticesQ.isLoading && !noticesQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No notices available.</p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
