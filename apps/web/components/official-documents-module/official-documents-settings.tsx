'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import { fetchOfficialDocumentSettings } from '@/services/official-documents';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';

export function OfficialDocumentsSettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['official-documents', 'settings'],
    queryFn: fetchOfficialDocumentSettings,
  });

  const [defaultPrefix, setDefaultPrefix] = useState('DBC');
  const [referencePattern, setReferencePattern] = useState('{PREFIX}/{TYPE}/{YEAR}/{SEQ:4}');
  const [verifyBaseUrl, setVerifyBaseUrl] = useState('');

  useEffect(() => {
    if (!settings.data) return;
    setDefaultPrefix(settings.data.defaultPrefix ?? 'DBC');
    setReferencePattern(settings.data.referencePattern ?? '{PREFIX}/{TYPE}/{YEAR}/{SEQ:4}');
    setVerifyBaseUrl(settings.data.verifyBaseUrl ?? '');
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      api.patch('/v1/admin/official-documents/settings/config', {
        defaultPrefix,
        referencePattern,
        verifyBaseUrl: verifyBaseUrl || undefined,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['official-documents', 'settings'] }),
  });

  if (settings.isLoading) {
    return (
      <OfficialDocumentsShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings…
        </p>
      </OfficialDocumentsShell>
    );
  }

  return (
    <OfficialDocumentsShell title="Document Settings">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Official Documents Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reference numbers are auto-generated on publish. Configure format patterns here.
          </p>
        </div>

        <form
          className="space-y-3 rounded-2xl border border-border/60 bg-card/85 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
        >
          <label className="block text-xs font-medium">
            Default prefix
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={defaultPrefix}
              onChange={(e) => setDefaultPrefix(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Reference pattern
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-mono"
              value={referencePattern}
              onChange={(e) => setReferencePattern(e.target.value)}
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Tokens: {'{PREFIX}'} {'{TYPE}'} {'{YEAR}'} {'{SEQ:4}'}
            </span>
          </label>
          <label className="block text-xs font-medium">
            Verify base URL
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={verifyBaseUrl}
              onChange={(e) => setVerifyBaseUrl(e.target.value)}
              placeholder="https://portal.donboscocollege.ac.in"
            />
          </label>
          <Button type="submit" size="sm" disabled={saveMut.isPending}>
            {saveMut.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
          {saveMut.isError ? (
            <p className="text-sm text-destructive">
              {apiErrorMessage(saveMut.error, 'Save failed')}
            </p>
          ) : null}
        </form>
      </div>
    </OfficialDocumentsShell>
  );
}
