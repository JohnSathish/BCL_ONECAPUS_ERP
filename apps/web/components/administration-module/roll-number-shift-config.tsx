'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchRollShiftCapacity,
  fetchRollShiftRanges,
  reserveRollNumber,
  updateRollShiftRanges,
} from '@/services/roll-number';
import { fetchInstitutions } from '@/services/organization';

type ShiftDraft = Record<
  string,
  {
    sequenceStart: string;
    sequenceEnd: string;
    nextSequence: string;
  }
>;

export function RollNumberShiftConfigSection() {
  const qc = useQueryClient();
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear());
  const [institutionId, setInstitutionId] = useState('');
  const [draft, setDraft] = useState<ShiftDraft>({});
  const [reserveRoll, setReserveRoll] = useState('');
  const [reserveNote, setReserveNote] = useState('');

  const institutionsQ = useQuery({
    queryKey: ['institutions'],
    queryFn: fetchInstitutions,
  });

  useEffect(() => {
    const first = institutionsQ.data?.[0]?.id;
    if (first && !institutionId) setInstitutionId(first);
  }, [institutionsQ.data, institutionId]);

  const rangesQ = useQuery({
    queryKey: ['roll-shift-ranges', institutionId, admissionYear],
    queryFn: () => fetchRollShiftRanges({ institutionId, admissionYear }),
    enabled: Boolean(institutionId),
  });

  const capacityQ = useQuery({
    queryKey: ['roll-shift-capacity', institutionId, admissionYear],
    queryFn: () => fetchRollShiftCapacity({ institutionId, admissionYear }),
    enabled: Boolean(institutionId),
  });

  useEffect(() => {
    if (!rangesQ.data) return;
    const next: ShiftDraft = {};
    for (const row of rangesQ.data.shifts) {
      next[row.shiftId] = {
        sequenceStart: row.sequenceStart != null ? String(row.sequenceStart) : '',
        sequenceEnd: row.sequenceEnd != null ? String(row.sequenceEnd) : '',
        nextSequence: row.nextSequence != null ? String(row.nextSequence) : '',
      };
    }
    setDraft(next);
  }, [rangesQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateRollShiftRanges({
        institutionId,
        ranges: (rangesQ.data?.shifts ?? [])
          .map((shift) => {
            const d = draft[shift.shiftId];
            if (!d?.sequenceStart || !d?.sequenceEnd) return null;
            return {
              shiftId: shift.shiftId,
              admissionYear,
              sequenceStart: Number(d.sequenceStart),
              sequenceEnd: Number(d.sequenceEnd),
              nextSequence: d.nextSequence ? Number(d.nextSequence) : undefined,
            };
          })
          .filter(Boolean) as Array<{
          shiftId: string;
          admissionYear: number;
          sequenceStart: number;
          sequenceEnd: number;
          nextSequence?: number;
        }>,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roll-shift-ranges'] });
      qc.invalidateQueries({ queryKey: ['roll-shift-capacity'] });
    },
  });

  const reserveMut = useMutation({
    mutationFn: () =>
      reserveRollNumber({
        institutionId,
        rollNumber: reserveRoll.trim(),
        note: reserveNote.trim() || undefined,
      }),
    onSuccess: () => {
      setReserveRoll('');
      setReserveNote('');
      qc.invalidateQueries({ queryKey: ['roll-shift-capacity'] });
    },
  });

  const configuredCount = useMemo(
    () => (rangesQ.data?.shifts ?? []).filter((s) => s.configured).length,
    [rangesQ.data],
  );

  return (
    <>
      <AdminGlassCard className="p-4">
        <h2 className="text-sm font-semibold">Shift Configuration</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure roll number numeric ranges per shift (e.g. Day 1–499, Morning 500–999, Evening
          1000–1499). When configured, generation and shift transfers use these ranges
          automatically.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Institution</Label>
            <select
              className="h-9 min-w-[200px] rounded-md border border-input bg-background px-2 text-sm"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              {(institutionsQ.data ?? []).map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Admission year</Label>
            <Input
              type="number"
              className="w-28"
              value={admissionYear}
              onChange={(e) => setAdmissionYear(Number(e.target.value) || admissionYear)}
            />
          </div>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Save Shift Ranges
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Shift</th>
                <th className="pb-2 pr-3 font-medium">Start</th>
                <th className="pb-2 pr-3 font-medium">End</th>
                <th className="pb-2 pr-3 font-medium">Next Seq</th>
                <th className="pb-2 pr-3 font-medium">Available</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(rangesQ.data?.shifts ?? []).map((row) => {
                const d = draft[row.shiftId] ?? {
                  sequenceStart: '',
                  sequenceEnd: '',
                  nextSequence: '',
                };
                return (
                  <tr key={row.shiftId} className="border-b border-border/40">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.shiftName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.shiftCode}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        className="h-8 w-24"
                        type="number"
                        value={d.sequenceStart}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.shiftId]: { ...d, sequenceStart: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        className="h-8 w-24"
                        type="number"
                        value={d.sequenceEnd}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.shiftId]: { ...d, sequenceEnd: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        className="h-8 w-24"
                        type="number"
                        placeholder={d.sequenceStart || '1'}
                        value={d.nextSequence}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.shiftId]: { ...d, nextSequence: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">{row.configured ? row.availableSeats : '—'}</td>
                    <td className="py-2 text-xs">
                      {row.configured ? (
                        <span className="text-emerald-600">Configured</span>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {configuredCount} shift(s) configured for {admissionYear}. Vacated roll numbers are kept
          permanently (Option A) and are not reused automatically.
        </p>
      </AdminGlassCard>

      <AdminGlassCard className="p-4">
        <h2 className="text-sm font-semibold">Shift Capacity Dashboard</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(capacityQ.data ?? []).map((row) => (
            <div
              key={row.shiftId}
              className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
            >
              <div className="font-semibold">{row.shiftName}</div>
              <div className="text-xs text-muted-foreground">{row.shiftCode}</div>
              {row.configured ? (
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt>Range</dt>
                    <dd className="font-mono">
                      {row.rangeStart}–{row.rangeEnd}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Capacity</dt>
                    <dd>{row.capacity}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Used</dt>
                    <dd>{row.used}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Vacant</dt>
                    <dd>{row.vacant}</dd>
                  </div>
                  <div className="flex justify-between font-medium text-primary">
                    <dt>Available</dt>
                    <dd>{row.available}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Range not configured</p>
              )}
            </div>
          ))}
        </div>
      </AdminGlassCard>

      <AdminGlassCard className="p-4">
        <h2 className="text-sm font-semibold">Reserve Roll Number</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reserve a roll number for management quota admissions (e.g. BA26-600).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>Roll number</Label>
            <Input
              className="font-mono"
              placeholder="BA26-600"
              value={reserveRoll}
              onChange={(e) => setReserveRoll(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input
              placeholder="Management quota"
              value={reserveNote}
              onChange={(e) => setReserveNote(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!reserveRoll.trim() || reserveMut.isPending}
            onClick={() => reserveMut.mutate()}
          >
            Reserve
          </Button>
        </div>
      </AdminGlassCard>
    </>
  );
}
