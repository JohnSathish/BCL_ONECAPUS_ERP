'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SchoolApplicantNav } from '@/components/school-admissions-portal/school-applicant-nav';
import {
  SchoolEligibilityCard,
  SchoolNeedHelpCard,
  SchoolQuoteCard,
  useSchoolPortalBranding,
} from '@/components/school-admissions-portal/school-admissions-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  SCHOOL_CASTE_CATEGORY_POLICY,
  resolveSchoolCasteCategory,
} from '@/lib/school-admission-category';
import {
  BLOOD_GROUPS,
  GENDER_OPTIONS,
  INDIAN_STATES_AND_UTS,
} from '@/lib/school-admissions-schema';
import { normalizeSchoolPinCodeInput } from '@/lib/school-address-pin';
import {
  eligibleDobIsoRange,
  evaluateSchoolAgeEligibility,
  SCHOOL_AGE_INELIGIBLE_MESSAGE,
  TPS_KG_2027_CENSUS_DATE,
} from '@/lib/school-age-eligibility';
import { apiErrorMessage } from '@/utils/api-error';
import { getSchoolFormGaps } from '@/lib/school-application-progress';
import { fetchSchoolApplicantMe, saveSchoolFormDraft } from '@/services/school-admissions';

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function canonicalIndianState(value: string): string {
  const match = INDIAN_STATES_AND_UTS.find(
    (state) => state.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? value;
}

function indianStateOptions(current: string): string[] {
  const canonical = canonicalIndianState(current);
  if (
    canonical &&
    !INDIAN_STATES_AND_UTS.includes(canonical as (typeof INDIAN_STATES_AND_UTS)[number])
  ) {
    return [canonical, ...INDIAN_STATES_AND_UTS];
  }
  return [...INDIAN_STATES_AND_UTS];
}

function presentFromPermanent(permanent: Record<string, unknown>) {
  return {
    po: str(permanent.po),
    district: str(permanent.district),
    state: str(permanent.state),
    landmark: str(permanent.village),
    pinCode: str(permanent.pinCode) || str(permanent.pin),
    sameAsPermanent: true,
  };
}

export default function SchoolApplicationFormPage() {
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['school-applicant-me'],
    queryFn: fetchSchoolApplicantMe,
    enabled,
  });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const readOnly = Boolean(me.data?.readOnly);

  useEffect(() => {
    if (!me.data?.application.formData || loaded) return;
    setForm(me.data.application.formData);
    setLoaded(true);
  }, [me.data?.application.formData, loaded]);

  const child = rec(form.child);
  const permanentAddress = rec(form.permanentAddress);
  const presentAddress = rec(form.presentAddress);
  const father = rec(form.father);
  const mother = rec(form.mother);
  const sibling = rec(form.sibling);
  const dobWindow = eligibleDobIsoRange(
    me.data?.settings?.censusDate,
    me.data?.settings?.minAgeYears,
    me.data?.settings?.maxAgeYearsExclusive,
  );
  const dobCheck = str(child.dateOfBirth)
    ? evaluateSchoolAgeEligibility(
        str(child.dateOfBirth),
        me.data?.settings?.censusDate ?? TPS_KG_2027_CENSUS_DATE,
        me.data?.settings?.minAgeYears,
        me.data?.settings?.maxAgeYearsExclusive,
      )
    : null;

  const patch = (section: string, key: string, value: unknown) => {
    setForm((prev) => {
      const nextSection = { ...rec(prev[section]), [key]: value };
      if (section === 'permanentAddress' && rec(prev.presentAddress).sameAsPermanent === true) {
        return {
          ...prev,
          permanentAddress: nextSection,
          presentAddress: {
            ...rec(prev.presentAddress),
            ...presentFromPermanent(nextSection),
          },
        };
      }
      return {
        ...prev,
        [section]: nextSection,
      };
    });
  };

  const sameAsPermanent = presentAddress.sameAsPermanent === true;

  const setSameAsPermanent = (checked: boolean) => {
    setForm((prev) => {
      const permanent = rec(prev.permanentAddress);
      const present = rec(prev.presentAddress);
      return {
        ...prev,
        presentAddress: checked
          ? { ...present, ...presentFromPermanent(permanent) }
          : { ...present, sameAsPermanent: false },
      };
    });
  };

  const save = async () => {
    setError(null);
    setGaps([]);
    if (dobCheck && !dobCheck.eligible) {
      setError(dobCheck.message);
      setGaps([dobCheck.message]);
      return;
    }
    try {
      await saveSchoolFormDraft({ formData: form, currentStep: 1 });
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const continueToDocuments = async () => {
    setError(null);
    const nextGaps = getSchoolFormGaps(form, me.data?.settings);
    if (nextGaps.length) {
      setGaps(nextGaps);
      setError(`Please complete the application form before continuing: ${nextGaps.join(', ')}`);
      return;
    }
    setContinuing(true);
    try {
      const nextForm = {
        ...form,
        workflow: { ...rec(form.workflow), formComplete: true, currentStep: 2 },
      };
      await saveSchoolFormDraft({ formData: nextForm, currentStep: 2 });
      await queryClient.invalidateQueries({ queryKey: ['school-applicant-me'] });
      router.push('/school-admissions-portal/documents');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setContinuing(false);
    }
  };

  const hasGap = (...labels: string[]) =>
    gaps.some((gap) => labels.some((label) => gap === label || gap.includes(label)));

  const branding = useSchoolPortalBranding();

  return (
    <SchoolApplicantNav
      sidebar={
        <>
          <SchoolEligibilityCard />
          <SchoolQuoteCard by="Anonymous">
            Every child is a different kind of flower, and all together make this world a beautiful
            garden.
          </SchoolQuoteCard>
          <SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />
        </>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="tps-serif text-2xl text-[#1a5336]">K.G. Application Form</h2>
          <p className="text-sm text-muted-foreground">
            Spellings of the child and parents must match the original birth and caste certificates.
            Fields marked for submit are required.
          </p>
        </div>
        {me.data?.application.applicationNumber ? (
          <span className="rounded-full bg-[#eaf5ee] px-3 py-1 font-mono text-sm text-[#1a5336]">
            Application No. {me.data.application.applicationNumber}
          </span>
        ) : null}
      </div>

      <Section title="1. Child">
        <Field
          label="Full name"
          value={str(child.fullName)}
          readOnly={readOnly}
          error={hasGap('Child’s full name') ? 'Enter the child’s full name' : undefined}
          onChange={(v) => patch('child', 'fullName', v.toUpperCase())}
        />
        <Field
          label="Date of birth"
          type="date"
          value={str(child.dateOfBirth)}
          readOnly={readOnly}
          min={dobWindow?.minDob}
          max={dobWindow?.maxDob}
          error={
            hasGap('Date of birth', 'Age as on')
              ? gaps.find((g) => g === 'Date of birth' || g.includes('Age as on'))
              : undefined
          }
          onChange={(v) => patch('child', 'dateOfBirth', v)}
        />
        {dobCheck && !dobCheck.eligible ? (
          <p className="col-span-full rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {dobCheck.message || SCHOOL_AGE_INELIGIBLE_MESSAGE}
          </p>
        ) : (
          <p className="col-span-full rounded-xl bg-[#fff4d6] p-3 text-sm text-amber-950">
            Age as on 1st January 2027: <strong>At least 5 years and not more than 6 years.</strong>
          </p>
        )}
        <SelectField
          label="Gender"
          value={str(child.gender)}
          options={[...GENDER_OPTIONS]}
          readOnly={readOnly}
          error={hasGap('Gender') ? 'Select gender' : undefined}
          onChange={(v) => patch('child', 'gender', v)}
        />
        <SelectField
          label="Blood group"
          value={str(child.bloodGroup)}
          options={[...BLOOD_GROUPS]}
          readOnly={readOnly}
          error={hasGap('Blood group') ? 'Select blood group' : undefined}
          onChange={(v) => patch('child', 'bloodGroup', v)}
        />
        <div className="col-span-full sm:col-span-1">
          <Label>Caste / Category *</Label>
          <select
            className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
            value={resolveSchoolCasteCategory(child)?.code ?? ''}
            disabled={readOnly}
            onChange={(e) => {
              const code = e.target.value;
              const policy = SCHOOL_CASTE_CATEGORY_POLICY.find((item) => item.code === code);
              setForm((prev) => ({
                ...prev,
                child: {
                  ...rec(prev.child),
                  category: code,
                  caste: policy?.label ?? '',
                },
              }));
            }}
          >
            <option value="">Select category</option>
            {SCHOOL_CASTE_CATEGORY_POLICY.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Select the child’s Caste / Category only. Do not enter father’s or mother’s caste
            separately. The Documents page will ask for the matching certificate when required
            (Caste Certificate for General / UR, Father’s SC or OBC, or Mother’s ST for Garo / Khasi
            / Jaintia).
          </p>
          {hasGap('Caste / Category') ? (
            <p className="mt-1 text-xs text-destructive">Select Caste / Category from the list</p>
          ) : null}
        </div>
        {resolveSchoolCasteCategory(child)?.requireCommunity ? (
          <div>
            <Label>Community / Tribe (if applicable) *</Label>
            <input
              list="tps-community-options"
              className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
              value={str(child.community)}
              disabled={readOnly}
              placeholder="e.g. Garo, Khasi, Jaintia"
              onChange={(e) => patch('child', 'community', e.target.value)}
            />
            <datalist id="tps-community-options">
              {(
                me.data?.settings?.documentRequirements?.rules.find(
                  (rule) =>
                    rule.slotCode === 'MOTHER_ST_CERT' &&
                    Array.isArray(rule.communities) &&
                    rule.communities.length > 0,
                )?.communities ?? ['Garo', 'Khasi', 'Jaintia']
              ).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">
              Enter the child’s community or tribe as on the certificate. For ST candidates from
              Garo, Khasi or Jaintia, Mother’s ST Certificate will be required on the Documents
              page.
            </p>
            {hasGap('Community / Tribe (if applicable)') ? (
              <p className="mt-1 text-xs text-destructive">
                Enter community or tribe as on the certificate
              </p>
            ) : null}
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field
          label="Nationality"
          value={str(child.nationality)}
          readOnly={readOnly}
          error={hasGap('Nationality') ? 'Enter nationality' : undefined}
          onChange={(v) => patch('child', 'nationality', v)}
        />
        <Field
          label="School last attended"
          value={str(child.lastSchool)}
          readOnly={readOnly}
          error={hasGap('School last attended') ? 'Enter school last attended' : undefined}
          onChange={(v) => patch('child', 'lastSchool', v)}
        />
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            required={!readOnly}
            checked={child.attendedNursery === true}
            disabled={readOnly}
            onChange={(e) => patch('child', 'attendedNursery', e.target.checked)}
          />
          Child has attended Nursery (required)
        </label>
        {hasGap('Nursery attendance confirmation') ? (
          <p className="col-span-full text-xs text-destructive">
            Confirm that the child has attended Nursery.
          </p>
        ) : null}
      </Section>

      <Section title="2. Permanent address">
        <Field
          label="Village"
          value={str(permanentAddress.village)}
          readOnly={readOnly}
          error={hasGap('Permanent village') ? 'Enter village' : undefined}
          onChange={(v) => patch('permanentAddress', 'village', v)}
        />
        <Field
          label="P.O."
          value={str(permanentAddress.po)}
          readOnly={readOnly}
          error={hasGap('Permanent P.O.') ? 'Enter P.O.' : undefined}
          onChange={(v) => patch('permanentAddress', 'po', v)}
        />
        <Field
          label="District"
          value={str(permanentAddress.district)}
          readOnly={readOnly}
          error={hasGap('Permanent district') ? 'Enter district' : undefined}
          onChange={(v) => patch('permanentAddress', 'district', v)}
        />
        <SelectField
          label="State / UT"
          value={canonicalIndianState(str(permanentAddress.state))}
          options={indianStateOptions(str(permanentAddress.state))}
          readOnly={readOnly}
          error={hasGap('Permanent state') ? 'Select state' : undefined}
          onChange={(v) => patch('permanentAddress', 'state', v)}
        />
        <PinCodeField
          label="PIN Code"
          value={str(permanentAddress.pinCode) || str(permanentAddress.pin)}
          readOnly={readOnly}
          error={hasGap('Permanent PIN Code') ? 'Enter a valid 6-digit PIN Code' : undefined}
          onChange={(v) => patch('permanentAddress', 'pinCode', v)}
        />
      </Section>

      <Section title="3. Present address">
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sameAsPermanent}
            disabled={readOnly}
            onChange={(e) => setSameAsPermanent(e.target.checked)}
          />
          Same as permanent address
        </label>
        <Field
          label="Landmark / Village"
          value={str(presentAddress.landmark)}
          readOnly={readOnly || sameAsPermanent}
          error={hasGap('Present landmark') ? 'Enter landmark' : undefined}
          onChange={(v) => patch('presentAddress', 'landmark', v)}
        />
        <Field
          label="P.O."
          value={str(presentAddress.po)}
          readOnly={readOnly || sameAsPermanent}
          error={hasGap('Present P.O.') ? 'Enter P.O.' : undefined}
          onChange={(v) => patch('presentAddress', 'po', v)}
        />
        <Field
          label="District"
          value={str(presentAddress.district)}
          readOnly={readOnly || sameAsPermanent}
          error={hasGap('Present district') ? 'Enter district' : undefined}
          onChange={(v) => patch('presentAddress', 'district', v)}
        />
        <SelectField
          label="State / UT"
          value={canonicalIndianState(str(presentAddress.state))}
          options={indianStateOptions(str(presentAddress.state))}
          readOnly={readOnly || sameAsPermanent}
          error={hasGap('Present state') ? 'Select state' : undefined}
          onChange={(v) => patch('presentAddress', 'state', v)}
        />
        <PinCodeField
          label="PIN Code"
          value={str(presentAddress.pinCode) || str(presentAddress.pin)}
          readOnly={readOnly || sameAsPermanent}
          error={hasGap('Present PIN Code') ? 'Enter a valid 6-digit PIN Code' : undefined}
          onChange={(v) => patch('presentAddress', 'pinCode', v)}
        />
      </Section>

      <Section title="4. Father">
        <Field
          label="Full name"
          value={str(father.fullName)}
          readOnly={readOnly}
          error={hasGap('Father’s full name') ? 'Enter father’s full name' : undefined}
          onChange={(v) => patch('father', 'fullName', v)}
        />
        <Field
          label="Occupation / designation"
          value={str(father.occupation)}
          readOnly={readOnly}
          error={hasGap('Father’s occupation') ? 'Enter occupation' : undefined}
          onChange={(v) => patch('father', 'occupation', v)}
        />
        <Field
          label="Town"
          value={str(father.town)}
          readOnly={readOnly}
          onChange={(v) => patch('father', 'town', v)}
        />
        <Field
          label="P.O."
          value={str(father.po)}
          readOnly={readOnly}
          onChange={(v) => patch('father', 'po', v)}
        />
        <Field
          label="District"
          value={str(father.district)}
          readOnly={readOnly}
          onChange={(v) => patch('father', 'district', v)}
        />
        <SelectField
          label="State"
          value={canonicalIndianState(str(father.state))}
          options={indianStateOptions(str(father.state))}
          readOnly={readOnly}
          onChange={(v) => patch('father', 'state', v)}
        />
        <Field
          label="Mobile"
          value={str(father.mobile)}
          readOnly={readOnly}
          error={hasGap('Father’s mobile') ? 'Enter a 10-digit mobile number' : undefined}
          onChange={(v) => patch('father', 'mobile', v)}
        />
      </Section>

      <Section title="5. Mother">
        <Field
          label="Full name"
          value={str(mother.fullName)}
          readOnly={readOnly}
          error={hasGap('Mother’s full name') ? 'Enter mother’s full name' : undefined}
          onChange={(v) => patch('mother', 'fullName', v)}
        />
        <Field
          label="Occupation / designation"
          value={str(mother.occupation)}
          readOnly={readOnly}
          error={hasGap('Mother’s occupation') ? 'Enter occupation' : undefined}
          onChange={(v) => patch('mother', 'occupation', v)}
        />
        <Field
          label="Town"
          value={str(mother.town)}
          readOnly={readOnly}
          onChange={(v) => patch('mother', 'town', v)}
        />
        <Field
          label="P.O."
          value={str(mother.po)}
          readOnly={readOnly}
          onChange={(v) => patch('mother', 'po', v)}
        />
        <Field
          label="District"
          value={str(mother.district)}
          readOnly={readOnly}
          onChange={(v) => patch('mother', 'district', v)}
        />
        <SelectField
          label="State"
          value={canonicalIndianState(str(mother.state))}
          options={indianStateOptions(str(mother.state))}
          readOnly={readOnly}
          onChange={(v) => patch('mother', 'state', v)}
        />
        <Field
          label="Mobile"
          value={str(mother.mobile)}
          readOnly={readOnly}
          error={hasGap('Mother’s mobile') ? 'Enter a 10-digit mobile number' : undefined}
          onChange={(v) => patch('mother', 'mobile', v)}
        />
      </Section>

      <Section title="6. Brother / sister studying in this school">
        <Field
          label="Name"
          value={str(sibling.name)}
          readOnly={readOnly}
          onChange={(v) => patch('sibling', 'name', v)}
        />
        <Field
          label="Class"
          value={str(sibling.className ?? sibling.class)}
          readOnly={readOnly}
          onChange={(v) => patch('sibling', 'className', v)}
        />
      </Section>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-emerald-700">Draft saved.</p> : null}
      {!readOnly ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-slate-300"
            onClick={() => void save()}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            className="bg-[#1a5336] text-white hover:bg-[#15462d]"
            onClick={() => void continueToDocuments()}
            disabled={continuing}
          >
            {continuing ? 'Saving…' : 'Save & Continue →'}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          This application is locked after submission.
        </p>
      )}
    </SchoolApplicantNav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-[#1a5336]">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  type = 'text',
  min,
  max,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  type?: string;
  min?: string;
  max?: string;
  error?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        min={min}
        max={max}
        className="mt-1 h-11 bg-white"
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PinCodeField({
  label,
  value,
  onChange,
  readOnly,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={`pin-${label}`}>{label} *</Label>
      <Input
        id={`pin-${label}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="postal-code"
        placeholder="6-digit PIN"
        value={value}
        className="mt-1 h-11 bg-white font-mono tracking-wider"
        disabled={readOnly}
        onChange={(e) => onChange(normalizeSchoolPinCodeInput(e.target.value))}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  readOnly,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  readOnly: boolean;
  error?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="h-11 w-full rounded-md border border-input bg-white px-3"
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
