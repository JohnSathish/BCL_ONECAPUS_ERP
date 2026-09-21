'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changePassword, revokeAllSessions } from '@/services/student-portal';
import {
  fetchHrLeaveRequests,
  fetchHrLeaveTypes,
  fetchSchoolExamDashboard,
  requestHrLeave,
} from '@/services/school-sis';
import {
  fetchSchoolPortalInbox,
  fetchSchoolPortalNotices,
  fetchSchoolPortalHrMe,
  markSchoolPortalInboxReadAll,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { DashboardCard, NotificationPanel, PortalAvatar } from './portal-widgets';
import { StaffAttendanceMarkPage } from './staff-attendance-mark-page';
import { StaffAttendanceHistoryPage } from './staff-attendance-history-page';
import { StaffHomeworkPage } from './staff-homework-page';
import { StaffMarksPage } from './staff-marks-page';
import { StaffTimetablePage } from './staff-timetable-page';
import { AttendanceReportsDesk } from '../reports/attendance-reports-desk';
import { usePortalData, portalDisplayName, portalMe } from './portal-data';
import { asList, asNumber, asRecord, asText, formatDay } from './portal-utils';

function Title({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-[var(--muted-foreground,#64748b)]">{hint}</p> : null}
    </div>
  );
}

export { StaffAttendanceMarkPage };

export function StaffLeavePage() {
  const authed = useAuthQueryEnabled();
  const hr = useQuery({
    queryKey: ['portal-hr-me'],
    queryFn: fetchSchoolPortalHrMe,
    enabled: authed,
  });
  const staffId = asText(asRecord(hr.data).id ?? asRecord(asRecord(hr.data).staff).id, '');
  const types = useQuery({
    queryKey: ['hr-leave-types'],
    queryFn: fetchHrLeaveTypes,
    enabled: authed,
    retry: false,
  });
  const requests = useQuery({
    queryKey: ['hr-leave-mine'],
    queryFn: () => fetchHrLeaveRequests(),
    enabled: authed,
    retry: false,
  });
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => requestHrLeave({ staffId, ...form }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      <Title title="Leave" hint="Apply and track your own leave." />
      <DashboardCard title="Apply leave">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <select
            required
            value={form.leaveTypeId}
            onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
          >
            <option value="">Leave type</option>
            {asList(types.data).map((row) => {
              const item = asRecord(row);
              return (
                <option key={asText(item.id)} value={asText(item.id)}>
                  {asText(item.name)}
                </option>
              );
            })}
          </select>
          <input
            type="date"
            required
            value={form.fromDate}
            onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
          />
          <input
            type="date"
            required
            value={form.toDate}
            onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
          />
          <textarea
            className="sm:col-span-2"
            placeholder="Reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
          {error ? <p className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
          <button
            className="sls-btn-primary sm:col-span-2"
            type="submit"
            disabled={save.isPending || !staffId}
          >
            Submit
          </button>
        </form>
      </DashboardCard>
      <DashboardCard title="Leave status">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {asList(requests.data).map((row, i) => {
              const item = asRecord(row);
              return (
                <tr key={i}>
                  <td>
                    {formatDay(asText(item.fromDate))} – {formatDay(asText(item.toDate))}
                  </td>
                  <td>{asText(item.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DashboardCard>
    </div>
  );
}

export function StaffSection({ section }: { section: string }) {
  const authed = useAuthQueryEnabled();
  const { home } = usePortalData();
  const me = portalMe(home);
  const staff = asRecord(me.staff);
  const qc = useQueryClient();

  if (section === 'attendance/mark' || section === 'mark') return <StaffAttendanceMarkPage />;
  if (section === 'leave') return <StaffLeavePage />;
  if (section === 'marks') return <StaffMarksPage />;

  if (section === 'timetable') return <StaffTimetablePage />;
  if (section === 'reports') return <AttendanceReportsDesk />;
  if (section === 'attendance') {
    return <StaffAttendanceHistoryPage />;
  }
  if (section === 'messages') {
    return <StaffInbox onRead={() => qc.invalidateQueries({ queryKey: ['portal-inbox'] })} />;
  }
  if (section === 'notices' || section === 'materials') {
    return (
      <div>
        <Title title={section === 'materials' ? 'Teaching materials' : 'Class notices'} />
        <StaffNotices />
      </div>
    );
  }
  if (section === 'homework') return <StaffHomeworkPage />;
  if (section === 'exams' || section === 'performance') {
    return (
      <StaffExams
        title={section === 'performance' ? 'Student performance' : 'Examination schedule'}
      />
    );
  }
  if (section === 'calendar') {
    return (
      <div>
        <Title title="Events" />
        <NotificationPanel items={home?.events} empty="No upcoming events." />
      </div>
    );
  }
  if (section === 'profile' || section === 'password') {
    return (
      <StaffProfilePage
        passwordOnly={section === 'password'}
        staff={staff}
        name={portalDisplayName(home)}
      />
    );
  }
  return <p className="portal-empty">This section is not available.</p>;
}

function StaffInbox({ onRead }: { onRead: () => void }) {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['portal-inbox'],
    queryFn: fetchSchoolPortalInbox,
    enabled: authed,
  });
  return (
    <div>
      <Title title="Messages" />
      <button
        type="button"
        className="sls-btn-primary mb-3"
        onClick={() => markSchoolPortalInboxReadAll().then(onRead)}
      >
        Mark all read
      </button>
      <NotificationPanel items={q.data?.items} />
    </div>
  );
}

function StaffNotices() {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['portal-notices'],
    queryFn: fetchSchoolPortalNotices,
    enabled: authed,
  });
  return <NotificationPanel items={q.data} empty="No notices yet." />;
}

function StaffExams({ title }: { title: string }) {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['exam-dashboard'],
    queryFn: fetchSchoolExamDashboard,
    enabled: authed,
    retry: false,
  });
  return (
    <div>
      <Title title={title} />
      <NotificationPanel
        items={asList(asRecord(q.data).exams ?? asRecord(q.data).upcomingList)}
        empty="No examinations scheduled."
      />
    </div>
  );
}

function StaffProfilePage({
  passwordOnly,
  staff,
  name,
}: {
  passwordOnly: boolean;
  staff: Record<string, unknown>;
  name: string;
}) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Title title={passwordOnly ? 'Change password' : 'Staff profile'} />
      {passwordOnly ? null : (
        <DashboardCard title="Profile">
          <div className="flex gap-4">
            <PortalAvatar src={asText(staff.photoUrl, '') || null} name={name} size={72} />
            <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Name</dt>
                <dd className="font-semibold">{asText(staff.fullName, name)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Designation</dt>
                <dd>{asText(staff.designation)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground,#64748b)]">Department</dt>
                <dd>{asText(staff.department)}</dd>
              </div>
            </dl>
          </div>
        </DashboardCard>
      )}
      <DashboardCard title="Password">
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
            placeholder="Current"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <input
            type="password"
            placeholder="New"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {message ? <p className="text-sm">{message}</p> : null}
          <button className="sls-btn-primary" type="submit">
            Update password
          </button>
        </form>
      </DashboardCard>
      <button
        type="button"
        className="rounded-lg border px-3 py-2 text-sm font-semibold"
        onClick={() => void revokeAllSessions()}
      >
        Log out from all devices
      </button>
    </div>
  );
}
