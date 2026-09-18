'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge, WaCard } from '../whatsapp/whatsapp-ui';
import {
  adjustSmsCredits,
  cancelSmsCampaign,
  defaultSmsGateway,
  downloadSmsExport,
  fetchSmsCampaigns,
  fetchSmsDashboard,
  fetchSmsDlt,
  fetchSmsGateways,
  fetchSmsMessages,
  fetchSmsSettings,
  fetchSmsTemplates,
  previewSms,
  previewSmsRecipients,
  retrySms,
  saveSmsDltTemplate,
  saveSmsGateway,
  saveSmsHeader,
  saveSmsSettings,
  saveSmsTemplate,
  sendSmsCampaign,
  testSmsGateway,
} from '@/services/school-sms';

const LINKS = [
  ['Dashboard', '/admin/school-sis/sms'],
  ['Send', '/admin/school-sis/sms/send'],
  ['Templates', '/admin/school-sis/sms/templates'],
  ['Campaigns', '/admin/school-sis/sms/campaigns'],
  ['Scheduled', '/admin/school-sis/sms/scheduled'],
  ['Delivery', '/admin/school-sis/sms/delivery'],
  ['History', '/admin/school-sis/sms/history'],
  ['Failed', '/admin/school-sis/sms/failed'],
  ['DLT', '/admin/school-sis/sms/dlt'],
  ['Gateways', '/admin/school-sis/sms/gateways'],
  ['Credits', '/admin/school-sis/sms/credits'],
  ['Settings', '/admin/school-sis/sms/settings'],
] as const;

export function SmsDesk() {
  const path = usePathname() ?? '';
  const section =
    path.split('/').filter(Boolean).at(-1) === 'sms'
      ? 'dashboard'
      : path.split('/').filter(Boolean).at(-1)!;
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const [body, setBody] = useState(
    "Dear {parent_name}, fee of Rs.{amount} for {student_name}, {class_name} is pending. - St. Luke's School",
  );
  const [search, setSearch] = useState('');
  const [audienceType, setAudienceType] = useState('CLASS');

  const dash = useQuery({ queryKey: ['sms-dash'], queryFn: fetchSmsDashboard, enabled: ready });
  const templates = useQuery({
    queryKey: ['sms-tpl'],
    queryFn: fetchSmsTemplates,
    enabled: ready,
  });
  const campaigns = useQuery({
    queryKey: ['sms-camp'],
    queryFn: fetchSmsCampaigns,
    enabled: ready && ['campaigns', 'scheduled'].includes(section),
  });
  const messages = useQuery({
    queryKey: ['sms-msg', section],
    queryFn: () => fetchSmsMessages({ status: section === 'failed' ? 'FAILED' : undefined }),
    enabled: ready && ['history', 'delivery', 'failed'].includes(section),
  });
  const gateways = useQuery({
    queryKey: ['sms-gw'],
    queryFn: fetchSmsGateways,
    enabled: ready && ['gateways', 'credits', 'send', 'dashboard'].includes(section),
  });
  const dlt = useQuery({
    queryKey: ['sms-dlt'],
    queryFn: fetchSmsDlt,
    enabled: ready && section === 'dlt',
  });
  const settings = useQuery({
    queryKey: ['sms-set'],
    queryFn: fetchSmsSettings,
    enabled: ready && ['settings', 'credits'].includes(section),
  });
  const preview = useQuery({
    queryKey: ['sms-prev', body],
    queryFn: () =>
      previewSms({
        template: body,
        variables: {
          parent_name: 'Mary',
          amount: '3600',
          student_name: 'Adrian D. Sangma',
          class_name: 'VIII A',
        },
      }),
    enabled: ready && section === 'send',
  });

  const kpis = (dash.data?.kpis ?? {}) as Record<string, number>;
  const segs = preview.data as
    | { chars?: number; segments?: number; preview?: string; missing?: string[] }
    | undefined;

  function onErr(err: unknown) {
    setNotice(apiErrorMessage(err));
  }

  const sendMut = useMutation({
    mutationFn: () =>
      sendSmsCampaign({
        name: 'Office SMS',
        category: 'GENERAL',
        smsKind: 'SERVICE',
        body,
        sendNow: true,
        audience: { type: audienceType, recipient: 'PARENT', search: search || undefined },
      }),
    onSuccess: () => {
      setConfirm(null);
      setNotice(
        'Campaign queued. Delivery will update from the gateway callback — accepted is not delivered.',
      );
      void qc.invalidateQueries({ queryKey: ['sms-dash'] });
    },
    onError: onErr,
  });

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Communication
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">SMS</h1>
        <p className="mt-1 text-sm text-slate-500">
          Multi-gateway school SMS with DLT checks, queued sending, and delivery callbacks.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1">
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium ring-1',
              path === href
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-600 ring-slate-200',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {notice ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
      ) : null}

      {section === 'dashboard' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['SMS balance', kpis.balance],
              ['Sent today', kpis.sentToday],
              ['Delivered', kpis.delivered],
              ['Failed', kpis.failed],
              ['Pending', kpis.pending],
              ['This month', kpis.monthCount],
              ['Delivery rate', `${kpis.deliveryRate ?? 0}%`],
              ['Failed rate', `${kpis.failedRate ?? 0}%`],
              ['Estimated cost', `₹${kpis.estimatedCost ?? 0}`],
            ].map(([l, v]) => (
              <WaCard key={String(l)} label={String(l)} value={String(v ?? 0)} />
            ))}
          </div>
          <WaCard label="Gateway health">
            {((dash.data?.gateways as Array<Record<string, unknown>>) ?? []).map((g) => (
              <p key={String(g.id)} className="text-sm">
                {String(g.name)} · {String(g.provider)} · {String(g.health)}{' '}
                {g.isDefault ? '(default)' : ''}
              </p>
            ))}
            {!((dash.data?.gateways as unknown[]) ?? []).length ? (
              <p className="text-sm text-slate-500">No gateway configured yet.</p>
            ) : null}
          </WaCard>
        </>
      ) : null}

      {section === 'send' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <WaCard className="space-y-3 p-5" label="Composer">
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {['INDIVIDUAL', 'CLASS', 'SECTION', 'STAFF', 'CUSTOM'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student / admission / mobile"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500">
              {segs?.chars ?? 0} characters · {segs?.segments ?? 1} SMS segment
              {segs?.missing?.length ? ` · missing {${segs.missing.join(', ')}}` : ''}
            </p>
            <PrimaryButton
              type="button"
              onClick={() =>
                previewSmsRecipients({
                  type: audienceType,
                  recipient: 'PARENT',
                  search,
                  category: 'GENERAL',
                })
                  .then((r) => setConfirm(r))
                  .catch(onErr)
              }
            >
              Review recipients
            </PrimaryButton>
          </WaCard>
          <WaCard className="p-5" label="Phone preview">
            <div className="mx-auto w-64 rounded-[2rem] border bg-slate-900 p-4 text-sm text-white shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                St. Luke&apos;s School
              </p>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed">
                {String(segs?.preview ?? body)}
              </p>
            </div>
          </WaCard>
        </div>
      ) : null}

      {section === 'templates' ? (
        <TemplatesPanel
          rows={templates.data ?? []}
          onSave={(p) =>
            saveSmsTemplate(p)
              .then(() => qc.invalidateQueries({ queryKey: ['sms-tpl'] }))
              .catch(onErr)
          }
        />
      ) : null}

      {['campaigns', 'scheduled'].includes(section) ? (
        <WaCard className="overflow-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Campaign</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Recipients</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(campaigns.data ?? [])
                .filter((c) => section !== 'scheduled' || c.status === 'SCHEDULED')
                .map((c) => (
                  <tr key={String(c.id)} className="border-t">
                    <td className="px-3 py-2">{String(c.name)}</td>
                    <td className="px-3 py-2">
                      <WaBadge value={String(c.status)} />
                    </td>
                    <td className="px-3 py-2">{String(c.recipientCount)}</td>
                    <td className="px-3 py-2">
                      <GhostButton
                        type="button"
                        onClick={() =>
                          cancelSmsCampaign(String(c.id)).then(() =>
                            qc.invalidateQueries({ queryKey: ['sms-camp'] }),
                          )
                        }
                      >
                        Cancel
                      </GhostButton>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {['history', 'delivery', 'failed'].includes(section) ? (
        <WaCard className="overflow-auto p-0">
          <div className="flex justify-end gap-2 p-3">
            <GhostButton type="button" onClick={() => void downloadSmsExport('xlsx')}>
              Excel
            </GhostButton>
            <GhostButton type="button" onClick={() => void downloadSmsExport('pdf')}>
              PDF
            </GhostButton>
          </div>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Recipient</th>
                <th className="px-3 py-2 text-left">Mobile</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(messages.data ?? []).map((m) => (
                <tr key={String(m.id)} className="border-t">
                  <td className="px-3 py-2">{String(m.recipientName ?? '—')}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(m.mobile)}</td>
                  <td className="px-3 py-2">
                    <WaBadge value={String(m.status)} />
                  </td>
                  <td className="px-3 py-2">
                    {m.status === 'FAILED' ? (
                      <GhostButton
                        type="button"
                        onClick={() => retrySms(String(m.id)).catch(onErr)}
                      >
                        Retry
                      </GhostButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {section === 'dlt' ? (
        <DltPanel
          data={dlt.data}
          onHeader={(p) =>
            saveSmsHeader(p)
              .then(() => qc.invalidateQueries({ queryKey: ['sms-dlt'] }))
              .catch(onErr)
          }
          onTpl={(p) =>
            saveSmsDltTemplate(p)
              .then(() => qc.invalidateQueries({ queryKey: ['sms-dlt'] }))
              .catch(onErr)
          }
        />
      ) : null}

      {section === 'gateways' ? (
        <GatewayPanel
          rows={gateways.data ?? []}
          onSave={(p) =>
            saveSmsGateway(p)
              .then(() => qc.invalidateQueries({ queryKey: ['sms-gw'] }))
              .catch(onErr)
          }
          onTest={(id) =>
            testSmsGateway(id)
              .then(() => setNotice('Gateway configuration valid.'))
              .catch(onErr)
          }
          onDefault={(id) =>
            defaultSmsGateway(id)
              .then(() => qc.invalidateQueries({ queryKey: ['sms-gw'] }))
              .catch(onErr)
          }
        />
      ) : null}

      {section === 'credits' ? (
        <WaCard className="max-w-lg space-y-3 p-5" label="Credits">
          <p className="text-3xl font-semibold">
            {String(
              (settings.data as { manualBalance?: number } | undefined)?.manualBalance ??
                kpis.balance ??
                0,
            )}
          </p>
          <PrimaryButton
            type="button"
            onClick={() =>
              adjustSmsCredits(1000, 'Manual top-up').then(() =>
                qc.invalidateQueries({ queryKey: ['sms-set'] }),
              )
            }
          >
            Add 1,000 credits
          </PrimaryButton>
        </WaCard>
      ) : null}

      {section === 'settings' ? (
        <WaCard className="max-w-xl space-y-2 p-5" label="SMS settings">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={
                (settings.data as { failoverEnabled?: boolean } | undefined)?.failoverEnabled
              }
              onChange={(e) => saveSmsSettings({ failoverEnabled: e.target.checked }).catch(onErr)}
            />
            Enable automatic failover
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={
                (settings.data as { enforceDlt?: boolean } | undefined)?.enforceDlt !== false
              }
              onChange={(e) => saveSmsSettings({ enforceDlt: e.target.checked }).catch(onErr)}
            />
            Enforce DLT for promotional SMS
          </label>
        </WaCard>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Confirm SMS campaign</h2>
            <p className="text-sm text-slate-600">
              Recipients: {String(confirm.valid)} · Missing: {String(confirm.missing)} · Segments:{' '}
              {segs?.segments ?? 1}
            </p>
            <p className="text-xs text-slate-500">
              Messages are queued. Gateway acceptance is not treated as delivered until the callback
              arrives.
            </p>
            <div className="flex justify-end gap-2">
              <GhostButton type="button" onClick={() => setConfirm(null)}>
                Cancel
              </GhostButton>
              <PrimaryButton
                type="button"
                disabled={sendMut.isPending}
                onClick={() => sendMut.mutate()}
              >
                Confirm & send
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TemplatesPanel({
  rows,
  onSave,
}: {
  rows: Array<Record<string, unknown>>;
  onSave: (p: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  return (
    <div className="space-y-3">
      <WaCard className="flex flex-wrap gap-2 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="rounded-lg border px-3 py-2"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Body"
          className="min-w-[240px] flex-1 rounded-lg border px-3 py-2"
        />
        <PrimaryButton
          type="button"
          disabled={!name || !text}
          onClick={() => onSave({ name, body: text, category: 'GENERAL' })}
        >
          Save
        </PrimaryButton>
      </WaCard>
      {rows.map((t) => (
        <WaCard key={String(t.id)} className="p-4">
          <p className="font-medium">{String(t.name)}</p>
          <p className="text-xs text-slate-500">{String(t.key)}</p>
          <p className="mt-2 text-sm">{String(t.body)}</p>
        </WaCard>
      ))}
    </div>
  );
}

function DltPanel({
  data,
  onHeader,
  onTpl,
}: {
  data?: Record<string, unknown>;
  onHeader: (p: Record<string, unknown>) => void;
  onTpl: (p: Record<string, unknown>) => void;
}) {
  const [header, setHeader] = useState('STLUKE');
  const [dltId, setDltId] = useState('');
  const entity = (data?.entity ?? {}) as { id?: string; name?: string };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WaCard className="space-y-2 p-5" label="Principal entity">
        <p className="text-sm">{entity.name || "St. Luke's Secondary School"}</p>
        <p className="text-xs text-slate-500">Entity ID: {entity.id || 'Not set'}</p>
        <input
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <PrimaryButton type="button" onClick={() => onHeader({ header, status: 'DRAFT' })}>
          Add header
        </PrimaryButton>
        <ul className="text-sm">
          {((data?.headers as Array<Record<string, unknown>>) ?? []).map((h) => (
            <li key={String(h.id)}>
              {String(h.header)} · {String(h.status)}
            </li>
          ))}
        </ul>
      </WaCard>
      <WaCard className="space-y-2 p-5" label="Content templates">
        <input
          value={dltId}
          onChange={(e) => setDltId(e.target.value)}
          placeholder="DLT template ID"
          className="w-full rounded-lg border px-3 py-2"
        />
        <PrimaryButton
          type="button"
          disabled={!dltId}
          onClick={() =>
            onTpl({
              name: dltId,
              dltTemplateId: dltId,
              templateText: 'Registered content',
              status: 'DRAFT',
            })
          }
        >
          Add DLT template
        </PrimaryButton>
        <ul className="text-sm">
          {((data?.templates as Array<Record<string, unknown>>) ?? []).map((t) => (
            <li key={String(t.id)}>
              {String(t.dltTemplateId)} · {String(t.status)}
            </li>
          ))}
        </ul>
      </WaCard>
    </div>
  );
}

function GatewayPanel({
  rows,
  onSave,
  onTest,
  onDefault,
}: {
  rows: Array<Record<string, unknown>>;
  onSave: (p: Record<string, unknown>) => void;
  onTest: (id: string) => void;
  onDefault: (id: string) => void;
}) {
  const [name, setName] = useState('Apitxt OTP');
  const [provider, setProvider] = useState('APITXT');
  const [apiKey, setApiKey] = useState('');
  const [otpTemplateId, setOtpTemplateId] = useState('');
  const [otpChannel, setOtpChannel] = useState('sms');
  return (
    <div className="space-y-3">
      <WaCard className="grid gap-2 p-5 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border px-3 py-2"
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-lg border px-3 py-2"
        >
          {['APITXT', 'MSG91', 'TWILIO', 'EXOTEL', 'CUSTOM_HTTP'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API key / authkey (stored encrypted)"
          className="rounded-lg border px-3 py-2 sm:col-span-2"
        />
        {provider === 'APITXT' ? (
          <>
            <input
              value={otpTemplateId}
              onChange={(e) => setOtpTemplateId(e.target.value)}
              placeholder="OTP template_id (optional)"
              className="rounded-lg border px-3 py-2"
            />
            <select
              value={otpChannel}
              onChange={(e) => setOtpChannel(e.target.value)}
              className="rounded-lg border px-3 py-2"
            >
              <option value="sms">SMS OTP</option>
              <option value="whatsapp">WhatsApp OTP</option>
              <option value="voice">Voice OTP</option>
            </select>
          </>
        ) : null}
        <PrimaryButton
          type="button"
          onClick={() =>
            onSave({
              name,
              provider,
              apiKey,
              status: 'ACTIVE',
              ...(provider === 'APITXT' ? { otpTemplateId, otpChannel, otpCountry: '91' } : {}),
            })
          }
        >
          Save gateway
        </PrimaryButton>
      </WaCard>
      {rows.map((g) => (
        <WaCard
          key={String(g.id)}
          className="flex flex-wrap items-center justify-between gap-2 p-4"
        >
          <div>
            <p className="font-medium">
              {String(g.name)} {g.isDefault ? '· default' : ''}
            </p>
            <p className="text-xs text-slate-500">
              {String(g.provider)} · {String(g.status)} · {String(g.health)} · key{' '}
              {g.hasApiKey ? 'set' : 'missing'}
            </p>
          </div>
          <div className="flex gap-2">
            <GhostButton type="button" onClick={() => onTest(String(g.id))}>
              Test
            </GhostButton>
            <PrimaryButton type="button" onClick={() => onDefault(String(g.id))}>
              Set default
            </PrimaryButton>
          </div>
        </WaCard>
      ))}
    </div>
  );
}
