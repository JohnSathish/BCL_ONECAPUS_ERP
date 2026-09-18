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
  fetchSchoolPushCampaign,
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
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge, WaCard } from '../whatsapp/whatsapp-ui';
import {
  AUDIENCES,
  CATEGORIES,
  DEEP_LINKS,
  NotificationComposer,
  type NotificationDraft,
} from './notification-composer';

const LINKS = [
  { href: '/admin/school-sis/notifications', label: 'Push Notifications', exact: true },
  { href: '/admin/school-sis/notifications/templates', label: 'Templates' },
  { href: '/admin/school-sis/notifications/scheduled', label: 'Scheduled' },
  { href: '/admin/school-sis/notifications/history', label: 'History' },
  { href: '/admin/school-sis/notifications/delivery', label: 'Delivery' },
  { href: '/admin/school-sis/notifications/devices', label: 'Devices' },
  { href: '/admin/school-sis/notifications/preferences', label: 'Preferences' },
  { href: '/admin/school-sis/notifications/settings', label: 'Settings' },
];

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
    queryFn: () => fetchSchoolPushCampaigns(section === 'scheduled' ? 'SCHEDULED' : undefined),
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
  const detail = useQuery({
    queryKey: ['school-push-one', detailId],
    queryFn: () => fetchSchoolPushCampaign(detailId!),
    enabled: Boolean(detailId),
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
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Notifications
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Send and manage mobile notifications for students, parents, teachers and staff.
          </p>
        </div>
        {canManage ? (
          <PrimaryButton onClick={() => setComposer(true)}>+ Send Notification</PrimaryButton>
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-2">
        {LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
                active
                  ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
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
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <WaCard
                label="Total Devices"
                value={d?.totalDevices ?? 0}
                hint="Registered devices"
              />
              <WaCard label="Active Devices" value={d?.activeDevices ?? 0} hint="Active" />
              <WaCard label="Notifications Sent" value={d?.sent ?? 0} hint="This month" />
              <WaCard
                label="Delivered"
                value={d?.delivered ?? 0}
                hint={pct(d?.deliveredPct ?? 0)}
              />
              <WaCard label="Opened" value={d?.opened ?? 0} hint={pct(d?.openedPct ?? 0)} />
              <WaCard
                label="Failed"
                value={d?.failed ?? 0}
                hint={`${pct(d?.failedPct ?? 0)} · ${d?.scheduled ?? 0} scheduled`}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Send Notification', () => setComposer(true)],
                [
                  'Schedule Notification',
                  () => {
                    setDraft((s) => ({ ...s, sendMode: 'schedule' }));
                    setComposer(true);
                  },
                ],
                ['Create Template', () => router.push('/admin/school-sis/notifications/templates')],
                [
                  'View Delivery Report',
                  () => router.push('/admin/school-sis/notifications/delivery'),
                ],
                ['Manage Devices', () => router.push('/admin/school-sis/notifications/devices')],
                [
                  'Notification Settings',
                  () => router.push('/admin/school-sis/notifications/settings'),
                ],
              ].map(([label, onClick]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={onClick as () => void}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-semibold text-[#1e3a8a] shadow-sm hover:border-blue-200"
                >
                  {label as string}
                </button>
              ))}
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
              {preview?.recipients ?? 0}. Devices: {preview?.devices ?? 0}.
            </DialogDescription>
          </DialogHeader>
          <p className="font-medium">{draft.title}</p>
          <p className="text-sm text-slate-600">{draft.body}</p>
          {preview && preview.devices === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No lock-screen push token yet. The message will still appear in the school app inbox
              for this account. Sign in to the St. Luke’s app with the same user to receive a phone
              notification.
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

      <Dialog open={Boolean(detailId)} onOpenChange={() => setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification details</DialogTitle>
          </DialogHeader>
          {detail.data ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{String(detail.data.title)}</p>
              <p>{String(detail.data.body)}</p>
              <WaBadge value={String(detail.data.status)} />
              <div className="grid grid-cols-2 gap-2">
                <p>Sent {String(detail.data.sentCount)}</p>
                <p>Delivered {String(detail.data.deliveredCount)}</p>
                <p>Opened {String(detail.data.openedCount)}</p>
                <p>Failed {String(detail.data.failedCount)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(100, (Number(detail.data.deliveredCount) / Math.max(1, Number(detail.data.deviceCount))) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
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
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
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
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {[
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
              '',
            ].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)} className="border-t">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(String(row.createdAt)).toLocaleString()}
              </td>
              <td className="px-3 py-2">{String(row.title)}</td>
              <td className="px-3 py-2">{String(row.category)}</td>
              <td className="px-3 py-2">{String(row.audienceType)}</td>
              <td className="px-3 py-2">{String(row.recipientCount)}</td>
              <td className="px-3 py-2">{String(row.sentCount)}</td>
              <td className="px-3 py-2">{String(row.deliveredCount)}</td>
              <td className="px-3 py-2">{String(row.openedCount)}</td>
              <td className="px-3 py-2">{String(row.failedCount)}</td>
              <td className="px-3 py-2">
                <WaBadge value={String(row.status)} />
              </td>
              <td className="px-3 py-2">
                <GhostButton onClick={() => onView(String(row.id))}>View</GhostButton>
                {onRetry && String(row.status).includes('FAIL') ? (
                  <GhostButton onClick={() => onRetry(String(row.id))}>Retry failed</GhostButton>
                ) : null}
                {onCancel && ['DRAFT', 'SCHEDULED'].includes(String(row.status)) ? (
                  <GhostButton onClick={() => onCancel(String(row.id))}>Cancel</GhostButton>
                ) : null}
                {onArchive ? (
                  <GhostButton onClick={() => onArchive(String(row.id))}>Archive</GhostButton>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
