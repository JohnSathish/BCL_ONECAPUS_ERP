'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DataTable } from '@/components/erp/data-table';
import { PageTabs } from '@/components/erp/page-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { useRequireAuth } from '@/hooks/use-auth';
import { FyugpStructurePanel } from '@/components/academic-engine/structure/FyugpStructurePanel';
import { CategoryPoolsPanel } from '@/components/academic-engine/category-pools/CategoryPoolsPanel';
import {
  createAcademicEngineOfferingSection,
  createRegistrationWindow,
  fetchAcademicEngineSummary,
  fetchMdcConflicts,
  fetchNepOfferings,
  fetchRegistrationWindows,
  fetchRegistrationAnalytics,
  fetchSeatUtilization,
  fetchShifts,
  promoteWaitlist,
  provisionPoolSections,
  setWindowLocked,
  updateOfferingCapacity,
} from '@/services/academic-engine';
import { fetchAcademicYears } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import type { CourseOfferingRow, SeatUtilizationRow } from '@/types/academic-engine';

type TabId = 'overview' | 'structure' | 'pools' | 'offerings' | 'sections' | 'windows' | 'reports';

export default function AcademicEnginePage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [programVersionId, setProgramVersionId] = useState('');
  const [semFilter, setSemFilter] = useState('1');
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);
  const [windowForm, setWindowForm] = useState({
    semesterId: '',
    name: '',
    opensAt: '',
    closesAt: '',
  });

  const summary = useQuery({
    queryKey: ['academic-engine', 'summary'],
    queryFn: fetchAcademicEngineSummary,
    enabled: Boolean(session),
  });

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });

  const versions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const pvId = programVersionId || versions[0]?.id || '';

  const offerings = useQuery({
    queryKey: ['academic-engine', 'offerings', pvId, semFilter],
    queryFn: () =>
      fetchNepOfferings({
        programVersionId: pvId,
        semesterSequence: Number(semFilter),
      }),
    enabled: Boolean(session) && Boolean(pvId) && (tab === 'offerings' || tab === 'sections'),
  });

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts'],
    queryFn: fetchShifts,
    enabled: Boolean(session) && (tab === 'offerings' || tab === 'sections'),
  });

  const dayShiftId = shifts.data?.find((s) => s.code === 'DAY')?.id ?? shifts.data?.[0]?.id ?? '';

  const provisionMut = useMutation({
    mutationFn: () =>
      provisionPoolSections({
        semesterNo: Number(semFilter),
        categories: ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'],
        shiftCode: 'DAY',
      }),
    onSuccess: (result) => {
      setProvisionMessage(
        `Provisioned ${result.created} new section(s), ${result.skipped} already existed (${result.total} pool offerings).`,
      );
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'offerings'] });
    },
  });

  const addSectionMut = useMutation({
    mutationFn: (offeringId: string) =>
      createAcademicEngineOfferingSection(offeringId, {
        shiftId: dayShiftId,
        sectionCode: 'A',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'offerings'] });
    },
  });

  const poolOfferingsMissingSections = (offerings.data ?? []).filter(
    (o) => o.mappingSource === 'SHARED_POOL' && !(o.sections?.length ?? 0),
  ).length;

  const windows = useQuery({
    queryKey: ['academic-engine', 'windows'],
    queryFn: fetchRegistrationWindows,
    enabled: Boolean(session) && tab === 'windows',
  });

  const utilization = useQuery({
    queryKey: ['academic-engine', 'utilization', pvId],
    queryFn: () => fetchSeatUtilization(pvId),
    enabled: Boolean(session) && Boolean(pvId) && tab === 'reports',
  });

  const regAnalytics = useQuery({
    queryKey: ['academic-engine', 'registration-analytics', pvId],
    queryFn: () => fetchRegistrationAnalytics(pvId),
    enabled: Boolean(session) && Boolean(pvId) && tab === 'reports',
  });

  const mdcReport = useQuery({
    queryKey: ['academic-engine', 'mdc-conflicts'],
    queryFn: fetchMdcConflicts,
    enabled: Boolean(session) && tab === 'reports',
  });

  const lockMut = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => setWindowLocked(id, locked),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academic-engine', 'windows'] }),
  });

  const academicYears = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session) && tab === 'windows',
  });

  const semesterOptions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const y of academicYears.data ?? []) {
      for (const s of y.semesters ?? []) {
        rows.push({ id: s.id, label: `${y.name} — ${s.name} (#${s.sequence})` });
      }
    }
    return rows;
  }, [academicYears.data]);

  const createWindowMut = useMutation({
    mutationFn: () =>
      createRegistrationWindow({
        semesterId: windowForm.semesterId,
        name: windowForm.name,
        opensAt: windowForm.opensAt,
        closesAt: windowForm.closesAt,
      }),
    onSuccess: () => {
      setWindowForm({ semesterId: '', name: '', opensAt: '', closesAt: '' });
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'windows'] });
    },
  });

  const promoteMut = useMutation({
    mutationFn: (lineId: string) => promoteWaitlist(lineId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'utilization'] });
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'summary'] });
    },
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Academic Engine (NEP / FYUGP)">
      <div className="min-w-0 space-y-4">
        <PageTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'structure', label: 'FYUGP structure' },
            { id: 'pools', label: 'Shared category pools' },
            { id: 'offerings', label: 'Offerings' },
            { id: 'sections', label: 'Sections & seats' },
            { id: 'windows', label: 'Registration windows' },
            { id: 'reports', label: 'Reports' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 max-w-xs rounded-md border border-border bg-card px-2 text-sm"
            value={pvId}
            onChange={(e) => setProgramVersionId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {tab === 'offerings' ? (
            <select
              className="h-9 w-28 rounded-md border border-border bg-card px-2 text-sm"
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
            >
              {[1, 2, 3].map((s) => (
                <option key={s} value={String(s)}>
                  Sem {s}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {tab === 'overview' ? (
          <Card>
            <CardHeader>
              <CardTitle>NEP-2020 Academic Intelligence</CardTitle>
              <CardDescription>FYUGP · CBCS · Semesters 1–3 (Phase 1)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Students" value={summary.data?.students} />
              <Stat label="Registrations" value={summary.data?.registrations} />
              <Stat label="Waitlisted lines" value={summary.data?.waitlisted} />
              <Stat label="NEP offerings" value={summary.data?.offerings} />
            </CardContent>
          </Card>
        ) : null}

        {tab === 'structure' ? (
          <FyugpStructurePanel
            programVersionId={pvId}
            enabled={Boolean(session) && Boolean(pvId)}
          />
        ) : null}

        {tab === 'pools' ? <CategoryPoolsPanel /> : null}

        {tab === 'offerings' ? (
          <CompactCard className="min-w-0">
            <CompactCardHeader
              title="Course offerings"
              description="Capacity and delivery sections. Pool courses need at least one section before students can register."
            />
            <CompactCardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:px-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={provisionMut.isPending || !dayShiftId}
                  onClick={() => provisionMut.mutate()}
                >
                  {provisionMut.isPending
                    ? 'Provisioning…'
                    : 'Provision Day · Section A (pool offerings)'}
                </Button>
                {poolOfferingsMissingSections > 0 ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {poolOfferingsMissingSections} pool offering(s) have no sections
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    All visible pool offerings have sections
                  </span>
                )}
              </div>
              {provisionMessage ? (
                <p className="px-3 text-xs text-muted-foreground sm:px-4">{provisionMessage}</p>
              ) : null}
              {provisionMut.error ? (
                <p className="px-3 text-xs text-destructive sm:px-4">
                  {(provisionMut.error as Error).message}
                </p>
              ) : null}
              <DataTable
                rows={offerings.data ?? []}
                getRowKey={(o) => o.id}
                columns={[
                  {
                    key: 'code',
                    header: 'Course',
                    cell: (o: CourseOfferingRow) => (
                      <span className="font-medium">{o.course.code}</span>
                    ),
                  },
                  { key: 'cat', header: 'Cat', cell: (o) => o.category ?? '—' },
                  {
                    key: 'source',
                    header: 'Source',
                    cell: (o: CourseOfferingRow) =>
                      o.mappingSource === 'SHARED_POOL' ? (
                        <span className="text-xs text-primary">
                          Pool{o.poolName ? `: ${o.poolName}` : ''}
                        </span>
                      ) : (
                        'Direct'
                      ),
                  },
                  {
                    key: 'mp',
                    header: 'Paper',
                    cell: (o: CourseOfferingRow) => o.majorPaperIndex ?? '—',
                  },
                  {
                    key: 'cap',
                    header: 'Cap',
                    cell: (o) => (
                      <Input
                        className="h-8 w-16 text-xs"
                        defaultValue={o.capacity}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) {
                            void updateOfferingCapacity(o.id, { capacity: v }).then(() =>
                              qc.invalidateQueries({ queryKey: ['academic-engine', 'offerings'] }),
                            );
                          }
                        }}
                      />
                    ),
                  },
                  {
                    key: 'sections',
                    header: 'Sections',
                    cell: (o) => o.sections?.length ?? 0,
                  },
                  {
                    key: 'action',
                    header: 'Actions',
                    cell: (o: CourseOfferingRow) =>
                      (o.sections?.length ?? 0) > 0 ? (
                        <span className="text-[11px] text-muted-foreground">Ready</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          disabled={!dayShiftId || addSectionMut.isPending}
                          onClick={() => addSectionMut.mutate(o.id)}
                        >
                          Add Day · A
                        </Button>
                      ),
                  },
                ]}
              />
            </CompactCardBody>
          </CompactCard>
        ) : null}

        {tab === 'sections' ? (
          <CompactCard className="min-w-0">
            <CompactCardHeader
              title="Offering sections"
              description="Shift, capacity, and live seat counts. Use Offerings tab to provision or add missing pool sections."
            />
            <CompactCardBody className="p-0 sm:p-0">
              <DataTable
                rows={(offerings.data ?? []).flatMap((o) =>
                  (o.sections ?? []).map((sec) => ({ ...sec, offering: o })),
                )}
                getRowKey={(r) => r.id}
                columns={[
                  {
                    key: 'course',
                    header: 'Course',
                    cell: (r) => <span className="font-medium">{r.offering.course.code}</span>,
                  },
                  { key: 'cat', header: 'Cat', cell: (r) => r.offering.category ?? '—' },
                  { key: 'sec', header: 'Sec', cell: (r) => r.sectionCode },
                  { key: 'shift', header: 'Shift', cell: (r) => r.shift?.code ?? '—' },
                  { key: 'cap', header: 'Cap', cell: (r) => r.capacity },
                  {
                    key: 'used',
                    header: 'Used',
                    cell: (r) => r.seatLedger?.confirmedCount ?? 0,
                  },
                  {
                    key: 'wait',
                    header: 'Wait',
                    cell: (r) => r.seatLedger?.waitlistCount ?? 0,
                  },
                ]}
              />
            </CompactCardBody>
          </CompactCard>
        ) : null}

        {tab === 'windows' ? (
          <div className="space-y-4">
            <CompactCard>
              <CompactCardHeader title="Create registration window" />
              <CompactCardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={windowForm.semesterId}
                    onChange={(e) => setWindowForm((f) => ({ ...f, semesterId: e.target.value }))}
                  >
                    <option value="">Semester</option>
                    {semesterOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Window name"
                    value={windowForm.name}
                    onChange={(e) => setWindowForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <DateTimeInput
                    placeholder="Opens (dd/mm/yyyy hh:mm)"
                    value={windowForm.opensAt}
                    onChange={(opensAt) => setWindowForm((f) => ({ ...f, opensAt }))}
                  />
                  <DateTimeInput
                    placeholder="Closes (dd/mm/yyyy hh:mm)"
                    value={windowForm.closesAt}
                    onChange={(closesAt) => setWindowForm((f) => ({ ...f, closesAt }))}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={
                    createWindowMut.isPending ||
                    !windowForm.semesterId ||
                    !windowForm.name ||
                    !windowForm.opensAt ||
                    !windowForm.closesAt
                  }
                  onClick={() => createWindowMut.mutate()}
                >
                  {createWindowMut.isPending ? 'Creating…' : 'Create window'}
                </Button>
              </CompactCardBody>
            </CompactCard>
            <CompactCard className="min-w-0">
              <CompactCardHeader title="Registration windows" />
              <CompactCardBody className="p-0 sm:p-0">
                <DataTable
                  rows={windows.data ?? []}
                  getRowKey={(w) => w.id}
                  columns={[
                    { key: 'name', header: 'Name', cell: (w) => w.name },
                    {
                      key: 'sem',
                      header: 'Semester',
                      cell: (w) => `${w.semester.name} (#${w.semester.sequence})`,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (w) => (w.locked ? 'Locked' : 'Open'),
                    },
                    {
                      key: 'action',
                      header: 'Action',
                      cell: (w) => (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => lockMut.mutate({ id: w.id, locked: !w.locked })}
                        >
                          {w.locked ? 'Unlock' : 'Lock'}
                        </Button>
                      ),
                    },
                  ]}
                />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}

        {tab === 'reports' ? (
          <div className="grid min-w-0 gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Waitlisted lines" value={regAnalytics.data?.waitlistedLines} />
              {(regAnalytics.data?.funnel ?? []).map((f: { status: string; count: number }) => (
                <Stat key={f.status} label={f.status} value={f.count} />
              ))}
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <CompactCard>
                <CompactCardHeader title="Seat utilization (by section)" />
                <CompactCardBody className="p-0 sm:p-0">
                  <DataTable
                    rows={utilization.data ?? []}
                    getRowKey={(r) => r.sectionId ?? r.offeringId}
                    columns={[
                      {
                        key: 'code',
                        header: 'Course',
                        cell: (r: SeatUtilizationRow) => r.courseCode,
                      },
                      { key: 'shift', header: 'Shift', cell: (r) => r.shift ?? '—' },
                      { key: 'sec', header: 'Sec', cell: (r) => r.sectionCode ?? '—' },
                      { key: 'cat', header: 'Cat', cell: (r) => r.category ?? '—' },
                      {
                        key: 'wait',
                        header: 'Wait',
                        cell: (r: SeatUtilizationRow) => r.waitlisted,
                      },
                      { key: 'pct', header: '%', cell: (r) => `${r.utilizationPct}%` },
                      {
                        key: 'promote',
                        header: 'Promote',
                        cell: (r: SeatUtilizationRow) =>
                          r.firstWaitlistLineId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={promoteMut.isPending}
                              onClick={() => promoteMut.mutate(r.firstWaitlistLineId!)}
                            >
                              Promote
                            </Button>
                          ) : (
                            '—'
                          ),
                      },
                    ]}
                  />
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardHeader title="MDC conflict scan" />
                <CompactCardBody>
                  <p className="text-sm text-muted-foreground">
                    Conflicts found: {mdcReport.data?.total ?? 0}
                  </p>
                </CompactCardBody>
              </CompactCard>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value == null ? '—' : String(value)}</p>
    </div>
  );
}
