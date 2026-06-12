'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createPlatformLicenseKeys,
  fetchPlatformLicenseKeys,
  revokePlatformLicenseKey,
} from '@/services/platform-licensing';
import { apiErrorMessage } from '@/utils/api-error';

export function PlatformLicenseKeysPage() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [termDays, setTermDays] = useState('365');
  const [quantity, setQuantity] = useState('1');
  const [label, setLabel] = useState('');
  const [generated, setGenerated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ['platform', 'license-keys'],
    queryFn: () => fetchPlatformLicenseKeys(),
    enabled,
  });

  const generate = useMutation({
    mutationFn: () =>
      createPlatformLicenseKeys({
        licenseType: 'ANNUAL_1Y',
        subscriptionPlan: 'Annual License',
        termDays: Number(termDays),
        quantity: Number(quantity),
        label: label || undefined,
        gracePeriodDays: 15,
        maxStudents: 5000,
        maxStaff: 500,
        storageLimitMb: 10240,
      }),
    onSuccess: (result) => {
      setGenerated(result.items.map((k) => k.activationKey));
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['platform', 'license-keys'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Failed to generate keys')),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokePlatformLicenseKey(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'license-keys'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Activation keys</h2>
        <p className="text-sm text-muted-foreground">
          Generate one-time keys institutions can enter on their license page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate keys</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="term-days">Term (days)</Label>
            <Input
              id="term-days"
              type="number"
              value={termDays}
              onChange={(e) => setTermDays(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Annual renewal batch"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? 'Generating…' : 'Generate keys'}
            </Button>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
          {generated.length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-sm font-medium">New keys (copy and share securely)</p>
              <ul className="space-y-1 font-mono text-sm">
                {generated.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Term</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Redeemed</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {keys.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (
              (keys.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-mono text-xs">{row.activationKey}</td>
                  <td className="px-4 py-3">{row.label ?? '—'}</td>
                  <td className="px-4 py-3">{row.termDays}d</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        row.status === 'PENDING'
                          ? 'secondary'
                          : row.status === 'REDEEMED'
                            ? 'outline'
                            : 'destructive'
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.redeemedAt ? new Date(row.redeemedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'PENDING' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revoke.mutate(row.id)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
