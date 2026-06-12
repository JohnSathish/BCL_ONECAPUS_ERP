export const ADMINISTRATIVE_DEPARTMENT_TYPE = 'ADMINISTRATIVE' as const;

export const ACADEMIC_DEPARTMENT_TYPES = [
  'ACADEMIC',
  'ARTS',
  'SCIENCE',
  'COMMERCE',
  'PROFESSIONAL',
  'INTERDISCIPLINARY',
] as const;

export type DepartmentGroup = 'ACADEMIC' | 'ADMINISTRATIVE';

export function isAdministrativeDepartment(departmentType?: string | null): boolean {
  return departmentType === ADMINISTRATIVE_DEPARTMENT_TYPE;
}

export function isAcademicDepartment(departmentType?: string | null): boolean {
  if (!departmentType) return true;
  return !isAdministrativeDepartment(departmentType);
}

export function departmentGroupFetchType(
  staffType: string,
  designationCategory?: string | null,
): DepartmentGroup {
  if (staffType === 'CONTRACT' && designationCategory === 'TEACHING') {
    return 'ACADEMIC';
  }
  if (staffType === 'CONTRACT' && designationCategory === 'NON_TEACHING') {
    return 'ADMINISTRATIVE';
  }
  if (['TEACHING', 'GUEST', 'VISITING'].includes(staffType)) {
    return 'ACADEMIC';
  }
  return 'ADMINISTRATIVE';
}
