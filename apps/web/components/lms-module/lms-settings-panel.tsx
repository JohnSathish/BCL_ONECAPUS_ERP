'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchLmsSettings, updateLmsSettings } from '@/services/lms';
import { useState } from 'react';

export function LmsSettingsPanel() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['lms', 'settings'], queryFn: fetchLmsSettings });
  const [maxUploadMb, setMaxUploadMb] = useState<number | ''>('');

  const saveMut = useMutation({
    mutationFn: () =>
      updateLmsSettings({
        maxUploadMb: maxUploadMb === '' ? undefined : Number(maxUploadMb),
        poolWorkspacesEnabled: settings.data?.poolWorkspacesEnabled,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lms', 'settings'] }),
  });

  const s = settings.data;

  return (
    <CompactCard>
      <CompactCardHeader
        title="LMS settings"
        description="Upload limits and pool workspace behaviour."
      />
      <CompactCardBody className="max-w-md space-y-4">
        <div>
          <Label htmlFor="max-mb">Max upload (MB)</Label>
          <Input
            id="max-mb"
            type="number"
            defaultValue={s?.maxUploadMb}
            onChange={(e) => setMaxUploadMb(e.target.value ? Number(e.target.value) : '')}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Pool workspaces: {s?.poolWorkspacesEnabled ? 'Enabled' : 'Disabled'} (MDC/AEC/SEC/VAC
          combined classrooms)
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          Save settings
        </Button>
      </CompactCardBody>
    </CompactCard>
  );
}
