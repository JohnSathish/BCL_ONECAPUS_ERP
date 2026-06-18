'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchCommunicationSettings,
  saveCommunicationSettings,
  seedAutomationRules,
  toggleAutomationRule,
  fetchAutomationRules,
} from '@/services/communication';

export function CommunicationSettingsForm() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['communication', 'settings'],
    queryFn: fetchCommunicationSettings,
    enabled,
  });

  const automation = useQuery({
    queryKey: ['communication', 'automation'],
    queryFn: fetchAutomationRules,
    enabled,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      saveCommunicationSettings({
        defaultSenderName: form.defaultSenderName ?? settings.data?.defaultSenderName,
        replyEmail: form.replyEmail ?? settings.data?.replyEmail,
        smsSenderId: form.smsSenderId ?? settings.data?.smsSenderId,
        whatsappBusinessNumber:
          form.whatsappBusinessNumber ?? settings.data?.whatsappBusinessNumber,
        footerTemplate: form.footerTemplate ?? settings.data?.footerTemplate,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication', 'settings'] }),
  });

  const seedRules = useMutation({
    mutationFn: seedAutomationRules,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication', 'automation'] }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled: on }: { id: string; enabled: boolean }) =>
      toggleAutomationRule(id, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication', 'automation'] }),
  });

  const s = settings.data;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
        <h2 className="font-semibold">Institution Settings</h2>
        <Input
          placeholder="Default sender name"
          defaultValue={s?.defaultSenderName ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, defaultSenderName: e.target.value }))}
        />
        <Input
          placeholder="Reply email"
          defaultValue={s?.replyEmail ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, replyEmail: e.target.value }))}
        />
        <Input
          placeholder="SMS Sender ID"
          defaultValue={s?.smsSenderId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, smsSenderId: e.target.value }))}
        />
        <Input
          placeholder="WhatsApp Business Number"
          defaultValue={s?.whatsappBusinessNumber ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, whatsappBusinessNumber: e.target.value }))}
        />
        <textarea
          className="min-h-[80px] w-full rounded-xl border border-border/80 px-3 py-2 text-sm"
          placeholder="Email footer template"
          defaultValue={s?.footerTemplate ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, footerTemplate: e.target.value }))}
        />
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Save settings
        </Button>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Automation Rules</h2>
          <Button size="sm" variant="outline" onClick={() => seedRules.mutate()}>
            Seed defaults
          </Button>
        </div>
        <div className="space-y-2">
          {(automation.data ?? []).map(
            (rule: { id: string; name: string; category: string; isEnabled: boolean }) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">{rule.category}</p>
                </div>
                <Button
                  size="sm"
                  variant={rule.isEnabled ? 'default' : 'outline'}
                  onClick={() => toggle.mutate({ id: rule.id, enabled: !rule.isEnabled })}
                >
                  {rule.isEnabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
