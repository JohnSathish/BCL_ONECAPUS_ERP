'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { FeedbackQuestionPreview } from '@/components/feedback/feedback-question-field';
import {
  FEEDBACK_QUESTION_TYPES,
  FEEDBACK_QUESTION_TYPE_LABELS,
  asConditional,
  asOptions,
  asValidation,
  type FeedbackOption,
  type FeedbackQuestionDto,
  type FeedbackQuestionType,
  type FeedbackShowIf,
  type FeedbackValidation,
} from '@/components/feedback/feedback-question-types';
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
  downloadFeedbackExportPdf,
  downloadFeedbackExportXlsx,
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

const CHOICE_TYPES = new Set<string>(['single_choice', 'multi_choice', 'dropdown', 'rating']);
const NUMERIC_TYPES = new Set<string>(['integer', 'decimal']);
const TEXT_TYPES = new Set<string>(['short_text', 'long_text']);

type DraftQuestion = {
  key: string;
  prompt: string;
  description?: string;
  helpText?: string;
  placeholder?: string;
  category: string;
  required: boolean;
  sortOrder: number;
  questionType: FeedbackQuestionType;
  options: FeedbackOption[];
  validation: FeedbackValidation;
  conditionalLogic?: { showIf?: FeedbackShowIf };
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function defaultOptionsForType(type: string): FeedbackOption[] {
  return asOptions(undefined, type);
}

function newDraftQuestion(partial?: Partial<DraftQuestion>): DraftQuestion {
  const questionType = (partial?.questionType ?? 'LIKERT_5') as FeedbackQuestionType;
  const { options: partialOptions, ...rest } = partial ?? {};
  const resolvedType = (rest.questionType ?? questionType) as FeedbackQuestionType;
  return {
    key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    prompt: '',
    description: '',
    helpText: '',
    placeholder: '',
    category: 'OVERALL',
    required: true,
    sortOrder: 10,
    questionType: resolvedType,
    validation: {},
    conditionalLogic: undefined,
    ...rest,
    options:
      partialOptions && partialOptions.length > 0
        ? partialOptions
        : defaultOptionsForType(resolvedType),
  };
}

function mapCampaignQuestion(q: any, i: number): DraftQuestion {
  const questionType = (q.questionType ?? 'LIKERT_5') as FeedbackQuestionType;
  const validation = asValidation(q.validation);
  const conditionalLogic = asConditional(q.conditionalLogic);
  return newDraftQuestion({
    key: q.id ?? `q-${i}`,
    prompt: q.prompt ?? '',
    description: q.description ?? '',
    helpText: q.helpText ?? '',
    placeholder: q.placeholder ?? '',
    category: q.category || 'OVERALL',
    required: q.required !== false,
    sortOrder: q.sortOrder ?? (i + 1) * 10,
    questionType,
    options: asOptions(q.options, questionType),
    validation,
    conditionalLogic: conditionalLogic.showIf ? conditionalLogic : undefined,
  });
}

function answerDisplay(a: any): string {
  if (a?.display) return String(a.display);
  if (a?.ratingLabel) return String(a.ratingLabel);
  if (a?.valueText) return String(a.valueText);
  if (a?.valueNumber != null) return String(a.valueNumber);
  if (a?.valueBool != null) return a.valueBool ? 'Yes' : 'No';
  if (a?.valueDate) return String(a.valueDate);
  if (a?.rating != null) return String(a.rating);
  return '—';
}

function FeedbackQuestionEditor({
  question: q,
  index: idx,
  earlierQuestions,
  onChange,
  onRemove,
}: {
  question: DraftQuestion;
  index: number;
  earlierQuestions: DraftQuestion[];
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
}) {
  const showOptions = CHOICE_TYPES.has(q.questionType);
  const showNumeric = NUMERIC_TYPES.has(q.questionType);
  const showTextLimits = TEXT_TYPES.has(q.questionType);
  const showIf = q.conditionalLogic?.showIf;

  const previewQuestion: FeedbackQuestionDto = {
    id: q.key,
    prompt: q.prompt || 'Question preview…',
    description: q.description || null,
    helpText: q.helpText || null,
    placeholder: q.placeholder || null,
    category: q.category,
    required: q.required,
    sortOrder: q.sortOrder,
    questionType: q.questionType,
    options: q.options,
    validation: q.validation,
    conditionalLogic: q.conditionalLogic,
  };

  const patch = (partial: Partial<DraftQuestion>) => onChange({ ...q, ...partial });

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Q{idx + 1}</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={q.questionType}
          onChange={(e) => {
            const questionType = e.target.value as FeedbackQuestionType;
            patch({
              questionType,
              options: CHOICE_TYPES.has(questionType)
                ? q.options.length
                  ? q.options
                  : defaultOptionsForType(questionType)
                : defaultOptionsForType(questionType),
            });
          }}
        >
          {FEEDBACK_QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEEDBACK_QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={q.category}
          onChange={(e) => patch({ category: e.target.value })}
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
            onChange={(e) => patch({ required: e.target.checked })}
          />
          Required
        </label>
        <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Input
        value={q.prompt}
        placeholder="Question text…"
        onChange={(e) => patch({ prompt: e.target.value })}
      />
      <Input
        value={q.description ?? ''}
        placeholder="Description (optional)"
        onChange={(e) => patch({ description: e.target.value })}
      />

      {showOptions ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Options</Label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                patch({
                  options: [
                    ...q.options,
                    {
                      value: `opt-${q.options.length + 1}`,
                      label: `Option ${q.options.length + 1}`,
                    },
                  ],
                })
              }
            >
              Add option
            </Button>
          </div>
          {q.options.map((opt, oi) => (
            <div key={`${q.key}-opt-${oi}`} className="flex gap-2">
              <Input
                className="h-8"
                value={opt.value}
                placeholder="Value"
                onChange={(e) => {
                  const options = q.options.map((o, i) =>
                    i === oi ? { ...o, value: e.target.value } : o,
                  );
                  patch({ options });
                }}
              />
              <Input
                className="h-8"
                value={opt.label}
                placeholder="Label"
                onChange={(e) => {
                  const options = q.options.map((o, i) =>
                    i === oi ? { ...o, label: e.target.value } : o,
                  );
                  patch({ options });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive"
                onClick={() => patch({ options: q.options.filter((_, i) => i !== oi) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {(showNumeric || showTextLimits) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {showNumeric ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={q.validation.min ?? ''}
                  onChange={(e) =>
                    patch({
                      validation: {
                        ...q.validation,
                        min: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={q.validation.max ?? ''}
                  onChange={(e) =>
                    patch({
                      validation: {
                        ...q.validation,
                        max: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </>
          ) : null}
          {showTextLimits ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Min length</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={q.validation.minLength ?? ''}
                  onChange={(e) =>
                    patch({
                      validation: {
                        ...q.validation,
                        minLength: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max length</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={q.validation.maxLength ?? ''}
                  onChange={(e) =>
                    patch({
                      validation: {
                        ...q.validation,
                        maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </>
          ) : null}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-dashed p-2">
        <Label className="text-xs">Show if (conditional)</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={showIf?.questionId ?? ''}
            onChange={(e) => {
              const questionId = e.target.value;
              if (!questionId) {
                patch({ conditionalLogic: undefined });
                return;
              }
              patch({
                conditionalLogic: {
                  showIf: {
                    questionId,
                    op: showIf?.op ?? 'eq',
                    value: showIf?.value ?? '',
                  },
                },
              });
            }}
          >
            <option value="">Always show</option>
            {earlierQuestions.map((eq, ei) => (
              <option key={eq.key} value={eq.key}>
                Q{ei + 1}: {eq.prompt.slice(0, 40) || eq.key}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            disabled={!showIf?.questionId}
            value={showIf?.op ?? 'eq'}
            onChange={(e) =>
              patch({
                conditionalLogic: {
                  showIf: {
                    questionId: showIf!.questionId,
                    op: e.target.value as FeedbackShowIf['op'],
                    value: showIf?.value ?? '',
                  },
                },
              })
            }
          >
            <option value="eq">equals</option>
            <option value="neq">not equals</option>
            <option value="in">in list</option>
          </select>
          <Input
            className="h-8"
            disabled={!showIf?.questionId}
            placeholder="Value"
            value={
              Array.isArray(showIf?.value)
                ? showIf!.value.join(',')
                : showIf?.value != null
                  ? String(showIf.value)
                  : ''
            }
            onChange={(e) => {
              const raw = e.target.value;
              const value =
                showIf?.op === 'in'
                  ? raw
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : raw;
              patch({
                conditionalLogic: {
                  showIf: {
                    questionId: showIf!.questionId,
                    op: showIf?.op ?? 'eq',
                    value,
                  },
                },
              });
            }}
          />
        </div>
      </div>

      <FeedbackQuestionPreview question={previewQuestion} />
    </div>
  );
}

export function NaacFeedbackPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [audienceFilter, setAudienceFilter] = useState<string>('STUDENT');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
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
    const qs = (campaign?.questions ?? []) as any[];
    setDraftQuestions(qs.map((q, i) => mapCampaignQuestion(q, i)));
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
      const seeded = await seedFeedbackDefaults(created.id);
      await qc.invalidateQueries({ queryKey: ['feedback-campaigns'] });
      syncDraftFromSelected(seeded);
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
          id: q.key,
          prompt: q.prompt.trim(),
          description: q.description?.trim() || undefined,
          helpText: q.helpText?.trim() || undefined,
          placeholder: q.placeholder?.trim() || undefined,
          category: q.category,
          required: q.required,
          sortOrder: (i + 1) * 10,
          questionType: q.questionType,
          options: CHOICE_TYPES.has(q.questionType)
            ? q.options.filter((o) => o.value.trim() && o.label.trim())
            : asOptions(q.options, q.questionType),
          validation: q.validation ?? {},
          conditionalLogic: q.conditionalLogic?.showIf?.questionId ? q.conditionalLogic : {},
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

  const handleExport = async (kind: 'xlsx' | 'pdf') => {
    if (!selectedId) return;
    setExporting(kind);
    setError('');
    try {
      if (kind === 'xlsx') await downloadFeedbackExportXlsx(selectedId);
      else await downloadFeedbackExportPdf(selectedId);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setExporting(null);
    }
  };

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
                Multi-type questions (Likert, choice, text, numeric, and more). Default questions
                are seeded for the selected audience; you can edit them afterward.
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
                    Multi-type questions with options, validation, conditional show-if, and live
                    preview. Group by category and mark required items.
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
                    <FeedbackQuestionEditor
                      key={q.key}
                      question={q}
                      index={idx}
                      earlierQuestions={draftQuestions.slice(0, idx)}
                      onChange={(next) =>
                        setDraftQuestions((prev) =>
                          prev.map((row) => (row.key === q.key ? next : row)),
                        )
                      }
                      onRemove={() =>
                        setDraftQuestions((prev) => prev.filter((row) => row.key !== q.key))
                      }
                    />
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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Anonymous analytics</CardTitle>
                      <CardDescription>
                        Aggregates without names. Use Responses below for trackable admin view.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exporting !== null}
                        onClick={() => handleExport('xlsx')}
                      >
                        {exporting === 'xlsx' ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                        )}
                        Export Excel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exporting !== null}
                        onClick={() => handleExport('pdf')}
                      >
                        {exporting === 'pdf' ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1 h-3.5 w-3.5" />
                        )}
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    Total responses: <strong>{analyticsQ.data?.responseCount ?? 0}</strong>
                  </p>
                  {(analyticsQ.data?.questions ?? []).map((q: any) => (
                    <div key={q.questionId} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium">{q.prompt}</div>
                      <div className="mt-1 text-muted-foreground">
                        {q.category} ·{' '}
                        {FEEDBACK_QUESTION_TYPE_LABELS[q.questionType as FeedbackQuestionType] ??
                          q.questionType}{' '}
                        · Avg {q.average ?? '—'} · n={q.responseCount ?? 0}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(q.distribution ?? []).map((d: any) => (
                          <Badge key={d.rating ?? d.label} variant="outline">
                            {d.label}: {d.count}
                          </Badge>
                        ))}
                      </div>
                      {Array.isArray(q.sampleTexts) && q.sampleTexts.length ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">
                            Sample responses
                          </div>
                          <ul className="list-inside list-disc text-xs text-muted-foreground">
                            {q.sampleTexts.slice(0, 8).map((t: string, i: number) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
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
                      {Array.isArray(r.answers) && r.answers.length ? (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          {r.answers.slice(0, 12).map((a: any) => (
                            <div key={a.questionId} className="text-xs">
                              <span className="text-muted-foreground">
                                {a.prompt ?? a.questionId}:{' '}
                              </span>
                              <span className="font-medium">{answerDisplay(a)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
