/**
 * Client-side employment rules mirroring API validation for dynamic UI.
 */

import {
  ACADEMIC_DEPARTMENT_TYPES,
  ADMINISTRATIVE_DEPARTMENT_TYPE,
  isAcademicDepartment,
  isAdministrativeDepartment,
} from '@/utils/department-rules';

export {
  ACADEMIC_DEPARTMENT_TYPES,
  ADMINISTRATIVE_DEPARTMENT_TYPE,
  isAcademicDepartment,
  isAdministrativeDepartment,
};

export type DesignationCategory = 'TEACHING' | 'NON_TEACHING' | 'ADMIN';

export type StaffDesignationOption = {
  id: string;
  label: string;
  code?: string;
  category?: string;
};

export type DepartmentOption = {
  id: string;
  label: string;
  departmentType?: string;
};

const STAFF_TYPE_TO_DESIGNATION_CATEGORIES: Record<string, DesignationCategory[]> = {
  TEACHING: ['TEACHING'],
  GUEST: ['TEACHING'],
  VISITING: ['TEACHING'],
  NON_TEACHING: ['NON_TEACHING'],
  ADMIN: ['ADMIN'],
  CONTRACT: ['TEACHING', 'NON_TEACHING'],
};

export function allowedDesignationCategories(staffType: string): DesignationCategory[] {
  return STAFF_TYPE_TO_DESIGNATION_CATEGORIES[staffType] ?? ['NON_TEACHING'];
}

export function supportsAdditionalAcademicRoles(staffType: string): boolean {
  return ['TEACHING', 'GUEST', 'VISITING'].includes(staffType);
}

export function filterDesignationsByStaffType<T extends StaffDesignationOption>(
  designations: T[],
  staffType: string,
): T[] {
  const allowed = allowedDesignationCategories(staffType);
  return designations.filter(
    (d) => !d.category || allowed.includes(d.category as DesignationCategory),
  );
}

export function filterDepartmentsByStaffType<T extends DepartmentOption>(
  departments: T[],
  staffType: string,
  designationCategory?: string | null,
): T[] {
  if (staffType === 'CONTRACT' && designationCategory) {
    if (designationCategory === 'TEACHING') {
      return departments.filter((d) => isAcademicDepartment(d.departmentType));
    }
    if (designationCategory === 'NON_TEACHING') {
      return departments.filter((d) => isAdministrativeDepartment(d.departmentType));
    }
  }
  if (supportsAdditionalAcademicRoles(staffType)) {
    return departments.filter((d) => isAcademicDepartment(d.departmentType));
  }
  if (staffType === 'ADMIN' || staffType === 'NON_TEACHING') {
    return departments.filter((d) => isAdministrativeDepartment(d.departmentType));
  }
  return departments.filter((d) => isAdministrativeDepartment(d.departmentType));
}

export function sanitizeEmploymentOnStaffTypeChange(
  staffType: string,
  current: {
    designationId?: string;
    designationCategory?: string | null;
    departmentId?: string;
    departmentType?: string | null;
    additionalRoleCodes?: string[];
  },
): {
  designationId: string;
  departmentId: string;
  additionalRoleCodes: string[];
} {
  let designationId = current.designationId ?? '';
  let departmentId = current.departmentId ?? '';
  let additionalRoleCodes = current.additionalRoleCodes ?? [];

  const allowed = allowedDesignationCategories(staffType);
  if (
    current.designationCategory &&
    !allowed.includes(current.designationCategory as DesignationCategory)
  ) {
    designationId = '';
  }

  const deptMatches = filterDepartmentsByStaffType(
    current.departmentType
      ? [{ id: current.departmentId ?? '', label: '', departmentType: current.departmentType }]
      : [],
    staffType,
    current.designationCategory,
  );
  if (current.departmentType && deptMatches.length === 0) {
    departmentId = '';
  }

  if (!supportsAdditionalAcademicRoles(staffType)) {
    additionalRoleCodes = [];
  }

  return { designationId, departmentId, additionalRoleCodes };
}

export function sanitizeEmploymentOnDesignationChange(
  staffType: string,
  designationCategory: string | null | undefined,
  departmentId: string,
  departmentType: string | null | undefined,
): string {
  if (staffType !== 'CONTRACT' || !designationCategory || !departmentType) {
    return departmentId;
  }
  const matches = filterDepartmentsByStaffType(
    [{ id: departmentId, label: '', departmentType }],
    staffType,
    designationCategory,
  );
  return matches.length ? departmentId : '';
}
