import type { Prisma } from '@prisma/client';

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

export type DepartmentScope = 'academic' | 'administrative';

/** Maps `scope` query alias to group filter; explicit `type` wins when both are set. */
export function resolveDepartmentGroupFromQuery(params?: {
  type?: DepartmentGroup;
  scope?: DepartmentScope;
}): DepartmentGroup | undefined {
  if (params?.type) return params.type;
  if (params?.scope === 'academic') return 'ACADEMIC';
  if (params?.scope === 'administrative') return 'ADMINISTRATIVE';
  return undefined;
}

export function isAdministrativeDepartment(
  departmentType: string | null | undefined,
): boolean {
  return departmentType === ADMINISTRATIVE_DEPARTMENT_TYPE;
}

export function isAcademicDepartment(
  departmentType: string | null | undefined,
): boolean {
  if (!departmentType) return true;
  return !isAdministrativeDepartment(departmentType);
}

export function departmentGroupWhere(
  group: DepartmentGroup,
): Prisma.DepartmentWhereInput {
  if (group === 'ADMINISTRATIVE') {
    return { departmentType: ADMINISTRATIVE_DEPARTMENT_TYPE };
  }
  return {
    departmentType: { not: ADMINISTRATIVE_DEPARTMENT_TYPE },
  };
}

export function resolveDepartmentListFilter(params?: {
  type?: DepartmentGroup;
  departmentType?: string;
}): Prisma.DepartmentWhereInput {
  if (params?.departmentType) {
    return { departmentType: params.departmentType };
  }
  if (params?.type) {
    return departmentGroupWhere(params.type);
  }
  return {};
}
