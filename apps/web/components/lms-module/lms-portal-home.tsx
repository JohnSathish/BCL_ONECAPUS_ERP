'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Megaphone } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { fetchLmsMyDashboard, fetchLmsMyWorkspaces, type LmsWorkspace } from '@/services/lms';
import { LmsWorkspaceShell } from '@/components/lms-module/lms-workspace-shell';

type Props = {
  role: 'student' | 'faculty';
  workspaceId?: string;
};

export function LmsPortalHome({ role, workspaceId }: Props) {
  const dashboard = useQuery({
    queryKey: ['lms', 'me', 'dashboard'],
    queryFn: fetchLmsMyDashboard,
  });
  const workspaces = useQuery({
    queryKey: ['lms', 'me', 'workspaces'],
    queryFn: fetchLmsMyWorkspaces,
  });

  if (workspaceId) {
    const base = role === 'student' ? '/student/lms' : '/staff/academic/lms';
    return (
      <LmsWorkspaceShell
        workspaceId={workspaceId}
        basePath={`${base}/${workspaceId}`}
        viewerRole={role === 'student' ? 'student' : 'faculty'}
      />
    );
  }

  const cards = dashboard.data?.cards;
  const list: LmsWorkspace[] = workspaces.data?.workspaces ?? dashboard.data?.workspaces ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">
          {role === 'student' ? 'My learning' : 'Faculty LMS'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Access notes, announcements, and lesson plans for your subjects.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">
              {role === 'student' ? 'My courses' : 'My subjects'}
            </p>
            <p className="text-2xl font-semibold">
              {cards?.myCourses ?? cards?.mySubjects ?? list.length}
            </p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Notes available</p>
            <p className="text-2xl font-semibold">{cards?.notesAvailable ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Announcements</p>
            <p className="text-2xl font-semibold">{cards?.announcements ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Assignments due</p>
            <p className="text-2xl font-semibold">{cards?.assignmentsDue ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
      </div>

      <CompactCard>
        <CompactCardHeader title="My subjects" />
        <CompactCardBody className="space-y-2">
          {list.map((ws) => (
            <Link
              key={ws.id}
              href={`${role === 'student' ? '/student/lms' : '/staff/academic/lms'}/${ws.id}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
            >
              <span className="flex items-center gap-2 font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                {ws.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {ws._count?.materials ?? 0} notes
              </span>
            </Link>
          ))}
          {!list.length ? (
            <p className="text-sm text-muted-foreground">
              No LMS workspaces linked to your enrolment yet.
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>

      {(dashboard.data?.announcements ?? [])
        .slice(0, 5)
        .map((a: { id: string; title: string; body: string }) => (
          <CompactCard key={a.id}>
            <CompactCardBody className="flex gap-2 p-4">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
              </div>
            </CompactCardBody>
          </CompactCard>
        ))}
    </div>
  );
}
