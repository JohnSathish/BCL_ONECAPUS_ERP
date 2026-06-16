'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createNaacAqar,
  fetchNaacAqar,
  fetchNaacAqars,
  syncNaacAqarSection,
} from '@/services/naac-iqac';
import type { NaacAqar } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

export function NaacAqarPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [year, setYear] = useState('2025-26');
  const [title, setTitle] = useState('Annual Quality Assurance Report');

  const aqarsQ = useQuery({
    queryKey: ['naac-aqars'],
    queryFn: fetchNaacAqars,
  });
  const detailQ = useQuery({
    queryKey: ['naac-aqar', selectedId],
    queryFn: () => fetchNaacAqar(selectedId!),
    enabled: !!selectedId,
  });

  const createMut = useMutation({
    mutationFn: () => createNaacAqar({ academicYear: year, title }),
    onSuccess: (aqar) => {
      void qc.invalidateQueries({ queryKey: ['naac-aqars'] });
      onSelect(aqar.id);
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const syncMut = useMutation({
    mutationFn: ({ aqarId, sectionKey }: { aqarId: string; sectionKey: string }) =>
      syncNaacAqarSection(aqarId, sectionKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['naac-aqar'] });
      void qc.invalidateQueries({ queryKey: ['naac-aqars'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const aqars = aqarsQ.data ?? [];
  const detail = detailQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create AQAR</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Academic year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create AQAR for {year}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {aqars.map((a: NaacAqar) => (
          <Button
            key={a.id}
            variant={selectedId === a.id ? 'default' : 'outline'}
            onClick={() => onSelect(a.id)}
          >
            {a.title} ({a.academicYear}) — {a.completionPct}%
          </Button>
        ))}
      </div>

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {detail.title} — {detail.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(detail.sections ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{s.sectionKey}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.completionPct}% ·{' '}
                    {s.lastSyncedAt
                      ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}`
                      : 'Not synced'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncMut.isPending}
                  onClick={() => syncMut.mutate({ aqarId: detail.id, sectionKey: s.sectionKey })}
                >
                  Sync from ERP
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
