'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LayoutDashboard, Smartphone } from 'lucide-react';
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
} from '@/services/mobile-app';

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

  const saveMut = useMutation({
    mutationFn: updateMobileAppSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mobile-app', 'settings'] });
    },
  });

  const s = settingsQ.data;
  if (!s) return <p className="text-sm text-muted-foreground">Loading mobile app settings…</p>;

  const save = (payload: Record<string, unknown>) => saveMut.mutate(payload);

  const studentConfig = (s.studentDashboardConfig ?? {}) as Record<string, boolean>;
  const staffConfig = (s.staffDashboardConfig ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile App Control
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure student and staff apps, dashboard cards, maintenance gates, and view analytics.
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">App Configuration</TabsTrigger>
          <TabsTrigger value="student">Student Dashboard</TabsTrigger>
          <TabsTrigger value="staff">Staff Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

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
