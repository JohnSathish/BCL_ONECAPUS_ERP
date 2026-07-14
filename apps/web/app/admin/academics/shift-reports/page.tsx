'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Clock3, DoorOpen, Users } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody } from '@/components/erp/compact-card';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useWorkspaceBoundShiftState } from '@/hooks/use-workspace-bound-shift-state';
import { api } from '@/services/api';

type ShiftOpsReport = {
  shift: { id: string; code: string; name: string } | null;
  facultyWorkload: Array<{
    staffProfileId: string;
    fullName: string;
    employeeCode: string;
    shortCode: string | null;
    department: string | null;
    mappedHoursPerWeek: number | null;
    scheduledWeeklyHours: number;
    scheduledSlots: number;
  }>;
  subjectAllocation: Array<{
    id: string;
    staffName: string;
    courseCode: string | null;
    courseTitle: string | null;
    sectionCode: string | null;
    department: string | null;
    weeklyHours: number | null;
  }>;
  timetableCoverage: {
    plans: number;
    publishedPlans: number;
    draftPlans: number;
    scheduledSlots: number;
    activeSections: number;
  } | null;
  classroomUtilization: Array<{
    classroomId: string;
    code: string;
    name: string;
    scheduledSlots: number;
    scheduledHours: number;
  }>;
  teachingHours: {
    totalScheduledHours: number;
    totalSlots: number;
    uniqueFaculty: number;
    averageHoursPerFaculty: number;
  } | null;
  departmentStaff: Array<{
    departmentName: string;
    total: number;
    teaching: number;
  }>;
};

async function fetchShiftOpsReport(shiftId?: string) {
  const { data } = await api.get<ShiftOpsReport>('/v1/reports/shift-operations', {
    params: shiftId ? { shiftId } : undefined,
  });
  return data;
}

export default function ShiftReportsPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const { effectiveShiftId, workspaceShiftLabel } = useWorkspaceBoundShiftState();

  const reportQ = useQuery({
    queryKey: ['reports', 'shift-operations', effectiveShiftId],
    queryFn: () => fetchShiftOpsReport(effectiveShiftId || undefined),
    enabled: authReady,
    staleTime: 60_000,
  });

  const report = reportQ.data;
  const teaching = report?.teachingHours;

  return (
    <DashboardShell role="admin" title="Shift Reports">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Shift analytics
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {workspaceShiftLabel ?? report?.shift?.name ?? 'Shift'} reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Workload, subject allocation, timetable coverage, classroom utilization, and department
            staff for the active shift workspace (Option A).
          </p>
        </section>

        {reportQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading shift reports…</p>
        ) : reportQ.isError ? (
          <p className="text-sm text-destructive">Unable to load shift reports.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Clock3}
                label="Teaching hours"
                value={teaching?.totalScheduledHours ?? 0}
              />
              <Metric icon={Users} label="Faculty teaching" value={teaching?.uniqueFaculty ?? 0} />
              <Metric
                icon={BarChart3}
                label="Timetable slots"
                value={report?.timetableCoverage?.scheduledSlots ?? 0}
              />
              <Metric
                icon={DoorOpen}
                label="Rooms used"
                value={report?.classroomUtilization?.length ?? 0}
              />
            </div>

            <CompactCard>
              <CompactCardBody className="space-y-3">
                <h2 className="text-sm font-semibold">Faculty workload</h2>
                <div className="overflow-auto rounded-xl border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Faculty</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Mapped hrs</th>
                        <th className="px-3 py-2">Scheduled hrs</th>
                        <th className="px-3 py-2">Slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report?.facultyWorkload ?? []).map((row) => (
                        <tr key={row.staffProfileId} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{row.fullName}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.shortCode ?? row.employeeCode}
                            </div>
                          </td>
                          <td className="px-3 py-2">{row.department ?? '—'}</td>
                          <td className="px-3 py-2">{row.mappedHoursPerWeek ?? '—'}</td>
                          <td className="px-3 py-2">{row.scheduledWeeklyHours}</td>
                          <td className="px-3 py-2">{row.scheduledSlots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report?.facultyWorkload?.length ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No faculty mapped to this shift yet.
                    </p>
                  ) : null}
                </div>
              </CompactCardBody>
            </CompactCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <CompactCard>
                <CompactCardBody className="space-y-3">
                  <h2 className="text-sm font-semibold">Department staff allocation</h2>
                  <ul className="divide-y rounded-xl border">
                    {(report?.departmentStaff ?? []).map((row) => (
                      <li
                        key={row.departmentName}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>{row.departmentName}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {row.teaching}/{row.total} teaching
                        </span>
                      </li>
                    ))}
                    {!report?.departmentStaff?.length ? (
                      <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No department breakdown.
                      </li>
                    ) : null}
                  </ul>
                </CompactCardBody>
              </CompactCard>

              <CompactCard>
                <CompactCardBody className="space-y-3">
                  <h2 className="text-sm font-semibold">Classroom utilization</h2>
                  <ul className="divide-y rounded-xl border">
                    {(report?.classroomUtilization ?? []).slice(0, 12).map((row) => (
                      <li
                        key={row.classroomId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>
                          {row.code} · {row.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {row.scheduledHours}h · {row.scheduledSlots} slots
                        </span>
                      </li>
                    ))}
                    {!report?.classroomUtilization?.length ? (
                      <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No classroom usage in published/draft plans.
                      </li>
                    ) : null}
                  </ul>
                </CompactCardBody>
              </CompactCard>
            </div>

            <CompactCard>
              <CompactCardBody className="space-y-3">
                <h2 className="text-sm font-semibold">Subject allocation</h2>
                <div className="overflow-auto rounded-xl border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Faculty</th>
                        <th className="px-3 py-2">Course</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report?.subjectAllocation ?? []).slice(0, 100).map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">{row.staffName}</td>
                          <td className="px-3 py-2">
                            {row.courseCode ?? '—'}
                            {row.courseTitle ? ` · ${row.courseTitle}` : ''}
                          </td>
                          <td className="px-3 py-2">{row.sectionCode ?? '—'}</td>
                          <td className="px-3 py-2">{row.weeklyHours ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CompactCardBody>
            </CompactCard>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <CompactCard>
      <CompactCardBody className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value.toLocaleString('en-IN')}</p>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}
