'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, FileSpreadsheet, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchAllStaff } from '@/services/staff';
import {
  assignDutyStaff,
  downloadDutyExport,
  fetchDutyRoster,
  fetchDutyRules,
  fetchIaExams,
  publishDutyRoster,
  removeDutyStaff,
  saveDutyRoster,
  saveDutyRules,
  suggestDutyRoster,
  type DutyRoster,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

type Tab = 'hall' | 'department' | 'staff' | 'phone';

export function IaDutyRosterPage() {
  const qc = useQueryClient();
  const exams = useQuery({ queryKey: ['ia-exams'], queryFn: fetchIaExams });
  const [sessionId, setSessionId] = useState('');
  const [tab, setTab] = useState<Tab>('staff');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [message, setMessage] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const activeId = sessionId || exams.data?.[0]?.id || '';
  const roster = useQuery({
    queryKey: ['duty-roster', activeId],
    queryFn: () => fetchDutyRoster(activeId),
    enabled: Boolean(activeId),
  });
  const rules = useQuery({ queryKey: ['duty-rules'], queryFn: fetchDutyRules });
  const staff = useQuery({
    queryKey: ['duty-staff', 'teaching'],
    queryFn: () => fetchAllStaff({ status: 'ACTIVE', activeTeachingOnly: true }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['duty-roster', activeId] });
  const run = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      setMessage('');
      refresh();
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'The roster could not be updated')),
  });

  const view = roster.data;
  const teacher =
    view?.staffSummary.find((row) => row.staffProfileId === selectedStaff) ?? view?.staffSummary[0];
  const teacherDuties = useMemo(() => {
    if (!view || !teacher) return [];
    return view.sittings.flatMap((sitting) =>
      sitting.halls.flatMap((hall) =>
        hall.assignments
          .filter((person) => person.staffProfileId === teacher.staffProfileId)
          .map((person) => ({ sitting, hall, person })),
      ),
    );
  }, [view, teacher]);

  const exportFile = async (kind: 'pdf' | 'xlsx') => {
    if (!activeId) return;
    const blob = await downloadDutyExport(activeId, kind, {
      staffId: tab === 'phone' && teacher ? teacher.staffProfileId : undefined,
    });
    downloadBlob(
      blob,
      kind === 'pdf' ? 'examination-duty-roster.pdf' : 'examination-duty-roster.xlsx',
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-white">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">Examination Duty Roster</h1>
                {view ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {view.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-500">{view?.examName ?? 'Choose an examination'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-xl border px-3 text-sm"
              value={activeId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              {(exams.data ?? []).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="rounded-xl bg-[#2563eb]"
              disabled={!activeId || run.isPending}
              onClick={() =>
                run.mutate(() =>
                  suggestDutyRoster(activeId, view?.status === 'PUBLISHED').catch(async (error) => {
                    if (
                      view?.status === 'PUBLISHED' &&
                      window.confirm('Revise the published roster?')
                    ) {
                      return suggestDutyRoster(activeId, true);
                    }
                    throw error;
                  }),
                )
              }
            >
              <Users className="mr-2 h-4 w-4" />
              Generate Staff Schedules
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void exportFile('pdf')}
            >
              Export PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void exportFile('xlsx')}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['hall', 'Hall-wise Allocation'],
              ['department', 'Department-wise Schedule'],
              ['staff', 'Staff-wise Schedule'],
              ['phone', 'Mobile App Preview'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-full px-3 py-1.5 text-sm',
                tab === id ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-600',
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-sm text-[#2563eb]"
            onClick={() => setRulesOpen((open) => !open)}
          >
            Staffing rules
          </button>
        </div>
      </section>

      {rulesOpen && rules.data ? (
        <RulesCard
          bands={rules.data.bands}
          minimum={rules.data.minimum}
          specialHallExtra={rules.data.specialHallExtra}
          onSave={async (payload) => {
            await saveDutyRules(payload);
            await qc.invalidateQueries({ queryKey: ['duty-rules'] });
          }}
        />
      ) : null}

      {view ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Total Teachers" value={view.summary.teachers} />
          <Stat
            label="Departments"
            value={new Set(view.staffSummary.map((row) => row.department).filter(Boolean)).size}
          />
          <Stat label="Total Duties" value={view.summary.assigned} />
          <Stat label="Unfilled" value={view.summary.unfilled} />
        </div>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {message}
        </p>
      ) : null}
      {view?.warnings.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {view.warnings.join(' · ')}
        </p>
      ) : null}

      {tab === 'hall' && view ? (
        <HallEditor
          key={`${view.id}-${view.revision}`}
          roster={view}
          staff={(staff.data?.data ?? [])
            .filter((row) => row.staffType === 'TEACHING')
            .map((row) => ({
              id: row.id,
              label: `${row.fullName}${row.department ? ` · ${row.department}` : ''}`,
            }))}
          busy={run.isPending}
          onSave={(payload) => run.mutate(() => saveDutyRoster(activeId, payload))}
          onAssign={(hallId, staffProfileId) =>
            run.mutate(() =>
              assignDutyStaff(activeId, {
                hallId,
                staffProfileId,
                acknowledgeRevision: view.status === 'PUBLISHED',
              }).catch(async (error) => {
                const text = apiErrorMessage(error, '');
                if (text && window.confirm(`${text}\n\nAssign anyway?`)) {
                  return assignDutyStaff(activeId, {
                    hallId,
                    staffProfileId,
                    acknowledgeConflict: true,
                    acknowledgeRevision: view.status === 'PUBLISHED',
                  });
                }
                throw error;
              }),
            )
          }
          onRemove={(assignmentId) =>
            run.mutate(() => removeDutyStaff(activeId, assignmentId, view.status === 'PUBLISHED'))
          }
        />
      ) : null}

      {tab === 'department' && view ? (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Teachers</th>
                <th className="px-3 py-2">Total Duties</th>
              </tr>
            </thead>
            <tbody>
              {departmentRows(view).map((row) => (
                <tr key={row.department} className="border-t">
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{row.teachers}</td>
                  <td className="px-3 py-2">{row.duties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === 'staff' && view ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Staff Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Total Duties</th>
                  <th className="px-3 py-2">Dates Assigned</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.staffSummary.map((row) => (
                  <tr
                    key={row.staffProfileId}
                    className={cn(
                      'cursor-pointer border-t',
                      teacher?.staffProfileId === row.staffProfileId && 'bg-sky-50',
                    )}
                    onClick={() => setSelectedStaff(row.staffProfileId)}
                  >
                    <td className="px-3 py-2 font-medium">{row.fullName}</td>
                    <td className="px-3 py-2">{row.department || '—'}</td>
                    <td className="px-3 py-2">{row.totalDuties}</td>
                    <td className="px-3 py-2">{row.dates.join(', ')}</td>
                    <td className="px-3 py-2">{row.sessions.join(', ')}</td>
                    <td className="px-3 py-2 text-emerald-600">{row.status}</td>
                  </tr>
                ))}
                {!view.staffSummary.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                      Generate schedules after the halls and student counts are set.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          <TeacherCard teacher={teacher} duties={teacherDuties} examName={view.examName} />
        </div>
      ) : null}

      {tab === 'phone' && view ? (
        <PhonePreview examName={view.examName} duties={teacherDuties} teacher={teacher?.fullName} />
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!view || run.isPending}
          onClick={() =>
            run.mutate(async () => {
              if (
                view?.warnings.length &&
                !window.confirm(`${view.warnings.join('\n')}\n\nPublish anyway?`)
              ) {
                throw new Error('Publication cancelled');
              }
              return publishDutyRoster(activeId, Boolean(view?.warnings.length));
            })
          }
        >
          Publish roster
        </Button>
      </div>
    </div>
  );
}

function HallEditor({
  roster,
  staff,
  busy,
  onSave,
  onAssign,
  onRemove,
}: {
  roster: DutyRoster;
  staff: { id: string; label: string }[];
  busy: boolean;
  onSave: (payload: unknown) => void;
  onAssign: (hallId: string, staffProfileId: string) => void;
  onRemove: (assignmentId: string) => void;
}) {
  const [draft, setDraft] = useState(roster.sittings);
  return (
    <section className="space-y-3">
      {draft.map((sitting, sittingIndex) => (
        <div key={sitting.id} className="rounded-2xl border bg-white p-3">
          <p className="font-semibold">
            {sitting.date} · {sitting.session} · {sitting.time}
          </p>
          {sitting.halls.map((hall, hallIndex) => (
            <div
              key={hall.id}
              className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-[1fr_120px_120px_1.4fr]"
            >
              <input
                className="h-10 rounded-lg border px-2 text-sm"
                value={hall.hallLabel}
                onChange={(event) =>
                  setDraft((current) =>
                    updateHall(current, sittingIndex, hallIndex, { hallLabel: event.target.value }),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-2 text-sm"
                type="number"
                value={hall.studentCount}
                onChange={(event) =>
                  setDraft((current) =>
                    updateHall(current, sittingIndex, hallIndex, {
                      studentCount: Number(event.target.value),
                    }),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-2 text-sm"
                type="number"
                value={hall.approvedRequired}
                onChange={(event) =>
                  setDraft((current) =>
                    updateHall(current, sittingIndex, hallIndex, {
                      approvedRequired: Number(event.target.value),
                      overrideReason:
                        Number(event.target.value) === hall.calculatedRequired
                          ? null
                          : hall.overrideReason || 'Adjusted by the examination cell',
                    }),
                  )
                }
              />
              <div className="text-sm">
                <p className="text-xs text-slate-500">
                  Calculated {hall.calculatedRequired} · Assigned {hall.assignments.length} ·
                  Unfilled {hall.unfilled}
                </p>
                {hall.assignments.map((person) => (
                  <p key={person.id} className="flex items-center justify-between">
                    {person.fullName}
                    <button
                      type="button"
                      className="text-rose-600"
                      onClick={() => onRemove(person.id)}
                    >
                      Remove
                    </button>
                  </p>
                ))}
                <select
                  className="mt-1 h-9 w-full rounded-lg border px-2 text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) onAssign(hall.id, event.target.value);
                    event.target.value = '';
                  }}
                >
                  <option value="">Add invigilator</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              setDraft((current) =>
                current.map((row, index) =>
                  index === sittingIndex
                    ? {
                        ...row,
                        halls: [
                          ...row.halls,
                          {
                            id: '',
                            classroomId: null,
                            hallLabel: '',
                            studentCount: 0,
                            capacity: null,
                            specialRoom: false,
                            calculatedRequired: 1,
                            approvedRequired: 1,
                            overrideReason: null,
                            unfilled: 1,
                            assignments: [],
                          },
                        ],
                      }
                    : row,
                ),
              )
            }
          >
            Add hall
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={busy}
        onClick={() =>
          onSave({
            acknowledgeRevision: roster.status === 'PUBLISHED',
            instructions: roster.instructions,
            sittings: draft.map((sitting) => ({
              id: sitting.id || undefined,
              examDate: sitting.date,
              sessionLabel: sitting.sessionLabel,
              startTime: sitting.startTime,
              endTime: sitting.endTime,
              reportingTime: sitting.reportingTime,
              halls: sitting.halls.map((hall) => ({
                id: hall.id || undefined,
                classroomId: hall.classroomId,
                hallLabel: hall.hallLabel,
                studentCount: hall.studentCount,
                capacity: hall.capacity,
                specialRoom: hall.specialRoom,
                approvedRequired: hall.approvedRequired,
                overrideReason: hall.overrideReason,
              })),
            })),
          })
        }
      >
        Save halls
      </Button>
    </section>
  );
}

function updateHall(
  sittings: DutyRoster['sittings'],
  sittingIndex: number,
  hallIndex: number,
  patch: Partial<DutyRoster['sittings'][number]['halls'][number]>,
) {
  return sittings.map((sitting, index) =>
    index === sittingIndex
      ? {
          ...sitting,
          halls: sitting.halls.map((hall, inner) =>
            inner === hallIndex ? { ...hall, ...patch } : hall,
          ),
        }
      : sitting,
  );
}

function TeacherCard({
  teacher,
  duties,
  examName,
}: {
  teacher?: DutyRoster['staffSummary'][number];
  duties: Array<{
    sitting: DutyRoster['sittings'][number];
    hall: DutyRoster['sittings'][number]['halls'][number];
  }>;
  examName: string;
}) {
  if (!teacher)
    return (
      <section className="rounded-2xl border bg-white p-4 text-sm text-slate-400">
        Select a teacher.
      </section>
    );
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold">{teacher.fullName}</h2>
      <p className="text-sm text-slate-500">
        {teacher.department || 'Department'} · {teacher.totalDuties} duties · {examName}
      </p>
      <div className="mt-3 space-y-2">
        {duties.map((duty) => (
          <div key={duty.hall.id + duty.sitting.id} className="rounded-xl border px-3 py-2 text-sm">
            <p className="font-medium">
              {duty.sitting.date} · {duty.sitting.session}
            </p>
            <p className="text-slate-500">
              Hall {duty.hall.hallLabel} · {duty.sitting.time}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhonePreview({
  examName,
  teacher,
  duties,
}: {
  examName: string;
  teacher?: string;
  duties: Array<{
    sitting: DutyRoster['sittings'][number];
    hall: DutyRoster['sittings'][number]['halls'][number];
  }>;
}) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-[2rem] border bg-slate-900 p-3 text-white shadow-xl">
      <div className="rounded-[1.5rem] bg-[#0f3c89] p-4">
        <p className="text-xs opacity-80">Don Bosco College Tura</p>
        <h2 className="text-lg font-semibold">My Exam Duties</h2>
        <p className="text-sm opacity-80">{examName}</p>
        <p className="mt-2 text-sm">{teacher ?? 'Select a teacher on the staff tab'}</p>
        <p className="mt-1 text-xs opacity-70">Teachers see only published duties.</p>
      </div>
      <div className="space-y-2 bg-white p-3 text-slate-900">
        {duties.map((duty) => (
          <div key={`${duty.sitting.id}-${duty.hall.id}`} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">{duty.sitting.date}</p>
            <p>{duty.sitting.session}</p>
            <p>Hall {duty.hall.hallLabel}</p>
            <p className="text-slate-500">
              Reporting {duty.sitting.reportingTime || duty.sitting.startTime}
            </p>
          </div>
        ))}
        {!duties.length ? (
          <p className="text-sm text-slate-400">No published duties for this teacher.</p>
        ) : null}
      </div>
    </div>
  );
}

function RulesCard({
  bands,
  minimum,
  specialHallExtra,
  onSave,
}: {
  bands: { upTo: number; invigilators: number }[];
  minimum: number;
  specialHallExtra: number;
  onSave: (payload: {
    bands: { upTo: number; invigilators: number }[];
    minimum: number;
    specialHallExtra: number;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ bands, minimum, specialHallExtra });
  return (
    <section className="rounded-2xl border bg-white p-4 text-sm">
      <h2 className="font-semibold">Staffing rules</h2>
      <p className="text-slate-500">
        Each band is the student count that needs that many invigilators.
      </p>
      <div className="mt-3 space-y-2">
        {draft.bands.map((band, index) => (
          <div key={index} className="flex gap-2">
            <input
              className="h-9 w-28 rounded-lg border px-2"
              type="number"
              value={band.upTo}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bands: current.bands.map((row, inner) =>
                    inner === index ? { ...row, upTo: Number(event.target.value) } : row,
                  ),
                }))
              }
            />
            <input
              className="h-9 w-28 rounded-lg border px-2"
              type="number"
              value={band.invigilators}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bands: current.bands.map((row, inner) =>
                    inner === index ? { ...row, invigilators: Number(event.target.value) } : row,
                  ),
                }))
              }
            />
          </div>
        ))}
      </div>
      <Button type="button" className="mt-3" onClick={() => void onSave(draft)}>
        Save rules
      </Button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function departmentRows(roster: DutyRoster) {
  const map = new Map<string, { teachers: Set<string>; duties: number }>();
  for (const person of roster.staffSummary) {
    const key = person.department || 'Unassigned';
    const row = map.get(key) ?? { teachers: new Set<string>(), duties: 0 };
    row.teachers.add(person.staffProfileId);
    row.duties += person.totalDuties;
    map.set(key, row);
  }
  return [...map.entries()].map(([department, row]) => ({
    department,
    teachers: row.teachers.size,
    duties: row.duties,
  }));
}
