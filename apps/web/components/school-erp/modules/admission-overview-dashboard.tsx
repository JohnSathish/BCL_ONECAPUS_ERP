'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  Settings2,
  Wallet,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SCHOOL_CASTE_CATEGORY_POLICY } from '@/lib/school-admission-category';
import {
  exportSchoolOfficeApplications,
  fetchSchoolOfficeApplications,
  fetchSchoolOfficeSummary,
} from '@/services/school-admissions';
import { SchoolErpPanel } from '../school-erp-ui';
import {
  SchoolErpActivityItem,
  SchoolErpKpiCard,
  SchoolErpNoticeItem,
  SchoolErpQuickActionTile,
} from '../widgets/dashboard-widgets';
import { cn } from '@/utils/cn';

const CATEGORY_COLORS = ['#1b4d3e', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'];

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'allotted') return 'bg-emerald-100 text-emerald-800';
  if (s === 'submitted' || s === 'under_review') return 'bg-amber-100 text-amber-900';
  if (s === 'draft') return 'bg-sky-100 text-sky-800';
  if (s === 'rejected') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

function humanStatus(status: string) {
  if (status === 'draft') return 'In Progress';
  if (status === 'allotted') return 'Granted';
  if (status === 'under_review') return 'Under Review';
  if (status === 'rejected') return 'Not Granted';
  return status.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Admission Overview dashboard widgets.
 * Loaded only when the Admission module is active in SCHOOL_ERP_MODULES.
 */
export function SchoolAdmissionOverviewDashboard() {
  const enabled = useAuthQueryEnabled();
  const [exporting, setExporting] = useState(false);
  const summary = useQuery({
    queryKey: ['school-office-summary'],
    queryFn: fetchSchoolOfficeSummary,
    enabled,
  });
  const recent = useQuery({
    queryKey: ['school-office-applications-dashboard'],
    queryFn: () => fetchSchoolOfficeApplications({ limit: 100 }),
    enabled,
  });

  const data = summary.data;
  const window = data?.admissionWindow;
  const open = window?.isOpen;
  const daysLeft = daysUntil(window?.registrationClosesAt);

  const categoryChart = useMemo(() => {
    return SCHOOL_CASTE_CATEGORY_POLICY.map((item) => ({
      name: item.label.replace(/\s*\(.*\)\s*$/, ''),
      full: item.label,
      code: item.code,
      value: data?.byCategory?.[item.code] ?? 0,
    })).filter((item) => item.value > 0);
  }, [data?.byCategory]);

  const trendChart = useMemo(() => {
    const apps = recent.data?.data ?? [];
    const localKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days: { key: string; label: string; new: number; submitted: number; granted: number }[] =
      [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = localKey(d);
      days.push({
        key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        new: 0,
        submitted: 0,
        granted: 0,
      });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const app of apps) {
      const created = new Date(app.createdAt);
      created.setHours(0, 0, 0, 0);
      const bucket = byKey.get(localKey(created));
      if (bucket) bucket.new += 1;
      if (app.submittedAt) {
        const submitted = new Date(app.submittedAt);
        submitted.setHours(0, 0, 0, 0);
        const sBucket = byKey.get(localKey(submitted));
        if (sBucket) sBucket.submitted += 1;
      }
      if (app.status === 'allotted' && app.submittedAt) {
        const granted = new Date(app.submittedAt);
        granted.setHours(0, 0, 0, 0);
        const gBucket = byKey.get(localKey(granted));
        if (gBucket) gBucket.granted += 1;
      }
    }
    return days;
  }, [recent.data?.data]);

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const blob = await exportSchoolOfficeApplications();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      link.download = `Tura_Public_School_KG_Admission_2027_Report_${d}-${m}-${y}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const categoryTotal =
    categoryChart.reduce((sum, item) => sum + item.value, 0) || data?.total || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
            Active module
          </p>
          <h2 className="text-lg font-semibold text-[var(--school-erp-primary)]">
            K.G. Admission 2027 — Overview
          </h2>
        </div>
        <Link
          href="/admin/school-admissions"
          className="text-sm font-medium text-[var(--school-erp-primary)] underline"
        >
          Open applications
        </Link>
      </div>

      {/* KPI + deadline */}
      <div className="grid gap-4 xl:grid-cols-[1fr_16rem]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SchoolErpKpiCard
            label="Total Applications"
            value={data?.total}
            hint="All registered applications"
            tone="green"
            href="/admin/school-admissions"
          />
          <SchoolErpKpiCard
            label="Seats Remaining"
            value={window?.seatsRemaining}
            hint={
              typeof window?.maxOnlineApplications === 'number'
                ? `Limit ${window.maxOnlineApplications} · change in Admission Settings`
                : 'Set the limit in Admission Settings'
            }
            tone="blue"
            href="/admin/school-admissions/admission-settings"
          />
          <SchoolErpKpiCard
            label="In Progress"
            value={data?.draft}
            hint="Draft / incomplete"
            tone="blue"
            href="/admin/school-admissions?status=draft"
          />
          <SchoolErpKpiCard
            label="Submitted"
            value={data?.submitted}
            hint="Awaiting office review"
            tone="orange"
            href="/admin/school-admissions?status=submitted"
          />
          <SchoolErpKpiCard
            label="Under Review"
            value={data?.underReview}
            hint="Payment / documents in progress"
            tone="purple"
            href="/admin/school-admissions?status=under_review"
          />
          <SchoolErpKpiCard
            label="Payment Pending"
            value={data?.pendingPayment}
            hint="Fee not yet verified"
            tone="orange"
            href="/admin/school-admissions/payments/pending"
          />
          <SchoolErpKpiCard
            label="Fee Paid"
            value={data?.paid}
            hint="Payment verified"
            tone="green"
            href="/admin/school-admissions/payments/verified"
          />
          <SchoolErpKpiCard
            label="Admission Granted"
            value={data?.granted}
            hint="Confirmed for K.G."
            tone="purple"
            href="/admin/school-admissions?status=allotted"
          />
          <SchoolErpKpiCard
            label="Ready for Decision"
            value={data?.readyForDecision}
            hint="Payment + docs verified"
            tone="slate"
            href="/admin/school-admissions/decisions"
          />
        </div>

        <div
          className={cn(
            'rounded-2xl border p-4 shadow-sm',
            open
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
              : 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--school-erp-primary)]">
                Admission Deadline
              </p>
              <p className="mt-0.5 text-xs text-[var(--school-erp-muted)]">Application window</p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                open ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white',
              )}
            >
              {open ? 'Open' : 'Closed'}
            </span>
          </div>
          <div className="mt-4 text-center">
            <p className="text-3xl font-semibold tracking-tight text-[var(--school-erp-primary)]">
              {daysLeft == null ? '—' : daysLeft < 0 ? '0' : daysLeft}
            </p>
            <p className="text-xs font-medium text-[var(--school-erp-muted)]">
              {daysLeft == null
                ? 'Closing date not set'
                : daysLeft < 0
                  ? 'Closing date passed'
                  : daysLeft === 1
                    ? 'Day Left'
                    : 'Days Left'}
            </p>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" />
            Last Date: {window?.lastDateLabel ?? '—'}
          </p>
          <Link
            href="/admin/school-admissions/admission-settings"
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--school-erp-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--school-erp-primary-hover)]"
          >
            Admission Settings
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Trends + category + recent */}
      <div className="grid gap-4 xl:grid-cols-12">
        <SchoolErpPanel
          className="xl:col-span-5"
          title="Application Trends"
          action={<span className="text-[11px] text-[var(--school-erp-muted)]">Last 30 days</span>}
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(27,77,62,0.15)',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="new"
                  name="New"
                  stroke="#1b4d3e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="submitted"
                  name="Submitted"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="granted"
                  name="Granted"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SchoolErpPanel>

        <SchoolErpPanel
          className="xl:col-span-3"
          title="Applications by Category"
          action={
            <Link
              href="/admin/school-admissions"
              className="text-[11px] font-medium text-[var(--school-erp-primary)]"
            >
              View all
            </Link>
          }
        >
          <div className="relative mx-auto h-44 w-full max-w-[11rem]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChart.length ? categoryChart : [{ name: 'None', value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={2}
                >
                  {(categoryChart.length ? categoryChart : [{ name: 'None', value: 1 }]).map(
                    (_, i) => (
                      <Cell
                        key={i}
                        fill={
                          categoryChart.length
                            ? CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                            : '#e2e8f0'
                        }
                      />
                    ),
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-semibold text-[var(--school-erp-primary)]">
                {categoryTotal}
              </p>
              <p className="text-[10px] text-[var(--school-erp-muted)]">Total</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs">
            {SCHOOL_CASTE_CATEGORY_POLICY.map((item, i) => (
              <li key={item.code} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                  {item.label}
                </span>
                <span className="font-semibold text-[var(--school-erp-primary)]">
                  {data?.byCategory?.[item.code] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </SchoolErpPanel>

        <SchoolErpPanel
          className="xl:col-span-4"
          title="Recent Applications"
          action={
            <Link
              href="/admin/school-admissions"
              className="text-[11px] font-medium text-[var(--school-erp-primary)]"
            >
              See all
            </Link>
          }
        >
          <ul className="space-y-2">
            {(recent.data?.data ?? []).slice(0, 6).map((row) => (
              <SchoolErpActivityItem
                key={row.id}
                href={`/admin/school-admissions/${row.id}`}
                title={row.childName || row.firstName}
                subtitle={row.applicationNumber}
                initial={(row.childName || row.firstName)?.slice(0, 1)}
                badge={humanStatus(row.status)}
                badgeClassName={statusBadge(row.status)}
              />
            ))}
            {!recent.data?.data?.length ? (
              <li className="py-6 text-center text-sm text-slate-500">No applications yet.</li>
            ) : null}
          </ul>
        </SchoolErpPanel>
      </div>

      {/* Notices + quick actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SchoolErpPanel title="Important Notices">
          <ul className="space-y-3">
            <SchoolErpNoticeItem
              tone="green"
              title="K.G. Admission 2027"
              body={
                open
                  ? `Online applications are open${window?.lastDateLabel ? ` until ${window.lastDateLabel}` : ''}.`
                  : window?.message || 'Online applications are currently closed.'
              }
            />
            <SchoolErpNoticeItem
              tone="gold"
              title="Document requirements"
              body="Certificates depend on the child’s Caste / Category — Caste Certificate for General / UR, Mother’s ST for Garo / Khasi / Jaintia, or Father’s SC / OBC when those categories apply."
            />
            <SchoolErpNoticeItem
              tone="slate"
              title="Work queues"
              body="Use Payment Verification and Document Verification in the sidebar to process many applicants without opening each profile first."
            />
          </ul>
        </SchoolErpPanel>

        <SchoolErpPanel title="Quick Actions">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SchoolErpQuickActionTile
              href="/admin/school-admissions"
              label="K.G. Applications"
              icon={<ClipboardList className="h-4 w-4" />}
              tone="green"
            />
            <SchoolErpQuickActionTile
              href="/admin/school-admissions/payments/pending"
              label={`Payments (${data?.pendingPaymentVerification ?? 0})`}
              icon={<Wallet className="h-4 w-4" />}
              tone="orange"
            />
            <SchoolErpQuickActionTile
              href="/admin/school-admissions/documents/pending"
              label={`Documents (${data?.pendingDocumentVerification ?? 0})`}
              icon={<FolderOpen className="h-4 w-4" />}
              tone="blue"
            />
            <SchoolErpQuickActionTile
              href="/admin/school-admissions/decisions"
              label={`Decisions (${data?.readyForDecision ?? 0})`}
              icon={<ClipboardList className="h-4 w-4" />}
              tone="purple"
            />
            <SchoolErpQuickActionTile
              href="/admin/school-admissions/admission-settings"
              label="Admission Settings"
              icon={<Settings2 className="h-4 w-4" />}
              tone="slate"
            />
            <button
              type="button"
              onClick={() => void downloadExcel()}
              disabled={exporting}
              className="flex flex-col items-start gap-2 rounded-xl bg-slate-800 px-3 py-3 text-left text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-200" />
              <span className="text-xs font-semibold leading-snug">
                {exporting ? 'Exporting…' : 'Export Excel'}
              </span>
            </button>
          </div>
        </SchoolErpPanel>
      </div>
    </div>
  );
}

/** Placeholder for future module overviews — keeps the composer pattern ready. */
export function SchoolErpComingSoonModulePanel({ label }: { label: string }) {
  return (
    <SchoolErpPanel title={label}>
      <p className="text-sm text-[var(--school-erp-muted)]">
        This module is not active yet. It will appear on the home dashboard when enabled for the
        school.
      </p>
    </SchoolErpPanel>
  );
}
