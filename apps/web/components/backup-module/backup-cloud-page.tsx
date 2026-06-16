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
import { fetchCloudTargets, updateCloudTarget } from '@/services/backup';

export function BackupCloudPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const targetsQ = useQuery({ queryKey: ['backups', 'cloud'], queryFn: fetchCloudTargets });
  const [form, setForm] = useState<Record<string, string>>({});

  const saveM = useMutation({
    mutationFn: updateCloudTarget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups', 'cloud'] }),
  });

  const targets = targetsQ.data ?? [];

  return (
    <DashboardShell role="admin" title="Cloud Storage Settings">
      <AdminShell>
        <AdminPageHeader
          title="Cloud Storage Settings"
          subtitle="AWS S3 and Backblaze B2 sync targets"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {targets.map((t: Record<string, unknown>) => {
            const provider = String(t.provider);
            return (
              <AdminGlassCard key={provider} className="space-y-3 p-6">
                <h3 className="font-medium">{provider.replace('_', ' ')}</h3>
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Input
                    defaultValue={String(t.bucket ?? '')}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [`${provider}_bucket`]: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input
                    defaultValue={String(t.region ?? '')}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [`${provider}_region`]: e.target.value }))
                    }
                  />
                </div>
                {provider === 'BACKBLAZE_B2' ? (
                  <div className="space-y-2">
                    <Label>Endpoint</Label>
                    <Input
                      placeholder="https://s3.us-west-000.backblazeb2.com"
                      defaultValue={String(t.endpoint ?? '')}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [`${provider}_endpoint`]: e.target.value }))
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Path prefix</Label>
                  <Input
                    defaultValue={String(t.pathPrefix ?? 'nep-backups')}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [`${provider}_pathPrefix`]: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access key ID</Label>
                  <Input
                    placeholder={t.hasCredentials ? '••••••••' : ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [`${provider}_accessKeyId`]: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret access key</Label>
                  <Input
                    type="password"
                    placeholder={t.hasCredentials ? '••••••••' : ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [`${provider}_secretAccessKey`]: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled</Label>
                  <Switch
                    defaultChecked={Boolean(t.enabled)}
                    onCheckedChange={(enabled) =>
                      saveM.mutate({
                        provider,
                        bucket: form[`${provider}_bucket`] ?? t.bucket,
                        region: form[`${provider}_region`] ?? t.region,
                        endpoint: form[`${provider}_endpoint`] ?? t.endpoint,
                        pathPrefix: form[`${provider}_pathPrefix`] ?? t.pathPrefix,
                        enabled,
                      })
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    saveM.mutate({
                      provider,
                      bucket: form[`${provider}_bucket`] ?? t.bucket,
                      region: form[`${provider}_region`] ?? t.region,
                      endpoint: form[`${provider}_endpoint`] ?? t.endpoint,
                      pathPrefix: form[`${provider}_pathPrefix`] ?? t.pathPrefix,
                      accessKeyId: form[`${provider}_accessKeyId`],
                      secretAccessKey: form[`${provider}_secretAccessKey`],
                      enabled: Boolean(t.enabled),
                    })
                  }
                >
                  Save {provider.replace('_', ' ')}
                </Button>
              </AdminGlassCard>
            );
          })}
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
