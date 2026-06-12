/**
 * Staff employment rules: designation categories, department groups, validation.
 */

import {
  ACADEMIC_DEPARTMENT_TYPES,
  ADMINISTRATIVE_DEPARTMENT_TYPE,
  isAcademicDepartment,
  isAdministrativeDepartment,
} from '../../organization/department-rules';

export const DESIGNATION_CATEGORIES = [
  'TEACHING',
  'NON_TEACHING',
  'ADMIN',
] as const;
export type DesignationCategory = (typeof DESIGNATION_CATEGORIES)[number];

export {
  ACADEMIC_DEPARTMENT_TYPES,
  ADMINISTRATIVE_DEPARTMENT_TYPE,
  isAcademicDepartment,
  isAdministrativeDepartment,
};

export const STAFF_TYPES = [
  'TEACHING',
  'NON_TEACHING',
  'GUEST',
  'VISITING',
  'CONTRACT',
  'ADMIN',
] as const;

/** Staff types that may hold additional academic roles (HoD, IQAC, etc.) */
export const TEACHING_STAFF_TYPES = ['TEACHING', 'GUEST', 'VISITING'] as const;

const STAFF_TYPE_TO_DESIGNATION_CATEGORIES: Record<
  string,
  DesignationCategory[]
> = {
  TEACHING: ['TEACHING'],
  GUEST: ['TEACHING'],
  VISITING: ['TEACHING'],
  NON_TEACHING: ['NON_TEACHING'],
  ADMIN: ['ADMIN'],
  CONTRACT: ['TEACHING', 'NON_TEACHING'],
};

export function allowedDesignationCategories(
  staffType: string,
): DesignationCategory[] {
  return STAFF_TYPE_TO_DESIGNATION_CATEGORIES[staffType] ?? ['NON_TEACHING'];
}

export function isTeachingStaffType(staffType: string): boolean {
  return (TEACHING_STAFF_TYPES as readonly string[]).includes(staffType);
}

export function supportsAdditionalAcademicRoles(staffType: string): boolean {
  return isTeachingStaffType(staffType);
}

export function requiredDepartmentGroup(
  staffType: string,
): 'ACADEMIC' | 'ADMINISTRATIVE' {
  if (isTeachingStaffType(staffType)) return 'ACADEMIC';
  if (staffType === 'ADMIN' || staffType === 'NON_TEACHING')
    return 'ADMINISTRATIVE';
  return 'ADMINISTRATIVE';
}

export function departmentMatchesStaffType(
  staffType: string,
  departmentType: string | null | undefined,
  designationCategory?: string | null,
): boolean {
  if (!departmentType) return true;
  if (staffType === 'CONTRACT' && designationCategory) {
    if (designationCategory === 'TEACHING')
      return isAcademicDepartment(departmentType);
    if (designationCategory === 'NON_TEACHING') {
      return isAdministrativeDepartment(departmentType);
    }
    return true;
  }
  const group = requiredDepartmentGroup(staffType);
  if (group === 'ACADEMIC') return isAcademicDepartment(departmentType);
  return isAdministrativeDepartment(departmentType);
}

export function designationMatchesStaffType(
  staffType: string,
  designationCategory: string | null | undefined,
): boolean {
  if (!designationCategory) return true;
  const allowed = allowedDesignationCategories(staffType);
  return allowed.includes(designationCategory as DesignationCategory);
}

export type EmploymentValidationInput = {
  staffType: string;
  designationCategory?: string | null;
  departmentType?: string | null;
  additionalRoleCodes?: string[];
};

export function validateEmploymentCombination(
  input: EmploymentValidationInput,
): string[] {
  const errors: string[] = [];
  const {
    staffType,
    designationCategory,
    departmentType,
    additionalRoleCodes,
  } = input;

  if (
    designationCategory &&
    !designationMatchesStaffType(staffType, designationCategory)
  ) {
    errors.push(
      `Designation category "${designationCategory}" is not valid for staff type "${staffType}"`,
    );
  }

  if (
    departmentType &&
    !departmentMatchesStaffType(staffType, departmentType, designationCategory)
  ) {
    const expected =
      staffType === 'CONTRACT' && designationCategory === 'TEACHING'
        ? 'academic'
        : staffType === 'CONTRACT' && designationCategory === 'NON_TEACHING'
          ? 'administrative'
          : requiredDepartmentGroup(staffType).toLowerCase();
    errors.push(
      `Department type is not valid for ${staffType} staff (expected ${expected} department)`,
    );
  }

  if (
    additionalRoleCodes?.length &&
    !supportsAdditionalAcademicRoles(staffType)
  ) {
    errors.push(
      'Additional academic roles are only allowed for teaching staff',
    );
  }

  return errors;
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

  if (
    current.designationCategory &&
    !designationMatchesStaffType(staffType, current.designationCategory)
  ) {
    designationId = '';
  }

  if (
    current.departmentType &&
    !departmentMatchesStaffType(
      staffType,
      current.departmentType,
      current.designationCategory,
    )
  ) {
    departmentId = '';
  }

  if (!supportsAdditionalAcademicRoles(staffType)) {
    additionalRoleCodes = [];
  }

  return { designationId, departmentId, additionalRoleCodes };
}
