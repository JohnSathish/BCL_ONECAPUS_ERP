'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchChannelHealth, testEmailChannel } from '@/services/communication';

export function EmailCenterPage() {
  const enabled = useAuthQueryEnabled();
  const [testTo, setTestTo] = useState('');
  const health = useQuery({
    queryKey: ['communication', 'channel-health'],
    queryFn: fetchChannelHealth,
    enabled,
  });

  const test = useMutation({
    mutationFn: () => testEmailChannel(testTo, 'OneCampus Test Email'),
  });

  return (
    <div className="space-y-6">
      <SaaSCard>
        <h2 className="font-semibold">SMTP Status</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Provider: {health.data?.email?.provider ?? '—'} ·{' '}
          {health.data?.email?.connected ? 'Connected' : 'Not configured'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports Google Workspace, Microsoft 365, Zoho, and custom SMTP via environment
          configuration.
        </p>
      </SaaSCard>
      <SaaSCard>
        <h2 className="font-semibold">Send Test Email</h2>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="recipient@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <Button onClick={() => test.mutate()} disabled={!testTo || test.isPending}>
            Send test
          </Button>
        </div>
        {test.isSuccess ? (
          <p className="mt-2 text-sm text-emerald-600">Test email queued.</p>
        ) : null}
      </SaaSCard>
    </div>
  );
}
