'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createLmsOpenCourse,
  deleteLmsOpenCourse,
  fetchLmsOpenCoursesAdmin,
  updateLmsOpenCourse,
  type LmsOpenCourse,
} from '@/services/lms';
import { fetchAllPrograms } from '@/services/programs';

const STREAMS = [
  { value: 'SCIENCE', label: 'Science' },
  { value: 'COMPUTER_SCIENCE', label: 'Computer Science' },
  { value: 'COMMON', label: 'Common Resources' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'OTHER', label: 'Other' },
] as const;

type FormState = {
  title: string;
  description: string;
  stream: string;
  visibility: 'COLLEGE' | 'PROGRAMME';
  programId: string;
  moodleCourseId: string;
  sortOrder: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const emptyForm: FormState = {
  title: '',
  description: '',
  stream: 'COMMON',
  visibility: 'COLLEGE',
  programId: '',
  moodleCourseId: '',
  sortOrder: '0',
  status: 'ACTIVE',
};

function streamLabel(stream: string) {
  return STREAMS.find((s) => s.value === stream)?.label ?? stream;
}

export function LmsOpenCoursesPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['lms', 'open-courses', { q, streamFilter }],
    queryFn: () =>
      fetchLmsOpenCoursesAdmin({
        q: q || undefined,
        stream: streamFilter || undefined,
        limit: 100,
      }),
  });

  const programs = useQuery({
    queryKey: ['programs', 'all-for-open-courses'],
    queryFn: () => fetchAllPrograms(),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['lms', 'open-courses'] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const moodleCourseId = Number(form.moodleCourseId);
      if (!form.title.trim()) throw new Error('Title is required');
      if (!Number.isFinite(moodleCourseId) || moodleCourseId < 1) {
        throw new Error('Moodle course ID must be a positive number');
      }
      if (form.visibility === 'PROGRAMME' && !form.programId) {
        throw new Error('Select a programme for programme-scoped courses');
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        stream: form.stream,
        visibility: form.visibility,
        programId: form.visibility === 'PROGRAMME' ? form.programId : undefined,
        moodleCourseId,
        sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder) || 0,
        status: form.status,
      };

      if (editingId) {
        return updateLmsOpenCourse(editingId, {
          ...payload,
          programId: form.visibility === 'PROGRAMME' ? form.programId : null,
          description: form.description.trim() || null,
        });
      }
      return createLmsOpenCourse(payload);
    },
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      setFormError(null);
      invalidate();
    },
    onError: (err: unknown) => {
      const axiosMsg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      const message = Array.isArray(axiosMsg)
        ? axiosMsg.join(', ')
        : typeof axiosMsg === 'string'
          ? axiosMsg
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to save open course';
      setFormError(message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLmsOpenCourse(id),
    onSuccess: invalidate,
  });

  const items = list.data?.data ?? [];
  const programOptions = useMemo(
    () =>
      (programs.data?.data ?? []).map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.name}`,
      })),
    [programs.data?.data],
  );

  function startEdit(course: LmsOpenCourse) {
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description ?? '',
      stream: course.stream,
      visibility: course.visibility === 'PROGRAMME' ? 'PROGRAMME' : 'COLLEGE',
      programId: course.programId ?? '',
      moodleCourseId: String(course.moodleCourseId),
      sortOrder: String(course.sortOrder ?? 0),
      status: course.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    setFormError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  return (
    <div className="space-y-5">
      <CompactCard>
        <CompactCardHeader
          title={editingId ? 'Edit open course' : 'Add open course'}
          description="Catalog Moodle resource courses for Stream & Open Resources (college-wide or programme-specific)."
        />
        <CompactCardBody className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="oc-title">Title</Label>
            <Input
              id="oc-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Science Stream Resources"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="oc-desc">Description (optional)</Label>
            <Input
              id="oc-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short note shown to students"
            />
          </div>
          <div>
            <Label htmlFor="oc-stream">Stream</Label>
            <select
              id="oc-stream"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.stream}
              onChange={(e) => setForm((f) => ({ ...f, stream: e.target.value }))}
            >
              {STREAMS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="oc-moodle">Moodle course ID</Label>
            <Input
              id="oc-moodle"
              type="number"
              min={1}
              value={form.moodleCourseId}
              onChange={(e) => setForm((f) => ({ ...f, moodleCourseId: e.target.value }))}
              placeholder="e.g. 42"
            />
          </div>
          <div>
            <Label htmlFor="oc-vis">Visibility</Label>
            <select
              id="oc-vis"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.visibility}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  visibility: e.target.value as FormState['visibility'],
                  programId: e.target.value === 'COLLEGE' ? '' : f.programId,
                }))
              }
            >
              <option value="COLLEGE">College-wide</option>
              <option value="PROGRAMME">Programme-specific</option>
            </select>
          </div>
          <div>
            <Label htmlFor="oc-program">Programme</Label>
            <select
              id="oc-program"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
              disabled={form.visibility !== 'PROGRAMME'}
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
            >
              <option value="">Select programme…</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="oc-sort">Sort order</Label>
            <Input
              id="oc-sort"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="oc-status">Status</Label>
            <select
              id="oc-status"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as FormState['status'] }))
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          {formError ? <p className="sm:col-span-2 text-sm text-destructive">{formError}</p> : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              disabled={saveMut.isPending}
              onClick={() => {
                setFormError(null);
                saveMut.mutate();
              }}
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3.5 w-3.5" />
              )}
              {editingId ? 'Update' : 'Create'}
            </Button>
            {editingId ? (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CompactCardBody>
      </CompactCard>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search open courses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={streamFilter}
          onChange={(e) => setStreamFilter(e.target.value)}
        >
          <option value="">All streams</option>
          {STREAMS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <CompactCard>
        <CompactCardHeader
          title="Catalog"
          description="Active entries appear on the student LMS portal."
        />
        <CompactCardBody className="space-y-2 p-4">
          {list.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : null}

          {list.isError ? (
            <QueryErrorPanel
              title="Unable to load open courses"
              error={list.error}
              onRetry={() => void list.refetch()}
              isRetrying={list.isFetching}
            />
          ) : null}

          {!list.isLoading && !list.isError
            ? items.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {streamLabel(course.stream)} ·{' '}
                      {course.visibility === 'PROGRAMME' ? 'Programme' : 'College'}
                      {course.program ? ` · ${course.program.code}` : ''} · Moodle #
                      {course.moodleCourseId} · {course.status}
                    </p>
                    {course.description ? (
                      <p className="text-xs text-muted-foreground">{course.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(course)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`Remove “${course.title}” from the catalog?`)) {
                          deleteMut.mutate(course.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            : null}

          {!list.isLoading && !list.isError && items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No open courses yet. Create a Moodle course, enable self-enrol if needed, then add its
              course ID here.
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
