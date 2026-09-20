'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  addSchoolWaNote,
  connectSchoolWaEmbedded,
  fetchSchoolWaAccounts,
  fetchSchoolWaAnalytics,
  fetchSchoolWaAutomations,
  fetchSchoolWaCampaigns,
  fetchSchoolWaContacts,
  fetchSchoolWaConversation,
  fetchSchoolWaConversations,
  fetchSchoolWaDashboard,
  fetchSchoolWaDelivery,
  fetchSchoolWaEmbeddedConfig,
  fetchSchoolWaFlows,
  fetchSchoolWaLogs,
  fetchSchoolWaMedia,
  fetchSchoolWaOptIns,
  fetchSchoolWaSettings,
  fetchSchoolWaTemplates,
  patchSchoolWaConversation,
  previewSchoolWaAudience,
  saveSchoolWaAccount,
  saveSchoolWaAutomation,
  saveSchoolWaCampaign,
  saveSchoolWaNumber,
  saveSchoolWaSettings,
  saveSchoolWaTemplate,
  sendSchoolWaCampaign,
  sendSchoolWaTemplate,
  sendSchoolWaText,
  syncSchoolWaContacts,
  syncSchoolWaTemplates,
  testSchoolWaConnection,
} from '@/services/school-whatsapp';
import { apiErrorMessage } from '@/utils/api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, MessageCircle, Send, XCircle } from 'lucide-react';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import { PrimaryButton, GhostButton } from '../academic/academic-ui';
import { WhatsappDashboard } from './whatsapp-dashboard';
import { WaBadge, WaEmpty, WaPanel, WaShell } from './whatsapp-ui';

function sectionOf(pathname: string | null) {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  const i = parts.indexOf('whatsapp');
  return parts[i + 1] ?? 'dashboard';
}

export function WhatsappDesk() {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ['school-wa-dash'], queryFn: fetchSchoolWaDashboard, enabled });
  const accounts = useQuery({
    queryKey: ['school-wa-accounts'],
    queryFn: fetchSchoolWaAccounts,
    enabled,
  });
  const templates = useQuery({
    queryKey: ['school-wa-templates'],
    queryFn: fetchSchoolWaTemplates,
    enabled,
  });
  const campaigns = useQuery({
    queryKey: ['school-wa-campaigns'],
    queryFn: fetchSchoolWaCampaigns,
    enabled: enabled && ['dashboard', 'campaigns', 'scheduled'].includes(section),
  });
  const inbox = useQuery({
    queryKey: ['school-wa-inbox'],
    queryFn: () => fetchSchoolWaConversations(),
    enabled: enabled && section === 'inbox',
  });
  const contacts = useQuery({
    queryKey: ['school-wa-contacts'],
    queryFn: () => fetchSchoolWaContacts(),
    enabled: enabled && ['contacts', 'messaging', 'opt-in'].includes(section),
  });
  const delivery = useQuery({
    queryKey: ['school-wa-delivery'],
    queryFn: () => fetchSchoolWaDelivery(),
    enabled: enabled && section === 'delivery',
  });
  const settings = useQuery({
    queryKey: ['school-wa-settings'],
    queryFn: fetchSchoolWaSettings,
    enabled: enabled && section === 'settings',
  });
  const embedded = useQuery({
    queryKey: ['school-wa-embedded'],
    queryFn: fetchSchoolWaEmbeddedConfig,
    enabled: enabled && section === 'settings' && canManage,
  });
  const automations = useQuery({
    queryKey: ['school-wa-auto'],
    queryFn: fetchSchoolWaAutomations,
    enabled: enabled && section === 'automation',
  });
  const optIns = useQuery({
    queryKey: ['school-wa-optin'],
    queryFn: fetchSchoolWaOptIns,
    enabled: enabled && section === 'opt-in',
  });
  const media = useQuery({
    queryKey: ['school-wa-media'],
    queryFn: fetchSchoolWaMedia,
    enabled: enabled && section === 'media',
  });
  const flows = useQuery({
    queryKey: ['school-wa-flows'],
    queryFn: fetchSchoolWaFlows,
    enabled: enabled && section === 'flows',
  });
  const analytics = useQuery({
    queryKey: ['school-wa-analytics'],
    queryFn: () => fetchSchoolWaAnalytics(),
    enabled: enabled && section === 'analytics',
  });
  const logs = useQuery({
    queryKey: ['school-wa-logs'],
    queryFn: fetchSchoolWaLogs,
    enabled: enabled && section === 'logs',
  });

  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [accountName, setAccountName] = useState('School General');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignTpl, setCampaignTpl] = useState('');
  const [audienceKind, setAudienceKind] = useState('CLASS');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendTpl, setSendTpl] = useState('');

  const chat = useQuery({
    queryKey: ['school-wa-chat', chatId],
    queryFn: () => fetchSchoolWaConversation(chatId!),
    enabled: Boolean(chatId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['school-wa-dash'] });
    qc.invalidateQueries({ queryKey: ['school-wa-accounts'] });
    qc.invalidateQueries({ queryKey: ['school-wa-templates'] });
    qc.invalidateQueries({ queryKey: ['school-wa-campaigns'] });
  };

  const connectManual = useMutation({
    mutationFn: async () => {
      const rows = await saveSchoolWaAccount({
        name: accountName,
        wabaId,
        accessToken: token || undefined,
        webhookVerifyToken: verifyToken || undefined,
      });
      const account = Array.isArray(rows) ? rows[0] : rows?.[0];
      if (phoneNumberId && account?.id) {
        await saveSchoolWaNumber({
          accountId: account.id,
          name: accountName,
          displayPhone: displayPhone || phoneNumberId,
          phoneNumberId,
          isDefault: true,
        });
      }
    },
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const kpis = dash.data?.kpis;
  const conn = dash.data?.connection;

  return (
    <WaShell notice={error}>
      {section === 'dashboard' ? (
        <WhatsappDashboard
          kpis={kpis}
          activity={Array.isArray(dash.data?.activity) ? dash.data.activity : []}
          campaigns={
            (campaigns.data ?? dash.data?.recentCampaigns ?? []) as Array<{
              id?: string;
              name?: string;
              sentCount?: number;
              deliveredCount?: number;
              readCount?: number;
              failedCount?: number;
              status?: string;
              validCount?: number;
            }>
          }
          connection={conn}
          loading={dash.isLoading}
          onReconnect={() =>
            testSchoolWaConnection()
              .then(invalidate)
              .catch((e) => setError(apiErrorMessage(e)))
          }
        />
      ) : null}

      {section === 'settings' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <WaPanel title="Meta Cloud API">
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
                Tokens are encrypted at rest and never returned. Embedded Signup v4 is the supported
                onboarding path (v2 is deprecated 15 Oct 2026).
              </p>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Display name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="WABA ID"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Phone Number ID"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Display phone +91…"
                value={displayPhone}
                onChange={(e) => setDisplayPhone(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Access token (leave blank to keep)"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <GhostButton type="button" onClick={() => setShowToken((v) => !v)}>
                  {showToken ? 'Hide' : 'Show'}
                </GhostButton>
              </div>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Webhook verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
              />
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton
                    disabled={connectManual.isPending}
                    onClick={() => connectManual.mutate()}
                  >
                    Save connection
                  </PrimaryButton>
                  <GhostButton
                    onClick={() =>
                      testSchoolWaConnection()
                        .then(invalidate)
                        .catch((e) => setError(apiErrorMessage(e)))
                    }
                  >
                    Test connection
                  </GhostButton>
                </div>
              ) : null}
              <p className="text-xs text-slate-400">
                Webhook URL: /api/v1/school-sis/public/whatsapp/webhooks/meta · App ID:{' '}
                {embedded.data?.appId || 'set SCHOOL_WHATSAPP_EMBEDDED_APP_ID'} · Config:{' '}
                {embedded.data?.configId || 'set SCHOOL_WHATSAPP_EMBEDDED_CONFIG_ID'}
              </p>
            </div>
          </WaPanel>
          <WaPanel title="Numbers">
            <div className="space-y-3">
              {(accounts.data ?? []).map((acc: Record<string, unknown>) => (
                <div key={String(acc.id)} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{String(acc.name)}</p>
                    <WaBadge value={String(acc.status)} />
                  </div>
                  <p className="text-xs text-slate-500">WABA {String(acc.wabaId ?? '—')}</p>
                  {(acc.numbers as Array<Record<string, unknown>> | undefined)?.map((n) => (
                    <p key={String(n.id)} className="mt-1 text-xs">
                      {String(n.name)} · {String(n.displayPhone)} {n.isDefault ? '(Default)' : ''}
                    </p>
                  ))}
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(settings.data?.optInRequired)}
                  onChange={(e) =>
                    saveSchoolWaSettings({ optInRequired: e.target.checked }).then(() =>
                      qc.invalidateQueries({ queryKey: ['school-wa-settings'] }),
                    )
                  }
                />
                Require opt-in for non-essential categories
              </label>
              <GhostButton
                onClick={() =>
                  connectSchoolWaEmbedded({ code: 'session-from-facebook-login' }).catch((e) =>
                    setError(apiErrorMessage(e)),
                  )
                }
              >
                Complete Embedded Signup (after Meta login)
              </GhostButton>
            </div>
          </WaPanel>
        </div>
      ) : null}

      {section === 'templates' ? (
        <div className="space-y-3">
          <WaPanel
            title="Template library"
            action={
              canManage ? (
                <PrimaryButton
                  onClick={() =>
                    syncSchoolWaTemplates()
                      .then(invalidate)
                      .catch((e) => setError(apiErrorMessage(e)))
                  }
                >
                  Sync from Meta
                </PrimaryButton>
              ) : null
            }
          >
            <p className="mb-3 text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
              DRAFT rows are school library copies. Meta status is stored separately and is the
              source of truth for sending.
            </p>
            {(templates.data ?? []).length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead
                    className="text-xs uppercase"
                    style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                  >
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Language</th>
                      <th className="px-3 py-2 text-left">Local</th>
                      <th className="px-3 py-2 text-left">Meta</th>
                      <th className="px-3 py-2 text-left">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(templates.data ?? []).map((t: Record<string, unknown>) => (
                      <tr key={String(t.id)}>
                        <td className="px-3 py-2 font-medium">{String(t.name)}</td>
                        <td className="px-3 py-2">{String(t.category)}</td>
                        <td className="px-3 py-2">{String(t.language)}</td>
                        <td className="px-3 py-2">
                          <WaBadge value={String(t.status)} />
                        </td>
                        <td className="px-3 py-2">{String(t.metaStatus ?? '—')}</td>
                        <td className="px-3 py-2">{String(t.usedCount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <WaEmpty
                title="No templates yet"
                hint="Sync from Meta or save a local draft. Only APPROVED Meta templates can be sent."
              />
            )}
          </WaPanel>
          {canManage ? (
            <WaPanel title="New local draft">
              <input
                className="mb-2 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="template_name"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
              <textarea
                className="mb-2 w-full rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="Dear {{1}}…"
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
              />
              <div className="rounded-xl bg-[#0b141a] p-3 text-sm text-[#e9edef]">
                <p className="text-xs text-[#8696a0]">Preview</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {tplBody || 'Template body appears here'}
                </p>
              </div>
              <PrimaryButton
                className="mt-2"
                onClick={() =>
                  saveSchoolWaTemplate({ name: tplName, body: tplBody, category: 'UTILITY' })
                    .then(invalidate)
                    .catch((e) => setError(apiErrorMessage(e)))
                }
              >
                Save draft
              </PrimaryButton>
            </WaPanel>
          ) : null}
        </div>
      ) : null}

      {section === 'contacts' ? (
        <WaPanel
          title="Contacts"
          action={
            canManage ? (
              <PrimaryButton
                onClick={() =>
                  syncSchoolWaContacts().then(() =>
                    qc.invalidateQueries({ queryKey: ['school-wa-contacts'] }),
                  )
                }
              >
                Sync from ERP
              </PrimaryButton>
            ) : null
          }
        >
          {(contacts.data ?? []).length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead
                  className="text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Window</th>
                  </tr>
                </thead>
                <tbody>
                  {(contacts.data ?? []).map((c: Record<string, unknown>) => (
                    <tr key={String(c.id)}>
                      <td className="px-3 py-2 font-medium">{String(c.displayName)}</td>
                      <td className="px-3 py-2">+{String(c.phoneE164)}</td>
                      <td className="px-3 py-2">
                        {(c.student as { fullName?: string } | undefined)?.fullName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.windowExpiresAt && new Date(String(c.windowExpiresAt)) > new Date()
                          ? 'OPEN'
                          : 'CLOSED'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WaEmpty
              title="No contacts yet"
              hint="Sync from students, guardians and staff. Phone numbers stay in the ERP."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'inbox' ? (
        <WaPanel title="Inbox" flush>
          <div className="grid min-h-[520px] lg:grid-cols-[280px_1fr]">
            <div className="border-r">
              {(inbox.data ?? []).map((c: Record<string, unknown>) => (
                <button
                  key={String(c.id)}
                  type="button"
                  onClick={() => setChatId(String(c.id))}
                  className={`block w-full border-b px-3 py-3 text-left text-sm ${chatId === c.id ? 'bg-sky-50' : ''}`}
                >
                  <p className="font-medium">
                    {(c.contact as { displayName?: string })?.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{String(c.lastPreview ?? '')}</p>
                </button>
              ))}
              {!inbox.data?.length ? (
                <p className="p-6 text-sm text-slate-500">No conversations yet.</p>
              ) : null}
            </div>
            <div className="flex flex-col">
              {chat.data ? (
                <>
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                      <p className="font-semibold">{chat.data.contact?.displayName}</p>
                      <p className="text-xs text-slate-500">
                        Window {chat.data.window?.open ? 'OPEN' : 'CLOSED'} · Student{' '}
                        {chat.data.contact?.student?.fullName ?? '—'}
                      </p>
                    </div>
                    <GhostButton
                      onClick={() =>
                        patchSchoolWaConversation(chat.data.id, { status: 'RESOLVED' })
                      }
                    >
                      Close
                    </GhostButton>
                  </div>
                  <div className="flex-1 space-y-2 overflow-auto bg-[#efeae2] p-4">
                    {(chat.data.messages ?? []).map((m: Record<string, unknown>) => (
                      <div
                        key={String(m.id)}
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          m.direction === 'OUT' ? 'ml-auto bg-[#d9fdd3]' : 'bg-white'
                        }`}
                      >
                        <p>{String(m.body ?? '')}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {String(m.status)} {m.failureReason ? `· ${m.failureReason}` : ''}
                        </p>
                      </div>
                    ))}
                    {(chat.data.notes ?? []).map((n: Record<string, unknown>) => (
                      <p
                        key={String(n.id)}
                        className="text-center text-[11px] italic text-amber-800"
                      >
                        Internal: {String(n.body)}
                      </p>
                    ))}
                  </div>
                  <div className="space-y-2 border-t p-3">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border px-3 py-2 text-sm"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type a reply (24h window)…"
                      />
                      <PrimaryButton
                        onClick={() =>
                          sendSchoolWaText({
                            to: chat.data.contact.phoneE164,
                            body: draft,
                            contactId: chat.data.contact.id,
                            conversationId: chat.data.id,
                          })
                            .then(() => {
                              setDraft('');
                              qc.invalidateQueries({ queryKey: ['school-wa-chat', chatId] });
                            })
                            .catch((e) => setError(apiErrorMessage(e)))
                        }
                      >
                        Send
                      </PrimaryButton>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border px-3 py-2 text-xs"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Private note (never sent to WhatsApp)"
                      />
                      <GhostButton
                        onClick={() =>
                          addSchoolWaNote(chat.data.id, note).then(() => {
                            setNote('');
                            qc.invalidateQueries({ queryKey: ['school-wa-chat', chatId] });
                          })
                        }
                      >
                        Add note
                      </GhostButton>
                    </div>
                  </div>
                </>
              ) : (
                <p className="m-auto text-sm text-slate-500">Select a conversation.</p>
              )}
            </div>
          </div>
        </WaPanel>
      ) : null}

      {section === 'campaigns' || section === 'messaging' || section === 'scheduled' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <WaPanel title={section === 'messaging' ? 'Send a message' : 'Audience & campaign'}>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Campaign name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={campaignTpl}
                onChange={(e) => setCampaignTpl(e.target.value)}
              >
                <option value="">Select approved template</option>
                {(templates.data ?? [])
                  .filter((t: { status: string }) => t.status === 'APPROVED')
                  .map((t: { id: string; name: string }) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={audienceKind}
                onChange={(e) => setAudienceKind(e.target.value)}
              >
                {['INDIVIDUAL', 'CLASS', 'SECTION', 'FEE_DEFAULTERS', 'TRANSPORT', 'STAFF'].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
              <GhostButton
                onClick={() =>
                  previewSchoolWaAudience({ kind: audienceKind })
                    .then(setPreview)
                    .catch((e) => setError(apiErrorMessage(e)))
                }
              >
                Preview audience
              </GhostButton>
              {preview ? (
                <p className="text-sm text-slate-600">
                  Total {String(preview.total)} · Valid {String(preview.valid)} · Invalid{' '}
                  {String(preview.invalid)} · Duplicates removed {String(preview.duplicatesRemoved)}{' '}
                  · Final {String(preview.finalRecipients)}
                </p>
              ) : null}
              <PrimaryButton
                onClick={() =>
                  saveSchoolWaCampaign({
                    name: campaignName,
                    templateId: campaignTpl,
                    audience: { kind: audienceKind },
                  })
                    .then(invalidate)
                    .catch((e) => setError(apiErrorMessage(e)))
                }
              >
                Save draft campaign
              </PrimaryButton>
              {section === 'messaging' ? (
                <div className="border-t pt-3">
                  <input
                    className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Parent mobile"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                  />
                  <select
                    className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
                    value={sendTpl}
                    onChange={(e) => setSendTpl(e.target.value)}
                  >
                    <option value="">Template</option>
                    {(templates.data ?? []).map((t: { id: string; name: string }) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <PrimaryButton
                    onClick={() =>
                      sendSchoolWaTemplate({ to: sendTo, templateId: sendTpl }).catch((e) =>
                        setError(apiErrorMessage(e)),
                      )
                    }
                  >
                    Queue template
                  </PrimaryButton>
                </div>
              ) : null}
            </div>
          </WaPanel>
          <WaPanel title="Campaigns">
            {(campaigns.data ?? []).length ? (
              (campaigns.data ?? []).map((c: Record<string, unknown>) => (
                <div
                  key={String(c.id)}
                  className="flex items-center justify-between border-b px-1 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{String(c.name)}</p>
                    <p className="text-xs text-slate-500">
                      {String(c.validCount)} recipients · <WaBadge value={String(c.status)} />
                    </p>
                  </div>
                  {canManage && c.status !== 'PROCESSING' ? (
                    <GhostButton onClick={() => setConfirmId(String(c.id))}>Send…</GhostButton>
                  ) : null}
                </div>
              ))
            ) : (
              <WaEmpty
                title="No campaigns yet"
                hint="Save a draft campaign, preview the audience, then queue it to Meta."
              />
            )}
          </WaPanel>
        </div>
      ) : null}

      {section === 'delivery' ? (
        <WaPanel title="Delivery status">
          {(delivery.data ?? []).length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead
                  className="text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">Recipient</th>
                    <th className="px-3 py-2 text-left">Message</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Provider ID</th>
                    <th className="px-3 py-2 text-left">Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {(delivery.data ?? []).map((m: Record<string, unknown>) => (
                    <tr key={String(m.id)}>
                      <td className="px-3 py-2">
                        {(m.contact as { displayName?: string })?.displayName}
                      </td>
                      <td className="px-3 py-2">
                        {(m.template as { name?: string })?.name ?? String(m.type)}
                      </td>
                      <td className="px-3 py-2">
                        <WaBadge value={String(m.status)} />
                      </td>
                      <td className="px-3 py-2 text-xs">{String(m.providerMessageId ?? '—')}</td>
                      <td className="px-3 py-2 text-xs text-rose-700">
                        {String(m.failureReason ?? '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WaEmpty
              title="No delivery rows yet"
              hint="Statuses come from Meta webhooks. Delivered and Read are never simulated."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'automation' ? (
        <WaPanel
          title="Keyword automation"
          action={
            canManage ? (
              <GhostButton
                onClick={() =>
                  saveSchoolWaAutomation({
                    name: 'Custom keyword',
                    trigger: 'KEYWORD',
                    matchValue: 'help',
                    action: 'ESCALATE',
                    replyText:
                      'A staff member will contact you. You can also call the school office.',
                    escalateTo: 'OFFICE',
                  }).then(() => qc.invalidateQueries({ queryKey: ['school-wa-auto'] }))
                }
              >
                Add HELP escalation
              </GhostButton>
            ) : null
          }
        >
          {(automations.data ?? []).length ? (
            <div className="space-y-2">
              {(automations.data ?? []).map((a: Record<string, unknown>) => (
                <div key={String(a.id)} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{String(a.name)}</p>
                  <p className="text-xs text-slate-500">
                    If parent sends “{String(a.matchValue)}” → {String(a.action)} · escalate{' '}
                    {String(a.escalateTo ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <WaEmpty
              title="No automations yet"
              hint="Keyword replies run inside the 24-hour window, with office escalation."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'opt-in' ? (
        <WaPanel title="Opt-in / consent">
          {(optIns.data ?? []).length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead
                  className="text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">Contact</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(optIns.data ?? []).map((o: Record<string, unknown>) => (
                    <tr key={String(o.id)}>
                      <td className="px-3 py-2">
                        {(o.contact as { displayName?: string })?.displayName}
                      </td>
                      <td className="px-3 py-2">{String(o.category)}</td>
                      <td className="px-3 py-2">
                        <WaBadge value={String(o.status)} />
                      </td>
                      <td className="px-3 py-2">{String(o.source)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WaEmpty
              title="No consent records"
              hint="Opted-out contacts cannot be silently re-enabled."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'media' ? (
        <WaPanel title="Media library">
          {(media.data ?? []).length ? (
            <div className="space-y-2 text-sm">
              {(media.data as Array<Record<string, unknown>>).map((m) => (
                <p key={String(m.id)}>
                  {String(m.filename)} · {String(m.mimeType)} ·{' '}
                  {String(m.providerMediaId ?? 'not uploaded to Meta')}
                </p>
              ))}
            </div>
          ) : (
            <WaEmpty
              title="No media yet"
              hint="Upload once; SHA-256 reuse avoids duplicate Meta uploads."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'flows' ? (
        <WaPanel title="WhatsApp Flows">
          {(flows.data ?? []).length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(flows.data ?? []).map((f: Record<string, unknown>) => (
                <div key={String(f.id)} className="rounded-xl border p-4">
                  <p className="font-medium">{String(f.name)}</p>
                  <p className="text-xs text-slate-500">{String(f.kind)}</p>
                  <WaBadge value={String(f.status)} />
                </div>
              ))}
            </div>
          ) : (
            <WaEmpty
              title="No flows yet"
              hint="Structured parent interactions prepared for Meta Flows later."
            />
          )}
        </WaPanel>
      ) : null}

      {section === 'analytics' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SlsKpiCard
            tone="sky"
            icon={Send}
            label="Sent"
            value={analytics.data?.sent ?? 0}
            trend="0%"
            trendLabel="vs last 7 days"
          />
          <SlsKpiCard
            tone="emerald"
            icon={CheckCircle2}
            label="Delivery rate"
            value={`${Math.round((analytics.data?.deliveryRate ?? 0) * 100)}%`}
            trend="0%"
            trendLabel="vs last 7 days"
          />
          <SlsKpiCard
            tone="violet"
            icon={MessageCircle}
            label="Read rate"
            value={`${Math.round((analytics.data?.readRate ?? 0) * 100)}%`}
            trend="0%"
            trendLabel="vs last 7 days"
          />
          <SlsKpiCard
            tone="rose"
            icon={XCircle}
            label="Failure rate"
            value={`${Math.round((analytics.data?.failureRate ?? 0) * 100)}%`}
            trend="0%"
            trendLabel="vs last 7 days"
          />
        </div>
      ) : null}

      {section === 'logs' ? (
        <WaPanel title="Logs">
          {(logs.data ?? []).length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead
                  className="text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Recipient</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data ?? []).map((l: Record<string, unknown>) => (
                    <tr key={String(l.id)}>
                      <td className="px-3 py-2 text-xs">
                        {new Date(String(l.createdAt)).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{String(l.action)}</td>
                      <td className="px-3 py-2">{String(l.recipient ?? '—')}</td>
                      <td className="px-3 py-2">{String(l.status ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WaEmpty
              title="No logs yet"
              hint="Who sent what, to whom, with provider message IDs."
            />
          )}
        </WaPanel>
      ) : null}

      <Dialog open={Boolean(confirmId)} onOpenChange={() => setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send campaign?</DialogTitle>
            <DialogDescription>
              Messages are queued to Meta Cloud API. Duplicate numbers were already removed. This
              cannot be undone once queued.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <GhostButton onClick={() => setConfirmId(null)}>Cancel</GhostButton>
            <PrimaryButton
              onClick={() => {
                if (!confirmId) return;
                sendSchoolWaCampaign(confirmId, true)
                  .then(() => {
                    setConfirmId(null);
                    invalidate();
                  })
                  .catch((e) => setError(apiErrorMessage(e)));
              }}
            >
              Send campaign
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WaShell>
  );
}
