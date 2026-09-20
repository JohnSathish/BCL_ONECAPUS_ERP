'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchHrLeaveRequests,
  fetchSchoolSisApplications,
  fetchSchoolSisOverview,
  reviewHrLeave,
  reviewSchoolAttendanceLeave,
  fetchSchoolAttendanceLeave,
} from '@/services/school-sis';
import { fetchSmsDashboard, sendSmsCampaign } from '@/services/school-sms';
import { fetchSchoolWaDashboard, sendSchoolWaText } from '@/services/school-whatsapp';
import { sendSchoolMobileBroadcast } from '@/services/school-mobile';
import {
  fetchSchoolPrincipalAcademics,
  fetchSchoolPrincipalAttendance,
  fetchSchoolPrincipalDesk,
  fetchSchoolPrincipalExams,
  fetchSchoolPrincipalFees,
  fetchSchoolPrincipalStudents,
  fetchSchoolPrincipalTeachers,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { DashboardCard, NotificationPanel, PortalKpi } from './portal-widgets';
import { asList, asNumber, asRecord, asText, moneyPaise, percentLabel } from './portal-utils';

function Title({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-[var(--muted-foreground,#64748b)]">{hint}</p> : null}
    </div>
  );
}

export function PrincipalSection({ section }: { section: string }) {
  if (section === 'students') {
    return <PeopleList kind="students" />;
  }
  if (section === 'staff') {
    return <PeopleList kind="staff" />;
  }
  if (section === 'attendance') {
    return <PrincipalAttendance />;
  }
  if (section === 'leave') {
    return <PrincipalLeave />;
  }
  if (section === 'admissions') {
    return <PrincipalAdmissions />;
  }
  if (section === 'fees') {
    return <PrincipalFees />;
  }
  if (section === 'exams') {
    return <PrincipalExams />;
  }
  if (section === 'communication') {
    return <PrincipalCommunication />;
  }
  if (section === 'reports') {
    return <PrincipalReports />;
  }
  return <p className="portal-empty">This section is not available.</p>;
}

function PeopleList({ kind }: { kind: 'students' | 'staff' }) {
  const authed = useAuthQueryEnabled();
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['principal', kind, q],
    queryFn: () =>
      kind === 'students' ? fetchSchoolPrincipalStudents(q) : fetchSchoolPrincipalTeachers(q),
    enabled: authed,
  });
  const items = asList(asRecord(query.data).items);
  return (
    <div>
      <Title
        title={kind === 'students' ? 'Students' : 'Staff'}
        hint="School-wide directory. Private student records stay scoped by role."
      />
      <input
        className="mb-3 w-full max-w-sm"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>{kind === 'students' ? 'Admission' : 'Employee'}</th>
              <th>{kind === 'students' ? 'Class' : 'Designation'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const item = asRecord(row);
              return (
                <tr key={asText(item.id)}>
                  <td>{asText(item.fullName)}</td>
                  <td>{asText(item.admissionNumber ?? item.employeeCode)}</td>
                  <td>{asText(item.classLabel ?? item.designation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrincipalAttendance() {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['principal-att'],
    queryFn: fetchSchoolPrincipalAttendance,
    enabled: authed,
  });
  const data = asRecord(q.data);
  const totals = asRecord(data.totals);
  const byClass = asList(data.byClass).map(asRecord);
  return (
    <div className="space-y-4">
      <Title title="Attendance" hint="Today’s school-wide register." />
      <div className="grid gap-3 sm:grid-cols-4">
        <PortalKpi label="Present" value={asNumber(totals.present)} />
        <PortalKpi label="Absent" value={asNumber(totals.absent)} />
        <PortalKpi label="Late" value={asNumber(totals.late)} />
        <PortalKpi label="Percent" value={percentLabel(totals.percent)} />
      </div>
      <DashboardCard title="Class-wise">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>%</th>
              <th>Absent</th>
            </tr>
          </thead>
          <tbody>
            {byClass.map((row, i) => (
              <tr key={i}>
                <td>{asText(row.label ?? row.name)}</td>
                <td>{percentLabel(row.percent)}</td>
                <td>{asText(row.absent, '0')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DashboardCard>
    </div>
  );
}

function PrincipalLeave() {
  const authed = useAuthQueryEnabled();
  const qc = useQueryClient();
  const hr = useQuery({
    queryKey: ['hr-leaves-pending'],
    queryFn: () => fetchHrLeaveRequests({ status: 'PENDING' }),
    enabled: authed,
    retry: false,
  });
  const student = useQuery({
    queryKey: ['att-leaves-pending'],
    queryFn: () => fetchSchoolAttendanceLeave({ status: 'PENDING' }),
    enabled: authed,
    retry: false,
  });
  return (
    <div className="space-y-4">
      <Title title="Leave approvals" hint="Staff HR leave and student attendance leave." />
      <DashboardCard title="Staff leave">
        {asList(hr.data).map((row) => {
          const item = asRecord(row);
          return (
            <div
              key={asText(item.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle,#e8edf5)] py-2 text-sm"
            >
              <span>
                {asText(asRecord(item.staff).fullName, 'Staff')} · {asText(item.status)}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="sls-btn-primary h-8 px-3"
                  onClick={() =>
                    reviewHrLeave(asText(item.id), true).then(() =>
                      qc.invalidateQueries({ queryKey: ['hr-leaves-pending'] }),
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-3 text-xs font-semibold"
                  onClick={() =>
                    reviewHrLeave(asText(item.id), false).then(() =>
                      qc.invalidateQueries({ queryKey: ['hr-leaves-pending'] }),
                    )
                  }
                >
                  Reject
                </button>
              </span>
            </div>
          );
        })}
        {!asList(hr.data).length ? (
          <p className="portal-empty px-0">No staff leave waiting.</p>
        ) : null}
      </DashboardCard>
      <DashboardCard title="Student leave">
        {asList(student.data).map((row) => {
          const item = asRecord(row);
          return (
            <div
              key={asText(item.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
            >
              <span>
                {asText(asRecord(item.student).fullName)} · {asText(item.status)}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="sls-btn-primary h-8 px-3"
                  onClick={() =>
                    reviewSchoolAttendanceLeave(asText(item.id), true).then(() =>
                      qc.invalidateQueries({ queryKey: ['att-leaves-pending'] }),
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-3 text-xs font-semibold"
                  onClick={() =>
                    reviewSchoolAttendanceLeave(asText(item.id), false).then(() =>
                      qc.invalidateQueries({ queryKey: ['att-leaves-pending'] }),
                    )
                  }
                >
                  Reject
                </button>
              </span>
            </div>
          );
        })}
        {!asList(student.data).length ? (
          <p className="portal-empty px-0">No student leave waiting.</p>
        ) : null}
      </DashboardCard>
    </div>
  );
}

function PrincipalAdmissions() {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['sis-apps'],
    queryFn: () => fetchSchoolSisApplications(),
    enabled: authed,
    retry: false,
  });
  const items = asList(q.data).map(asRecord);
  return (
    <div>
      <Title title="Applications / admissions" />
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <PortalKpi label="Total" value={items.length} />
        <PortalKpi
          label="Pending"
          value={items.filter((row) => /pend|submit|review/i.test(asText(row.status))).length}
        />
        <PortalKpi
          label="Approved"
          value={items.filter((row) => /offer|approv|admit/i.test(asText(row.status))).length}
        />
      </div>
      <div className="overflow-x-auto portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Number</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={asText(row.id)}>
                <td>{asText(row.fullName)}</td>
                <td>{asText(row.applicationNumber)}</td>
                <td>{asText(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrincipalFees() {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['principal-fees'],
    queryFn: fetchSchoolPrincipalFees,
    enabled: authed,
  });
  const data = asRecord(q.data);
  return (
    <div className="space-y-4">
      <Title title="Fees" />
      <div className="grid gap-3 sm:grid-cols-3">
        <PortalKpi label="This month" value={moneyPaise(data.monthCollection)} />
        <PortalKpi label="Pending" value={moneyPaise(data.pendingFees)} />
        <PortalKpi label="Today" value={moneyPaise(data.todayCollection ?? data.collectedToday)} />
      </div>
      <DashboardCard title="By class">
        <NotificationPanel items={data.byClass} empty="No fee lines." />
      </DashboardCard>
    </div>
  );
}

function PrincipalExams() {
  const authed = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['principal-exams'],
    queryFn: fetchSchoolPrincipalExams,
    enabled: authed,
  });
  const data = asRecord(q.data);
  return (
    <div className="space-y-4">
      <Title title="Examinations" />
      <div className="grid gap-3 sm:grid-cols-3">
        <PortalKpi label="Upcoming" value={asNumber(data.upcoming)} />
        <PortalKpi label="Ongoing" value={asNumber(data.ongoing)} />
        <PortalKpi label="Marks pending" value={asNumber(data.marksPending)} />
      </div>
      <NotificationPanel items={data.exams} empty="No examinations." />
    </div>
  );
}

function PrincipalCommunication() {
  const authed = useAuthQueryEnabled();
  const sms = useQuery({
    queryKey: ['sms-dash'],
    queryFn: fetchSmsDashboard,
    enabled: authed,
    retry: false,
  });
  const wa = useQuery({
    queryKey: ['wa-dash'],
    queryFn: fetchSchoolWaDashboard,
    enabled: authed,
    retry: false,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const announce = useMutation({
    mutationFn: () => sendSchoolMobileBroadcast({ title, body, audience: 'all' }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const smsSend = useMutation({
    mutationFn: () =>
      sendSmsCampaign({ name: title || 'Announcement', message: body, audience: 'all' }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const waSend = useMutation({
    mutationFn: () => sendSchoolWaText({ message: body, audience: 'all' }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      <Title
        title="Communication"
        hint="Announcements use the same notification, SMS and WhatsApp services as the office ERP."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <PortalKpi
          label="SMS"
          value={asText(asRecord(sms.data).sentToday ?? asRecord(sms.data).sent, '—')}
        />
        <PortalKpi
          label="WhatsApp"
          value={asText(asRecord(wa.data).sentToday ?? asRecord(wa.data).sent, '—')}
        />
      </div>
      <DashboardCard title="Send announcement">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            announce.mutate();
          }}
        >
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="sls-btn-primary">
              Send announcement
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm font-semibold"
              onClick={() => smsSend.mutate()}
            >
              Send SMS
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm font-semibold"
              onClick={() => waSend.mutate()}
            >
              Send WhatsApp
            </button>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}

function PrincipalReports() {
  const authed = useAuthQueryEnabled();
  const desk = useQuery({
    queryKey: ['principal-desk'],
    queryFn: fetchSchoolPrincipalDesk,
    enabled: authed,
  });
  const academics = useQuery({
    queryKey: ['principal-acad'],
    queryFn: fetchSchoolPrincipalAcademics,
    enabled: authed,
  });
  const overview = useQuery({
    queryKey: ['sis-overview'],
    queryFn: fetchSchoolSisOverview,
    enabled: authed,
    retry: false,
  });
  return (
    <div className="space-y-4">
      <Title title="Reports" hint="Live school-wide snapshot from the same ERP data." />
      <div className="grid gap-3 sm:grid-cols-3">
        <PortalKpi label="Students" value={asNumber(asRecord(desk.data?.kpis).students)} />
        <PortalKpi label="Subjects" value={asNumber(academics.data?.subjects)} />
        <PortalKpi
          label="Open applications"
          value={asNumber(asRecord(overview.data?.counts).openApplications)}
        />
      </div>
      <DashboardCard title="Classes">
        <NotificationPanel items={asRecord(academics.data).classes} empty="No classes." />
      </DashboardCard>
    </div>
  );
}
