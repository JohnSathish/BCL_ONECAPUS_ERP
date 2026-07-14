'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchDevicePolicies, updateDevicePolicies } from '@/services/device-security';
import { DeviceLoginNav } from './device-login-nav';

type PolicyForm = {
  minPasswordLength: number;
  passwordHistoryCount: number;
  passwordExpiryDays: number | null;
  forceResetOnFirstLogin: boolean;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number | null;
  alertOnNewDevice: boolean;
  alertOnNewCountry: boolean;
  maxFailedBeforeFlag: number;
  blockOnExcessiveFails: boolean;
  notifyEmailOnSecurity: boolean;
  notifyPushOnSecurity: boolean;
  allowRememberMe: boolean;
  geoLookupEnabled: boolean;
  allowBiometricLogin: boolean;
  allowQrLogin: boolean;
  allowRfidLogin: boolean;
  mfaEnforced: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};

const TOGGLE_GROUPS: {
  title: string;
  description: string;
  keys: Array<[keyof PolicyForm, string]>;
}[] = [
  {
    title: 'Password rules',
    description: 'Complexity and first-login reset',
    keys: [
      ['forceResetOnFirstLogin', 'Force reset on first login'],
      ['requireUppercase', 'Require uppercase letter'],
      ['requireLowercase', 'Require lowercase letter'],
      ['requireNumber', 'Require number'],
      ['requireSpecial', 'Require special character'],
    ],
  },
  {
    title: 'Alerts & enforcement',
    description: 'How aggressively the portal flags risk',
    keys: [
      ['alertOnNewDevice', 'Alert on new device'],
      ['alertOnNewCountry', 'Alert on new country'],
      ['blockOnExcessiveFails', 'Block on excessive failures'],
      ['notifyEmailOnSecurity', 'Email security notifications'],
      ['notifyPushOnSecurity', 'Push security notifications'],
      ['mfaEnforced', 'Enforce MFA'],
    ],
  },
  {
    title: 'Sign-in methods',
    description: 'Optional campus login channels',
    keys: [
      ['allowRememberMe', 'Allow remember me'],
      ['geoLookupEnabled', 'GeoIP lookup enabled'],
      ['allowBiometricLogin', 'Allow biometric login'],
      ['allowQrLogin', 'Allow QR login'],
      ['allowRfidLogin', 'Allow RFID login'],
    ],
  },
];

export function DeviceLoginPoliciesPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'policies'],
    queryFn: fetchDevicePolicies,
  });
  const [policy, setPolicy] = useState<PolicyForm>({
    minPasswordLength: 8,
    passwordHistoryCount: 5,
    passwordExpiryDays: null,
    forceResetOnFirstLogin: true,
    sessionTimeoutMinutes: 480,
    maxConcurrentSessions: null,
    alertOnNewDevice: true,
    alertOnNewCountry: true,
    maxFailedBeforeFlag: 5,
    blockOnExcessiveFails: false,
    notifyEmailOnSecurity: true,
    notifyPushOnSecurity: true,
    allowRememberMe: true,
    geoLookupEnabled: true,
    allowBiometricLogin: true,
    allowQrLogin: false,
    allowRfidLogin: false,
    mfaEnforced: false,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  });

  useEffect(() => {
    if (!q.data) return;
    setPolicy({
      minPasswordLength: q.data.minPasswordLength,
      passwordHistoryCount: q.data.passwordHistoryCount,
      passwordExpiryDays: q.data.passwordExpiryDays ?? null,
      forceResetOnFirstLogin: q.data.forceResetOnFirstLogin,
      sessionTimeoutMinutes: q.data.sessionTimeoutMinutes,
      maxConcurrentSessions: q.data.maxConcurrentSessions ?? null,
      alertOnNewDevice: q.data.alertOnNewDevice ?? true,
      alertOnNewCountry: q.data.alertOnNewCountry ?? true,
      maxFailedBeforeFlag: q.data.maxFailedBeforeFlag ?? 5,
      blockOnExcessiveFails: q.data.blockOnExcessiveFails ?? false,
      notifyEmailOnSecurity: q.data.notifyEmailOnSecurity ?? true,
      notifyPushOnSecurity: q.data.notifyPushOnSecurity ?? true,
      allowRememberMe: q.data.allowRememberMe ?? true,
      geoLookupEnabled: q.data.geoLookupEnabled ?? true,
      allowBiometricLogin: q.data.allowBiometricLogin ?? true,
      allowQrLogin: q.data.allowQrLogin ?? false,
      allowRfidLogin: q.data.allowRfidLogin ?? false,
      mfaEnforced: q.data.mfaEnforced ?? false,
      requireUppercase: q.data.requireUppercase ?? true,
      requireLowercase: q.data.requireLowercase ?? true,
      requireNumber: q.data.requireNumber ?? true,
      requireSpecial: q.data.requireSpecial ?? true,
    });
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () => updateDevicePolicies(policy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'device-security', 'policies'] }),
  });

  const toggle = (key: keyof PolicyForm) => setPolicy((p) => ({ ...p, [key]: !p[key] }));

  return (
    <DashboardShell role="admin" title="Security Policies">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Device & Login Policies"
            subtitle="Password rules, alerts, geo lookup, session limits, and login methods"
          />
          <Button disabled={saveMut.isPending || q.isLoading} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Saving…' : 'Save policies'}
          </Button>
        </div>
        <DeviceLoginNav />
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading policies…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="text-sm font-semibold">Limits & windows</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Core numeric controls for passwords and concurrent access
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['minPasswordLength', 'Min password length', false],
                    ['passwordHistoryCount', 'Password history count', false],
                    ['passwordExpiryDays', 'Password expiry (days)', true],
                    ['sessionTimeoutMinutes', 'Session timeout (minutes)', false],
                    ['maxConcurrentSessions', 'Max concurrent sessions', true],
                    ['maxFailedBeforeFlag', 'Failed attempts before flag', false],
                  ] as const
                ).map(([key, label, nullable]) => (
                  <div key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="number"
                      className="mt-1"
                      value={
                        nullable ? ((policy[key] as number | null) ?? '') : (policy[key] as number)
                      }
                      placeholder={nullable ? 'Unlimited / none' : undefined}
                      onChange={(e) =>
                        setPolicy((p) => ({
                          ...p,
                          [key]: e.target.value ? Number(e.target.value) : nullable ? null : 0,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {TOGGLE_GROUPS.map((group) => (
              <section
                key={group.title}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{group.description}</p>
                <div className="space-y-2">
                  {group.keys.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={Boolean(policy[key])}
                        onChange={() => toggle(key)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}

            {saveMut.isSuccess ? (
              <p className="text-sm text-emerald-600 lg:col-span-2">
                Policies saved. New settings apply to upcoming sign-ins and evaluations.
              </p>
            ) : null}
            {saveMut.isError ? (
              <p className="text-sm text-rose-600 lg:col-span-2">
                Could not save policies. Please try again.
              </p>
            ) : null}
          </div>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
