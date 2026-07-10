'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Lock,
  Save,
  Upload,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchMyProfileBootstrap,
  submitMyProfileChanges,
  upsertMyClassXii,
  type ProfileBootstrap,
} from '@/services/student-profile-verification';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const WIZARD_STEPS = [
  { key: 'personal', label: 'Personal', href: '/student/my-profile/personal', icon: UserRound },
  { key: 'contact', label: 'Contact', href: '/student/my-profile/contact' },
  { key: 'guardians', label: 'Parent', href: '/student/my-profile/guardians' },
  { key: 'address', label: 'Address', href: '/student/my-profile/address' },
  { key: 'class_xii', label: 'Class XII', href: '/student/my-profile/class-xii' },
  { key: 'bank', label: 'Bank', href: '/student/my-profile/bank' },
  { key: 'emergency', label: 'Emergency', href: '/student/my-profile/emergency' },
  { key: 'documents', label: 'Documents', href: '/student/my-profile/documents' },
  { key: 'submit', label: 'Review', href: '/student/my-profile/submit' },
] as const;

type SectionKey =
  | 'dashboard'
  | 'personal'
  | 'contact'
  | 'guardians'
  | 'address'
  | 'class_xii'
  | 'bank'
  | 'emergency'
  | 'documents'
  | 'status'
  | 'submit';

const DRAFT_KEY = 'onecampus.my-profile.draft.v1';

const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_RE = /^(\+?\d{1,3}[- ]?)?\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s.includes('APPROVE') || s === 'VERIFIED') return 'bg-emerald-100 text-emerald-800';
  if (s.includes('REJECT')) return 'bg-rose-100 text-rose-800';
  if (s.includes('NEED')) return 'bg-amber-100 text-amber-900';
  if (s.includes('PENDING') || s.includes('SUBMIT')) return 'bg-sky-100 text-sky-800';
  return 'bg-muted text-muted-foreground';
}

function isoDate(value: unknown) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function calcPercentage(total?: number | null, max?: number | null) {
  if (total == null || max == null || max <= 0) return null;
  return Math.round((Number(total) / Number(max)) * 10000) / 100;
}

function gradeFromPercent(p: number | null) {
  if (p == null) return '';
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'E';
}

export function MyProfileWorkspace({ section }: { section: SectionKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  const bootstrapQ = useQuery({
    queryKey: ['my-profile', 'bootstrap'],
    queryFn: fetchMyProfileBootstrap,
    staleTime: 30_000,
  });

  const bootstrap = bootstrapQ.data;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  const saveDraftLocal = useCallback((payload: unknown) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), payload }),
      );
      setDraftSavedAt(new Date().toLocaleTimeString());
      setMessage('Draft saved on this device');
    } catch {
      setMessage('Could not save draft locally');
    }
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const t = window.setInterval(() => {
      setMessage((m) => m || 'Tip: use Save Draft to keep your work');
    }, 180_000);
    return () => window.clearInterval(t);
  }, [dirty]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['my-profile'] });
    setDirty(false);
  };

  if (bootstrapQ.isLoading) {
    return <ProfileSkeleton />;
  }

  if (bootstrapQ.isError || !bootstrap) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        Could not load your profile. {apiErrorMessage(bootstrapQ.error, 'Please try again.')}
        <div className="mt-3">
          <Button size="sm" onClick={() => bootstrapQ.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === section);
  const activeStep = stepIndex >= 0 ? stepIndex : 0;

  return (
    <div className="space-y-4 pb-24">
      <ProfileHeroCard bootstrap={bootstrap} onJump={(href) => router.push(href)} />

      <Stepper
        activeKey={section === 'dashboard' || section === 'status' ? 'personal' : section}
        pathname={pathname}
        completion={bootstrap.completion}
      />

      {message ? (
        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {message}
          {draftSavedAt ? ` · Last draft ${draftSavedAt}` : ''}
        </p>
      ) : null}

      {(section === 'dashboard' || section === 'status') && (
        <CompletionPanel
          completion={bootstrap.completion}
          verificationStatus={bootstrap.verificationStatus}
          changeRequests={bootstrap.changeRequests}
          onJump={(href) => router.push(href)}
        />
      )}

      {section === 'personal' && (
        <PersonalForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'contact' && (
        <ContactForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'guardians' && (
        <GuardiansForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'address' && (
        <AddressForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'class_xii' && (
        <ClassXiiForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'bank' && (
        <BankForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'emergency' && (
        <EmergencyForm
          bootstrap={bootstrap}
          onDirty={markDirty}
          onDone={setMessage}
          onDraft={saveDraftLocal}
          refresh={refresh}
        />
      )}
      {section === 'documents' && (
        <DocumentsForm bootstrap={bootstrap} onDone={setMessage} refresh={refresh} />
      )}
      {section === 'submit' && (
        <ReviewSubmitPanel bootstrap={bootstrap} onDone={setMessage} refresh={refresh} />
      )}

      {stepIndex >= 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={activeStep === 0}
            onClick={() => router.push(WIZARD_STEPS[Math.max(0, activeStep - 1)].href)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            disabled={activeStep >= WIZARD_STEPS.length - 1}
            onClick={() =>
              router.push(WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, activeStep + 1)].href)
            }
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-muted" />
      <div className="h-12 rounded-xl bg-muted" />
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}

function ProfileHeroCard({
  bootstrap,
  onJump,
}: {
  bootstrap: ProfileBootstrap;
  onJump: (href: string) => void;
}) {
  const s = bootstrap.student;
  const percent = bootstrap.completion.percent ?? 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-muted text-2xl font-semibold text-muted-foreground">
            {s.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photoPath} alt="" className="h-full w-full object-cover" />
            ) : (
              (s.fullName ?? 'S').slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{s.fullName ?? 'Student'}</h1>
            <p className="text-sm text-muted-foreground">
              {[s.rollNumber, s.programme, s.semester != null ? `Sem ${s.semester}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            <p className="text-xs text-muted-foreground">{s.department ?? ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              statusBadgeClass(bootstrap.verificationStatus),
            )}
          >
            Profile Status: {bootstrap.verificationStatus.replaceAll('_', ' ')}
          </span>
          <div className="min-w-[140px]">
            <div className="mb-1 flex justify-between text-xs">
              <span>Completion</span>
              <span className="font-semibold">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onJump('/student/my-profile/status')}>
            View gaps
          </Button>
        </div>
      </div>
      {bootstrap.completion.softGate?.active && bootstrap.completion.softGate.message ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {bootstrap.completion.softGate.message}
        </div>
      ) : null}
    </div>
  );
}

function Stepper({
  activeKey,
  pathname,
  completion,
}: {
  activeKey: string;
  pathname: string;
  completion: ProfileBootstrap['completion'];
}) {
  const missingKeys = new Set((completion.missing ?? []).map((m) => m.key));
  return (
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">
      {WIZARD_STEPS.map((step, idx) => {
        const active = pathname === step.href || activeKey === step.key;
        const sectionMissing =
          (step.key === 'personal' && (missingKeys.has('aadhaar') || missingKeys.has('dob'))) ||
          (step.key === 'guardians' && missingKeys.has('fatherMobile')) ||
          (step.key === 'address' && missingKeys.has('address')) ||
          (step.key === 'class_xii' && missingKeys.has('classXii')) ||
          (step.key === 'bank' && missingKeys.has('bank')) ||
          (step.key === 'documents' && (missingKeys.has('photo') || missingKeys.has('marksheet')));
        return (
          <Link
            key={step.key}
            href={step.href}
            className={cn(
              'flex min-w-[88px] flex-col items-center rounded-xl px-3 py-2 text-center text-xs transition',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/70',
            )}
          >
            <span className="font-semibold">{idx + 1}</span>
            <span className="mt-0.5">{step.label}</span>
            {sectionMissing && !active ? (
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{value || '—'}</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          Read only
        </span>
      </div>
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StickyBar({
  onDraft,
  onSubmit,
  submitting,
  draftLabel = 'Save Draft',
}: {
  onDraft: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  draftLabel?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:mt-4 md:rounded-2xl md:border md:bg-card md:p-3 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onDraft}>
          <Save className="mr-1 h-4 w-4" /> {draftLabel}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Save & Submit
        </Button>
      </div>
    </div>
  );
}

function CompletionPanel({
  completion,
  verificationStatus,
  changeRequests,
  onJump,
}: {
  completion: ProfileBootstrap['completion'];
  verificationStatus: string;
  changeRequests: ProfileBootstrap['changeRequests'];
  onJump: (href: string) => void;
}) {
  const hrefForMissing: Record<string, string> = {
    aadhaar: '/student/my-profile/personal',
    bloodGroup: '/student/my-profile/personal',
    mobile: '/student/my-profile/contact',
    email: '/student/my-profile/contact',
    dob: '/student/my-profile/personal',
    fatherMobile: '/student/my-profile/guardians',
    address: '/student/my-profile/address',
    bank: '/student/my-profile/bank',
    classXii: '/student/my-profile/class-xii',
    photo: '/student/my-profile/documents',
    marksheet: '/student/my-profile/documents',
  };
  const latest = changeRequests?.[0];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Profile Completion</h2>
            <p className="text-sm text-muted-foreground">
              {completion.filledCount}/{completion.totalCount} tracked fields complete
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              statusBadgeClass(verificationStatus),
            )}
          >
            {verificationStatus.replaceAll('_', ' ')}
          </span>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>{completion.percent}% Completed</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(completion.checks ?? []).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onJump(hrefForMissing[c.key] ?? '/student/my-profile/personal')}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm',
                c.filled
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-amber-200 bg-amber-50/60',
              )}
            >
              <span>{c.label}</span>
              <span className="text-xs font-medium">{c.filled ? '✓ Done' : 'Missing'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Timeline</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Created / loaded from student record</li>
          {latest?.submittedAt ? (
            <li>Submitted: {new Date(latest.submittedAt).toLocaleString()}</li>
          ) : (
            <li>Not yet submitted for verification</li>
          )}
          {latest?.status ? <li>Latest status: {latest.status}</li> : null}
          {latest?.remarks ? (
            <li className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              Admin remarks: {latest.remarks}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

type FormShellProps = {
  bootstrap: ProfileBootstrap;
  onDirty: () => void;
  onDone: (msg: string) => void;
  onDraft: (payload: unknown) => void;
  refresh: () => Promise<void>;
};

function PersonalForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.personal ?? {};
  const [form, setForm] = useState({
    fullName: String(data.fullName ?? ''),
    mobileNumber: String(data.mobileNumber ?? ''),
    alternateMobile: String(data.alternateMobile ?? ''),
    email: String(data.email ?? ''),
    dateOfBirth: isoDate(data.dateOfBirth),
    gender: String(data.gender ?? ''),
    bloodGroupLookupId: String(data.bloodGroupLookupId ?? ''),
    nationalityLookupId: String(data.nationalityLookupId ?? ''),
    religionLookupId: String(data.religionLookupId ?? ''),
    categoryLookupId: String(data.categoryLookupId ?? ''),
    maritalStatus: String(data.maritalStatus ?? ''),
    nationalId: String(data.nationalId ?? ''),
    panNumber: String(data.panNumber ?? ''),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const genderOptions =
    bootstrap.lookups.gender.length > 0
      ? bootstrap.lookups.gender.map((g) => ({
          value: g.code || g.label.toUpperCase(),
          label: g.label,
        }))
      : bootstrap.staticOptions.genderFallback;

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    onDirty();
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.nationalId && !AADHAAR_RE.test(form.nationalId.replace(/\s/g, ''))) {
      next.nationalId = 'Aadhaar must be exactly 12 digits';
    }
    if (form.panNumber && !PAN_RE.test(form.panNumber.toUpperCase())) {
      next.panNumber = 'PAN format must be ABCDE1234F';
    }
    if (form.mobileNumber && !MOBILE_RE.test(form.mobileNumber.replace(/\s/g, ''))) {
      next.mobileNumber = 'Enter a valid 10-digit mobile number';
    }
    if (form.email && !EMAIL_RE.test(form.email)) {
      next.email = 'Enter a valid email address';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Please fix validation errors');
      const changes = Object.entries(form).map(([fieldKey, newValue]) => ({
        sectionKey: 'personal',
        fieldKey,
        newValue:
          fieldKey === 'panNumber'
            ? newValue
              ? newValue.toUpperCase()
              : null
            : fieldKey === 'nationalId'
              ? newValue.replace(/\s/g, '') || null
              : newValue || null,
      }));
      return submitMyProfileChanges(changes);
    },
    onSuccess: async () => {
      onDone('Personal details submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });

  return (
    <SectionCard title="Personal Information" subtitle="Demographics and identity details">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Admission / Roll" value={bootstrap.readOnly.rollNumber as string} />
        <ReadOnlyField label="Programme" value={bootstrap.readOnly.programme as string} />
        <Field label="Full Name" required>
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label="Date of Birth" required error={errors.dateOfBirth}>
          <DateInput value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
        </Field>
        <Field label="Gender" required>
          <SelectBox
            value={form.gender}
            onChange={(v) => set('gender', v)}
            options={genderOptions}
          />
        </Field>
        <Field label="Blood Group" required>
          <SelectBox
            value={form.bloodGroupLookupId}
            onChange={(v) => set('bloodGroupLookupId', v)}
            options={bootstrap.lookups.bloodGroup.map((o) => ({ value: o.id, label: o.label }))}
          />
        </Field>
        <Field label="Marital Status">
          <SelectBox
            value={form.maritalStatus}
            onChange={(v) => set('maritalStatus', v)}
            options={bootstrap.staticOptions.maritalStatus}
          />
        </Field>
        <Field label="Religion">
          <SelectBox
            value={form.religionLookupId}
            onChange={(v) => set('religionLookupId', v)}
            options={bootstrap.lookups.religion.map((o) => ({ value: o.id, label: o.label }))}
          />
        </Field>
        <Field label="Nationality">
          <SelectBox
            value={form.nationalityLookupId}
            onChange={(v) => set('nationalityLookupId', v)}
            options={bootstrap.lookups.nationality.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="Indian / Other"
          />
        </Field>
        <Field label="Category">
          <SelectBox
            value={form.categoryLookupId}
            onChange={(v) => set('categoryLookupId', v)}
            options={bootstrap.lookups.category.map((o) => ({ value: o.id, label: o.label }))}
          />
        </Field>
        <Field label="Mobile Number" required error={errors.mobileNumber}>
          <Input
            inputMode="numeric"
            value={form.mobileNumber}
            onChange={(e) =>
              set('mobileNumber', e.target.value.replace(/[^\d+]/g, '').slice(0, 13))
            }
          />
        </Field>
        <Field label="Alternate Mobile">
          <Input
            inputMode="numeric"
            value={form.alternateMobile}
            onChange={(e) =>
              set('alternateMobile', e.target.value.replace(/[^\d+]/g, '').slice(0, 13))
            }
          />
        </Field>
        <Field label="Personal Email" required error={errors.email}>
          <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Aadhaar Number" required error={errors.nationalId}>
          <Input
            inputMode="numeric"
            value={form.nationalId}
            onChange={(e) => set('nationalId', e.target.value.replace(/\D/g, '').slice(0, 12))}
          />
        </Field>
        <Field label="PAN Number" error={errors.panNumber}>
          <Input
            value={form.panNumber}
            onChange={(e) => set('panNumber', e.target.value.toUpperCase().slice(0, 10))}
          />
        </Field>
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'personal', form })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function ContactForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.contact ?? {};
  const [form, setForm] = useState({
    mobileNumber: String(data.mobileNumber ?? ''),
    whatsappNumber: String(data.whatsappNumber ?? ''),
    email: String(data.email ?? ''),
    emergencyContactMobile: String(data.emergencyContactMobile ?? ''),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    onDirty();
  };
  const mut = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (form.mobileNumber && !MOBILE_RE.test(form.mobileNumber.replace(/\s/g, ''))) {
        next.mobileNumber = 'Invalid mobile';
      }
      if (form.email && !EMAIL_RE.test(form.email)) next.email = 'Invalid email';
      setErrors(next);
      if (Object.keys(next).length) throw new Error('Validation failed');
      return submitMyProfileChanges(
        Object.entries(form).map(([fieldKey, newValue]) => ({
          sectionKey: 'contact',
          fieldKey,
          newValue: newValue || null,
        })),
      );
    },
    onSuccess: async () => {
      onDone('Contact details submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });
  return (
    <SectionCard title="Contact Information" subtitle="How we can reach you">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Personal Mobile" required error={errors.mobileNumber}>
          <Input value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} />
        </Field>
        <Field label="WhatsApp Number">
          <Input
            value={form.whatsappNumber}
            onChange={(e) => set('whatsappNumber', e.target.value)}
          />
        </Field>
        <Field label="Personal Email" required error={errors.email}>
          <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Emergency Contact Number" required>
          <Input
            value={form.emergencyContactMobile}
            onChange={(e) => set('emergencyContactMobile', e.target.value)}
          />
        </Field>
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'contact', form })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function GuardiansForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.guardians ?? {};
  const blank = { fullName: '', occupation: '', contactNumber: '', email: '' };
  const [father, setFather] = useState({ ...blank, ...(data.FATHER ?? {}) });
  const [mother, setMother] = useState({ ...blank, ...(data.MOTHER ?? {}) });
  const [guardian, setGuardian] = useState({ ...blank, ...(data.GUARDIAN ?? {}) });

  const mut = useMutation({
    mutationFn: () =>
      submitMyProfileChanges([
        { sectionKey: 'guardians', fieldKey: 'FATHER', newValue: father },
        { sectionKey: 'guardians', fieldKey: 'MOTHER', newValue: mother },
        { sectionKey: 'guardians', fieldKey: 'GUARDIAN', newValue: guardian },
      ]),
    onSuccess: async () => {
      onDone('Guardian details submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });

  const editor = (title: string, value: typeof father, setValue: (v: typeof father) => void) => (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['fullName', 'Full Name'],
            ['occupation', 'Occupation'],
            ['contactNumber', 'Mobile'],
            ['email', 'Email'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <Input
              value={String((value as any)[k] ?? '')}
              onChange={(e) => {
                setValue({ ...value, [k]: e.target.value });
                onDirty();
              }}
            />
          </Field>
        ))}
      </div>
    </div>
  );

  return (
    <SectionCard title="Parent / Guardian" subtitle="Family contact details">
      <div className="space-y-4">
        {editor('Father', father, setFather)}
        {editor('Mother', mother, setMother)}
        {editor('Guardian (optional)', guardian, setGuardian)}
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'guardians', father, mother, guardian })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function AddressForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.address ?? {};
  const blank = { line1: '', line2: '', city: '', state: '', district: '', pinCode: '' };
  const [current, setCurrent] = useState({ ...blank, ...(data.current ?? {}) });
  const [permanent, setPermanent] = useState({ ...blank, ...(data.permanent ?? {}) });
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  useEffect(() => {
    if (sameAsCurrent) setPermanent(current);
  }, [sameAsCurrent, current]);

  const mut = useMutation({
    mutationFn: () =>
      submitMyProfileChanges([
        { sectionKey: 'address', fieldKey: 'current', newValue: current },
        { sectionKey: 'address', fieldKey: 'permanent', newValue: permanent },
      ]),
    onSuccess: async () => {
      onDone('Address submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });

  const block = (
    title: string,
    value: typeof current,
    setValue: (v: typeof current) => void,
    disabled?: boolean,
  ) => (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['line1', 'Address Line 1'],
            ['line2', 'Address Line 2'],
            ['city', 'City'],
            ['district', 'District'],
            ['state', 'State'],
            ['pinCode', 'PIN Code'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <Input
              disabled={disabled}
              value={String((value as any)[k] ?? '')}
              onChange={(e) => {
                setValue({ ...value, [k]: e.target.value });
                onDirty();
              }}
            />
          </Field>
        ))}
      </div>
    </div>
  );

  return (
    <SectionCard title="Address Details" subtitle="Current and permanent address">
      <div className="space-y-4">
        {block('Current / Local (Tura)', current, setCurrent)}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sameAsCurrent}
            onChange={(e) => {
              setSameAsCurrent(e.target.checked);
              onDirty();
            }}
          />
          Permanent address same as current
        </label>
        {block('Permanent / Home', permanent, setPermanent, sameAsCurrent)}
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'address', current, permanent })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function ClassXiiForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const exam = bootstrap.sections.class_xii ?? null;
  const [form, setForm] = useState({
    boardName: String(exam?.boardName ?? ''),
    schoolName: String(exam?.schoolName ?? ''),
    boardRollNumber: String(exam?.boardRollNumber ?? ''),
    registrationNumber: String(exam?.registrationNumber ?? ''),
    examYear: exam?.examYear != null ? String(exam.examYear) : '',
    stream: String(exam?.stream ?? ''),
    totalMarks: exam?.totalMarks != null ? String(exam.totalMarks) : '',
    maximumMarks: exam?.maximumMarks != null ? String(exam.maximumMarks) : '',
    grade: String(exam?.grade ?? ''),
    division: String(exam?.division ?? ''),
  });
  const [subjects, setSubjects] = useState<
    Array<{ subjectName: string; marksObtained: string; maxMarks: string; grade: string }>
  >(
    (exam?.subjectMarks ?? []).map((s: any) => ({
      subjectName: s.subjectName ?? '',
      marksObtained: s.marksObtained != null ? String(s.marksObtained) : '',
      maxMarks: s.maxMarks != null ? String(s.maxMarks) : '100',
      grade: s.grade ?? '',
    })),
  );
  const [boardCustom, setBoardCustom] = useState(
    form.boardName && !bootstrap.staticOptions.board.includes(form.boardName),
  );

  const percent = useMemo(
    () => calcPercentage(Number(form.totalMarks), Number(form.maximumMarks)),
    [form.totalMarks, form.maximumMarks],
  );

  useEffect(() => {
    if (percent != null && !form.grade) {
      setForm((p) => ({ ...p, grade: gradeFromPercent(percent) }));
    }
  }, [percent, form.grade]);

  const mut = useMutation({
    mutationFn: () =>
      upsertMyClassXii({
        boardName: form.boardName || null,
        schoolName: form.schoolName || null,
        boardRollNumber: form.boardRollNumber || null,
        registrationNumber: form.registrationNumber || null,
        examYear: form.examYear ? Number(form.examYear) : null,
        stream: form.stream || null,
        totalMarks: form.totalMarks ? Number(form.totalMarks) : null,
        maximumMarks: form.maximumMarks ? Number(form.maximumMarks) : null,
        grade: form.grade || null,
        division: form.division || null,
        subjects: subjects
          .filter((s) => s.subjectName.trim())
          .map((s) => ({
            subjectName: s.subjectName,
            marksObtained: s.marksObtained ? Number(s.marksObtained) : null,
            maxMarks: s.maxMarks ? Number(s.maxMarks) : null,
            grade: s.grade || null,
          })),
      }),
    onSuccess: async () => {
      onDone('Class XII details saved for verification');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });

  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    onDirty();
  };

  return (
    <SectionCard title="Class XII Academic Details" subtitle="Board exam and subject marks">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Board / Council" required>
          <SelectBox
            value={boardCustom ? 'Others' : form.boardName}
            onChange={(v) => {
              if (v === 'Others') {
                setBoardCustom(true);
                set('boardName', '');
              } else {
                setBoardCustom(false);
                set('boardName', v);
              }
            }}
            options={bootstrap.staticOptions.board.map((b) => ({ value: b, label: b }))}
          />
        </Field>
        {boardCustom ? (
          <Field label="Custom Board Name">
            <Input value={form.boardName} onChange={(e) => set('boardName', e.target.value)} />
          </Field>
        ) : null}
        <Field label="Stream" required>
          <SelectBox
            value={form.stream}
            onChange={(v) => set('stream', v)}
            options={bootstrap.staticOptions.stream}
          />
        </Field>
        <Field label="Year of Passing" required>
          <SelectBox
            value={form.examYear}
            onChange={(v) => set('examYear', v)}
            options={bootstrap.staticOptions.yearOfPassing.map((y) => ({
              value: String(y),
              label: String(y),
            }))}
          />
        </Field>
        <Field label="School Name">
          <Input value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
        </Field>
        <Field label="Board Roll No.">
          <Input
            value={form.boardRollNumber}
            onChange={(e) => set('boardRollNumber', e.target.value)}
          />
        </Field>
        <Field label="Registration No.">
          <Input
            value={form.registrationNumber}
            onChange={(e) => set('registrationNumber', e.target.value)}
          />
        </Field>
        <Field label="Total Marks">
          <Input
            inputMode="numeric"
            value={form.totalMarks}
            onChange={(e) => set('totalMarks', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Maximum Marks">
          <Input
            inputMode="numeric"
            value={form.maximumMarks}
            onChange={(e) => set('maximumMarks', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Percentage (auto)">
          <Input readOnly className="bg-muted/50" value={percent != null ? `${percent}%` : ''} />
        </Field>
        <Field label="Grade">
          <Input value={form.grade} onChange={(e) => set('grade', e.target.value)} />
        </Field>
        <Field label="Division">
          <Input value={form.division} onChange={(e) => set('division', e.target.value)} />
        </Field>
      </div>

      <div className="mt-6 overflow-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Marks</th>
              <th className="px-3 py-2">Maximum</th>
              <th className="px-3 py-2">Grade</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {subjects.map((row, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="px-2 py-1">
                  <Input
                    value={row.subjectName}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx] = { ...row, subjectName: e.target.value };
                      setSubjects(next);
                      onDirty();
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.marksObtained}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx] = { ...row, marksObtained: e.target.value.replace(/\D/g, '') };
                      setSubjects(next);
                      onDirty();
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.maxMarks}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx] = { ...row, maxMarks: e.target.value.replace(/\D/g, '') };
                      setSubjects(next);
                      onDirty();
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.grade}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx] = { ...row, grade: e.target.value };
                      setSubjects(next);
                      onDirty();
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSubjects(subjects.filter((_, i) => i !== idx));
                      onDirty();
                    }}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => {
          setSubjects([
            ...subjects,
            { subjectName: '', marksObtained: '', maxMarks: '100', grade: '' },
          ]);
          onDirty();
        }}
      >
        Add Row
      </Button>

      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'class_xii', form, subjects })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function BankForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.bank ?? {};
  const [form, setForm] = useState({
    bankName: String(data.bankName ?? ''),
    accountHolderName: String(data.accountHolderName ?? ''),
    accountNumber: String(data.accountNumber ?? ''),
    ifsc: String(data.ifsc ?? ''),
    branchName: String(data.branchName ?? ''),
  });
  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    onDirty();
  };
  const mut = useMutation({
    mutationFn: () =>
      submitMyProfileChanges([{ sectionKey: 'bank', fieldKey: 'bankDetails', newValue: form }]),
    onSuccess: async () => {
      onDone('Bank details submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });
  return (
    <SectionCard title="Bank Details" subtitle="For scholarships and refunds">
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['bankName', 'Bank Name'],
            ['accountHolderName', 'Account Holder Name'],
            ['accountNumber', 'Account Number'],
            ['ifsc', 'IFSC Code'],
            ['branchName', 'Branch Name'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} required={k !== 'branchName'}>
            <Input
              value={(form as any)[k]}
              onChange={(e) => set(k, k === 'ifsc' ? e.target.value.toUpperCase() : e.target.value)}
            />
          </Field>
        ))}
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'bank', form })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function EmergencyForm({ bootstrap, onDirty, onDone, onDraft, refresh }: FormShellProps) {
  const data = bootstrap.sections.emergency ?? {};
  const [form, setForm] = useState({
    emergencyContactName: String(data.emergencyContactName ?? ''),
    emergencyContactRelation: String(data.emergencyContactRelation ?? ''),
    emergencyContactMobile: String(data.emergencyContactMobile ?? ''),
  });
  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    onDirty();
  };
  const mut = useMutation({
    mutationFn: () =>
      submitMyProfileChanges([
        { sectionKey: 'emergency', fieldKey: 'emergencyContact', newValue: form },
      ]),
    onSuccess: async () => {
      onDone('Emergency contact submitted');
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Save failed')),
  });
  return (
    <SectionCard title="Emergency Contact" subtitle="Person to contact in an emergency">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact Person" required>
          <Input
            value={form.emergencyContactName}
            onChange={(e) => set('emergencyContactName', e.target.value)}
          />
        </Field>
        <Field label="Relationship" required>
          <Input
            value={form.emergencyContactRelation}
            onChange={(e) => set('emergencyContactRelation', e.target.value)}
          />
        </Field>
        <Field label="Mobile" required>
          <Input
            value={form.emergencyContactMobile}
            onChange={(e) => set('emergencyContactMobile', e.target.value)}
          />
        </Field>
      </div>
      <StickyBar
        submitting={mut.isPending}
        onDraft={() => onDraft({ section: 'emergency', form })}
        onSubmit={() => mut.mutate()}
      />
    </SectionCard>
  );
}

function DocumentsForm({
  bootstrap,
  onDone,
  refresh,
}: {
  bootstrap: ProfileBootstrap;
  onDone: (msg: string) => void;
  refresh: () => Promise<void>;
}) {
  const docs = bootstrap.sections.documents?.documents ?? [];
  const allowed = bootstrap.sections.documents?.allowedTypes ?? [];
  const [docType, setDocType] = useState(String(allowed[0] ?? 'PHOTO'));
  const [file, setFile] = useState<File | null>(null);
  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('documentType', docType);
      await api.post('/v1/students/me/documents', fd);
    },
    onSuccess: async () => {
      onDone('Document uploaded');
      setFile(null);
      await refresh();
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Upload failed')),
  });

  return (
    <SectionCard title="Documents" subtitle="Upload and track verification status">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <SelectBox
          value={docType}
          onChange={setDocType}
          options={(allowed as string[]).map((t) => ({ value: t, label: t }))}
        />
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !file}>
          <Upload className="mr-1 h-4 w-4" /> Upload
        </Button>
      </div>
      <div className="space-y-2">
        {docs.map((doc: any) => (
          <div
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{doc.documentType}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : 'Uploaded'}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                statusBadgeClass(doc.verificationStatus ?? 'PENDING'),
              )}
            >
              {doc.verificationStatus ?? 'PENDING'}
            </span>
          </div>
        ))}
        {!docs.length ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ReviewSubmitPanel({
  bootstrap,
  onDone,
  refresh,
}: {
  bootstrap: ProfileBootstrap;
  onDone: (msg: string) => void;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const mut = useMutation({
    mutationFn: async () => {
      await refresh();
      return true;
    },
    onSuccess: async () => {
      onDone(
        'Verification status refreshed. Save each incomplete section, then wait for office review.',
      );
    },
    onError: (e) => onDone(apiErrorMessage(e, 'Refresh failed')),
  });
  return (
    <SectionCard
      title="Review & Submit"
      subtitle="Confirm completion, then submit remaining items for verification"
    >
      <CompletionPanel
        completion={bootstrap.completion}
        verificationStatus={bootstrap.verificationStatus}
        changeRequests={bootstrap.changeRequests}
        onJump={(href) => router.push(href)}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        Tip: Save each section with <strong>Save & Submit</strong> as you go. Auto-approve fields
        apply immediately; Aadhaar, Class XII, and documents wait for office verification.
      </p>
      <div className="mt-4">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Refresh verification status
        </Button>
      </div>
    </SectionCard>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
