'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/use-permissions';
import { activateLicenseKey } from '@/services/licensing';
import { apiErrorMessage } from '@/utils/api-error';

export function LicenseActivationKeyForm() {
  const queryClient = useQueryClient();
  const { canAny } = usePermissions();
  const canActivate = canAny('license:activate', 'tenant:manage', 'users:manage');
  const [key, setKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => activateLicenseKey(key),
    onSuccess: (result) => {
      setMessage(result.message);
      setError(null);
      setKey('');
      void queryClient.invalidateQueries({ queryKey: ['license'] });
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Failed to activate license key'));
      setMessage(null);
    },
  });

  if (!canActivate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Activate license key
        </CardTitle>
        <CardDescription>
          Enter the activation key provided by BaseCode Labs to renew or activate your ERP
          subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="license-key">License key</Label>
          <Input
            id="license-key"
            placeholder="BCLK-XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            className="font-mono uppercase tracking-wide"
          />
        </div>
        {message ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={() => mutation.mutate()} disabled={!key.trim() || mutation.isPending}>
          {mutation.isPending ? 'Activating…' : 'Activate key'}
        </Button>
      </CardContent>
    </Card>
  );
}
