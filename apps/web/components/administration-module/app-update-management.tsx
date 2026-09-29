'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Eye, Loader2, Save, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import {
  fetchAppUpdateOverview,
  saveAppUpdatePolicy,
  sendAppUpdateNotification,
  type AppUpdatePlatform,
  type AppUpdatePolicy,
  type SaveAppUpdatePolicyPayload,
} from '@/services/mobile-app';
import { apiErrorMessage } from '@/utils/api-error';

const QUERY_KEY = ['app-update-overview'];
const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const PLATFORM_LABEL: Record<AppUpdatePlatform, string> = { ANDROID: 'Android', IOS: 'iOS' };

type FormState = {
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  storeUrl: string;
  releaseTitle: string;
  releaseNotes: string;
  releaseDate: string;
  isActive: boolean;
};

function compareVersions(a: string, b: string) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

function toForm(policy: AppUpdatePolicy): FormState {
  return {
    latestVersion: policy.latestVersion,
    minimumVersion: policy.minimumVersion,
    forceUpdate: policy.forceUpdate,
    storeUrl: policy.storeUrl ?? '',
    releaseTitle: policy.releaseTitle ?? '',
    releaseNotes: policy.releaseNotes.join('\n'),
    releaseDate: policy.releaseDate ?? '',
    isActive: policy.isActive,
  };
}

function toPayload(form: FormState): SaveAppUpdatePolicyPayload {
  return {
    latestVersion: form.latestVersion.trim(),
    minimumVersion: form.minimumVersion.trim(),
    forceUpdate: form.forceUpdate,
    storeUrl: form.storeUrl.trim() || null,
    releaseTitle: form.releaseTitle.trim() || null,
    releaseNotes: form.releaseNotes
      .split('\n')
      .map((line) => line.replace(/^[\s•*-]+/, '').trim())
      .filter(Boolean),
    releaseDate: form.releaseDate || null,
    isActive: form.isActive,
  };
}

function validate(form: FormState): string | null {
  if (!VERSION_PATTERN.test(form.latestVersion.trim()))
    return 'Latest version must look like 1.0.30';
  if (!VERSION_PATTERN.test(form.minimumVersion.trim()))
    return 'Minimum version must look like 1.0.28';
  if (compareVersions(form.minimumVersion.trim(), form.latestVersion.trim()) > 0)
    return 'Minimum version cannot be higher than the latest version';
  const url = form.storeUrl.trim();
  if (url && !/^(https:\/\/|market:\/\/|itms-apps:\/\/)/i.test(url))
    return 'Store URL must start with https://, market:// or itms-apps://';
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function UpdateDialogPreview({
  form,
  required,
  currentVersion,
}: {
  form: FormState;
  required: boolean;
  currentVersion: string;
}) {
  const payload = toPayload(form);
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900/70 p-3 shadow-xl">
      <div className="flex min-h-[460px] items-center justify-center rounded-[1.4rem] bg-slate-950/60 p-3">
        <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div
            className={`px-4 pb-4 pt-5 text-center text-white ${
              required
                ? 'bg-gradient-to-br from-red-900 via-red-700 to-red-600'
                : 'bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600'
            }`}
          >
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/20 text-xl font-extrabold">
              {required ? '!' : '↑'}
            </div>
            <p className="text-base font-extrabold">
              {required ? 'Update Required' : 'New Update Available'}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-white/85">
              {required
                ? 'This version of OneCampus is no longer supported. Please update to continue.'
                : 'A new version of OneCampus is available.'}
            </p>
          </div>
          <div className="space-y-2 p-3 text-slate-900">
            <div className="flex items-center rounded-xl border border-slate-200 px-3 py-2 text-center">
              <div className="flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  Current
                </p>
                <p className="text-sm font-extrabold">{currentVersion}</p>
              </div>
              <span className="px-1 text-slate-400">→</span>
              <div className="flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">New</p>
                <p
                  className={`text-sm font-extrabold ${required ? 'text-red-600' : 'text-blue-600'}`}
                >
                  {payload.latestVersion || '—'}
                </p>
              </div>
            </div>
            {payload.releaseTitle ? (
              <p className="text-[13px] font-extrabold">{payload.releaseTitle}</p>
            ) : null}
            {payload.releaseNotes.length ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto">
                {payload.releaseNotes.map((note, i) => (
                  <li key={`${i}-${note}`} className="flex gap-2 text-[11px] text-slate-600">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        required ? 'bg-red-600' : 'bg-blue-600'
                      }`}
                    />
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
            <div
              className={`rounded-lg py-2.5 text-center text-xs font-extrabold text-white ${
                required ? 'bg-red-600' : 'bg-blue-700'
              }`}
            >
              Update Now
            </div>
            {!required ? (
              <p className="py-1 text-center text-xs font-bold text-slate-500">Later</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformPanel({
  policy,
  defaultStoreUrl,
  pushConfigured,
  canManage,
}: {
  policy: AppUpdatePolicy;
  defaultStoreUrl: string;
  pushConfigured: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(policy));
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRequired, setPreviewRequired] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [onlyOutdated, setOnlyOutdated] = useState(true);

  useEffect(() => {
    setForm(toForm(policy));
  }, [policy]);

  const label = PLATFORM_LABEL[policy.platform];
  const saved = useMemo(() => JSON.stringify(toPayload(toForm(policy))), [policy]);
  const dirty = JSON.stringify(toPayload(form)) !== saved;
  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }));

  const totals = useMemo(() => {
    const latest = policy.latestVersion;
    let devices = 0;
    let push = 0;
    let outdated = 0;
    let outdatedPush = 0;
    let belowMinimum = 0;
    for (const row of policy.devices) {
      devices += row.devices;
      push += row.pushEnabled;
      const isOutdated = !row.version || compareVersions(row.version, latest) < 0;
      if (isOutdated) {
        outdated += row.devices;
        outdatedPush += row.pushEnabled;
      }
      if (row.version && compareVersions(row.version, policy.minimumVersion) < 0) {
        belowMinimum += row.devices;
      }
    }
    return { devices, push, outdated, outdatedPush, belowMinimum };
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: () => saveAppUpdatePolicy(policy.platform, toPayload(form)),
    onSuccess: async () => {
      setMessage({ tone: 'ok', text: `${label} update settings saved.` });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => setMessage({ tone: 'error', text: apiErrorMessage(err, 'Save failed') }),
  });

  const notifyMutation = useMutation({
    mutationFn: () =>
      sendAppUpdateNotification(policy.platform, {
        title: notifyTitle.trim() || undefined,
        body: notifyBody.trim() || undefined,
        onlyOutdated,
      }),
    onSuccess: async (res) => {
      setNotifyOpen(false);
      setMessage({
        tone: 'ok',
        text: res.queued
          ? `Sending "${res.title}" to ${res.queued} ${label} device(s). Delivery runs in the background.`
          : `No ${label} devices with notifications enabled matched — nothing was sent.`,
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) =>
      setMessage({ tone: 'error', text: apiErrorMessage(err, 'Could not send notification') }),
  });

  const onSave = () => {
    const error = validate(form);
    if (error) {
      setMessage({ tone: 'error', text: error });
      return;
    }
    setMessage(null);
    saveMutation.mutate();
  };

  const openNotify = () => {
    const notes = toPayload(form).releaseNotes;
    setNotifyTitle('New OneCampus Update Available');
    setNotifyBody(
      `Version ${policy.latestVersion} is now available${
        notes.length ? ` with ${notes.slice(0, 3).join(', ')}` : ''
      }. Tap to update.`,
    );
    setOnlyOutdated(true);
    setNotifyOpen(true);
  };

  const notifyDisabledReason = !policy.isActive
    ? 'Save with “Active” switched on first.'
    : dirty
      ? 'Save your changes first.'
      : !pushConfigured
        ? 'Push notifications (FCM) are not configured on the server.'
        : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" /> {label} release
            </CardTitle>
            <CardDescription>
              Publish the build in the {policy.platform === 'IOS' ? 'App Store' : 'Play Store'}{' '}
              first, then set the version here. Users see the prompt without a new app release.
            </CardDescription>
          </div>
          <Badge variant={policy.isActive ? 'default' : 'secondary'}>
            {policy.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                When off, {label} users are never prompted by this policy.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => patch({ isActive: v })}
              disabled={!canManage}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${policy.platform}-latest`}>Latest version</Label>
              <Input
                id={`${policy.platform}-latest`}
                value={form.latestVersion}
                onChange={(e) => patch({ latestVersion: e.target.value })}
                placeholder="1.0.30"
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Users on older versions see “New Update Available”.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${policy.platform}-minimum`}>Minimum version</Label>
              <Input
                id={`${policy.platform}-minimum`}
                value={form.minimumVersion}
                onChange={(e) => patch({ minimumVersion: e.target.value })}
                placeholder="1.0.28"
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Anything older is blocked with “Update Required”.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <div>
              <Label>Force update</Label>
              <p className="text-xs text-muted-foreground">
                Make the latest version mandatory — everyone below {form.latestVersion || 'it'} must
                update before continuing.
              </p>
            </div>
            <Switch
              checked={form.forceUpdate}
              onCheckedChange={(v) => patch({ forceUpdate: v })}
              disabled={!canManage}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${policy.platform}-store`}>Store URL</Label>
            <Input
              id={`${policy.platform}-store`}
              value={form.storeUrl}
              onChange={(e) => patch({ storeUrl: e.target.value })}
              placeholder={defaultStoreUrl}
              disabled={!canManage}
            />
            <p className="text-xs text-muted-foreground">Leave blank to use {defaultStoreUrl}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-1">
              <Label htmlFor={`${policy.platform}-title`}>Release title</Label>
              <Input
                id={`${policy.platform}-title`}
                value={form.releaseTitle}
                onChange={(e) => patch({ releaseTitle: e.target.value })}
                placeholder="New Question Bank & Improvements"
                maxLength={160}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1">
              <Label>Release date</Label>
              <DateInput
                value={form.releaseDate}
                onChange={(iso) => patch({ releaseDate: iso })}
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${policy.platform}-notes`}>Release notes</Label>
            <textarea
              id={`${policy.platform}-notes`}
              value={form.releaseNotes}
              onChange={(e) => patch({ releaseNotes: e.target.value })}
              rows={5}
              placeholder={
                'Added Question Bank module\nFixed various bugs\nEnhanced UI\nImproved performance'
              }
              disabled={!canManage}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">One point per line (up to 20).</p>
          </div>

          {message ? (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                message.tone === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button onClick={onSave} disabled={!canManage || saveMutation.isPending || !dirty}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Update
            </Button>
            <Button
              variant="outline"
              onClick={openNotify}
              disabled={!canManage || Boolean(notifyDisabledReason)}
              title={notifyDisabledReason ?? undefined}
            >
              <BellRing className="mr-2 h-4 w-4" /> Send Update Notification
            </Button>
            <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
            {dirty ? (
              <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
            ) : null}
          </div>
          {notifyDisabledReason && canManage ? (
            <p className="text-xs text-muted-foreground">Notification: {notifyDisabledReason}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Installed {label} devices</CardTitle>
            <CardDescription>Versions last reported by signed-in devices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-lg font-bold">{totals.devices}</p>
                <p className="text-[11px] text-muted-foreground">Devices</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-lg font-bold">{totals.outdated}</p>
                <p className="text-[11px] text-muted-foreground">Outdated</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-lg font-bold">{totals.push}</p>
                <p className="text-[11px] text-muted-foreground">Push on</p>
              </div>
            </div>
            {totals.belowMinimum > 0 ? (
              <p className="text-xs text-red-600">
                {totals.belowMinimum} device(s) are below the saved minimum version and will be
                blocked.
              </p>
            ) : null}
            {policy.devices.length ? (
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-left">
                    <tr>
                      <th className="px-2 py-1.5">Version</th>
                      <th className="px-2 py-1.5 text-right">Devices</th>
                      <th className="px-2 py-1.5 text-right">Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policy.devices.map((row) => {
                      const old =
                        !row.version || compareVersions(row.version, policy.latestVersion) < 0;
                      return (
                        <tr key={row.version ?? 'unknown'} className="border-t">
                          <td className={`px-2 py-1.5 font-medium ${old ? 'text-amber-600' : ''}`}>
                            {row.version ?? 'Unknown'}
                          </td>
                          <td className="px-2 py-1.5 text-right">{row.devices}</td>
                          <td className="px-2 py-1.5 text-right">{row.pushEnabled}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No {label} devices registered yet.</p>
            )}
            {policy.platform === 'IOS' && totals.push === 0 ? (
              <p className="text-xs text-muted-foreground">
                iOS devices do not register for push yet, so iOS users will get the in-app prompt
                but not a push notification.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last notification</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {policy.lastNotifiedAt ? (
              <p>
                Version <strong>{policy.lastNotifiedVersion}</strong> ·{' '}
                {formatDateTime(policy.lastNotifiedAt)}
                <br />
                <span className="text-muted-foreground">
                  Delivered to {policy.lastNotifiedCount ?? 0} device(s)
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">No update notification sent yet.</p>
            )}
            {policy.updatedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Settings last saved {formatDateTime(policy.updatedAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{label} update dialog preview</DialogTitle>
            <DialogDescription>
              How the prompt looks on a phone running an older version (uses the unsaved form).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant={previewRequired ? 'outline' : 'default'}
              onClick={() => setPreviewRequired(false)}
            >
              Optional
            </Button>
            <Button
              size="sm"
              variant={previewRequired ? 'default' : 'outline'}
              onClick={() => setPreviewRequired(true)}
            >
              Required
            </Button>
          </div>
          <UpdateDialogPreview
            form={form}
            required={previewRequired}
            currentVersion={form.minimumVersion || '1.0.0'}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {label} update notification</DialogTitle>
            <DialogDescription>
              Tapping the notification opens the Google Play in-app update or the store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={`${policy.platform}-notify-title`}>Title</Label>
              <Input
                id={`${policy.platform}-notify-title`}
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${policy.platform}-notify-body`}>Message</Label>
              <textarea
                id={`${policy.platform}-notify-body`}
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
                rows={3}
                maxLength={400}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Only devices on older versions</Label>
                <p className="text-xs text-muted-foreground">
                  Skip devices already on {policy.latestVersion}.
                </p>
              </div>
              <Switch checked={onlyOutdated} onCheckedChange={setOnlyOutdated} />
            </div>
            <p className="text-sm">
              About <strong>{onlyOutdated ? totals.outdatedPush : totals.push}</strong> {label}{' '}
              device(s) will receive this.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending}>
              {notifyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 h-4 w-4" />
              )}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AppUpdateManagement() {
  const { can } = usePermissions();
  const canManage = can('mobile:settings:manage');
  const [platform, setPlatform] = useState<AppUpdatePlatform>('ANDROID');
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAppUpdateOverview });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading app update settings…
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="text-red-600">
            {apiErrorMessage(query.error, 'Could not load app update settings.')}
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">App Update Management</h2>
          <p className="text-sm text-muted-foreground">
            Tell OneCampus app users about new store releases. Users see an update dialog on launch;
            versions below the minimum are blocked until they update.
          </p>
        </div>
        <Badge variant={data.pushConfigured ? 'default' : 'secondary'}>
          {data.pushConfigured ? 'Push notifications ready' : 'Push not configured'}
        </Badge>
      </div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as AppUpdatePlatform)}>
        <TabsList>
          {data.policies.map((p) => (
            <TabsTrigger key={p.platform} value={p.platform}>
              {PLATFORM_LABEL[p.platform]}
              {p.isActive ? ` · ${p.latestVersion}` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
        {data.policies.map((p) => (
          <TabsContent key={p.platform} value={p.platform} className="mt-4">
            <PlatformPanel
              policy={p}
              defaultStoreUrl={data.defaults[p.platform]}
              pushConfigured={data.pushConfigured}
              canManage={canManage}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
