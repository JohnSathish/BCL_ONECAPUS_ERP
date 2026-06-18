'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { ErpWorkspace, ErpWorkspaceGrid } from '@/components/erp/erp-workspace-shell';
import { StudentPhotoUpload } from '@/components/student-records/student-photo-upload';
import {
  AcademicSection,
  AddressSection,
  BasicSection,
  AcademicIdentitySection,
  BoardExamSection,
  CategorySection,
  CuetSection,
  DocumentsSection,
  FyugpRegistrationSection,
  GuardiansSection,
  SystemSection,
} from '@/components/student-profile/profile-sections';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { StudentName } from '@/components/students/student-name';
import { StudentProfileFeesTab } from '@/components/students-module/profile/student-profile-fees-tab';
import { StudentProfileAttendanceTab } from '@/components/students-module/profile/student-profile-attendance-tab';
import { StudentProfileLibraryTab } from '@/components/library/student-profile-library-tab';
import { StudentSubjectsTab } from '@/components/students-module/profile/student-subjects-tab';
import { AdminStudentIdCardPanel } from '@/components/id-cards/admin-student-id-card-panel';
import { buttonVariants } from '@/components/ui/button';
import { uploadStudentPhoto } from '@/services/students';
import type { StudentProfile } from '@/types/students';
import { LEGACY_SECTION_TO_TAB, PROFILE_TABS, type ProfileTabKey } from '@/types/student-profile';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function parseTab(tabParam: string | null, sectionParam: string | null): ProfileTabKey {
  if (tabParam && PROFILE_TABS.some((t) => t.key === tabParam)) {
    return tabParam as ProfileTabKey;
  }
  if (sectionParam && Object.prototype.hasOwnProperty.call(LEGACY_SECTION_TO_TAB, sectionParam)) {
    return LEGACY_SECTION_TO_TAB[sectionParam as keyof typeof LEGACY_SECTION_TO_TAB];
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
  onRefresh,
}: {
  tab: ProfileTabKey;
  profile: StudentProfile;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  switch (tab) {
    case 'overview':
      return (
        <div className="grid gap-3 xl:grid-cols-2">
          <BasicSection profile={profile} canEdit={canEdit} />
          <AcademicIdentitySection profile={profile} canEdit={canEdit} />
          <CategorySection profile={profile} canEdit={canEdit} />
          <AddressSection profile={profile} canEdit={canEdit} />
          <GuardiansSection profile={profile} canEdit={canEdit} />
        </div>
      );
    case 'academic':
      return (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <AcademicSection profile={profile} canEdit={canEdit} />
            <BoardExamSection profile={profile} canEdit={canEdit} />
            <CuetSection profile={profile} canEdit={canEdit} />
          </div>
          <SectionCard
            title="Registered subjects"
            description="Semester-wise subject registrations"
          >
            <StudentSubjectsTab profile={profile} />
          </SectionCard>
        </div>
      );
    case 'subjects':
      return <FyugpRegistrationSection profile={profile} />;
    case 'attendance':
      return <StudentProfileAttendanceTab profile={profile} />;
    case 'fees':
      return <StudentProfileFeesTab profile={profile} />;
    case 'documents':
      return <DocumentsSection profile={profile} canEdit={canEdit} onRefresh={onRefresh} />;
    case 'communication':
      return (
        <ProfileTabStub
          title="Communication"
          description="Messages and notifications sent to this student."
          href={`/admin/students/communication?student=${profile.id}`}
          hrefLabel="Open communication hub"
        />
      );
    case 'rfid':
      return (
        <SectionCard title="RFID card">
          <p className="text-xs">
            <span className="text-muted-foreground">RFID number: </span>
            <span className="font-medium">{profile.rfidNumber ?? 'Not assigned'}</span>
          </p>
          <Link
            href="/admin/students/rfid"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 h-7 text-xs')}
          >
            RFID management
          </Link>
        </SectionCard>
      );
    case 'id-card':
      return <AdminStudentIdCardPanel profile={profile} />;
    case 'certificates':
      return (
        <ProfileTabStub
          title="Certificates"
          description="Generate and track bonafide, transfer, and other certificates."
          href="/admin/certificates/generator"
          hrefLabel="Certificate workspace"
        />
      );
    case 'library':
      return (
        <SectionCard title="Library visits" description="Reading hall entry and exit history">
          <StudentProfileLibraryTab studentId={profile.id} />
        </SectionCard>
      );
    case 'promotion':
      return (
        <SectionCard
          title="Semester promotion"
          description="Promotion history and semester progression"
        >
          {(profile.promotionEntries ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No promotion records yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border text-xs">
              {profile.promotionEntries.map((entry, i) => (
                <li key={i} className="px-2 py-1.5">
                  {JSON.stringify(entry)}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/students/promotion"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 h-7 text-xs')}
          >
            Semester promotion
          </Link>
        </SectionCard>
      );
    case 'remarks':
      return (
        <ProfileTabStub
          title="Remarks"
          description="Disciplinary notes, counsellor remarks, and internal comments will be managed here."
        />
      );
    case 'audit':
      return <SystemSection profile={profile} />;
    default:
      return null;
  }
}

function ProfileSummarySidebar({
  profile,
  canEdit,
  onRefresh,
}: {
  profile: StudentProfile;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const completionPercent = profile.completion?.completionPercent ?? 0;
  const enrollments = profile.sectionEnrollments?.filter(
    (e) => e.semesterSequence === profile.semester,
  );
  const photoMut = useMutation({
    mutationFn: (file: File) => uploadStudentPhoto(profile.id, file),
    onSuccess: () => onRefresh(),
  });

  return (
    <aside className="glass-card space-y-2.5 rounded-xl border border-border/50 p-3 shadow-sm">
      <div className="text-center">
        <StudentPhotoUpload
          photoPath={profile.photoPath}
          disabled={!canEdit || photoMut.isPending}
          pending={photoMut.isPending}
          onSelect={(file: File) => photoMut.mutate(file)}
        />
        {photoMut.isError ? (
          <p className="mt-1 text-[10px] text-destructive">
            {apiErrorMessage(photoMut.error, 'Photo upload failed')}
          </p>
        ) : null}
        <h2 className="mt-2 text-sm font-semibold leading-tight">
          <StudentName name={profile.fullName} displayFullName={profile.displayFullName} />
        </h2>
        <p className="text-[11px] text-muted-foreground">{profile.enrollmentNumber}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Programme</dt>
          <dd className="truncate font-medium">{profile.programme ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Batch</dt>
          <dd className="font-medium">{profile.batch ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Semester</dt>
          <dd className="font-medium">Sem {profile.semester}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{profile.studentStatus ?? profile.academicStatus}</dd>
        </div>
      </dl>
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>Profile completion</span>
          <span>{completionPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-violet-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>
      {enrollments && enrollments.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">
            Sem {profile.semester} subjects ({enrollments.length})
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto text-[10px]">
            {enrollments.slice(0, 8).map((e) => (
              <li key={`${e.registrationId}-${e.courseCode}`} className="truncate">
                <span className="font-mono text-muted-foreground">{e.courseCode}</span>{' '}
                {e.courseTitle}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

type Props = {
  profile: StudentProfile;
  canEdit: boolean;
  onRefresh: () => void;
};

export function StudentProfileDashboard({ profile, canEdit, onRefresh }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ProfileTabKey>(() =>
    parseTab(searchParams.get('tab'), searchParams.get('section')),
  );

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab'), searchParams.get('section')));
  }, [searchParams]);

  const setTabWithUrl = useCallback(
    (next: ProfileTabKey) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      params.delete('section');
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const badges = useMemo(() => {
    const items: { label: string; tone: 'default' | 'success' | 'warning' }[] = [];
    if (profile.admissionStatus) items.push({ label: profile.admissionStatus, tone: 'default' });
    if (profile.academicStatus) {
      items.push({
        label: profile.academicStatus,
        tone: profile.academicStatus === 'ACTIVE' ? 'success' : 'warning',
      });
    }
    if (profile.studentStatus) items.push({ label: profile.studentStatus, tone: 'default' });
    if (profile.shift) items.push({ label: profile.shift, tone: 'default' });
    return items;
  }, [profile]);

  return (
    <ErpWorkspace className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">
            <StudentName name={profile.fullName} displayFullName={profile.displayFullName} />
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {profile.enrollmentNumber}
            {profile.batch ? ` · ${profile.batch}` : ''}
            {` · Sem ${profile.semester}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {badges.map((b) => (
            <span
              key={b.label}
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                b.tone === 'success' && 'bg-emerald-500/15 text-emerald-700',
                b.tone === 'warning' && 'bg-amber-500/15 text-amber-800',
                b.tone === 'default' && 'bg-muted text-muted-foreground',
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="sticky top-0 z-20 flex gap-0.5 overflow-x-auto rounded-xl border border-border/50 bg-muted/20 p-0.5 scrollbar-none"
        role="tablist"
      >
        {PROFILE_TABS.map((t) => (
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
            <ProfileTabPanel tab={tab} profile={profile} canEdit={canEdit} onRefresh={onRefresh} />
          </div>
        }
        sidebar={
          <ProfileSummarySidebar profile={profile} canEdit={canEdit} onRefresh={onRefresh} />
        }
      />
    </ErpWorkspace>
  );
}
