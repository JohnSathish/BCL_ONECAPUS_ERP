import {
  departmentGroupWhere,
  isAcademicDepartment,
  isAdministrativeDepartment,
  resolveDepartmentGroupFromQuery,
  resolveDepartmentListFilter,
} from './department-rules';

describe('department-rules', () => {
  it('treats faculty subtypes as academic', () => {
    expect(isAcademicDepartment('ARTS')).toBe(true);
    expect(isAcademicDepartment('SCIENCE')).toBe(true);
    expect(isAcademicDepartment('PROFESSIONAL')).toBe(true);
    expect(isAdministrativeDepartment('ADMINISTRATIVE')).toBe(true);
    expect(isAcademicDepartment('ADMINISTRATIVE')).toBe(false);
  });

  it('builds academic group filter excluding administrative type', () => {
    expect(departmentGroupWhere('ACADEMIC')).toEqual({
      departmentType: { not: 'ADMINISTRATIVE' },
    });
    expect(departmentGroupWhere('ADMINISTRATIVE')).toEqual({
      departmentType: 'ADMINISTRATIVE',
    });
  });

  it('prefers exact departmentType over group filter', () => {
    expect(resolveDepartmentListFilter({ departmentType: 'ARTS' })).toEqual({
      departmentType: 'ARTS',
    });
    expect(resolveDepartmentListFilter({ type: 'ACADEMIC' })).toEqual({
      departmentType: { not: 'ADMINISTRATIVE' },
    });
  });

  it('maps scope query alias to department group', () => {
    expect(resolveDepartmentGroupFromQuery({ scope: 'academic' })).toBe(
      'ACADEMIC',
    );
    expect(resolveDepartmentGroupFromQuery({ scope: 'administrative' })).toBe(
      'ADMINISTRATIVE',
    );
    expect(
      resolveDepartmentGroupFromQuery({
        type: 'ADMINISTRATIVE',
        scope: 'academic',
      }),
    ).toBe('ADMINISTRATIVE');
  });
});
