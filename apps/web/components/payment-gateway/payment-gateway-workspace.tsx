'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Webhook,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/use-permissions';
import {
  activatePaymentGateway,
  configurePaymentGateway,
  deactivatePaymentGateway,
  disablePaymentGateway,
  enablePaymentGateway,
  fetchActivePaymentGateway,
  fetchPaymentGatewayHealth,
  fetchPaymentGatewaySettings,
  fetchPaymentGateways,
  fetchPaymentTransactionLogs,
  fetchPaymentWebhookLogs,
  replayPaymentWebhook,
  testPaymentGateway,
  updatePaymentGatewaySettings,
} from '@/services/payment-gateway';
import type {
  ConfigureGatewayPayload,
  PaymentGatewayHealthRow,
  PaymentGatewayRow,
  PaymentTransactionLogRow,
  PaymentWebhookLogRow,
} from '@/types/payment-gateway';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type TabId = 'active' | 'configuration' | 'transactions' | 'webhooks' | 'settings' | 'health';

const TABS: { id: TabId; label: string }[] = [
  { id: 'active', label: 'Active Gateway' },
  { id: 'configuration', label: 'Gateway Configuration' },
  { id: 'transactions', label: 'Transaction Logs' },
  { id: 'webhooks', label: 'Webhook Logs' },
  { id: 'settings', label: 'Payment Settings' },
  { id: 'health', label: 'Health Monitor' },
];

function healthColor(status?: string | null) {
  if (status === 'ONLINE') return 'text-emerald-600 bg-emerald-50';
  if (status === 'DEGRADED') return 'text-amber-700 bg-amber-50';
  return 'text-rose-700 bg-rose-50';
}

function gatewayFieldHints(providerCode: string) {
  if (providerCode === 'NTT_DATA') {
    return {
      merchantId: 'Merchant ID / MID (from Atom)',
      apiKey: 'Request Hashkey (encryption / encKey)',
      secretKey: 'Transaction Password',
      webhookSecret: 'Response Hashkey (decryption / decKey)',
    };
  }
  if (providerCode === 'CASHFREE') {
    return {
      merchantId: 'Merchant ID (optional)',
      apiKey: 'App ID (x-client-id)',
      secretKey: 'Secret Key',
      webhookSecret: 'Webhook Secret',
    };
  }
  if (providerCode === 'BILLDESK') {
    return {
      merchantId: 'Merchant ID (mercid)',
      apiKey: 'Client ID',
      secretKey: 'Signing Key',
      webhookSecret: 'Encryption Key',
    };
  }
  return {
    merchantId: 'Merchant ID (optional)',
    apiKey: 'API Key / Key ID (leave blank to keep existing)',
    secretKey: 'Secret Key (leave blank to keep existing)',
    webhookSecret: 'Webhook Secret (leave blank to keep existing)',
  };
}

function GatewayConfigureForm({
  gateway,
  onSaved,
}: {
  gateway: PaymentGatewayRow;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ConfigureGatewayPayload>({
    merchantId: gateway.merchantId ?? '',
    successUrl: gateway.successUrl ?? '',
    failureUrl: gateway.failureUrl ?? '',
    mode: gateway.mode,
    status: gateway.status,
  });

  const mutation = useMutation({
    mutationFn: () => configurePaymentGateway(gateway.providerCode, form),
    onSuccess: () => onSaved(),
  });

  const hints = gatewayFieldHints(gateway.providerCode);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{gateway.name}</p>
          <p className="text-xs text-slate-500">{gateway.providerCode}</p>
          {gateway.providerCode === 'RAZORPAY' ? (
            <p className="mt-1 text-xs text-emerald-700">Default gateway for new institutions</p>
          ) : null}
        </div>
        {gateway.isActive ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Active
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          placeholder={hints.merchantId}
          value={form.merchantId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, merchantId: e.target.value }))}
        />
        <Input
          placeholder={hints.apiKey}
          type="password"
          onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
        />
        <Input
          placeholder={hints.secretKey}
          type="password"
          onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))}
        />
        <Input
          placeholder={hints.webhookSecret}
          type="password"
          onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
        />
        <Input
          placeholder="Success URL"
          value={form.successUrl ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, successUrl: e.target.value }))}
        />
        <Input
          placeholder="Failure URL"
          value={form.failureUrl ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, failureUrl: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={form.mode}
          onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as 'TEST' | 'LIVE' }))}
        >
          <option value="TEST">Test / Sandbox</option>
          <option value="LIVE">Live</option>
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              status: e.target.value as 'ENABLED' | 'DISABLED',
            }))
          }
        >
          <option value="ENABLED">Enabled</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {gateway.configured ? (
        <p className="text-xs text-slate-500">
          Stored keys: API {gateway.apiKeyMasked ?? '—'} · Secret {gateway.secretKeyMasked ?? '—'}
        </p>
      ) : (
        <p className="text-xs text-amber-700">Credentials not configured yet.</p>
      )}

      {mutation.error ? (
        <p className="text-sm text-rose-600">{apiErrorMessage(mutation.error)}</p>
      ) : null}

      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Configuration'}
      </Button>
    </div>
  );
}

export function PaymentGatewayWorkspace({ initialTab = 'active' }: { initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const { canAny } = usePermissions();
  const canManage = canAny('payment-gateway:manage', 'fees:manage');
  const queryClient = useQueryClient();

  const gatewaysQuery = useQuery({
    queryKey: ['payment-gateways'],
    queryFn: fetchPaymentGateways,
  });
  const activeQuery = useQuery({
    queryKey: ['payment-gateway-active'],
    queryFn: fetchActivePaymentGateway,
  });
  const healthQuery = useQuery({
    queryKey: ['payment-gateway-health'],
    queryFn: fetchPaymentGatewayHealth,
    enabled: tab === 'health' || tab === 'active',
  });
  const settingsQuery = useQuery({
    queryKey: ['payment-gateway-settings'],
    queryFn: fetchPaymentGatewaySettings,
    enabled: tab === 'settings',
  });
  const txQuery = useQuery({
    queryKey: ['payment-gateway-transactions'],
    queryFn: () => fetchPaymentTransactionLogs({ limit: 50 }),
    enabled: tab === 'transactions',
  });
  const webhookQuery = useQuery({
    queryKey: ['payment-gateway-webhooks'],
    queryFn: () => fetchPaymentWebhookLogs({ limit: 50 }),
    enabled: tab === 'webhooks',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
    void queryClient.invalidateQueries({ queryKey: ['payment-gateway-active'] });
    void queryClient.invalidateQueries({ queryKey: ['payment-gateway-health'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (input: { action: string; code: string }) => {
      if (input.action === 'activate') return activatePaymentGateway(input.code);
      if (input.action === 'deactivate') return deactivatePaymentGateway(input.code);
      if (input.action === 'enable') return enablePaymentGateway(input.code);
      if (input.action === 'disable') return disablePaymentGateway(input.code);
      if (input.action === 'test') return testPaymentGateway(input.code);
      throw new Error('Unknown action');
    },
    onSuccess: invalidate,
  });

  const settingsMutation = useMutation({
    mutationFn: updatePaymentGatewaySettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-gateway-settings'] }),
  });

  const replayMutation = useMutation({
    mutationFn: replayPaymentWebhook,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-gateway-webhooks'] }),
  });

  const gateways = gatewaysQuery.data ?? [];
  const active = activeQuery.data;

  const header = useMemo(
    () => (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-200">
              BCL OneCampus ERP · Enterprise Edition
            </p>
            <h1 className="mt-1 text-2xl font-bold">Payment Gateway Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              Configure institution payment gateways centrally. Student, parent, faculty apps and
              web portals always call the ERP backend — never payment providers directly.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-sm">
            <p className="text-blue-100">Active Gateway</p>
            <p className="text-lg font-semibold">{active?.name ?? 'None configured'}</p>
            <p className="text-xs text-blue-200">
              {active ? `${active.mode} · ${active.status}` : 'Fallback: env Razorpay if set'}
            </p>
          </div>
        </div>
      </div>
    ),
    [active],
  );

  return (
    <div className="space-y-5">
      {header}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {gatewaysQuery.isLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading gateways…
        </div>
      ) : null}

      {tab === 'active' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold">Current Active Gateway</h2>
            </div>
            {active ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Gateway:</span> <strong>{active.name}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Mode:</span> {active.mode}
                </p>
                <p>
                  <span className="text-slate-500">Merchant:</span> {active.merchantId ?? '—'}
                </p>
                <p>
                  <span className="text-slate-500">Health:</span>{' '}
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-semibold',
                      healthColor(active.lastHealthStatus),
                    )}
                  >
                    {active.lastHealthStatus ?? 'UNKNOWN'}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No tenant gateway is active. Configure and activate a gateway, or legacy env
                Razorpay keys will be used.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold">Security Notes</h2>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>API secrets are encrypted at rest using ENCRYPTION_KEY.</li>
              <li>Secrets are never returned to browsers — only masked values.</li>
              <li>Only one gateway can be active per institution at a time.</li>
              <li>Switching gateways requires no mobile app or frontend code changes.</li>
            </ul>
          </div>
        </div>
      ) : null}

      {tab === 'configuration' ? (
        <div className="space-y-4">
          {gateways.map((gateway: PaymentGatewayRow) => (
            <div key={gateway.id} className="space-y-3">
              <GatewayConfigureForm gateway={gateway} onSaved={invalidate} />
              {canManage ? (
                <div className="flex flex-wrap gap-2 px-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({ action: 'test', code: gateway.providerCode })
                    }
                  >
                    Test Connection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({ action: 'enable', code: gateway.providerCode })
                    }
                  >
                    Enable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({ action: 'disable', code: gateway.providerCode })
                    }
                  >
                    Disable
                  </Button>
                  <Button
                    size="sm"
                    disabled={actionMutation.isPending || gateway.isActive}
                    onClick={() =>
                      actionMutation.mutate({ action: 'activate', code: gateway.providerCode })
                    }
                  >
                    Activate
                  </Button>
                  {gateway.isActive ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          action: 'deactivate',
                          code: gateway.providerCode,
                        })
                      }
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'transactions' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {(txQuery.data?.items ?? []).map((row: PaymentTransactionLogRow) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{row.transactionId}</td>
                  <td className="px-4 py-3">
                    {row.studentName ?? '—'}
                    <div className="text-xs text-slate-500">{row.rollNumber}</div>
                  </td>
                  <td className="px-4 py-3">{row.gateway}</td>
                  <td className="px-4 py-3">₹{row.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.erpReceiptNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.paymentDate ? new Date(row.paymentDate).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'webhooks' ? (
        <div className="space-y-3">
          {(webhookQuery.data?.items ?? []).map((row: PaymentWebhookLogRow) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">
                  {row.providerCode} · {row.eventName}
                </p>
                <p className="text-xs text-slate-500">
                  {row.verificationStatus} · {row.processingStatus} ·{' '}
                  {new Date(row.receivedAt).toLocaleString()}
                </p>
              </div>
              {canManage && row.processingStatus === 'PENDING' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={replayMutation.isPending}
                  onClick={() => replayMutation.mutate(row.id)}
                >
                  <Webhook className="mr-1 h-4 w-4" /> Replay
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'settings' && settingsQuery.data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Payment Settings</h2>
          </div>
          {(
            [
              ['autoReceipt', 'Auto Receipt Generation'],
              ['autoEmailReceipt', 'Auto Email Receipt'],
              ['autoSmsNotification', 'Auto SMS Notification'],
              ['autoWhatsappNotification', 'Auto WhatsApp Notification'],
              ['retryFailedPayments', 'Retry Failed Payments'],
              ['preventDuplicatePayments', 'Duplicate Payment Prevention'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm">{label}</span>
              <Switch
                checked={Boolean(settingsQuery.data[key])}
                disabled={!canManage || settingsMutation.isPending}
                onCheckedChange={(checked) => settingsMutation.mutate({ [key]: checked })}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">Payment Timeout (minutes)</span>
            <Input
              className="max-w-[120px]"
              type="number"
              defaultValue={settingsQuery.data.paymentTimeoutMinutes}
              disabled={!canManage}
              onBlur={(e) =>
                settingsMutation.mutate({
                  paymentTimeoutMinutes: Number(e.target.value) || 30,
                })
              }
            />
          </div>
        </div>
      ) : null}

      {tab === 'health' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(healthQuery.data ?? []).map((row: PaymentGatewayHealthRow) => (
            <div key={row.gatewayId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{row.name}</p>
                {row.status === 'ONLINE' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" />
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">{row.message}</p>
              <p className="mt-3 text-xs text-slate-500">
                {row.mode} · {row.isActive ? 'Active' : 'Inactive'}
                {row.latencyMs ? ` · ${row.latencyMs}ms` : ''}
              </p>
              <p className="text-xs text-slate-400">
                Checked {new Date(row.lastCheckedAt).toLocaleString()}
              </p>
            </div>
          ))}
          <Button variant="outline" className="h-fit" onClick={() => void healthQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Health
          </Button>
        </div>
      ) : null}

      {actionMutation.error ? (
        <p className="text-sm text-rose-600">{apiErrorMessage(actionMutation.error)}</p>
      ) : null}
    </div>
  );
}
