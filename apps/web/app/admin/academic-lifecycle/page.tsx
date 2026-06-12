'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BatchProgressionTable } from '@/components/academic-lifecycle/batch-progression-table';
import { CycleRolloverWizard } from '@/components/academic-lifecycle/cycle-rollover-wizard';
import { LifecycleActionsPanel } from '@/components/academic-lifecycle/lifecycle-actions-panel';
import { LifecycleDashboardCards } from '@/components/academic-lifecycle/lifecycle-dashboard-cards';
import { PromotionLogsTable } from '@/components/academic-lifecycle/promotion-logs-table';
import { SemesterLifecycleTable } from '@/components/academic-lifecycle/semester-lifecycle-table';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  activateEvenCycle,
  activateOddCycle,
  applyCycleRollover,
  createAcademicSession,
  createAdmissionBatch,
  fetchAcademicStructure,
  fetchCycleDashboard,
  fetchPromotionLogs,
  freezeSemester,
  listAcademicSessions,
  previewCycleRollover,
  provisionFyugp,
  rollbackCycleRollover,
} from '@/services/academic-lifecycle';
import { fetchCampuses, fetchInstitutions } from '@/services/organization';
import { fetchShifts } from '@/services/shifts';
import { toShiftOptions } from '@/lib/shift-options';
import { apiErrorMessage } from '@/utils/api-error';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export default function AdminAcademicLifecyclePage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [institutionId, setInstitutionId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [message, setMessage] = useState('');

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });

  const campuses = useQuery({
    queryKey: ['org', 'campuses'],
    queryFn: () => fetchCampuses(),
    enabled: Boolean(session),
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId || 'all', 'ACTIVE'],
    queryFn: () =>
      fetchShifts({
        status: 'ACTIVE',
        ...(campusId ? { campusId } : {}),
      }),
    enabled: Boolean(session),
  });

  const shiftOptions = useMemo(
    () => toShiftOptions(shifts.data ?? [], { dedupeByCode: !campusId }),
    [shifts.data, campusId],
  );

  const dashboard = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId],
    queryFn: () => fetchCycleDashboard(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const structure = useQuery({
    queryKey: ['academic-lifecycle', 'structure', institutionId],
    queryFn: () => fetchAcademicStructure(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const sessions = useQuery({
    queryKey: ['academic-lifecycle', 'sessions', institutionId],
    queryFn: () => listAcademicSessions(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const rolloverPreview = useQuery({
    queryKey: ['academic-lifecycle', 'rollover-preview', institutionId],
    queryFn: () => previewCycleRollover(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const promotionLogs = useQuery({
    queryKey: ['academic-lifecycle', 'promotion-logs', institutionId],
    queryFn: () => fetchPromotionLogs(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const canManage = useMemo(() => session?.user.roles.includes('college-admin'), [session]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['academic-lifecycle'] });
  };

  const scopePayload = {
    campusId: campusId || undefined,
    shiftId: shiftId || undefined,
  };

  const oddMut = useMutation({
    mutationFn: () => activateOddCycle(institutionId, scopePayload),
    onSuccess: () => {
      setMessage('ODD cycle activated (Sem 1, 3, 5).');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Activation failed')),
  });

  const evenMut = useMutation({
    mutationFn: () => activateEvenCycle(institutionId, scopePayload),
    onSuccess: () => {
      setMessage('EVEN cycle activated (Sem 2, 4, 6).');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Activation failed')),
  });

  const provisionMut = useMutation({
    mutationFn: () => provisionFyugp(institutionId, '2026-27'),
    onSuccess: () => {
      setMessage('FYUGP calendar provisioned (6 semesters only).');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Provision failed')),
  });

  const freezeMut = useMutation({
    mutationFn: freezeSemester,
    onSuccess: () => {
      setMessage('Semester frozen.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Freeze failed')),
  });

  const sessionMut = useMutation({
    mutationFn: (payload: { name: string; startDate: string; endDate: string }) =>
      createAcademicSession(institutionId, payload),
    onSuccess: () => {
      setMessage('Academic session created.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create session')),
  });

  const batchMut = useMutation({
    mutationFn: (payload: {
      batchCode: string;
      admissionYear: number;
      entrySessionId: string;
      currentSemester: number;
    }) => createAdmissionBatch(institutionId, payload),
    onSuccess: () => {
      setMessage('Admission batch created.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create batch')),
  });

  const rolloverApplyMut = useMutation({
    mutationFn: () => applyCycleRollover(institutionId, scopePayload),
    onSuccess: () => {
      setMessage('Cycle rollover applied — batches promoted and cycle switched.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Rollover failed')),
  });

  const rolloverRollbackMut = useMutation({
    mutationFn: () => rollbackCycleRollover(institutionId),
    onSuccess: () => {
      setMessage('Last cycle rollover rolled back.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Rollback failed')),
  });

  if (!session) return null;

  const semesterRows =
    dashboard.data?.semesterLifecycle.map((s) => ({
      id: s.id,
      label: `Sem ${s.semesterNumber} (${s.cycle})`,
      frozen: s.frozen,
    })) ?? [];

  const sessionOptions =
    (sessions.data as { id: string; name: string }[] | undefined) ??
    structure.data?.years.map((y) => ({ id: y.id, name: y.name })) ??
    [];

  return (
    <DashboardShell role="admin" title="Academic Sessions & Semester Lifecycle">
      <div className="space-y-6">
        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Institution scope</CardTitle>
            <CardDescription>
              Optional campus/shift scope for cycle activation and rollover.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm">
              Institution
              <select
                className={selectClass}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                <option value="">Select</option>
                {(institutions.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Campus
              <select
                className={selectClass}
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
              >
                <option value="">All</option>
                {(campuses.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Shift
              <select
                className={selectClass}
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">All</option>
                {shiftOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <LifecycleActionsPanel
            canManage={Boolean(canManage)}
            sessions={sessionOptions}
            campusId={campusId}
            shiftId={shiftId}
            semesterRows={semesterRows}
            pending={{
              odd: oddMut.isPending,
              even: evenMut.isPending,
              provision: provisionMut.isPending,
              freeze: freezeMut.isPending,
            }}
            onActivateOdd={() => oddMut.mutate()}
            onActivateEven={() => evenMut.mutate()}
            onProvision={() => provisionMut.mutate()}
            onFreezeSemester={(id) => freezeMut.mutate(id)}
            onCreateSession={(p) => sessionMut.mutate(p)}
            onCreateBatch={(p) => batchMut.mutate(p)}
          />

          <div className="space-y-6">
            <LifecycleDashboardCards dashboard={dashboard.data} loading={dashboard.isLoading} />

            <SemesterLifecycleTable rows={dashboard.data?.semesterLifecycle ?? []} />

            <BatchProgressionTable rows={dashboard.data?.batchProgression ?? []} />

            <CycleRolloverWizard
              preview={rolloverPreview.data}
              loading={rolloverPreview.isLoading}
              applying={rolloverApplyMut.isPending}
              rollingBack={rolloverRollbackMut.isPending}
              canManage={Boolean(canManage)}
              onApply={() => rolloverApplyMut.mutate()}
              onRollback={() => rolloverRollbackMut.mutate()}
            />

            <PromotionLogsTable rows={promotionLogs.data ?? []} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
