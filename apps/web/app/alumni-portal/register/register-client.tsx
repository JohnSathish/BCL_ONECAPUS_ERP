'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Check,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Phone,
  Upload,
  User,
} from 'lucide-react';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { Button } from '@/components/ui/button';
import {
  ALUMNI_BLOOD_GROUPS,
  ALUMNI_DEPARTMENTS,
  ALUMNI_EMPLOYMENT_STATUSES,
  ALUMNI_GENDERS,
  ALUMNI_MEMBERSHIP_BENEFITS,
  ALUMNI_REGISTRATION_STEPS,
  INDIA_STATES_AND_UTS,
  alumniPassingYears,
} from '@/lib/alumni-form-options';
import { fetchAlumniPortalInfo, registerAlumni } from '@/services/alumni-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const YEARS = alumniPassingYears();
const SHOW_EMPLOYER_FIELDS = new Set(['Employed', 'Self-employed', 'Government', 'Business']);

type FormState = {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  photoUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  currentAddress: string;
  state: string;
  country: string;
  pinCode: string;
  graduationYear: string;
  department: string;
  collegeRollNumber: string;
  universityRegNumber: string;
  employmentStatus: string;
  occupation: string;
  currentOrg: string;
  currentRole: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  membershipTypeId: string;
  certifyTrue: boolean;
  agreeCommunications: boolean;
};

type SuccessPayload = {
  id: string;
  message: string;
  payment: {
    id: string;
    paymentToken: string;
    amountInr: number;
  } | null;
};

async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Please upload a JPEG or PNG photo.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Photo must be 2 MB or smaller.');
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process photo.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function AlumniRegisterPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const typeFromQuery = params.get('type') ?? '';
  const infoQ = useQuery({ queryKey: ['alumni-portal-info'], queryFn: fetchAlumniPortalInfo });
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    bloodGroup: '',
    photoUrl: '',
    email: '',
    phone: '',
    whatsapp: '',
    currentAddress: '',
    state: '',
    country: 'India',
    pinCode: '',
    graduationYear: '',
    department: '',
    collegeRollNumber: '',
    universityRegNumber: '',
    employmentStatus: '',
    occupation: '',
    currentOrg: '',
    currentRole: '',
    linkedinUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    websiteUrl: '',
    membershipTypeId: typeFromQuery,
    certifyTrue: false,
    agreeCommunications: true,
  });

  const types = infoQ.data?.membershipTypes ?? [];
  const stats = infoQ.data?.stats;
  const defaultTypeId = useMemo(
    () => form.membershipTypeId || types[0]?.id || '',
    [form.membershipTypeId, types],
  );
  const selectedType = types.find((t) => t.id === defaultTypeId) ?? types[0];
  const progress = Math.round(((step + 1) / ALUMNI_REGISTRATION_STEPS.length) * 100);

  const mut = useMutation({
    mutationFn: () =>
      registerAlumni({
        ...form,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        membershipTypeId: defaultTypeId || undefined,
        photoUrl: form.photoUrl || undefined,
        certifyTrue: form.certifyTrue,
        agreeCommunications: form.agreeCommunications,
      }),
    onSuccess: (res) => {
      setSuccess({
        id: res.id,
        message: res.message,
        payment: res.payment
          ? {
              id: res.payment.id,
              paymentToken: res.payment.paymentToken,
              amountInr: res.payment.amountInr,
            }
          : null,
      });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Registration failed')),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(index: number) {
    if (index === 0 && !form.fullName.trim()) return 'Full name is required.';
    if (index === 1 && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Enter a valid email address.';
    }
    if (index === 4) {
      if (!form.certifyTrue) return 'Please certify that the information provided is true.';
      if (!defaultTypeId) return 'Please select a membership type.';
    }
    return '';
  }

  function goNext() {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, ALUMNI_REGISTRATION_STEPS.length - 1));
  }

  function goPrev() {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const msg = validateStep(4);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    mut.mutate();
  }

  async function onPhotoChange(file: File | null) {
    setPhotoError('');
    if (!file) {
      set('photoUrl', '');
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      set('photoUrl', dataUrl);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not upload photo');
    }
  }

  if (success) {
    const ref = `ALU-${new Date().getFullYear()}-${success.id.slice(0, 8).toUpperCase()}`;
    return (
      <AlumniPublicShell associationName={infoQ.data?.settings.associationName}>
        <div className="bg-[#F8FAFC] px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-[#0A2342]/10 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-5 font-serif text-3xl text-[#0A2342]">
              Registration Submitted Successfully
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#0A2342]/70">{success.message}</p>
            <div className="mt-6 rounded-xl bg-[#0A2342] px-4 py-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F4B400]">
                Application reference
              </p>
              <p className="mt-1 font-mono text-lg">{ref}</p>
              <p className="mt-2 text-xs text-white/70">Pending Verification</p>
            </div>
            <p className="mt-4 text-sm text-[#0A2342]/65">
              You will receive an email after the Alumni Office verifies your details.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {success.payment ? (
                <Button
                  className="bg-[#0A2342] text-white hover:bg-[#F4B400] hover:text-[#0A2342]"
                  onClick={() => {
                    const qs = new URLSearchParams({
                      alumniId: success.id,
                      paymentId: success.payment!.id,
                      paymentToken: success.payment!.paymentToken,
                    });
                    router.push(`/alumni-portal/pay?${qs.toString()}`);
                  }}
                >
                  Pay ₹{success.payment.amountInr.toLocaleString('en-IN')} Now
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="border-[#0A2342]/20"
                onClick={() => router.push('/alumni-portal')}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </AlumniPublicShell>
    );
  }

  return (
    <AlumniPublicShell associationName={infoQ.data?.settings.associationName}>
      <div className="bg-[#F8FAFC]">
        <section className="border-b border-[#0A2342]/10 bg-[#0A2342] text-white">
          <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F4B400]">
              Don Bosco College Tura
            </p>
            <h1 className="mt-2 font-serif text-3xl md:text-4xl">Become a Member</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75 md:text-base">
              Join the Alumni Association — reconnect, network, and give back.
            </p>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[0.95fr_1.35fr] lg:gap-8 lg:px-6 lg:py-10">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div
              className="overflow-hidden rounded-2xl border border-[#0A2342]/10 bg-cover bg-center shadow-md"
              style={{
                backgroundImage:
                  'linear-gradient(160deg, rgba(10,35,66,0.88), rgba(10,35,66,0.55)), url(/branding/alumni-campus-hero.png)',
                minHeight: 220,
              }}
            >
              <div className="flex h-full flex-col justify-end p-6 text-white">
                <p className="text-2xl font-semibold">
                  Join {(stats?.displayAlumni ?? 5000).toLocaleString('en-IN')}+ Alumni Worldwide
                </p>
                <ul className="mt-4 space-y-2 text-sm text-white/90">
                  {[
                    'Networking Opportunities',
                    'Alumni Events',
                    'Career Support',
                    'College Updates',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#F4B400]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-[#0A2342]/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#0A2342]">
                Membership Benefits
              </h2>
              <ul className="mt-3 space-y-2">
                {ALUMNI_MEMBERSHIP_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-[#0A2342]/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F4B400]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#0A2342]/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#0A2342]">
                What happens next
              </h2>
              <ol className="mt-3 space-y-3 text-sm text-[#0A2342]/80">
                {[
                  'Register online',
                  'Verification by Alumni Office',
                  'Approval',
                  'Online payment',
                  'Digital membership card',
                ].map((label, i) => (
                  <li key={label} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A2342] text-[11px] font-bold text-[#F4B400]">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="rounded-2xl border border-[#0A2342]/10 bg-white p-5 shadow-lg sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F4B400]">
                  Step {step + 1} of {ALUMNI_REGISTRATION_STEPS.length}
                </p>
                <h2 className="mt-1 font-serif text-2xl text-[#0A2342]">
                  {ALUMNI_REGISTRATION_STEPS[step]?.label}
                </h2>
              </div>
              <p className="text-sm font-medium text-[#0A2342]/65">{progress}% Complete</p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#0A2342]/10">
              <div
                className="h-full rounded-full bg-[#F4B400] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ALUMNI_REGISTRATION_STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    if (i <= step) setStep(i);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition',
                    i === step
                      ? 'bg-[#0A2342] text-white'
                      : i < step
                        ? 'bg-[#F4B400]/25 text-[#0A2342]'
                        : 'bg-[#0A2342]/5 text-[#0A2342]/45',
                  )}
                >
                  <StepIcon name={s.icon} className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              ))}
            </div>

            <div className="mt-7 space-y-5">
              {step === 0 ? (
                <StepCard title="Personal Information" icon={<User className="h-4 w-4" />}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FloatingField
                      label="Full Name *"
                      value={form.fullName}
                      onChange={(v) => set('fullName', v)}
                      required
                      className="sm:col-span-2"
                    />
                    <FloatingSelect
                      label="Gender"
                      value={form.gender}
                      onChange={(v) => set('gender', v)}
                      options={ALUMNI_GENDERS.map((g) => ({ value: g, label: g }))}
                    />
                    <FloatingField
                      label="Date of Birth"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(v) => set('dateOfBirth', v)}
                    />
                    <FloatingSelect
                      label="Blood Group"
                      value={form.bloodGroup}
                      onChange={(v) => set('bloodGroup', v)}
                      options={ALUMNI_BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
                    />
                    <div className="sm:col-span-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A2342]/55">
                        Profile Photo
                      </p>
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#0A2342]/25 bg-[#F8FAFC] px-4 py-6 text-center transition hover:border-[#F4B400]">
                        {form.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={form.photoUrl}
                            alt="Profile preview"
                            className="h-24 w-24 rounded-full object-cover ring-2 ring-[#F4B400]/50"
                          />
                        ) : (
                          <Upload className="h-8 w-8 text-[#0A2342]/45" />
                        )}
                        <span className="text-sm font-medium text-[#0A2342]">
                          {form.photoUrl ? 'Change photo' : 'Upload Photo'}
                        </span>
                        <span className="text-xs text-[#0A2342]/55">JPEG / PNG · Max 2 MB</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => void onPhotoChange(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {photoError ? (
                        <p className="mt-2 text-xs text-red-600">{photoError}</p>
                      ) : null}
                    </div>
                  </div>
                </StepCard>
              ) : null}

              {step === 1 ? (
                <StepCard title="Contact Details" icon={<Phone className="h-4 w-4" />}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FloatingField
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(v) => set('email', v)}
                    />
                    <FloatingField
                      label="Mobile"
                      value={form.phone}
                      onChange={(v) => set('phone', v)}
                    />
                    <FloatingField
                      label="WhatsApp"
                      value={form.whatsapp}
                      onChange={(v) => set('whatsapp', v)}
                    />
                    <FloatingField
                      label="PIN Code"
                      value={form.pinCode}
                      onChange={(v) => set('pinCode', v)}
                    />
                    <FloatingField
                      label="Current Address"
                      value={form.currentAddress}
                      onChange={(v) => set('currentAddress', v)}
                      className="sm:col-span-2"
                    />
                    <FloatingSelect
                      label="State / UT"
                      value={form.state}
                      onChange={(v) => set('state', v)}
                      options={INDIA_STATES_AND_UTS.map((s) => ({ value: s, label: s }))}
                    />
                    <FloatingField
                      label="Country"
                      value={form.country}
                      onChange={(v) => set('country', v)}
                    />
                  </div>
                </StepCard>
              ) : null}

              {step === 2 ? (
                <StepCard title="Academic Information" icon={<GraduationCap className="h-4 w-4" />}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FloatingSelect
                      label="Department"
                      value={form.department}
                      onChange={(v) => set('department', v)}
                      options={ALUMNI_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                    />
                    <FloatingSelect
                      label="Passing Year"
                      value={form.graduationYear}
                      onChange={(v) => set('graduationYear', v)}
                      options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                    />
                    <FloatingField
                      label="College Roll Number"
                      value={form.collegeRollNumber}
                      onChange={(v) => set('collegeRollNumber', v)}
                    />
                    <FloatingField
                      label="University Registration Number"
                      value={form.universityRegNumber}
                      onChange={(v) => set('universityRegNumber', v)}
                    />
                  </div>
                </StepCard>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <StepCard
                    title="Professional Information"
                    icon={<Briefcase className="h-4 w-4" />}
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A2342]/55">
                          Employment Status
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {ALUMNI_EMPLOYMENT_STATUSES.map((status) => (
                            <label
                              key={status}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                                form.employmentStatus === status
                                  ? 'border-[#F4B400] bg-[#F4B400]/10 text-[#0A2342]'
                                  : 'border-[#0A2342]/12 hover:border-[#0A2342]/30',
                              )}
                            >
                              <input
                                type="radio"
                                name="employmentStatus"
                                className="accent-[#0A2342]"
                                checked={form.employmentStatus === status}
                                onChange={() => set('employmentStatus', status)}
                              />
                              {status}
                            </label>
                          ))}
                        </div>
                      </div>
                      {SHOW_EMPLOYER_FIELDS.has(form.employmentStatus) ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FloatingField
                            label="Occupation"
                            value={form.occupation}
                            onChange={(v) => set('occupation', v)}
                          />
                          <FloatingField
                            label="Company / Organisation"
                            value={form.currentOrg}
                            onChange={(v) => set('currentOrg', v)}
                          />
                          <FloatingField
                            label="Designation"
                            value={form.currentRole}
                            onChange={(v) => set('currentRole', v)}
                            className="sm:col-span-2"
                          />
                        </div>
                      ) : null}
                    </div>
                  </StepCard>

                  <StepCard title="Social Media (Optional)" icon={<User className="h-4 w-4" />}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FloatingField
                        label="LinkedIn"
                        value={form.linkedinUrl}
                        onChange={(v) => set('linkedinUrl', v)}
                      />
                      <FloatingField
                        label="Facebook"
                        value={form.facebookUrl}
                        onChange={(v) => set('facebookUrl', v)}
                      />
                      <FloatingField
                        label="Instagram"
                        value={form.instagramUrl}
                        onChange={(v) => set('instagramUrl', v)}
                      />
                      <FloatingField
                        label="Website"
                        value={form.websiteUrl}
                        onChange={(v) => set('websiteUrl', v)}
                      />
                    </div>
                  </StepCard>

                  <div className="rounded-2xl border border-[#0A2342]/10 bg-[#0A2342] p-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F4B400]">
                      Membership
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <select
                        className="h-11 w-full rounded-xl border-0 bg-white/10 px-3 text-sm text-white outline-none ring-1 ring-white/20"
                        value={defaultTypeId}
                        onChange={(e) => set('membershipTypeId', e.target.value)}
                      >
                        {types.map((t) => (
                          <option key={t.id} value={t.id} className="text-[#0A2342]">
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-[#F4B400]">
                          ₹{(selectedType?.amountInr ?? 0).toLocaleString('en-IN')}
                          <span className="text-sm font-normal text-white/70">
                            {selectedType?.isLifetime ? ' · One-time' : ' / Year'}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-white/70">✓ Online Payment Available</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <StepCard title="Review & Submit" icon={<ClipboardCheck className="h-4 w-4" />}>
                  <div className="space-y-4 text-sm text-[#0A2342]/85">
                    <ReviewRow label="Name" value={form.fullName || '—'} />
                    <ReviewRow
                      label="Contact"
                      value={[form.email, form.phone].filter(Boolean).join(' · ') || '—'}
                    />
                    <ReviewRow
                      label="Education"
                      value={
                        [form.department, form.graduationYear].filter(Boolean).join(' · ') || '—'
                      }
                    />
                    <ReviewRow
                      label="Professional"
                      value={
                        [form.employmentStatus, form.currentOrg, form.currentRole]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      }
                    />
                    <ReviewRow
                      label="Membership"
                      value={
                        selectedType
                          ? `${selectedType.name} — ₹${selectedType.amountInr.toLocaleString('en-IN')}`
                          : '—'
                      }
                    />

                    <label className="flex items-start gap-3 rounded-xl border border-[#0A2342]/10 bg-[#F8FAFC] p-3">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#0A2342]"
                        checked={form.certifyTrue}
                        onChange={(e) => set('certifyTrue', e.target.checked)}
                      />
                      <span>
                        I certify that the information provided is true and belongs to me.
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-[#0A2342]/10 bg-[#F8FAFC] p-3">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#0A2342]"
                        checked={form.agreeCommunications}
                        onChange={(e) => set('agreeCommunications', e.target.checked)}
                      />
                      <span>I agree to receive Alumni Association communications.</span>
                    </label>
                  </div>
                </StepCard>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-[#0A2342]/20"
                disabled={step === 0 || mut.isPending}
                onClick={goPrev}
              >
                ← Previous
              </Button>
              {step < ALUMNI_REGISTRATION_STEPS.length - 1 ? (
                <Button
                  type="button"
                  className="bg-[#0A2342] text-white hover:bg-[#F4B400] hover:text-[#0A2342]"
                  onClick={goNext}
                >
                  Save & Continue →
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-[#F4B400] text-[#0A2342] hover:bg-[#e5a82e]"
                  disabled={mut.isPending}
                  onClick={submit}
                >
                  {mut.isPending ? 'Submitting…' : 'Review & Submit'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AlumniPublicShell>
  );
}

function StepIcon({ name, className }: { name: string; className?: string }) {
  if (name === 'Phone') return <Phone className={className} />;
  if (name === 'GraduationCap') return <GraduationCap className={className} />;
  if (name === 'Briefcase') return <Briefcase className={className} />;
  if (name === 'ClipboardCheck') return <ClipboardCheck className={className} />;
  return <User className={className} />;
}

function StepCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#0A2342]/10 bg-[#F8FAFC]/70 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-[#0A2342]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A2342] text-[#F4B400]">
          {icon}
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FloatingField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative block rounded-2xl border border-[#0A2342]/15 bg-white px-3 pb-2 pt-5 shadow-sm focus-within:border-[#F4B400] focus-within:ring-2 focus-within:ring-[#F4B400]/25',
        className,
      )}
    >
      <span className="absolute left-3 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A2342]/55">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 bg-transparent p-0 text-sm text-[#0A2342] shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
      />
    </label>
  );
}

function FloatingSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative block rounded-2xl border border-[#0A2342]/15 bg-white px-3 pb-2 pt-5 shadow-sm focus-within:border-[#F4B400] focus-within:ring-2 focus-within:ring-[#F4B400]/25',
        className,
      )}
    >
      <span className="absolute left-3 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A2342]/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border-0 bg-transparent p-0 text-sm text-[#0A2342] shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[#0A2342]/8 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#0A2342]/5">
        {label}
      </span>
      <span className="font-medium text-[#0A2342]">{value}</span>
    </div>
  );
}
