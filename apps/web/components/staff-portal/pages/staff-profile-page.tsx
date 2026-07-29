'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
import {
  updateMyProfile,
  uploadMyPhoto,
  updateMyAddress,
  type UpdateMyProfilePayload,
} from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { StaffResearchTab } from './staff-research-tab';

const TABS = [
  { key: 'basic', label: 'Basic' },
  { key: 'employment', label: 'Employment' },
  { key: 'research', label: 'Research' },
  { key: 'address', label: 'Address' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'salary', label: 'Salary' },
  { key: 'documents', label: 'Documents' },
  { key: 'portal', label: 'Portal' },
] as const;

const inputCls =
  'w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="rounded-lg border border-border/30 bg-muted/30 px-3 py-2 text-sm">
        {value ?? '—'}
      </span>
    </div>
  );
}

function ProfileCompletionBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="mb-4 rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">Profile Completion</span>
        <span
          className={cn(
            'font-bold',
            pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500',
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct < 100 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Fill in your contact, academic, and research details to reach 100%.
        </p>
      )}
    </div>
  );
}

type ProfileData = NonNullable<ReturnType<typeof useStaffMe>['data']>;

function EditableBasicTab({ profile }: { profile: ProfileData }) {
  const qc = useQueryClient();

  const [form, setForm] = useState<UpdateMyProfilePayload>({
    mobile: profile.mobile ?? '',
    email: profile.email ?? '',
    qualification: profile.qualification ?? '',
    specialization: profile.specialization ?? '',
    experienceYears: profile.experienceYears ?? undefined,
    publicEmail: ((profile as Record<string, unknown>).publicEmail as string) ?? '',
    publicPhone: ((profile as Record<string, unknown>).publicPhone as string) ?? '',
    officeLocation: ((profile as Record<string, unknown>).officeLocation as string) ?? '',
    googleScholarUrl: ((profile as Record<string, unknown>).googleScholarUrl as string) ?? '',
    orcidUrl: ((profile as Record<string, unknown>).orcidUrl as string) ?? '',
    researchAreas: ((profile as Record<string, unknown>).researchAreas as string) ?? '',
  });

  const [saveMsg, setSaveMsg] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: (payload: UpdateMyProfilePayload) => updateMyProfile(payload),
    onSuccess: () => {
      setSaveMsg('Saved successfully');
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] });
      setTimeout(() => setSaveMsg(''), 3000);
    },
    onError: (e) => setSaveMsg(`Save failed: ${apiErrorMessage(e, 'Please try again.')}`),
  });

  const photoSrc = useMemo(
    () => (profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null),
    [profile.photoUrl],
  );

  function set<K extends keyof UpdateMyProfilePayload>(key: K, value: UpdateMyProfilePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoSaving(true);
    try {
      await uploadMyPhoto(file);
      await qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] });
    } catch {
      // silent
    } finally {
      setPhotoSaving(false);
    }
  }

  const profileData = profile as Record<string, unknown>;
  const pct = (profileData.profileCompletion as number | undefined) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <ProfileCompletionBar pct={pct} />

      {/* Photo + name hero */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt=""
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-border/30"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-bold text-primary">
              {profile.fullName?.charAt(0) ?? '?'}
            </div>
          )}
          <button
            type="button"
            className="absolute -bottom-2 -right-2 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
            onClick={() => fileRef.current?.click()}
            disabled={photoSaving}
          >
            {photoSaving ? '…' : '✎'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handlePhotoChange(e)}
          />
        </div>
        <div className="text-center sm:text-left">
          <p className="text-lg font-bold">{profile.fullName}</p>
          <p className="text-sm text-muted-foreground">{profile.designation ?? ''}</p>
          <p className="text-xs text-muted-foreground">{profile.department ?? ''}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{profile.employeeCode}</p>
          {/* Roles chips */}
          {(profile.additionalRoles?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.isHod && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  HoD
                </span>
              )}
              {profile.additionalRoles?.map((r) => (
                <span
                  key={r.code}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                >
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Read-only identity */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Identity (managed by HR)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadonlyField label="Full Name" value={profile.fullName} />
          <ReadonlyField label="Employee Code" value={profile.employeeCode} />
        </div>
      </div>

      {/* Contact */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contact Details
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              placeholder="your@email.com"
            />
          </Field>
          <Field label="Mobile">
            <input
              className={inputCls}
              type="tel"
              value={form.mobile ?? ''}
              onChange={(e) => set('mobile', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </Field>
          <Field label="Office Location">
            <input
              className={inputCls}
              value={form.officeLocation ?? ''}
              onChange={(e) => set('officeLocation', e.target.value)}
              placeholder="e.g. Room 204, Block A"
            />
          </Field>
        </div>
      </div>

      {/* Academic */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Academic Profile
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qualification">
            <input
              className={inputCls}
              value={form.qualification ?? ''}
              onChange={(e) => set('qualification', e.target.value)}
              placeholder="e.g. Ph.D., M.Tech"
            />
          </Field>
          <Field label="Specialization">
            <input
              className={inputCls}
              value={form.specialization ?? ''}
              onChange={(e) => set('specialization', e.target.value)}
              placeholder="e.g. Machine Learning"
            />
          </Field>
          <Field label="Experience (years)">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.experienceYears ?? ''}
              onChange={(e) =>
                set('experienceYears', e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="0"
            />
          </Field>
          <Field label="Research Areas">
            <input
              className={inputCls}
              value={form.researchAreas ?? ''}
              onChange={(e) => set('researchAreas', e.target.value)}
              placeholder="e.g. NLP, Computer Vision"
            />
          </Field>
        </div>
      </div>

      {/* Public */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Public / Website Profile
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Public Email">
            <input
              className={inputCls}
              type="email"
              value={form.publicEmail ?? ''}
              onChange={(e) => set('publicEmail', e.target.value)}
              placeholder="Shown on college website"
            />
          </Field>
          <Field label="Public Phone">
            <input
              className={inputCls}
              type="tel"
              value={form.publicPhone ?? ''}
              onChange={(e) => set('publicPhone', e.target.value)}
              placeholder="Shown on college website"
            />
          </Field>
          <Field label="Google Scholar URL">
            <input
              className={inputCls}
              value={form.googleScholarUrl ?? ''}
              onChange={(e) => set('googleScholarUrl', e.target.value)}
              placeholder="https://scholar.google.com/..."
            />
          </Field>
          <Field label="ORCID URL">
            <input
              className={inputCls}
              value={form.orcidUrl ?? ''}
              onChange={(e) => set('orcidUrl', e.target.value)}
              placeholder="https://orcid.org/..."
            />
          </Field>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          disabled={mut.isPending}
          onClick={() => mut.mutate(form)}
        >
          {mut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
        {saveMsg ? (
          <span
            className={cn(
              'text-sm font-medium',
              saveMsg.startsWith('Save failed') ? 'text-destructive' : 'text-green-600',
            )}
          >
            {saveMsg}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AddressTab({ profile }: { profile: ProfileData }) {
  const qc = useQueryClient();
  const profileData = profile as Record<string, unknown>;
  const addr = (profileData.addressJson as Record<string, string> | null) ?? {};
  const emerg = (profileData.emergencyContactJson as Record<string, string> | null) ?? {};

  const [address, setAddress] = useState({
    line1: addr.line1 ?? '',
    line2: addr.line2 ?? '',
    city: addr.city ?? '',
    state: addr.state ?? '',
    pincode: addr.pincode ?? '',
    country: addr.country ?? 'India',
  });
  const [emergency, setEmergency] = useState({
    name: emerg.name ?? '',
    relationship: emerg.relationship ?? '',
    phone: emerg.phone ?? '',
  });
  const [saveMsg, setSaveMsg] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      updateMyAddress({
        addressJson: address as Record<string, unknown>,
        emergencyContactJson: emergency as Record<string, unknown>,
      }),
    onSuccess: () => {
      setSaveMsg('Saved');
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me'] });
      setTimeout(() => setSaveMsg(''), 3000);
    },
    onError: (e) => setSaveMsg(`Save failed: ${apiErrorMessage(e, 'Please try again.')}`),
  });

  function setAddr(k: string, v: string) {
    setAddress((a) => ({ ...a, [k]: v }));
  }
  function setEmg(k: string, v: string) {
    setEmergency((a) => ({ ...a, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Residential Address
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address Line 1">
              <input
                className={inputCls}
                value={address.line1}
                onChange={(e) => setAddr('line1', e.target.value)}
                placeholder="House / Flat / Street"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address Line 2">
              <input
                className={inputCls}
                value={address.line2}
                onChange={(e) => setAddr('line2', e.target.value)}
                placeholder="Village / Area / Landmark"
              />
            </Field>
          </div>
          <Field label="City">
            <input
              className={inputCls}
              value={address.city}
              onChange={(e) => setAddr('city', e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              className={inputCls}
              value={address.state}
              onChange={(e) => setAddr('state', e.target.value)}
            />
          </Field>
          <Field label="PIN Code">
            <input
              className={inputCls}
              value={address.pincode}
              onChange={(e) => setAddr('pincode', e.target.value)}
              placeholder="793001"
            />
          </Field>
          <Field label="Country">
            <input
              className={inputCls}
              value={address.country}
              onChange={(e) => setAddr('country', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Emergency Contact
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputCls}
              value={emergency.name}
              onChange={(e) => setEmg('name', e.target.value)}
              placeholder="Contact person's name"
            />
          </Field>
          <Field label="Relationship">
            <input
              className={inputCls}
              value={emergency.relationship}
              onChange={(e) => setEmg('relationship', e.target.value)}
              placeholder="e.g. Spouse, Parent"
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputCls}
              type="tel"
              value={emergency.phone}
              onChange={(e) => setEmg('phone', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
        {saveMsg ? (
          <span
            className={cn(
              'text-sm font-medium',
              saveMsg.startsWith('Save failed') ? 'text-destructive' : 'text-green-600',
            )}
          >
            {saveMsg}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function StaffPortalProfilePage() {
  useRequireStaffPortal();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'basic';
  const meQ = useStaffMe();
  const subjectsQ = useMySubjectAssignments();

  const profile = meQ.data;
  const profileData = profile as Record<string, unknown> | undefined;

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
            <EditableBasicTab profile={profile} />
          ) : tab === 'basic' && meQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : null}

          {tab === 'research' ? <StaffResearchTab profileData={profileData ?? null} /> : null}

          {tab === 'address' && profile ? <AddressTab profile={profile} /> : null}

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
              {(profile.additionalRoles?.length ?? 0) > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground mb-1">Academic Roles</dt>
                  <dd className="flex flex-wrap gap-2">
                    {profile.isHod && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Head of Department
                      </span>
                    )}
                    {profile.additionalRoles?.map((r) => (
                      <span
                        key={r.code}
                        className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                      >
                        {r.label}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
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
                Salary &amp; Payslips
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
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
