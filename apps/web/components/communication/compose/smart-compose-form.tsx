'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Users } from 'lucide-react';

import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { VariablePicker } from '@/components/communication/compose/variable-picker';
import { AUDIENCE_OPTIONS, CHANNEL_OPTIONS } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createCommunicationCampaign,
  fetchCommunicationTemplates,
  previewCommunicationAudience,
  sendCommunicationCampaign,
} from '@/services/communication';
import { fetchDepartments } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

const MESSAGE_TYPES = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'CIRCULAR', 'NOTICE'] as const;

export function SmartComposeForm() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const [message, setMessage] = useState('');
  const [compose, setCompose] = useState({
    name: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    messageType: 'EMAIL' as string,
    audienceType: 'STUDENTS',
    departmentIds: [] as string[],
    channels: ['IN_APP', 'EMAIL'] as string[],
    templateId: '',
    scheduledAt: '',
    recurrence: 'immediate',
  });

  const templates = useQuery({
    queryKey: ['communication', 'templates'],
    queryFn: () => fetchCommunicationTemplates(),
    enabled,
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchDepartments(),
    enabled,
  });

  const preview = useMutation({
    mutationFn: () =>
      previewCommunicationAudience({
        audienceType: compose.audienceType,
        audienceFilter: compose.departmentIds.length
          ? { departmentIds: compose.departmentIds }
          : {},
      }),
  });

  const save = useMutation({
    mutationFn: async (sendNow: boolean) => {
      const campaign = await createCommunicationCampaign({
        name: compose.name || compose.subject,
        subject: compose.subject,
        bodyText: compose.bodyText,
        bodyHtml: compose.bodyHtml || `<p>${compose.bodyText.replace(/\n/g, '<br/>')}</p>`,
        audienceType: compose.audienceType,
        audienceFilter: compose.departmentIds.length
          ? { departmentIds: compose.departmentIds }
          : {},
        channels: compose.channels,
        templateId: compose.templateId || undefined,
        scheduledAt: compose.scheduledAt || undefined,
        metadata: { messageType: compose.messageType, recurrence: compose.recurrence },
      });
      if (sendNow) await sendCommunicationCampaign(campaign.id);
      return campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      setMessage('Campaign saved.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Failed')),
  });

  const insertVariable = (token: string) => {
    setCompose((c) => ({
      ...c,
      bodyText: c.bodyText + token,
      bodyHtml: c.bodyHtml + token,
    }));
  };

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Campaign name"
              value={compose.name}
              onChange={(e) => setCompose((c) => ({ ...c, name: e.target.value }))}
            />
            <select
              className="rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={compose.messageType}
              onChange={(e) => setCompose((c) => ({ ...c, messageType: e.target.value }))}
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Subject"
            value={compose.subject}
            onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
          />
          <RichTextEditor
            value={compose.bodyHtml}
            onChange={(html) =>
              setCompose((c) => ({
                ...c,
                bodyHtml: html,
                bodyText: html.replace(/<[^>]+>/g, ' '),
              }))
            }
          />
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
            placeholder="Plain text fallback (SMS)"
            value={compose.bodyText}
            onChange={(e) => setCompose((c) => ({ ...c, bodyText: e.target.value }))}
          />
          <VariablePicker onInsert={insertVariable} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
              <Users className="mr-2 h-4 w-4" />
              Preview audience
            </Button>
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Save draft
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending || !compose.subject}>
              <Send className="mr-2 h-4 w-4" />
              Send now
            </Button>
          </div>
          {preview.data ? (
            <p className="text-sm text-muted-foreground">
              {preview.data.length} recipients matched
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
          <div>
            <label className="text-sm font-medium">Audience</label>
            <select
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={compose.audienceType}
              onChange={(e) => setCompose((c) => ({ ...c, audienceType: e.target.value }))}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Departments</label>
            <select
              multiple
              className="mt-1 h-28 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={compose.departmentIds}
              onChange={(e) =>
                setCompose((c) => ({
                  ...c,
                  departmentIds: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
            >
              {(departments.data ?? []).map((d: { id: string; name: string }) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Template</label>
            <select
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={compose.templateId}
              onChange={(e) => {
                const tpl = templates.data?.find((t) => t.id === e.target.value);
                setCompose((c) => ({
                  ...c,
                  templateId: e.target.value,
                  subject: tpl?.subject ?? c.subject,
                  bodyText: tpl?.bodyText ?? c.bodyText,
                  bodyHtml: tpl?.bodyHtml ?? c.bodyHtml,
                }));
              }}
            >
              <option value="">— None —</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Channels</label>
            <div className="mt-2 space-y-1 text-sm">
              {CHANNEL_OPTIONS.map((ch) => (
                <label key={ch.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={compose.channels.includes(ch.value)}
                    onChange={(e) =>
                      setCompose((c) => ({
                        ...c,
                        channels: e.target.checked
                          ? [...c.channels, ch.value]
                          : c.channels.filter((x) => x !== ch.value),
                      }))
                    }
                  />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Schedule</label>
            <select
              className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={compose.recurrence}
              onChange={(e) => setCompose((c) => ({ ...c, recurrence: e.target.value }))}
            >
              <option value="immediate">Immediate</option>
              <option value="once">Once (date/time)</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {compose.recurrence !== 'immediate' ? (
              <Input
                type="datetime-local"
                className="mt-2"
                value={compose.scheduledAt}
                onChange={(e) => setCompose((c) => ({ ...c, scheduledAt: e.target.value }))}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
