'use client';

import { useMemo } from 'react';
import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
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
import {
  GlassField,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import type { AddStaffDraft } from '@/components/staff-module/add-staff/types/draft';
import { SupportDataSelect } from '@/components/administration-module/support-data/support-data-select';
import { useSupportDataOptions } from '@/hooks/use-support-data';
import { DateInput } from '@/components/ui/date-input';

type Option = { id: string; label: string; category?: string; departmentType?: string };
type RoleOption = { code: string; label: string };

type Props = {
  draft: AddStaffDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStaffDraft>>;
  errors: Record<string, string>;
  departmentOptions: Option[];
  designationOptions: Option[];
  academicRoleOptions: RoleOption[];
  shiftOptions: Option[];
};

export function StepEmployment({
  draft,
  setDraft,
  errors,
  departmentOptions: allDepartments,
  designationOptions: allDesignations,
  academicRoleOptions,
  shiftOptions,
}: Props) {
  const staffTypes = useSupportDataOptions('staff-types');
  const employmentTypes = useSupportDataOptions('employment-types');
  const staffStatuses = useSupportDataOptions('staff-status');

  const selectedDesignation = allDesignations.find((d) => d.id === draft.designationId);
  const designationCategory = selectedDesignation?.category ?? null;

  const designationOptions = useMemo(
    () => filterDesignationsByStaffType(allDesignations, draft.staffType),
    [allDesignations, draft.staffType],
  );

  const departmentOptions = useMemo(
    () => filterDepartmentsByStaffType(allDepartments, draft.staffType, designationCategory),
    [allDepartments, draft.staffType, designationCategory],
  );

  const showAcademicRoles = supportsAdditionalAcademicRoles(draft.staffType);

  const handleStaffTypeChange = (staffType: string) => {
    setDraft((d) => {
      const currentDes = allDesignations.find((x) => x.id === d.designationId);
      const currentDept = allDepartments.find((x) => x.id === d.departmentId);
      const sanitized = sanitizeEmploymentOnStaffTypeChange(staffType, {
        designationId: d.designationId,
        designationCategory: currentDes?.category,
        departmentId: d.departmentId,
        departmentType: currentDept?.departmentType,
        additionalRoleCodes: d.additionalRoleCodes,
      });
      return { ...d, staffType, ...sanitized };
    });
  };

  const handleDesignationChange = (designationId: string) => {
    setDraft((d) => {
      const des = allDesignations.find((x) => x.id === designationId);
      const currentDept = allDepartments.find((x) => x.id === d.departmentId);
      const departmentId = sanitizeEmploymentOnDesignationChange(
        d.staffType,
        des?.category,
        d.departmentId,
        currentDept?.departmentType,
      );
      return { ...d, designationId, departmentId };
    });
  };

  return (
    <>
      <ErpFormSection title="Employment" description="Role, department, and shift assignment">
        <ErpFormGrid>
          <GlassField label="Staff type" error={errors.staffType}>
            <SupportDataSelect
              category="staff-types"
              className={glassSelectClass}
              value={draft.staffType}
              options={staffTypes.options}
              loading={staffTypes.isLoading}
              onChange={(staffType) => handleStaffTypeChange(staffType)}
            />
          </GlassField>
          <GlassField label="Employment type" error={errors.employmentType}>
            <SupportDataSelect
              category="employment-types"
              className={glassSelectClass}
              value={draft.employmentType}
              options={employmentTypes.options}
              loading={employmentTypes.isLoading}
              onChange={(employmentType) => setDraft((d) => ({ ...d, employmentType }))}
            />
          </GlassField>
          <GlassField label="Status">
            <SupportDataSelect
              category="staff-status"
              className={glassSelectClass}
              value={draft.status}
              options={staffStatuses.options}
              loading={staffStatuses.isLoading}
              onChange={(status) => setDraft((d) => ({ ...d, status }))}
            />
          </GlassField>
          <GlassField label="Department">
            <select
              className={glassSelectClass}
              value={draft.departmentId}
              onChange={(e) => setDraft((d) => ({ ...d, departmentId: e.target.value }))}
            >
              <option value="">Select department</option>
              {departmentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Primary designation">
            <select
              className={glassSelectClass}
              value={draft.designationId}
              onChange={(e) => handleDesignationChange(e.target.value)}
            >
              <option value="">Select designation</option>
              {designationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Primary shift">
            <select
              className={glassSelectClass}
              value={draft.primaryShiftId}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  primaryShiftId: e.target.value,
                  additionalShiftIds: d.additionalShiftIds.filter((id) => id !== e.target.value),
                }))
              }
            >
              <option value="">Select shift</option>
              {shiftOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Staff short code">
            <ShortCodeField
              value={draft.shortCode}
              fullName={draft.fullName}
              onChange={(shortCode) => setDraft((d) => ({ ...d, shortCode }))}
            />
          </GlassField>
          <GlassField label="Joining date">
            <DateInput
              value={draft.joiningDate}
              onChange={(joiningDate) => setDraft((d) => ({ ...d, joiningDate }))}
            />
          </GlassField>
          <GlassField label="Probation end">
            <DateInput
              value={draft.probationEndDate}
              onChange={(probationEndDate) => setDraft((d) => ({ ...d, probationEndDate }))}
            />
          </GlassField>
          <GlassField label="Confirmation date">
            <DateInput
              value={draft.confirmationDate}
              onChange={(confirmationDate) => setDraft((d) => ({ ...d, confirmationDate }))}
            />
          </GlassField>
        </ErpFormGrid>
      </ErpFormSection>
      {showAcademicRoles ? (
        <ErpFormSection
          title="Academic roles & shifts"
          description="Additional teaching assignments"
        >
          <ErpFormGrid>
            <GlassField label="Additional academic roles">
              <RoleChipSelect
                options={academicRoleOptions}
                selectedCodes={draft.additionalRoleCodes}
                onChange={(additionalRoleCodes) => setDraft((d) => ({ ...d, additionalRoleCodes }))}
              />
            </GlassField>
            <GlassField label="Additional teaching shifts">
              <ShiftMultiSelect
                options={shiftOptions}
                primaryShiftId={draft.primaryShiftId}
                additionalShiftIds={draft.additionalShiftIds}
                onChange={(additionalShiftIds) => setDraft((d) => ({ ...d, additionalShiftIds }))}
              />
            </GlassField>
          </ErpFormGrid>
        </ErpFormSection>
      ) : null}
    </>
  );
}
