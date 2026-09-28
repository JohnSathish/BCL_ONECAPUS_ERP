'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { ERPField, erpSelectClass } from '@/components/erp/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchQuestionBankSettings, updateQuestionBankSettings } from '@/services/website-cms';
import type { QuestionBankSettings } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type SettingsForm = QuestionBankSettings;

export function QuestionBankSettingsPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['website', 'question-bank', 'settings'],
    queryFn: fetchQuestionBankSettings,
  });
  const [form, setForm] = useState<SettingsForm | null>(null);

  useEffect(() => {
    if (settings.data) {
      const { downloadMode, pageSize, intro } = settings.data;
      setForm({ downloadMode, pageSize, intro });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (payload: SettingsForm) => updateQuestionBankSettings(payload),
    onSuccess: () => {
      onMessage('Question bank settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'question-bank'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save settings')),
  });

  return (
    <CompactCard>
      <CompactCardHeader
        title="Public page settings"
        description="Controls how the Question Bank page behaves on the college website."
      />
      <CompactCardBody>
        {settings.isLoading || !form ? (
          <p className="text-sm text-muted-foreground">
            {settings.isError
              ? apiErrorMessage(settings.error, 'Could not load settings')
              : 'Loading settings…'}
          </p>
        ) : (
          <form
            className="grid max-w-2xl grid-cols-1 gap-x-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <ERPField
              label="Download button behaviour"
              htmlFor="qb-download-mode"
              helper="Applies to the Download PDF button on every paper."
            >
              <select
                id="qb-download-mode"
                className={erpSelectClass}
                value={form.downloadMode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    downloadMode: event.target.value as SettingsForm['downloadMode'],
                  })
                }
              >
                <option value="NEW_TAB">Open PDF in a new tab</option>
                <option value="DOWNLOAD">Download the PDF file</option>
              </select>
            </ERPField>
            <ERPField label="Papers per page" htmlFor="qb-page-size" helper="Between 5 and 50.">
              <Input
                id="qb-page-size"
                type="number"
                min={5}
                max={50}
                required
                value={form.pageSize}
                onChange={(event) => setForm({ ...form, pageSize: Number(event.target.value) })}
                className="h-9 text-sm"
              />
            </ERPField>
            <ERPField
              className="sm:col-span-2"
              label="Intro text"
              htmlFor="qb-intro"
              helper="Shown under the page heading. Up to 400 characters."
              optional
            >
              <textarea
                id="qb-intro"
                rows={3}
                maxLength={400}
                value={form.intro}
                onChange={(event) => setForm({ ...form, intro: event.target.value })}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </ERPField>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </form>
        )}
      </CompactCardBody>
    </CompactCard>
  );
}
