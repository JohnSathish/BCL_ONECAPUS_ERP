import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  Eye,
  FileText,
  Inbox,
  KeyRound,
  Package,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { readSession } from '@/lib/auth';
import { smtpReady } from '@/lib/mail';
import { visitorSummary } from '@/lib/visitors';
import { Sparkline, TrafficDonut, VisitorsLineChart } from '@/components/admin/dashboard-charts';
import { cn } from '@/lib/cn';

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

function bucketDays(dates: Date[], days = 7) {
  const counts = Array(days).fill(0);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  for (const dt of dates) {
    const diff = Math.round((now.getTime() - new Date(dt).setHours(12, 0, 0, 0)) / 86400000);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  }
  return counts;
}

function deltaLabel(current: number, previous: number, suffix: string) {
  const d = current - previous;
  return {
    text: `${d > 0 ? '+' : ''}${d} ${suffix}`,
    up: d >= 0,
  };
}

function activityTone(action: string) {
  if (action.includes('login'))
    return { label: 'Login', className: 'bg-emerald-50 text-emerald-700' };
  if (action.includes('otp') || action.includes('security'))
    return { label: 'Security', className: 'bg-sky-50 text-sky-700' };
  if (action.includes('license'))
    return { label: 'License', className: 'bg-violet-50 text-violet-700' };
  return { label: 'System', className: 'bg-slate-100 text-slate-600' };
}

export default async function AdminHome() {
  const session = await readSession();
  const first = session?.user.name?.split(/\s+/)[0] || 'Admin';
  const now = new Date();
  const thisMonth = startOfMonth(now);
  const lastMonth = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const week = weekAgo();

  const [
    clients,
    products,
    licenses,
    expiring,
    leads,
    visitors,
    activity,
    latestLeads,
    clientRows,
    productRows,
    licenseRows,
    leadRows,
    yesterday,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.product.count(),
    prisma.license.count({ where: { status: 'ACTIVE' } }),
    prisma.license.count({
      where: {
        status: 'ACTIVE',
        expiryDate: { lte: new Date(Date.now() + 30 * 86400000), gte: now },
      },
    }),
    prisma.lead.count(),
    visitorSummary(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.client.findMany({ where: { createdAt: { gte: week } }, select: { createdAt: true } }),
    prisma.product.findMany({ where: { createdAt: { gte: week } }, select: { createdAt: true } }),
    prisma.license.findMany({ where: { createdAt: { gte: week } }, select: { createdAt: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: week } }, select: { createdAt: true } }),
    prisma.visitorDay.findUnique({
      where: { day: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    }),
  ]);

  const [clientsThis, clientsLast, productsThis, productsLast, licThis, licLast] =
    await Promise.all([
      prisma.client.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.client.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),
      prisma.product.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.product.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),
      prisma.license.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.license.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),
    ]);

  const yVisitors = yesterday?.uniqueVisitors ?? 0;
  const yViews = yesterday?.pageViews ?? 0;
  const monthUnique = visitors.last7.reduce((s, d) => s + d.uniqueVisitors, 0);

  const cards = [
    {
      label: 'Clients',
      value: clients,
      href: '/admin/clients',
      icon: Users,
      color: '#0ea5e9',
      series: bucketDays(clientRows.map((r) => r.createdAt)),
      delta: deltaLabel(clientsThis, clientsLast, 'this month'),
    },
    {
      label: 'Products',
      value: products,
      href: '/admin/products',
      icon: Package,
      color: '#8b5cf6',
      series: bucketDays(productRows.map((r) => r.createdAt)),
      delta: deltaLabel(productsThis, productsLast, 'this month'),
    },
    {
      label: 'Active licenses',
      value: licenses,
      href: '/admin/licenses',
      icon: KeyRound,
      color: '#10b981',
      series: bucketDays(licenseRows.map((r) => r.createdAt)),
      delta: deltaLabel(licThis, licLast, 'this month'),
    },
    {
      label: 'Expiring in 30 days',
      value: expiring,
      href: '/admin/licenses',
      icon: Clock3,
      color: '#f59e0b',
      series: visitors.last7.map((d) => d.uniqueVisitors),
      delta: { text: 'from live license records', up: true },
    },
    {
      label: 'Leads',
      value: leads,
      href: '/admin/leads',
      icon: Inbox,
      color: '#6366f1',
      series: bucketDays(leadRows.map((r) => r.createdAt)),
      delta: deltaLabel(leadRows.length, 0, 'this week'),
    },
    {
      label: 'Visitors today',
      value: visitors.todayUnique,
      href: '/admin/visitors',
      icon: Eye,
      color: '#06b6d4',
      series: visitors.last7.map((d) => d.uniqueVisitors),
      delta: deltaLabel(visitors.todayUnique, yVisitors, 'vs yesterday'),
    },
    {
      label: 'All unique visitors',
      value: visitors.allUnique,
      href: '/admin/visitors',
      icon: Users,
      color: '#a855f7',
      series: visitors.last7.map((d) => d.uniqueVisitors),
      delta: { text: `+${monthUnique} last 7 days`, up: true },
    },
    {
      label: 'Page views today',
      value: visitors.todayViews,
      href: '/admin/visitors',
      icon: Eye,
      color: '#3b82f6',
      series: visitors.last7.map((d) => d.pageViews),
      delta: deltaLabel(visitors.todayViews, yViews, 'vs yesterday'),
    },
  ];

  const trafficSlices = [
    { label: 'Direct', value: visitors.traffic.Direct, color: '#2563eb' },
    { label: 'Google', value: visitors.traffic.Google, color: '#14b8a6' },
    { label: 'Referral', value: visitors.traffic.Referral, color: '#8b5cf6' },
    { label: 'Social', value: visitors.traffic.Social, color: '#22c55e' },
    { label: 'Other', value: visitors.traffic.Other, color: '#eab308' },
  ];

  const chartPoints = visitors.last7.map((d) => ({
    label: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    }),
    value: d.uniqueVisitors,
  }));

  const systems = [
    { label: 'Website', ok: true },
    { label: 'License API', ok: true },
    { label: 'Database', ok: true },
    { label: 'Email service', ok: smtpReady() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Welcome back, {first} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here’s what’s happening with your business today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: `${c.color}18`, color: c.color }}
              >
                <c.icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{c.value}</p>
            <p
              className={cn(
                'mt-1 text-xs font-semibold',
                c.delta.up ? 'text-emerald-600' : 'text-rose-500',
              )}
            >
              {c.delta.text}
            </p>
            <div className="mt-2">
              <Sparkline values={c.series} color={c.color} />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr_0.85fr]">
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Website Visitors</h2>
              <p className="text-xs text-slate-500">Unique visitors over the last 7 days</p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              Last 7 days
            </span>
          </div>
          <VisitorsLineChart points={chartPoints} />
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <h2 className="font-semibold text-slate-900">Traffic Sources</h2>
          <p className="text-xs text-slate-500">Where your visitors come from</p>
          <div className="mt-4">
            <TrafficDonut slices={trafficSlices} total={visitors.trafficTotal} />
          </div>
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <p className="mb-4 text-xs text-slate-500">Manage your platform quickly</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                href: '/admin/clients',
                label: 'Add Client',
                icon: Users,
                wrap: 'bg-sky-50 text-sky-700',
              },
              {
                href: '/admin/products',
                label: 'Add Product',
                icon: Package,
                wrap: 'bg-violet-50 text-violet-700',
              },
              {
                href: '/admin/licenses',
                label: 'Generate License',
                icon: KeyRound,
                wrap: 'bg-emerald-50 text-emerald-700',
              },
              {
                href: '/admin/leads',
                label: 'View Leads',
                icon: FileText,
                wrap: 'bg-amber-50 text-amber-700',
              },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={cn('rounded-2xl p-3 text-sm font-semibold', a.wrap)}
              >
                <a.icon className="h-4 w-4" />
                <span className="mt-2 flex items-center justify-between">
                  {a.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-xs text-slate-500">Latest actions in the system</p>
            </div>
            <Link href="/admin/visitors" className="text-xs font-semibold text-blue-600">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {activity.map((a) => {
              const tone = activityTone(a.action);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block text-slate-800">{a.action}</span>
                    <span className="text-xs text-slate-400">
                      {a.createdAt.toLocaleString('en-IN')} · {a.entity}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      tone.className,
                    )}
                  >
                    {tone.label}
                  </span>
                </li>
              );
            })}
            {!activity.length ? <li className="text-sm text-slate-500">No events yet.</li> : null}
          </ul>
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <h2 className="font-semibold text-slate-900">System Status</h2>
          <p className="text-xs text-slate-500">Checks from this running instance</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {systems.every((s) => s.ok) ? 'All systems operational' : 'Attention needed'}
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {systems.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <span
                    className={cn('h-2 w-2 rounded-full', s.ok ? 'bg-emerald-500' : 'bg-amber-400')}
                  />
                  {s.label}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    s.ok ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {s.ok ? 'Operational' : 'Not configured'}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Latest Leads</h2>
              <p className="text-xs text-slate-500">Recent enquiries from the website</p>
            </div>
            <Link href="/admin/leads" className="text-xs font-semibold text-blue-600">
              View all
            </Link>
          </div>
          {latestLeads.length ? (
            <ul className="mt-4 space-y-3">
              {latestLeads.map((l) => (
                <li key={l.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <p className="text-xs text-slate-500">
                    {l.organisation ?? l.email} · {l.service ?? 'Enquiry'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No new leads yet</p>
              <p className="mt-1 text-xs text-slate-500">
                When someone enquires through the website, their details will appear here.
              </p>
              <Link
                href="/admin/leads"
                className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                View All Leads
              </Link>
            </div>
          )}
        </article>
      </div>

      <p className="flex items-center justify-between text-[11px] text-slate-400">
        <span>© {new Date().getFullYear()} BaseCode Labs Pvt. Ltd. All rights reserved.</span>
        <span>Your Technology Growth Partner</span>
      </p>
    </div>
  );
}
