'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageSquare,
  School,
  Users,
} from 'lucide-react';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import { fetchSchoolSisOverview } from '@/services/school-sis';
import { fetchSmsDashboard } from '@/services/school-sms';
import { fetchSchoolWaDashboard } from '@/services/school-whatsapp';
import { fetchHrLeaveRequests } from '@/services/school-sis';
import { fetchSchoolSisApplications } from '@/services/school-sis';
import { fetchSchoolPrincipalDesk } from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { AnnouncementWidget, ProfileWidget, QuickActionCard } from './portal-widgets';
import { usePortalData, portalDisplayName, portalMe } from './portal-data';
import { asList, asNumber, asRecord, asText, moneyPaise, percentLabel } from './portal-utils';

const BASE = '/school-sis-portal/principal';

export function PrincipalPortalHome() {
  const authed = useAuthQueryEnabled();
  const { home } = usePortalData();
  const me = portalMe(home);
  const staff = asRecord(me.staff);
  const deskQ = useQuery({
    queryKey: ['school-principal-desk'],
    queryFn: fetchSchoolPrincipalDesk,
    enabled: authed,
  });
  const overviewQ = useQuery({
    queryKey: ['school-sis-overview'],
    queryFn: fetchSchoolSisOverview,
    enabled: authed,
  });
  const smsQ = useQuery({
    queryKey: ['school-sms-dashboard'],
    queryFn: fetchSmsDashboard,
    enabled: authed,
    retry: false,
  });
  const waQ = useQuery({
    queryKey: ['school-wa-dashboard'],
    queryFn: fetchSchoolWaDashboard,
    enabled: authed,
    retry: false,
  });
  const leaveQ = useQuery({
    queryKey: ['school-hr-leaves', 'PENDING'],
    queryFn: () => fetchHrLeaveRequests({ status: 'PENDING' }),
    enabled: authed,
    retry: false,
  });
  const appsQ = useQuery({
    queryKey: ['school-sis-applications'],
    queryFn: () => fetchSchoolSisApplications(),
    enabled: authed,
    retry: false,
  });

  const desk = asRecord(deskQ.data);
  const kpis = asRecord(desk.kpis);
  const counts = asRecord(overviewQ.data?.counts);
  const gender = asRecord(overviewQ.data?.gender);
  const sms = asRecord(smsQ.data);
  const wa = asRecord(waQ.data);
  const leaves = asList(leaveQ.data);
  const applications = asList(appsQ.data).map(asRecord);
  const pendingApps = applications.filter((row) =>
    ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(asText(row.status).toUpperCase()),
  ).length;
  const approvedApps = applications.filter((row) =>
    ['OFFERED', 'APPROVED', 'ADMITTED'].includes(asText(row.status).toUpperCase()),
  ).length;
  const rejectedApps = applications.filter((row) =>
    ['REJECTED', 'CANCELLED'].includes(asText(row.status).toUpperCase()),
  ).length;

  return (
    <div className="space-y-5">
      <ProfileWidget
        photoUrl={asText(staff.photoUrl, '') || null}
        name={portalDisplayName(home, 'Principal')}
        lines={[asText(staff.designation, 'Principal'), asText(asRecord(desk.year).name, '')]}
      />

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Students
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SlsKpiCard
            tone="sky"
            icon={GraduationCap}
            label="Active students"
            value={asNumber(kpis.students || counts.students)}
            href={`${BASE}/students`}
          />
          <SlsKpiCard
            tone="violet"
            icon={Users}
            label="Boys / Girls"
            value={`${asNumber(gender.male)} / ${asNumber(gender.female)}`}
            href={`${BASE}/students`}
          />
          <SlsKpiCard
            tone="emerald"
            icon={School}
            label="New applications"
            value={asNumber(counts.openApplications || applications.length)}
            href={`${BASE}/admissions`}
          />
          <SlsKpiCard
            tone="amber"
            icon={FileText}
            label="Classes"
            value={asNumber(kpis.classes || counts.sections)}
            href={`${BASE}/students`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Staff
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SlsKpiCard
            tone="sky"
            icon={Users}
            label="Teaching staff"
            value={asNumber(kpis.teachers || counts.teachingStaff)}
            href={`${BASE}/staff`}
          />
          <SlsKpiCard
            tone="cyan"
            icon={Users}
            label="Non-teaching"
            value={asNumber(counts.nonTeachingStaff)}
            href={`${BASE}/staff`}
          />
          <SlsKpiCard
            tone="rose"
            icon={ClipboardCheck}
            label="Leave requests"
            value={leaves.length}
            hint="Awaiting approval"
            href={`${BASE}/leave`}
          />
          <SlsKpiCard
            tone="emerald"
            icon={ClipboardCheck}
            label="Today marked"
            value={`${asNumber(kpis.classesMarked)}/${asNumber(kpis.classesTotal)}`}
            href={`${BASE}/attendance`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Attendance · Academics · Fees
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SlsKpiCard
            tone="emerald"
            icon={ClipboardCheck}
            label="Today’s attendance"
            value={percentLabel(kpis.attendanceToday)}
            hint={`${asNumber(kpis.present)} present · ${asNumber(kpis.absent)} absent`}
            href={`${BASE}/attendance`}
          />
          <SlsKpiCard
            tone="amber"
            icon={FileText}
            label="Exams upcoming"
            value={asNumber(kpis.examsUpcoming)}
            hint={`${asNumber(kpis.marksPending)} marks pending`}
            href={`${BASE}/exams`}
          />
          <SlsKpiCard
            tone="sky"
            icon={CreditCard}
            label="Collected this month"
            value={moneyPaise(kpis.feeCollectedMonth)}
            href={`${BASE}/fees`}
          />
          <SlsKpiCard
            tone="rose"
            icon={CreditCard}
            label="Pending fees"
            value={moneyPaise(kpis.feePending)}
            hint={`${asNumber(kpis.feePendingStudents)} students`}
            href={`${BASE}/fees`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Communication · Admissions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SlsKpiCard
            tone="sky"
            icon={MessageSquare}
            label="SMS"
            value={asText(sms.sentToday ?? sms.sent ?? sms.totalSent, '—')}
            href={`${BASE}/communication`}
          />
          <SlsKpiCard
            tone="emerald"
            icon={MessageSquare}
            label="WhatsApp"
            value={asText(wa.sentToday ?? wa.sent ?? wa.totalSent, '—')}
            href={`${BASE}/communication`}
          />
          <SlsKpiCard
            tone="amber"
            icon={School}
            label="Pending applications"
            value={pendingApps}
            href={`${BASE}/admissions`}
          />
          <SlsKpiCard
            tone="violet"
            icon={School}
            label="Approved / rejected"
            value={`${approvedApps} / ${rejectedApps}`}
            href={`${BASE}/admissions`}
          />
        </div>
      </section>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <QuickActionCard
            href={`${BASE}/attendance`}
            icon={ClipboardCheck}
            label="View attendance"
          />
          <QuickActionCard href={`${BASE}/leave`} icon={FileText} label="Approve leave" />
          <QuickActionCard href={`${BASE}/admissions`} icon={School} label="View admissions" />
          <QuickActionCard href={`${BASE}/fees`} icon={CreditCard} label="Fee reports" />
          <QuickActionCard href={`${BASE}/communication`} icon={Bell} label="Send announcement" />
          <QuickActionCard href={`${BASE}/communication`} icon={MessageSquare} label="Send SMS" />
          <QuickActionCard
            href={`${BASE}/communication`}
            icon={MessageSquare}
            label="Send WhatsApp"
          />
          <QuickActionCard href={`${BASE}/exams`} icon={FileText} label="View examination" />
          <QuickActionCard href={`${BASE}/reports`} icon={GraduationCap} label="View reports" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnnouncementWidget items={desk.notices} title="Recent notices" />
        <AnnouncementWidget items={desk.broadcasts} title="Recent campaigns" />
      </div>
    </div>
  );
}
