'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Star,
  Wallet,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canConfigureSchoolPaymentGateways } from '@/lib/school-sis/permissions';
import {
  activateSchoolPaymentGateway,
  createSchoolPaymentGateway,
  deactivateSchoolPaymentGateway,
  deleteSchoolPaymentGateway,
  fetchSchoolPaymentGateway,
  fetchSchoolPaymentGateways,
  setDefaultSchoolPaymentGateway,
  testSchoolPaymentGateway,
  updateSchoolPaymentGateway,
  type SchoolPaymentGateway,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { MonthlyFeeSubnav } from './monthly-fee-ui';

const PROVIDERS = [
  { id: 'RAZORPAY', label: 'Razorpay' },
  { id: 'PAYU', label: 'PayU' },
  { id: 'CASHFREE', label: 'Cashfree' },
  { id: 'PHONEPE', label: 'PhonePe' },
  { id: 'STRIPE', label: 'Stripe' },
  { id: 'OTHER', label: 'Other' },
];

const CRED_FIELDS: Record<string, Array<{ key: string; label: string; secret?: boolean }>> = {
  RAZORPAY: [
    { key: 'keyId', label: 'Key ID' },
    { key: 'keySecret', label: 'Key Secret', secret: true },
    { key: 'webhookSecret', label: 'Webhook Secret', secret: true },
  ],
  PAYU: [
    { key: 'merchantKey', label: 'Merchant Key' },
    { key: 'merchantSalt', label: 'Merchant Salt', secret: true },
    { key: 'webhookSecret', label: 'Webhook / callback secret', secret: true },
  ],
  CASHFREE: [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
    { key: 'appId', label: 'App ID' },
    { key: 'webhookSecret', label: 'Webhook Secret', secret: true },
  ],
  PHONEPE: [
    { key: 'merchantId', label: 'Merchant ID' },
    { key: 'saltKey', label: 'Salt Key', secret: true },
    { key: 'saltIndex', label: 'Salt Index' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
  ],
  STRIPE: [
    { key: 'publishableKey', label: 'Publishable Key' },
    { key: 'secretKey', label: 'Secret Key', secret: true },
    { key: 'webhookSecret', label: 'Webhook Secret', secret: true },
  ],
  OTHER: [
    { key: 'apiKey', label: 'API Key' },
    { key: 'apiSecret', label: 'API Secret', secret: true },
    { key: 'webhookSecret', label: 'Webhook Secret', secret: true },
  ],
};

type FormState = {
  id?: string;
  provider: string;
  name: string;
  environment: 'TEST' | 'LIVE';
  credentials: Record<string, string>;
};

const emptyForm = (): FormState => ({
  provider: 'RAZORPAY',
  name: '',
  environment: 'TEST',
  credentials: {},
});

export function PaymentGatewayDesk() {
  const enabled = useAuthQueryEnabled();
  const user = useAuthStore((s) => s.session?.user);
  const canConfigure = canConfigureSchoolPaymentGateways(user?.permissions, user?.roles);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-payment-gateways'],
    queryFn: fetchSchoolPaymentGateways,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [view, setView] = useState<SchoolPaymentGateway | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<SchoolPaymentGateway | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  const data = query.data;
  const gateways = data?.gateways ?? [];

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['school-payment-gateways'] });
    await qc.invalidateQueries({ queryKey: ['monthly-fee-config'] });
  }

  function openCreate() {
    setForm(emptyForm());
    setFormOpen(true);
    setShowSecrets(false);
  }

  async function openEdit(row: SchoolPaymentGateway) {
    const full = await fetchSchoolPaymentGateway(row.id, canConfigure);
    const creds: Record<string, string> = {};
    for (const field of CRED_FIELDS[full.provider] ?? []) {
      const raw = full.credentials[field.key];
      creds[field.key] = typeof raw === 'string' ? raw : '';
    }
    setForm({
      id: full.id,
      provider: full.provider,
      name: full.name,
      environment: full.environment,
      credentials: creds,
    });
    setFormOpen(true);
    setShowSecrets(false);
  }

  async function saveForm() {
    setError(null);
    try {
      if (form.id) {
        await updateSchoolPaymentGateway(form.id, {
          name: form.name,
          environment: form.environment,
          credentials: form.credentials,
        });
        setOk('Gateway updated. Secrets were not stored in the browser.');
      } else {
        await createSchoolPaymentGateway({
          provider: form.provider,
          name: form.name || `${form.provider} ${form.environment}`,
          environment: form.environment,
          credentials: form.credentials,
        });
        setOk('Gateway added. Test the connection before activating it.');
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function run(id: string, fn: () => Promise<{ message?: string } | unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = (await fn()) as { message?: string };
      setOk(res?.message || 'Done.');
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payment Gateway Integration</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Configure and manage online payment gateways for student fee payments.
          </p>
        </div>
        {canConfigure ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Payment Gateway
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
        Only the active default gateway will be used for new online fee payments. Existing
        transactions will continue to be associated with the gateway used when the payment was
        created.
      </div>

      {!data?.onlinePaymentsAvailable ? (
        <div className="flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Online payments are currently unavailable.</p>
            <p>{data?.warning}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      {ok ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Configured Gateways" value={String(data?.configured ?? 0)} />
        <SummaryCard label="Active Gateway" value={data?.activeGateway ?? '—'} />
        <SummaryCard label="Default Gateway" value={data?.defaultGateway ?? '—'} accent />
        <SummaryCard label="Gateway Status" value={data?.gatewayStatus ?? 'Not Connected'} />
      </div>

      {query.isLoading ? <p className="text-sm text-slate-500">Loading gateways…</p> : null}

      {!query.isLoading && !gateways.length ? (
        <div className="rounded-3xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-100">
          <Wallet className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            No Payment Gateways Configured
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Configure a payment gateway to allow parents and students to pay fees online.
          </p>
          {canConfigure ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Payment Gateway
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {gateways.map((g) => (
            <GatewayCard
              key={g.id}
              gateway={g}
              busy={busyId === g.id}
              canConfigure={canConfigure}
              onView={() => setView(g)}
              onEdit={() => void openEdit(g)}
              onTest={() => void run(g.id, () => testSchoolPaymentGateway(g.id))}
              onDefault={() => void run(g.id, () => setDefaultSchoolPaymentGateway(g.id))}
              onToggle={() => {
                if (g.isActive) {
                  if (g.isDefault) {
                    setDisableTarget(g);
                    return;
                  }
                  void run(g.id, () => deactivateSchoolPaymentGateway(g.id));
                  return;
                }
                void run(g.id, () => activateSchoolPaymentGateway(g.id));
              }}
              onDelete={() => {
                if (!window.confirm(`Delete ${g.name}? This cannot be undone.`)) return;
                void run(g.id, () => deleteSchoolPaymentGateway(g.id));
              }}
            />
          ))}
        </div>
      )}

      <p className="text-sm">
        <Link
          href="/admin/school-sis/fees/gateways/transactions"
          className="font-semibold text-[#2563eb]"
        >
          Gateway transactions →
        </Link>
      </p>

      {formOpen ? (
        <Modal
          title={form.id ? 'Edit payment gateway' : 'Add payment gateway'}
          onClose={() => setFormOpen(false)}
        >
          <div className="grid gap-3">
            <label className="text-sm font-medium">
              Gateway provider
              <select
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={form.provider}
                disabled={Boolean(form.id)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider: e.target.value, credentials: {} }))
                }
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Gateway name
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                placeholder="Razorpay Production"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Environment
              <select
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={form.environment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, environment: e.target.value as 'TEST' | 'LIVE' }))
                }
              >
                <option value="TEST">Test / Sandbox</option>
                <option value="LIVE">Live</option>
              </select>
            </label>
            {(CRED_FIELDS[form.provider] ?? []).map((field) => (
              <label key={field.key} className="text-sm font-medium">
                {field.label}
                <div className="relative mt-1">
                  <input
                    className="h-10 w-full rounded-xl border px-3 pr-10"
                    type={field.secret && !showSecrets ? 'password' : 'text'}
                    value={form.credentials[field.key] ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        credentials: { ...f.credentials, [field.key]: e.target.value },
                      }))
                    }
                    placeholder={field.secret ? 'Leave unchanged to keep the saved secret' : ''}
                  />
                  {field.secret ? (
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-slate-400"
                      onClick={() => setShowSecrets((v) => !v)}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="h-10 rounded-xl px-4 text-sm ring-1 ring-slate-200"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
                onClick={() => void saveForm()}
              >
                Save gateway
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {view ? (
        <Modal title={view.name} onClose={() => setView(null)}>
          <GatewayDetail gateway={view} />
        </Modal>
      ) : null}

      {disableTarget ? (
        <Modal title="Cannot disable default gateway" onClose={() => setDisableTarget(null)}>
          <p className="text-sm text-slate-600">
            This gateway is currently the default payment gateway. Please select another active
            gateway as default before disabling it.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="h-10 rounded-xl px-4 text-sm ring-1 ring-slate-200"
              onClick={() => setDisableTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
              onClick={() => setDisableTarget(null)}
            >
              Set another gateway as default
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-white p-4 shadow-sm ring-1',
        accent ? 'ring-[#2563eb]/30' : 'ring-slate-100',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function GatewayCard({
  gateway,
  busy,
  canConfigure,
  onView,
  onEdit,
  onTest,
  onDefault,
  onToggle,
  onDelete,
}: {
  gateway: SchoolPaymentGateway;
  busy: boolean;
  canConfigure: boolean;
  onView: () => void;
  onEdit: () => void;
  onTest: () => void;
  onDefault: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const failed = gateway.connectionStatus === 'FAILED';
  return (
    <article
      className={cn(
        'rounded-3xl bg-white p-5 shadow-sm ring-1',
        gateway.isDefault ? 'ring-[#2563eb] shadow-md' : 'ring-slate-100',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{gateway.name}</h3>
            <p className="text-sm text-slate-500">Online Payment Gateway · {gateway.provider}</p>
          </div>
        </div>
        {gateway.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#2563eb] px-2.5 py-1 text-[11px] font-semibold text-white">
            <Star className="h-3 w-3" /> Default
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {gateway.isActive ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">● Active</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">● Inactive</span>
        )}
        <span
          className={cn(
            'rounded-full px-2.5 py-1',
            gateway.environment === 'LIVE'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700',
          )}
        >
          {gateway.environment === 'LIVE' ? 'Live' : 'Test mode'}
        </span>
        {failed ? (
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
            ⚠ Connection failed
          </span>
        ) : gateway.connectionStatus === 'OK' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Configured:{' '}
        {new Date(gateway.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Ghost onClick={onView}>View</Ghost>
        {canConfigure ? (
          <>
            <Ghost onClick={onEdit}>Edit</Ghost>
            <Ghost onClick={onTest} disabled={busy}>
              {busy ? 'Connecting…' : 'Test Connection'}
            </Ghost>
            {!gateway.isDefault ? <Ghost onClick={onDefault}>Set as Default</Ghost> : null}
            <Ghost onClick={onToggle}>{gateway.isActive ? 'Disable' : 'Enable'}</Ghost>
            <Ghost onClick={onDelete} danger>
              Delete
            </Ghost>
          </>
        ) : null}
      </div>
    </article>
  );
}

function Ghost({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-8 rounded-lg px-2.5 text-xs font-semibold ring-1 disabled:opacity-50',
        danger ? 'text-rose-700 ring-rose-100' : 'text-slate-700 ring-slate-200',
      )}
    >
      {children}
    </button>
  );
}

function GatewayDetail({ gateway }: { gateway: SchoolPaymentGateway }) {
  const cfg = gateway.configuration;
  const rows = useMemo(
    () => [
      ['Webhook URL', cfg.webhookUrl],
      ['Callback URL', cfg.callbackUrl],
      ['Success URL', cfg.successUrl],
      ['Failure URL', cfg.failureUrl],
    ],
    [cfg],
  );
  return (
    <div className="space-y-3 text-sm">
      <p>
        Status: <b>{gateway.isActive ? 'Active' : 'Inactive'}</b>
        {gateway.isDefault ? ' · Default' : ''}
      </p>
      <p>
        Environment: <b>{gateway.environment}</b> · Connection: <b>{gateway.connectionStatus}</b>
      </p>
      {rows.map(([label, url]) => (
        <div key={label}>
          <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
          <p className="mt-1 flex items-center gap-2 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs">
            {url}
            <button
              type="button"
              className="shrink-0 text-[#2563eb]"
              onClick={() => void navigator.clipboard.writeText(String(url))}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </p>
        </div>
      ))}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-sm text-slate-400" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
