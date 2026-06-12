'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useStaffMe } from '@/components/staff-portal/hooks/use-staff-me';
import { useMySubjectAssignments } from '@/components/staff-portal/hooks/use-staff-dashboard';
import { StaffNotLinkedState } from '@/components/staff-portal/layout/staff-module-placeholder';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { cn } from '@/utils/cn';

const TABS = [
  { key: 'basic', label: 'Basic' },
  { key: 'employment', label: 'Employment' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'salary', label: 'Salary' },
  { key: 'documents', label: 'Documents' },
  { key: 'portal', label: 'Portal' },
  { key: 'review', label: 'Review' },
] as const;

export function StaffPortalProfilePage() {
  useRequireStaffPortal();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'basic';
  const meQ = useStaffMe();
  const subjectsQ = useMySubjectAssignments();

  const profile = meQ.data;

  const photoSrc = useMemo(
    () => (profile?.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null),
    [profile?.photoUrl],
  );

  if (meQ.isError) return <StaffNotLinkedState />;

  return (
    <DashboardShell role="staff" title="My Profile">
      <ErpWorkspace>
        <div className="flex flex-wrap gap-2 border-b border-border/50 pb-3">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`/staff/profile?tab=${t.key}`}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                tab === t.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              {t.label}
            </a>
          ))}
        </div>

        <GlassCard className="mt-4 p-6">
          {tab === 'basic' && profile ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              ) : null}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{profile.fullName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Employee Code</dt>
                  <dd className="font-mono">{profile.employeeCode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{profile.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mobile</dt>
                  <dd>{profile.mobile ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Qualification</dt>
                  <dd>{profile.qualification ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Specialization</dt>
                  <dd>{profile.specialization ?? '—'}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {tab === 'employment' && profile ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Designation</dt>
                <dd className="font-medium">{profile.designation ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd>{profile.department ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Staff Type</dt>
                <dd>{staffTypeLabel(profile.staffType)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employment Type</dt>
                <dd>{profile.employmentType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joining Date</dt>
                <dd>
                  {profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd>
                  {profile.experienceYears != null ? `${profile.experienceYears} years` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Biometric ID</dt>
                <dd className="font-mono">{profile.biometricId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">RFID</dt>
                <dd className="font-mono">{profile.rfidNo ?? '—'}</dd>
              </div>
            </dl>
          ) : null}

          {tab === 'subjects' ? (
            <ul className="space-y-2 text-sm">
              {!subjectsQ.data?.length ? (
                <li className="text-muted-foreground">No assignments.</li>
              ) : (
                subjectsQ.data.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border/50 px-3 py-2">
                    {s.course?.code} — {s.course?.title} · Sem {s.semesterNo} · {s.studentCount}{' '}
                    students
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {tab === 'attendance' ? (
            <p className="text-sm text-muted-foreground">
              Personal attendance history and monthly calendar are available on the{' '}
              <a href="/staff/attendance" className="text-primary hover:underline">
                Attendance
              </a>{' '}
              page.
            </p>
          ) : null}

          {tab === 'salary' ? (
            <p className="text-sm text-muted-foreground">
              Salary and payslip details on the{' '}
              <a href="/staff/salary" className="text-primary hover:underline">
                Salary & Payslips
              </a>{' '}
              page.
            </p>
          ) : null}

          {tab === 'documents' ? (
            <p className="text-sm text-muted-foreground">
              View and upload documents on the{' '}
              <a href="/staff/documents" className="text-primary hover:underline">
                Documents
              </a>{' '}
              page.
            </p>
          ) : null}

          {tab === 'portal' ? (
            <p className="text-sm text-muted-foreground">
              Portal preferences and security settings are in{' '}
              <a href="/staff/settings" className="text-primary hover:underline">
                Portal Settings
              </a>
              .
            </p>
          ) : null}

          {tab === 'review' ? (
            <p className="text-sm text-muted-foreground">
              Performance review and appraisal workflows will be available in a future release.
            </p>
          ) : null}
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
