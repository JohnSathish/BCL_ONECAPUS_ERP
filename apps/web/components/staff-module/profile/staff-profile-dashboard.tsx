'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErpWorkspace, ErpWorkspaceGrid } from '@/components/erp/erp-workspace-shell';
import {
  StaffBasicSection,
  StaffEmploymentSection,
  StaffSalarySection,
  StaffSystemSection,
} from '@/components/staff-module/profile/staff-profile-sections';
import { StaffDocumentsSection } from '@/components/staff-module/profile/staff-documents-section';
import { AdminStaffIdCardPanel } from '@/components/id-cards/admin-staff-id-card-panel';
import { StaffAccommodationSection } from '@/components/staff-module/profile/staff-accommodation-section';
import { StaffAwardsTab } from '@/components/staff-module/profile/staff-awards-tab';
import { StaffPublicationsTab } from '@/components/staff-module/profile/staff-publications-tab';
import { StaffSubjectsTab } from '@/components/staff-module/profile/staff-subjects-tab';
import { StaffAttendanceProfileCard } from '@/components/staff-module/attendance/staff-attendance-profile-card';
import { StaffSpecialAssignmentSection } from '@/components/staff-module/profile/staff-special-assignment-section';
import { roleChipLabel } from '@/components/staff-module/employment/employment-utils';
import {
  staffTypeLabel,
  staffStatusTone,
} from '@/components/staff-module/directory/staff-filter-utils';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { buttonVariants } from '@/components/ui/button';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StaffProfile, StaffProfileTabKey } from '@/types/staff';
import { STAFF_PROFILE_TABS } from '@/types/staff';
import { cn } from '@/utils/cn';

function parseTab(tabParam: string | null): StaffProfileTabKey {
  if (tabParam && STAFF_PROFILE_TABS.some((t) => t.key === tabParam)) {
    return tabParam as StaffProfileTabKey;
  }
  return 'overview';
}

function ProfileTabStub({
  title,
  description,
  href,
  hrefLabel,
}: {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <SectionCard title={title} description={description}>
      <p className="text-xs text-muted-foreground">{description}</p>
      {href ? (
        <Link
          href={href}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 h-7 text-xs')}
        >
          {hrefLabel ?? 'Open'}
        </Link>
      ) : null}
    </SectionCard>
  );
}

function ProfileTabPanel({
  tab,
  profile,
  canEdit,
  canAssign,
  onRefresh,
}: {
  tab: StaffProfileTabKey;
  profile: StaffProfile;
  canEdit: boolean;
  canAssign: boolean;
  onRefresh: () => void;
}) {
  switch (tab) {
    case 'overview':
      return (
        <div className="grid gap-3 xl:grid-cols-2">
          <StaffBasicSection profile={profile} canEdit={canEdit} />
          <SectionCard title="Employment summary" description="Quick view — edit in Employment tab">
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Primary designation</dt>
                <dd className="font-medium">{profile.designation ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Short code</dt>
                <dd className="font-medium font-mono">{profile.shortCode ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shift</dt>
                <dd className="font-medium">
                  {profile.teachingShiftLabel ?? profile.shift ?? 'Day Shift'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joining</dt>
                <dd className="font-medium">{profile.joiningDate?.slice(0, 10) ?? '—'}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      );
    case 'employment':
      return <StaffEmploymentSection profile={profile} canEdit={canEdit} />;
    case 'qualifications':
      return (
        <SectionCard title="Qualifications" description="Formal qualification records">
          {(profile.qualifications ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {profile.qualification
                ? `${profile.qualification}${profile.specialization ? ` — ${profile.specialization}` : ''}`
                : 'No structured qualification records yet.'}
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {(profile.qualifications ?? []).map((q) => (
                <li key={q.id} className="rounded-md border border-border/60 p-2">
                  <p className="font-medium">{q.qualification}</p>
                  {q.specialization ? (
                    <p className="text-muted-foreground">{q.specialization}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      );
    case 'publications':
      return <StaffPublicationsTab profile={profile} canEdit={canEdit} />;
    case 'awards':
      return <StaffAwardsTab profile={profile} canEdit={canEdit} />;
    case 'academic':
      return (
        <SectionCard title="Academic profile" description="Qualifications and teaching metadata">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Qualification</dt>
              <dd className="font-medium">{profile.qualification ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Specialization</dt>
              <dd className="font-medium">{profile.specialization ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Experience</dt>
              <dd className="font-medium">
                {profile.experienceYears != null ? `${profile.experienceYears} years` : '—'}
              </dd>
            </div>
          </dl>
        </SectionCard>
      );
    case 'subjects':
      return <StaffSubjectsTab profile={profile} canAssign={canAssign} onRefresh={onRefresh} />;
    case 'timetable':
      return (
        <ProfileTabStub
          title="Timetable"
          description="Timetable sections and class assignments will appear here once the timetable module is connected."
          href={`/admin/staff/workload?staff=${profile.id}`}
          hrefLabel="Workload overview"
        />
      );
    case 'attendance':
      return <StaffAttendanceProfileCard profile={profile} />;
    case 'documents':
      return <StaffDocumentsSection staffId={profile.id} canEdit={canEdit} onRefresh={onRefresh} />;
    case 'id-card':
      return <AdminStaffIdCardPanel profile={profile} />;
    case 'communication':
      return (
        <ProfileTabStub
          title="Communication"
          description="Messages and notifications sent to this staff member."
          href="/admin/students/communication"
          hrefLabel="Communication hub"
        />
      );
    case 'payroll':
      return <StaffSalarySection profile={profile} canEdit={canEdit} />;
    case 'accommodation':
      return <StaffAccommodationSection profile={profile} />;
    case 'leave':
      return (
        <ProfileTabStub
          title="Leave"
          description="Leave balances and applications will appear here once the leave module is connected."
        />
      );
    case 'special-assignment':
      return <StaffSpecialAssignmentSection profile={profile} canEdit={canEdit} />;
    case 'audit':
      return <StaffSystemSection profile={profile} />;
    case 'settings':
      return (
        <ProfileTabStub
          title="Settings"
          description="Portal provisioning and access control."
          href={`/admin/staff/portal-users?staff=${profile.id}`}
          hrefLabel="Portal users"
        />
      );
    default:
      return null;
  }
}

function ProfileSummarySidebar({ profile }: { profile: StaffProfile }) {
  const photoSrc = resolveUploadAssetUrl(profile.photoUrl ?? undefined);

  return (
    <aside className="glass-card space-y-2.5 rounded-xl border border-border/50 p-3 shadow-sm">
      <div className="text-center">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            className="mx-auto h-20 w-20 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            —
          </span>
        )}
        <h2 className="mt-2 text-sm font-semibold leading-tight">
          {profile.shortCode ? (
            <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {profile.shortCode}
            </span>
          ) : null}
          {profile.fullName}
        </h2>
        <p className="text-[11px] text-muted-foreground">{profile.employeeCode}</p>
        {(profile.additionalRoles ?? []).length > 0 ? (
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {(profile.additionalRoles ?? []).map((r, index) => (
              <span
                key={`${r.code}-${index}`}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium"
              >
                {roleChipLabel(r.code, r.label)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Department</dt>
          <dd className="truncate font-medium">{profile.department ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Designation</dt>
          <dd className="truncate font-medium">{profile.designation ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium">{staffTypeLabel(profile.staffType)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{staffTypeLabel(profile.status)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Subjects</dt>
          <dd className="font-medium tabular-nums">{profile.subjectAssignments?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Portal</dt>
          <dd className="font-medium">
            {profile.portalActive ? 'Active' : profile.portalPending ? 'Pending' : 'None'}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

type Props = {
  profile: StaffProfile;
  canEdit: boolean;
  canAssign: boolean;
  onRefresh: () => void;
};

export function StaffProfileDashboard({ profile, canEdit, canAssign, onRefresh }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<StaffProfileTabKey>(() => parseTab(searchParams.get('tab')));

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  const setTabWithUrl = useCallback(
    (next: StaffProfileTabKey) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const badges = useMemo(() => {
    const tone = staffStatusTone(profile.status);
    return [
      { key: 'staff-type', label: staffTypeLabel(profile.staffType), tone: 'default' as const },
      { key: 'status', label: staffTypeLabel(profile.status), tone },
      ...(profile.additionalRoles ?? []).map((r) => ({
        key: `role-${r.code}`,
        label: roleChipLabel(r.code, r.label),
        tone: 'default' as const,
      })),
    ];
  }, [profile]);

  return (
    <ErpWorkspace className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{profile.fullName}</h1>
          <p className="text-[11px] text-muted-foreground">
            {profile.employeeCode}
            {profile.department ? ` · ${profile.department}` : ''}
            {profile.designation ? ` · ${profile.designation}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {badges.map((b) => (
            <span
              key={b.key}
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                b.tone === 'success' && 'bg-emerald-500/15 text-emerald-700',
                b.tone === 'warning' && 'bg-amber-500/15 text-amber-800',
                b.tone === 'danger' && 'bg-rose-500/15 text-rose-700',
                b.tone === 'default' && 'bg-muted text-muted-foreground',
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="sticky top-16 z-30 mb-2 flex gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-background/95 p-0.5 shadow-sm backdrop-blur scrollbar-none supports-[backdrop-filter]:bg-background/85"
        role="tablist"
      >
        {STAFF_PROFILE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTabWithUrl(t.key)}
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              tab === t.key
                ? 'bg-background text-primary shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErpWorkspaceGrid
        main={
          <div role="tabpanel" className="min-w-0">
            <ProfileTabPanel
              tab={tab}
              profile={profile}
              canEdit={canEdit}
              canAssign={canAssign}
              onRefresh={onRefresh}
            />
          </div>
        }
        sidebar={<ProfileSummarySidebar profile={profile} />}
      />
    </ErpWorkspace>
  );
}
