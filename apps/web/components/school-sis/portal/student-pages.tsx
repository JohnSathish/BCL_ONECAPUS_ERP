'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changePassword, revokeAllSessions } from '@/services/student-portal';
import {
  applySchoolPortalLeave,
  fetchSchoolPortalAttendance,
  fetchSchoolPortalCalendar,
  fetchSchoolPortalExams,
  fetchSchoolPortalFees,
  fetchSchoolPortalGallery,
  fetchSchoolPortalInbox,
  fetchSchoolPortalLeaveTypes,
  fetchSchoolPortalLeaves,
  fetchSchoolPortalNotices,
  fetchSchoolPortalTimetable,
  fetchSchoolPortalTransport,
  markSchoolPortalInboxReadAll,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { DashboardCard, NotificationPanel, PortalAvatar } from './portal-widgets';
import { usePortalData, portalDisplayName, portalMe, portalStudent } from './portal-data';
import {
  asList,
  asNumber,
  asRecord,
  asText,
  formatDay,
  moneyPaise,
  percentLabel,
} from './portal-utils';

function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold text-[var(--heading,#0f172a)]">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-[var(--muted-foreground,#64748b)]">{hint}</p> : null}
    </div>
  );
}

export function StudentAttendancePage() {
  const authed = useAuthQueryEnabled();
  const { childId } = usePortalData();
  const q = useQuery({
    queryKey: ['portal-att', childId],
    queryFn: () => fetchSchoolPortalAttendance(childId),
    enabled: authed,
  });
  const data = asRecord(q.data);
  const calendar = asList(data.calendar).map(asRecord);
  return (
    <div>
      <PageTitle title="Attendance" hint={`Overall ${percentLabel(data.percent)}`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {['present', 'absent', 'late', 'leave'].map((key) => (
          <div key={key} className="portal-card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
              {key}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {asText(asRecord(data.month)[key] ?? data[key], '0')}
            </p>
          </div>
        ))}
      </div>
      <DashboardCard title="This month">
        {calendar.length ? (
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {calendar.map((day, i) => (
              <div key={i} className="rounded-lg border border-[var(--border-subtle,#e8edf5)] p-1">
                <div className="font-semibold">{asText(day.date, '').slice(-2)}</div>
                <div>{asText(day.status ?? day.code, '')}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="portal-empty px-0">Attendance will appear here once classes are marked.</p>
        )}
      </DashboardCard>
    </div>
  );
}

export function StudentTimetablePage() {
  const authed = useAuthQueryEnabled();
  const { childId } = usePortalData();
  const q = useQuery({
    queryKey: ['portal-tt', childId],
    queryFn: () => fetchSchoolPortalTimetable(childId),
    enabled: authed,
  });
  const slots = asList(asRecord(q.data).slots).map(asRecord);
  const days = [1, 2, 3, 4, 5, 6];
  return (
    <div>
      <PageTitle title="Timetable" hint="Upcoming classes follow this weekly grid." />
      <div className="overflow-x-auto portal-card">
        <table className="portal-table min-w-[40rem]">
          <thead>
            <tr>
              <th>Day</th>
              <th>Period</th>
              <th>Subject</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {days.flatMap((day) =>
              slots
                .filter((slot) => Number(slot.dayOfWeek) === day)
                .map((slot) => (
                  <tr key={asText(slot.id)}>
                    <td>{['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}</td>
                    <td>{asText(asRecord(slot.bell).label, '')}</td>
                    <td>{asText(asRecord(slot.subject).name, 'Period')}</td>
                    <td>
                      {asText(asRecord(slot.bell).startTime)}–{asText(asRecord(slot.bell).endTime)}
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
        {!slots.length ? <p className="portal-empty">No timetable published yet.</p> : null}
      </div>
    </div>
  );
}

export function StudentFeesPage() {
  const authed = useAuthQueryEnabled();
  const { childId } = usePortalData();
  const q = useQuery({
    queryKey: ['portal-fees', childId],
    queryFn: () => fetchSchoolPortalFees(childId),
    enabled: authed,
  });
  const pack = asRecord(q.data);
  const monthly = asRecord(pack.monthly);
  const ledger = asList(monthly.ledger ?? pack.ledger).map(asRecord);
  return (
    <div>
      <PageTitle title="Fees" hint="Payment status from the school accounts desk." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="portal-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
            Pending
          </p>
          <p className="mt-1 text-xl font-semibold">
            {moneyPaise(monthly.pendingFees ?? pack.pending)}
          </p>
        </div>
        <div className="portal-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
            Collected
          </p>
          <p className="mt-1 text-xl font-semibold">{moneyPaise(monthly.collected ?? pack.paid)}</p>
        </div>
        <div className="portal-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
            Status
          </p>
          <p className="mt-1 text-xl font-semibold">{asText(pack.status, 'Current')}</p>
        </div>
      </div>
      <DashboardCard title="Ledger">
        {ledger.length ? (
          <table className="portal-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={i}>
                  <td>{asText(row.head ?? row.label ?? row.month, 'Fee')}</td>
                  <td>{moneyPaise(row.amount ?? row.paise ?? row.due)}</td>
                  <td>{asText(row.status, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="portal-empty px-0">No fee lines yet.</p>
        )}
      </DashboardCard>
    </div>
  );
}

export function StudentInboxPage() {
  const authed = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['portal-inbox'],
    queryFn: fetchSchoolPortalInbox,
    enabled: authed,
  });
  return (
    <div>
      <PageTitle title="Messages" hint={`${asNumber(q.data?.unreadCount)} unread`} />
      <button
        type="button"
        className="sls-btn-primary mb-3"
        onClick={() =>
          markSchoolPortalInboxReadAll().then(() =>
            qc.invalidateQueries({ queryKey: ['portal-inbox'] }),
          )
        }
      >
        Mark all read
      </button>
      <DashboardCard title="Inbox">
        <NotificationPanel items={q.data?.items} empty="No messages yet." />
      </DashboardCard>
    </div>
  );
}

export function StudentLeavePage() {
  const authed = useAuthQueryEnabled();
  const { childId } = usePortalData();
  const qc = useQueryClient();
  const types = useQuery({
    queryKey: ['portal-leave-types'],
    queryFn: fetchSchoolPortalLeaveTypes,
    enabled: authed,
  });
  const leaves = useQuery({
    queryKey: ['portal-leaves', childId],
    queryFn: () => fetchSchoolPortalLeaves(childId),
    enabled: authed,
  });
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => applySchoolPortalLeave({ ...form, childId: childId || undefined }),
    onSuccess: () => {
      setError(null);
      setForm({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
      void qc.invalidateQueries({ queryKey: ['portal-leaves'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      <PageTitle title="Leave application" hint="Submit a leave request for the linked student." />
      <DashboardCard title="Apply">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-sm">
            Type
            <select
              required
              className="mt-1 w-full"
              value={form.leaveTypeId}
              onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
            >
              <option value="">Select</option>
              {asList(types.data).map((row) => {
                const item = asRecord(row);
                return (
                  <option key={asText(item.id)} value={asText(item.id)}>
                    {asText(item.name)}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="text-sm">
            From
            <input
              type="date"
              required
              className="mt-1 w-full"
              value={form.fromDate}
              onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            To
            <input
              type="date"
              required
              className="mt-1 w-full"
              value={form.toDate}
              onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Reason
            <textarea
              className="mt-1 w-full"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          {error ? <p className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
          <button type="submit" className="sls-btn-primary sm:col-span-2" disabled={save.isPending}>
            Submit leave
          </button>
        </form>
      </DashboardCard>
      <DashboardCard title="Status">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {asList(leaves.data).map((row, i) => {
              const item = asRecord(row);
              return (
                <tr key={i}>
                  <td>
                    {formatDay(asText(item.fromDate))} – {formatDay(asText(item.toDate))}
                  </td>
                  <td>{asText(asRecord(item.leaveType).name)}</td>
                  <td>{asText(item.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!asList(leaves.data).length ? (
          <p className="portal-empty">No leave applications yet.</p>
        ) : null}
      </DashboardCard>
    </div>
  );
}

export function StudentProfilePage() {
  const { home } = usePortalData();
  const student = portalStudent(home);
  const me = portalMe(home);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <PageTitle title="Profile & settings" />
      <DashboardCard title="Student">
        <div className="flex gap-4">
          <PortalAvatar
            src={asText(student.photoUrl, '') || null}
            name={portalDisplayName(home)}
            size={72}
          />
          <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Name</dt>
              <dd className="font-semibold">{asText(student.fullName, portalDisplayName(home))}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Admission no.</dt>
              <dd>{asText(student.admissionNumber)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Class</dt>
              <dd>{asText(student.classLabel)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Email</dt>
              <dd>{asText(student.email || me.email)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Phone</dt>
              <dd>{asText(student.phone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Academic year</dt>
              <dd>{asText(student.academicYearName)}</dd>
            </div>
          </dl>
        </div>
      </DashboardCard>
      <DashboardCard title="Change password">
        <form
          className="grid max-w-md gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await changePassword({ currentPassword, newPassword, confirmPassword });
              setMessage('Password updated.');
            } catch (err) {
              setMessage(apiErrorMessage(err));
            }
          }}
        >
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {message ? <p className="text-sm">{message}</p> : null}
          <button type="submit" className="sls-btn-primary">
            Update password
          </button>
        </form>
      </DashboardCard>
      <DashboardCard title="Sessions">
        <button
          type="button"
          className="rounded-lg border border-[var(--border-color,#e2e8f0)] px-3 py-2 text-sm font-semibold"
          onClick={() => void revokeAllSessions()}
        >
          Log out from all devices
        </button>
      </DashboardCard>
    </div>
  );
}

export function StudentCalendarPage() {
  const authed = useAuthQueryEnabled();
  const now = useMemo(() => new Date(), []);
  const q = useQuery({
    queryKey: ['portal-cal', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => fetchSchoolPortalCalendar(now.getFullYear(), now.getMonth() + 1),
    enabled: authed,
  });
  return (
    <div>
      <PageTitle title="Events & calendar" />
      <NotificationPanel
        items={asList(asRecord(q.data).events ?? q.data)}
        empty="No events this month."
      />
    </div>
  );
}

export function StudentSimpleFeed({
  title,
  hint,
  empty,
  loader,
  queryKey,
}: {
  title: string;
  hint?: string;
  empty: string;
  queryKey: unknown[];
  loader: () => Promise<unknown>;
}) {
  const authed = useAuthQueryEnabled();
  const q = useQuery({ queryKey, queryFn: loader, enabled: authed });
  const data = q.data;
  const items = Array.isArray(data)
    ? data
    : asList(asRecord(data).items ?? asRecord(data).albums ?? asRecord(data).notices);
  return (
    <div>
      <PageTitle title={title} hint={hint} />
      <DashboardCard title={title}>
        <NotificationPanel items={items} empty={empty} />
      </DashboardCard>
    </div>
  );
}

export function StudentSection({ section }: { section: string }) {
  const { childId } = usePortalData();
  switch (section) {
    case 'attendance':
      return <StudentAttendancePage />;
    case 'timetable':
      return <StudentTimetablePage />;
    case 'fees':
      return <StudentFeesPage />;
    case 'messages':
    case 'notifications':
      return <StudentInboxPage />;
    case 'leave':
      return <StudentLeavePage />;
    case 'profile':
      return <StudentProfilePage />;
    case 'calendar':
      return <StudentCalendarPage />;
    case 'exams':
    case 'results':
      return (
        <StudentSimpleFeed
          title={section === 'results' ? 'Examination results' : 'Upcoming examinations'}
          empty="No published examinations yet."
          queryKey={['portal-exams', childId]}
          loader={() => fetchSchoolPortalExams(childId)}
        />
      );
    case 'notices':
    case 'announcements':
      return (
        <StudentSimpleFeed
          title={section === 'announcements' ? 'Announcements' : 'Notices'}
          empty="No notices yet."
          queryKey={['portal-notices']}
          loader={fetchSchoolPortalNotices}
        />
      );
    case 'gallery':
      return (
        <StudentSimpleFeed
          title="School gallery"
          empty="No albums published yet."
          queryKey={['portal-gallery']}
          loader={fetchSchoolPortalGallery}
        />
      );
    case 'transport':
      return (
        <StudentSimpleFeed
          title="Transport"
          empty="No route is assigned to this student yet."
          queryKey={['portal-transport', childId]}
          loader={() => fetchSchoolPortalTransport(childId)}
        />
      );
    case 'homework':
      return (
        <div>
          <PageTitle
            title="Homework / assignments"
            hint="Assignments posted by teachers appear here."
          />
          <p className="portal-empty portal-card">No homework has been posted yet.</p>
        </div>
      );
    case 'materials':
      return (
        <StudentSimpleFeed
          title="Study materials"
          hint="Notices and resources shared by the school."
          empty="No study materials posted yet."
          queryKey={['portal-notices']}
          loader={fetchSchoolPortalNotices}
        />
      );
    case 'lunch':
      return (
        <div>
          <PageTitle title="Lunch menu" hint="Daily meal information from the school timetable." />
          <p className="portal-empty portal-card">
            The lunch menu has not been published for today.
          </p>
        </div>
      );
    case 'stationery':
      return (
        <div>
          <PageTitle title="Stationery" hint="School store items billed to your account." />
          <p className="portal-empty portal-card">No stationery bills are pending.</p>
        </div>
      );
    default:
      return <p className="portal-empty">This section is not available.</p>;
  }
}
