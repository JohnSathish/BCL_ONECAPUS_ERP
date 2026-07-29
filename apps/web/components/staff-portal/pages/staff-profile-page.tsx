'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  FileText,
  History,
  KeyRound,
  Phone,
  UserRound,
  GraduationCap,
  BadgeCheck,
  Landmark,
  Users,
} from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStaffMe } from '@/components/staff-portal/hooks/use-staff-me';
import { StaffNotLinkedState } from '@/components/staff-portal/layout/staff-module-placeholder';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  createMyCertification,
  createMyEmergencyContact,
  createMyExperience,
  createMyQualification,
  deleteMyCertification,
  deleteMyEmergencyContact,
  deleteMyExperience,
  deleteMyQualification,
  fetchMyCertifications,
  fetchMyEmergencyContacts,
  fetchMyExperience,
  fetchMyProfileHistory,
  fetchMyQualifications,
  submitMyProfileForReview,
  updateMyBank,
  updateMyContact,
  updateMyPersonal,
  uploadMyPhoto,
  uploadMyStaffDocument,
  fetchMyStaffDocumentCompliance,
} from '@/services/staff';
import { fetchMyDocuments } from '@/services/staff-portal';
import { fetchMasterLookups } from '@/services/students';
import { StaffSecurityTab } from '@/components/staff-portal/pages/staff-security-tab';

const TABS = [
  { key: 'overview', label: 'Overview', icon: UserRound },
  { key: 'personal', label: 'Personal Details', icon: UserRound },
  { key: 'contact', label: 'Contact Details', icon: Phone },
  { key: 'qualifications', label: 'Educational Qualifications', icon: GraduationCap },
  { key: 'experience', label: 'Teaching Experience', icon: Briefcase },
  { key: 'certifications', label: 'Professional Certifications', icon: BadgeCheck },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'bank', label: 'Bank Details', icon: Landmark },
  { key: 'emergency', label: 'Emergency Contacts', icon: Users },
  { key: 'security', label: 'Password & Security', icon: KeyRound },
  { key: 'activity', label: 'Activity Log', icon: History },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const QUAL_TYPES = [
  'SSLC',
  'HSSLC',
  'Diploma',
  'UG',
  'PG',
  'M.Phil.',
  'Ph.D.',
  'NET',
  'SET',
  'B.Ed.',
  'M.Ed.',
  'Other',
];

const CERT_TYPES = [
  'FDP',
  'Workshop',
  'Seminar',
  'Conference',
  'Faculty Development Programme',
  'Online Certification',
  'NPTEL',
  'Coursera',
  'SWAYAM',
];

const DOC_SLOTS = [
  'PASSPORT_PHOTO',
  'SIGNATURE',
  'AADHAAR',
  'PAN',
  'APPOINTMENT_ORDER',
  'RESUME_CV',
  'QUALIFICATION_CERTIFICATE',
  'EXPERIENCE_CERTIFICATE',
  'JOINING_REPORT',
  'RELIEVING_ORDER',
  'OTHER',
];

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? '').toUpperCase();
  const variant =
    s === 'APPROVED' || s === 'VERIFIED' || s === 'ACTIVE'
      ? 'secondary'
      : s === 'REJECTED'
        ? 'destructive'
        : 'outline';
  return <Badge variant={variant}>{s || '—'}</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-sm">
        {value || '—'}
      </span>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20';

export function StaffProfilePage() {
  useRequireStaffPortal();
  const search = useSearchParams();
  const tabParam = (search.get('tab') as TabKey | null) ?? 'overview';
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'overview';
  const me = useStaffMe();
  const qc = useQueryClient();

  if (me.isError) return <StaffNotLinkedState />;
  if (!me.data) {
    return (
      <DashboardShell role="staff" title="My Profile">
        <ErpWorkspace>
          <GlassCard className="animate-pulse p-8">
            <div className="h-24 rounded-2xl bg-muted" />
          </GlassCard>
        </ErpWorkspace>
      </DashboardShell>
    );
  }

  const profile = me.data;
  const pct = profile.profileCompletion ?? 0;
  const photoSrc = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;

  return (
    <DashboardShell role="staff" title="My Profile">
      <ErpWorkspace className="space-y-4 pb-24">
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover ring-2 ring-border/40"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                  {profile.fullName?.charAt(0) ?? '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">{profile.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                {profile.designation ?? '—'}
                {profile.department ? ` · ${profile.department}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Staff Code: {profile.employeeCode}</span>
                <StatusBadge status={profile.status} />
                <Badge variant="outline">{staffTypeLabel(profile.staffType)}</Badge>
              </div>
            </div>
            <div className="w-full sm:w-48">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Profile Completion</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <Button
                className="mt-3 w-full rounded-xl"
                size="sm"
                onClick={() => {
                  window.location.href = '/staff/profile?tab=personal';
                }}
              >
                Edit Profile
              </Button>
            </div>
          </div>
        </GlassCard>

        <div className="flex gap-1 overflow-x-auto rounded-[18px] border border-border/40 bg-card/60 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/staff/profile?tab=${t.key}`}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            );
          })}
        </div>

        {tab === 'overview' ? <OverviewTab profile={profile} /> : null}
        {tab === 'personal' ? (
          <PersonalTab
            profile={profile}
            onSaved={() => void qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] })}
          />
        ) : null}
        {tab === 'contact' ? (
          <ContactTab
            profile={profile}
            onSaved={() => void qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] })}
          />
        ) : null}
        {tab === 'qualifications' ? <QualificationsTab /> : null}
        {tab === 'experience' ? <ExperienceTab /> : null}
        {tab === 'certifications' ? <CertificationsTab /> : null}
        {tab === 'documents' ? <DocumentsTab /> : null}
        {tab === 'bank' ? (
          <BankTab
            profile={profile}
            onSaved={() => void qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] })}
          />
        ) : null}
        {tab === 'emergency' ? <EmergencyTab /> : null}
        {tab === 'security' ? <StaffSecurityTab /> : null}
        {tab === 'activity' ? <ActivityTab /> : null}

        {(tab === 'qualifications' ||
          tab === 'experience' ||
          tab === 'certifications' ||
          tab === 'documents') && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-background/90 p-3 backdrop-blur md:left-64">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Qualification, experience, certification, and document changes require HR approval.
              </p>
              <Button
                className="rounded-xl"
                size="sm"
                onClick={() =>
                  void submitMyProfileForReview().then(() =>
                    qc.invalidateQueries({ queryKey: ['staff-portal'] }),
                  )
                }
              >
                Submit for Review
              </Button>
            </div>
          </div>
        )}
      </ErpWorkspace>
    </DashboardShell>
  );
}

function OverviewTab({ profile }: { profile: NonNullable<ReturnType<typeof useStaffMe>['data']> }) {
  const exp = useQuery({ queryKey: ['staff-portal', 'experience'], queryFn: fetchMyExperience });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[
        ['Total Experience', `${exp.data?.totalTeachingYears ?? profile.experienceYears ?? 0} yrs`],
        ['Highest Qualification', profile.qualification],
        [
          'Date of Joining',
          profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : null,
        ],
        ['Official Email', profile.email],
        ['Mobile Number', profile.mobile],
        ['Department', profile.department],
        ['Designation', profile.designation],
      ].map(([label, value]) => (
        <GlassCard key={String(label)} className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{value || '—'}</p>
        </GlassCard>
      ))}
      <GlassCard className="p-4 sm:col-span-2 lg:col-span-3">
        <p className="text-sm text-muted-foreground">
          Research publications remain available from{' '}
          <Link href="/staff/profile?tab=personal" className="text-primary underline">
            Personal Details
          </Link>{' '}
          (Scholar / ORCID) and the legacy research tools.
        </p>
      </GlassCard>
    </div>
  );
}

function PersonalTab({
  profile,
  onSaved,
}: {
  profile: NonNullable<ReturnType<typeof useStaffMe>['data']>;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    fullName: profile.fullName ?? '',
    gender: profile.gender ?? '',
    dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
    maritalStatus: profile.maritalStatus ?? '',
    nationality: profile.nationality ?? '',
    religion: profile.religion ?? '',
    aadhaarNo: profile.aadhaarNo ?? '',
    panNo: profile.panNo ?? '',
    passportNo: profile.passportNo ?? '',
    mobile: profile.mobile ?? '',
  });
  const mut = useMutation({
    mutationFn: () => updateMyPersonal(form),
    onSuccess: () => {
      setMsg('Saved');
      onSaved();
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Save failed')),
  });

  return (
    <GlassCard className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => fileRef.current?.click()}
        >
          Change Photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void uploadMyPhoto(f).then(onSaved);
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadonlyField label="Staff Code" value={profile.employeeCode} />
        <Field label="Full Name">
          <input
            className={inputCls}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>
        <Field label="Gender">
          <select
            className={inputCls}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Date of Birth">
          <input
            type="date"
            className={inputCls}
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
        </Field>
        <BloodGroupField value={profile.bloodGroup} />
        <Field label="Marital Status">
          <input
            className={inputCls}
            value={form.maritalStatus}
            onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
          />
        </Field>
        <Field label="Nationality">
          <input
            className={inputCls}
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
          />
        </Field>
        <Field label="Religion">
          <input
            className={inputCls}
            value={form.religion}
            onChange={(e) => setForm({ ...form, religion: e.target.value })}
          />
        </Field>
        <Field label="Aadhaar Number">
          <input
            className={inputCls}
            value={form.aadhaarNo}
            onChange={(e) => setForm({ ...form, aadhaarNo: e.target.value })}
          />
        </Field>
        <Field label="PAN Number">
          <input
            className={inputCls}
            value={form.panNo}
            onChange={(e) => setForm({ ...form, panNo: e.target.value })}
          />
        </Field>
        <Field label="Passport Number">
          <input
            className={inputCls}
            value={form.passportNo}
            onChange={(e) => setForm({ ...form, passportNo: e.target.value })}
          />
        </Field>
        <ReadonlyField
          label="Date of Joining"
          value={profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : null}
        />
        <ReadonlyField label="Department" value={profile.department} />
        <ReadonlyField label="Designation" value={profile.designation} />
      </div>
      <div className="flex items-center gap-3">
        <Button className="rounded-xl" disabled={mut.isPending} onClick={() => mut.mutate()}>
          Save Personal Details
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </GlassCard>
  );
}

function ContactTab({
  profile,
  onSaved,
}: {
  profile: NonNullable<ReturnType<typeof useStaffMe>['data']>;
  onSaved: () => void;
}) {
  const addr = (profile.addressJson ?? {}) as Record<string, string>;
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    mobile: profile.mobile ?? '',
    alternateMobile: profile.alternateMobile ?? '',
    personalEmail: profile.personalEmail ?? '',
    currentAddress: addr.currentAddress ?? addr.line1 ?? '',
    permanentAddress: addr.permanentAddress ?? addr.line2 ?? '',
    city: addr.city ?? '',
    district: addr.district ?? '',
    state: addr.state ?? '',
    country: addr.country ?? 'India',
    pincode: addr.pincode ?? addr.pinCode ?? '',
  });
  const mut = useMutation({
    mutationFn: () =>
      updateMyContact({
        mobile: form.mobile,
        alternateMobile: form.alternateMobile,
        personalEmail: form.personalEmail,
        addressJson: {
          currentAddress: form.currentAddress,
          permanentAddress: form.permanentAddress,
          line1: form.currentAddress,
          line2: form.permanentAddress,
          city: form.city,
          district: form.district,
          state: form.state,
          country: form.country,
          pincode: form.pincode,
        },
      }),
    onSuccess: () => {
      setMsg('Saved');
      onSaved();
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Save failed')),
  });

  return (
    <GlassCard className="space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mobile Number">
          <input
            className={inputCls}
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </Field>
        <Field label="Alternate Mobile">
          <input
            className={inputCls}
            value={form.alternateMobile}
            onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })}
          />
        </Field>
        <ReadonlyField label="Official Email" value={profile.email} />
        <Field label="Personal Email">
          <input
            className={inputCls}
            value={form.personalEmail}
            onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
          />
        </Field>
        <Field label="Current Address">
          <textarea
            className={inputCls}
            rows={2}
            value={form.currentAddress}
            onChange={(e) => setForm({ ...form, currentAddress: e.target.value })}
          />
        </Field>
        <Field label="Permanent Address">
          <textarea
            className={inputCls}
            rows={2}
            value={form.permanentAddress}
            onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setForm((f) => ({ ...f, permanentAddress: f.currentAddress }))}
          >
            Copy Current Address to Permanent Address
          </Button>
        </div>
        <Field label="City">
          <input
            className={inputCls}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </Field>
        <Field label="District">
          <input
            className={inputCls}
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
        </Field>
        <Field label="State">
          <input
            className={inputCls}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
        </Field>
        <Field label="Country">
          <input
            className={inputCls}
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </Field>
        <Field label="PIN Code">
          <input
            className={inputCls}
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button className="rounded-xl" disabled={mut.isPending} onClick={() => mut.mutate()}>
          Save Contact Details
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </GlassCard>
  );
}

function QualificationsTab() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['staff-portal', 'qualifications'],
    queryFn: fetchMyQualifications,
  });
  const [form, setForm] = useState({
    qualification: 'UG',
    specialization: '',
    institution: '',
    university: '',
    board: '',
    passingYear: '',
    percentageOrCgpa: '',
    division: '',
  });
  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Add Qualification</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qualification">
            <select
              className={inputCls}
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            >
              {QUAL_TYPES.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
          </Field>
          <Field label="Specialization">
            <input
              className={inputCls}
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            />
          </Field>
          <Field label="Institution">
            <input
              className={inputCls}
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
            />
          </Field>
          <Field label="University">
            <input
              className={inputCls}
              value={form.university}
              onChange={(e) => setForm({ ...form, university: e.target.value })}
            />
          </Field>
          <Field label="Board">
            <input
              className={inputCls}
              value={form.board}
              onChange={(e) => setForm({ ...form, board: e.target.value })}
            />
          </Field>
          <Field label="Passing Year">
            <input
              className={inputCls}
              value={form.passingYear}
              onChange={(e) => setForm({ ...form, passingYear: e.target.value })}
            />
          </Field>
          <Field label="Percentage / CGPA">
            <input
              className={inputCls}
              value={form.percentageOrCgpa}
              onChange={(e) => setForm({ ...form, percentageOrCgpa: e.target.value })}
            />
          </Field>
          <Field label="Division">
            <input
              className={inputCls}
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="rounded-xl"
          onClick={() =>
            void createMyQualification({
              ...form,
              passingYear: form.passingYear ? Number(form.passingYear) : undefined,
            }).then(() => qc.invalidateQueries({ queryKey: ['staff-portal', 'qualifications'] }))
          }
        >
          + Add Qualification
        </Button>
      </GlassCard>
      <GlassCard className="p-5">
        <div className="space-y-3">
          {(list.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/40 p-3"
            >
              <div>
                <p className="font-medium">{String(row.qualification)}</p>
                <p className="text-xs text-muted-foreground">
                  {[row.specialization, row.institution, row.university, row.passingYear]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {row.approvalStatus === 'REJECTED' && row.reviewRemarks ? (
                  <p className="mt-1 text-xs text-destructive">HR: {String(row.reviewRemarks)}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={row.approvalStatus} />
                {row.approvalStatus !== 'APPROVED' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void deleteMyQualification(row.id).then(() =>
                        qc.invalidateQueries({ queryKey: ['staff-portal', 'qualifications'] }),
                      )
                    }
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!list.data?.length ? (
            <p className="text-sm text-muted-foreground">No qualifications yet.</p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}

function ExperienceTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['staff-portal', 'experience'], queryFn: fetchMyExperience });
  const [form, setForm] = useState({
    institutionName: '',
    designation: '',
    department: '',
    employmentType: 'PERMANENT',
    fromDate: '',
    toDate: '',
  });
  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <p className="text-sm">
          Total Teaching Experience:{' '}
          <span className="font-semibold">{list.data?.totalTeachingYears ?? 0} years</span>
        </p>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Add Experience</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['institutionName', 'designation', 'department'] as const).map((k) => (
            <Field
              key={k}
              label={
                k === 'institutionName' ? 'Institution Name' : k[0]!.toUpperCase() + k.slice(1)
              }
            >
              <input
                className={inputCls}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Employment Type">
            <select
              className={inputCls}
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            >
              <option>PERMANENT</option>
              <option>CONTRACT</option>
              <option>GUEST</option>
              <option>VISITING</option>
            </select>
          </Field>
          <Field label="From Date">
            <input
              type="date"
              className={inputCls}
              value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
            />
          </Field>
          <Field label="To Date">
            <input
              type="date"
              className={inputCls}
              value={form.toDate}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="rounded-xl"
          onClick={() =>
            void createMyExperience({
              ...form,
              toDate: form.toDate || undefined,
            }).then(() => qc.invalidateQueries({ queryKey: ['staff-portal', 'experience'] }))
          }
        >
          + Add Experience
        </Button>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        {(list.data?.items ?? []).map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/40 p-3"
          >
            <div>
              <p className="font-medium">{String(row.institutionName)}</p>
              <p className="text-xs text-muted-foreground">
                {String(row.designation)} · {String(row.fromDate).slice(0, 10)}
                {row.toDate ? ` – ${String(row.toDate).slice(0, 10)}` : ' – Present'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={row.approvalStatus} />
              {row.approvalStatus !== 'APPROVED' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteMyExperience(row.id).then(() =>
                      qc.invalidateQueries({ queryKey: ['staff-portal', 'experience'] }),
                    )
                  }
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

function CertificationsTab() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['staff-portal', 'certifications'],
    queryFn: fetchMyCertifications,
  });
  const [form, setForm] = useState({
    certificationType: 'FDP',
    title: '',
    organizer: '',
    year: '',
  });
  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select
              className={inputCls}
              value={form.certificationType}
              onChange={(e) => setForm({ ...form, certificationType: e.target.value })}
            >
              {CERT_TYPES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Organizer">
            <input
              className={inputCls}
              value={form.organizer}
              onChange={(e) => setForm({ ...form, organizer: e.target.value })}
            />
          </Field>
          <Field label="Year">
            <input
              className={inputCls}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="rounded-xl"
          onClick={() =>
            void createMyCertification({
              ...form,
              year: form.year ? Number(form.year) : undefined,
            }).then(() => qc.invalidateQueries({ queryKey: ['staff-portal', 'certifications'] }))
          }
        >
          + Add Certification
        </Button>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        {(list.data ?? []).map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 p-3"
          >
            <div>
              <p className="font-medium">{String(row.title)}</p>
              <p className="text-xs text-muted-foreground">
                {String(row.certificationType)}
                {row.year ? ` · ${row.year}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={row.approvalStatus} />
              {row.approvalStatus !== 'APPROVED' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteMyCertification(row.id).then(() =>
                      qc.invalidateQueries({ queryKey: ['staff-portal', 'certifications'] }),
                    )
                  }
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

function DocumentsTab() {
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ['staff-portal', 'documents'], queryFn: fetchMyDocuments });
  const compliance = useQuery({
    queryKey: ['staff-portal', 'documents', 'compliance'],
    queryFn: fetchMyStaffDocumentCompliance,
  });
  const [docType, setDocType] = useState(DOC_SLOTS[0]!);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">
          Uploads stay Pending until HR verifies them.
          {compliance.data ? ` Compliance: ${compliance.data.completionPercent ?? 0}%` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_SLOTS.map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Button className="rounded-xl" onClick={() => fileRef.current?.click()}>
            Upload Document
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void uploadMyStaffDocument(docType, f).then(() =>
                qc.invalidateQueries({ queryKey: ['staff-portal', 'documents'] }),
              );
            }}
          />
        </div>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        {(docs.data ?? []).map((doc) => (
          <div
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 p-3 text-sm"
          >
            <div>
              <p className="font-medium">{doc.documentType}</p>
              <p className="text-xs text-muted-foreground">
                {doc.fileName ?? '—'} · {new Date(doc.createdAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={doc.verificationStatus} />
          </div>
        ))}
        {!docs.data?.length ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : null}
      </GlassCard>
    </div>
  );
}

function BankTab({
  profile,
  onSaved,
}: {
  profile: NonNullable<ReturnType<typeof useStaffMe>['data']>;
  onSaved: () => void;
}) {
  const bank = profile.bank ?? {
    accountHolderName: null,
    bankName: null,
    branch: null,
    accountNumber: null,
    ifsc: null,
    upiId: null,
  };
  const [form, setForm] = useState({
    accountHolderName: bank.accountHolderName ?? '',
    bankName: bank.bankName ?? '',
    bankBranch: bank.branch ?? '',
    accountNumber: bank.accountNumber ?? '',
    ifsc: bank.ifsc ?? '',
    upiId: bank.upiId ?? '',
  });
  const [msg, setMsg] = useState('');
  return (
    <GlassCard className="space-y-4 p-5">
      <p className="text-xs text-muted-foreground">
        Lightweight bank details. HR may still override official payroll banking records.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['accountHolderName', 'Account Holder Name'],
            ['bankName', 'Bank Name'],
            ['bankBranch', 'Branch'],
            ['accountNumber', 'Account Number'],
            ['ifsc', 'IFSC Code'],
            ['upiId', 'UPI ID'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              className={inputCls}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          className="rounded-xl"
          onClick={() =>
            void updateMyBank(form)
              .then(() => {
                setMsg('Saved');
                onSaved();
              })
              .catch((e) => setMsg(apiErrorMessage(e, 'Save failed')))
          }
        >
          Save Bank Details
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </GlassCard>
  );
}

function EmergencyTab() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['staff-portal', 'emergency'],
    queryFn: fetchMyEmergencyContacts,
  });
  const [form, setForm] = useState({
    contactName: '',
    relationship: '',
    mobile: '',
    alternateMobile: '',
    address: '',
  });
  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['contactName', 'Contact Name'],
              ['relationship', 'Relationship'],
              ['mobile', 'Mobile Number'],
              ['alternateMobile', 'Alternate Number'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                className={inputCls}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Address">
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="rounded-xl"
          onClick={() =>
            void createMyEmergencyContact(form).then(() => {
              setForm({
                contactName: '',
                relationship: '',
                mobile: '',
                alternateMobile: '',
                address: '',
              });
              void qc.invalidateQueries({ queryKey: ['staff-portal', 'emergency'] });
            })
          }
        >
          + Add Contact
        </Button>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        {(list.data ?? []).map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-border/40 p-3"
          >
            <div>
              <p className="font-medium">{row.contactName}</p>
              <p className="text-xs text-muted-foreground">
                {row.relationship} · {row.mobile}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void deleteMyEmergencyContact(row.id).then(() =>
                  qc.invalidateQueries({ queryKey: ['staff-portal', 'emergency'] }),
                )
              }
            >
              Delete
            </Button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

const FALLBACK_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

function BloodGroupField({ value }: { value?: string | null }) {
  const lookups = useQuery({
    queryKey: ['master-lookups', 'BLOOD_GROUP'],
    queryFn: () => fetchMasterLookups('BLOOD_GROUP'),
    staleTime: 60_000,
  });
  const options = useMemo(() => {
    const fromApi = (lookups.data ?? [])
      .map((row) => (row.label ?? row.code ?? '').trim())
      .filter(Boolean);
    const merged = fromApi.length ? fromApi : [...FALLBACK_BLOOD_GROUPS];
    return Array.from(new Set(merged));
  }, [lookups.data]);
  const current = (value ?? '').trim();
  const matched = options.find((o) => o.toUpperCase() === current.toUpperCase());
  const selected = matched ?? (current || '');

  return (
    <Field label="Blood Group">
      <select
        className={cn(inputCls, 'cursor-not-allowed bg-muted/30 text-muted-foreground')}
        value={selected}
        disabled
        aria-readonly="true"
        title="Blood group is managed by the college office and cannot be edited here"
      >
        {!selected ? <option value="">—</option> : null}
        {selected && !options.some((o) => o.toUpperCase() === selected.toUpperCase()) ? (
          <option value={selected}>{selected}</option>
        ) : null}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-muted-foreground">
        Non-editable · Contact HR if this needs correction
      </span>
    </Field>
  );
}

function ActivityTab() {
  const history = useQuery({
    queryKey: ['staff-portal', 'profile-history'],
    queryFn: fetchMyProfileHistory,
  });
  return (
    <GlassCard className="space-y-3 p-5">
      {(history.data ?? []).map((row) => (
        <div
          key={row.id}
          className="flex items-start gap-3 border-b border-border/30 pb-3 last:border-0"
        >
          <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{row.summary}</p>
            <p className="text-xs text-muted-foreground">
              {row.section} · {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
      {!history.data?.length ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : null}
    </GlassCard>
  );
}

export { StaffProfilePage as StaffPortalProfilePage };
