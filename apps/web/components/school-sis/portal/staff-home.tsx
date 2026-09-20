'use client';

import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Inbox,
  KeyRound,
  MessageSquare,
  NotebookPen,
} from 'lucide-react';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import {
  AnnouncementWidget,
  ProfileWidget,
  QuickActionCard,
  TimetableWidget,
} from './portal-widgets';
import { usePortalData, portalDisplayName, portalMe } from './portal-data';
import { asList, asNumber, asRecord, asText } from './portal-utils';

const BASE = '/school-sis-portal/staff';

export function StaffPortalHome() {
  const { home, loading } = usePortalData();
  const me = portalMe(home);
  const staff = asRecord(me.staff);
  const desk = asRecord(home?.desk);
  const classes = asList(desk.classes).map(asRecord);

  if (loading && !home) {
    return <p className="portal-empty">Loading your desk…</p>;
  }

  return (
    <div className="space-y-4">
      <ProfileWidget
        photoUrl={asText(staff.photoUrl, '') || null}
        name={portalDisplayName(home, 'Staff')}
        lines={[
          asText(staff.designation, 'Staff'),
          asText(staff.department, ''),
          asText(me.email, ''),
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SlsKpiCard
          tone="sky"
          icon={CalendarDays}
          label="Today’s periods"
          value={`${asNumber(desk.todayDone)}/${asNumber(desk.todayTotal)}`}
          hint="Completed / scheduled"
          href={`${BASE}/timetable`}
        />
        <SlsKpiCard
          tone="emerald"
          icon={ClipboardCheck}
          label="Assigned classes"
          value={asNumber(desk.classCount)}
          hint={
            asList(desk.classLabels)
              .map((label) => asText(label))
              .slice(0, 2)
              .join(', ') || 'Your sections'
          }
          href={`${BASE}/attendance`}
        />
        <SlsKpiCard
          tone="amber"
          icon={FileText}
          label="Leave remaining"
          value={asNumber(desk.leaveRemaining)}
          hint="Days this year"
          href={`${BASE}/leave`}
        />
        <SlsKpiCard
          tone="violet"
          icon={Inbox}
          label="Unread"
          value={asNumber(home?.unreadCount)}
          hint="Messages"
          href={`${BASE}/messages`}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <QuickActionCard
            href={`${BASE}/attendance/mark`}
            icon={ClipboardCheck}
            label="Mark attendance"
          />
          <QuickActionCard href={`${BASE}/marks`} icon={FileText} label="Enter marks" />
          <QuickActionCard href={`${BASE}/homework`} icon={NotebookPen} label="Create homework" />
          <QuickActionCard href={`${BASE}/messages`} icon={MessageSquare} label="Send message" />
          <QuickActionCard href={`${BASE}/timetable`} icon={CalendarDays} label="View timetable" />
          <QuickActionCard href={`${BASE}/leave`} icon={KeyRound} label="Apply leave" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TimetableWidget slots={desk.todaySchedule} href={`${BASE}/timetable`} />
        <AnnouncementWidget items={home?.notices} href={`${BASE}/notices`} title="Class notices" />
        <section className="portal-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Assigned classes</h2>
          {classes.length ? (
            <ul className="space-y-2 text-sm">
              {classes.map((row) => (
                <li key={asText(row.id)} className="flex items-center justify-between">
                  <span className="font-semibold">{asText(row.label)}</span>
                  <span className="text-xs text-[var(--muted-foreground,#64748b)]">
                    {asText(row.students)} students
                    {row.percent != null ? ` · ${Math.round(asNumber(row.percent))}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-empty px-0 py-2">No class assignments yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
