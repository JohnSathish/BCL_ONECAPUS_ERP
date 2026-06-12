'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  TimetableApprovalPanel,
  TimetableConflictPanel,
  TimetableCyclePanel,
  TimetableFilterBar,
  TimetableGenerationPanel,
  TimetableMatrixGrid,
  TimetableStudioShell,
} from '@/components/timetable/timetable-components';
import { TimetableImportExportPanel } from '@/components/timetable/timetable-import-export-panel';
import { TimetableSettingsPanel } from '@/components/timetable/timetable-settings-panel';
import {
  TimetableSlotModal,
  type SlotModalContext,
} from '@/components/timetable/timetable-slot-modal';
import { StreamMasterRoutineView } from '@/components/timetable/stream-master-routine';
import { ErpWorkspaceGrid } from '@/components/erp/erp-workspace-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  approveTimetablePlan,
  copyDaySchedule,
  copySemesterSchedule,
  createManualEntry,
  createManualTimetablePlan,
  deleteTimetableEntry,
  deleteTimetablePlan,
  fetchStreamMasterRoutine,
  fetchTimetableContext,
  fetchTimetableDashboard,
  fetchTimetableMatrix,
  fetchTimetablePlans,
  generateTimetablePlan,
  publishTimetablePlan,
  submitTimetablePlan,
  updateTimetableEntry,
  validateTimetablePlan,
  type ManualEntryPayload,
  type TimetableConflictSummary,
  type TimetableEntry,
  type TimetablePlan,
} from '@/services/timetable';
import { cn } from '@/utils/cn';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import type { TimetablePrintParams } from '@/lib/timetable/open-timetable-print';

const TABS = [
  { id: 'manual', label: 'Manual Entry' },
  { id: 'import', label: 'Import / Export' },
  { id: 'matrix', label: 'Matrix View' },
  { id: 'faculty', label: 'Faculty View' },
  { id: 'room', label: 'Room View' },
  { id: 'reports', label: 'Reports' },
  { id: 'publish', label: 'Publish' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function TimetableManualWorkspace() {
  const qc = useQueryClient();
  const session = useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const [tab, setTab] = useState<TabId>('manual');
  const [shiftId, setShiftId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [validation, setValidation] = useState<TimetableConflictSummary>();
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotContext, setSlotContext] = useState<SlotModalContext>();
  const [editEntry, setEditEntry] = useState<TimetableEntry | null>(null);
  const [facultyFilter, setFacultyFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<number | ''>('');

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });
  const dashboardQ = useQuery({
    queryKey: ['timetable', 'dashboard'],
    queryFn: fetchTimetableDashboard,
    enabled: authReady,
  });

  useEffect(() => {
    if (contextQ.data?.currentAcademicMode) {
      setSemesterMode(contextQ.data.currentAcademicMode);
    }
  }, [contextQ.data?.currentAcademicMode]);
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', shiftId, streamId, semesterMode],
    queryFn: () =>
      fetchTimetablePlans({
        shiftId: shiftId || undefined,
        streamId: streamId || undefined,
        semesterMode,
      }),
    enabled: authReady,
  });
  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data]);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId),
    [plans, selectedPlanId],
  );
  const matrixQ = useQuery({
    queryKey: ['timetable', 'matrix', selectedPlanId, facultyFilter, roomFilter, semesterFilter],
    queryFn: () =>
      fetchTimetableMatrix(selectedPlanId, {
        staffProfileId: facultyFilter || undefined,
        classroomId: roomFilter || undefined,
        semesterSequence: semesterFilter ? Number(semesterFilter) : undefined,
      }),
    enabled: authReady && Boolean(selectedPlanId),
  });
  const streamMasterQ = useQuery({
    queryKey: ['timetable', 'stream-master', selectedPlanId],
    queryFn: () => fetchStreamMasterRoutine(selectedPlanId),
    enabled: authReady && Boolean(selectedPlanId) && tab === 'reports',
  });

  const allowedSemesters =
    contextQ.data?.allowedSemesters ?? (semesterMode === 'ODD' ? [1, 3, 5] : [2, 4, 6]);

  const printOptions = useMemo((): TimetablePrintParams | undefined => {
    if (!selectedPlanId) return undefined;
    return {
      planId: selectedPlanId,
      semesterSequence: semesterFilter ? Number(semesterFilter) : undefined,
      staffProfileId: facultyFilter || undefined,
      classroomId: roomFilter || undefined,
    };
  }, [selectedPlanId, semesterFilter, facultyFilter, roomFilter]);

  const invalidate = async () => qc.invalidateQueries({ queryKey: ['timetable'] });

  const createManualMut = useMutation({
    mutationFn: () => {
      const streamName =
        contextQ.data?.streams.find((stream) => stream.id === streamId)?.name ?? 'All Streams';
      const shiftName =
        contextQ.data?.shifts.find((shift) => shift.id === shiftId)?.name ?? 'Day Shift';
      return createManualTimetablePlan({
        name: `${streamName} · ${shiftName} · ${semesterMode} · Weekly Routine`,
        shiftId: shiftId || undefined,
        streamId: streamId || undefined,
        semesterMode,
        academicYearId: academicYearId || undefined,
      });
    },
    onSuccess: async (plan: TimetablePlan) => {
      setSelectedPlanId(plan.id);
      await invalidate();
    },
  });

  const generateMut = useMutation({
    mutationFn: () => generateTimetablePlan(selectedPlanId),
    onSuccess: invalidate,
  });

  const validateMut = useMutation({
    mutationFn: () => validateTimetablePlan(selectedPlanId),
    onSuccess: (result) => setValidation(result),
  });

  const submitMut = useMutation({
    mutationFn: () => submitTimetablePlan(selectedPlanId),
    onSuccess: invalidate,
  });

  const approveMut = useMutation({
    mutationFn: (payload?: { acknowledgeWarnings?: boolean; overrideReason?: string }) =>
      approveTimetablePlan(selectedPlanId, payload),
    onSuccess: invalidate,
  });

  const publishMut = useMutation({
    mutationFn: (payload?: { acknowledgeWarnings?: boolean; overrideReason?: string }) =>
      publishTimetablePlan(selectedPlanId, payload),
    onSuccess: invalidate,
  });

  const deletePlanMut = useMutation({
    mutationFn: (planId: string) => deleteTimetablePlan(planId),
    onSuccess: async () => {
      setSelectedPlanId('');
      await invalidate();
    },
  });

  const saveSlotMut = useMutation({
    mutationFn: (payload: ManualEntryPayload) =>
      editEntry ? updateTimetableEntry(editEntry.id, payload) : createManualEntry(payload),
    onSuccess: async () => {
      setSlotOpen(false);
      setEditEntry(null);
      await invalidate();
    },
  });

  const deleteSlotMut = useMutation({
    mutationFn: (entryId: string) => deleteTimetableEntry(entryId),
    onSuccess: async () => {
      setSlotOpen(false);
      setEditEntry(null);
      await invalidate();
    },
  });

  const copyDayMut = useMutation({
    mutationFn: (payload: { sourceDay: number; targetDay: number }) =>
      copyDaySchedule(selectedPlanId, payload),
    onSuccess: invalidate,
  });

  const copySemesterMut = useMutation({
    mutationFn: (payload: { sourceSemester: number; targetSemester: number }) =>
      copySemesterSchedule(selectedPlanId, payload),
    onSuccess: invalidate,
  });

  const busy =
    createManualMut.isPending ||
    generateMut.isPending ||
    validateMut.isPending ||
    submitMut.isPending ||
    approveMut.isPending ||
    publishMut.isPending ||
    saveSlotMut.isPending ||
    deleteSlotMut.isPending ||
    copyDayMut.isPending ||
    copySemesterMut.isPending;

  const openCreateSlot = (args: {
    dayOfWeek: number;
    periodNo?: number | null;
    startTime: string;
    endTime: string;
    slotTemplateId?: string;
  }) => {
    if (!selectedPlanId) return;
    setEditEntry(null);
    setSlotContext({
      planId: selectedPlanId,
      allowedSemesters,
      dayOfWeek: args.dayOfWeek,
      periodNo: args.periodNo ?? undefined,
      startTime: args.startTime,
      endTime: args.endTime,
      slotTemplateId: args.slotTemplateId,
      defaultSemester: semesterFilter ? Number(semesterFilter) : allowedSemesters[0],
    });
    setSlotOpen(true);
  };

  const openEditSlot = (entry: TimetableEntry) => {
    if (!selectedPlanId) return;
    setEditEntry(entry);
    setSlotContext({
      planId: selectedPlanId,
      dayOfWeek: entry.dayOfWeek,
      periodNo: entry.periodNo ?? undefined,
      startTime: entry.startTime,
      endTime: entry.endTime,
      allowedSemesters,
    });
    setSlotOpen(true);
  };

  const matrixEditable = tab === 'manual' || tab === 'matrix';

  if (!session) return null;

  return (
    <>
      <TimetableStudioShell
        title="Manual & Excel Timetable Workspace"
        description="Build FYUGP routines manually or via Excel. Auto-generation is optional under Advanced."
      >
        <TimetableFilterBar
          shiftId={shiftId}
          setShiftId={setShiftId}
          streamId={streamId}
          setStreamId={setStreamId}
          semesterMode={semesterMode}
          setSemesterMode={setSemesterMode}
          academicYearId={academicYearId}
          setAcademicYearId={setAcademicYearId}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={setSelectedPlanId}
          plans={plans}
          context={contextQ.data}
          onDeletePlan={(planId) => deletePlanMut.mutate(planId)}
          deleteBusy={deletePlanMut.isPending}
        />
        <TimetableCyclePanel context={contextQ.data} dashboard={dashboardQ.data} />

        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'rounded-full border px-4 py-2 text-sm',
                tab === item.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'manual' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Manual Slot Builder</CardTitle>
                  <Button size="sm" disabled={busy} onClick={() => createManualMut.mutate()}>
                    New Manual Timetable
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-foreground">
                    <p className="font-semibold">One plan = full weekly routine for this cycle</p>
                    <p className="mt-1">
                      ODD mode covers semesters <strong>1, 3, 5</strong>. EVEN mode covers{' '}
                      <strong>2, 4, 6</strong>. This is not a single-day timetable — it repeats
                      every week for the whole semester period until you publish a new plan.
                    </p>
                    <p className="mt-2">
                      Build semester 1 first, then use <strong>Copy Semester</strong> to clone to 3
                      and 5. Or use Import / Export to fill all semesters from Excel.
                    </p>
                  </div>
                  <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                    View / edit semester
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                      value={semesterFilter}
                      onChange={(event) =>
                        setSemesterFilter(event.target.value ? Number(event.target.value) : '')
                      }
                    >
                      <option value="">All active semesters (1, 3, 5 or 2, 4, 6)</option>
                      {allowedSemesters.map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem} only
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Click any empty cell to add a slot for the selected semester. Each slot stores
                    day + period + semester + section.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!selectedPlanId || copyDayMut.isPending}
                      onClick={() => copyDayMut.mutate({ sourceDay: 1, targetDay: 2 })}
                    >
                      Copy Mon → Tue
                    </Button>
                    {allowedSemesters.length > 1 ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedPlanId || copySemesterMut.isPending}
                          onClick={() =>
                            copySemesterMut.mutate({
                              sourceSemester: allowedSemesters[0],
                              targetSemester: allowedSemesters[1],
                            })
                          }
                        >
                          Copy Sem {allowedSemesters[0]} → {allowedSemesters[1]}
                        </Button>
                        {allowedSemesters[2] ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!selectedPlanId || copySemesterMut.isPending}
                            onClick={() =>
                              copySemesterMut.mutate({
                                sourceSemester: allowedSemesters[0],
                                targetSemester: allowedSemesters[2],
                              })
                            }
                          >
                            Copy Sem {allowedSemesters[0]} → {allowedSemesters[2]}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              <TimetableMatrixGrid
                matrix={matrixQ.data}
                editable={matrixEditable}
                printOptions={printOptions}
                onCellClick={openCreateSlot}
                onEntryClick={openEditSlot}
              />
            </div>
            <div className="space-y-4">
              <TimetableConflictPanel validation={validation} />
            </div>
          </div>
        ) : null}

        {tab === 'import' ? (
          <TimetableImportExportPanel planId={selectedPlanId} onCommitted={invalidate} />
        ) : null}

        {tab === 'matrix' ? (
          <TimetableMatrixGrid
            matrix={matrixQ.data}
            editable
            printOptions={printOptions}
            onCellClick={openCreateSlot}
            onEntryClick={openEditSlot}
          />
        ) : null}

        {tab === 'faculty' ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Filter by faculty (staff profile ID)
                  <input
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={facultyFilter}
                    onChange={(event) => setFacultyFilter(event.target.value)}
                    placeholder="Paste staff profile ID"
                  />
                </label>
              </CardContent>
            </Card>
            <TimetableMatrixGrid matrix={matrixQ.data} printOptions={printOptions} />
          </div>
        ) : null}

        {tab === 'room' ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Filter by room (classroom ID)
                  <input
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={roomFilter}
                    onChange={(event) => setRoomFilter(event.target.value)}
                    placeholder="Paste classroom ID"
                  />
                </label>
              </CardContent>
            </Card>
            <TimetableMatrixGrid matrix={matrixQ.data} printOptions={printOptions} />
          </div>
        ) : null}

        {tab === 'reports' ? <StreamMasterRoutineView routine={streamMasterQ.data} /> : null}

        {tab === 'publish' ? (
          <ErpWorkspaceGrid
            main={<TimetableMatrixGrid matrix={matrixQ.data} printOptions={printOptions} />}
            sidebar={
              <div className="space-y-4">
                <TimetableApprovalPanel
                  plan={selectedPlan}
                  busy={busy}
                  validation={validation}
                  onValidate={() => selectedPlanId && validateMut.mutate()}
                  onSubmit={() => selectedPlanId && submitMut.mutate()}
                  onApprove={(payload) => selectedPlanId && approveMut.mutate(payload)}
                  onPublish={(payload) => selectedPlanId && publishMut.mutate(payload)}
                />
                <TimetableConflictPanel validation={validation} />
              </div>
            }
          />
        ) : null}

        {tab === 'advanced' ? (
          <div className="space-y-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-sm">
                Optional — for institutions wanting automated placement. Manual and Excel workflows
                are recommended for production use.
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <TimetableGenerationPanel
                busy={busy}
                onCreate={(name) => createManualMut.mutate()}
                onGenerate={() => selectedPlanId && generateMut.mutate()}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Teaching Allocation Reference</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Use teaching allocation as a reference when assigning faculty to manual slots.
                  </p>
                  <Link
                    href="/admin/academics/teaching-allocation"
                    className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                  >
                    Open Teaching Allocation
                  </Link>
                </CardContent>
              </Card>
            </div>
            <TimetableSettingsPanel planId={selectedPlanId} />
          </div>
        ) : null}
      </TimetableStudioShell>

      <TimetableSlotModal
        open={slotOpen}
        onClose={() => {
          setSlotOpen(false);
          setEditEntry(null);
        }}
        context={slotContext}
        entry={editEntry}
        busy={saveSlotMut.isPending || deleteSlotMut.isPending}
        onSave={(payload) => saveSlotMut.mutate(payload)}
        onDelete={(entryId) => deleteSlotMut.mutate(entryId)}
      />
    </>
  );
}
