'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CurriculumManagerPanel } from '@/components/academic-engine/shift-curriculum/CurriculumManagerPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useShiftScope } from '@/hooks/use-shift-scope';
import {
  fetchCurriculumConfigurationStatus,
  fetchShiftDepartments,
  fetchShiftProgrammes,
  fetchShifts,
  upsertShiftDepartments,
  upsertShiftProgrammes,
} from '@/services/academic-engine';

type Props = {
  institutionId?: string;
  mode?: 'full' | 'scope' | 'status';
};

type PanelTab = 'manager' | 'scope' | 'status';

export function ShiftCurriculumShell({ institutionId, mode = 'full' }: Props) {
  const shiftScope = useShiftScope();
  const [panelTab, setPanelTab] = useState<PanelTab>(
    mode === 'scope' ? 'scope' : mode === 'status' ? 'status' : 'manager',
  );
  const qc = useQueryClient();
  const [shiftId, setShiftId] = useState('');

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts', 'ACTIVE'],
    queryFn: () => fetchShifts(),
  });

  const activeShifts = useMemo(
    () => (shifts.data ?? []).filter((s) => s.status === 'ACTIVE'),
    [shifts.data],
  );

  const selectedShiftId =
    shiftScope.hideShiftSelectors && shiftScope.activeShiftId
      ? shiftScope.activeShiftId
      : shiftId || activeShifts[0]?.id || '';

  const programmes = useQuery({
    queryKey: ['shift-curriculum', 'programmes', selectedShiftId, institutionId],
    queryFn: () => fetchShiftProgrammes(selectedShiftId, institutionId),
    enabled: Boolean(selectedShiftId),
  });

  const departments = useQuery({
    queryKey: ['shift-curriculum', 'departments', selectedShiftId, institutionId],
    queryFn: () => fetchShiftDepartments(selectedShiftId, institutionId),
    enabled: Boolean(selectedShiftId),
  });

  const configurationStatus = useQuery({
    queryKey: ['shift-curriculum', 'configuration-status', institutionId],
    queryFn: () => fetchCurriculumConfigurationStatus(institutionId),
  });

  const statusCell = (value: 'complete' | 'pending' | 'na') => {
    if (value === 'complete') return '✅';
    if (value === 'na') return '—';
    return '⏳';
  };

  const saveProgrammes = useMutation({
    mutationFn: (items: { programId: string; enabled: boolean }[]) =>
      upsertShiftProgrammes(selectedShiftId, items),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-curriculum', 'programmes', selectedShiftId] });
    },
  });

  const saveDepartments = useMutation({
    mutationFn: (items: { departmentId: string; enabled: boolean }[]) =>
      upsertShiftDepartments(selectedShiftId, items),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-curriculum', 'departments', selectedShiftId] });
    },
  });

  const programmeGroups = useMemo(() => {
    const rows = programmes.data ?? [];
    return {
      ba: rows.filter((p) => p.code.startsWith('BA-')),
      science: rows.filter(
        (p) => p.code.startsWith('BSC-') || p.code.toUpperCase().includes('B.SC'),
      ),
      commerce: rows.filter(
        (p) => p.code.startsWith('BCOM-') || p.code.toUpperCase().includes('B.COM'),
      ),
      other: rows.filter(
        (p) =>
          !p.code.startsWith('BA-') && !p.code.startsWith('BSC-') && !p.code.startsWith('BCOM-'),
      ),
    };
  }, [programmes.data]);

  return (
    <div className="space-y-4">
      {mode === 'full' ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['manager', 'Curriculum Manager'],
              ['scope', 'Shift scope'],
              ['status', 'Configuration status'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={panelTab === id ? 'default' : 'outline'}
              onClick={() => setPanelTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}

      {panelTab === 'manager' && mode !== 'scope' && mode !== 'status' ? (
        <CurriculumManagerPanel institutionId={institutionId} initialShiftId={selectedShiftId} />
      ) : null}

      {panelTab === 'scope' && mode !== 'status' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Shift curriculum scope</CardTitle>
              <CardDescription>
                Configure which programmes and departments are available per shift. Course Master
                remains global — only curriculum mapping changes by shift.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!shiftScope.hideShiftSelectors ? (
                <label className="block text-sm font-medium">
                  Shift
                  <select
                    className="mt-1 h-10 w-full max-w-md rounded-md border border-border bg-card px-3 text-sm"
                    value={selectedShiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                  >
                    {activeShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Workspace shift: {shiftScope.activeShiftCode ?? selectedShiftId}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Programmes</CardTitle>
                <CardDescription>
                  Enable or disable programme offerings for this shift.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {['BA (Arts)', 'Science', 'Commerce', 'Other'].map((groupLabel, index) => {
                  const groupRows = [
                    programmeGroups.ba,
                    programmeGroups.science,
                    programmeGroups.commerce,
                    programmeGroups.other,
                  ][index];
                  if (!groupRows?.length) return null;
                  return (
                    <div key={groupLabel} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {groupLabel}
                      </p>
                      {groupRows.map((row) => (
                        <label key={row.programId} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) => {
                              const items = (programmes.data ?? []).map((p) => ({
                                programId: p.programId,
                                enabled:
                                  p.programId === row.programId ? e.target.checked : p.enabled,
                              }));
                              saveProgrammes.mutate(items);
                            }}
                          />
                          <span>
                            {row.code} — {row.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}
                {programmes.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading programmes…</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>
                  Restrict major paths to departments offered in this shift.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
                {(departments.data ?? []).map((row) => (
                  <label key={row.departmentId} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => {
                        const items = (departments.data ?? []).map((d) => ({
                          departmentId: d.departmentId,
                          enabled:
                            d.departmentId === row.departmentId ? e.target.checked : d.enabled,
                        }));
                        saveDepartments.mutate(items);
                      }}
                    />
                    <span>
                      {row.code} — {row.name}
                    </span>
                  </label>
                ))}
                {departments.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading departments…</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ['shift-curriculum'] });
              }}
            >
              Refresh
            </Button>
          </div>
        </>
      ) : null}

      {panelTab === 'status' && mode !== 'scope' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Curriculum configuration status</CardTitle>
              <CardDescription>
                Semester pool mappings (MDC, AEC, SEC, VAC/VTC) per shift and programme family. Use
                this before go-live to confirm each semester is fully configured.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {configurationStatus.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading configuration matrix…</p>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-2 py-2 font-medium">Shift</th>
                      <th className="px-2 py-2 font-medium">Programme</th>
                      {[1, 2, 3, 4, 5, 6].map((semester) => (
                        <th key={semester} className="px-2 py-2 text-center font-medium">
                          Sem {semester}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(configurationStatus.data?.rows ?? []).map((row) => (
                      <tr
                        key={`${row.shiftId}-${row.programmeFamily}`}
                        className="border-b border-border/40"
                      >
                        <td className="px-2 py-2">{row.shiftCode}</td>
                        <td className="px-2 py-2">{row.programmeLabel}</td>
                        {[1, 2, 3, 4, 5, 6].map((semester) => (
                          <td key={semester} className="px-2 py-2 text-center">
                            {statusCell(row.semesters[semester] ?? 'pending')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ['shift-curriculum'] });
              }}
            >
              Refresh
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
