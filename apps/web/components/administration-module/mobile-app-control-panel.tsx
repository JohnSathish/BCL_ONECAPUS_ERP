'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CreditCard, LayoutDashboard, Megaphone, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchMobileAnalytics,
  fetchMobileAppSettings,
  updateMobileAppSettings,
  type MobileAppSettings,
} from '@/services/mobile-app';
import { fetchFeeSettings } from '@/services/fee-cycle';
import { MobileAppPhonePreview } from '@/components/administration-module/mobile-app-phone-preview';

const STUDENT_CARDS = [
  'attendance',
  'fees',
  'timetable',
  'results',
  'library',
  'hostel',
  'notifications',
  'lms',
  'examinations',
] as const;

const STAFF_CARDS = [
  'todayClasses',
  'pendingAttendance',
  'leaveBalance',
  'payroll',
  'notifications',
  'timetable',
] as const;

const FEATURE_FLAGS = [
  'attendance',
  'examination',
  'fees',
  'library',
  'assignments',
  'results',
  'idCard',
  'communication',
  'leave',
  'bankSection',
  'profileEdit',
  'feedback',
  'certificates',
  'timetable',
  'lms',
  'notifications',
] as const;

function DashboardBuilder({
  title,
  cards,
  config,
  onToggle,
}: {
  title: string;
  cards: readonly string[];
  config: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Toggle home-screen cards without an app store release.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {cards.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
            <Switch checked={config[key] !== false} onCheckedChange={(v) => onToggle(key, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MobileAppControlPanel() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ['mobile-app', 'settings'],
    queryFn: fetchMobileAppSettings,
  });
  const analyticsQ = useQuery({
    queryKey: ['mobile-app', 'analytics'],
    queryFn: () => fetchMobileAnalytics(30),
  });
  const feeSettingsQ = useQuery({
    queryKey: ['fee-settings'],
    queryFn: fetchFeeSettings,
  });

  const saveMut = useMutation({
    mutationFn: updateMobileAppSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mobile-app', 'settings'] });
    },
  });

  const s = settingsQ.data;
  const notices = s?.loginNotices ?? {};
  const [updatesDraft, setUpdatesDraft] = useState<string | null>(null);
  const customUpdatesText = useMemo(() => {
    if (updatesDraft !== null) return updatesDraft;
    return (notices.customUpdates ?? []).join('\n');
  }, [notices.customUpdates, updatesDraft]);

  if (!s) return <p className="text-sm text-muted-foreground">Loading mobile app settings…</p>;

  const save = (payload: Record<string, unknown>) => saveMut.mutate(payload);
  const saveLoginNotices = (patch: NonNullable<MobileAppSettings['loginNotices']>) => {
    const next = { ...(s.loginNotices ?? {}), ...patch };
    save({ loginNotices: next });
    if (patch.customUpdates !== undefined) setUpdatesDraft(null);
  };

  const studentConfig = (s.studentDashboardConfig ?? {}) as Record<string, boolean>;
  const staffConfig = (s.staffDashboardConfig ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          App Version & Mobile Config
        </h2>
        <p className="text-sm text-muted-foreground">
          Force/soft updates, maintenance, login notice board, feature flags, and dashboard cards —
          without a new app store release. Config version: {s.configVersion ?? 1}
        </p>
      </div>

      <Tabs defaultValue="notices">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="notices">Login Notice Board</TabsTrigger>
          <TabsTrigger value="preview">UI Preview</TabsTrigger>
          <TabsTrigger value="config">App Configuration</TabsTrigger>
          <TabsTrigger value="student">Student Dashboard</TabsTrigger>
          <TabsTrigger value="staff">Staff Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Login screen notice board
              </CardTitle>
              <CardDescription>
                Controls the yellow banner, megaphone carousel, and &quot;Today&apos;s Updates&quot;
                on the mobile login / welcome screens. Changes apply on next app open (bootstrap
                refresh).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Show yellow banner</Label>
                  <p className="text-xs text-muted-foreground">
                    Top strip with megaphone + View link
                  </p>
                </div>
                <Switch
                  checked={notices.showBanner !== false}
                  onCheckedChange={(v) => saveLoginNotices({ showBanner: v })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Banner title</Label>
                  <Input
                    key={`banner-title-${s.configVersion}`}
                    defaultValue={notices.bannerTitle ?? ''}
                    placeholder="e.g. Admissions open for 2026-27"
                    onBlur={(e) => saveLoginNotices({ bannerTitle: e.target.value.trim() || null })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the first update line (or maintenance message if set).
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Banner subtitle</Label>
                  <Input
                    key={`banner-sub-${s.configVersion}`}
                    defaultValue={notices.bannerSubtitle ?? ''}
                    placeholder="e.g. Tap View for details"
                    onBlur={(e) =>
                      saveLoginNotices({ bannerSubtitle: e.target.value.trim() || null })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Custom notice lines</Label>
                <textarea
                  className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={customUpdatesText}
                  placeholder={'One notice per line\ne.g. Library closed on Saturday'}
                  onChange={(e) => setUpdatesDraft(e.target.value)}
                  onBlur={() => {
                    const lines = customUpdatesText
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean);
                    saveLoginNotices({ customUpdates: lines });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the rotating notice card and &quot;Today&apos;s Updates&quot;.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Include open admissions</Label>
                    <p className="text-xs text-muted-foreground">
                      Auto: &quot;Admissions open — …&quot; from Admissions intakes
                    </p>
                  </div>
                  <Switch
                    checked={notices.includeAdmissions !== false}
                    onCheckedChange={(v) => saveLoginNotices({ includeAdmissions: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Include academic session</Label>
                    <p className="text-xs text-muted-foreground">
                      Auto: &quot;Academic session … active&quot; from published AY
                    </p>
                  </div>
                  <Switch
                    checked={notices.includeAcademicSession !== false}
                    onCheckedChange={(v) => saveLoginNotices({ includeAcademicSession: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Append auto lines after custom</Label>
                    <p className="text-xs text-muted-foreground">
                      When custom lines exist, still add admissions/session
                    </p>
                  </div>
                  <Switch
                    checked={notices.includeAutoUpdates !== false}
                    onCheckedChange={(v) => saveLoginNotices({ includeAutoUpdates: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Include NEP hint</Label>
                    <p className="text-xs text-muted-foreground">
                      Adds &quot;NEP 2020 curriculum enabled&quot;
                    </p>
                  </div>
                  <Switch
                    checked={notices.includeNepHint === true}
                    onCheckedChange={(v) => saveLoginNotices({ includeNepHint: v })}
                  />
                </div>
              </div>
              {saveMut.isPending ? (
                <p className="text-xs text-muted-foreground">Saving…</p>
              ) : saveMut.isSuccess ? (
                <p className="text-xs text-emerald-600">
                  Saved. App will pick this up on next open.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related auto sources</CardTitle>
              <CardDescription>
                These feed the automatic lines when the toggles above are on.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/admissions/intakes">Admissions intakes</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/organization">Academic years (Organization)</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <MobileAppPhonePreview
            studentAppName={s.studentAppName}
            staffAppName={s.staffAppName}
            studentConfig={studentConfig}
            staffConfig={staffConfig}
            studentCards={STUDENT_CARDS}
            staffCards={STAFF_CARDS}
            primaryColor={s.brandingOverrides?.primaryColor}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student App</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="space-y-1">
                  <Label>App name</Label>
                  <Input
                    defaultValue={s.studentAppName}
                    onBlur={(e) => save({ studentAppName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Min version</Label>
                    <Input
                      defaultValue={s.studentMinVersion}
                      onBlur={(e) => save({ studentMinVersion: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Latest version</Label>
                    <Input
                      defaultValue={s.studentLatestVersion}
                      onBlur={(e) => save({ studentLatestVersion: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Maintenance mode</Label>
                  <Switch
                    checked={s.studentMaintenanceMode}
                    onCheckedChange={(v) => save({ studentMaintenanceMode: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Force update</Label>
                  <Switch
                    checked={s.studentForceUpdate}
                    onCheckedChange={(v) => save({ studentForceUpdate: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Staff App</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="space-y-1">
                  <Label>App name</Label>
                  <Input
                    defaultValue={s.staffAppName}
                    onBlur={(e) => save({ staffAppName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Min version</Label>
                    <Input
                      defaultValue={s.staffMinVersion}
                      onBlur={(e) => save({ staffMinVersion: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Latest version</Label>
                    <Input
                      defaultValue={s.staffLatestVersion}
                      onBlur={(e) => save({ staffLatestVersion: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Maintenance mode</Label>
                  <Switch
                    checked={s.staffMaintenanceMode}
                    onCheckedChange={(v) => save({ staffMaintenanceMode: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Force update</Label>
                  <Switch
                    checked={s.staffForceUpdate}
                    onCheckedChange={(v) => save({ staffForceUpdate: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Messages & Branding</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Maintenance message</Label>
                <Input
                  defaultValue={s.maintenanceMessage ?? ''}
                  onBlur={(e) => save({ maintenanceMessage: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Force-update message</Label>
                <Input
                  defaultValue={s.forceUpdateMessage ?? ''}
                  onBlur={(e) => save({ forceUpdateMessage: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Logo URL override</Label>
                <Input
                  defaultValue={s.brandingOverrides?.logoUrl ?? ''}
                  onBlur={(e) =>
                    save({ brandingOverrides: { ...s.brandingOverrides, logoUrl: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Primary color override</Label>
                <Input
                  defaultValue={s.brandingOverrides?.primaryColor ?? ''}
                  onBlur={(e) =>
                    save({
                      brandingOverrides: { ...s.brandingOverrides, primaryColor: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Splash image URL override</Label>
                <Input
                  defaultValue={s.brandingOverrides?.splashImageUrl ?? ''}
                  onBlur={(e) =>
                    save({
                      brandingOverrides: {
                        ...s.brandingOverrides,
                        splashImageUrl: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribution & release notes</CardTitle>
              <CardDescription>
                Play Store link for public installs; APK URL for internal distribution.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Play Store URL</Label>
                <Input
                  defaultValue={s.playStoreUrl ?? ''}
                  onBlur={(e) => save({ playStoreUrl: e.target.value || null })}
                  placeholder="https://play.google.com/store/apps/details?id=…"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>APK / AAB download URL</Label>
                <Input
                  defaultValue={s.apkDownloadUrl ?? ''}
                  onBlur={(e) => save({ apkDownloadUrl: e.target.value || null })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Release notes</Label>
                <Input
                  defaultValue={s.releaseNotes ?? ''}
                  onBlur={(e) => save({ releaseNotes: e.target.value || null })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature flags (menu / modules)</CardTitle>
              <CardDescription>
                Hide modules in the mobile app without publishing a new build.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {FEATURE_FLAGS.map((key) => {
                const flags = (s.featureFlags ?? {}) as Record<string, boolean>;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                    <Switch
                      checked={flags[key] !== false}
                      onCheckedChange={(v) => save({ featureFlags: { ...flags, [key]: v } })}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Mobile fee payment (Razorpay)
              </CardTitle>
              <CardDescription>
                Native Pay now in the student app requires an EAS dev/production build (not Expo Go)
                and Razorpay keys on the API server.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Online Gateway (master)</p>
                <p className="text-muted-foreground">
                  {feeSettingsQ.data?.collectionModes?.gateway ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Razorpay on mobile app</p>
                <p className="text-muted-foreground">
                  {feeSettingsQ.data?.studentPortal?.mobileRazorpayEnabled === false
                    ? 'Disabled — students see web portal / office message'
                    : 'Enabled (when Online Gateway is on)'}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/admin/fees/settings">Open Fee Settings →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Push Notification Center
              </CardTitle>
              <CardDescription>
                Send campaigns with PUSH channel to registered mobile devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/admin/communication/campaigns">Open Communication Campaigns</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student">
          <DashboardBuilder
            title="Student home cards"
            cards={STUDENT_CARDS}
            config={studentConfig}
            onToggle={(key, value) =>
              save({ studentDashboardConfig: { ...studentConfig, [key]: value } })
            }
          />
        </TabsContent>

        <TabsContent value="staff">
          <DashboardBuilder
            title="Staff home cards"
            cards={STAFF_CARDS}
            config={staffConfig}
            onToggle={(key, value) =>
              save({ staffDashboardConfig: { ...staffConfig, [key]: value } })
            }
          />
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Mobile Analytics (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total logins</p>
                <p className="text-2xl font-semibold">{analyticsQ.data?.totalLogins ?? '—'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Push delivery rate</p>
                <p className="text-2xl font-semibold">
                  {analyticsQ.data?.pushDeliveryRate != null
                    ? `${analyticsQ.data.pushDeliveryRate}%`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Daily rows</p>
                <p className="text-2xl font-semibold">{analyticsQ.data?.daily?.length ?? 0}</p>
              </div>
              {analyticsQ.data?.versionTotals ? (
                <div className="sm:col-span-3 rounded-lg border p-4 text-sm">
                  <p className="font-medium mb-2">Version breakdown</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(analyticsQ.data.versionTotals, null, 2)}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {saveMut.isPending ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
    </div>
  );
}
