'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changePassword, revokeAllSessions } from '@/services/student-portal';
import {
  fetchHrLeaveRequests,
  fetchHrLeaveTypes,
  fetchSchoolExamDashboard,
  fetchSchoolExamMarksRoster,
  saveSchoolExamMarks,
  requestHrLeave,
} from '@/services/school-sis';
import {
  fetchSchoolPortalInbox,
  fetchSchoolPortalNotices,
  fetchSchoolPortalTimetable,
  fetchSchoolTeacherToday,
  fetchSchoolPortalHrMe,
  fetchSchoolPortalRoster,
  submitSchoolPortalAttendance,
  markSchoolPortalInboxReadAll,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { DashboardCard, NotificationPanel, PortalAvatar, TimetableWidget } from './portal-widgets';
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

export function StaffAttendanceMarkPage() {
  const authed = useAuthQueryEnabled();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [sectionId, setSectionId] = useState('');
  const tasks = useQuery({
    queryKey: ['teacher-today', date],
    queryFn: () => fetchSchoolTeacherToday(date),
    enabled: authed,
  });
  const roster = useQuery({
    queryKey: ['portal-roster', date, sectionId],
    queryFn: () => fetchSchoolPortalRoster({ date, sectionId }),
    enabled: authed && Boolean(sectionId),
  });
  const periodRows = asList(asRecord(tasks.data).periods).map(asRecord);
  const classRows = asList(asRecord(tasks.data).classes).map(asRecord);
  const seen = new Set<string>();
  const sections = [...classRows, ...periodRows].filter((row) => {
    const id = asText(row.sectionId ?? row.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const students = asList(asRecord(roster.data).students ?? asRecord(roster.data).rows).map(
    asRecord,
  );
  const academicYearId = asText(asRecord(asRecord(roster.data).academicYear).id, '');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      submitSchoolPortalAttendance({
        academicYearId,
        date,
        sectionId,
        records: students.map((row) => ({
          studentId: asText(row.studentId ?? row.id),
          statusCode: marks[asText(row.studentId ?? row.id)] || asText(row.status, 'PRESENT'),
        })),
      }),
    onError: (err) => setError(apiErrorMessage(err)),
    onSuccess: () => setError(null),
  });

  return (
    <div className="space-y-4">
      <Title title="Mark student attendance" hint="Same live register used by the mobile app." />
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Select class</option>
          {sections.map((row) => (
            <option key={asText(row.sectionId ?? row.id)} value={asText(row.sectionId ?? row.id)}>
              {asText(row.label ?? row.name ?? row.classLabel)}
            </option>
          ))}
        </select>
      </div>
      {!sections.length ? (
        <p className="portal-empty portal-card">No attendance tasks for this date.</p>
      ) : null}
      {students.length ? (
        <DashboardCard title="Roster">
          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => {
                  const id = asText(row.studentId ?? row.id);
                  return (
                    <tr key={id}>
                      <td>{asText(row.fullName ?? asRecord(row.student).fullName)}</td>
                      <td>
                        <select
                          value={marks[id] || asText(row.status, 'PRESENT')}
                          onChange={(e) => setMarks((m) => ({ ...m, [id]: e.target.value }))}
                        >
                          {['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'EXCUSED'].map(
                            (code) => (
                              <option key={code} value={code}>
                                {code.replace('_', ' ')}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
          <button
            type="button"
            className="sls-btn-primary mt-3"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Submit attendance
          </button>
        </DashboardCard>
      ) : null}
    </div>
  );
}

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

export function StaffMarksPage() {
  const authed = useAuthQueryEnabled();
  const { home } = usePortalData();
  const classes = asList(asRecord(home?.desk).classes).map(asRecord);
  const exams = useQuery({
    queryKey: ['exam-dashboard'],
    queryFn: fetchSchoolExamDashboard,
    enabled: authed,
    retry: false,
  });
  const examList = asList(asRecord(exams.data).exams ?? exams.data).map(asRecord);
  const [examId, setExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [componentId, setComponentId] = useState('');
  const roster = useQuery({
    queryKey: ['marks-roster', examId, sectionId, componentId],
    queryFn: () => fetchSchoolExamMarksRoster({ examId, sectionId, componentId }),
    enabled: authed && Boolean(examId && sectionId && componentId),
    retry: false,
  });
  const rows = asList(asRecord(roster.data).students ?? asRecord(roster.data).rows).map(asRecord);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveSchoolExamMarks({
        examId,
        sectionId,
        componentId,
        marks: rows.map((row) => ({
          studentId: asText(row.studentId ?? row.id),
          score: Number(scores[asText(row.studentId ?? row.id)] || row.score || 0),
        })),
      }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      <Title title="Mark entry" hint="Enter marks for classes you are authorised to manage." />
      <div className="flex flex-wrap gap-2">
        <select value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">Exam</option>
          {examList.map((row) => (
            <option key={asText(row.id)} value={asText(row.id)}>
              {asText(row.name)}
            </option>
          ))}
        </select>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Class</option>
          {classes.map((row) => (
            <option key={asText(row.id)} value={asText(row.id)}>
              {asText(row.label)}
            </option>
          ))}
        </select>
        <input
          placeholder="Component ID"
          value={componentId}
          onChange={(e) => setComponentId(e.target.value)}
        />
      </div>
      {rows.length ? (
        <DashboardCard title="Roster">
          {rows.map((row) => {
            const id = asText(row.studentId ?? row.id);
            return (
              <div key={id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{asText(row.fullName ?? asRecord(row.student).fullName)}</span>
                <input
                  className="w-24"
                  value={scores[id] ?? asText(row.score, '')}
                  onChange={(e) => setScores((s) => ({ ...s, [id]: e.target.value }))}
                />
              </div>
            );
          })}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button type="button" className="sls-btn-primary mt-2" onClick={() => save.mutate()}>
            Save marks
          </button>
        </DashboardCard>
      ) : (
        <p className="portal-empty portal-card">
          Choose an exam and class to load the mark roster.
        </p>
      )}
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

  if (section === 'timetable') {
    return (
      <div>
        <Title title="Timetable" />
        <TimetableWidget slots={asRecord(home?.desk).todaySchedule} />
        <StaffTimetableGrid enabled={authed} />
      </div>
    );
  }
  if (section === 'attendance') {
    return (
      <div>
        <Title title="Attendance history" hint="Class-wise summary from your assigned sections." />
        <DashboardCard title="Classes">
          <ul className="space-y-2 text-sm">
            {asList(asRecord(home?.desk).classes).map((row) => {
              const item = asRecord(row);
              return (
                <li key={asText(item.id)} className="flex justify-between">
                  <span>{asText(item.label)}</span>
                  <span>
                    {item.percent == null ? '—' : `${Math.round(asNumber(item.percent))}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </DashboardCard>
      </div>
    );
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
  if (section === 'homework') {
    return (
      <div>
        <Title title="Homework" hint="Create and review assignments for your classes." />
        <p className="portal-empty portal-card">
          No homework has been posted yet. New assignments will appear here for the same classes as
          the mobile app.
        </p>
      </div>
    );
  }
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

function StaffTimetableGrid({ enabled }: { enabled: boolean }) {
  const q = useQuery({
    queryKey: ['staff-tt'],
    queryFn: () => fetchSchoolPortalTimetable(),
    enabled,
  });
  const slots = asList(asRecord(q.data).slots).map(asRecord);
  return (
    <div className="mt-4 overflow-x-auto portal-card">
      <table className="portal-table min-w-[36rem]">
        <thead>
          <tr>
            <th>Day</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={asText(slot.id)}>
              <td>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(slot.dayOfWeek)]}</td>
              <td>
                {`${asText(asRecord(asRecord(slot.section).grade).name)} ${asText(asRecord(slot.section).name)}`.trim()}
              </td>
              <td>{asText(asRecord(slot.subject).name)}</td>
              <td>
                {asText(asRecord(slot.bell).startTime)}–{asText(asRecord(slot.bell).endTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
