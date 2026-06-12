import {
  allowedDesignationCategories,
  departmentMatchesStaffType,
  designationMatchesStaffType,
  supportsAdditionalAcademicRoles,
  validateEmploymentCombination,
} from './staff-employment-rules';

describe('staff-employment-rules', () => {
  it('allows teaching staff with academic designation and department', () => {
    const errors = validateEmploymentCombination({
      staffType: 'TEACHING',
      designationCategory: 'TEACHING',
      departmentType: 'SCIENCE',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects non-teaching staff with professor designation', () => {
    const errors = validateEmploymentCombination({
      staffType: 'NON_TEACHING',
      designationCategory: 'TEACHING',
      departmentType: 'ADMINISTRATIVE',
    });
    expect(errors.some((e) => e.includes('Designation category'))).toBe(true);
  });

  it('rejects peon in economics department', () => {
    const errors = validateEmploymentCombination({
      staffType: 'NON_TEACHING',
      designationCategory: 'NON_TEACHING',
      departmentType: 'ARTS',
    });
    expect(errors.some((e) => e.includes('Department type'))).toBe(true);
  });

  it('rejects additional academic roles for non-teaching staff', () => {
    const errors = validateEmploymentCombination({
      staffType: 'NON_TEACHING',
      designationCategory: 'NON_TEACHING',
      departmentType: 'ADMINISTRATIVE',
      additionalRoleCodes: ['HOD'],
    });
    expect(errors.some((e) => e.includes('Additional academic roles'))).toBe(
      true,
    );
  });

  it('allows admin staff with registrar designation', () => {
    const errors = validateEmploymentCombination({
      staffType: 'ADMIN',
      designationCategory: 'ADMIN',
      departmentType: 'ADMINISTRATIVE',
    });
    expect(errors).toHaveLength(0);
  });

  it('maps staff types to designation categories', () => {
    expect(allowedDesignationCategories('TEACHING')).toEqual(['TEACHING']);
    expect(allowedDesignationCategories('NON_TEACHING')).toEqual([
      'NON_TEACHING',
    ]);
    expect(allowedDesignationCategories('CONTRACT')).toEqual([
      'TEACHING',
      'NON_TEACHING',
    ]);
  });

  it('identifies teaching staff types for academic roles', () => {
    expect(supportsAdditionalAcademicRoles('TEACHING')).toBe(true);
    expect(supportsAdditionalAcademicRoles('GUEST')).toBe(true);
    expect(supportsAdditionalAcademicRoles('NON_TEACHING')).toBe(false);
  });

  it('matches contract staff department to designation category', () => {
    expect(departmentMatchesStaffType('CONTRACT', 'SCIENCE', 'TEACHING')).toBe(
      true,
    );
    expect(
      departmentMatchesStaffType('CONTRACT', 'ADMINISTRATIVE', 'NON_TEACHING'),
    ).toBe(true);
    expect(
      departmentMatchesStaffType('CONTRACT', 'SCIENCE', 'NON_TEACHING'),
    ).toBe(false);
  });

  it('matches designation to staff type', () => {
    expect(designationMatchesStaffType('TEACHING', 'TEACHING')).toBe(true);
    expect(designationMatchesStaffType('NON_TEACHING', 'TEACHING')).toBe(false);
  });
});
