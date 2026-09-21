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
    enabled: ready && ['gateways', 'credits', 'send', 'dashboard', 'settings'].includes(section),
  });
  const dlt = useQuery({
    queryKey: ['sms-dlt'],
    queryFn: fetchSmsDlt,
    enabled: ready && section === 'dlt',
  });
  const settings = useQuery({
    queryKey: ['sms-set'],
    queryFn: fetchSmsSettings,
    enabled: ready && ['settings', 'credits', 'gateways'].includes(section),
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
          onEntity={(p) =>
            saveSmsSettings(p)
              .then(() => {
                void qc.invalidateQueries({ queryKey: ['sms-dlt'] });
                void qc.invalidateQueries({ queryKey: ['sms-set'] });
                setNotice('Principal Entity ID saved.');
              })
              .catch(onErr)
          }
        />
      ) : null}

      {section === 'gateways' ? (
        <GatewayPanel
          key={(gateways.data ?? []).map((g) => String(g.id)).join(',')}
          rows={gateways.data ?? []}
          onSave={(p) =>
            saveSmsGateway(p, p.id ? String(p.id) : undefined)
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
        <SettingsPanel
          key={`${String((settings.data as { id?: string } | undefined)?.id || 'set')}-${String(
            (gateways.data ?? []).find((g) => String(g.provider) === 'APITXT')?.id || 'gw',
          )}`}
          settings={(settings.data ?? {}) as Record<string, unknown>}
          gateway={
            (gateways.data ?? []).find((g) => String(g.provider) === 'APITXT') ??
            (gateways.data ?? [])[0]
          }
          onErr={onErr}
          onSaved={(msg) => {
            setNotice(msg);
            void qc.invalidateQueries({ queryKey: ['sms-set'] });
            void qc.invalidateQueries({ queryKey: ['sms-gw'] });
            void qc.invalidateQueries({ queryKey: ['sms-cfg'] });
          }}
        />
      ) : null}
    </SmsShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium" style={{ color: 'var(--heading, #0f172a)' }}>
        {label}
      </span>
      {children}
      {hint ? (
        <span
          className="mt-1 block text-xs"
          style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function inputClass() {
  return 'w-full rounded-lg border px-3 py-2 text-sm';
}

const FLOW_VAR_KEYS = [
  'student_name',
  'parent_name',
  'class',
  'class_name',
  'section',
  'admission_no',
  'amount',
  'due_date',
  'school_name',
  'exam_name',
  'exam_date',
  'result',
  'attendance_percentage',
  'route',
  'bus_number',
  'date',
  'otp',
] as const;

function SettingsPanel({
  settings,
  gateway,
  onErr,
  onSaved,
}: {
  settings: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  onErr: (err: unknown) => void;
  onSaved: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [authkey, setAuthkey] = useState('');
  const [sender, setSender] = useState(
    String(settings.defaultSenderId || gateway?.senderId || 'STLUKE').toUpperCase(),
  );
  const [peId, setPeId] = useState(String(settings.entityId || gateway?.dltEntityId || ''));
  const [templateId, setTemplateId] = useState(
    String(settings.apitxtTemplateId || gateway?.templateId || ''),
  );
  const [route, setRoute] = useState(String(settings.apitxtRoute || gateway?.route || '4'));
  const [flash, setFlash] = useState(String(settings.apitxtFlash || gateway?.flash || '0'));
  const [unicode, setUnicode] = useState(
    String(settings.apitxtUnicode || gateway?.unicode || 'auto'),
  );
  const [otpTemplateId, setOtpTemplateId] = useState(
    String(settings.otpTemplateId || gateway?.otpTemplateId || ''),
  );
  const [otpChannel, setOtpChannel] = useState(
    String(settings.otpChannel || gateway?.otpChannel || 'sms'),
  );
  const [entityName, setEntityName] = useState(
    String(settings.entityName || "St. Luke's Secondary School"),
  );
  const [enforceDlt, setEnforceDlt] = useState(settings.enforceDlt !== false);
  const [failoverEnabled, setFailoverEnabled] = useState(Boolean(settings.failoverEnabled));
  const hasKey = Boolean(settings.hasAuthkey || gateway?.hasApiKey);

  async function save() {
    setBusy(true);
    try {
      await saveSmsSettings({
        defaultSenderId: sender.trim().toUpperCase(),
        entityId: peId.trim(),
        entityName: entityName.trim(),
        enforceDlt,
        failoverEnabled,
        apitxtRoute: route,
        apitxtTemplateId: templateId.trim(),
        apitxtFlash: flash,
        apitxtUnicode: unicode,
      });
      const saved = await saveSmsGateway(
        {
          name: 'API txt',
          provider: 'APITXT',
          apiUrl: 'https://apitxt.com/api/sendMsg',
          apiKey: authkey.trim(),
          senderId: sender.trim().toUpperCase(),
          dltEntityId: peId.trim(),
          dltHeader: sender.trim().toUpperCase(),
          templateId: templateId.trim(),
          route,
          flash,
          unicode,
          otpTemplateId: otpTemplateId.trim(),
          otpChannel,
          otpCountry: '91',
          status: 'ACTIVE',
          isDefault: true,
        },
        gateway?.id ? String(gateway.id) : undefined,
      );
      if (saved?.id && saved.status === 'ACTIVE') {
        await defaultSmsGateway(String(saved.id)).catch(() => undefined);
      }
      onSaved(
        hasKey || authkey.trim()
          ? 'API.txt Send SMS settings saved. Purchase credits, then send a test from Gateways.'
          : 'API.txt fields saved. Paste the authkey when you have it, then purchase credits to send.',
      );
    } catch (err) {
      onErr(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SmsPanel title="API.txt Send SMS">
          <p className="mb-3 text-sm" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
            Uses <code>https://apitxt.com/api/sendMsg</code> for plain SMS and{' '}
            <code>https://apitxt.com/api/sendFlow</code> when the message has {'{variables}'}.
            Saving does not send SMS. After you purchase credits, test from Gateways or Send.
          </p>
          <div className="grid gap-3">
            <Field
              label="Authkey"
              hint={
                hasKey
                  ? 'A key is already stored encrypted. Leave blank to keep it.'
                  : 'From the API.txt dashboard → API Keys.'
              }
            >
              <input
                type="password"
                autoComplete="off"
                value={authkey}
                onChange={(e) => setAuthkey(e.target.value)}
                placeholder={hasKey ? '•••••••• (saved)' : 'Paste API authkey'}
                className={inputClass()}
              />
            </Field>
            <Field
              label="Sender ID"
              hint="6-character approved DLT header, uppercase letters only."
            >
              <input
                value={sender}
                maxLength={6}
                onChange={(e) => setSender(e.target.value.toUpperCase())}
                placeholder="STLUKE"
                className={inputClass()}
              />
            </Field>
            <Field label="Route">
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className={inputClass()}
              >
                <option value="4">4 — Transactional</option>
                <option value="1">1 — Promotional</option>
              </select>
            </Field>
            <Field
              label="Principal Entity ID (pe_id)"
              hint="DLT registered entity ID required by sendMsg."
            >
              <input
                value={peId}
                onChange={(e) => setPeId(e.target.value)}
                placeholder="PE ID"
                className={inputClass()}
              />
            </Field>
            <Field
              label="Default DLT template_id"
              hint="Approved content template ID. Per-template IDs on SMS Templates override this."
            >
              <input
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="Approved DLT Template ID"
                className={inputClass()}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Flash SMS">
                <select
                  value={flash}
                  onChange={(e) => setFlash(e.target.value)}
                  className={inputClass()}
                >
                  <option value="0">0 — Normal</option>
                  <option value="1">1 — Flash</option>
                </select>
              </Field>
              <Field label="Unicode">
                <select
                  value={unicode}
                  onChange={(e) => setUnicode(e.target.value)}
                  className={inputClass()}
                >
                  <option value="auto">Auto (non-English)</option>
                  <option value="0">0 — English / GSM</option>
                  <option value="1">1 — Unicode</option>
                </select>
              </Field>
            </div>
            <PrimaryButton type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save Send SMS configuration'}
            </PrimaryButton>
          </div>
        </SmsPanel>
        <SmsPanel title="School defaults">
          <div className="grid gap-3">
            <Field label="Registered entity name">
              <input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field
              label="Login OTP template_id"
              hint="Optional. Login OTP still uses sendOTP, not sendMsg."
            >
              <input
                value={otpTemplateId}
                onChange={(e) => setOtpTemplateId(e.target.value)}
                placeholder="OTP template_id"
                className={inputClass()}
              />
            </Field>
            <Field label="OTP channel">
              <select
                value={otpChannel}
                onChange={(e) => setOtpChannel(e.target.value)}
                className={inputClass()}
              >
                <option value="sms">SMS OTP</option>
                <option value="whatsapp">WhatsApp OTP</option>
                <option value="voice">Voice OTP</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enforceDlt}
                onChange={(e) => setEnforceDlt(e.target.checked)}
              />
              Enforce DLT for promotional SMS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={failoverEnabled}
                onChange={(e) => setFailoverEnabled(e.target.checked)}
              />
              Enable automatic failover
            </label>
            <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
              Gateway: {String(gateway?.name || 'API txt')} ·{' '}
              {hasKey ? 'authkey saved' : 'authkey not set'} ·{' '}
              {String(gateway?.status || settings.gatewayStatus || 'INACTIVE')}
            </p>
          </div>
        </SmsPanel>
      </div>
      <SmsPanel title="Dynamic variables (sendFlow)">
        <p className="mb-3 text-sm" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
          Personalized SMS uses POST <code>https://apitxt.com/api/sendFlow</code> with the DLT{' '}
          <code>template_id</code>, route, and a recipient list. Each parent or student gets their
          own <code>variables</code> object, for example <code>name</code> and <code>amount</code>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FLOW_VAR_KEYS.map((key) => (
            <code
              key={key}
              className="rounded-md px-2 py-1 text-xs"
              style={{ background: 'var(--sls-fill, #f1f5f9)', color: 'var(--heading, #0f172a)' }}
            >
              {`{${key}}`}
            </code>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
          Put these placeholders in Templates or Send. We also send DLT aliases (<code>name</code>{' '}
          from parent/student, <code>class</code> from class name). The approved DLT template_id on
          Settings or on each template is required.
        </p>
      </SmsPanel>
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
  const [text, setText] = useState(
    'Dear {parent_name}, fee of Rs.{amount} for {student_name}, {class_name} is pending. - {school_name}',
  );
  const [dltTemplateId, setDltTemplateId] = useState('');
  return (
    <div className="space-y-3">
      <SmsPanel title="Create template">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="rounded-lg px-3 py-2"
            />
            <input
              value={dltTemplateId}
              onChange={(e) => setDltTemplateId(e.target.value)}
              placeholder="DLT template_id (for sendFlow)"
              className="min-w-[220px] flex-1 rounded-lg px-3 py-2"
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Body with {variables}"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {FLOW_VAR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="rounded-md px-2 py-1 text-xs"
                style={{ background: 'var(--sls-fill, #f1f5f9)' }}
                onClick={() => setText((cur) => `${cur}{${key}}`)}
              >
                {`{${key}}`}
              </button>
            ))}
          </div>
          <PrimaryButton
            type="button"
            disabled={!name || !text}
            onClick={() =>
              onSave({
                name,
                body: text,
                category: 'GENERAL',
                dltTemplateId: dltTemplateId.trim() || undefined,
                variables: [...text.matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1]!.toLowerCase()),
              })
            }
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
              {t.dltTemplateId ? ` · DLT ${String(t.dltTemplateId)}` : ''}
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
  onEntity,
}: {
  data?: Record<string, unknown>;
  onHeader: (p: Record<string, unknown>) => void;
  onTpl: (p: Record<string, unknown>) => void;
  onEntity?: (p: Record<string, unknown>) => void;
}) {
  const [header, setHeader] = useState('STLUKE');
  const [dltId, setDltId] = useState('');
  const entity = (data?.entity ?? {}) as { id?: string; name?: string };
  const [peId, setPeId] = useState(String(entity.id || ''));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SmsPanel title="Principal entity">
        <div className="space-y-2">
          <p className="text-sm">{entity.name || "St. Luke's Secondary School"}</p>
          <input
            value={peId}
            onChange={(e) => setPeId(e.target.value)}
            placeholder="Principal Entity ID (pe_id)"
            className="w-full rounded-lg px-3 py-2"
          />
          {onEntity ? (
            <GhostButton type="button" onClick={() => onEntity({ entityId: peId })}>
              Save entity ID
            </GhostButton>
          ) : (
            <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
              Entity ID: {entity.id || 'Not set'}
            </p>
          )}
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
  const apitxt = rows.find((g) => String(g.provider) === 'APITXT');
  const [id, setId] = useState(apitxt?.id ? String(apitxt.id) : '');
  const [name, setName] = useState(String(apitxt?.name || 'API txt'));
  const [provider, setProvider] = useState(String(apitxt?.provider || 'APITXT'));
  const [apiKey, setApiKey] = useState('');
  const [senderId, setSenderId] = useState(String(apitxt?.senderId || 'STLUKE'));
  const [peId, setPeId] = useState(String(apitxt?.dltEntityId || ''));
  const [templateId, setTemplateId] = useState(String(apitxt?.templateId || ''));
  const [route, setRoute] = useState(String(apitxt?.route || '4'));
  const [otpTemplateId, setOtpTemplateId] = useState(String(apitxt?.otpTemplateId || ''));
  const [otpChannel, setOtpChannel] = useState(String(apitxt?.otpChannel || 'sms'));

  function load(g: Record<string, unknown>) {
    setId(String(g.id || ''));
    setName(String(g.name || 'API txt'));
    setProvider(String(g.provider || 'APITXT'));
    setApiKey('');
    setSenderId(String(g.senderId || ''));
    setPeId(String(g.dltEntityId || ''));
    setTemplateId(String(g.templateId || ''));
    setRoute(String(g.route || '4'));
    setOtpTemplateId(String(g.otpTemplateId || ''));
    setOtpChannel(String(g.otpChannel || 'sms'));
  }
  return (
    <div className="space-y-3">
      <SmsPanel title={id ? 'Edit gateway' : 'Add gateway'}>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gateway name"
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
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              apitxt?.hasApiKey ? 'Authkey (leave blank to keep saved key)' : 'API key / authkey'
            }
            className="rounded-lg px-3 py-2 sm:col-span-2"
          />
          {provider === 'APITXT' ? (
            <>
              <input
                value={senderId}
                maxLength={6}
                onChange={(e) => setSenderId(e.target.value.toUpperCase())}
                placeholder="Sender ID (6 letters)"
                className="rounded-lg px-3 py-2"
              />
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="rounded-lg px-3 py-2"
              >
                <option value="4">Route 4 — Transactional</option>
                <option value="1">Route 1 — Promotional</option>
              </select>
              <input
                value={peId}
                onChange={(e) => setPeId(e.target.value)}
                placeholder="Principal Entity ID (pe_id)"
                className="rounded-lg px-3 py-2"
              />
              <input
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="DLT template_id"
                className="rounded-lg px-3 py-2"
              />
              <input
                value={otpTemplateId}
                onChange={(e) => setOtpTemplateId(e.target.value)}
                placeholder="OTP template_id (login only)"
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
                id: id || undefined,
                name,
                provider,
                apiKey,
                senderId,
                dltEntityId: peId,
                templateId,
                route,
                status: 'ACTIVE',
                isDefault: true,
                apiUrl: provider === 'APITXT' ? 'https://apitxt.com/api/sendMsg' : undefined,
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
                {String(g.provider)} · {String(g.status)} · {String(g.health)} · sender{' '}
                {String(g.senderId || '—')} · PE {g.hasPeId ? 'set' : 'missing'} · template{' '}
                {g.hasTemplateId ? 'set' : 'missing'} · key {g.hasApiKey ? 'set' : 'missing'}
              </p>
              <div className="flex gap-2">
                <GhostButton type="button" onClick={() => load(g)}>
                  Edit
                </GhostButton>
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
            hint="Add API.txt with authkey, sender, pe_id, and DLT template_id to send school SMS."
          />
        </SmsPanel>
      )}
    </div>
  );
}
