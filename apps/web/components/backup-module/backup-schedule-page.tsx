'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchBackupRetention,
  fetchBackupSchedule,
  updateBackupRetention,
  updateBackupSchedule,
} from '@/services/backup';

const SELECT_CLASS = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

const FREQUENCIES = [
  { value: 'EVERY_6H', label: 'Every 6 Hours' },
  { value: 'EVERY_12H', label: 'Every 12 Hours' },
  { value: 'DAILY', label: 'Every 24 Hours (default 2:00 AM)' },
  { value: 'WEEKLY', label: 'Weekly (Sunday 2:00 AM)' },
  { value: 'MONTHLY', label: 'Monthly (2:00 AM)' },
  { value: 'CRON', label: 'Custom (CRON)' },
];
const TYPES = [
  { value: 'DATABASE_ONLY', label: 'Database only' },
  { value: 'DATABASE_DOCUMENTS', label: 'Full instance (database + documents)' },
  { value: 'FULL_SNAPSHOT', label: 'Full snapshot (all files)' },
];
const KEEP_DAYS_PRESETS = ['7', '30', '90'];

export function BackupSchedulePage() {
  useRequireAuth();
  const qc = useQueryClient();
  const scheduleQ = useQuery({ queryKey: ['backups', 'schedule'], queryFn: fetchBackupSchedule });
  const retentionQ = useQuery({
    queryKey: ['backups', 'retention'],
    queryFn: fetchBackupRetention,
  });
  const [frequency, setFrequency] = useState('DAILY');
  const [backupType, setBackupType] = useState('DATABASE_DOCUMENTS');
  const [enabled, setEnabled] = useState(true);
  const [keepDays, setKeepDays] = useState('30');

  const saveM = useMutation({
    mutationFn: updateBackupSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
  const saveRetentionM = useMutation({
    mutationFn: updateBackupRetention,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const s = scheduleQ.data;
  const r = retentionQ.data;
  const currentFrequency = s?.frequency ?? frequency;
  const currentType = s?.backupType ?? backupType;
  const currentEnabled = s?.enabled ?? enabled;
  const currentKeepDays = String(r?.keepDays ?? keepDays);
  const autoCleanup = r?.autoCleanupEnabled ?? true;

  return (
    <DashboardShell role="admin" title="Automatic Backup Settings">
      <AdminShell>
        <AdminPageHeader
          title="Automatic Backup Settings"
          subtitle="Configure scheduled instance backups — default every 24 hours at 2:00 AM to local repository with optional cloud sync"
        />
        <AdminGlassCard className="max-w-xl space-y-4 p-6">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <select
              className={SELECT_CLASS}
              value={currentFrequency}
              onChange={(e) => {
                const v = e.target.value;
                setFrequency(v);
                saveM.mutate({ frequency: v, backupType: currentType, enabled: currentEnabled });
              }}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Backup type</Label>
            <select
              className={SELECT_CLASS}
              value={currentType}
              onChange={(e) => {
                const v = e.target.value;
                setBackupType(v);
                saveM.mutate({
                  frequency: currentFrequency,
                  backupType: v,
                  enabled: currentEnabled,
                });
              }}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Enabled</Label>
            <Switch
              checked={currentEnabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                saveM.mutate({ frequency: currentFrequency, backupType: currentType, enabled: v });
              }}
            />
          </div>
          {s?.nextRunAt ? (
            <p className="text-sm text-muted-foreground">
              Next run: {new Date(s.nextRunAt).toLocaleString()}
            </p>
          ) : null}
          <Button
            disabled={saveM.isPending}
            onClick={() =>
              saveM.mutate({
                frequency: currentFrequency,
                backupType: currentType,
                enabled: currentEnabled,
              })
            }
          >
            Save settings
          </Button>
        </AdminGlassCard>

        <AdminGlassCard className="mt-6 max-w-xl space-y-4 p-6">
          <h3 className="font-medium">Retention policy</h3>
          <div className="space-y-2">
            <Label>Keep backups for (days)</Label>
            <select
              className={SELECT_CLASS}
              value={currentKeepDays}
              onChange={(e) => {
                const v = e.target.value;
                setKeepDays(v);
                saveRetentionM.mutate({ keepDays: Number(v), autoCleanupEnabled: autoCleanup });
              }}
            >
              {KEEP_DAYS_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
          {r?.keepCount != null ? (
            <div className="space-y-2">
              <Label>Max backup count</Label>
              <Input value={String(r.keepCount)} readOnly className="max-w-[8rem]" />
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <Label>Auto cleanup expired backups</Label>
            <Switch
              checked={autoCleanup}
              onCheckedChange={(v) =>
                saveRetentionM.mutate({
                  keepDays: Number(currentKeepDays),
                  autoCleanupEnabled: v,
                })
              }
            />
          </div>
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
