'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, RefreshCw, Wand2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useWorkspaceBoundShiftState } from '@/hooks/use-workspace-bound-shift-state';
import {
  createTeachingSubjectGroup,
  fetchTeachingSubjectGroups,
  syncTeachingSubjectGroups,
} from '@/services/teaching-subject-groups';
import { fetchTimetableContext } from '@/services/timetable';
import { apiErrorMessage } from '@/utils/api-error';

const CATEGORIES = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VTC', 'VAC'];

export default function TeachingSubjectGroupsPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [semesterNo, setSemesterNo] = useState(3);
  const { shiftId, setShiftId, effectiveShiftId, hideShiftFilter, workspaceShiftLabel } =
    useWorkspaceBoundShiftState();
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [newCategory, setNewCategory] = useState('MAJOR');

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });

  const academicYearId = useMemo(() => {
    const years = contextQ.data?.academicYears ?? [];
    return years.find((y) => y.status === 'ACTIVE')?.id ?? years[0]?.id;
  }, [contextQ.data?.academicYears]);

  const params = useMemo(
    () => ({
      semesterNo,
      shiftId: effectiveShiftId,
      fyugpCategory: category || undefined,
      academicYearId,
    }),
    [academicYearId, category, effectiveShiftId, semesterNo],
  );

  const groupsQ = useQuery({
    queryKey: ['teaching-subject-groups', params],
    queryFn: () => fetchTeachingSubjectGroups(params),
    enabled: authReady && Boolean(academicYearId),
  });

  const syncMut = useMutation({
    mutationFn: () =>
      syncTeachingSubjectGroups({
        semesterNo,
        shiftId: effectiveShiftId,
        academicYearId: academicYearId,
        fyugpCategory: category || undefined,
      }),
    onSuccess: (result) => {
      setError('');
      setSuccess(`Auto-build done: ${result.created} created, ${result.updated} updated.`);
      void qc.invalidateQueries({ queryKey: ['teaching-subject-groups'] });
    },
    onError: (e) => {
      setSuccess('');
      setError(apiErrorMessage(e, 'Sync failed'));
    },
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (!academicYearId) {
        return Promise.reject(
          new Error('Academic year is still loading. Wait a moment and try again.'),
        );
      }
      return createTeachingSubjectGroup({
        code: code.trim(),
        title: title.trim(),
        semesterNo,
        fyugpCategory: newCategory,
        shiftId: effectiveShiftId || undefined,
        academicYearId,
      });
    },
    onSuccess: (group) => {
      setCode('');
      setTitle('');
      setError('');
      setSuccess(`Created ${group.code} — ${group.title} (Sem ${group.semesterNo}).`);
      void qc.invalidateQueries({ queryKey: ['teaching-subject-groups'] });
    },
    onError: (e) => {
      setSuccess('');
      setError(apiErrorMessage(e, 'Create failed'));
    },
  });

  const groups = groupsQ.data ?? [];
  const shifts = contextQ.data?.shifts ?? [];

  return (
    <DashboardShell role="admin" title="Teaching Subject Groups">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              FYUGP subject groups (timetable + attendance unit)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Groups like <strong>Major Sociology</strong> bundle university papers (SOC-200,
            SOC-201). Timetable and attendance use the group — not individual papers.
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <div>
            <Label>Semester</Label>
            <select
              className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={semesterNo}
              onChange={(e) => setSemesterNo(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Shift</Label>
            {!hideShiftFilter ? (
              <select
                className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">All shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {workspaceShiftLabel ?? 'Workspace shift'}
              </p>
            )}
          </div>
          <div>
            <Label>Category</Label>
            <select
              className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" disabled={syncMut.isPending} onClick={() => syncMut.mutate()}>
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-build from semester offerings
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create group manually</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MAJOR-SOC-S3"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Major Sociology"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex flex-wrap items-center gap-3">
              <Button
                disabled={createMut.isPending || !code.trim() || !title.trim() || !academicYearId}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? 'Creating…' : 'Create group'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Uses filter semester above (currently Sem {semesterNo}).
                {!academicYearId ? ' Waiting for academic year…' : null}
              </p>
            </div>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        {groupsQ.isError ? (
          <p className="text-sm text-destructive">
            Could not load groups: {apiErrorMessage(groupsQ.error, 'List failed')}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Sem</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Faculty</th>
                <th className="px-3 py-2 text-left">Linked papers</th>
              </tr>
            </thead>
            <tbody>
              {groupsQ.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    Loading subject groups…
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    No subject groups for Sem {semesterNo} yet. Click Create group, or run
                    auto-build.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.id} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">{g.code}</td>
                    <td className="px-3 py-2">{g.title}</td>
                    <td className="px-3 py-2">{g.semesterNo}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{g.fyugpCategory}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {g.primaryStaffProfile?.shortCode ?? g.primaryStaffProfile?.fullName ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {(g.papers ?? []).length ? (
                        <ul className="space-y-1 text-xs">
                          {(g.papers ?? []).map((p) => (
                            <li key={p.id}>
                              {p.course?.code} — {p.course?.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {syncMut.data ? (
          <p className="text-xs text-muted-foreground">
            Last sync: {syncMut.data.created} created, {syncMut.data.updated} updated (
            {syncMut.data.buckets} subject buckets).
          </p>
        ) : null}
      </div>
    </DashboardShell>
  );
}
