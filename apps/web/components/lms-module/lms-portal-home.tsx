'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  FileText,
  Megaphone,
  Sparkles,
  Target,
} from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  fetchLmsMyDashboard,
  fetchLmsMyWorkspaces,
  formatLmsWorkspaceMeta,
  type LmsWorkspace,
} from '@/services/lms';
import { fetchLmsWorkspaceLaunchUrl } from '@/services/moodle';
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
  const basePath = role === 'student' ? '/student/lms' : '/staff/academic/lms';
  const totalDue = list.reduce((sum, ws) => sum + (ws.moodleSummary?.assignmentsDue ?? 0), 0);
  const totalOpenQuizzes = list.reduce((sum, ws) => sum + (ws.moodleSummary?.quizzesOpen ?? 0), 0);
  const highlightWorkspaces = [...list]
    .sort(
      (a, b) =>
        (b.moodleSummary?.assignmentsDue ?? 0) +
        (b.moodleSummary?.quizzesOpen ?? 0) -
        ((a.moodleSummary?.assignmentsDue ?? 0) + (a.moodleSummary?.quizzesOpen ?? 0)),
    )
    .slice(0, 4);
  const greeting =
    role === 'student'
      ? 'Ready to continue your learning journey?'
      : 'Keep classes, plans, and outcomes on track.';
  const title = role === 'student' ? 'My Learning Command Center' : 'Faculty LMS Command Center';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-950 via-blue-900 to-purple-900 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-20 h-52 w-52 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5" />
            Smart learning workspace
          </div>
          <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
          <p className="max-w-3xl text-sm text-blue-100 sm:text-base">{greeting}</p>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-100">
                {role === 'student' ? 'My courses' : 'My subjects'}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {cards?.myCourses ?? cards?.mySubjects ?? list.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-100">Study materials</p>
              <p className="mt-1 text-2xl font-semibold">{cards?.notesAvailable ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-100">Assignments due</p>
              <p className="mt-1 text-2xl font-semibold">{cards?.assignmentsDue ?? totalDue}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-100">Open quizzes</p>
              <p className="mt-1 text-2xl font-semibold">{totalOpenQuizzes}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <CompactCard>
            <CompactCardHeader
              title="My subjects"
              subtitle="Open your course spaces, resources, and collaborative updates."
            />
            <CompactCardBody className="grid gap-3 p-4 sm:grid-cols-2">
              {list.map((ws) => (
                <div
                  key={ws.id}
                  className="rounded-xl border bg-gradient-to-b from-background to-muted/30 p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Link
                      href={`${basePath}/${ws.id}`}
                      className="line-clamp-2 text-sm font-semibold hover:text-primary"
                    >
                      {ws.title}
                    </Link>
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {formatLmsWorkspaceMeta(ws)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {ws.workspaceType === 'POOL' ? (
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Shared
                      </span>
                    ) : null}
                    {!!ws.moodleSummary?.assignmentsDue && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        {ws.moodleSummary.assignmentsDue} due
                      </span>
                    )}
                    {!!ws.moodleSummary?.quizzesOpen && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        {ws.moodleSummary.quizzesOpen} quizzes
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`${basePath}/${ws.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      Open workspace
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    {ws.effectiveProvider === 'MOODLE' ? (
                      <button
                        type="button"
                        className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"
                        onClick={async () => {
                          const { url } = await fetchLmsWorkspaceLaunchUrl(ws.id);
                          if (url) window.location.href = url;
                        }}
                      >
                        Launch Moodle
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!list.length ? (
                <p className="text-sm text-muted-foreground">
                  No LMS workspaces linked to your enrolment yet.
                </p>
              ) : null}
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Recent announcements" />
            <CompactCardBody className="space-y-2 p-4">
              {(dashboard.data?.announcements ?? [])
                .slice(0, 5)
                .map((a: { id: string; title: string; body: string }) => (
                  <div key={a.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              {(dashboard.data?.announcements ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No new announcements right now.</p>
              ) : null}
            </CompactCardBody>
          </CompactCard>
        </div>

        <div className="space-y-5">
          <CompactCard>
            <CompactCardHeader title="Priority tracker" />
            <CompactCardBody className="space-y-3 p-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Upcoming due work
                </div>
                <span className="text-lg font-semibold">{cards?.assignmentsDue ?? totalDue}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  Total announcements
                </div>
                <span className="text-lg font-semibold">{cards?.announcements ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-primary" />
                  Active workspaces
                </div>
                <span className="text-lg font-semibold">{list.length}</span>
              </div>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader
              title="Needs attention"
              subtitle="Subjects with the highest pending load."
            />
            <CompactCardBody className="space-y-2 p-4">
              {highlightWorkspaces.length ? (
                highlightWorkspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`${basePath}/${ws.id}`}
                    className="block rounded-lg border p-3 transition hover:bg-muted/40"
                  >
                    <p className="line-clamp-1 text-sm font-medium">{ws.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ws.moodleSummary?.assignmentsDue ?? 0} due ·{' '}
                      {ws.moodleSummary?.quizzesOpen ?? 0} open quizzes
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  All clear. No high-priority subjects detected right now.
                </p>
              )}
            </CompactCardBody>
          </CompactCard>
        </div>
      </div>
    </div>
  );
}
