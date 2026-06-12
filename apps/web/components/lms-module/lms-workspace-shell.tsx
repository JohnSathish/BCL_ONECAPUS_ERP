'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Megaphone, Upload } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { LmsAssignmentsPanel } from '@/components/lms-module/lms-assignments-panel';
import { LmsQuizzesPanel } from '@/components/lms-module/lms-quizzes-panel';
import { LmsDiscussionsPanel } from '@/components/lms-module/lms-discussions-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchLmsAnnouncements,
  fetchLmsLessonPlans,
  fetchLmsWorkspace,
  fetchLmsWorkspaceAttendance,
  fetchLmsWorkspaceMaterials,
  publishLmsMaterial,
  uploadLmsMaterial,
} from '@/services/lms';
import { cn } from '@/utils/cn';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials', label: 'Materials' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'lesson-plans', label: 'Lesson plans' },
  { id: 'attendance', label: 'Attendance' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Props = {
  workspaceId: string;
  basePath?: string;
  viewerRole?: 'admin' | 'faculty' | 'student';
};

export function LmsWorkspaceShell({
  workspaceId,
  basePath = '/admin/academics/lms/workspaces',
  viewerRole = 'admin',
}: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const overview = useQuery({
    queryKey: ['lms', 'workspace', workspaceId],
    queryFn: () => fetchLmsWorkspace(workspaceId),
  });
  const materials = useQuery({
    queryKey: ['lms', 'materials', workspaceId],
    queryFn: () => fetchLmsWorkspaceMaterials(workspaceId),
    enabled: tab === 'materials' || tab === 'overview',
  });
  const announcements = useQuery({
    queryKey: ['lms', 'announcements', workspaceId],
    queryFn: () => fetchLmsAnnouncements(workspaceId),
    enabled: tab === 'announcements' || tab === 'overview',
  });
  const lessonPlans = useQuery({
    queryKey: ['lms', 'lesson-plans', workspaceId],
    queryFn: () => fetchLmsLessonPlans(workspaceId),
    enabled: tab === 'lesson-plans',
  });
  const attendance = useQuery({
    queryKey: ['lms', 'attendance', workspaceId],
    queryFn: () => fetchLmsWorkspaceAttendance(workspaceId),
    enabled: tab === 'attendance' || tab === 'overview',
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !uploadTitle.trim()) return;
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('title', uploadTitle.trim());
      form.append('category', 'LECTURE_NOTES');
      return uploadLmsMaterial(workspaceId, form);
    },
    onSuccess: () => {
      setUploadFile(null);
      setUploadTitle('');
      void qc.invalidateQueries({ queryKey: ['lms', 'materials', workspaceId] });
    },
  });

  const ws = overview.data?.workspace;
  const stats = overview.data?.stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={basePath.replace(/\/[^/]+$/, '') || '/admin/academics/lms/workspaces'}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h2 className="text-lg font-semibold">{ws?.title ?? 'Subject workspace'}</h2>
          <p className="text-xs text-muted-foreground">
            {ws?.course?.code} · Sem {ws?.semesterNo} · {ws?.workspaceType}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CompactCard>
            <CompactCardHeader title="Subject information" />
            <CompactCardBody className="space-y-1 text-sm">
              <p>
                <strong>Code:</strong> {ws?.course?.code}
              </p>
              <p>
                <strong>Name:</strong> {ws?.course?.title}
              </p>
              <p>
                <strong>Credits:</strong> {String(ws?.course?.credits ?? '—')}
              </p>
              <p>
                <strong>Programme:</strong> {overview.data?.programme?.name ?? '—'}
              </p>
            </CompactCardBody>
          </CompactCard>
          <CompactCard>
            <CompactCardHeader title="Stats" />
            <CompactCardBody className="grid grid-cols-2 gap-2 text-sm">
              <p>Materials: {stats?.publishedMaterialCount ?? 0} published</p>
              <p>Announcements: {stats?.announcementCount ?? 0}</p>
              <p>Lesson plans: {stats?.lessonPlanCount ?? 0}</p>
              <p>Assignments: {stats?.assignmentCount ?? 0}</p>
              <p>
                Class attendance:{' '}
                {attendance.data?.averageAttendancePct != null
                  ? `${attendance.data.averageAttendancePct}%`
                  : '—'}
              </p>
            </CompactCardBody>
          </CompactCard>
          <CompactCard className="md:col-span-2">
            <CompactCardHeader title="Faculty team" />
            <CompactCardBody className="flex flex-wrap gap-2">
              {(overview.data?.facultyTeam ?? []).map(
                (f: { id: string; name: string; role: string }) => (
                  <span key={f.id} className="rounded-full bg-muted px-3 py-1 text-xs">
                    {f.name} · {f.role}
                  </span>
                ),
              )}
            </CompactCardBody>
          </CompactCard>
        </div>
      ) : null}

      {tab === 'materials' ? (
        <div className="space-y-4">
          <CompactCard>
            <CompactCardHeader title="Upload material" />
            <CompactCardBody className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label htmlFor="mat-title">Title</Label>
                <Input
                  id="mat-title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mat-file">File</Label>
                <Input
                  id="mat-file"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                type="button"
                className="self-end"
                disabled={uploadMut.isPending}
                onClick={() => uploadMut.mutate()}
              >
                <Upload className="mr-1 h-4 w-4" />
                Upload
              </Button>
            </CompactCardBody>
          </CompactCard>
          <div className="space-y-2">
            {(materials.data ?? []).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.status}</span>
                </div>
                {m.status === 'DRAFT' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void publishLmsMaterial(m.id).then(() => materials.refetch())}
                  >
                    Publish
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'assignments' ? (
        <LmsAssignmentsPanel workspaceId={workspaceId} viewerRole={viewerRole} />
      ) : null}

      {tab === 'quizzes' ? (
        <LmsQuizzesPanel workspaceId={workspaceId} viewerRole={viewerRole} />
      ) : null}

      {tab === 'discussions' ? (
        <LmsDiscussionsPanel workspaceId={workspaceId} viewerRole={viewerRole} />
      ) : null}

      {tab === 'announcements' ? (
        <div className="space-y-2">
          {(announcements.data ?? []).map((a) => (
            <CompactCard key={a.id}>
              <CompactCardBody className="space-y-1 p-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  <p className="font-medium">{a.title}</p>
                  {a.pinned ? <span className="text-xs text-primary">Pinned</span> : null}
                </div>
                <p className="text-sm text-muted-foreground">{a.body}</p>
              </CompactCardBody>
            </CompactCard>
          ))}
        </div>
      ) : null}

      {tab === 'lesson-plans' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Unit</th>
                <th className="py-2 pr-3">Topic</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(lessonPlans.data ?? []).map((lp) => (
                <tr key={lp.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{lp.unit}</td>
                  <td className="py-2 pr-3">
                    {lp.topic}
                    {lp.subtopic ? ` · ${lp.subtopic}` : ''}
                  </td>
                  <td className="py-2 pr-3">{lp.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <CompactCard>
          <CompactCardHeader
            title="Attendance summary"
            description="Read-only data from the attendance module."
          />
          <CompactCardBody className="text-sm">
            {attendance.data?.scope === 'class' ? (
              <p>
                Average class attendance: {attendance.data.averageAttendancePct ?? '—'}% (
                {attendance.data.studentCount} students)
              </p>
            ) : (
              <p>Your attendance: {attendance.data?.attendancePct ?? '—'}%</p>
            )}
          </CompactCardBody>
        </CompactCard>
      ) : null}
    </div>
  );
}
