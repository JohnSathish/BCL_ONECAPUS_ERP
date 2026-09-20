'use client';

import {
  Bell,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Inbox,
  NotebookPen,
} from 'lucide-react';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import {
  AnnouncementWidget,
  AttendanceWidget,
  EventWidget,
  ExamWidget,
  FeeWidget,
  ProfileWidget,
  QuickActionCard,
  TimetableWidget,
} from './portal-widgets';
import { usePortalData, portalDisplayName, portalMe, portalStudent } from './portal-data';
import { asList, asNumber, asRecord, asText, moneyPaise, weekdayName } from './portal-utils';

const BASE = '/school-sis-portal/student';

function todaySlots(timetable: unknown) {
  const grid = asRecord(timetable);
  const slots = asList(grid.slots).map(asRecord);
  const today = new Date().getDay();
  const daySlots = slots.filter((slot) => Number(slot.dayOfWeek) === today);
  return daySlots.map((slot) => {
    const subject = asRecord(slot.subject);
    const section = asRecord(slot.section);
    const bell = asRecord(slot.bell);
    return {
      id: asText(slot.id),
      subject: asText(subject.name, 'Period'),
      classLabel: `${asText(asRecord(section.grade).name, '')} ${asText(section.name, '')}`.trim(),
      start: asText(bell.startTime),
      end: asText(bell.endTime),
    };
  });
}

function feeSummary(fees: unknown) {
  const pack = asRecord(fees);
  const monthly = asRecord(pack.monthly);
  const pending = monthly.pendingFees ?? monthly.pending ?? pack.pending ?? pack.balance;
  const paid = monthly.collected ?? pack.paid;
  return {
    pending: pending != null ? moneyPaise(pending) : asText(pack.status, 'See details'),
    paid: paid != null ? moneyPaise(paid) : '',
  };
}

export function StudentPortalHome() {
  const { home, loading } = usePortalData();
  const me = portalMe(home);
  const student = portalStudent(home);
  const att = asRecord(home?.attendance);
  const fees = feeSummary(home?.fees);
  const exams = asList(home?.exams).map(asRecord);
  const greeting = asText(home?.greeting, 'Welcome');

  if (loading && !home) {
    return <p className="portal-empty">Loading your dashboard…</p>;
  }

  return (
    <div className="space-y-4">
      <ProfileWidget
        photoUrl={asText(student.photoUrl, '') || null}
        name={`${greeting}, ${portalDisplayName(home, 'student')}`}
        lines={[
          asText(student.admissionNumber) !== '—' ? `Adm. ${asText(student.admissionNumber)}` : '',
          asText(student.classLabel),
          asText(student.academicYearName),
          asText(me.email, ''),
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SlsKpiCard
          tone="sky"
          icon={ClipboardCheck}
          label="Attendance"
          value={att.percent == null ? '—' : `${Math.round(asNumber(att.percent))}%`}
          hint="This month"
          href={`${BASE}/attendance`}
        />
        <SlsKpiCard
          tone="amber"
          icon={CreditCard}
          label="Fee status"
          value={fees.pending}
          hint={fees.paid ? `Paid ${fees.paid}` : 'Current dues'}
          href={`${BASE}/fees`}
        />
        <SlsKpiCard
          tone="violet"
          icon={FileText}
          label="Upcoming exams"
          value={exams.length}
          hint="Published schedule"
          href={`${BASE}/exams`}
        />
        <SlsKpiCard
          tone="emerald"
          icon={Inbox}
          label="Unread"
          value={asNumber(home?.unreadCount)}
          hint="Messages & alerts"
          href={`${BASE}/messages`}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Quick access
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <QuickActionCard href={`${BASE}/attendance`} icon={ClipboardCheck} label="Attendance" />
          <QuickActionCard href={`${BASE}/timetable`} icon={CalendarDays} label="Timetable" />
          <QuickActionCard href={`${BASE}/homework`} icon={NotebookPen} label="Homework" />
          <QuickActionCard href={`${BASE}/fees`} icon={CreditCard} label="Pay fees" />
          <QuickActionCard href={`${BASE}/exams`} icon={FileText} label="Exams" />
          <QuickActionCard href={`${BASE}/messages`} icon={Bell} label="Inbox" />
          <QuickActionCard href={`${BASE}/materials`} icon={BookOpen} label="Materials" />
          <QuickActionCard href={`${BASE}/transport`} icon={Bus} label="Transport" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TimetableWidget slots={todaySlots(home?.timetable)} href={`${BASE}/timetable`} />
        <AttendanceWidget
          percent={att.percent}
          present={att.present}
          absent={att.absent}
          late={att.late}
          href={`${BASE}/attendance`}
        />
        <AnnouncementWidget items={home?.notices} href={`${BASE}/notices`} />
        <EventWidget items={home?.events} href={`${BASE}/calendar`} />
        <ExamWidget items={exams} href={`${BASE}/exams`} />
        <FeeWidget pending={fees.pending} paid={fees.paid} href={`${BASE}/fees`} />
      </div>
      <p className="text-center text-[0.7rem] text-[var(--muted-foreground,#64748b)]">
        {weekdayName(new Date().getDay())} · Web portal is the full alternative to the mobile app.
      </p>
    </div>
  );
}
