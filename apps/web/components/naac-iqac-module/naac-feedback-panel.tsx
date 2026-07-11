'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createFeedbackCampaign,
  deleteFeedbackCampaign,
  fetchFeedbackAnalytics,
  fetchFeedbackCampaigns,
  fetchFeedbackResponses,
  replaceFeedbackQuestions,
  seedFeedbackDefaults,
  updateFeedbackCampaign,
} from '@/services/feedback';
import { apiErrorMessage } from '@/utils/api-error';

const AUDIENCES = [
  { id: 'STUDENT', label: 'Student' },
  { id: 'TEACHER', label: 'Teacher / Faculty' },
  { id: 'ALUMNI', label: 'Alumni' },
] as const;

const CATEGORIES = [
  'CURRICULUM',
  'TEACHING',
  'FACULTY',
  'INFRASTRUCTURE',
  'ICT',
  'LIBRARY',
  'LABORATORY',
  'STUDENT_SUPPORT',
  'EXAMINATION',
  'PLACEMENT',
  'ADMINISTRATION',
  'HOSTEL',
  'TRANSPORT',
  'SPORTS',
  'OVERALL',
] as const;

type DraftQuestion = {
  key: string;
  prompt: string;
  category: string;
  required: boolean;
  sortOrder: number;
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function newDraftQuestion(partial?: Partial<DraftQuestion>): DraftQuestion {
  return {
    key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    prompt: '',
    category: 'OVERALL',
    required: true,
    sortOrder: 10,
    ...partial,
  };
}

export function NaacFeedbackPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [audienceFilter, setAudienceFilter] = useState<string>('STUDENT');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [form, setForm] = useState({
    title: 'Student Feedback Form',
    academicYear: '2025-2026',
    instructions: 'Kindly select the appropriate option as per the following criteria.',
    audience: 'STUDENT' as string,
    startsAt: '',
    endsAt: '',
    enabled: false,
  });

  const listQ = useQuery({
    queryKey: ['feedback-campaigns', audienceFilter],
    queryFn: () => fetchFeedbackCampaigns(audienceFilter),
    enabled,
  });

  const selected = useMemo(
    () => (listQ.data ?? []).find((c: any) => c.id === selectedId) ?? null,
    [listQ.data, selectedId],
  );

  const responsesQ = useQuery({
    queryKey: ['feedback-responses', selectedId],
    queryFn: () => fetchFeedbackResponses(selectedId!),
    enabled: enabled && Boolean(selectedId),
  });

  const analyticsQ = useQuery({
    queryKey: ['feedback-analytics', selectedId],
    queryFn: () => fetchFeedbackAnalytics(selectedId!),
    enabled: enabled && Boolean(selectedId),
  });

  const syncDraftFromSelected = (campaign: any) => {
    const qs = (campaign?.questions ?? []) as Array<{
      id: string;
      prompt: string;
      category: string;
      required: boolean;
      sortOrder: number;
    }>;
    setDraftQuestions(
      qs.map((q, i) =>
        newDraftQuestion({
          key: q.id,
          prompt: q.prompt,
          category: q.category || 'OVERALL',
          required: q.required !== false,
          sortOrder: q.sortOrder ?? (i + 1) * 10,
        }),
      ),
    );
  };

  const createMut = useMutation({
    mutationFn: () =>
      createFeedbackCampaign({
        title: form.title,
        academicYear: form.academicYear,
        instructions: form.instructions,
        audience: form.audience,
        enabled: form.enabled,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      }),
    onSuccess: async (created: any) => {
      setError('');
      setAudienceFilter(form.audience);
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
      setSelectedId(created.id);
      await seedFeedbackDefaults(created.id);
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateFeedbackCampaign(selectedId!, payload),
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFeedbackCampaign(selectedId!),
    onSuccess: async () => {
      setSelectedId(null);
      setDraftQuestions([]);
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const saveQuestionsMut = useMutation({
    mutationFn: () => {
      const cleaned = draftQuestions
        .map((q, i) => ({
          prompt: q.prompt.trim(),
          category: q.category,
          required: q.required,
          sortOrder: (i + 1) * 10,
          questionType: 'LIKERT_5',
          isActive: true,
        }))
        .filter((q) => q.prompt.length >= 5);
      if (!cleaned.length) throw new Error('Add at least one question (min 5 characters).');
      return replaceFeedbackQuestions(selectedId!, cleaned);
    },
    onSuccess: async (campaign: any) => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
      syncDraftFromSelected(campaign);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const seedMut = useMutation({
    mutationFn: () => seedFeedbackDefaults(selectedId!),
    onSuccess: async (campaign: any) => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
      syncDraftFromSelected(campaign);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={audienceFilter === a.id ? 'default' : 'outline'}
            onClick={() => {
              setAudienceFilter(a.id);
              setSelectedId(null);
              setDraftQuestions([]);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaigns</CardTitle>
            <CardDescription>
              {AUDIENCES.find((a) => a.id === audienceFilter)?.label} feedback forms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(listQ.data ?? []).map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedId(c.id);
                  syncDraftFromSelected(c);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedId === c.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="font-medium">{c.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{c.academicYear}</Badge>
                  <Badge variant={c.enabled ? 'default' : 'secondary'}>
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Badge variant="outline">{c._count?.responses ?? 0} responses</Badge>
                </div>
              </button>
            ))}
            {!listQ.data?.length && !listQ.isLoading ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create feedback form</CardTitle>
              <CardDescription>
                Scale: Excellent · Very Good · Good · Average · Poor. Default questions are seeded
                for the selected audience; you can edit them afterward.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Audience</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.audience}
                  onChange={(e) => {
                    const audience = e.target.value;
                    setForm((f) => ({
                      ...f,
                      audience,
                      title:
                        audience === 'TEACHER'
                          ? 'Teacher Feedback Form'
                          : audience === 'ALUMNI'
                            ? 'Alumni Feedback Form'
                            : 'Student Feedback Form',
                    }));
                  }}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Academic year</Label>
                <Input
                  value={form.academicYear}
                  onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
                <Label>Enable immediately</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <DateInput
                  value={form.startsAt}
                  onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <DateInput
                  value={form.endsAt}
                  onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
                  {createMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create form
                </Button>
              </div>
            </CardContent>
          </Card>

          {selected ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selected.title}</CardTitle>
                  <CardDescription>
                    Respondents can submit only while Enabled and within the date window.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(selected.enabled)}
                        onCheckedChange={(v) => updateMut.mutate({ enabled: v })}
                      />
                      <span className="text-sm font-medium">
                        {selected.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <Badge variant="outline">{selected.audience}</Badge>
                    <Badge variant="outline">{selected.status}</Badge>
                    <Badge variant="outline">{(selected.questions ?? []).length} questions</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Start date</Label>
                      <DateInput
                        value={toDateInput(selected.startsAt)}
                        onChange={(v) => updateMut.mutate({ startsAt: v || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End date</Label>
                      <DateInput
                        value={toDateInput(selected.endsAt)}
                        onChange={(v) => updateMut.mutate({ endsAt: v || null })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={updateMut.isPending}
                      onClick={() =>
                        updateMut.mutate({
                          enabled: selected.enabled,
                          startsAt: selected.startsAt,
                          endsAt: selected.endsAt,
                        })
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save window
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm('Delete this feedback campaign and all responses?')) {
                          deleteMut.mutate();
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Question builder</CardTitle>
                  <CardDescription>
                    Custom questions grouped by section (category). Toggle Required for compulsory
                    items. Scale stays Excellent → Poor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraftQuestions((prev) => [
                          ...prev,
                          newDraftQuestion({ sortOrder: (prev.length + 1) * 10 }),
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add question
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={seedMut.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Replace all questions with the default set for this audience?',
                          )
                        ) {
                          seedMut.mutate();
                        }
                      }}
                    >
                      Reset to defaults
                    </Button>
                    <Button
                      size="sm"
                      disabled={saveQuestionsMut.isPending}
                      onClick={() => saveQuestionsMut.mutate()}
                    >
                      {saveQuestionsMut.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3.5 w-3.5" />
                      )}
                      Save questions
                    </Button>
                  </div>

                  {draftQuestions.map((q, idx) => (
                    <div key={q.key} className="space-y-2 rounded-xl border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Q{idx + 1}
                        </span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={q.category}
                          onChange={(e) =>
                            setDraftQuestions((prev) =>
                              prev.map((row) =>
                                row.key === q.key ? { ...row, category: e.target.value } : row,
                              ),
                            )
                          }
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) =>
                              setDraftQuestions((prev) =>
                                prev.map((row) =>
                                  row.key === q.key ? { ...row, required: e.target.checked } : row,
                                ),
                              )
                            }
                          />
                          Required
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive"
                          onClick={() =>
                            setDraftQuestions((prev) => prev.filter((row) => row.key !== q.key))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={q.prompt}
                        placeholder="Question text…"
                        onChange={(e) =>
                          setDraftQuestions((prev) =>
                            prev.map((row) =>
                              row.key === q.key ? { ...row, prompt: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                  {!draftQuestions.length ? (
                    <p className="text-sm text-muted-foreground">
                      No questions yet. Add custom ones or reset to defaults.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anonymous analytics</CardTitle>
                  <CardDescription>
                    Aggregates without names. Use Responses below for trackable admin view.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    Total responses: <strong>{analyticsQ.data?.responseCount ?? 0}</strong>
                  </p>
                  {(analyticsQ.data?.questions ?? []).map((q: any) => (
                    <div key={q.questionId} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium">{q.prompt}</div>
                      <div className="mt-1 text-muted-foreground">
                        {q.category} · Avg {q.average} · n={q.responseCount}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(q.distribution ?? []).map((d: any) => (
                          <Badge key={d.rating} variant="outline">
                            {d.label}: {d.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Responses (admin trackable)</CardTitle>
                  <CardDescription>
                    Respondent identity is visible only to authorised IQAC/admin users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(responsesQ.data ?? []).slice(0, 50).map((r: any) => (
                    <div key={r.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="font-medium">
                        {r.respondent?.name ?? r.student?.name} ·{' '}
                        {r.respondent?.code ?? r.student?.rollNumber ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.respondent?.department ?? r.student?.department ?? '—'}
                        {r.respondent?.email ? ` · ${r.respondent.email}` : ''} ·{' '}
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN') : '—'}
                      </div>
                    </div>
                  ))}
                  {!responsesQ.data?.length && !responsesQ.isLoading ? (
                    <p className="text-sm text-muted-foreground">No responses yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
