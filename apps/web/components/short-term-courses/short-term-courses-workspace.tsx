'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Award,
  BookOpen,
  CalendarClock,
  ClipboardList,
  IndianRupee,
  Pencil,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/utils/api-error';
import {
  money,
  StcEmptyState,
  StcHero,
  StcKpiCard,
  StcPanel,
  StcStatusBadge,
  StcStatusBar,
  STC_TAB_META,
  type StcTabId,
} from '@/components/short-term-courses/stc-shared';
import {
  assignStcStaff,
  createStcAssessment,
  createStcBatch,
  createStcCourse,
  createStcMaterial,
  createStcSession,
  fetchStcBatch,
  fetchStcBatches,
  fetchStcCourses,
  fetchStcDashboard,
  fetchStcEnrollments,
  issueStcCertificate,
  markStcAttendance,
  publishStcCourse,
  seedStcDemoCourses,
  updateStcCourse,
} from '@/services/short-term-courses';

const TABS = STC_TAB_META.map((t) => t.id);
type Tab = StcTabId;

export function ShortTermCoursesWorkspace() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get('tab') ?? 'dashboard') as Tab;
  const tab = TABS.includes(tabParam) ? tabParam : 'dashboard';
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  const dashQ = useQuery({
    queryKey: ['stc', 'dashboard'],
    queryFn: fetchStcDashboard,
  });
  const coursesQ = useQuery({
    queryKey: ['stc', 'courses'],
    queryFn: () => fetchStcCourses(),
  });
  const batchesQ = useQuery({
    queryKey: ['stc', 'batches'],
    queryFn: () => fetchStcBatches(),
  });
  const enrollQ = useQuery({
    queryKey: ['stc', 'enrollments', selectedBatchId],
    queryFn: () => fetchStcEnrollments(selectedBatchId ? { batchId: selectedBatchId } : undefined),
  });
  const batchDetailQ = useQuery({
    queryKey: ['stc', 'batch', selectedBatchId],
    queryFn: () => fetchStcBatch(selectedBatchId),
    enabled: Boolean(selectedBatchId),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['stc'] });

  const seedMut = useMutation({
    mutationFn: seedStcDemoCourses,
    onSuccess: (res) => {
      setMessage({
        tone: 'ok',
        text: `Loaded ${res.count} demo programmes (CAFA, BCCS, ELPC, BCCH, BCTE).`,
      });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Seed failed') }),
  });

  const publishMut = useMutation({
    mutationFn: publishStcCourse,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Course published to catalogue.' });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Publish failed') }),
  });

  const createCourseMut = useMutation({
    mutationFn: createStcCourse,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Course created as draft.' });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Create failed') }),
  });

  const updateCourseMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateStcCourse(id, payload),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Course updated.' });
      setEditingCourse(null);
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Update failed') }),
  });

  const setCourseStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      status === 'PUBLISHED' ? publishStcCourse(id) : updateStcCourse(id, { status }),
    onSuccess: (_data, vars) => {
      setMessage({
        tone: 'ok',
        text:
          vars.status === 'PUBLISHED'
            ? 'Course enabled — visible on student catalogue.'
            : vars.status === 'DRAFT'
              ? 'Course closed — hidden from student catalogue.'
              : 'Course archived.',
      });
      setEditingCourse(null);
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Status update failed') }),
  });

  const createBatchMut = useMutation({
    mutationFn: createStcBatch,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Batch opened for registration.' });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Batch failed') }),
  });

  const issueMut = useMutation({
    mutationFn: issueStcCertificate,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Completion certificate issued.' });
      invalidate();
    },
    onError: (e) =>
      setMessage({ tone: 'err', text: apiErrorMessage(e, 'Certificate issue failed') }),
  });

  const courses = coursesQ.data ?? [];
  const batches = batchesQ.data ?? [];
  const enrollments = enrollQ.data ?? [];
  const dash = dashQ.data;
  const firstCourseId = courses[0]?.id ?? '';

  const statusBars = useMemo(() => {
    const colorBy: Record<string, string> = {
      CONFIRMED: 'bg-emerald-500',
      COMPLETED: 'bg-violet-500',
      PAYMENT_PENDING: 'bg-amber-500',
      WAITLISTED: 'bg-orange-500',
      APPLIED: 'bg-slate-400',
      CANCELLED: 'bg-rose-400',
    };
    return (dash?.byStatus ?? []).map((r: any) => ({
      label: String(r.status).replace(/_/g, ' '),
      value: Number(r._count?._all ?? 0),
      color: colorBy[r.status] ?? 'bg-sky-500',
    }));
  }, [dash?.byStatus]);

  const busyTabs = [
    'registrations',
    'faculty',
    'attendance',
    'assessments',
    'certificates',
    'payments',
  ];

  return (
    <div className="space-y-5">
      <StcHero
        title="Short-Term Courses"
        subtitle="Run certificate programmes end-to-end — catalogue, paid registration, batches, attendance, assessments, and verified completion certificates."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {seedMut.isPending ? 'Seeding…' : 'Seed demo courses'}
            </Button>
            <Button asChild className="bg-sky-500 text-white hover:bg-sky-400">
              <Link href="/admin/academics/short-term-courses?tab=courses">
                <Plus className="mr-1.5 h-4 w-4" />
                Manage courses
              </Link>
            </Button>
          </>
        }
      />

      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
        {STC_TAB_META.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={`/admin/academics/short-term-courses?tab=${item.id}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {tab === 'dashboard' || tab === 'reports' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StcKpiCard
              icon={BookOpen}
              label="Active courses"
              value={dash?.activeCourses ?? 0}
              hint="Published catalogue"
              tone="from-sky-500/15 to-sky-500/5"
            />
            <StcKpiCard
              icon={Users}
              label="Registrations"
              value={dash?.registrations ?? 0}
              hint={`${dash?.confirmed ?? 0} confirmed`}
              tone="from-emerald-500/15 to-emerald-500/5"
            />
            <StcKpiCard
              icon={IndianRupee}
              label="Revenue"
              value={money(dash?.revenue ?? 0)}
              hint="Gateway collections"
              tone="from-amber-500/15 to-amber-500/5"
            />
            <StcKpiCard
              icon={Award}
              label="Certificates"
              value={dash?.certificatesIssued ?? 0}
              hint="Issued completions"
              tone="from-violet-500/15 to-violet-500/5"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <StcPanel
              title="Upcoming classes"
              description="Next sessions across open batches"
              icon={CalendarClock}
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/academics/short-term-courses?tab=attendance">
                    Schedule session
                  </Link>
                </Button>
              }
            >
              {(dash?.upcomingClasses ?? []).length === 0 ? (
                <StcEmptyState
                  icon={CalendarClock}
                  title="No classes on the calendar"
                  description="Create a batch session from Attendance once demo courses are seeded and a working batch is selected."
                  action={
                    <Button asChild size="sm">
                      <Link href="/admin/academics/short-term-courses?tab=batches">
                        Open batches
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(dash?.upcomingClasses ?? []).map((s: any) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.batch?.course?.name ?? 'Course'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.topic || 'Session'} · {s.batch?.batchCode}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {new Date(s.startsAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </StcPanel>

            <StcPanel
              title={tab === 'reports' ? 'Registration analytics' : 'Enrollment mix'}
              description="Status distribution across all batches"
              icon={ClipboardList}
            >
              <StcStatusBar items={statusBars} />
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <dt className="text-xs text-slate-500">Completed batches</dt>
                  <dd className="mt-1 text-lg font-semibold">{dash?.completedBatches ?? 0}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <dt className="text-xs text-slate-500">Confirmed seats</dt>
                  <dd className="mt-1 text-lg font-semibold">{dash?.confirmed ?? 0}</dd>
                </div>
              </dl>
            </StcPanel>
          </div>
        </div>
      ) : null}

      {tab === 'courses' ? (
        <div className="space-y-4">
          <QuickCreateCourse
            onCreate={(payload) => createCourseMut.mutate(payload)}
            pending={createCourseMut.isPending}
          />

          {editingCourse ? (
            <EditCoursePanel
              key={editingCourse.id}
              course={editingCourse}
              pending={updateCourseMut.isPending || setCourseStatusMut.isPending}
              onCancel={() => setEditingCourse(null)}
              onSave={(payload) => updateCourseMut.mutate({ id: editingCourse.id, payload })}
              onSetStatus={(status) => setCourseStatusMut.mutate({ id: editingCourse.id, status })}
            />
          ) : null}

          {courses.length === 0 ? (
            <StcEmptyState
              icon={BookOpen}
              title="Catalogue is empty"
              description="Seed the five Don Bosco demo programmes or create a course to open registration."
              action={
                <Button type="button" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                  Seed demo courses
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((c: any) => (
                <article
                  key={c.id}
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    editingCourse?.id === c.id
                      ? 'border-sky-400 ring-2 ring-sky-100'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 opacity-80" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                        {c.code}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{c.name}</h3>
                    </div>
                    <StcStatusBadge status={c.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">
                      {c.durationDays} days
                    </span>
                    <StcStatusBadge status={c.mode} />
                    <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">
                      {c.maxSeats} seats
                    </span>
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      {c.feeType === 'FREE' ? 'Free' : money(Number(c.fees?.courseFee ?? 0))}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCourse(c)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit fee / seats
                    </Button>
                    {c.status === 'PUBLISHED' ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        disabled={setCourseStatusMut.isPending}
                        onClick={() => setCourseStatusMut.mutate({ id: c.id, status: 'DRAFT' })}
                      >
                        Close registration
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        disabled={publishMut.isPending || setCourseStatusMut.isPending}
                        onClick={() => publishMut.mutate(c.id)}
                      >
                        Open on catalogue
                      </Button>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">
                    {c.status === 'PUBLISHED'
                      ? 'Live for students (with an open batch).'
                      : 'Hidden from student catalogue until opened.'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'batches' ? (
        <div className="space-y-4">
          <QuickCreateBatch
            courses={courses}
            defaultCourseId={firstCourseId}
            onCreate={(payload) => createBatchMut.mutate(payload)}
            pending={createBatchMut.isPending}
          />
          <StcPanel
            title="Batch roster"
            description="Registration windows and seat uptake"
            icon={CalendarClock}
          >
            {batches.length === 0 ? (
              <StcEmptyState
                icon={CalendarClock}
                title="No batches yet"
                description="Create a batch after publishing a course to open Apply Now on the student portal."
              />
            ) : (
              <div className="overflow-auto rounded-xl ring-1 ring-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Registration</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b: any) => (
                      <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-semibold text-slate-900">{b.batchCode}</td>
                        <td className="px-4 py-3 text-slate-700">{b.course?.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {b.regStartAt ? new Date(b.regStartAt).toLocaleDateString('en-IN') : '—'}{' '}
                          → {b.regEndAt ? new Date(b.regEndAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StcStatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3 tabular-nums">{b._count?.enrollments ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StcPanel>
        </div>
      ) : null}

      {busyTabs.includes(tab) ? (
        <div className="space-y-4">
          <StcPanel
            title="Working batch"
            description="Select a batch to manage registrations, faculty, attendance, and certificates"
            icon={Users}
          >
            <select
              className="w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select batch…</option>
              {batches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode} — {b.course?.name}
                </option>
              ))}
            </select>
          </StcPanel>

          {tab === 'registrations' || tab === 'payments' || tab === 'certificates' ? (
            <StcPanel
              title={
                tab === 'certificates'
                  ? 'Certificate desk'
                  : tab === 'payments'
                    ? 'Payment linked enrollments'
                    : 'Registrations'
              }
              description={
                selectedBatchId
                  ? 'Filtered to the selected batch'
                  : 'Showing recent enrollments across all batches'
              }
              icon={tab === 'certificates' ? Award : Users}
            >
              {enrollments.length === 0 ? (
                <StcEmptyState
                  icon={Users}
                  title="No enrollments yet"
                  description="Students appear here after Apply Now from the student portal or mobile app."
                />
              ) : (
                <div className="overflow-auto rounded-xl ring-1 ring-slate-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Payment / Cert</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e: any) => (
                        <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {e.student?.name ?? 'Student'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {e.student?.enrollmentNumber ??
                                e.student?.rollNumber ??
                                `${e.studentId.slice(0, 8)}…`}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{e.batch?.course?.code}</p>
                            <p className="text-[11px] text-slate-500">{e.batch?.batchCode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StcStatusBadge status={e.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {e.demandId ? (
                              <span>Demand linked</span>
                            ) : (
                              <span className="text-slate-400">No demand</span>
                            )}
                            {e.certificate ? (
                              <span className="ml-2 text-emerald-700">· Cert ready</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {tab === 'certificates' && !e.certificate ? (
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => issueMut.mutate(e.id)}
                                disabled={issueMut.isPending}
                              >
                                Issue certificate
                              </Button>
                            ) : tab === 'certificates' && e.certificate ? (
                              <span className="text-xs font-medium text-emerald-700">Issued</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StcPanel>
          ) : null}

          {tab === 'faculty' ? (
            selectedBatchId ? (
              <FacultyPanel
                batchId={selectedBatchId}
                staff={batchDetailQ.data?.staff ?? []}
                onAssign={invalidate}
              />
            ) : (
              <StcEmptyState
                icon={Users}
                title="Pick a working batch"
                description="Faculty coordinators and guest lecturers are allocated per batch."
              />
            )
          ) : null}

          {tab === 'attendance' ? (
            selectedBatchId ? (
              <AttendancePanel
                batch={batchDetailQ.data}
                enrollments={enrollments}
                onMarked={invalidate}
              />
            ) : (
              <StcEmptyState
                icon={ClipboardList}
                title="Pick a working batch"
                description="Create sessions and mark attendance for confirmed learners."
              />
            )
          ) : null}

          {tab === 'assessments' ? (
            selectedBatchId ? (
              <AssessmentPanel batch={batchDetailQ.data} onSaved={invalidate} />
            ) : (
              <StcEmptyState
                icon={ClipboardList}
                title="Pick a working batch"
                description="Add quizzes, practicals, or final assessments for the batch."
              />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EditCoursePanel({
  course,
  pending,
  onCancel,
  onSave,
  onSetStatus,
}: {
  course: any;
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  onSetStatus: (status: string) => void;
}) {
  const [name, setName] = useState(course.name ?? '');
  const [description, setDescription] = useState(course.description ?? '');
  const [durationDays, setDurationDays] = useState(String(course.durationDays ?? 30));
  const [maxSeats, setMaxSeats] = useState(String(course.maxSeats ?? 40));
  const [fee, setFee] = useState(String(course.fees?.courseFee ?? 0));
  const [feeType, setFeeType] = useState(course.feeType ?? 'PAID');
  const [mode, setMode] = useState(course.mode ?? 'OFFLINE');
  const [status, setStatus] = useState(course.status ?? 'DRAFT');

  return (
    <StcPanel
      title={`Edit ${course.code}`}
      description="Update fee, seats, duration, and whether students can see this course"
      icon={Pencil}
      actions={
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-3">
          Course name
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-3">
          Description
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Duration (days)
          <Input
            className="mt-1"
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Max seats
          <Input
            className="mt-1"
            type="number"
            min={1}
            value={maxSeats}
            onChange={(e) => setMaxSeats(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Course fee ₹
          <Input
            className="mt-1"
            type="number"
            min={0}
            disabled={feeType === 'FREE'}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Fee type
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={feeType}
            onChange={(e) => setFeeType(e.target.value)}
          >
            <option value="PAID">PAID</option>
            <option value="FREE">FREE</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Mode
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="OFFLINE">OFFLINE</option>
            <option value="ONLINE">ONLINE</option>
            <option value="HYBRID">HYBRID</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Catalogue status
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="PUBLISHED">PUBLISHED (open / visible)</option>
            <option value="DRAFT">DRAFT (closed / hidden)</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <strong>PUBLISHED</strong> shows the course on the student catalogue. Students can apply
        only while a batch registration window is also open. <strong>DRAFT</strong> hides it
        immediately.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              shortName: course.shortName ?? course.code,
              code: course.code,
              description,
              durationDays: Number(durationDays) || 30,
              maxSeats: Number(maxSeats) || 40,
              feeType,
              mode,
              status,
              fees: {
                courseFee: feeType === 'FREE' ? 0 : Number(fee) || 0,
                registrationFee: Number(course.fees?.registrationFee ?? 0),
                gst: Number(course.fees?.gst ?? 0),
                currency: 'INR',
              },
            })
          }
        >
          Save changes
        </Button>
        {course.status === 'PUBLISHED' ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onSetStatus('DRAFT')}
          >
            Close now
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onSetStatus('PUBLISHED')}
          >
            Open on catalogue
          </Button>
        )}
      </div>
    </StcPanel>
  );
}

function QuickCreateCourse({
  onCreate,
  pending,
}: {
  onCreate: (p: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fee, setFee] = useState('500');
  return (
    <StcPanel
      title="Quick create course"
      description="Draft a paid certificate programme in seconds"
      icon={Plus}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Code (e.g. CAFA)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Input
          className="md:col-span-2"
          placeholder="Course name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input placeholder="Fee ₹" value={fee} onChange={(e) => setFee(e.target.value)} />
      </div>
      <Button
        className="mt-4"
        type="button"
        disabled={pending || !code || !name}
        onClick={() =>
          onCreate({
            code,
            name,
            shortName: code,
            description: name,
            feeType: 'PAID',
            fees: { courseFee: Number(fee) || 0, registrationFee: 0, gst: 0 },
            status: 'DRAFT',
            maxSeats: 40,
            durationDays: 30,
            eligibility: { scope: 'ALL' },
          })
        }
      >
        Create draft course
      </Button>
    </StcPanel>
  );
}

function QuickCreateBatch({
  courses,
  defaultCourseId,
  onCreate,
  pending,
}: {
  courses: any[];
  defaultCourseId: string;
  onCreate: (p: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [batchCode, setBatchCode] = useState('');
  return (
    <StcPanel
      title="Create batch"
      description="Open a registration window and classroom for a published course"
      icon={Plus}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <select
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          value={courseId || defaultCourseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Batch code e.g. BCCS-2026-A"
          value={batchCode}
          onChange={(e) => setBatchCode(e.target.value)}
        />
        <Button
          type="button"
          disabled={pending || !(courseId || defaultCourseId) || !batchCode}
          onClick={() => {
            const now = new Date();
            const regEnd = new Date(now);
            regEnd.setDate(regEnd.getDate() + 14);
            const start = new Date(regEnd);
            start.setDate(start.getDate() + 1);
            const end = new Date(start);
            end.setDate(end.getDate() + 30);
            onCreate({
              courseId: courseId || defaultCourseId,
              batchCode,
              regStartAt: now.toISOString(),
              regEndAt: regEnd.toISOString(),
              courseStartAt: start.toISOString(),
              courseEndAt: end.toISOString(),
              status: 'OPEN',
              classroom: 'Seminar Hall',
            });
          }}
        >
          Create open batch
        </Button>
      </div>
    </StcPanel>
  );
}

function FacultyPanel({
  batchId,
  staff,
  onAssign,
}: {
  batchId: string;
  staff: any[];
  onAssign: () => void;
}) {
  const [staffUserId, setStaffUserId] = useState('');
  const [role, setRole] = useState('LEAD');
  const mut = useMutation({
    mutationFn: () => assignStcStaff(batchId, { staffUserId, role }),
    onSuccess: onAssign,
  });
  return (
    <StcPanel
      title="Faculty allocation"
      description="Coordinators, leads, and guest faculty"
      icon={Users}
    >
      {staff.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">No staff assigned to this batch yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {staff.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100"
            >
              <span className="font-mono text-xs text-slate-600">{s.staffUserId}</span>
              <StcStatusBadge status={s.role} />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder="Staff user UUID"
          value={staffUserId}
          onChange={(e) => setStaffUserId(e.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {['COORDINATOR', 'LEAD', 'GUEST', 'LAB', 'TA'].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button type="button" disabled={!staffUserId || mut.isPending} onClick={() => mut.mutate()}>
          Assign faculty
        </Button>
      </div>
    </StcPanel>
  );
}

function AttendancePanel({
  batch,
  enrollments,
  onMarked,
}: {
  batch: any;
  enrollments: any[];
  onMarked: () => void;
}) {
  const [sessionId, setSessionId] = useState('');
  const [topic, setTopic] = useState('Class session');
  const createMut = useMutation({
    mutationFn: () => {
      const start = new Date();
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      return createStcSession(batch.id, {
        topic,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        venue: batch.classroom ?? 'Classroom',
      });
    },
    onSuccess: (s) => {
      setSessionId(s.id);
      onMarked();
    },
  });
  const markMut = useMutation({
    mutationFn: () =>
      markStcAttendance(
        sessionId,
        enrollments
          .filter((e) => ['CONFIRMED', 'COMPLETED'].includes(e.status))
          .map((e) => ({ enrollmentId: e.id, status: 'PRESENT' })),
      ),
    onSuccess: onMarked,
  });
  const addMaterial = useMutation({
    mutationFn: () =>
      createStcMaterial(batch.id, {
        title: 'Course notes',
        type: 'NOTES',
        fileUrl: 'https://example.com/notes.pdf',
        publish: true,
      }),
    onSuccess: onMarked,
  });

  if (!batch) return <p className="text-sm text-slate-500">Loading batch…</p>;

  return (
    <StcPanel
      title="Attendance & materials"
      description="Manual mark sheets and study resources for this batch"
      icon={ClipboardList}
    >
      <div className="flex flex-wrap gap-2">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} className="max-w-xs" />
        <Button type="button" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          Create today&apos;s session
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!sessionId || markMut.isPending}
          onClick={() => markMut.mutate()}
        >
          Mark confirmed present
        </Button>
        <Button type="button" variant="outline" onClick={() => addMaterial.mutate()}>
          Add sample material
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {(batch.sessions ?? []).length === 0 ? (
          <li className="text-sm text-slate-500">No sessions yet.</li>
        ) : (
          (batch.sessions ?? []).map((s: any) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${
                  sessionId === s.id
                    ? 'bg-sky-50 text-sky-900 ring-sky-200'
                    : 'bg-slate-50 text-slate-700 ring-slate-100 hover:bg-white'
                }`}
                onClick={() => setSessionId(s.id)}
              >
                {new Date(s.startsAt).toLocaleString('en-IN')} — {s.topic}
              </button>
            </li>
          ))
        )}
      </ul>
    </StcPanel>
  );
}

function AssessmentPanel({ batch, onSaved }: { batch: any; onSaved: () => void }) {
  const [title, setTitle] = useState('Final practical');
  const mut = useMutation({
    mutationFn: () =>
      createStcAssessment(batch.id, {
        title,
        type: 'FINAL',
        maxMarks: 100,
        passMarks: 40,
        required: true,
      }),
    onSuccess: onSaved,
  });
  if (!batch) return <p className="text-sm text-slate-500">Loading batch…</p>;
  return (
    <StcPanel
      title="Assessments"
      description="Pass gates for completion certificates"
      icon={ClipboardList}
    >
      <ul className="mb-4 space-y-2">
        {(batch.assessments ?? []).length === 0 ? (
          <li className="text-sm text-slate-500">No assessments configured.</li>
        ) : (
          (batch.assessments ?? []).map((a: any) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100"
            >
              <span>
                {a.title} <span className="text-slate-500">({a.type})</span>
              </span>
              <span className="text-xs font-medium text-slate-600">
                Pass {a.passMarks}/{a.maxMarks}
              </span>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-sm" />
        <Button type="button" onClick={() => mut.mutate()} disabled={mut.isPending}>
          Add assessment
        </Button>
      </div>
    </StcPanel>
  );
}
