'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bell, Eye, KeyRound, Monitor, Palette, Shield, User } from 'lucide-react';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  changePassword,
  fetchStudentDeviceSessions,
  fetchStudentPortalProfile,
  revokeAllSessions,
} from '@/services/student-portal';
import { useStudentPortalPreferencesStore } from '@/store/student-portal-preferences-store';
import { useStudentPortalSettingsStore } from '@/store/student-portal-settings-store';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

type SettingsSection =
  | 'account'
  | 'security'
  | 'notifications'
  | 'privacy'
  | 'appearance'
  | 'devices';

const NAV: {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Eye },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'devices', label: 'Devices', icon: Monitor },
];

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function parseDeviceLabel(userAgent: string) {
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac OS|Macintosh/i.test(userAgent)) return 'macOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad/i.test(userAgent)) return 'iOS';
  return 'Unknown OS';
}

function parseBrowser(userAgent: string) {
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Edg/i.test(userAgent)) return 'Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return 'Browser';
}

export function StudentSettingsPage() {
  useRequireAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<SettingsSection>('account');
  const compact = useStudentPortalPreferencesStore((s) => s.compact);
  const largeText = useStudentPortalPreferencesStore((s) => s.largeText);
  const setCompact = useStudentPortalPreferencesStore((s) => s.setCompact);
  const setLargeText = useStudentPortalPreferencesStore((s) => s.setLargeText);
  const notifications = useStudentPortalSettingsStore((s) => s.notifications);
  const privacy = useStudentPortalSettingsStore((s) => s.privacy);
  const language = useStudentPortalSettingsStore((s) => s.language);
  const setNotification = useStudentPortalSettingsStore((s) => s.setNotification);
  const setPrivacy = useStudentPortalSettingsStore((s) => s.setPrivacy);
  const setLanguage = useStudentPortalSettingsStore((s) => s.setLanguage);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ['student-portal', 'profile'],
    queryFn: fetchStudentPortalProfile,
  });

  const sessionsQ = useQuery({
    queryKey: ['student-portal', 'sessions'],
    queryFn: fetchStudentDeviceSessions,
  });

  const securityScore = useMemo(() => {
    const profile = profileQ.data;
    let score = 25;
    const checks = [
      { label: 'Strong Password', ok: true },
      { label: 'Email Verified', ok: Boolean(profile?.contact.personalEmail) },
      { label: 'Mobile Verified', ok: Boolean(profile?.contact.mobileNumber) },
      { label: '2FA Enabled', ok: false },
    ];
    if (checks[1].ok) score += 25;
    if (checks[2].ok) score += 25;
    return { score, checks };
  }, [profileQ.data]);

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword, confirmPassword }),
    onSuccess: async () => {
      setPasswordMsg('Password updated. Signing you out…');
      broadcastSessionMessage({ type: 'LOGOUT' });
      tokenRefreshManager.clearSchedule();
      useAuthStore.getState().clear();
      await logout().catch(() => undefined);
      router.replace('/login');
    },
    onError: () => setPasswordMsg('Could not update password. Check your current password.'),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: async () => {
      useAuthStore.getState().clear();
      await logout().catch(() => undefined);
      router.replace('/login');
    },
  });

  const content = (
    <>
      {section === 'account' ? (
        <GlassCard className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </h2>
          <form
            className="mt-4 max-w-md space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordMsg(null);
              passwordMutation.mutate();
            }}
          >
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={passwordMutation.isPending}>
              Update Password
            </Button>
            {passwordMsg ? <p className="text-xs text-muted-foreground">{passwordMsg}</p> : null}
          </form>
        </GlassCard>
      ) : null}

      {section === 'security' ? (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Account Security</h2>
          <div className="mt-4 flex items-end gap-4">
            <p className="text-4xl font-bold tabular-nums">{securityScore.score}%</p>
            <div className="min-w-0 flex-1 pb-1">
              <Progress value={securityScore.score} className="h-2.5" />
            </div>
          </div>
          <ul className="mt-6 space-y-2">
            {securityScore.checks.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span>{item.label}</span>
                <span className={item.ok ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {item.ok ? '✓' : item.label.includes('2FA') ? 'Disabled' : '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Two-factor authentication and OTP login — coming soon.
          </p>
        </GlassCard>
      ) : null}

      {section === 'notifications' ? (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Notification Preferences</h2>
          <div className="mt-4 space-y-2">
            <SwitchRow
              label="Exam Alerts"
              checked={notifications.examNotifications}
              onChange={(v) => setNotification('examNotifications', v)}
            />
            <SwitchRow
              label="Attendance"
              checked={notifications.attendanceAlerts}
              onChange={(v) => setNotification('attendanceAlerts', v)}
            />
            <SwitchRow
              label="Fees"
              checked={notifications.feeReminders}
              onChange={(v) => setNotification('feeReminders', v)}
            />
            <SwitchRow
              label="Timetable"
              checked={notifications.timetableUpdates}
              onChange={(v) => setNotification('timetableUpdates', v)}
            />
            <SwitchRow
              label="LMS"
              checked={notifications.lmsNotifications}
              onChange={(v) => setNotification('lmsNotifications', v)}
            />
            <SwitchRow
              label="Certificates"
              checked={notifications.certificateUpdates}
              onChange={(v) => setNotification('certificateUpdates', v)}
            />
          </div>
        </GlassCard>
      ) : null}

      {section === 'privacy' ? (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Privacy Settings</h2>
          <div className="mt-4 space-y-2">
            <SwitchRow
              label="Show Mobile Number to Faculty"
              checked={privacy.showMobileToFaculty}
              onChange={(v) => setPrivacy('showMobileToFaculty', v)}
            />
            <SwitchRow
              label="Show Email to Faculty"
              checked={privacy.showEmailToFaculty}
              onChange={(v) => setPrivacy('showEmailToFaculty', v)}
            />
            <SwitchRow
              label="Hide Personal Information"
              checked={privacy.hidePersonalInfo}
              onChange={(v) => setPrivacy('hidePersonalInfo', v)}
            />
          </div>
        </GlassCard>
      ) : null}

      {section === 'appearance' ? (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Theme</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <Button
                key={t}
                variant={theme === t ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl capitalize"
                onClick={() => setTheme(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <SwitchRow label="Compact Mode" checked={compact} onChange={setCompact} />
            <SwitchRow label="Large Text" checked={largeText} onChange={setLargeText} />
          </div>
          <div className="mt-4">
            <Label>Language</Label>
            <select
              className="mt-1 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi" disabled>
                Hindi (coming soon)
              </option>
            </select>
          </div>
        </GlassCard>
      ) : null}

      {section === 'devices' ? (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Device Sessions</h2>
          {sessionsQ.data?.lastLoginAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last login: {new Date(sessionsQ.data.lastLoginAt).toLocaleString()}
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {(sessionsQ.data?.devices ?? []).map((d) => (
              <div
                key={d.id}
                className={cn(
                  'rounded-xl border px-4 py-3',
                  d.isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border/50',
                )}
              >
                <p className="font-medium">{d.isCurrent ? 'Current Device' : d.label}</p>
                <p className="text-sm text-muted-foreground">
                  {parseDeviceLabel(d.userAgent)} · {parseBrowser(d.userAgent)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last active: {new Date(d.lastActiveAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4 rounded-xl"
            disabled={revokeMutation.isPending}
            onClick={() => revokeMutation.mutate()}
          >
            Logout Other Devices
          </Button>
        </GlassCard>
      ) : null}
    </>
  );

  return (
    <DashboardShell role="student" title="Settings">
      <ErpWorkspace>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <GlassCard className="shrink-0 p-2 lg:w-56">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account Center
            </p>
            <nav className="space-y-0.5">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </GlassCard>

          <div className="min-w-0 flex-1">{content}</div>
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
