'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  FileText,
  ImagePlus,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { AdvancedAudiencePanel } from '@/components/communication/audience/advanced-audience-panel';
import {
  compactAudienceFilter,
  EMPTY_AUDIENCE_FILTER,
  LARGE_BROADCAST_THRESHOLD,
  migrateLegacyAudience,
  titleAudienceSuggestions,
} from '@/components/communication/audience/audience-filter.utils';
import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { VariablePicker } from '@/components/communication/compose/variable-picker';
import { CHANNEL_OPTIONS } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createCommunicationCampaign,
  fetchChannelHealth,
  fetchCommunicationTemplates,
  sendCommunicationCampaign,
  submitApproval,
  uploadCommunicationAttachment,
  type CommunicationAttachment,
} from '@/services/communication';
import type { AudienceCountResult, AudienceFilter } from '@/types/communication';
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
  const [audienceCount, setAudienceCount] = useState<AudienceCountResult | null>(null);
  const [approvalAck, setApprovalAck] = useState(false);
  const defaultChannels = useMemo(() => initialChannels(channelParam), [channelParam]);

  const [compose, setCompose] = useState({
    name: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    messageType: (channelParam === 'PUSH' ? 'PUSH' : 'EMAIL') as string,
    audienceType: searchParams.get('audienceType') || 'STUDENTS',
    audienceFilter: { ...EMPTY_AUDIENCE_FILTER } as AudienceFilter,
    channels: defaultChannels as string[],
    templateId: '',
    scheduledAt: '',
    recurrence: 'immediate',
  });

  useEffect(() => {
    const segmentId = searchParams.get('segmentId');
    const filterParam = searchParams.get('audienceFilter');
    const typeParam = searchParams.get('audienceType');
    if (typeParam || filterParam) {
      let parsed: AudienceFilter = { ...EMPTY_AUDIENCE_FILTER };
      if (filterParam) {
        try {
          parsed = { ...EMPTY_AUDIENCE_FILTER, ...(JSON.parse(filterParam) as AudienceFilter) };
        } catch {
          /* ignore bad query */
        }
      }
      const migrated = migrateLegacyAudience(typeParam || 'STUDENTS', parsed);
      setCompose((c) => ({
        ...c,
        audienceType: migrated.audienceType,
        audienceFilter: migrated.filter,
      }));
    }
    if (segmentId) {
      // Segment payload is applied via audienceFilter query from Audience Builder.
      void segmentId;
    }
  }, [searchParams]);

  const templates = useQuery({
    queryKey: ['communication', 'templates'],
    queryFn: () => fetchCommunicationTemplates(),
    enabled,
  });

  const channelHealth = useQuery({
    queryKey: ['communication', 'channel-health'],
    queryFn: fetchChannelHealth,
    enabled,
    staleTime: 60_000,
  });

  const pushSelected = compose.channels.includes('PUSH');
  const pushDevices = channelHealth.data?.push?.activeDevices ?? 0;
  const pushReady =
    Boolean(channelHealth.data?.push?.connected) &&
    !channelHealth.data?.push?.demoMode &&
    pushDevices > 0;

  const suggestions = useMemo(
    () => titleAudienceSuggestions(compose.subject || compose.name),
    [compose.subject, compose.name],
  );

  const requiresApproval = (audienceCount?.total ?? 0) >= LARGE_BROADCAST_THRESHOLD;

  const save = useMutation({
    mutationFn: async (sendNow: boolean) => {
      if (sendNow && requiresApproval && !approvalAck) {
        throw new Error(
          `This broadcast reaches ${audienceCount?.total ?? 0} recipients (≥ ${LARGE_BROADCAST_THRESHOLD}). Acknowledge the approval warning or save as draft for review.`,
        );
      }
      const campaign = await createCommunicationCampaign({
        name: compose.name || compose.subject,
        subject: compose.subject,
        bodyText: compose.bodyText,
        bodyHtml: compose.bodyHtml || `<p>${compose.bodyText.replace(/\n/g, '<br/>')}</p>`,
        audienceType: compose.audienceType,
        audienceFilter: compactAudienceFilter(compose.audienceFilter),
        channels: compose.channels,
        templateId: compose.templateId || undefined,
        scheduledAt: compose.scheduledAt || undefined,
        attachments,
        metadata: {
          messageType: compose.messageType,
          recurrence: compose.recurrence,
          requiresApproval,
          estimatedRecipients: audienceCount?.total ?? null,
        },
      });
      if (sendNow) {
        if (requiresApproval) {
          try {
            await submitApproval(campaign.id);
          } catch {
            /* Campaign already has requiresApproval; Approvals list still shows it. */
          }
          return {
            campaign,
            sendNow: false,
            pendingApproval: true,
          };
        }
        await sendCommunicationCampaign(campaign.id);
      }
      return { campaign, sendNow, pendingApproval: false };
    },
    onSuccess: ({ sendNow, pendingApproval }) => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      if (pendingApproval) {
        setMessage({
          text: `Campaign saved and marked for approval (≥ ${LARGE_BROADCAST_THRESHOLD} recipients). Send from Approvals after review.`,
          tone: 'ok',
        });
        return;
      }
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
            message.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {requiresApproval ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>
              Large broadcast: <strong>{audienceCount?.total ?? '…'}</strong> recipients (threshold{' '}
              {LARGE_BROADCAST_THRESHOLD}). This cannot send immediately — confirm below the message
              to enable <strong>Submit for approval</strong>.
            </p>
          </div>
        </div>
      ) : null}

      {suggestions.length ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Audience suggestions from title
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.description}
                className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs hover:bg-muted/60"
                onClick={() =>
                  setCompose((c) => {
                    const nextType = s.audienceType ?? c.audienceType;
                    const migrated = migrateLegacyAudience(nextType, {
                      ...c.audienceFilter,
                      ...s.patch,
                    });
                    return {
                      ...c,
                      audienceType: migrated.audienceType,
                      audienceFilter: migrated.filter,
                    };
                  })
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Campaign name</label>
              <Input
                className="mt-1"
                value={compose.name}
                onChange={(e) => setCompose((c) => ({ ...c, name: e.target.value }))}
                placeholder="Internal label"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message type</label>
              <select
                className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                value={compose.messageType}
                onChange={(e) => setCompose((c) => ({ ...c, messageType: e.target.value }))}
              >
                {MESSAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Subject / Title</label>
            <Input
              className="mt-1"
              value={compose.subject}
              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              placeholder="Visible to recipients"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Body</label>
            <div className="mt-1">
              <RichTextEditor
                value={compose.bodyHtml || compose.bodyText}
                onChange={(html) =>
                  setCompose((c) => ({
                    ...c,
                    bodyHtml: html,
                    bodyText: html
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim(),
                  }))
                }
              />
            </div>
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
            {pushSelected && !channelHealth.isLoading ? (
              <div
                className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                  pushReady
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                }`}
              >
                {pushReady ? (
                  <p>
                    Push ready: {pushDevices} device{pushDevices === 1 ? '' : 's'} with FCM tokens.
                    In-App still works even if a phone has no token.
                  </p>
                ) : (
                  <p>
                    Push will fail for most users right now — <strong>{pushDevices} devices</strong>{' '}
                    have an FCM token
                    {channelHealth.data?.push?.demoMode
                      ? ' (FCM is in demo mode)'
                      : !channelHealth.data?.push?.connected
                        ? ' (FCM not connected)'
                        : ''}
                    . Students must open the latest APK, allow notifications, and stay logged in.
                    Keep <strong>In-App Notification</strong> checked so the inbox still receives
                    the message.
                  </p>
                )}
              </div>
            ) : null}
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
              <option value="weekly">Weekly (metadata only)</option>
              <option value="monthly">Monthly (metadata only)</option>
              <option value="yearly">Yearly (metadata only)</option>
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

          <div>
            <label className="text-sm font-medium">Attachments</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0], 'image')}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0], 'pdf')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="mr-1 h-4 w-4" />
                Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => pdfInputRef.current?.click()}
              >
                <FileText className="mr-1 h-4 w-4" />
                PDF
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

          {requiresApproval ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <p className="mb-2">
                You are targeting <strong>{audienceCount?.total ?? 0}</strong> people (everyone with
                no extra filters). Confirm to unlock approval submit.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={approvalAck}
                  onChange={(e) => setApprovalAck(e.target.checked)}
                />
                I understand this requires approval before delivery
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => save.mutate(false)}
              disabled={save.isPending || uploading}
            >
              Save draft
            </Button>
            <Button
              onClick={() => save.mutate(true)}
              disabled={
                save.isPending ||
                uploading ||
                !compose.subject.trim() ||
                (requiresApproval && !approvalAck)
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {requiresApproval ? 'Submit for approval' : 'Send now'}
            </Button>
            {!compose.subject.trim() ? (
              <p className="w-full text-xs text-muted-foreground">
                Add a title/subject to enable send.
              </p>
            ) : requiresApproval && !approvalAck ? (
              <p className="w-full text-xs text-amber-800 dark:text-amber-200">
                Tick the approval checkbox above to enable Submit for approval.
              </p>
            ) : null}
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto rounded-2xl border border-border/80 bg-card p-5">
          <AdvancedAudiencePanel
            audienceType={compose.audienceType}
            filter={compose.audienceFilter}
            onAudienceTypeChange={(audienceType) => {
              setApprovalAck(false);
              setCompose((c) => ({ ...c, audienceType }));
            }}
            onFilterChange={(audienceFilter) => {
              setApprovalAck(false);
              setCompose((c) => ({ ...c, audienceFilter }));
            }}
            onCountChange={setAudienceCount}
            showSavedAudiences
          />

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
