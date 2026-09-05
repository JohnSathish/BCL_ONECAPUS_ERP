'use client';

import Link from 'next/link';
import { schoolAddressPinCode } from '@/lib/school-address-pin';
import { ProfileFieldGrid, ProfileSectionCard, displayField } from './profile-chrome';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function ApplicantOverviewTab({
  applicationId,
  formData,
  categoryLabel,
  community,
  age,
  status,
  paymentLabel,
  documentLabel,
  submittedAt,
  submission,
  photoUrl,
  onOpenTab,
}: {
  applicationId: string;
  formData: Record<string, unknown>;
  categoryLabel?: string | null;
  community?: string | null;
  age?: {
    eligible?: boolean;
    message?: string;
    age?: { years: number; months: number; days: number } | null;
  } | null;
  status: string;
  paymentLabel: string;
  documentLabel: string;
  submittedAt?: string | null;
  submission?: {
    pdfFileUrl?: string;
    email?: { status?: string; sentAt?: string | null; error?: string | null };
  } | null;
  photoUrl?: string | null;
  onOpenTab: (tab: string) => void;
}) {
  const child = asRecord(formData.child);
  const father = asRecord(formData.father);
  const mother = asRecord(formData.mother);
  const ageText = age?.age
    ? `${age.age.years} years, ${age.age.months} months, ${age.age.days} days`
    : '—';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="flex items-start justify-center rounded-xl border bg-slate-50 p-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Applicant photo"
              className="h-40 w-32 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-40 w-32 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
              No photo
            </div>
          )}
        </div>
        <ProfileSectionCard title="Candidate">
          <ProfileFieldGrid
            fields={[
              { label: 'Application Number', value: applicationId },
              { label: 'Full Name', value: displayField(child.fullName) },
              { label: 'Date of Birth', value: displayField(child.dateOfBirth) },
              {
                label: 'Age Eligibility',
                value: `${ageText} · ${age?.eligible ? 'Eligible' : age?.message || '—'}`,
              },
              { label: 'Gender', value: displayField(child.gender) },
              { label: 'Category', value: categoryLabel || displayField(child.category) },
              { label: 'Community / Tribe', value: community || displayField(child.community) },
              { label: 'Nationality', value: displayField(child.nationality) },
            ]}
          />
        </ProfileSectionCard>
      </div>

      <ProfileSectionCard title="Parents">
        <ProfileFieldGrid
          fields={[
            { label: 'Father’s Name', value: displayField(father.fullName) },
            { label: 'Father’s Mobile', value: displayField(father.mobile) },
            { label: 'Mother’s Name', value: displayField(mother.fullName) },
            { label: 'Mother’s Mobile', value: displayField(mother.mobile) },
          ]}
        />
      </ProfileSectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <ProfileSectionCard title="Application">
          <ProfileFieldGrid
            fields={[
              { label: 'Application Status', value: status },
              {
                label: 'Submitted Date',
                value: submittedAt
                  ? new Date(submittedAt).toLocaleString('en-IN')
                  : 'Not submitted',
              },
              { label: 'Payment Status', value: paymentLabel },
              { label: 'Document Status', value: documentLabel },
            ]}
          />
        </ProfileSectionCard>
        <ProfileSectionCard title="Submission">
          <ProfileFieldGrid
            fields={[
              {
                label: 'Submitted Date',
                value: submittedAt ? new Date(submittedAt).toLocaleString('en-IN') : '—',
              },
              {
                label: 'PDF Status',
                value: submission?.pdfFileUrl ? 'Stored' : 'Not generated',
              },
              {
                label: 'Email Delivery',
                value: submission?.email?.status
                  ? `${submission.email.status}${submission.email.error ? ` · ${submission.email.error}` : ''}`
                  : '—',
              },
            ]}
          />
        </ProfileSectionCard>
      </div>

      <div className="flex flex-wrap gap-3 text-sm print:hidden">
        <button
          type="button"
          className="underline text-[var(--school-erp-primary)]"
          onClick={() => onOpenTab('application')}
        >
          View Application
        </button>
        <button
          type="button"
          className="underline text-[var(--school-erp-primary)]"
          onClick={() => onOpenTab('documents')}
        >
          View Documents
        </button>
        <button
          type="button"
          className="underline text-[var(--school-erp-primary)]"
          onClick={() => onOpenTab('payment')}
        >
          View Payment
        </button>
        <button
          type="button"
          className="underline text-[var(--school-erp-primary)]"
          onClick={() => onOpenTab('review')}
        >
          Review &amp; Decision
        </button>
        <Link href="/admin/school-admissions/payments/pending" className="underline text-slate-600">
          Open Payment Queue
        </Link>
      </div>
    </div>
  );
}

export function ApplicantApplicationTab({
  formData,
  categoryLabel,
}: {
  formData: Record<string, unknown>;
  categoryLabel?: string | null;
}) {
  const child = asRecord(formData.child);
  const father = asRecord(formData.father);
  const mother = asRecord(formData.mother);
  const permanent = asRecord(formData.permanentAddress);
  const present = asRecord(formData.presentAddress);
  const sibling = asRecord(formData.sibling);

  return (
    <div className="space-y-4">
      <ProfileSectionCard title="Child Information">
        <ProfileFieldGrid
          fields={[
            { label: 'Full Name', value: displayField(child.fullName) },
            { label: 'Date of Birth', value: displayField(child.dateOfBirth) },
            { label: 'Gender', value: displayField(child.gender) },
            { label: 'Blood Group', value: displayField(child.bloodGroup) },
            { label: 'Nationality', value: displayField(child.nationality) },
            { label: 'Religion', value: displayField(child.religion) },
            { label: 'Caste / Category', value: categoryLabel || displayField(child.caste) },
            { label: 'Community / Tribe', value: displayField(child.community) },
            { label: 'Aadhaar', value: displayField(child.aadhaar) },
          ]}
        />
      </ProfileSectionCard>
      <ProfileSectionCard title="Parent Information — Father">
        <ProfileFieldGrid
          fields={[
            { label: 'Full Name', value: displayField(father.fullName) },
            { label: 'Occupation', value: displayField(father.occupation) },
            { label: 'Mobile', value: displayField(father.mobile) },
            { label: 'Town', value: displayField(father.town) },
            { label: 'P.O.', value: displayField(father.po) },
            { label: 'District', value: displayField(father.district) },
            { label: 'State', value: displayField(father.state) },
          ]}
        />
      </ProfileSectionCard>
      <ProfileSectionCard title="Parent Information — Mother">
        <ProfileFieldGrid
          fields={[
            { label: 'Full Name', value: displayField(mother.fullName) },
            { label: 'Occupation', value: displayField(mother.occupation) },
            { label: 'Mobile', value: displayField(mother.mobile) },
            { label: 'Town', value: displayField(mother.town) },
            { label: 'P.O.', value: displayField(mother.po) },
            { label: 'District', value: displayField(mother.district) },
            { label: 'State', value: displayField(mother.state) },
          ]}
        />
      </ProfileSectionCard>
      <ProfileSectionCard title="Permanent Address">
        <ProfileFieldGrid
          fields={[
            { label: 'Village', value: displayField(permanent.village) },
            { label: 'P.O.', value: displayField(permanent.po) },
            { label: 'District', value: displayField(permanent.district) },
            { label: 'State / UT', value: displayField(permanent.state) },
            { label: 'PIN', value: displayField(schoolAddressPinCode(permanent)) },
          ]}
        />
      </ProfileSectionCard>
      <ProfileSectionCard title="Present Address">
        <ProfileFieldGrid
          fields={[
            {
              label: 'Same as permanent',
              value: present.sameAsPermanent === true ? 'Yes' : 'No',
            },
            { label: 'Landmark / Village', value: displayField(present.landmark) },
            { label: 'P.O.', value: displayField(present.po) },
            { label: 'District', value: displayField(present.district) },
            { label: 'State / UT', value: displayField(present.state) },
            { label: 'PIN', value: displayField(schoolAddressPinCode(present)) },
          ]}
        />
      </ProfileSectionCard>
      <ProfileSectionCard title="School Information / Sibling">
        <ProfileFieldGrid
          fields={[
            { label: 'Sibling Name', value: displayField(sibling.name) },
            {
              label: 'Sibling Class',
              value: displayField(sibling.className ?? sibling.class),
            },
          ]}
        />
      </ProfileSectionCard>
    </div>
  );
}
