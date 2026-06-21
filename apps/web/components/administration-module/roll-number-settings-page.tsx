'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchRollNumberConfig,
  fetchRollNumberDepartmentMappings,
  fetchRollNumberSequences,
  resetRollNumberConfig,
  updateRollNumberConfig,
} from '@/services/roll-number';
import { RollNumberShiftConfigSection } from '@/components/administration-module/roll-number-shift-config';

function formatPreviewSamples(
  prefix: string,
  year: number,
  sequenceLength: number,
  separator: string,
  startSeq = 1,
  count = 3,
) {
  const yearSuffix = String(year).slice(-2);
  return Array.from({ length: count }, (_, i) => {
    const seq = String(startSeq + i).padStart(sequenceLength, '0');
    return `${prefix}${yearSuffix}${separator}${seq}`;
  });
}

export function RollNumberSettingsPage() {
  useRequireAuth();
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ['admin', 'roll-number-config'],
    queryFn: fetchRollNumberConfig,
  });
  const sequencesQ = useQuery({
    queryKey: ['admin', 'roll-number-sequences'],
    queryFn: fetchRollNumberSequences,
  });
  const departmentsQ = useQuery({
    queryKey: ['admin', 'roll-number-departments'],
    queryFn: fetchRollNumberDepartmentMappings,
  });

  const [sequenceLength, setSequenceLength] = useState(3);
  const [separator, setSeparator] = useState('-');
  const [autoGenerateOnAdmit, setAutoGenerateOnAdmit] = useState(true);
  const [prefixDraft, setPrefixDraft] = useState<Record<string, string>>({});
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!configQ.data) return;
    setSequenceLength(configQ.data.settings.sequenceLength);
    setSeparator(configQ.data.settings.separator);
    setAutoGenerateOnAdmit(configQ.data.settings.autoGenerateOnAdmit);
    setPrefixDraft(Object.fromEntries(configQ.data.prefixes.map((p) => [p.streamId, p.prefix])));
  }, [configQ.data]);

  const saveMut = useMutation({
    mutationFn: updateRollNumberConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roll-number-config'] });
      qc.invalidateQueries({ queryKey: ['admin', 'roll-number-sequences'] });
    },
  });

  const resetMut = useMutation({
    mutationFn: resetRollNumberConfig,
    onSuccess: (data) => {
      setSequenceLength(data.settings.sequenceLength);
      setSeparator(data.settings.separator);
      setAutoGenerateOnAdmit(data.settings.autoGenerateOnAdmit);
      qc.invalidateQueries({ queryKey: ['admin', 'roll-number-config'] });
    },
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

  const previewPrefix =
    Object.values(prefixDraft).find((p) => p.trim()) ??
    configQ.data?.prefixes.find((p) => p.prefix)?.prefix ??
    'BA';

  const formatSamples = useMemo(
    () => formatPreviewSamples(previewPrefix, previewYear, sequenceLength, separator),
    [previewPrefix, previewYear, sequenceLength, separator],
  );

  return (
    <DashboardShell role="admin" title="Roll Number Settings">
      <AdminShell>
        <AdminPageHeader
          title="Roll Number Settings"
          subtitle="Configure roll number format, programme prefixes, and sequence rules. Generation is handled separately in Roll Number Generation."
        />

        <div className="space-y-4">
          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Roll Number Format Configuration</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pattern: Programme Prefix + Admission Year (2 digits) + Separator + Sequence (e.g.
              BA26-001, BC26-001).
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
            <h2 className="text-sm font-semibold">Programme Mapping</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Map each academic stream (programme) to its roll number prefix.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Programme</th>
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
          </AdminGlassCard>

          <RollNumberShiftConfigSection />

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Department Mapping</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reference mapping of departments to codes (managed in Organization setup).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Department</th>
                    <th className="pb-2 font-medium">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {(departmentsQ.data ?? []).map((row) => (
                    <tr key={row.departmentId} className="border-b border-border/40">
                      <td className="py-2 pr-3">{row.departmentName}</td>
                      <td className="py-2 font-mono text-xs">{row.departmentCode || '—'}</td>
                    </tr>
                  ))}
                  {!departmentsQ.data?.length && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-xs text-muted-foreground">
                        No departments configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Sequence Management</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Current counters per prefix and admission year. Sync from Generation if rolls were
              assigned outside the system.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">Prefix</th>
                    <th className="pb-2 pr-2">Year</th>
                    <th className="pb-2 pr-2">Current Seq</th>
                    <th className="pb-2 pr-2">Next Roll</th>
                    <th className="pb-2 pr-2">Last Generated</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sequencesQ.data ?? []).map((row) => (
                    <tr
                      key={`${row.prefix}-${row.admissionYear}`}
                      className="border-b border-border/40"
                    >
                      <td className="py-2 pr-2 font-mono font-semibold">{row.prefix}</td>
                      <td className="py-2 pr-2">{row.admissionYear}</td>
                      <td className="py-2 pr-2">{row.currentSequence}</td>
                      <td className="py-2 pr-2 font-mono text-primary">{row.nextRollNumber}</td>
                      <td className="py-2 pr-2 font-mono">{row.lastGeneratedRollNumber ?? '—'}</td>
                      <td className="py-2">{row.totalGenerated}</td>
                    </tr>
                  ))}
                  {!sequencesQ.data?.length && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-muted-foreground">
                        No sequences yet — counters are created on first generation
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4" />
              Preview Format
            </h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="preview-year">Admission year</Label>
                <Input
                  id="preview-year"
                  type="number"
                  className="w-28"
                  value={previewYear}
                  onChange={(e) => setPreviewYear(Number(e.target.value) || previewYear)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {formatSamples.map((sample) => (
                  <span
                    key={sample}
                    className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm"
                  >
                    {sample}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
                Save Settings
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (window.confirm('Reset format settings to defaults (prefixes unchanged)?')) {
                    resetMut.mutate();
                  }
                }}
                disabled={resetMut.isPending}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset Settings
              </Button>
            </div>
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
