'use client';

import Link from 'next/link';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  FilePlus2,
  IndianRupee,
  Megaphone,
  MessageSquare,
  Percent,
  Radio,
  Send,
  Server,
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
import { SmsEmpty, SmsPanel } from './sms-ui';

type SmsActivity = {
  date: string;
  label: string;
  sent: number;
  delivered: number;
  failed: number;
};

type SmsRecent = {
  id?: string;
  recipientName?: string | null;
  mobile?: string;
  status?: string;
  createdAt?: string;
  campaign?: { name?: string } | null;
};

type SmsGateway = {
  id?: string;
  name?: string;
  provider?: string;
  health?: string;
  isDefault?: boolean;
};

export function SmsDashboard({
  kpis,
  activity,
  recent,
  gateways,
  loading,
  onTestGateway,
}: {
  kpis: Record<string, number>;
  activity: SmsActivity[];
  recent: SmsRecent[];
  gateways: SmsGateway[];
  loading?: boolean;
  onTestGateway?: (id: string) => void;
}) {
  const defaultGw = gateways.find((g) => g.isDefault) ?? gateways[0];
  const healthOk = String(defaultGw?.health ?? '').toUpperCase() !== 'DOWN';
  const chart = activity.length
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
  const yMax = Math.max(20, ...chart.map((d) => d.sent));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SlsKpiCard
          tone="sky"
          icon={MessageSquare}
          label="SMS Balance"
          value={fmtNum(kpis.balance)}
          hint="Credits remaining"
          trend="0%"
          trendLabel="vs last month"
          href="/admin/school-sis/sms/credits"
          loading={loading}
        />
        <SlsKpiCard
          tone="emerald"
          icon={Send}
          label="Sent Today"
          value={fmtNum(kpis.sentToday)}
          hint="Messages sent"
          trend="0%"
          trendLabel="vs yesterday"
          href="/admin/school-sis/sms/history"
          loading={loading}
        />
        <SlsKpiCard
          tone="violet"
          icon={CheckCircle2}
          label="Delivered"
          value={fmtNum(kpis.delivered)}
          hint="Successful deliveries"
          trend="0%"
          trendLabel="vs yesterday"
          href="/admin/school-sis/sms/delivery"
          loading={loading}
        />
        <SlsKpiCard
          tone="rose"
          icon={XCircle}
          label="Failed"
          value={fmtNum(kpis.failed)}
          hint="Failed messages"
          trend="0%"
          trendLabel="vs yesterday"
          href="/admin/school-sis/sms/failed"
          loading={loading}
        />
        <SlsKpiCard
          tone="amber"
          icon={Clock3}
          label="Pending"
          value={fmtNum(kpis.pending)}
          hint="In queue"
          trend="0%"
          trendLabel="vs yesterday"
          href="/admin/school-sis/sms/delivery"
          loading={loading}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SlsKpiCard
          tone="cyan"
          icon={BarChart3}
          label="This Month"
          value={fmtNum(kpis.monthCount)}
          hint="Messages sent"
          trend="0%"
          trendLabel="vs last month"
          loading={loading}
        />
        <SlsKpiCard
          tone="emerald"
          icon={Percent}
          label="Delivery Rate"
          value={`${kpis.deliveryRate ?? 0}%`}
          hint="Delivered / Sent"
          trend="0%"
          trendLabel="vs last month"
          loading={loading}
        />
        <SlsKpiCard
          tone="rose"
          icon={Percent}
          label="Failed Rate"
          value={`${kpis.failedRate ?? 0}%`}
          hint="Failed / Sent"
          trend="0%"
          trendLabel="vs last month"
          loading={loading}
        />
        <SlsKpiCard
          tone="amber"
          icon={IndianRupee}
          label="Estimated Cost"
          value={`₹${fmtNum(kpis.estimatedCost)}`}
          hint="For this month"
          trend="0%"
          trendLabel="vs last month"
          loading={loading}
        />
      </div>

      <div className={healthOk ? 'sls-sms-health' : 'sls-sms-health is-warn'}>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: healthOk ? '#d1fae5' : '#fef3c7',
              color: healthOk ? '#047857' : '#b45309',
            }}
          >
            <Server className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--heading, #0f172a)' }}>
              Gateway Health
            </p>
            {defaultGw ? (
              <p
                className="mt-0.5 text-xs"
                style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
              >
                {String(defaultGw.name)} · {String(defaultGw.provider)} ·{' '}
                {String(defaultGw.health ?? 'OK')}
                {defaultGw.isDefault ? ' (default)' : ''}
              </p>
            ) : (
              <p
                className="mt-0.5 text-xs"
                style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
              >
                No gateway configured yet. Add one to start sending.
              </p>
            )}
            {gateways.length > 1 ? (
              <p
                className="mt-1 text-[11px]"
                style={{ color: 'var(--muted-foreground-hex, #94a3b8)' }}
              >
                {gateways.length} gateways registered
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="sls-btn sls-btn-secondary"
          disabled={!defaultGw?.id}
          onClick={() => defaultGw?.id && onTestGateway?.(String(defaultGw.id))}
        >
          <Radio className="h-4 w-4" />
          Test Gateway
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.9fr]">
        <SmsPanel
          title="SMS Activity (Last 7 Days)"
          icon={Activity}
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
        </SmsPanel>

        <SmsPanel title="Quick Actions" icon={Send}>
          <div className="sls-sms-qa">
            <Link href="/admin/school-sis/sms/send" className="sls-sms-qa-card is-send">
              <Send className="h-4 w-4" />
              <b>Send SMS</b>
              <span>Send to students, staff or custom groups</span>
            </Link>
            <Link href="/admin/school-sis/sms/templates" className="sls-sms-qa-card is-tpl">
              <FilePlus2 className="h-4 w-4" />
              <b>Create Template</b>
              <span>Save time with reusable templates</span>
            </Link>
            <Link href="/admin/school-sis/sms/campaigns" className="sls-sms-qa-card is-camp">
              <Megaphone className="h-4 w-4" />
              <b>New Campaign</b>
              <span>Send to a large group</span>
            </Link>
            <Link href="/admin/school-sis/sms/delivery" className="sls-sms-qa-card is-rpt">
              <BarChart3 className="h-4 w-4" />
              <b>View Reports</b>
              <span>Delivery &amp; failure reports</span>
            </Link>
          </div>
        </SmsPanel>

        <SmsPanel
          title="Recent Activity"
          icon={Clock3}
          action={
            <Link
              href="/admin/school-sis/sms/history"
              className="text-xs font-semibold"
              style={{ color: 'var(--primary-hex, #1a365d)' }}
            >
              View All
            </Link>
          }
        >
          {recent.length ? (
            <div className="sls-sms-feed">
              {recent.slice(0, 8).map((row) => (
                <div key={String(row.id)} className="sls-sms-feed-row">
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        row.status === 'DELIVERED'
                          ? '#10b981'
                          : row.status === 'FAILED'
                            ? '#f43f5e'
                            : '#f59e0b',
                    }}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--heading, #0f172a)' }}
                    >
                      {row.recipientName || row.mobile || 'SMS'}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: 'var(--muted-foreground-hex, #94a3b8)' }}
                    >
                      {String(row.status ?? 'QUEUED')}
                      {row.createdAt
                        ? ` · ${new Date(row.createdAt).toLocaleString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SmsEmpty
              title="No recent activity"
              hint="SMS activity will appear here once you start sending messages."
            />
          )}
        </SmsPanel>
      </div>
    </div>
  );
}

function fmtNum(n?: number) {
  return Number(n ?? 0).toLocaleString('en-IN');
}
