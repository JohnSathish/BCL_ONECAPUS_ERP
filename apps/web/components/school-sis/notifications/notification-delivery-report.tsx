'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import {
  archiveSchoolPush,
  fetchSchoolPushCampaignReport,
  retrySchoolPush,
  type SchoolPushDeliveryReport,
} from '@/services/school-push';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Hash,
  Send,
  Users,
  UserRound,
  XCircle,
} from 'lucide-react';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function StatusDot({ value }: { value: string }) {
  const v = value.toUpperCase();
  const map: Record<string, string> = {
    SENT: 'bg-emerald-50 text-emerald-700',
    DELIVERED: 'bg-emerald-50 text-emerald-700',
    OPENED: 'bg-sky-50 text-sky-700',
    FAILED: 'bg-rose-50 text-rose-700',
    PENDING: 'bg-amber-50 text-amber-700',
    QUEUED: 'bg-amber-50 text-amber-700',
  };
  const dot: Record<string, string> = {
    SENT: 'bg-emerald-500',
    DELIVERED: 'bg-emerald-500',
    OPENED: 'bg-sky-500',
    FAILED: 'bg-rose-500',
    PENDING: 'bg-amber-500',
    QUEUED: 'bg-amber-500',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        map[v] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[v] ?? 'bg-slate-400')} />
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function downloadBlob(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function csvFromReport(report: SchoolPushDeliveryReport) {
  const header = [
    'Name',
    'Admission No',
    'Class',
    'Device',
    'Status',
    'Sent',
    'Delivered',
    'Opened',
  ];
  const lines = [
    header.join(','),
    ...report.recipients.map((r) =>
      [
        `"${r.studentName.replaceAll('"', '""')}"`,
        r.admissionNo,
        `"${(r.className ?? '').replaceAll('"', '""')}"`,
        `"${r.device.replaceAll('"', '""')}"`,
        r.status,
        r.sentAt ?? '',
        r.deliveredAt ?? '',
        r.openedAt ?? '',
      ].join(','),
    ),
  ];
  return lines.join('\n');
}

function printPdf(report: SchoolPushDeliveryReport) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Notification Delivery Report</title>
    <style>body{font-family:Georgia,serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:6px;text-align:left}</style>
    </head><body>
    <h1>St. Luke's Higher Secondary School</h1>
    <p>Notification Delivery Report · ${report.campaign.messageId ?? ''}</p>
    <h2>${report.campaign.title}</h2>
    <p>${report.campaign.body}</p>
    <p>Audience: ${report.audience.label} · Sent: ${fmtWhen(report.campaign.sentAt || report.campaign.createdAt)} · Sender: ${report.sender.name}</p>
    <p>Recipients ${report.summary.recipients} · Delivered ${report.summary.delivered} · Opened ${report.summary.opened} · Failed ${report.summary.failed}</p>
    <table><tr><th>Student</th><th>Admission</th><th>Class</th><th>Device</th><th>Status</th></tr>
    ${report.recipients
      .slice(0, 400)
      .map(
        (r) =>
          `<tr><td>${r.studentName}</td><td>${r.admissionNo}</td><td>${r.className ?? ''}</td><td>${r.device}</td><td>${r.status}</td></tr>`,
      )
      .join('')}
    </table></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

const PIE = [
  { key: 'delivered', color: '#22c55e' },
  { key: 'opened', color: '#38bdf8' },
  { key: 'pending', color: '#f59e0b' },
  { key: 'failed', color: '#f43f5e' },
] as const;

export function NotificationDeliveryReport({
  campaignId,
  onClose,
}: {
  campaignId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [klass, setKlass] = useState('ALL');
  const [platform, setPlatform] = useState('ALL');
  const [statTab, setStatTab] = useState<'platform' | 'app' | 'model'>('platform');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [viewRow, setViewRow] = useState<SchoolPushDeliveryReport['recipients'][number] | null>(
    null,
  );

  const report = useQuery({
    queryKey: ['school-push-report', campaignId],
    queryFn: () => fetchSchoolPushCampaignReport(campaignId!),
    enabled: Boolean(campaignId),
  });
  const data = report.data;

  const retryMut = useMutation({
    mutationFn: () => retrySchoolPush(campaignId!),
    onSuccess: () => {
      setConfirmRetry(false);
      void qc.invalidateQueries({ queryKey: ['school-push-report'] });
      void qc.invalidateQueries({ queryKey: ['school-push-campaigns'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const archiveMut = useMutation({
    mutationFn: () => archiveSchoolPush(campaignId!),
    onSuccess: () => {
      setConfirmArchive(false);
      void qc.invalidateQueries({ queryKey: ['school-push-campaigns'] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const classes = useMemo(
    () =>
      Array.from(
        new Set((data?.recipients ?? []).map((r) => r.className).filter(Boolean) as string[]),
      ).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.recipients ?? []).filter((row) => {
      if (status !== 'ALL' && row.status !== status) return false;
      if (platform !== 'ALL' && row.platform !== platform) return false;
      if (klass !== 'ALL' && row.className !== klass) return false;
      if (!needle) return true;
      return `${row.studentName} ${row.admissionNo} ${row.device} ${row.className}`
        .toLowerCase()
        .includes(needle);
    });
  }, [data, q, status, platform, klass]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pieData = data
    ? PIE.map((p) => ({
        name: p.key,
        value: data.summary[p.key],
        color: p.color,
      })).filter((d) => d.value > 0)
    : [];

  const funnel = data
    ? [
        {
          label: 'Recipients',
          count: data.summary.recipients,
          pct: 100,
          bg: 'bg-sky-200',
          w: 'w-[92%]',
        },
        {
          label: 'Sent',
          count: data.summary.sent,
          pct: data.summary.sentPct,
          bg: 'bg-sky-300',
          w: 'w-[82%]',
        },
        {
          label: 'Delivered',
          count: data.summary.delivered,
          pct: data.summary.deliveredPct,
          bg: 'bg-emerald-300',
          w: 'w-[70%]',
        },
        {
          label: 'Opened',
          count: data.summary.opened,
          pct: data.summary.openedPct,
          bg: 'bg-amber-300',
          w: 'w-[56%]',
        },
        {
          label: 'Failed',
          count: data.summary.failed,
          pct: data.summary.failedPct,
          bg: 'bg-rose-200',
          w: 'w-[44%]',
        },
      ]
    : [];

  const statRows =
    statTab === 'platform'
      ? (data?.devices.platforms ?? [])
      : statTab === 'app'
        ? (data?.devices.appVersions ?? [])
        : (data?.devices.deviceModels ?? []);

  const metrics = data
    ? [
        {
          label: 'Total Recipients',
          value: data.summary.recipients,
          pct: null as string | null,
          hint: 'Targeted recipients',
          icon: Users,
          wrap: 'bg-sky-50 text-sky-700',
        },
        {
          label: 'Sent',
          value: data.summary.sent,
          pct: `${data.summary.sentPct}%`,
          hint: 'Messages sent',
          icon: Send,
          wrap: 'bg-emerald-50 text-emerald-700',
        },
        {
          label: 'Delivered',
          value: data.summary.delivered,
          pct: `${data.summary.deliveredPct}%`,
          hint: 'Successfully delivered',
          icon: CheckCircle2,
          wrap: 'bg-emerald-50 text-emerald-700',
        },
        {
          label: 'Opened',
          value: data.summary.opened,
          pct: `${data.summary.openedPct}%`,
          hint: 'Users opened',
          icon: Eye,
          wrap: 'bg-violet-50 text-violet-700',
        },
        {
          label: 'Failed',
          value: data.summary.failed,
          pct: `${data.summary.failedPct}%`,
          hint: 'Delivery failed',
          icon: XCircle,
          wrap: 'bg-rose-50 text-rose-700',
        },
        {
          label: 'Pending',
          value: data.summary.pending,
          pct: `${data.summary.pendingPct}%`,
          hint: 'In queue',
          icon: Clock3,
          wrap: 'bg-amber-50 text-amber-700',
        },
      ]
    : [];

  return (
    <>
      <Dialog open={Boolean(campaignId)} onOpenChange={() => onClose()}>
        <DialogContent className="max-h-[95vh] max-w-[1180px] overflow-y-auto rounded-3xl border-slate-100 bg-[#f7f9fc] p-0">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
            <DialogHeader className="mb-0 flex-row items-center gap-3 space-y-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                <Send className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg text-slate-900">Notification details</DialogTitle>
                <DialogDescription>
                  Complete delivery report and recipient history for this notification.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <GhostButton
                disabled={!data?.retryableFailedCount}
                onClick={() => setConfirmRetry(true)}
              >
                Retry Failed
              </GhostButton>
              <div className="relative">
                <GhostButton onClick={() => setMenu((v) => !v)}>
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </GhostButton>
                {menu && data ? (
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    <button
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        downloadBlob('notification-delivery.csv', csvFromReport(data), 'text/csv');
                        setMenu(false);
                      }}
                    >
                      Export CSV
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        downloadBlob(
                          'notification-delivery.xls',
                          csvFromReport(data),
                          'application/vnd.ms-excel',
                        );
                        setMenu(false);
                      }}
                    >
                      Export Excel
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        printPdf(data);
                        setMenu(false);
                      }}
                    >
                      Export PDF
                    </button>
                  </div>
                ) : null}
              </div>
              <GhostButton onClick={() => setConfirmArchive(true)}>
                <Archive className="mr-1 h-4 w-4" />
                Archive
              </GhostButton>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}
            {report.isLoading ? <p className="text-sm text-slate-500">Loading report…</p> : null}
            {data ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{data.campaign.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{data.campaign.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-sky-700">
                        {data.campaign.category}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-violet-700">
                        {data.campaign.audienceType}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-700">
                        {data.campaign.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-500">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="w-16 text-slate-400">Sent on</span>
                      {fmtWhen(data.campaign.sentAt || data.campaign.createdAt)}
                    </p>
                    <p className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" />
                      <span className="w-16 text-slate-400">Sent by</span>
                      {data.sender.name}
                    </p>
                    <p className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span className="w-16 text-slate-400">Message ID</span>#
                      {data.campaign.messageId}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-white bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-xl',
                            m.wrap,
                          )}
                        >
                          <m.icon className="h-4 w-4" />
                        </span>
                        {m.pct ? (
                          <span className="text-xs font-semibold text-emerald-600">{m.pct}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-slate-900">{m.value}</p>
                      <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                      <p className="text-xs text-slate-400">{m.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <section className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">Delivery funnel</h3>
                    <div className="flex flex-col items-center gap-1.5">
                      {funnel.map((row) => (
                        <div
                          key={row.label}
                          className={cn(
                            'rounded-md py-2 text-center text-xs font-semibold text-slate-700',
                            row.bg,
                            row.w,
                          )}
                        >
                          <span className="block text-sm">
                            {row.count}
                            {row.label === 'Recipients' ? '' : ` (${row.pct}%)`}
                          </span>
                          {row.label}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">
                      Delivery analytics
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="relative h-36 w-36">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={
                                pieData.length
                                  ? pieData
                                  : [{ name: 'empty', value: 1, color: '#e2e8f0' }]
                              }
                              dataKey="value"
                              innerRadius={42}
                              outerRadius={62}
                              strokeWidth={0}
                            >
                              {(pieData.length ? pieData : [{ color: '#e2e8f0' }]).map((d) => (
                                <Cell key={d.color} fill={d.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-slate-800">
                            {data.summary.recipients}
                          </span>
                          <span className="text-[10px] text-slate-400">Recipients</span>
                        </div>
                      </div>
                      <ul className="space-y-1 text-xs">
                        {PIE.map((p) => (
                          <li key={p.key} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-2 capitalize text-slate-600">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: p.color }}
                              />
                              {p.key}
                            </span>
                            <span className="font-semibold">
                              {data.summary[p.key]} ({data.summary[`${p.key}Pct` as 'deliveredPct']}
                              %)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {data.summary.deliveredPct >= 95 ? (
                      <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                        Excellent delivery rate! {data.summary.deliveredPct}% of notifications were
                        successfully delivered.
                      </p>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">
                      Device & app statistics
                    </h3>
                    <div className="mb-3 flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold">
                      {(['platform', 'app', 'model'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setStatTab(t)}
                          className={cn(
                            'flex-1 rounded-full px-2 py-1 capitalize',
                            statTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
                          )}
                        >
                          {t === 'app'
                            ? 'App Version'
                            : t === 'model'
                              ? 'Device Models'
                              : 'Platform'}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {statRows.slice(0, 6).map((row) => (
                        <div key={row.label}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span>{row.label}</span>
                            <span className="font-semibold">
                              {row.sent} (
                              {data.summary.recipients
                                ? Math.round((row.sent / data.summary.recipients) * 100)
                                : 0}
                              %)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, (row.sent / Math.max(1, data.summary.recipients)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  <section className="rounded-2xl border border-white bg-white p-4 text-sm shadow-sm">
                    <h3 className="mb-3 font-semibold text-slate-800">Notification content</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs text-slate-400">Title</dt>
                        <dd>{data.content.title}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-400">Message</dt>
                        <dd className="text-slate-600">{data.content.message}</dd>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <dt className="text-xs text-slate-400">Category</dt>
                          <dd>{data.content.category}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">Priority</dt>
                          <dd>{data.content.priority}</dd>
                        </div>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-400">Action / Deep link</dt>
                        <dd>{data.content.deepLink || data.content.action || '—'}</dd>
                      </div>
                      {data.content.attachmentUrl ? (
                        <div>
                          <dt className="text-xs text-slate-400">Attachment</dt>
                          <dd>
                            {data.content.attachmentKind === 'pdf' ? (
                              <a
                                className="text-sky-700 underline"
                                href={data.content.attachmentUrl}
                              >
                                PDF
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={data.content.attachmentUrl}
                                alt=""
                                className="mt-1 h-12 rounded-lg"
                              />
                            )}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>
                  <section className="rounded-2xl border border-white bg-white p-4 text-sm shadow-sm">
                    <h3 className="mb-3 font-semibold text-slate-800">Audience information</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Audience</dt>
                        <dd>{data.audience.label}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Academic Year</dt>
                        <dd>{data.audience.academicYear || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Total Eligible</dt>
                        <dd>{data.audience.eligible}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Targeted</dt>
                        <dd>{data.audience.targeted}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Excluded</dt>
                        <dd>{data.audience.excluded}</dd>
                      </div>
                      {data.audience.classes.length ? (
                        <p className="text-xs text-slate-500">{data.audience.classes.join(', ')}</p>
                      ) : null}
                    </dl>
                  </section>
                  <section className="rounded-2xl border border-white bg-white p-4 text-sm shadow-sm">
                    <h3 className="mb-3 font-semibold text-slate-800">Delivery status breakdown</h3>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-slate-400">
                        <tr>
                          <th className="py-1">Status</th>
                          <th>Count</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.statusBreakdown.map((row) => (
                          <tr key={row.status} className="border-t border-slate-50">
                            <td className="py-1.5">
                              <StatusDot value={row.status} />
                            </td>
                            <td>{row.count}</td>
                            <td>{row.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                  <section className="rounded-2xl border border-white bg-white p-4 text-sm shadow-sm">
                    <h3 className="mb-3 font-semibold text-slate-800">Timeline</h3>
                    <ol className="space-y-3">
                      {data.timeline.map((item) => (
                        <li key={`${item.at}-${item.label}`} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                          <span>
                            <span className="block text-xs text-slate-400">{fmtTime(item.at)}</span>
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>

                <section className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto font-semibold text-slate-800">
                      Recipient delivery report
                    </h3>
                    <input
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by name, admission no, or device..."
                      className="h-9 w-64 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                      className="h-9 rounded-xl border border-slate-200 px-2 text-sm"
                    >
                      {['ALL', 'DELIVERED', 'OPENED', 'FAILED', 'PENDING'].map((s) => (
                        <option key={s} value={s}>
                          {s === 'ALL' ? 'All Status' : s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={klass}
                      onChange={(e) => {
                        setKlass(e.target.value);
                        setPage(1);
                      }}
                      className="h-9 rounded-xl border border-slate-200 px-2 text-sm"
                    >
                      <option value="ALL">All Classes</option>
                      {classes.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={platform}
                      onChange={(e) => {
                        setPlatform(e.target.value);
                        setPage(1);
                      }}
                      className="h-9 rounded-xl border border-slate-200 px-2 text-sm"
                    >
                      <option value="ALL">All Devices</option>
                      <option value="android">Android</option>
                      <option value="ios">iOS</option>
                    </select>
                    {data ? (
                      <GhostButton
                        onClick={() =>
                          downloadBlob(
                            'recipients.csv',
                            csvFromReport({ ...data, recipients: filtered }),
                            'text/csv',
                          )
                        }
                      >
                        <Download className="mr-1 h-4 w-4" /> Export
                      </GhostButton>
                    ) : null}
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-semibold uppercase text-slate-400">
                        <tr>
                          {[
                            '#',
                            'Name',
                            'Admission No.',
                            'Class',
                            'Device',
                            'Status',
                            'Sent At',
                            'Delivered At',
                            'Opened At',
                            'Actions',
                          ].map((h) => (
                            <th key={h} className="whitespace-nowrap px-3 py-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((row, i) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-400">
                              {(safePage - 1) * pageSize + i + 1}
                            </td>
                            <td className="px-3 py-2 font-medium">{row.studentName}</td>
                            <td className="px-3 py-2 text-slate-500">{row.admissionNo}</td>
                            <td className="px-3 py-2">{row.className || '—'}</td>
                            <td className="px-3 py-2">{row.device}</td>
                            <td className="px-3 py-2">
                              <StatusDot value={row.status} />
                            </td>
                            <td className="px-3 py-2">{fmtTime(row.sentAt)}</td>
                            <td className="px-3 py-2">{fmtTime(row.deliveredAt)}</td>
                            <td className="px-3 py-2">{fmtTime(row.openedAt)}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700"
                                onClick={() => setViewRow(row)}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                    <p>
                      Showing {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} to{' '}
                      {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}{' '}
                      recipients
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-lg border px-2 py-1 disabled:opacity-40"
                      >
                        ‹
                      </button>
                      <span className="rounded-lg bg-[#0b3a6e] px-2.5 py-1 text-white">
                        {safePage}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= pages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border px-2 py-1 disabled:opacity-40"
                      >
                        ›
                      </button>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="h-8 rounded-lg border px-1"
                      >
                        {[10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n} / page
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </div>
          <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white px-6 py-3">
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRetry} onOpenChange={setConfirmRetry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry failed delivery?</DialogTitle>
            <DialogDescription>
              Retry delivery to {data?.retryableFailedCount ?? 0} failed recipients with a
              still-valid device? Recipients who already received this notification will not be sent
              again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setConfirmRetry(false)}>Cancel</GhostButton>
            <PrimaryButton disabled={retryMut.isPending} onClick={() => retryMut.mutate()}>
              Retry failed
            </PrimaryButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive notification?</DialogTitle>
            <DialogDescription>
              Archived notifications leave the active list but remain in history. Delivery records
              are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setConfirmArchive(false)}>Cancel</GhostButton>
            <PrimaryButton disabled={archiveMut.isPending} onClick={() => archiveMut.mutate()}>
              Archive
            </PrimaryButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewRow)} onOpenChange={() => setViewRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewRow?.studentName}</DialogTitle>
            <DialogDescription>
              Recipient delivery record. Push tokens are not shown.
            </DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Admission</dt>
                <dd>{viewRow.admissionNo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Class</dt>
                <dd>{viewRow.className || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Device</dt>
                <dd>{viewRow.device}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Status</dt>
                <dd>
                  <StatusDot value={viewRow.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Sent</dt>
                <dd>{fmtWhen(viewRow.sentAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Delivered</dt>
                <dd>{fmtWhen(viewRow.deliveredAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Opened</dt>
                <dd>{fmtWhen(viewRow.openedAt)}</dd>
              </div>
              {viewRow.failureLabel ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  <p className="font-medium">{viewRow.failureLabel}</p>
                  {viewRow.failureCode ? (
                    <p className="mt-1 font-mono text-xs text-rose-700/80">{viewRow.failureCode}</p>
                  ) : null}
                  {/APNs|Apple Push/i.test(viewRow.failureLabel) ? (
                    <p className="mt-2 text-xs leading-relaxed">
                      In Firebase → Project settings → Cloud Messaging → Apple app
                      (`in.stlukestura.school`), upload an APNs Authentication Key (.p8) from Apple
                      Developer. Android can work without this; iOS cannot.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
