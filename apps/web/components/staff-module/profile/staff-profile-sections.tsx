'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Field,
  FieldGrid,
  SectionCard,
  inputClass,
} from '@/components/student-profile/student-profile-shell';
import { RoleChipSelect } from '@/components/staff-module/employment/role-chip-select';
import { ShiftMultiSelect } from '@/components/staff-module/employment/shift-multi-select';
import { ShortCodeField } from '@/components/staff-module/employment/short-code-field';
import {
  filterDepartmentsByStaffType,
  filterDesignationsByStaffType,
  sanitizeEmploymentOnDesignationChange,
  sanitizeEmploymentOnStaffTypeChange,
  supportsAdditionalAcademicRoles,
} from '@/components/staff-module/employment/employment-rules';
import { fetchAcademicRoles, updateStaffProfileSection, uploadStaffPhoto } from '@/services/staff';
import { StudentPhotoUpload } from '@/components/student-records/student-photo-upload';
import { fetchDepartments } from '@/services/organization';
import { fetchSupportDataRows } from '@/services/support-data';
import { fetchShifts } from '@/services/shifts';
import type { StaffProfile } from '@/types/staff';
import type { StaffProfileSection } from '@/types/staff';
import { SupportDataSelect } from '@/components/administration-module/support-data/support-data-select';
import { useSupportDataOptions } from '@/hooks/use-support-data';
import { DateInput } from '@/components/ui/date-input';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDateTime } from '@/utils/format-date';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { StaffPfSection } from '@/components/staff-module/profile/staff-pf-section';
import {
  TEACHING_SHIFT_CATEGORIES,
  TEACHING_SHIFT_CATEGORY_LABELS,
} from '@/components/staff-module/employment/staff-shift-category';

function useDebouncedStaffSave<T extends Record<string, unknown>>(
  staffId: string,
  sectionKey: StaffProfileSection,
  values: T,
  enabled: boolean,
) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitial = useRef(true);
  const mut = useMutation({
    mutationFn: (payload: T) => updateStaffProfileSection(staffId, sectionKey, payload),
    onSuccess: () => {
      setMessage('Saved');
      void qc.invalidateQueries({ queryKey: ['staff', staffId, 'profile'] });
      setTimeout(() => setMessage(''), 2000);
    },
    onError: (e) =>
      setMessage(
        `Save failed: ${apiErrorMessage(e, 'Could not save this section. Check required fields and try again.')}`,
      ),
  });

  useEffect(() => {
    if (!enabled) return;
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mut.mutate(values), 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), enabled]);

  return { saving: mut.isPending, message };
}

export function StaffBasicSection({
  profile,
  canEdit,
}: {
  profile: StaffProfile;
  canEdit: boolean;
}) {
  const bloodGroupOptions = useSupportDataOptions('blood-groups');
  const [form, setForm] = useState({
    fullName: profile.fullName,
    email: profile.email ?? '',
    mobile: profile.mobile ?? '',
    gender: profile.gender ?? '',
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
    bloodGroupLookupId: profile.bloodGroupLookupId ?? '',
    rfidNo: profile.rfidNo ?? '',
    biometricId: profile.biometricId ?? '',
    qualification: profile.qualification ?? '',
    specialization: profile.specialization ?? '',
    experienceYears: profile.experienceYears ?? undefined,
  });
  const { message, saving } = useDebouncedStaffSave(profile.id, 'basic', form, canEdit);
  const qc = useQueryClient();
  const [photoError, setPhotoError] = useState('');

  const photoMut = useMutation({
    mutationFn: (file: File) => uploadStaffPhoto(profile.id, file),
    onSuccess: (result) => {
      setPhotoError('');
      qc.setQueryData<StaffProfile>(['staff', profile.id, 'profile'], (current) =>
        current ? { ...current, photoUrl: result.photoUrl } : current,
      );
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'profile'] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => setPhotoError(apiErrorMessage(error, 'Photo upload failed')),
  });

  return (
    <SectionCard
      title="Basic details"
      description="Identity and contact"
      footer={saving ? 'Saving…' : message}
    >
      <div className="mb-3 space-y-1.5">
        <StudentPhotoUpload
          photoPath={profile.photoUrl}
          disabled={!canEdit}
          pending={photoMut.isPending}
          onSelect={(file) => photoMut.mutate(file)}
        />
        {photoError ? <p className="text-[11px] text-destructive">{photoError}</p> : null}
      </div>
      <FieldGrid>
        <Field label="Employee code">
          <input className={inputClass} value={profile.employeeCode} readOnly />
        </Field>
        <Field label="Full name">
          <input
            className={inputClass}
            value={form.fullName}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            value={form.email}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label="Mobile">
          <input
            className={inputClass}
            value={form.mobile}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
          />
        </Field>
        <Field label="Gender">
          <select
            className={inputClass}
            value={form.gender}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
          >
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <DateInput
            value={form.dateOfBirth}
            disabled={!canEdit}
            onChange={(dateOfBirth) => setForm((f) => ({ ...f, dateOfBirth }))}
          />
        </Field>
        <Field label="Blood group">
          <select
            className={inputClass}
            value={form.bloodGroupLookupId}
            disabled={!canEdit || bloodGroupOptions.isLoading}
            onChange={(e) => setForm((f) => ({ ...f, bloodGroupLookupId: e.target.value }))}
          >
            <option value="">—</option>
            {bloodGroupOptions.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="RFID">
          <input
            className={inputClass}
            value={form.rfidNo}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, rfidNo: e.target.value }))}
          />
        </Field>
        <Field label="Biometric ID">
          <input
            className={inputClass}
            value={form.biometricId}
            maxLength={50}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, biometricId: e.target.value }))}
            onBlur={(e) =>
              setForm((f) => ({
                ...f,
                biometricId: e.target.value.replace(/\s+/g, ' ').trim(),
              }))
            }
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Unique user ID configured inside biometric attendance device.
          </p>
        </Field>
        <Field label="Qualification">
          <input
            className={inputClass}
            value={form.qualification}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
          />
        </Field>
        <Field label="Specialization">
          <input
            className={inputClass}
            value={form.specialization}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
          />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function StaffEmploymentSection({
  profile,
  canEdit,
}: {
  profile: StaffProfile;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    staffType: profile.staffType,
    employmentType: profile.employmentType,
    status: profile.status,
    departmentId: profile.departmentId ?? '',
    designationId: profile.designationId ?? '',
    primaryShiftId: profile.primaryShiftId ?? '',
    teachingShiftCategory: profile.teachingShiftCategory ?? 'DAY',
    additionalShiftIds: profile.additionalShiftIds ?? [],
    additionalRoleCodes: (profile.additionalRoles ?? [])
      .map((r) => r.code)
      .filter((code): code is string => typeof code === 'string' && code.trim().length > 0),
    shortCode: profile.shortCode ?? '',
    joiningDate: profile.joiningDate?.slice(0, 10) ?? '',
    probationEndDate: profile.probationEndDate?.slice(0, 10) ?? '',
    confirmationDate: profile.confirmationDate?.slice(0, 10) ?? '',
    relievingDate: profile.relievingDate?.slice(0, 10) ?? '',
    retirementDate: profile.retirementDate?.slice(0, 10) ?? '',
    lastWorkingDate: profile.lastWorkingDate?.slice(0, 10) ?? '',
    resignationReason: profile.resignationReason ?? '',
  });

  const designations = useQuery({
    queryKey: ['support-data', 'designations'],
    queryFn: () => fetchSupportDataRows('designations'),
  });
  const academicRoles = useQuery({
    queryKey: ['staff', 'academic-roles'],
    queryFn: fetchAcademicRoles,
  });
  const shifts = useQuery({
    queryKey: ['shifts', profile.campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId: profile.campusId ?? undefined, status: 'ACTIVE' }),
  });

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
  });

  const { message, saving } = useDebouncedStaffSave(profile.id, 'employment', form, canEdit);

  const allDesignations = useMemo(
    () =>
      (designations.data ?? []).map((d) => ({
        id: d.id,
        code: d.code,
        label: d.label,
        category: d.metadata?.category as string | undefined,
      })),
    [designations.data],
  );
  const allDepartments = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.name,
        departmentType: d.departmentType,
      })),
    [departments.data],
  );

  const selectedDesignation = allDesignations.find((d) => d.id === form.designationId);
  const designationCategory = selectedDesignation?.category ?? null;

  const designationOptions = useMemo(
    () => filterDesignationsByStaffType(allDesignations, form.staffType),
    [allDesignations, form.staffType],
  );

  const departmentOptions = useMemo(
    () => filterDepartmentsByStaffType(allDepartments, form.staffType, designationCategory),
    [allDepartments, form.staffType, designationCategory],
  );

  const showAcademicRoles = supportsAdditionalAcademicRoles(form.staffType);

  const staffTypes = useSupportDataOptions('staff-types');
  const employmentTypes = useSupportDataOptions('employment-types');
  const staffStatuses = useSupportDataOptions('staff-status');

  const handleStaffTypeChange = (staffType: string) => {
    setForm((f) => {
      const currentDes = allDesignations.find((d) => d.id === f.designationId);
      const currentDept = allDepartments.find((d) => d.id === f.departmentId);
      const sanitized = sanitizeEmploymentOnStaffTypeChange(staffType, {
        designationId: f.designationId,
        designationCategory: currentDes?.category,
        departmentId: f.departmentId,
        departmentType: currentDept?.departmentType,
        additionalRoleCodes: f.additionalRoleCodes,
      });
      return { ...f, staffType, ...sanitized };
    });
  };

  const handleDesignationChange = (designationId: string) => {
    setForm((f) => {
      const des = allDesignations.find((d) => d.id === designationId);
      const currentDept = allDepartments.find((d) => d.id === f.departmentId);
      const departmentId = sanitizeEmploymentOnDesignationChange(
        f.staffType,
        des?.category,
        f.departmentId,
        currentDept?.departmentType,
      );
      return { ...f, designationId, departmentId };
    });
  };

  const roleOptions = (academicRoles.data ?? []).map((r) => ({ code: r.code, label: r.label }));
  const shiftOptions = (shifts.data ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    code: s.code,
  }));

  return (
    <SectionCard
      title="Employment & Academic Role"
      description="Role, shifts, lifecycle, and timetable code"
      footer={saving ? 'Saving…' : message}
    >
      <FieldGrid>
        <Field label="Staff type">
          <SupportDataSelect
            category="staff-types"
            className={inputClass}
            value={form.staffType}
            disabled={!canEdit}
            options={staffTypes.options}
            loading={staffTypes.isLoading}
            onChange={handleStaffTypeChange}
          />
        </Field>
        <Field label="Employment type">
          <SupportDataSelect
            category="employment-types"
            className={inputClass}
            value={form.employmentType}
            disabled={!canEdit}
            options={employmentTypes.options}
            loading={employmentTypes.isLoading}
            onChange={(employmentType) => setForm((f) => ({ ...f, employmentType }))}
          />
        </Field>
        <Field label="Status">
          <SupportDataSelect
            category="staff-status"
            className={inputClass}
            value={form.status}
            disabled={!canEdit}
            options={staffStatuses.options}
            loading={staffStatuses.isLoading}
            onChange={(status) => setForm((f) => ({ ...f, status }))}
          />
        </Field>
        <Field label="Department">
          <select
            className={inputClass}
            value={form.departmentId}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
          >
            <option value="">Select department</option>
            {(departmentOptions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Primary designation">
          <select
            className={inputClass}
            value={form.designationId}
            disabled={!canEdit}
            onChange={(e) => handleDesignationChange(e.target.value)}
          >
            <option value="">Select designation</option>
            {designationOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shift">
          {form.staffType === 'TEACHING' ? (
            <select
              className={inputClass}
              value={form.teachingShiftCategory}
              disabled={!canEdit}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  teachingShiftCategory: e.target.value,
                }))
              }
            >
              {TEACHING_SHIFT_CATEGORIES.slice(0, 3).map((value) => (
                <option key={value} value={value}>
                  {TEACHING_SHIFT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          ) : (
            <select
              className={inputClass}
              value={form.primaryShiftId}
              disabled={!canEdit}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  primaryShiftId: e.target.value,
                  additionalShiftIds: f.additionalShiftIds.filter((id) => id !== e.target.value),
                }))
              }
            >
              <option value="">Select shift</option>
              {shiftOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ` : ''}
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Staff short code">
          <ShortCodeField
            value={form.shortCode}
            fullName={profile.fullName}
            disabled={!canEdit}
            onChange={(shortCode) => setForm((f) => ({ ...f, shortCode }))}
          />
        </Field>
        {showAcademicRoles ? (
          <>
            <Field label="Additional academic roles">
              <RoleChipSelect
                options={roleOptions}
                selectedCodes={form.additionalRoleCodes.filter(Boolean)}
                disabled={!canEdit}
                onChange={(additionalRoleCodes) =>
                  setForm((f) => ({
                    ...f,
                    additionalRoleCodes: additionalRoleCodes.filter(Boolean),
                  }))
                }
              />
            </Field>
            <Field label="Additional teaching shifts">
              <ShiftMultiSelect
                options={shiftOptions}
                primaryShiftId={form.primaryShiftId}
                additionalShiftIds={form.additionalShiftIds}
                disabled={!canEdit}
                onChange={(additionalShiftIds) => setForm((f) => ({ ...f, additionalShiftIds }))}
              />
            </Field>
          </>
        ) : null}
        <Field label="Joining date">
          <DateInput
            value={form.joiningDate}
            disabled={!canEdit}
            onChange={(joiningDate) => setForm((f) => ({ ...f, joiningDate }))}
          />
        </Field>
        <Field label="Probation end">
          <DateInput
            value={form.probationEndDate}
            disabled={!canEdit}
            onChange={(probationEndDate) => setForm((f) => ({ ...f, probationEndDate }))}
          />
        </Field>
        <Field label="Confirmation date">
          <DateInput
            value={form.confirmationDate}
            disabled={!canEdit}
            onChange={(confirmationDate) => setForm((f) => ({ ...f, confirmationDate }))}
          />
        </Field>
        <Field label="Relieving date">
          <DateInput
            value={form.relievingDate}
            disabled={!canEdit}
            onChange={(relievingDate) => setForm((f) => ({ ...f, relievingDate }))}
          />
        </Field>
        <Field label="Retirement date">
          <DateInput
            value={form.retirementDate}
            disabled={!canEdit}
            onChange={(retirementDate) => setForm((f) => ({ ...f, retirementDate }))}
          />
        </Field>
        <Field label="Last working date">
          <DateInput
            value={form.lastWorkingDate}
            disabled={!canEdit}
            onChange={(lastWorkingDate) => setForm((f) => ({ ...f, lastWorkingDate }))}
          />
        </Field>
        <Field label="Resignation reason">
          <input
            className={inputClass}
            value={form.resignationReason}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, resignationReason: e.target.value }))}
          />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function StaffSalarySection({
  profile,
  canEdit,
}: {
  profile: StaffProfile;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    bankName: profile.bankName ?? '',
    accountNumber: profile.accountNumber ?? '',
    ifsc: profile.ifsc ?? '',
    pfNumber: profile.pfNumber ?? '',
    basicPay: profile.basicPay != null ? String(profile.basicPay) : '',
  });
  const { message, saving } = useDebouncedStaffSave(profile.id, 'salary', form, canEdit);

  return (
    <>
      <StaffPfSection profile={profile} canEdit={canEdit} />
      <SectionCard
        title="Salary & bank"
        description="Bank and statutory details. Pay structure and basic pay are managed in Human Resources → Pay Assignments."
        footer={saving ? 'Saving…' : message}
      >
        <FieldGrid>
          <Field label="Bank name">
            <input
              className={inputClass}
              value={form.bankName}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            />
          </Field>
          <Field label="Account number">
            <input
              className={inputClass}
              value={form.accountNumber}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            />
          </Field>
          <Field label="IFSC">
            <input
              className={inputClass}
              value={form.ifsc}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value }))}
            />
          </Field>
          <Field label="PF number">
            <input
              className={inputClass}
              value={form.pfNumber}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, pfNumber: e.target.value }))}
            />
          </Field>
          <Field label="Basic pay (legacy)">
            <input
              className={inputClass}
              value={form.basicPay}
              disabled
              readOnly
              title="Managed via HR Pay Assignments"
            />
          </Field>
        </FieldGrid>
        <p className="mt-3 text-xs text-muted-foreground">
          <a
            href={`/admin/hr/assignments?staffProfileId=${profile.id}`}
            className="text-primary underline"
          >
            Open pay assignment in Human Resources
          </a>
        </p>
      </SectionCard>
    </>
  );
}

export function StaffSystemSection({ profile }: { profile: StaffProfile }) {
  return (
    <SectionCard title="System" description="Record metadata">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{profile.createdAt ? formatDisplayDateTime(profile.createdAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{profile.updatedAt ? formatDisplayDateTime(profile.updatedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Portal email</dt>
          <dd>{profile.portalUser?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Portal status</dt>
          <dd>{profile.portalActive ? 'Active' : profile.portalPending ? 'Pending' : 'None'}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
