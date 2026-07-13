'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  GraduationCap,
  IndianRupee,
  Loader2,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import {
  money,
  StcEmptyState,
  StcHero,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { useRequireAuth } from '@/hooks/use-auth';
import { runFeeGatewayCheckout } from '@/lib/fee-gateway-checkout';
import { apiErrorMessage } from '@/utils/api-error';
import {
  applyStcEnrollment,
  confirmStcPayment,
  fetchStcAttendanceSummary,
  fetchStcCertEligibility,
  fetchStcMyLearning,
  payStcEnrollment,
} from '@/services/short-term-courses';

const VIEWS = [
  { id: 'available', label: 'Available', icon: BookOpen },
  { id: 'mine', label: 'My courses', icon: GraduationCap },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
  { id: 'certificate', label: 'Certificate', icon: Award },
] as const;

type View = (typeof VIEWS)[number]['id'];

export default function StudentShortTermCoursesPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [view, setView] = useState<View>('available');

  const learningQ = useQuery({
    queryKey: ['stc', 'my-learning'],
    queryFn: fetchStcMyLearning,
    enabled: Boolean(session),
  });

  const applyMut = useMutation({
    mutationFn: async (batchId: string) => {
      const result = await applyStcEnrollment(batchId);
      if (result.checkout?.checkout || result.checkout?.payment) {
        const checkout = result.checkout.checkout ?? result.checkout;
        const payResult = await runFeeGatewayCheckout(checkout, {
          description: `Short-term course registration`,
        });
        if (payResult.kind === 'mock' || payResult.kind === 'atom_opened') {
          await confirmStcPayment(
            result.enrollment.id,
            checkout.paymentId ?? result.enrollment.paymentId,
          );
        }
      } else if (result.enrollment?.status === 'PAYMENT_PENDING') {
        const paid = await payStcEnrollment(result.enrollment.id);
        const checkout = paid.checkout?.checkout ?? paid.checkout;
        if (checkout) {
          await runFeeGatewayCheckout(checkout, {
            description: 'Short-term course fee',
          });
          await confirmStcPayment(
            result.enrollment.id,
            checkout.paymentId ?? paid.enrollment?.paymentId,
          );
        }
      }
      return result;
    },
    onSuccess: (res) => {
      setMessage({
        tone: 'ok',
        text: res.waitlisted
          ? 'Added to waiting list — you will be notified when a seat opens.'
          : `Registration ${String(res.enrollment?.status ?? 'submitted')
              .replace(/_/g, ' ')
              .toLowerCase()}.`,
      });
      void qc.invalidateQueries({ queryKey: ['stc'] });
      setView('mine');
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Registration failed') }),
  });

  if (!session) return null;

  const catalogue = learningQ.data?.catalogue ?? [];
  const enrollments = learningQ.data?.enrollments ?? [];
  const openCount = catalogue.filter((c: any) => c.registrationOpen).length;

  return (
    <DashboardShell role="student" title="Short-Term Courses">
      <div className="space-y-5">
        <StcHero
          badge="My Learning"
          title="Short-Term Courses"
          subtitle="Browse certificate programmes, apply with online payment, track attendance, and download your completion certificate."
          actions={
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-sky-100">Open now</p>
              <p className="text-2xl font-semibold tabular-nums">{openCount}</p>
              <p className="text-xs text-slate-300">courses accepting applications</p>
            </div>
          }
        />

        <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5 opacity-80" />
                {item.label}
              </button>
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

        {learningQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your learning desk…
          </div>
        ) : null}

        {view === 'available' && !learningQ.isLoading ? (
          catalogue.length === 0 ? (
            <StcEmptyState
              icon={BookOpen}
              title="No courses published yet"
              description="When the college publishes short-term certificate programmes, they will appear here for registration."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {catalogue.map((c: any) => {
                const seatsLeft = c.seats?.available ?? c.maxSeats;
                const maxSeats = c.seats?.maxSeats ?? c.maxSeats;
                const seatPct =
                  maxSeats > 0
                    ? Math.min(100, Math.round(((maxSeats - seatsLeft) / maxSeats) * 100))
                    : 0;
                return (
                  <article
                    key={c.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            c.registrationOpen ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {c.registrationOpen ? 'Registration open' : 'Registration closed'}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-900">{c.name}</h2>
                        <p className="text-xs text-slate-500">
                          {c.code} · {c.shortName}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100">
                        <BookOpen className="h-5 w-5 text-sky-700" />
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                      {c.description}
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                          Duration
                        </dt>
                        <dd className="mt-0.5 font-semibold">{c.durationDays} days</dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">Mode</dt>
                        <dd className="mt-0.5">
                          <StcStatusBadge status={c.mode} />
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                          Seats
                        </dt>
                        <dd className="mt-0.5 font-semibold">
                          {seatsLeft} / {maxSeats} left
                        </dd>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${seatPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                        <dt className="text-[11px] uppercase tracking-wide text-emerald-700">
                          Fee
                        </dt>
                        <dd className="mt-0.5 flex items-center gap-1 font-semibold text-emerald-900">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {c.feeType === 'FREE'
                            ? 'Free'
                            : Number(c.fees?.courseFee ?? 0).toLocaleString('en-IN')}
                        </dd>
                      </div>
                    </dl>
                    <Button
                      className="mt-4 w-full"
                      type="button"
                      disabled={!c.registrationOpen || !c.openBatch || applyMut.isPending}
                      onClick={() => applyMut.mutate(c.openBatch.id)}
                    >
                      {applyMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        'Apply now'
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          )
        ) : null}

        {view === 'mine' && !learningQ.isLoading ? (
          enrollments.length === 0 ? (
            <StcEmptyState
              icon={GraduationCap}
              title="You are not registered yet"
              description="Browse available programmes and apply — paid courses open Atom checkout securely."
              action={
                <Button type="button" onClick={() => setView('available')}>
                  Browse courses
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {enrollments.map((e: any) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{e.batch?.course?.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {e.batch?.batchCode} · Registered{' '}
                      {e.registeredAt ? new Date(e.registeredAt).toLocaleDateString('en-IN') : '—'}
                    </p>
                    {e.batch?.course?.fees?.courseFee ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Fee {money(Number(e.batch.course.fees.courseFee))}
                      </p>
                    ) : null}
                  </div>
                  <StcStatusBadge status={e.status} />
                </div>
              ))}
            </div>
          )
        ) : null}

        {view === 'timetable' && !learningQ.isLoading ? (
          <StcPanel
            title="Course timetable"
            description="Sessions published by your batch faculty"
            icon={CalendarDays}
          >
            <StcEmptyState
              icon={CalendarDays}
              title="Timetable will appear here"
              description="Once faculty schedules classroom sessions for your confirmed batch, the dates and venues show up on this desk."
            />
          </StcPanel>
        ) : null}

        {view === 'attendance' && !learningQ.isLoading ? (
          <AttendanceCards enrollments={enrollments} />
        ) : null}

        {view === 'certificate' && !learningQ.isLoading ? (
          <CertificateCards enrollments={enrollments} />
        ) : null}
      </div>
    </DashboardShell>
  );
}

function AttendanceCards({ enrollments }: { enrollments: any[] }) {
  if (enrollments.length === 0) {
    return (
      <StcEmptyState
        icon={CheckCircle2}
        title="No attendance to show"
        description="Register for a course first, then attendance percentages appear after sessions are marked."
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {enrollments.map((e) => (
        <EnrollmentAttendance key={e.id} enrollmentId={e.id} title={e.batch?.course?.name} />
      ))}
    </div>
  );
}

function EnrollmentAttendance({ enrollmentId, title }: { enrollmentId: string; title?: string }) {
  const q = useQuery({
    queryKey: ['stc', 'attendance', enrollmentId],
    queryFn: () => fetchStcAttendanceSummary(enrollmentId),
  });
  const pct = q.data?.percent ?? 0;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-slate-900">{pct}%</p>
          <p className="mt-1 text-xs text-slate-500">
            {q.data?.present ?? 0} present of {q.data?.sessions ?? 0} sessions
          </p>
        </div>
        <div className="h-16 w-16">
          <svg viewBox="0 0 36 36" className="-rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="3"
              strokeDasharray={`${pct}, 100`}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CertificateCards({ enrollments }: { enrollments: any[] }) {
  if (enrollments.length === 0) {
    return (
      <StcEmptyState
        icon={Award}
        title="No certificates yet"
        description="Complete attendance and assessments for a confirmed course to become eligible for a completion certificate."
      />
    );
  }
  return (
    <div className="space-y-3">
      {enrollments.map((e) => (
        <EnrollmentCert key={e.id} enrollment={e} />
      ))}
    </div>
  );
}

function EnrollmentCert({ enrollment }: { enrollment: any }) {
  const q = useQuery({
    queryKey: ['stc', 'cert-elig', enrollment.id],
    queryFn: () => fetchStcCertEligibility(enrollment.id),
  });
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-sm ring-1 ring-amber-100/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Award className="h-4 w-4 text-amber-600" />
            {enrollment.batch?.course?.name}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {enrollment.certificate
              ? 'Certificate issued — open your certificates vault to download or print.'
              : q.data?.eligible
                ? 'You are eligible. The office can issue your certificate now.'
                : (q.data?.reason ?? 'Not yet eligible for completion certificate.')}
          </p>
        </div>
        {enrollment.certificate ? (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href="/student/certificates">
              <Download className="mr-1 h-3.5 w-3.5" />
              Open certificates
            </a>
          </Button>
        ) : (
          <StcStatusBadge status={enrollment.status} />
        )}
      </div>
    </div>
  );
}
