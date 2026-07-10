'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ImagePlus, Paperclip, Send, Trash2, Users, X } from 'lucide-react';

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
  uploadCommunicationAttachment,
  type CommunicationAttachment,
} from '@/services/communication';
import { fetchDepartments } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

const MESSAGE_TYPES = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'CIRCULAR', 'NOTICE'] as const;

function initialChannels(channelParam: string | null) {
  if (channelParam === 'PUSH') return ['PUSH', 'IN_APP'];
  if (channelParam && CHANNEL_OPTIONS.some((c) => c.value === channelParam)) {
    return [channelParam];
  }
  return ['IN_APP', 'EMAIL'];
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SmartComposeForm() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const searchParams = useSearchParams();
  const channelParam = searchParams.get('channel');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [attachments, setAttachments] = useState<CommunicationAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const defaultChannels = useMemo(() => initialChannels(channelParam), [channelParam]);
  const [compose, setCompose] = useState({
    name: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    messageType: (channelParam === 'PUSH' ? 'PUSH' : 'EMAIL') as string,
    audienceType: 'STUDENTS',
    departmentIds: [] as string[],
    channels: defaultChannels as string[],
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
        attachments,
        metadata: { messageType: compose.messageType, recurrence: compose.recurrence },
      });
      if (sendNow) await sendCommunicationCampaign(campaign.id);
      return { campaign, sendNow };
    },
    onSuccess: ({ sendNow }) => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      setMessage({
        text: sendNow
          ? 'Campaign queued for delivery. Check Logs / Push Center for status.'
          : 'Campaign saved as draft.',
        tone: 'ok',
      });
    },
    onError: (e) => setMessage({ text: apiErrorMessage(e, 'Failed'), tone: 'error' }),
  });

  const insertVariable = (token: string) => {
    setCompose((c) => ({
      ...c,
      bodyText: c.bodyText + token,
      bodyHtml: c.bodyHtml + token,
    }));
  };

  async function onPickFile(file: File | undefined, kind: 'image' | 'pdf') {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const uploaded = await uploadCommunicationAttachment(file);
      setAttachments((prev) => {
        const withoutSameType = prev.filter((a) => a.type !== kind);
        return [...withoutSameType, uploaded];
      });
      setMessage({ text: `${kind === 'image' ? 'Image' : 'PDF'} attached.`, tone: 'ok' });
    } catch (e) {
      setMessage({ text: apiErrorMessage(e, 'Upload failed'), tone: 'error' });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-border/80 bg-muted/40 text-foreground'
          }`}
        >
          {message.text}
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
            placeholder="Plain text fallback (SMS / Push body)"
            value={compose.bodyText}
            onChange={(e) => setCompose((c) => ({ ...c, bodyText: e.target.value }))}
          />

          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Paperclip className="h-4 w-4" />
              Attachments
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Optional image (shown in push) and one PDF (linked in app / email). Images ≤ 5 MB, PDF
              ≤ 10 MB.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void onPickFile(e.target.files?.[0], 'image')}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => void onPickFile(e.target.files?.[0], 'pdf')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Upload image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => pdfInputRef.current?.click()}
              >
                <FileText className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </div>
            {attachments.length ? (
              <ul className="mt-3 space-y-2">
                {attachments.map((a) => (
                  <li
                    key={`${a.type}-${a.url}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {a.type === 'image' ? 'Image' : 'PDF'}: {a.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No attachments yet.</p>
            )}
          </div>

          <VariablePicker onInsert={insertVariable} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
              <Users className="mr-2 h-4 w-4" />
              Preview audience
            </Button>
            <Button
              variant="outline"
              onClick={() => save.mutate(false)}
              disabled={save.isPending || uploading}
            >
              Save draft
            </Button>
            <Button
              onClick={() => save.mutate(true)}
              disabled={save.isPending || uploading || !compose.subject}
            >
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
          {attachments.length ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                Ready to send
              </div>
              {attachments.map((a) => (
                <div key={a.url} className="flex items-center gap-1">
                  {a.type === 'image' ? (
                    <ImagePlus className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  <span className="truncate">{a.name}</span>
                  <button
                    type="button"
                    className="ml-auto"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
