'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge } from '../whatsapp/whatsapp-ui';
import { SmsDashboard } from './sms-dashboard';
import { SmsSendPanel } from './sms-send-panel';
import { SmsEmpty, SmsPanel, SmsShell } from './sms-ui';
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
  retrySms,
  saveSmsDltTemplate,
  saveSmsGateway,
  saveSmsHeader,
  saveSmsSettings,
  saveSmsTemplate,
  testSmsGateway,
} from '@/services/school-sms';

export function SmsDesk() {
  const path = usePathname() ?? '';
  const section =
    path.split('/').filter(Boolean).at(-1) === 'sms'
      ? 'dashboard'
      : path.split('/').filter(Boolean).at(-1)!;
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

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

  const kpis = (dash.data?.kpis ?? {}) as Record<string, number>;

  function onErr(err: unknown) {
    setNotice(apiErrorMessage(err));
  }

  return (
    <SmsShell notice={notice}>
      {section === 'dashboard' ? (
        <SmsDashboard
          kpis={kpis}
          activity={
            (Array.isArray(dash.data?.activity) ? dash.data?.activity : []) as Array<{
              date: string;
              label: string;
              sent: number;
              delivered: number;
              failed: number;
            }>
          }
          recent={
            (Array.isArray(dash.data?.recent) ? dash.data?.recent : []) as Array<{
              id?: string;
              recipientName?: string | null;
              mobile?: string;
              status?: string;
              createdAt?: string;
            }>
          }
          gateways={
            (Array.isArray(dash.data?.gateways)
              ? dash.data?.gateways
              : (gateways.data ?? [])) as Array<{
              id?: string;
              name?: string;
              provider?: string;
              health?: string;
              isDefault?: boolean;
            }>
          }
          loading={dash.isLoading}
          onTestGateway={(id) =>
            testSmsGateway(id)
              .then((res) =>
                setNotice(
                  res.connected
                    ? `Gateway connected (${String(res.provider)}).`
                    : Array.isArray(res.issues) && res.issues.length
                      ? res.issues.join(' ')
                      : 'Gateway test finished.',
                ),
              )
              .catch(onErr)
          }
        />
      ) : null}

      {section === 'send' ? <SmsSendPanel onNotice={setNotice} onError={onErr} /> : null}

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
        <SmsPanel title={section === 'scheduled' ? 'Scheduled campaigns' : 'Campaigns'}>
          {(campaigns.data ?? []).filter((c) => section !== 'scheduled' || c.status === 'SCHEDULED')
            .length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead
                  className="text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
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
                      <tr key={String(c.id)}>
                        <td className="px-3 py-2 font-medium">{String(c.name)}</td>
                        <td className="px-3 py-2">
                          <WaBadge value={String(c.status)} />
                        </td>
                        <td className="px-3 py-2">{String(c.recipientCount)}</td>
                        <td className="px-3 py-2 text-right">
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
            </div>
          ) : (
            <SmsEmpty
              title={section === 'scheduled' ? 'No scheduled SMS' : 'No campaigns yet'}
              hint="Create a campaign from Send SMS. Queued and scheduled runs will appear here."
            />
          )}
        </SmsPanel>
      ) : null}

      {['history', 'delivery', 'failed'].includes(section) ? (
        <SmsPanel
          title={
            section === 'failed'
              ? 'Failed messages'
              : section === 'delivery'
                ? 'Delivery reports'
                : 'SMS history'
          }
          action={
            <div className="flex gap-2">
              <GhostButton type="button" onClick={() => void downloadSmsExport('xlsx')}>
                Excel
              </GhostButton>
              <GhostButton type="button" onClick={() => void downloadSmsExport('pdf')}>
                PDF
              </GhostButton>
            </div>
          }
        >
          {(messages.data ?? []).length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead
                  className="sticky top-0 text-xs uppercase"
                  style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
                >
                  <tr>
                    <th className="px-3 py-2 text-left">Recipient</th>
                    <th className="px-3 py-2 text-left">Mobile</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Detail</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(messages.data ?? []).map((m) => (
                    <tr key={String(m.id)}>
                      <td className="px-3 py-2 font-medium">{String(m.recipientName ?? '—')}</td>
                      <td className="px-3 py-2 font-mono text-xs">{String(m.mobile)}</td>
                      <td className="px-3 py-2">
                        <WaBadge value={String(m.status)} />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {m.providerMessageId
                          ? `Ref ${String(m.providerMessageId)}`
                          : m.errorMessage
                            ? String(m.errorMessage)
                            : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
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
            </div>
          ) : (
            <SmsEmpty
              title={section === 'failed' ? 'No failed messages' : 'No messages yet'}
              hint="Delivery, history, and failures will list here after you send SMS."
            />
          )}
        </SmsPanel>
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
              .then((res) =>
                setNotice(
                  res.connected
                    ? `Gateway connected (${String(res.provider)}).`
                    : Array.isArray(res.issues) && res.issues.length
                      ? res.issues.join(' ')
                      : 'Gateway test finished.',
                ),
              )
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
        <SmsPanel title="SMS credits">
          <p
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--heading, #0f172a)' }}
          >
            {Number(
              (settings.data as { manualBalance?: number } | undefined)?.manualBalance ??
                kpis.balance ??
                0,
            ).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
            Credits remaining for this tenant
          </p>
          <div className="mt-4">
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
          </div>
        </SmsPanel>
      ) : null}

      {section === 'contacts' ? (
        <SmsPanel title="Contacts / Recipients">
          <SmsEmpty
            title="Reach parents and staff from Send"
            hint="Use CLASS, SECTION, STAFF, or search a student to build the recipient list."
          />
        </SmsPanel>
      ) : null}

      {section === 'settings' ? (
        <SmsPanel title="SMS settings">
          <div className="max-w-xl space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={
                  (settings.data as { failoverEnabled?: boolean } | undefined)?.failoverEnabled
                }
                onChange={(e) =>
                  saveSmsSettings({ failoverEnabled: e.target.checked }).catch(onErr)
                }
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
          </div>
        </SmsPanel>
      ) : null}
    </SmsShell>
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
      <SmsPanel title="Create template">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="rounded-lg px-3 py-2"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Body"
            className="min-w-[240px] flex-1 rounded-lg px-3 py-2"
          />
          <PrimaryButton
            type="button"
            disabled={!name || !text}
            onClick={() => onSave({ name, body: text, category: 'GENERAL' })}
          >
            Save
          </PrimaryButton>
        </div>
      </SmsPanel>
      {rows.length ? (
        rows.map((t) => (
          <SmsPanel key={String(t.id)} title={String(t.name)}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
              {String(t.key)}
            </p>
            <p className="mt-2 text-sm">{String(t.body)}</p>
          </SmsPanel>
        ))
      ) : (
        <SmsPanel title="Saved templates">
          <SmsEmpty
            title="No templates yet"
            hint="Save a reusable template to send fee, attendance, and notice SMS faster."
          />
        </SmsPanel>
      )}
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
      <SmsPanel title="Principal entity">
        <div className="space-y-2">
          <p className="text-sm">{entity.name || "St. Luke's Secondary School"}</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
            Entity ID: {entity.id || 'Not set'}
          </p>
          <input
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full rounded-lg px-3 py-2"
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
        </div>
      </SmsPanel>
      <SmsPanel title="Content templates">
        <div className="space-y-2">
          <input
            value={dltId}
            onChange={(e) => setDltId(e.target.value)}
            placeholder="DLT template ID"
            className="w-full rounded-lg px-3 py-2"
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
        </div>
      </SmsPanel>
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
      <SmsPanel title="Add gateway">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg px-3 py-2"
          />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg px-3 py-2"
          >
            {['APITXT', 'MSG91', 'TWILIO', 'EXOTEL', 'CUSTOM_HTTP'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key / authkey (stored encrypted)"
            className="rounded-lg px-3 py-2 sm:col-span-2"
          />
          {provider === 'APITXT' ? (
            <>
              <input
                value={otpTemplateId}
                onChange={(e) => setOtpTemplateId(e.target.value)}
                placeholder="OTP template_id (optional)"
                className="rounded-lg px-3 py-2"
              />
              <select
                value={otpChannel}
                onChange={(e) => setOtpChannel(e.target.value)}
                className="rounded-lg px-3 py-2"
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
        </div>
      </SmsPanel>
      {rows.length ? (
        rows.map((g) => (
          <SmsPanel
            key={String(g.id)}
            title={`${String(g.name)}${g.isDefault ? ' · default' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
                {String(g.provider)} · {String(g.status)} · {String(g.health)} · key{' '}
                {g.hasApiKey ? 'set' : 'missing'}
              </p>
              <div className="flex gap-2">
                <GhostButton type="button" onClick={() => onTest(String(g.id))}>
                  Test
                </GhostButton>
                <PrimaryButton type="button" onClick={() => onDefault(String(g.id))}>
                  Set default
                </PrimaryButton>
              </div>
            </div>
          </SmsPanel>
        ))
      ) : (
        <SmsPanel title="Registered gateways">
          <SmsEmpty
            title="No gateway yet"
            hint="Add Apitxt or another provider to send OTP and school SMS."
          />
        </SmsPanel>
      )}
    </div>
  );
}
