'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronDown, FileUp, Home, Lock, Mail, Phone, Shield, User, Users } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  submitStudentProfileChangeRequest,
  updateStudentPortalAbcId,
  uploadStudentPortalDocument,
} from '@/services/student-portal';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';
import { cn } from '@/utils/cn';

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{value?.trim() ? value : '—'}</dd>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED' || status === 'VERIFIED'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : status === 'REJECTED'
        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', tone)}>
      {status}
    </span>
  );
}

function AccordionSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard className="overflow-hidden md:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
          {title}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
      </button>
      {open ? <div className="border-t border-border/40 px-4 pb-4 pt-2">{children}</div> : null}
    </GlassCard>
  );
}

function DesktopSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="hidden p-5 md:block">
      <div className="mb-4 flex items-start gap-2">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 text-primary" /> : null}
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function ContactEditForm({
  profile,
  onSuccess,
}: {
  profile: StudentPortalProfile360;
  onSuccess: () => void;
}) {
  const [mobile, setMobile] = useState(profile.contact.mobileNumber ?? '');
  const [email, setEmail] = useState(profile.contact.personalEmail ?? '');
  const [emergency, setEmergency] = useState(profile.contact.emergencyContact ?? '');
  const mutation = useMutation({
    mutationFn: () =>
      submitStudentProfileChangeRequest({
        section: 'contact',
        changes: {
          mobileNumber: mobile || null,
          personalEmail: email || null,
          emergencyContact: emergency || null,
        },
      }),
    onSuccess,
  });

  return (
    <form
      className="mt-4 space-y-3 border-t border-border/40 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Updates require admin approval before they appear on your record.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="mobile">Mobile Number</Label>
          <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Personal Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="emergency">Emergency Contact</Label>
          <Input id="emergency" value={emergency} onChange={(e) => setEmergency(e.target.value)} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        Submit for Approval
      </Button>
      {mutation.isSuccess ? (
        <p className="text-xs text-emerald-600">{mutation.data.message}</p>
      ) : null}
    </form>
  );
}

function ParentEditForm({
  profile,
  onSuccess,
}: {
  profile: StudentPortalProfile360;
  onSuccess: () => void;
}) {
  const [father, setFather] = useState(profile.parents.fatherName ?? '');
  const [mother, setMother] = useState(profile.parents.motherName ?? '');
  const [guardian, setGuardian] = useState(profile.parents.guardianName ?? '');
  const [mobile, setMobile] = useState(profile.parents.parentMobile ?? '');
  const mutation = useMutation({
    mutationFn: () =>
      submitStudentProfileChangeRequest({
        section: 'parent',
        changes: {
          fatherName: father || null,
          motherName: mother || null,
          guardianName: guardian || null,
          parentMobile: mobile || null,
        },
      }),
    onSuccess,
  });

  return (
    <form
      className="mt-4 space-y-3 border-t border-border/40 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Father Name</Label>
          <Input value={father} onChange={(e) => setFather(e.target.value)} />
        </div>
        <div>
          <Label>Mother Name</Label>
          <Input value={mother} onChange={(e) => setMother(e.target.value)} />
        </div>
        <div>
          <Label>Guardian Name</Label>
          <Input value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </div>
        <div>
          <Label>Parent Mobile</Label>
          <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        Submit for Approval
      </Button>
    </form>
  );
}

function AbcIdEditForm({
  profile,
  onSuccess,
}: {
  profile: StudentPortalProfile360;
  onSuccess: () => void;
}) {
  const [abcId, setAbcId] = useState(profile.personal.abcId ?? '');
  const mutation = useMutation({
    mutationFn: () => updateStudentPortalAbcId(abcId.trim()),
    onSuccess,
  });

  if (!profile.personal.abcIdEditable) return null;

  return (
    <form
      className="mt-4 space-y-3 border-t border-border/40 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Enter or update your Academic Bank of Credits (ABC) ID.
      </p>
      <div>
        <Label htmlFor="abcId">ABC ID</Label>
        <Input
          id="abcId"
          value={abcId}
          maxLength={20}
          placeholder="Enter ABC ID"
          onChange={(e) => setAbcId(e.target.value.trim().slice(0, 20))}
        />
      </div>
      <Button type="submit" size="sm" disabled={mutation.isPending || !abcId.trim()}>
        Save ABC ID
      </Button>
      {mutation.isSuccess ? (
        <p className="text-xs text-emerald-600">{mutation.data.message}</p>
      ) : null}
      {mutation.isError ? (
        <p className="text-xs text-destructive">Could not save ABC ID. Try again.</p>
      ) : null}
    </form>
  );
}

const UPLOAD_TYPES = [
  { key: 'AADHAAR', label: 'Aadhaar' },
  { key: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate' },
  { key: 'PASSPORT_PHOTO', label: 'Photo' },
  { key: 'SIGNATURE', label: 'Signature' },
];

export function ProfilePersonalSection({
  profile,
  onRefresh,
}: {
  profile: StudentPortalProfile360;
  onRefresh?: () => void;
}) {
  const body = (
    <>
      <dl className="space-y-1">
        <InfoRow label="Registration Number" value={profile.personal.registrationNumber} />
        <InfoRow label="College Roll No." value={profile.personal.rollNumber} />
        <InfoRow
          label="ABC ID"
          value={profile.personal.abcId?.trim() ? profile.personal.abcId : 'ABC ID Not Submitted'}
        />
        <InfoRow label="Gender" value={profile.personal.gender} />
        <InfoRow
          label="Date of Birth"
          value={
            profile.personal.dateOfBirth
              ? new Date(profile.personal.dateOfBirth).toLocaleDateString()
              : null
          }
        />
        <InfoRow label="Blood Group" value={profile.personal.bloodGroup} />
        <InfoRow label="Aadhaar" value={profile.personal.aadhaarMasked} />
        <InfoRow label="Category" value={profile.personal.category} />
        <InfoRow label="Religion" value={profile.personal.religion} />
        <InfoRow label="Nationality" value={profile.personal.nationality} />
      </dl>
      {onRefresh ? <AbcIdEditForm profile={profile} onSuccess={onRefresh} /> : null}
      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Name and identity fields are institution-managed.
      </p>
    </>
  );

  return (
    <>
      <AccordionSection title="Personal Information" icon={User}>
        {body}
      </AccordionSection>
      <DesktopSection title="Personal Information" icon={User}>
        {body}
      </DesktopSection>
    </>
  );
}

export function ProfileContactSection({
  profile,
  onRefresh,
}: {
  profile: StudentPortalProfile360;
  onRefresh: () => void;
}) {
  const address = profile.contact.currentAddress
    ? [
        profile.contact.currentAddress.line1,
        profile.contact.currentAddress.city,
        profile.contact.currentAddress.pinCode,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const body = (
    <>
      <InfoRow icon={Phone} label="Mobile" value={profile.contact.mobileNumber} />
      <InfoRow icon={Phone} label="Alternate Mobile" value={profile.contact.alternateMobile} />
      <InfoRow icon={Mail} label="Email" value={profile.contact.personalEmail} />
      <InfoRow icon={Home} label="Address" value={address} />
      <InfoRow icon={Phone} label="Emergency Contact" value={profile.contact.emergencyContact} />
      <ContactEditForm profile={profile} onSuccess={onRefresh} />
    </>
  );

  return (
    <>
      <AccordionSection title="Contact Information" icon={Mail}>
        {body}
      </AccordionSection>
      <DesktopSection title="Contact Information" icon={Mail}>
        {body}
      </DesktopSection>
    </>
  );
}

export function ProfileParentSection({
  profile,
  onRefresh,
}: {
  profile: StudentPortalProfile360;
  onRefresh: () => void;
}) {
  const body = (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
          Father
        </p>
        <InfoRow label="Name" value={profile.parents.fatherName} />
        <InfoRow label="Mobile" value={profile.parents.fatherMobile ?? undefined} />
      </div>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
          Mother
        </p>
        <InfoRow label="Name" value={profile.parents.motherName} />
        <InfoRow label="Mobile" value={profile.parents.motherMobile ?? undefined} />
      </div>
      {profile.parents.guardianName ? (
        <InfoRow label="Guardian" value={profile.parents.guardianName} />
      ) : null}
      <InfoRow
        icon={Phone}
        label="Emergency / Parent Mobile"
        value={profile.parents.parentMobile}
      />
      <ParentEditForm profile={profile} onSuccess={onRefresh} />
    </div>
  );

  return (
    <>
      <AccordionSection title="Parent Information" icon={Users}>
        {body}
      </AccordionSection>
      <DesktopSection title="Parent Information" icon={Users}>
        {body}
      </DesktopSection>
    </>
  );
}

export function ProfileDocumentCenter({
  profile,
  onUpload,
}: {
  profile: StudentPortalProfile360;
  onUpload: (type: string, file: File) => void;
}) {
  const required = profile.requiredDocuments ?? [];

  const body = (
    <>
      <ul className="space-y-2">
        {required.length
          ? required.map((doc) => (
              <li
                key={doc.type}
                className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <span>{doc.label}</span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    doc.uploaded ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {doc.uploaded ? '✓ Uploaded' : 'Missing'}
                </span>
              </li>
            ))
          : null}
        {profile.documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
          >
            <span>{doc.documentType.replace(/_/g, ' ')}</span>
            <StatusBadge status={doc.verificationStatus} />
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {UPLOAD_TYPES.map((t) => (
          <label
            key={t.key}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs hover:bg-muted/30"
          >
            <FileUp className="h-4 w-4 shrink-0 text-primary" />
            <span>{t.label}</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(t.key, file);
                e.target.value = '';
              }}
            />
          </label>
        ))}
      </div>
    </>
  );

  return (
    <>
      <AccordionSection title="Documents" icon={Shield} defaultOpen={false}>
        {body}
      </AccordionSection>
      <DesktopSection
        title="Document Center"
        description="Uploads require admin verification"
        icon={Shield}
      >
        {body}
      </DesktopSection>
    </>
  );
}

export function ProfileAcademicInfoSection({ profile }: { profile: StudentPortalProfile360 }) {
  const body = (
    <>
      <dl className="space-y-1">
        <InfoRow label="Programme" value={profile.academic.programme} />
        <InfoRow label="Department" value={profile.academic.department} />
        <InfoRow
          label="Semester"
          value={profile.academic.semester != null ? `Semester ${profile.academic.semester}` : null}
        />
        <InfoRow label="Shift" value={profile.academic.shift} />
        <InfoRow label="Batch" value={profile.academic.batch} />
        <InfoRow label="Academic Year" value={profile.academic.academicYear} />
      </dl>
    </>
  );

  return (
    <>
      <AccordionSection title="Academic Information" icon={Shield}>
        {body}
      </AccordionSection>
      <DesktopSection
        title="Academic Information"
        description="Institutional records — read only"
        icon={Shield}
      >
        {body}
      </DesktopSection>
    </>
  );
}
