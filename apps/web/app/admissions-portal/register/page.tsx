'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import {
  fetchPortalInfo,
  loginApplicant,
  registerApplicant,
  uploadApplicantDocument,
  type PortalInfo,
} from '@/services/admissions-portal';
import { useAuthStore } from '@/store/auth-store';
import { PhotoUploadDropzone } from '@/components/admissions-portal/photo-upload-dropzone';
import { GENDER_OPTIONS } from '@/components/admissions-portal/constants';
import {
  formatInr,
  resolvePortalCycleSettings,
} from '@/components/admissions-portal/cycle-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';

const schema = z.object({
  fullName: z.string().min(2, 'Enter full name as per Class X'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Select gender'),
  email: z.string().email(),
  phone: z.string().min(10, 'Enter 10-digit mobile number'),
  acceptedPolicies: z.boolean().refine((v) => v === true, {
    message: 'You must accept the admissions policies',
  }),
});

type FormValues = z.infer<typeof schema>;

export default function ApplicantRegisterPage() {
  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const setSession = useAuthStore((s) => s.setSession);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{
    applicationNumber: string;
    generatedPassword?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const branding = portalInfo.data?.branding;
  const cycleSettings = resolvePortalCycleSettings({ portalInfo: portalInfo.data });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!photo) {
      setError('Profile photo is required');
      return;
    }
    try {
      const reg = await registerApplicant({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        acceptedPolicies: values.acceptedPolicies,
      });

      const password = reg.generatedPassword;
      if (!password) throw new Error('Registration succeeded but no password was issued');

      const session = await loginApplicant({
        applicationNumber: reg.applicationNumber,
        password,
      });
      setSession(session);
      tokenRefreshManager.scheduleProactiveRefresh(session);
      await uploadApplicantDocument('PHOTO', photo);

      setResult({
        applicationNumber: reg.applicationNumber,
        generatedPassword: password,
      });
    } catch (e) {
      setError(apiErrorMessage(e, 'Registration failed'));
    }
  };

  if (!portalInfo.data?.isOpen && !portalInfo.isLoading) {
    return <RegistrationClosed info={portalInfo.data} />;
  }

  if (result) {
    return (
      <PublicPageShell branding={branding}>
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-lg">
          <h2 className="text-lg font-bold text-emerald-800">Registration Successful</h2>
          <p className="mt-2 text-sm text-emerald-700">
            Credentials are shown below and have been sent via email and SMS.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Application Number:{' '}
              <strong className="font-mono text-emerald-800">{result.applicationNumber}</strong>
            </p>
            {result.generatedPassword ? (
              <p>
                Temporary Password:{' '}
                <strong className="font-mono text-emerald-800">{result.generatedPassword}</strong>
              </p>
            ) : null}
          </div>
          <Button asChild className="mt-6 rounded-full bg-[#1a2b4b] px-8">
            <Link href="/admissions-portal/login">Go to Login</Link>
          </Button>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell branding={branding}>
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {portalInfo.data?.isOpen ? (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✓ Admissions open — Last date for new registration:{' '}
              {formatDate(
                portalInfo.data.registrationClosesAt ?? portalInfo.data.cycle?.registrationClosesAt,
              )}
            </div>
          ) : null}

          <CollegeHeader branding={branding} />

          <h2 className="mt-6 text-center text-lg font-bold text-[#2563eb]">
            Applicant Registration: 2026–2027
          </h2>
          <p className="text-center text-sm text-slate-600">
            Four Year Undergraduate Programme (FYUP) Semester I Admissions
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Personal &amp; Contact Details
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Full Name *</Label>
                <Input
                  className="mt-1 bg-[#fefce8]"
                  placeholder="Applicant name as per Class X"
                  {...register('fullName')}
                />
                {errors.fullName ? (
                  <p className="text-xs text-red-600">{errors.fullName.message}</p>
                ) : null}
              </div>
              <div>
                <Label>Date of Birth *</Label>
                <Input type="date" className="mt-1 bg-[#fefce8]" {...register('dateOfBirth')} />
              </div>
              <div>
                <Label>Gender *</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-[#fefce8] px-3 text-sm"
                  {...register('gender')}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  className="mt-1 bg-[#fefce8]"
                  placeholder="applicant@example.com"
                  {...register('email')}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Profile Photo *</Label>
                <PhotoUploadDropzone
                  className="mt-1"
                  previewUrl={photoPreview}
                  onFileSelect={(file) => {
                    setPhoto(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Mobile Number *</Label>
                <Input
                  className="mt-1 bg-[#fefce8]"
                  placeholder="10-digit mobile number"
                  {...register('phone')}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Student&apos;s number, linked to Aadhaar — not parents&apos; number.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" {...register('acceptedPolicies')} />I confirm
              that the information provided is accurate and I agree to the college&apos;s admissions
              policies.
            </label>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[#1a2b4b] py-6 text-base"
            >
              {isSubmitting ? 'Registering…' : 'Register'}
            </Button>

            <p className="text-center text-sm text-slate-600">
              Already registered?{' '}
              <Link
                href="/admissions-portal/login"
                className="font-semibold text-[#2563eb] hover:underline"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h3 className="font-semibold text-[#1a2b4b]">Fees for this cycle</h3>
            <p className="mt-2">
              Application fee: <strong>{formatInr(cycleSettings.applicationFee)}</strong> — pay
              before you can submit your form.
            </p>
            <p className="mt-1 text-xs">
              If you are selected for admission, the college will set your admission fee (guideline
              minimum {formatInr(cycleSettings.admissionFeeMin)}). No admission fee before
              selection.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h3 className="font-semibold text-[#1a2b4b]">Welcome to Admission 2026–2027 Portal</h3>
            <p className="mt-2">Student Instructions for Online Admission Process (2026–2027)</p>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Note: Registration to the portal does NOT guarantee admission.
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs">
              <li>Admission is based on merit and committee decision.</li>
              <li>Ensure contact details are correct.</li>
              <li>Check portal regularly for updates.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#2563eb]">
              Full Application Guide
            </p>
            <Link
              href="/admissions-portal/instructions"
              className="mt-1 block font-medium text-[#2563eb] hover:underline"
            >
              Open step-by-step instructions
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <p className="font-medium">
              Need help? Contact the admissions office during working hours.
            </p>
            <p className="mt-2 text-[#2563eb]">
              Admission Help Desk: {cycleSettings.helpDesk.phone}
            </p>
          </div>
        </aside>
      </div>
    </PublicPageShell>
  );
}

function PublicPageShell({
  branding,
  children,
}: {
  branding?: { displayName?: string; logoUrl?: string | null };
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen py-8"
      style={{
        backgroundColor: '#e8f0fe',
        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="px-4">{children}</div>
      <footer className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-600">
        <p>ADMISSIONS OFFICE · Meghalaya — 794002</p>
        <p>Ph. 03651-222361 · Mob. 9436308357</p>
        <p className="mt-1 text-[#2563eb]">principaldbct@gmail.com · www.donboscocollege.ac.in</p>
      </footer>
    </div>
  );
}

function CollegeHeader({
  branding,
}: {
  branding?: { displayName?: string; logoUrl?: string | null; portalSubtitle?: string };
}) {
  return (
    <div className="text-center">
      {branding?.logoUrl ? (
        <Image
          src={branding.logoUrl}
          alt=""
          width={72}
          height={72}
          className="mx-auto h-[72px] w-[72px] rounded-full object-contain"
          unoptimized
        />
      ) : null}
      <h1 className="mt-3 text-xl font-bold text-[#1a2b4b]">
        {branding?.displayName ?? 'Don Bosco College, Tura'}
      </h1>
      <p className="text-xs text-slate-500">
        (Re-accredited with &apos;B&apos; Grade by NAAC Bangalore)
      </p>
    </div>
  );
}

function RegistrationClosed({ info }: { info?: PortalInfo }) {
  const lastDate = info?.registrationClosesAt ?? info?.cycle?.registrationClosesAt;
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1 text-sm font-medium text-rose-700">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Admissions closed
        </span>
        <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mt-6 text-xl font-bold text-[#1a2b4b]">New registration is not available</h2>
        <p className="mt-2 text-slate-600">
          {info?.message ?? 'Admissions are closed. Please contact the office for more details.'}
        </p>
        {lastDate ? (
          <p className="mt-3 text-sm text-slate-600">
            Published last date for new registration: <strong>{formatDate(lastDate)}</strong>
          </p>
        ) : null}
        <Button asChild className="mt-6 w-full rounded-full bg-[#1a2b4b]">
          <Link href="/admissions-portal/login">Log in to your account</Link>
        </Button>
        <p className="mt-4 text-xs text-slate-500">
          Use your application number and password to continue your form, upload documents, or
          complete payment.
        </p>
      </div>
    </PublicPageShell>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
