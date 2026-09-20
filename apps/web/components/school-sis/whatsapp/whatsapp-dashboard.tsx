'use client';

import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import { WaBadge, WaEmpty, WaPanel } from './whatsapp-ui';

type WaActivity = {
  date: string;
  label: string;
  sent: number;
  delivered: number;
  failed: number;
};

type WaConnection = {
  connected?: boolean;
  displayPhone?: string | null;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  accountName?: string | null;
  lastWebhookAt?: string | null;
};

type WaCampaign = {
  id?: string;
  name?: string;
  type?: string;
  recipientCount?: number;
  validCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  failedCount?: number;
  status?: string;
  sentAt?: string | null;
  scheduledAt?: string | null;
  createdAt?: string;
};

export function WhatsappDashboard({
  kpis,
  activity,
  campaigns,
  connection,
  loading,
  onReconnect,
}: {
  kpis?: Record<string, number>;
  activity?: WaActivity[];
  campaigns?: WaCampaign[];
  connection?: WaConnection | null;
  loading?: boolean;
  onReconnect?: () => void;
}) {
  const sent = kpis?.sent ?? 0;
  const delivered = kpis?.delivered ?? 0;
  const read = kpis?.read ?? 0;
  const failed = kpis?.failed ?? 0;
  const pending = kpis?.pending ?? 0;
  const replies = kpis?.replies ?? 0;
  const conversations = kpis?.conversations ?? 0;
  const campaignCount = kpis?.campaigns ?? 0;
  const connected = Boolean(connection?.connected);
  const chart = activity?.length
    ? activity
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          sent: 0,
          delivered: 0,
          failed: 0,
        };
      });
  const yMax = Math.max(5, ...chart.map((d) => d.sent));
  const rows = campaigns ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SlsKpiCard
          tone="sky"
          icon={Send}
          label="Messages Sent"
          value={fmtNum(sent)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/delivery"
          loading={loading}
        />
        <SlsKpiCard
          tone="emerald"
          icon={CheckCircle2}
          label="Delivered"
          value={fmtNum(delivered)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/delivery"
          loading={loading}
        />
        <SlsKpiCard
          tone="violet"
          icon={MessageCircle}
          label="Read"
          value={fmtNum(read)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/inbox"
          loading={loading}
        />
        <SlsKpiCard
          tone="rose"
          icon={XCircle}
          label="Failed"
          value={fmtNum(failed)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/delivery"
          loading={loading}
        />
        <SlsKpiCard
          tone="amber"
          icon={Clock3}
          label="Pending"
          value={fmtNum(pending)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/delivery"
          loading={loading}
        />
        <SlsKpiCard
          tone="cyan"
          icon={MessageSquare}
          label="Replies"
          value={fmtNum(replies)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/inbox"
          loading={loading}
        />
        <SlsKpiCard
          tone="sky"
          icon={MessageCircle}
          label="Active Conversations"
          value={fmtNum(conversations)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/inbox"
          loading={loading}
        />
        <SlsKpiCard
          tone="rose"
          icon={Megaphone}
          label="Campaigns"
          value={fmtNum(campaignCount)}
          trend="0%"
          trendLabel="vs last 7 days"
          href="/admin/school-sis/whatsapp/campaigns"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.15fr_0.9fr]">
        <WaPanel
          title="WhatsApp Connection"
          icon={MessageCircle}
          action={
            <button type="button" className="sls-btn sls-btn-secondary" onClick={onReconnect}>
              <RefreshCw className="h-4 w-4" />
              Reconnect
            </button>
          }
        >
          <div className="flex items-center gap-2">
            {connected ? <WaBadge value="CONNECTED" /> : <WaBadge value="DISCONNECTED" />}
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--heading, #0f172a)' }}>
            {connected
              ? 'Meta Cloud API is active and ready.'
              : 'Connect a Meta Cloud API number to start sending.'}
          </p>
          <div className="mt-3">
            <ConnRow
              label="Phone Number ID"
              value={connection?.phoneNumberId || connection?.displayPhone}
            />
            <ConnRow
              label="Business Account"
              value={connection?.wabaId || connection?.accountName}
            />
            <ConnRow
              label="Webhook Status"
              value={
                connection?.lastWebhookAt
                  ? `Last ${new Date(connection.lastWebhookAt).toLocaleString('en-IN')}`
                  : null
              }
            />
          </div>
        </WaPanel>

        <WaPanel
          title="Messages Overview (Last 7 Days)"
          icon={BarChart3}
          action={
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
            >
              Sent
            </span>
          }
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e8edf5)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--border-color, #d9e1ee)',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sent"
                  name="Sent"
                  stroke="var(--primary-hex, #6366f1)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: 'var(--primary-hex, #6366f1)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </WaPanel>

        <WaPanel title="Quick Actions" icon={Send}>
          <div className="sls-sms-qa">
            <Link href="/admin/school-sis/whatsapp/messaging" className="sls-sms-qa-card is-send">
              <Send className="h-4 w-4" />
              <b>Send Message</b>
              <span>Send to students, parents or custom groups</span>
            </Link>
            <Link href="/admin/school-sis/whatsapp/templates" className="sls-sms-qa-card is-tpl">
              <FilePlus2 className="h-4 w-4" />
              <b>Create Template</b>
              <span>Save time with reusable templates</span>
            </Link>
            <Link href="/admin/school-sis/whatsapp/campaigns" className="sls-sms-qa-card is-camp">
              <Megaphone className="h-4 w-4" />
              <b>New Campaign</b>
              <span>Send to a large group</span>
            </Link>
            <Link href="/admin/school-sis/whatsapp/analytics" className="sls-sms-qa-card is-rpt">
              <BarChart3 className="h-4 w-4" />
              <b>View Reports</b>
              <span>Delivery &amp; engagement analytics</span>
            </Link>
          </div>
        </WaPanel>
      </div>

      <WaPanel
        title="Recent Campaigns"
        icon={Megaphone}
        flush
        action={
          <Link
            href="/admin/school-sis/whatsapp/campaigns"
            className="text-xs font-semibold"
            style={{ color: 'var(--primary-hex, #1a365d)' }}
          >
            View All
          </Link>
        }
      >
        {rows.length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead
                className="text-xs uppercase"
                style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
              >
                <tr>
                  <th className="px-4 py-2 text-left">Campaign</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Recipients</th>
                  <th className="px-4 py-2 text-left">Sent</th>
                  <th className="px-4 py-2 text-left">Delivered</th>
                  <th className="px-4 py-2 text-left">Read</th>
                  <th className="px-4 py-2 text-left">Failed</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Sent on</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={String(c.id)}>
                    <td className="px-4 py-2 font-medium">{String(c.name)}</td>
                    <td className="px-4 py-2">{String(c.type ?? 'TEMPLATE')}</td>
                    <td className="px-4 py-2">{String(c.validCount ?? c.recipientCount ?? 0)}</td>
                    <td className="px-4 py-2">{String(c.sentCount ?? 0)}</td>
                    <td className="px-4 py-2">{String(c.deliveredCount ?? 0)}</td>
                    <td className="px-4 py-2">{String(c.readCount ?? 0)}</td>
                    <td className="px-4 py-2">{String(c.failedCount ?? 0)}</td>
                    <td className="px-4 py-2">
                      <WaBadge value={String(c.status ?? 'DRAFT')} />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {c.sentAt || c.scheduledAt || c.createdAt
                        ? new Date(String(c.sentAt || c.scheduledAt || c.createdAt)).toLocaleString(
                            'en-IN',
                          )
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <WaEmpty
              title="No campaigns yet"
              hint="Start by creating your first WhatsApp campaign."
            />
            <div className="mt-2 flex justify-center">
              <Link href="/admin/school-sis/whatsapp/campaigns" className="sls-cta sls-sms-send">
                + Create Campaign
              </Link>
            </div>
          </div>
        )}
      </WaPanel>
    </div>
  );
}

function ConnRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="sls-wa-conn-row">
      <span>{label}</span>
      {value ? <b>{value}</b> : <span className="is-missing">Not configured</span>}
    </div>
  );
}

function fmtNum(n?: number) {
  return Number(n ?? 0).toLocaleString('en-IN');
}
