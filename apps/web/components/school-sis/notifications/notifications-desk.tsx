'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { fetchSchoolAcademicClasses, fetchSchoolSisStudents } from '@/services/school-sis';
import { api } from '@/services/api';
import {
  archiveSchoolPush,
  cancelSchoolPush,
  fetchSchoolPushCampaigns,
  fetchSchoolPushDashboard,
  fetchSchoolPushDelivery,
  fetchSchoolPushDevices,
  fetchSchoolPushLogs,
  fetchSchoolPushPreferences,
  fetchSchoolPushRules,
  fetchSchoolPushSettings,
  fetchSchoolPushTemplates,
  previewSchoolPushAudience,
  retrySchoolPush,
  saveSchoolPushPreference,
  saveSchoolPushRule,
  saveSchoolPushSettings,
  saveSchoolPushTemplate,
  testSchoolPush,
  unregisterSchoolPushDevice,
} from '@/services/school-push';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  History,
  Mail,
  Megaphone,
  MoreHorizontal,
  Search,
  Send,
  Settings2,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge } from '../whatsapp/whatsapp-ui';
import {
  AUDIENCES,
  CATEGORIES,
  NotificationComposer,
  type NotificationDraft,
} from './notification-composer';
import { NotificationDeliveryReport } from './notification-delivery-report';

const LINKS = [
  {
    href: '/admin/school-sis/notifications',
    label: 'Push Notifications',
    exact: true,
    icon: Send,
  },
  { href: '/admin/school-sis/notifications/templates', label: 'Templates', icon: FileText },
  { href: '/admin/school-sis/notifications/scheduled', label: 'Scheduled', icon: CalendarClock },
  { href: '/admin/school-sis/notifications/history', label: 'History', icon: History },
  { href: '/admin/school-sis/notifications/delivery', label: 'Delivery', icon: BarChart3 },
  { href: '/admin/school-sis/notifications/devices', label: 'Devices', icon: Smartphone },
  { href: '/admin/school-sis/notifications/preferences', label: 'Preferences', icon: Bell },
  { href: '/admin/school-sis/notifications/settings', label: 'Settings', icon: Settings2 },
];

function categoryChip(category: string) {
  const map: Record<string, string> = {
    GENERAL: 'bg-sky-50 text-sky-700',
    FEE: 'bg-violet-50 text-violet-700',
    FEES: 'bg-violet-50 text-violet-700',
    ACADEMIC_CALENDAR: 'bg-emerald-50 text-emerald-700',
    ANNOUNCEMENT: 'bg-indigo-50 text-indigo-700',
    ATTENDANCE: 'bg-amber-50 text-amber-800',
    EXAMINATION: 'bg-rose-50 text-rose-700',
    RESULT: 'bg-teal-50 text-teal-700',
    EMERGENCY: 'bg-red-50 text-red-700',
  };
  return map[category] ?? 'bg-slate-100 text-slate-600';
}

function StatusMark({ value }: { value: string }) {
  const v = value.toUpperCase();
  const dot =
    v === 'SENT' || v === 'DELIVERED'
      ? 'bg-emerald-500'
      : v.includes('PARTIAL')
        ? 'bg-amber-500'
        : v.includes('FAIL')
          ? 'bg-rose-500'
          : v === 'SCHEDULED'
            ? 'bg-sky-500'
            : 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function sectionOf(pathname: string | null) {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  const i = parts.indexOf('notifications');
  return parts[i + 1] ?? 'dashboard';
}

export function NotificationsDesk() {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionOf(pathname);
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [composer, setComposer] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<{ recipients: number; devices: number } | null>(null);
  const [draft, setDraft] = useState<NotificationDraft>({
    title: '',
    body: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    deepLinkType: 'NONE',
    deepLinkValue: '',
    imageUrl: '',
    attachmentName: '',
    attachmentKind: '',
    kind: 'MY_DEVICES',
    gradeId: '',
    sectionId: '',
    studentIds: [] as string[],
    studentQ: '',
    scheduledAt: '',
    sendMode: 'now' as 'now' | 'schedule' | 'draft',
  });

  const dash = useQuery({
    queryKey: ['school-push-dash'],
    queryFn: fetchSchoolPushDashboard,
    enabled,
  });
  const campaigns = useQuery({
    queryKey: ['school-push-campaigns', section],
    queryFn: () =>
      fetchSchoolPushCampaigns(
        section === 'scheduled' ? 'SCHEDULED' : undefined,
        section === 'history',
      ),
    enabled: enabled && ['dashboard', 'scheduled', 'history'].includes(section),
  });
  const templates = useQuery({
    queryKey: ['school-push-templates'],
    queryFn: fetchSchoolPushTemplates,
    enabled: enabled && (section === 'templates' || composer),
  });
  const devices = useQuery({
    queryKey: ['school-push-devices'],
    queryFn: () => fetchSchoolPushDevices(),
    enabled: enabled && section === 'devices',
  });
  const delivery = useQuery({
    queryKey: ['school-push-delivery'],
    queryFn: () => fetchSchoolPushDelivery(),
    enabled: enabled && section === 'delivery',
  });
  const settings = useQuery({
    queryKey: ['school-push-settings'],
    queryFn: fetchSchoolPushSettings,
    enabled: enabled && section === 'settings',
  });
  const prefs = useQuery({
    queryKey: ['school-push-prefs'],
    queryFn: fetchSchoolPushPreferences,
    enabled: enabled && section === 'preferences',
  });
  const rules = useQuery({
    queryKey: ['school-push-rules'],
    queryFn: fetchSchoolPushRules,
    enabled: enabled && section === 'settings',
  });
  const logs = useQuery({
    queryKey: ['school-push-logs'],
    queryFn: fetchSchoolPushLogs,
    enabled: enabled && section === 'settings',
  });
  const classes = useQuery({
    queryKey: ['school-push-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled: composer,
  });
  const students = useQuery({
    queryKey: ['school-push-students', draft.studentQ],
    queryFn: () => fetchSchoolSisStudents({ q: draft.studentQ }),
    enabled:
      composer &&
      ['INDIVIDUAL_STUDENT', 'PARENT'].includes(draft.kind) &&
      draft.studentQ.length > 1,
  });
  const audience = useMemo(() => {
    const base: Record<string, unknown> = { kind: draft.kind };
    if (draft.gradeId) base.gradeIds = [draft.gradeId];
    if (draft.sectionId) base.sectionIds = [draft.sectionId];
    if (draft.studentIds.length) base.studentIds = draft.studentIds;
    return base;
  }, [draft]);

  const sendMut = useMutation({
    mutationFn: async (confirm: boolean) => {
      const payload = {
        title: draft.title,
        body: draft.body,
        category: draft.category,
        priority: draft.priority,
        deepLinkType: draft.deepLinkType,
        deepLinkValue: draft.deepLinkValue || undefined,
        imageUrl: draft.imageUrl || undefined,
        audience,
        scheduledAt:
          draft.sendMode === 'schedule' && draft.scheduledAt
            ? new Date(draft.scheduledAt).toISOString()
            : undefined,
        confirm,
      };
      const path =
        draft.sendMode === 'draft'
          ? '/v1/school-sis/notifications/draft'
          : draft.sendMode === 'schedule'
            ? '/v1/school-sis/notifications/schedule'
            : '/v1/school-sis/notifications/send';
      const { data } = await api.post(path, payload);
      return data;
    },
    onSuccess: () => {
      setComposer(false);
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ['school-push-dash'] });
      void qc.invalidateQueries({ queryKey: ['school-push-campaigns'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const d = dash.data as
    | {
        totalDevices: number;
        activeDevices: number;
        sent: number;
        delivered: number;
        opened: number;
        failed: number;
        scheduled: number;
        deliveredPct: number;
        openedPct: number;
        failedPct: number;
        fcm?: { configured?: boolean; demo?: boolean; projectId?: string | null };
      }
    | undefined;

  const title =
    section === 'templates'
      ? 'Notification Templates'
      : section === 'scheduled'
        ? 'Scheduled Notifications'
        : section === 'history'
          ? 'Notification History'
          : section === 'delivery'
            ? 'Delivery Reports'
            : section === 'devices'
              ? 'Device Management'
              : section === 'preferences'
                ? 'Notification Preferences'
                : section === 'settings'
                  ? 'Notification Settings'
                  : 'Push Notifications';

  return (
    <div className="min-h-full space-y-5 bg-[#eef3fb] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 shadow-sm">
            <Megaphone className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Notifications
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#1d4ed8]">{title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {section === 'history'
                ? 'Review every sent notification and open a full delivery report for recipients, devices, and failures.'
                : 'Send and manage mobile notifications for students, parents, teachers and staff.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
            <Calendar className="h-4 w-4 text-sky-500" />
            <span>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
          </label>
          {canManage ? (
            <button
              type="button"
              onClick={() => setComposer(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:bg-[#172e6e]"
            >
              <Send className="h-4 w-4" />
              Send Notification
            </button>
          ) : null}
        </div>
      </div>
      <nav className="flex flex-wrap gap-2">
        {LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold sm:text-sm',
                active
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {error && !composer && !confirmOpen ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {section === 'dashboard' ? (
        dash.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: 'Total Devices',
                  value: d?.totalDevices ?? 0,
                  hint: 'Registered devices',
                  icon: Smartphone,
                  wrap: 'bg-sky-50 text-sky-600',
                },
                {
                  label: 'Active Devices',
                  value: d?.activeDevices ?? 0,
                  hint: 'Currently active',
                  icon: Wifi,
                  wrap: 'bg-emerald-50 text-emerald-600',
                },
                {
                  label: 'Notifications Sent',
                  value: (d?.sent ?? 0).toLocaleString('en-IN'),
                  hint: 'This month',
                  icon: Send,
                  wrap: 'bg-violet-50 text-violet-600',
                },
                {
                  label: 'Delivered',
                  value: (d?.delivered ?? 0).toLocaleString('en-IN'),
                  hint: `${pct(d?.deliveredPct ?? 0)} success rate`,
                  icon: CheckCircle2,
                  wrap: 'bg-emerald-50 text-emerald-600',
                },
                {
                  label: 'Opened',
                  value: d?.opened ?? 0,
                  hint: `${pct(d?.openedPct ?? 0)} open rate`,
                  icon: Mail,
                  wrap: 'bg-amber-50 text-amber-600',
                },
                {
                  label: 'Failed',
                  value: d?.failed ?? 0,
                  hint: `${pct(d?.failedPct ?? 0)} · ${d?.scheduled ?? 0} scheduled`,
                  icon: AlertTriangle,
                  wrap: 'bg-rose-50 text-rose-600',
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="rounded-[1.4rem] border border-white bg-white/90 p-4 shadow-sm shadow-sky-100/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">{card.label}</p>
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl',
                          card.wrap,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: 'Send Notification',
                  hint: 'Compose and send a new notification',
                  icon: Send,
                  tint: 'bg-sky-50 text-sky-600',
                  onClick: () => setComposer(true),
                },
                {
                  label: 'Schedule Notification',
                  hint: 'Set date and time for later',
                  icon: CalendarClock,
                  tint: 'bg-violet-50 text-violet-600',
                  onClick: () => {
                    setDraft((s) => ({ ...s, sendMode: 'schedule' }));
                    setComposer(true);
                  },
                },
                {
                  label: 'Create Template',
                  hint: 'Save time with reusable templates',
                  icon: FileText,
                  tint: 'bg-emerald-50 text-emerald-600',
                  onClick: () => router.push('/admin/school-sis/notifications/templates'),
                },
                {
                  label: 'View Delivery Report',
                  hint: 'Detailed delivery and engagement stats',
                  icon: BarChart3,
                  tint: 'bg-indigo-50 text-indigo-600',
                  onClick: () => router.push('/admin/school-sis/notifications/delivery'),
                },
                {
                  label: 'Manage Devices',
                  hint: 'View and manage registered devices',
                  icon: Smartphone,
                  tint: 'bg-amber-50 text-amber-600',
                  onClick: () => router.push('/admin/school-sis/notifications/devices'),
                },
                {
                  label: 'Notification Settings',
                  hint: 'Configure preferences and defaults',
                  icon: Settings2,
                  tint: 'bg-slate-100 text-slate-600',
                  onClick: () => router.push('/admin/school-sis/notifications/settings'),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-white bg-white p-4 text-left shadow-sm shadow-sky-100/70 hover:border-sky-200"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl',
                          item.tint,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span>
                      </span>
                    </span>
                    <span className="text-lg text-slate-300">›</span>
                  </button>
                );
              })}
            </div>
            <CampaignTable
              rows={(campaigns.data ?? []) as Array<Record<string, unknown>>}
              onView={setDetailId}
              onRetry={(id) => retrySchoolPush(id).then(() => qc.invalidateQueries())}
              onArchive={(id) => archiveSchoolPush(id).then(() => qc.invalidateQueries())}
              emptyAction={() => setComposer(true)}
            />
          </>
        )
      ) : null}

      {section === 'templates' ? (
        <TemplatesPanel
          rows={(templates.data ?? []) as Array<Record<string, unknown>>}
          canManage={canManage}
          onSave={(payload, id) =>
            saveSchoolPushTemplate(payload, id).then(() =>
              qc.invalidateQueries({ queryKey: ['school-push-templates'] }),
            )
          }
        />
      ) : null}

      {['scheduled', 'history'].includes(section) ? (
        <CampaignTable
          rows={(campaigns.data ?? []) as Array<Record<string, unknown>>}
          onView={setDetailId}
          onRetry={(id) => retrySchoolPush(id).then(() => qc.invalidateQueries())}
          onCancel={(id) => cancelSchoolPush(id).then(() => qc.invalidateQueries())}
          onArchive={(id) => archiveSchoolPush(id).then(() => qc.invalidateQueries())}
          emptyAction={() => setComposer(true)}
        />
      ) : null}

      {section === 'delivery' ? (
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {['Notification', 'Platform', 'Status', 'Failure', 'Sent'].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((delivery.data ?? []) as Array<Record<string, unknown>>).map((row) => (
                <tr key={String(row.id)} className="border-t">
                  <td className="px-3 py-2">
                    {String((row.campaign as { title?: string } | undefined)?.title ?? '')}
                  </td>
                  <td className="px-3 py-2">{String(row.platform ?? '')}</td>
                  <td className="px-3 py-2">
                    <WaBadge value={String(row.status)} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{String(row.failureReason ?? '—')}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {row.sentAt ? new Date(String(row.sentAt)).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!delivery.data?.length ? (
            <p className="p-8 text-center text-sm text-slate-500">No delivery records yet.</p>
          ) : null}
        </div>
      ) : null}

      {section === 'devices' ? (
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {['Platform', 'Persona', 'Model', 'App', 'Last seen', ''].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((devices.data ?? []) as Array<Record<string, unknown>>).map((row) => (
                <tr key={String(row.id)} className="border-t">
                  <td className="px-3 py-2">{String(row.platform)}</td>
                  <td className="px-3 py-2">{String(row.persona)}</td>
                  <td className="px-3 py-2">{String(row.deviceModel ?? row.deviceLabel ?? '—')}</td>
                  <td className="px-3 py-2">{String(row.appVersion ?? '—')}</td>
                  <td className="px-3 py-2">
                    {new Date(String(row.lastActiveAt)).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {canManage && !row.revokedAt ? (
                      <GhostButton
                        onClick={() =>
                          unregisterSchoolPushDevice(String(row.id)).then(() =>
                            qc.invalidateQueries({ queryKey: ['school-push-devices'] }),
                          )
                        }
                      >
                        Deactivate
                      </GhostButton>
                    ) : (
                      <WaBadge value={row.revokedAt ? 'INACTIVE' : 'ACTIVE'} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'preferences' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.filter((c) => c !== 'EMERGENCY' && c !== 'SYSTEM').map((cat) => {
            const on = prefs.data?.find((p) => p.category === cat)?.enabled ?? true;
            return (
              <label
                key={cat}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="text-sm font-medium text-slate-700">
                  {cat.replaceAll('_', ' ')}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    saveSchoolPushPreference({ category: cat, enabled: e.target.checked }).then(
                      () => qc.invalidateQueries({ queryKey: ['school-push-prefs'] }),
                    )
                  }
                />
              </label>
            );
          })}
          <p className="sm:col-span-2 text-xs text-slate-500">
            Emergency and system alerts follow school policy and cannot be turned off here.
          </p>
        </div>
      ) : null}

      {section === 'settings' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-[#1e3a8a]">Connection</h2>
            <p className="mt-1 text-sm text-slate-600">
              Project:{' '}
              {String(
                (settings.data as { fcm?: { projectId?: string; engine?: string } } | undefined)
                  ?.fcm?.projectId ?? 'Not configured',
              )}
            </p>
            <p className="text-sm text-slate-500">
              Sending uses the Firebase Admin SDK on the API server (FCM HTTP v1). Firebase keys are
              never entered in this browser.
            </p>
            {(settings.data as { fcm?: { demo?: boolean } } | undefined)?.fcm?.demo ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                FCM_DEMO_MODE is on, so phones will not receive messages. Set FCM_DEMO_MODE=false in
                apps/api/.env and restart the API.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              Use Firebase project st-lukes-school-6f471 on the API (FIREBASE_SERVICE_ACCOUNT_FILE
              or FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY). That must match the school
              app, not another Firebase project.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Engine:{' '}
              {String(
                (settings.data as { fcm?: { engine?: string } } | undefined)?.fcm?.engine ??
                  'unknown',
              )}
            </p>
            {canManage ? (
              <button
                type="button"
                className="mt-3 rounded-lg border px-3 py-1.5 text-sm"
                onClick={() =>
                  testSchoolPush()
                    .then((r) =>
                      setError(
                        r.ok
                          ? `Test sent to ${r.successCount} of ${r.devices} device(s).`
                          : `Test did not reach a device (${r.failureCount} failed).`,
                      ),
                    )
                    .catch((e) => setError(apiErrorMessage(e)))
                }
              >
                Send test to my signed-in app
              </button>
            ) : null}
          </div>
          {canManage ? (
            <form
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveSchoolPushSettings({
                  defaultPriority: String(fd.get('defaultPriority') || 'NORMAL'),
                  quietHoursEnabled: fd.get('quietHoursEnabled') === 'on',
                  quietFrom: String(fd.get('quietFrom') || '21:00'),
                  quietTo: String(fd.get('quietTo') || '06:00'),
                  digestEnabled: fd.get('digestEnabled') === 'on',
                  retryAttempts: Number(fd.get('retryAttempts') || 3),
                  batchSize: Number(fd.get('batchSize') || 80),
                }).then(() => qc.invalidateQueries({ queryKey: ['school-push-settings'] }));
              }}
            >
              <label className="text-sm">
                Default priority
                <select
                  name="defaultPriority"
                  defaultValue={String(settings.data?.defaultPriority ?? 'NORMAL')}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option>NORMAL</option>
                  <option>HIGH</option>
                </select>
              </label>
              <label className="text-sm">
                Retry attempts
                <input
                  name="retryAttempts"
                  type="number"
                  defaultValue={Number(settings.data?.retryAttempts ?? 3)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Batch size
                <input
                  name="batchSize"
                  type="number"
                  defaultValue={Number(settings.data?.batchSize ?? 80)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="quietHoursEnabled"
                  defaultChecked={Boolean(settings.data?.quietHoursEnabled)}
                />{' '}
                Quiet hours
              </label>
              <label className="text-sm">
                From{' '}
                <input
                  name="quietFrom"
                  defaultValue={String(settings.data?.quietFrom ?? '21:00')}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                To{' '}
                <input
                  name="quietTo"
                  defaultValue={String(settings.data?.quietTo ?? '06:00')}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="digestEnabled"
                  defaultChecked={Boolean(settings.data?.digestEnabled)}
                />{' '}
                Daily digest
              </label>
              <div className="sm:col-span-2">
                <PrimaryButton type="submit">Save settings</PrimaryButton>
              </div>
            </form>
          ) : null}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-[#1e3a8a]">Automation rules</h2>
            <div className="mt-3 space-y-2">
              {((rules.data ?? []) as Array<Record<string, unknown>>).map((rule) => (
                <label key={String(rule.id)} className="flex items-center justify-between text-sm">
                  <span>{String(rule.name)}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(rule.pushEnabled)}
                    onChange={(e) =>
                      saveSchoolPushRule({
                        eventType: rule.eventType,
                        name: rule.name,
                        pushEnabled: e.target.checked,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-[#1e3a8a]">Audit log</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {((logs.data ?? []) as Array<Record<string, unknown>>).slice(0, 20).map((log) => (
                <li key={String(log.id)}>
                  {new Date(String(log.createdAt)).toLocaleString()} — {String(log.action)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <NotificationComposer
        open={composer}
        onOpenChange={setComposer}
        draft={draft}
        setDraft={setDraft}
        classes={classes.data}
        students={students.data}
        sending={sendMut.isPending}
        error={error}
        onError={setError}
        onContinue={async () => {
          try {
            if (draft.sendMode === 'draft') {
              sendMut.mutate(false);
              return;
            }
            const p = await previewSchoolPushAudience(audience);
            setPreview(p);
            setError(null);
            setConfirmOpen(true);
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm notification</DialogTitle>
            <DialogDescription>
              {draft.priority === 'URGENT'
                ? 'You are sending an urgent notification. This notification may reach a large number of users. '
                : ''}
              Audience: {AUDIENCES.find(([v]) => v === draft.kind)?.[1]}. Estimated recipients:{' '}
              {preview?.recipients ?? 0}. Push-ready phones: {preview?.devices ?? 0}
              {preview?.registeredApps ? ` (apps signed in: ${preview.registeredApps})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <p className="font-medium">{draft.title}</p>
          <p className="text-sm text-slate-600">{draft.body}</p>
          {preview && preview.devices === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {draft.kind === 'MY_DEVICES' ? (
                <>
                  This office login has no St. Luke’s School app token. Sign in on the APK with the
                  same email as this ERP user, allow notifications, then send again.
                </>
              ) : (preview.registeredApps ?? 0) > 0 ? (
                <>
                  {preview.registeredApps} school app
                  {preview.registeredApps === 1 ? ' is' : 's are'} signed in, but none have a
                  lock-screen push token. The APK must be built with Firebase ( google-services.json
                  for st-lukes-school-6f471). Open the app, allow notifications, and check Device
                  Control — the phone should show push enabled. Logging in is not enough if FCM was
                  left out of the APK.
                </>
              ) : (
                <>
                  {preview.recipients} people match this audience, but no St. Luke’s School app has
                  registered. Install the school APK, sign in, and allow notifications. Adrian’s
                  login on the phone only counts after that device is saved with a push token.
                </>
              )}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          <DialogFooter>
            <GhostButton onClick={() => setConfirmOpen(false)}>Cancel</GhostButton>
            <PrimaryButton disabled={sendMut.isPending} onClick={() => sendMut.mutate(true)}>
              Confirm & send
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotificationDeliveryReport campaignId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function CampaignTable({
  rows,
  onView,
  onRetry,
  onCancel,
  onArchive,
  emptyAction,
}: {
  rows: Array<Record<string, unknown>>;
  onView: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onArchive?: (id: string) => void;
  emptyAction: () => void;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [audience, setAudience] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== 'ALL' && String(row.category) !== category) return false;
      if (audience !== 'ALL' && String(row.audienceType) !== audience) return false;
      if (status !== 'ALL' && String(row.status) !== status) return false;
      if (!needle) return true;
      return `${row.title} ${row.body} ${row.audienceType} ${row.category}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, category, audience, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const categories = Array.from(new Set(rows.map((r) => String(r.category)))).sort();
  const audiences = Array.from(new Set(rows.map((r) => String(r.audienceType)))).sort();
  const statuses = Array.from(new Set(rows.map((r) => String(r.status)))).sort();

  function exportCsv() {
    const header = [
      'Date',
      'Title',
      'Category',
      'Audience',
      'Recipients',
      'Sent',
      'Delivered',
      'Opened',
      'Failed',
      'Status',
    ];
    const lines = [
      header.join(','),
      ...filtered.map((row) =>
        [
          new Date(String(row.createdAt)).toISOString(),
          `"${String(row.title).replaceAll('"', '""')}"`,
          row.category,
          row.audienceType,
          row.recipientCount,
          row.sentCount,
          row.deliveredCount,
          row.openedCount,
          row.failedCount,
          row.status,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'school-push-notifications.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!rows.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-lg">🔔</p>
        <p className="mt-2 font-semibold text-[#1e3a8a]">No notifications yet</p>
        <p className="text-sm text-slate-500">
          Create your first notification to communicate with students, parents and staff.
        </p>
        <PrimaryButton className="mt-4" onClick={emptyAction}>
          Send Notification
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-sm shadow-sky-100/80">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, message, audience or date..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={audience}
          onChange={(e) => {
            setAudience(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ALL">All Audiences</option>
          {audiences.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ALL">All Status</option>
          {statuses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              {[
                'Date & time',
                'Title',
                'Category',
                'Audience',
                'Recipients',
                'Sent',
                'Delivered',
                'Opened',
                'Failed',
                'Rate',
                'Status',
                'Actions',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                  {new Date(String(row.createdAt)).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-800">{String(row.title)}</p>
                  <p className="line-clamp-1 text-xs text-slate-400">{String(row.body ?? '')}</p>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      categoryChip(String(row.category)),
                    )}
                  >
                    {String(row.category).replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-500">{String(row.audienceType)}</td>
                <td className="px-3 py-3">{String(row.recipientCount)}</td>
                <td className="px-3 py-3">{String(row.sentCount)}</td>
                <td className="px-3 py-3">{String(row.deliveredCount)}</td>
                <td className="px-3 py-3">{String(row.openedCount)}</td>
                <td className="px-3 py-3">{String(row.failedCount)}</td>
                <td className="px-3 py-3">
                  {`${((Number(row.deliveredCount) / Math.max(1, Number(row.recipientCount) || Number(row.sentCount))) * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-3">
                  <StatusMark value={String(row.status)} />
                </td>
                <td className="relative px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onView(String(row.id))}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                      onClick={() =>
                        setOpenMenu((id) => (id === String(row.id) ? null : String(row.id)))
                      }
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                  {openMenu === String(row.id) ? (
                    <div className="absolute right-3 z-10 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                      {onRetry && Number(row.failedCount) > 0 ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setOpenMenu(null);
                            onRetry(String(row.id));
                          }}
                        >
                          Retry failed
                        </button>
                      ) : null}
                      {onCancel && ['DRAFT', 'SCHEDULED'].includes(String(row.status)) ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setOpenMenu(null);
                            onCancel(String(row.id));
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {onArchive ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setOpenMenu(null);
                            onArchive(String(row.id));
                          }}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <p>
          Showing {(safePage - 1) * pageSize + 1} to{' '}
          {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} notifications
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#2563eb] px-2 font-semibold text-white">
            {safePage}
          </span>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
            disabled={safePage >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-200 px-2"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                Rows per page {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function TemplatesPanel({
  rows,
  canManage,
  onSave,
}: {
  rows: Array<Record<string, unknown>>;
  canManage: boolean;
  onSave: (payload: Record<string, unknown>, id?: string) => Promise<unknown>;
}) {
  const [name, setName] = useState('Fee Reminder');
  const [title, setTitle] = useState('Fee Payment Reminder');
  const [body, setBody] = useState(
    'Dear {{parent_name}}, the school fee for {{student_name}} for {{month}} is pending.',
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {canManage ? (
          <>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-[120px] w-full rounded-lg border px-3 py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Variables:{' '}
              {
                '{{student_name}} {{parent_name}} {{class}} {{section}} {{month}} {{amount}} {{due_date}} {{school_name}}'
              }
            </p>
            <PrimaryButton onClick={() => onSave({ name, title, body, category: 'FEE' })}>
              Save template
            </PrimaryButton>
          </>
        ) : null}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={String(row.id)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="font-semibold text-[#1e3a8a]">{String(row.name)}</p>
            <p className="text-sm">{String(row.title)}</p>
            <p className="text-xs text-slate-500">{String(row.body)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
