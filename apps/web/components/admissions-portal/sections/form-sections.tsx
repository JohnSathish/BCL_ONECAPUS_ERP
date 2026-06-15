'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Class12SubjectMultiSelect,
  type Class12SubjectValue,
} from '@/components/students-module/class12-subject-multi-select';
import { fetchBoardNames } from '@/services/support-data';
import { fetchAcademicStreams } from '@/services/academic-engine';
import {
  BLOOD_GROUP_OPTIONS,
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELIGION_OPTIONS,
} from '../constants';
import { cn } from '@/utils/cn';

type SectionProps = {
  values: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  readOnly?: boolean;
};

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-[#fefce8] px-3 text-sm text-slate-900 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20';
const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-[#fefce8] px-3 text-sm text-slate-900 outline-none focus:border-[#2563eb]';
const textareaClass =
  'min-h-[88px] w-full rounded-lg border border-slate-200 bg-[#fefce8] px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2563eb]';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-[#2563eb]"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1a2b4b]">
          {icon} {title}
        </h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function YesNoToggle({
  value,
  onChange,
  readOnly,
}: {
  value?: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {(['Yes', 'No'] as const).map((label) => {
        const selected = label === 'Yes' ? value === true : value === false;
        return (
          <button
            key={label}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(label === 'Yes')}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-[#2563eb] bg-[#2563eb] text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function PersonalSection({ values, onChange, readOnly }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        icon="👤"
        title="Personal Details"
        subtitle="Use the same spelling as on your Class X admit card."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name on Class X Admit Card" required>
            <input
              className={inputClass}
              disabled={readOnly}
              value={String(values.fullName ?? '')}
              onChange={(e) => onChange('fullName', e.target.value.toUpperCase())}
              placeholder="As per Class X admit card"
            />
          </Field>
          <Field label="Date of Birth" required>
            <input
              type="date"
              className={inputClass}
              disabled={readOnly}
              value={String(values.dateOfBirth ?? '')}
              onChange={(e) => onChange('dateOfBirth', e.target.value)}
            />
          </Field>
          <Field label="Gender" required>
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.gender ?? '')}
              onChange={(e) => onChange('gender', e.target.value)}
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon="📌"
        title="Additional Information"
        subtitle="Demographics and eligibility for uploads in later steps."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marital Status">
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.maritalStatus ?? '')}
              onChange={(e) => onChange('maritalStatus', e.target.value)}
            >
              <option value="">Select marital status</option>
              {MARITAL_STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Blood Group">
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.bloodGroup ?? '')}
              onChange={(e) => onChange('bloodGroup', e.target.value)}
            >
              <option value="">Select blood group</option>
              {BLOOD_GROUP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.category ?? '')}
              onChange={(e) => onChange('category', e.target.value)}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Race / Tribe">
            <input
              className={inputClass}
              disabled={readOnly}
              value={String(values.raceTribe ?? '')}
              onChange={(e) => onChange('raceTribe', e.target.value)}
              placeholder="As applicable"
            />
          </Field>
          <Field label="Religion">
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.religion ?? '')}
              onChange={(e) => onChange('religion', e.target.value)}
            >
              <option value="">Select religion</option>
              {RELIGION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Differently Abled">
            <YesNoToggle
              value={values.differentlyAbled as boolean | undefined}
              readOnly={readOnly}
              onChange={(v) => onChange('differentlyAbled', v)}
            />
          </Field>
          <Field label="Economically Weaker">
            <YesNoToggle
              value={values.economicallyWeaker as boolean | undefined}
              readOnly={readOnly}
              onChange={(v) => onChange('economicallyWeaker', v)}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function AddressesSection({ values, onChange, readOnly }: SectionProps) {
  const sameAsTura = Boolean(values.sameAsTura);

  const setTuraAddress = (v: string) => {
    onChange('turaAddress', v);
    if (sameAsTura) onChange('homeAddress', v);
  };

  return (
    <div className="space-y-5">
      <SectionCard icon="📍" title="Address Details">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Address in Tura" required>
            <textarea
              className={textareaClass}
              disabled={readOnly}
              rows={4}
              value={String(values.turaAddress ?? '')}
              onChange={(e) => setTuraAddress(e.target.value)}
              placeholder="Enter full address within Tura"
            />
          </Field>
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={sameAsTura}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange('sameAsTura', checked);
                  if (checked) onChange('homeAddress', values.turaAddress ?? '');
                }}
              />
              <span>
                <strong>Same as Tura Address</strong>
                <span className="block text-xs text-slate-500">
                  When checked, Home Address is auto-filled from Tura address.
                </span>
              </span>
            </label>
            <Field label="Home Address" required>
              <textarea
                className={textareaClass}
                disabled={readOnly || sameAsTura}
                rows={4}
                value={String(values.homeAddress ?? '')}
                onChange={(e) => onChange('homeAddress', e.target.value)}
                placeholder="Enter permanent home address"
              />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Aadhaar Number" hint="12 digits, no spaces">
            <input
              className={inputClass}
              disabled={readOnly}
              maxLength={12}
              value={String(values.aadhaar ?? '')}
              onChange={(e) => onChange('aadhaar', e.target.value.replace(/\D/g, ''))}
              placeholder="12 digits, no spaces"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon="📇" title="Contact Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State">
            <input
              className={inputClass}
              disabled={readOnly}
              value={String(values.state ?? '')}
              onChange={(e) => onChange('state', e.target.value)}
              placeholder="Select state"
            />
          </Field>
          <Field
            label="Email"
            hint="Used for admissions correspondence; you can change it here if needed."
          >
            <input
              type="email"
              className={inputClass}
              disabled={readOnly}
              value={String(values.email ?? '')}
              onChange={(e) => onChange('email', e.target.value)}
            />
          </Field>
          <Field label="Mobile">
            <input
              className={inputClass}
              disabled={readOnly}
              value={String(values.mobile ?? values.phone ?? '')}
              onChange={(e) => onChange('mobile', e.target.value)}
              placeholder="10-digit mobile number"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function ParentBlock({
  prefix,
  title,
  values,
  onChange,
  readOnly,
}: SectionProps & { prefix: 'father' | 'mother'; title: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-[#1a2b4b]">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            disabled={readOnly}
            value={String(values[`${prefix}Name`] ?? '')}
            onChange={(e) => onChange(`${prefix}Name`, e.target.value)}
          />
        </Field>
        <Field label="Age">
          <input
            type="number"
            className={inputClass}
            disabled={readOnly}
            value={String(values[`${prefix}Age`] ?? '')}
            onChange={(e) => onChange(`${prefix}Age`, e.target.value ? Number(e.target.value) : '')}
          />
        </Field>
        <Field label="Occupation">
          <input
            className={inputClass}
            disabled={readOnly}
            value={String(values[`${prefix}Occupation`] ?? '')}
            onChange={(e) => onChange(`${prefix}Occupation`, e.target.value)}
          />
        </Field>
        <Field label="Contact Number" hint="10 digits">
          <input
            className={inputClass}
            disabled={readOnly}
            value={String(values[`${prefix}Phone`] ?? '')}
            onChange={(e) => onChange(`${prefix}Phone`, e.target.value)}
            placeholder="10 digits"
          />
        </Field>
      </div>
    </div>
  );
}

export function FamilySection({ values, onChange, readOnly }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard icon="👨‍👩‍👧" title="Family & Guardian Details">
        <div className="space-y-4">
          <ParentBlock
            prefix="father"
            title="👨 Father"
            values={values}
            onChange={onChange}
            readOnly={readOnly}
          />
          <ParentBlock
            prefix="mother"
            title="👩 Mother"
            values={values}
            onChange={onChange}
            readOnly={readOnly}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(values.hasLocalGuardian)}
              onChange={(e) => onChange('hasLocalGuardian', e.target.checked)}
            />
            I have a local guardian
          </label>
        </div>
      </SectionCard>

      <SectionCard icon="🏠" title="Household Information">
        <Field label="Where is your household located?">
          <div className="flex gap-2">
            {(['Urban', 'Rural'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={readOnly}
                onClick={() => onChange('householdLocation', opt.toUpperCase())}
                className={cn(
                  'rounded-lg border px-5 py-2 text-sm font-medium',
                  values.householdLocation === opt.toUpperCase()
                    ? 'border-[#2563eb] bg-[#2563eb] text-white'
                    : 'border-slate-200 bg-white text-slate-600',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>
      </SectionCard>
    </div>
  );
}

const BOARD_STREAM_OPTIONS = [
  { value: 'SCIENCE', label: 'Science' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'VOCATIONAL', label: 'Vocational' },
] as const;

export function AcademicSection({ values, onChange, readOnly }: SectionProps) {
  const boardNamesQ = useQuery({
    queryKey: ['support-data', 'board-names', 'class12'],
    queryFn: () => fetchBoardNames({ activeOnly: true }),
  });
  const streamsQ = useQuery({
    queryKey: ['academic-streams'],
    queryFn: fetchAcademicStreams,
  });

  const subjects: Class12SubjectValue[] = Array.isArray(values.class12Subjects)
    ? (values.class12Subjects as Class12SubjectValue[])
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        👉 Students can log in after the results are declared to update their Class XII marks.
      </div>

      <SectionCard
        icon="🗂️"
        title="Academic Records"
        subtitle="Pick board and stream. The subject list loads automatically."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="College stream (FYUGP)">
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.streamId ?? '')}
              onChange={(e) => onChange('streamId', e.target.value)}
            >
              <option value="">Select stream</option>
              {(streamsQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Board" required>
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.class12Board ?? '')}
              onChange={(e) => onChange('class12Board', e.target.value)}
            >
              <option value="">Select board</option>
              {(boardNamesQ.data ?? []).map((b) => (
                <option key={b.id} value={b.label}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stream" required>
            <select
              className={selectClass}
              disabled={readOnly}
              value={String(values.boardStream ?? '')}
              onChange={(e) => onChange('boardStream', e.target.value)}
            >
              <option value="">Select stream</option>
              {BOARD_STREAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="School name">
            <input
              className={inputClass}
              disabled={readOnly}
              value={String(values.schoolName ?? '')}
              onChange={(e) => onChange('schoolName', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Class XII — Subjects &amp; marks</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              Selected: {subjects.length} / Minimum 5
            </span>
          </div>
          <Class12SubjectMultiSelect
            value={subjects}
            boardStream={String(values.boardStream ?? '')}
            onChange={(class12Subjects) => onChange('class12Subjects', class12Subjects)}
          />
        </div>

        <div className="mt-5 rounded-lg bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-[#1a2b4b]">📘 Board examination details</p>
          <p className="mb-3 text-xs text-slate-500">
            Board name will match the board you selected for Class XII above.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Roll number">
              <input
                className={inputClass}
                disabled={readOnly}
                value={String(values.rollNumber ?? '')}
                onChange={(e) => onChange('rollNumber', e.target.value)}
              />
            </Field>
            <Field label="Year">
              <input
                className={inputClass}
                disabled={readOnly}
                value={String(values.examYear ?? '')}
                onChange={(e) => onChange('examYear', e.target.value)}
                placeholder="e.g. 2026"
              />
            </Field>
            <Field label="Total marks">
              <input
                type="number"
                className={inputClass}
                disabled={readOnly}
                value={String(values.totalMarks ?? '')}
                onChange={(e) =>
                  onChange('totalMarks', e.target.value ? Number(e.target.value) : '')
                }
              />
            </Field>
            <Field label="Percentage">
              <input
                className={inputClass}
                disabled={readOnly}
                value={String(values.class12Percentage ?? '')}
                onChange={(e) =>
                  onChange('class12Percentage', e.target.value ? Number(e.target.value) : '')
                }
                placeholder="e.g. 85.5"
              />
            </Field>
            <Field label="Division">
              <input
                className={inputClass}
                disabled={readOnly}
                value={String(values.division ?? '')}
                onChange={(e) => onChange('division', e.target.value)}
              />
            </Field>
            <Field label="Mode of study">
              <input
                className={inputClass}
                disabled={readOnly}
                value={String(values.modeOfStudy ?? '')}
                onChange={(e) => onChange('modeOfStudy', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
