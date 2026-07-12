'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeedbackQuestionField } from '@/components/feedback/feedback-question-field';
import {
  answerToPayload,
  isQuestionVisible,
  type FeedbackAnswerValue,
  type FeedbackQuestionDto,
} from '@/components/feedback/feedback-question-types';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchMyFeedbackCampaigns, submitMyFeedback } from '@/services/feedback';
import { apiErrorMessage } from '@/utils/api-error';

function groupByCategory<T extends { category: string; sortOrder: number }>(questions: T[]) {
  const map = new Map<string, T[]>();
  for (const q of [...questions].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = q.category || 'OVERALL';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(q);
  }
  return [...map.entries()];
}

function hasAnswer(value: FeedbackAnswerValue | undefined): boolean {
  if (!value) return false;
  if (value.rating != null) return true;
  if (value.valueBool != null) return true;
  if (value.valueNumber != null && !Number.isNaN(value.valueNumber)) return true;
  if (value.valueText != null && String(value.valueText).trim() !== '') return true;
  if (value.valueDate != null && String(value.valueDate).trim() !== '') return true;
  if (Array.isArray(value.valueJson) && value.valueJson.length > 0) return true;
  if (value.valueJson && typeof value.valueJson === 'object' && !Array.isArray(value.valueJson)) {
    const url = (value.valueJson as { url?: string }).url;
    return Boolean(url && String(url).trim());
  }
  return false;
}

export function FeedbackRespondentPanel({
  audience,
  heading,
  description,
}: {
  audience: 'STUDENT' | 'TEACHER' | 'ALUMNI';
  heading: string;
  description: string;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswerValue>>({});
  const [error, setError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const listQ = useQuery({
    queryKey: ['my-feedback-campaigns', audience],
    queryFn: () => fetchMyFeedbackCampaigns(audience),
    enabled,
  });

  const active = useMemo(
    () => listQ.data?.items.find((i) => i.id === activeId) ?? null,
    [listQ.data, activeId],
  );

  const visibleQuestions = useMemo(() => {
    const qs = (active?.questions ?? []) as FeedbackQuestionDto[];
    return qs.filter((q) => isQuestionVisible(q, answers));
  }, [active?.questions, answers]);

  const sections = useMemo(() => groupByCategory(visibleQuestions), [visibleQuestions]);

  const submitMut = useMutation({
    mutationFn: () => {
      if (!active) throw new Error('Select a form');
      const payload: Array<Record<string, unknown>> = [];
      for (const q of visibleQuestions) {
        const value = answers[q.id];
        if (q.required && !hasAnswer(value)) {
          throw new Error(`Please answer: ${q.prompt}`);
        }
        if (hasAnswer(value)) {
          payload.push(answerToPayload(q.id, value!));
        }
      }
      if (!payload.length) throw new Error('Please answer at least one question.');
      return submitMyFeedback(active.id, payload);
    },
    onSuccess: async (res: any) => {
      setError('');
      setDoneMsg(res?.message ?? 'Submitted');
      setAnswers({});
      setActiveId(null);
      await qc.invalidateQueries({ queryKey: ['my-feedback-campaigns'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-1">
      <div>
        <h1 className="text-xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {doneMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {doneMsg}
        </div>
      ) : null}

      <div className="space-y-3">
        {(listQ.data?.items ?? []).map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>
                    {item.academicYear}
                    {item.startsAt || item.endsAt
                      ? ` · Window ${item.startsAt ? new Date(item.startsAt).toLocaleDateString('en-IN') : '—'} to ${item.endsAt ? new Date(item.endsAt).toLocaleDateString('en-IN') : '—'}`
                      : ''}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.alreadySubmitted ? (
                    <Badge className="bg-emerald-600">Submitted</Badge>
                  ) : item.canSubmit ? (
                    <Badge>Open</Badge>
                  ) : (
                    <Badge variant="secondary">Closed</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.closedReason && !item.canSubmit ? (
                <p className="text-sm text-muted-foreground">{item.closedReason}</p>
              ) : null}
              {item.canSubmit ? (
                <Button
                  variant={activeId === item.id ? 'default' : 'outline'}
                  onClick={() => {
                    setActiveId(item.id);
                    setAnswers({});
                    setDoneMsg('');
                    setError('');
                  }}
                >
                  {activeId === item.id ? 'Filling this form' : 'Give feedback'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {!listQ.data?.items?.length && !listQ.isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No feedback forms are available right now.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {active?.canSubmit && visibleQuestions.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{active.title}</CardTitle>
            <CardDescription>
              {active.instructions ||
                'Kindly select the appropriate option as per the following criteria.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map(([category, questions]) => (
              <div key={category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category.replace(/_/g, ' ')}
                </p>
                {questions.map((q) => (
                  <div key={q.id} className="rounded-xl border p-3">
                    <FeedbackQuestionField
                      question={q}
                      value={answers[q.id]}
                      onChange={(next) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: next,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
            <Button
              className="w-full"
              disabled={submitMut.isPending}
              onClick={() => submitMut.mutate()}
            >
              {submitMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Submit feedback
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
