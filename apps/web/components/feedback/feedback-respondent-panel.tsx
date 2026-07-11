'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchMyFeedbackCampaigns, submitMyFeedback } from '@/services/feedback';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function groupByCategory<T extends { category: string; sortOrder: number }>(questions: T[]) {
  const map = new Map<string, T[]>();
  for (const q of [...questions].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = q.category || 'OVERALL';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(q);
  }
  return [...map.entries()];
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
  const [answers, setAnswers] = useState<Record<string, number>>({});
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

  const scale = listQ.data?.scale ?? [];
  const sections = useMemo(() => groupByCategory(active?.questions ?? []), [active?.questions]);

  const submitMut = useMutation({
    mutationFn: () => {
      if (!active) throw new Error('Select a form');
      const payload: Array<{ questionId: string; rating: number }> = [];
      for (const q of active.questions ?? []) {
        const rating = answers[q.id];
        if (q.required && !rating) throw new Error(`Please answer: ${q.prompt}`);
        if (rating) payload.push({ questionId: q.id, rating });
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

      {active?.canSubmit && active.questions?.length ? (
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
                {questions.map((q, idx) => (
                  <div key={q.id} className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {idx + 1}. {q.prompt}
                      {q.required ? <span className="text-red-600"> *</span> : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {scale.map((s) => {
                        const selected = answers[q.id] === s.rating;
                        return (
                          <button
                            key={s.rating}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: s.rating }))}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background hover:bg-muted',
                            )}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
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
