'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchNaacExtendedProfile,
  pullNaacErpBulk,
  pullNaacExtendedProfile,
} from '@/services/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

function MetricCell({ label, value }: { label: string; value: unknown }) {
  if (!value || typeof value !== 'object') {
    return (
      <div className="rounded border p-2 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{String(value ?? '—')}</p>
      </div>
    );
  }
  const v = value as {
    value?: number | null;
    source?: string;
    asOf?: string;
    pending?: boolean;
    message?: string;
    unit?: string;
  };
  return (
    <div className="rounded border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {v.pending ? <Badge variant="outline">Pending</Badge> : null}
      </div>
      <p className="text-lg font-semibold">
        {v.value == null ? '—' : v.value}
        {v.unit ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{v.unit}</span>
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">{v.source}</p>
      {v.message ? <p className="mt-1 text-xs text-amber-700">{v.message}</p> : null}
    </div>
  );
}

export function NaacExtendedProfilePanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [year, setYear] = useState('2025-26');
  const [error, setError] = useState('');
  const [bulkCriterion, setBulkCriterion] = useState('');

  const profileQ = useQuery({
    queryKey: ['naac-extended-profile', year],
    queryFn: () => fetchNaacExtendedProfile(year),
    enabled,
  });

  const pullMut = useMutation({
    mutationFn: () => pullNaacExtendedProfile(year),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-extended-profile'] });
      void qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'ERP pull failed')),
  });

  const bulkMut = useMutation({
    mutationFn: () =>
      pullNaacErpBulk({
        academicYear: year,
        criterion: bulkCriterion ? Number(bulkCriterion) : undefined,
      }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-criteria-tree'] });
      void qc.invalidateQueries({ queryKey: ['naac-metric-workspace'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Bulk pull failed')),
  });

  const sections = (profileQ.data?.profile?.sections ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Extended Profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              ERP auto-pull for institutional extended profile fields (Phase 2A)
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Academic year</Label>
              <Input className="w-32" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Button disabled={pullMut.isPending} onClick={() => pullMut.mutate()}>
              {pullMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Pull from ERP
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>
              Status:{' '}
              {profileQ.data?.exists ? (
                <Badge>Stored</Badge>
              ) : (
                <Badge variant="outline">Not pulled yet</Badge>
              )}
            </span>
            <span>
              Last pulled:{' '}
              {profileQ.data?.profile?.lastPulledAt
                ? new Date(profileQ.data.profile.lastPulledAt).toLocaleString()
                : '—'}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded border p-3">
            <div>
              <Label>Bulk fill metric workspaces (optional criterion 1–7)</Label>
              <Input
                className="w-24"
                placeholder="all"
                value={bulkCriterion}
                onChange={(e) => setBulkCriterion(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              disabled={bulkMut.isPending}
              onClick={() => bulkMut.mutate()}
            >
              Pull ERP into workspaces
            </Button>
          </div>
        </CardContent>
      </Card>

      {profileQ.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : !profileQ.data?.exists ? (
        <p className="text-sm text-muted-foreground">
          Run <strong>Pull from ERP</strong> to populate extended profile sections.
        </p>
      ) : (
        Object.entries(sections)
          .filter(([k]) => !['academicYear', 'pulledAt', 'institutionProfile'].includes(k))
          .map(([sectionKey, fields]) => (
            <Card key={sectionKey}>
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {sectionKey.replace(/([A-Z])/g, ' $1')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {typeof fields === 'object' && fields
                  ? Object.entries(fields as Record<string, unknown>).map(([k, v]) => (
                      <MetricCell key={k} label={k} value={v} />
                    ))
                  : null}
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
