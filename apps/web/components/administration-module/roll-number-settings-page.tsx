'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  bulkGenerateRollNumbers,
  fetchRollNumberConfig,
  syncRollNumberSequences,
  updateRollNumberConfig,
  type BulkGenerateRollNumbersResult,
} from '@/services/roll-number';

export function RollNumberSettingsPage() {
  useRequireAuth();
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ['admin', 'roll-number-config'],
    queryFn: fetchRollNumberConfig,
  });

  const [sequenceLength, setSequenceLength] = useState(3);
  const [separator, setSeparator] = useState('-');
  const [autoGenerateOnAdmit, setAutoGenerateOnAdmit] = useState(true);
  const [prefixDraft, setPrefixDraft] = useState<Record<string, string>>({});
  const [bulkResult, setBulkResult] = useState<BulkGenerateRollNumbersResult | null>(null);
  const [admissionYear, setAdmissionYear] = useState('');

  useEffect(() => {
    if (!configQ.data) return;
    setSequenceLength(configQ.data.settings.sequenceLength);
    setSeparator(configQ.data.settings.separator);
    setAutoGenerateOnAdmit(configQ.data.settings.autoGenerateOnAdmit);
    setPrefixDraft(Object.fromEntries(configQ.data.prefixes.map((p) => [p.streamId, p.prefix])));
  }, [configQ.data]);

  const saveMut = useMutation({
    mutationFn: updateRollNumberConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roll-number-config'] }),
  });

  const bulkMut = useMutation({
    mutationFn: bulkGenerateRollNumbers,
    onSuccess: (data) => setBulkResult(data),
  });

  const syncMut = useMutation({
    mutationFn: () => syncRollNumberSequences(),
  });

  const handleSave = () => {
    if (!configQ.data) return;
    saveMut.mutate({
      sequenceLength,
      separator,
      autoGenerateOnAdmit,
      prefixes: configQ.data.prefixes.map((p) => ({
        streamId: p.streamId,
        prefix: prefixDraft[p.streamId] ?? p.prefix,
        isActive: Boolean(prefixDraft[p.streamId]?.trim()),
      })),
    });
  };

  return (
    <DashboardShell role="admin" title="Roll Number Settings">
      <AdminShell>
        <AdminPageHeader
          title="Roll Number Settings"
          subtitle="Configure college roll number prefixes, sequence format, and bulk generation for legacy students."
        />

        <div className="space-y-4">
          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Sequence format</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Roll numbers use stream prefix + admission year (last 2 digits) + running sequence,
              e.g. BA26-001.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="seq-len">Sequence length</Label>
                <Input
                  id="seq-len"
                  type="number"
                  min={2}
                  max={6}
                  value={sequenceLength}
                  onChange={(e) => setSequenceLength(Number(e.target.value) || 3)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sep">Separator</Label>
                <Input
                  id="sep"
                  maxLength={3}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoGenerateOnAdmit}
                    onChange={(e) => setAutoGenerateOnAdmit(e.target.checked)}
                  />
                  Auto-generate on admit
                </label>
              </div>
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Stream prefixes</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Stream</th>
                    <th className="pb-2 pr-3 font-medium">Code</th>
                    <th className="pb-2 font-medium">Prefix</th>
                  </tr>
                </thead>
                <tbody>
                  {configQ.data?.prefixes.map((row) => (
                    <tr key={row.streamId} className="border-b border-border/40">
                      <td className="py-2 pr-3">{row.streamName}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{row.streamCode}</td>
                      <td className="py-2">
                        <Input
                          className="h-9 max-w-[120px] font-mono uppercase"
                          value={prefixDraft[row.streamId] ?? ''}
                          onChange={(e) =>
                            setPrefixDraft((d) => ({
                              ...d,
                              [row.streamId]: e.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="BA"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
                Save settings
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
              >
                Sync sequences from existing rolls
              </Button>
              {syncMut.data ? (
                <span className="self-center text-xs text-muted-foreground">
                  Synced {syncMut.data.synced} counter(s)
                </span>
              ) : null}
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Generate missing roll numbers</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Backfill college roll numbers for admitted students without a roll number. Use preview
              first.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-year">Admission year (optional)</Label>
                <Input
                  id="bulk-year"
                  type="number"
                  placeholder="2026"
                  className="w-32"
                  value={admissionYear}
                  onChange={(e) => setAdmissionYear(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkMut.isPending}
                onClick={() =>
                  bulkMut.mutate({
                    dryRun: true,
                    admissionYear: admissionYear ? Number(admissionYear) : undefined,
                  })
                }
              >
                Preview
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkMut.isPending}
                onClick={() =>
                  bulkMut.mutate({
                    dryRun: true,
                    admissionYear: admissionYear ? Number(admissionYear) : undefined,
                  })
                }
              >
                Dry run
              </Button>
              <Button
                size="sm"
                disabled={bulkMut.isPending}
                onClick={() =>
                  bulkMut.mutate({
                    dryRun: false,
                    admissionYear: admissionYear ? Number(admissionYear) : undefined,
                  })
                }
              >
                Generate
              </Button>
            </div>

            {bulkResult ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {bulkResult.generated > 0
                    ? `Generated ${bulkResult.generated} roll number(s).`
                    : `Preview: ${bulkResult.preview.length} of ${bulkResult.totalCandidates} candidate(s).`}
                </p>
                {bulkResult.preview.length > 0 ? (
                  <div className="max-h-48 overflow-auto rounded-lg border border-border/50">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr>
                          <th className="px-2 py-1 text-left">Student name</th>
                          <th className="px-2 py-1 text-left">Roll number</th>
                          <th className="px-2 py-1 text-left">Stream</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResult.preview.map((row) => (
                          <tr key={row.studentId} className="border-t border-border/40">
                            <td className="px-2 py-1">{row.fullName ?? '—'}</td>
                            <td className="px-2 py-1 font-semibold">{row.rollNumber}</td>
                            <td className="px-2 py-1">{row.streamCode ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
