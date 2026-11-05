'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  Library,
  MessageSquare,
  Nfc,
  ScrollText,
  SunMedium,
  TrendingUp,
  Wallet,
} from 'lucide-react';

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
import { StudentRollShiftHistoryCard } from '@/components/students-module/profile/student-roll-shift-history-card';
import { AcademicChangeHistoryPanel } from '@/components/students-module/profile/academic-change-history-panel';
import { AdminStudentIdCardPanel } from '@/components/id-cards/admin-student-id-card-panel';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StudentProfile } from '@/types/students';
import { LEGACY_SECTION_TO_TAB, PROFILE_TABS, type ProfileTabKey } from '@/types/student-profile';
import { cn } from '@/utils/cn';

const TAB_ICONS: Record<ProfileTabKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  academic: GraduationCap,
  subjects: BookOpen,
  attendance: CalendarCheck,
  fees: Wallet,
  documents: FileText,
  'id-card': CreditCard,
  communication: MessageSquare,
  rfid: Nfc,
  certificates: Award,
  library: Library,
  promotion: TrendingUp,
  remarks: MessageSquare,
  audit: ScrollText,
};

function parseTab(tabParam: string | null, sectionParam: string | null): ProfileTabKey {
  if (tabParam === 'edit') return 'academic';
  if (tabParam && PROFILE_TABS.some((t) => t.key === tabParam)) {
    return tabParam as ProfileTabKey;
  }
  if (sectionParam && Object.prototype.hasOwnProperty.call(LEGACY_SECTION_TO_TAB, sectionParam)) {
    return LEGACY_SECTION_TO_TAB[sectionParam as keyof typeof LEGACY_SECTION_TO_TAB];
  }
  return 'overview';
}

/** Primary at-a-glance ID: current college roll, not permanent enrollment. */
function primaryStudentId(
  profile: Pick<StudentProfile, 'rollNumber' | 'enrollmentNumber'>,
): string {
  return profile.rollNumber?.trim() || profile.enrollmentNumber;
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,43fr)_minmax(0,30fr)_minmax(0,27fr)]">
            <BasicSection profile={profile} canEdit={canEdit} />
            <div className="space-y-4">
              <AcademicIdentitySection profile={profile} canEdit={canEdit} />
              <SectionCard title="Roll Number & Shift">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Roll Number</p>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm">
                      {primaryStudentId(profile)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Shift</p>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      {profile.shift || '—'}
                    </p>
                  </div>
                </div>
              </SectionCard>
              <CategorySection profile={profile} canEdit={canEdit} />
            </div>
            <ProfileSummarySidebar profile={profile} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AddressSection profile={profile} canEdit={canEdit} />
            <GuardiansSection profile={profile} canEdit={canEdit} />
            <StudentRollShiftHistoryCard studentId={profile.id} />
          </div>
        </div>
      );
    case 'academic':
      return (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <AcademicSection profile={profile} canEdit={canEdit} />
            <div className="space-y-4">
              <BoardExamSection profile={profile} canEdit={canEdit} />
              <CuetSection profile={profile} canEdit={canEdit} />
            </div>
          </div>

          <SectionCard
            title="Registered subjects"
            description="Semester-wise subject registrations"
          >
            <StudentSubjectsTab profile={profile} />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <StudentRollShiftHistoryCard studentId={profile.id} />
            <AcademicChangeHistoryPanel studentId={profile.id} compact sticky={false} />
          </div>
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

function ProfileSummarySidebar({ profile }: { profile: StudentProfile }) {
  const completionPercent = profile.completion?.completionPercent ?? 0;
  const enrollments = profile.sectionEnrollments?.filter(
    (e) => Number(e.semesterSequence) === Number(profile.semester),
  );

  const studying = (profile.studentStatus ?? '').toUpperCase() === 'STUDYING';
  const active =
    (profile.admissionStatus ?? profile.academicStatus ?? '').toUpperCase() === 'ACTIVE' ||
    studying;

  return (
    <aside className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-blue-700 to-blue-600 px-4 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 p-1">
              <StudentPhotoUpload
                photoPath={profile.photoPath}
                size="lg"
                hideButton
                disabled
                onSelect={() => undefined}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-snug">
                <StudentName name={profile.fullName} displayFullName={profile.displayFullName} />
              </h2>
              <p className="mt-0.5 font-mono text-xs text-blue-100">{primaryStudentId(profile)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
                  {active
                    ? 'Active'
                    : profile.admissionStatus || profile.academicStatus || 'Status'}
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                  {studying ? 'Studying' : profile.studentStatus || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <dl className="space-y-2 px-4 py-3 text-sm">
          {(
            [
              ['Programme', profile.programme],
              ['Batch', profile.batch],
              ['Semester', profile.semester ? `Sem ${profile.semester}` : null],
              ['Shift', profile.shift],
              ['Department', profile.departmentName],
              ['Blood Group', profile.bloodGroup],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-right text-xs font-medium text-slate-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-medium text-slate-700">Profile Completion</span>
            <span className="font-semibold text-blue-700">{completionPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">
          Registered Subjects{enrollments?.length ? ` (${enrollments.length})` : ''}
        </p>
        {enrollments && enrollments.length > 0 ? (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {[...enrollments]
              .sort((a, b) => {
                const rank = (c?: string | null) => (c === 'MAJOR' || c === 'MINOR' ? 0 : 1);
                return rank(a.category) - rank(b.category);
              })
              .map((item) => (
                <li key={`${item.registrationId}-${item.courseCode}`} className="leading-snug">
                  <span className="font-mono font-semibold text-blue-800">{item.courseCode}</span>{' '}
                  <span className="text-slate-800">{item.courseTitle}</span>
                  {item.category ? (
                    <span className="text-slate-500"> — {item.category}</span>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No subjects registered for this semester.</p>
        )}
      </div>
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

  const active =
    (profile.admissionStatus ?? '').toUpperCase() === 'ACTIVE' ||
    (profile.academicStatus ?? '').toUpperCase() === 'ACTIVE';

  return (
    <ErpWorkspace className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="mb-2 text-xs text-slate-500">
          <Link href="/admin/students" className="hover:text-blue-700">
            Students
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-slate-700">Student Profile</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                <StudentName name={profile.fullName} displayFullName={profile.displayFullName} />
              </h1>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                )}
              >
                {active
                  ? 'Active'
                  : profile.admissionStatus || profile.academicStatus || 'Inactive'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-mono">
                <IdCard className="h-3.5 w-3.5 text-slate-400" />
                {primaryStudentId(profile)}
              </span>
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                {profile.programme || '—'}
              </span>
              <span>Batch: {profile.batch || '—'}</span>
              <span>Sem {profile.semester}</span>
              <span className="inline-flex items-center gap-1">
                <SunMedium className="h-3.5 w-3.5 text-amber-500" />
                {profile.shift || '—'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/students"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9')}
            >
              Back to List
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setTabWithUrl('id-card')}
            >
              <CreditCard className="mr-1.5 h-4 w-4" />
              ID Card
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9')}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setTabWithUrl('id-card')}>
                  ID card
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTabWithUrl('documents')}>
                  Documents
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setTabWithUrl('overview');
                window.dispatchEvent(new Event('student-profile-edit'));
                document
                  .getElementById('student-basic-information')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      <div
        className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white/95 px-1 scrollbar-none"
        role="tablist"
      >
        {PROFILE_TABS.map((item) => {
          const Icon = TAB_ICONS[item.key];
          const selected = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTabWithUrl(item.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm',
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <ErpWorkspaceGrid
        className={cn(
          tab === 'overview'
            ? 'lg:grid-cols-1'
            : tab === 'academic' && 'lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]',
        )}
        main={
          <div role="tabpanel" className="min-w-0">
            <ProfileTabPanel tab={tab} profile={profile} canEdit={canEdit} onRefresh={onRefresh} />
          </div>
        }
        sidebar={tab === 'overview' ? null : <ProfileSummarySidebar profile={profile} />}
      />
    </ErpWorkspace>
  );
}
