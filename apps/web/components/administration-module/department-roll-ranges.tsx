'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchDepartmentRollRanges,
  saveDepartmentRollRanges,
  type DepartmentRollRangeRow,
} from '@/services/roll-number';
import { apiErrorMessage } from '@/utils/api-error';

type Draft = Record<
  string,
  { dayStart: string; dayEnd: string; morningStart: string; morningEnd: string }
>;

function draftFromRows(rows: DepartmentRollRangeRow[]): Draft {
  const next: Draft = {};
  for (const row of rows) {
    next[row.departmentId] = {
      dayStart: String(row.day.start),
      dayEnd: String(row.day.end),
      morningStart: String(row.morning.start),
      morningEnd: String(row.morning.end),
    };
  }
  return next;
}

export function DepartmentRollRangeSettings() {
  const qc = useQueryClient();
  const rangesQ = useQuery({
    queryKey: ['admin', 'department-roll-ranges'],
    queryFn: () => fetchDepartmentRollRanges(),
  });
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (rangesQ.data?.rows) setDraft(draftFromRows(rangesQ.data.rows));
  }, [rangesQ.data]);

  const saveMut = useMutation({
    mutationFn: () => {
      const year = rangesQ.data?.admissionYear ?? new Date().getFullYear();
      const ranges = (rangesQ.data?.rows ?? []).flatMap((row) => {
        const values = draft[row.departmentId];
        if (!values) return [];
        const items = [];
        if (row.dayShiftId) {
          items.push({
            departmentId: row.departmentId,
            shiftId: row.dayShiftId,
            sequenceStart: Number(values.dayStart),
            sequenceEnd: Number(values.dayEnd),
            nextSequence: row.day.next,
          });
        }
        if (row.morningShiftId) {
          items.push({
            departmentId: row.departmentId,
            shiftId: row.morningShiftId,
            sequenceStart: Number(values.morningStart),
            sequenceEnd: Number(values.morningEnd),
            nextSequence: row.morning.next,
          });
        }
        return items;
      });
      return saveDepartmentRollRanges({ admissionYear: year, ranges });
    },
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'department-roll-ranges'], data);
    },
  });

  const setField = (departmentId: string, field: keyof Draft[string], value: string) => {
    setDraft((current) => ({
      ...current,
      [departmentId]: { ...current[departmentId], [field]: value },
    }));
  };

  return (
    <AdminGlassCard className="p-4">
      <h2 className="text-sm font-semibold">Department roll numbers</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Each department has its own prefix. Day Shift uses 01–100. Morning Shift uses 101 and above.
        Economics Day is EC26-01. Economics Morning is EC26-101. The next roll is filled in for you
        from the students already enrolled.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Department</th>
              <th className="pb-2 pr-3 font-medium">Day Shift</th>
              <th className="pb-2 pr-3 font-medium">Next Day roll</th>
              <th className="pb-2 pr-3 font-medium">Morning Shift</th>
              <th className="pb-2 font-medium">Next Morning roll</th>
            </tr>
          </thead>
          <tbody>
            {(rangesQ.data?.rows ?? []).map((row) => {
              const values = draft[row.departmentId];
              return (
                <tr key={row.departmentId} className="border-b border-border/40 align-top">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{row.departmentName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.prefix}
                      {String(row.admissionYear).slice(-2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.dayStudents} day · {row.morningStudents} morning
                    </div>
                    {row.note ? (
                      <p className="mt-1 max-w-[220px] text-xs text-amber-700">{row.note}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-8 w-16 font-mono"
                        value={values?.dayStart ?? ''}
                        onChange={(event) =>
                          setField(row.departmentId, 'dayStart', event.target.value)
                        }
                        aria-label={`${row.departmentName} Day start`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        className="h-8 w-16 font-mono"
                        value={values?.dayEnd ?? ''}
                        onChange={(event) =>
                          setField(row.departmentId, 'dayEnd', event.target.value)
                        }
                        aria-label={`${row.departmentName} Day end`}
                      />
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-primary">{row.nextDayRoll}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-8 w-16 font-mono"
                        value={values?.morningStart ?? ''}
                        onChange={(event) =>
                          setField(row.departmentId, 'morningStart', event.target.value)
                        }
                        aria-label={`${row.departmentName} Morning start`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        className="h-8 w-16 font-mono"
                        value={values?.morningEnd ?? ''}
                        onChange={(event) =>
                          setField(row.departmentId, 'morningEnd', event.target.value)
                        }
                        aria-label={`${row.departmentName} Morning end`}
                      />
                    </div>
                  </td>
                  <td className="py-3 font-mono text-xs text-primary">{row.nextMorningRoll}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {saveMut.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {apiErrorMessage(saveMut.error, 'Could not save department roll numbers')}
        </p>
      ) : null}
      {saveMut.isSuccess ? (
        <p className="mt-3 text-sm text-emerald-600">Department roll numbers saved.</p>
      ) : null}
      <Button
        className="mt-4"
        size="sm"
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
      >
        {saveMut.isPending ? 'Saving…' : 'Save department roll numbers'}
      </Button>
    </AdminGlassCard>
  );
}
