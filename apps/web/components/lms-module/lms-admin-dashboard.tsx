'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  Megaphone,
  Upload,
} from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import { fetchLmsAdminDashboard, fetchLmsWorkspaces, provisionLmsWorkspaces } from '@/services/lms';
import { cn } from '@/utils/cn';

export function LmsAdminDashboard() {
  const dashboard = useQuery({
    queryKey: ['lms', 'admin-dashboard'],
    queryFn: () => withApiStartupRetry(fetchLmsAdminDashboard),
    retry: false,
  });
  const workspaces = useQuery({
    queryKey: ['lms', 'workspaces', { limit: 8 }],
    queryFn: () => withApiStartupRetry(() => fetchLmsWorkspaces({ limit: 8 })),
    retry: false,
  });

  const cards = dashboard.data?.cards;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">LMS Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Digital classrooms linked to enrolment, timetable, and attendance.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void provisionLmsWorkspaces().then(() => workspaces.refetch())}
        >
          Provision workspaces
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active workspaces', value: cards?.activeWorkspaces ?? '—', icon: FolderOpen },
          { label: 'Published materials', value: cards?.totalMaterials ?? '—', icon: BookOpen },
          {
            label: 'Faculty uploads (7d)',
            value: cards?.facultyActivityUploads ?? '—',
            icon: Upload,
          },
          {
            label: 'Announcements (7d)',
            value: cards?.recentAnnouncements ?? '—',
            icon: Megaphone,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <CompactCard key={card.label}>
              <CompactCardBody className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
              </CompactCardBody>
            </CompactCard>
          );
        })}
      </div>

      <CompactCard>
        <CompactCardHeader
          title="Recent workspaces"
          description="Subject workspaces auto-created from sections and pool offerings."
        />
        <CompactCardBody className="space-y-2">
          {(workspaces.data?.data ?? []).map((ws) => (
            <Link
              key={ws.id}
              href={`/admin/academics/lms/workspaces/${ws.id}`}
              className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm hover:bg-muted/40"
            >
              <span>
                <span className="font-medium">{ws.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">Sem {ws.semesterNo}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {ws._count?.materials ?? 0} materials
              </span>
            </Link>
          ))}
          {!workspaces.data?.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No workspaces yet. Run provision or create offering sections.
            </p>
          ) : null}
          <Link
            href="/admin/academics/lms/workspaces"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 inline-flex')}
          >
            View all workspaces
          </Link>
        </CompactCardBody>
      </CompactCard>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/academics/lms/materials"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col gap-2 p-4')}
        >
          <BookOpen className="h-5 w-5" />
          Learning materials
        </Link>
        <Link
          href="/admin/academics/lms/assignments"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col gap-2 p-4')}
        >
          <ClipboardList className="h-5 w-5" />
          Assignments
        </Link>
        <Link
          href="/admin/academics/lms/lesson-plans"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col gap-2 p-4')}
        >
          <GraduationCap className="h-5 w-5" />
          Lesson plans
        </Link>
        <Link
          href="/admin/academics/lms/settings"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col gap-2 p-4')}
        >
          <FolderOpen className="h-5 w-5" />
          LMS settings
        </Link>
      </div>
    </div>
  );
}
