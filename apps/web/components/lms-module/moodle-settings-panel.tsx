'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchMoodleSettings, testMoodleConnection, updateMoodleSettings } from '@/services/moodle';

const TOGGLES: Array<{ key: string; label: string }> = [
  { key: 'enableSync', label: 'Enable sync' },
  { key: 'enableAutoUserCreation', label: 'Auto user creation' },
  { key: 'enableAutoCourseCreation', label: 'Auto course creation' },
  { key: 'enableAutoEnrollment', label: 'Auto enrollment' },
  { key: 'enableGradeSync', label: 'Grade sync' },
  { key: 'enableAttendanceSync', label: 'Attendance sync' },
  { key: 'enableAssignmentSync', label: 'Assignment sync' },
  { key: 'enableNotificationSync', label: 'Notification sync' },
  { key: 'ssoEnabled', label: 'SSO launch' },
];

export function MoodleSettingsPanel() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['moodle', 'settings'], queryFn: fetchMoodleSettings });
  const [moodleUrl, setMoodleUrl] = useState('');
  const [wsToken, setWsToken] = useState('');
  const [ssoSecret, setSsoSecret] = useState('');

  const saveMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMoodleSettings(payload),
    onSuccess: () => {
      setWsToken('');
      setSsoSecret('');
      void qc.invalidateQueries({ queryKey: ['moodle', 'settings'] });
    },
  });

  const testMut = useMutation({ mutationFn: testMoodleConnection });

  const s = settings.data;

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Moodle connection"
          description="Configure Moodle URL, web service token, and SSO secret. Secrets are encrypted at rest."
        />
        <CompactCardBody className="max-w-xl space-y-4">
          <div>
            <Label htmlFor="moodle-url">Moodle URL</Label>
            <Input
              id="moodle-url"
              placeholder="https://lms.donboscocollege.ac.in"
              defaultValue={s?.moodleUrl ?? ''}
              onChange={(e) => setMoodleUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ws-token">Web service token</Label>
            <Input
              id="ws-token"
              type="password"
              placeholder={s?.hasWsToken ? 'Token saved — enter to replace' : 'Paste token'}
              onChange={(e) => setWsToken(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sso-secret">SSO shared secret</Label>
            <Input
              id="sso-secret"
              type="password"
              placeholder={s?.hasSsoSecret ? 'Secret saved — enter to replace' : 'Paste secret'}
              onChange={(e) => setSsoSecret(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Status: {s?.connectionStatus ?? 'UNKNOWN'}
            {s?.lastConnectionAt
              ? ` · last check ${new Date(s.lastConnectionAt).toLocaleString()}`
              : ''}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saveMut.isPending}
              onClick={() =>
                saveMut.mutate({
                  moodleUrl: moodleUrl || s?.moodleUrl || undefined,
                  wsToken: wsToken || undefined,
                  ssoSecret: ssoSecret || undefined,
                })
              }
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={testMut.isPending}
              onClick={() => testMut.mutate()}
            >
              Test connection
            </Button>
          </div>
          {testMut.isSuccess ? (
            <p className="text-sm text-green-600">Connection successful.</p>
          ) : null}
          {testMut.isError ? <p className="text-sm text-destructive">Connection failed.</p> : null}
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Sync toggles"
          description="Control automatic provisioning and sync jobs."
        />
        <CompactCardBody className="grid gap-3 sm:grid-cols-2 max-w-xl">
          {TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(s?.[key as keyof typeof s])}
                onChange={(e) => saveMut.mutate({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
