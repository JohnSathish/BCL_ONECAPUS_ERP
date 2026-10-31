import {
  isRestrictedLibraryStaff,
  libraryQpReadonlyPermissions,
  restrictedStaffMayMutate,
} from './library-qp-readonly';

const CATALOG = [
  'students:read',
  'students:manage',
  'students:verify-documents',
  'fees:read',
  'fees:manage',
  'fees:cash:collect',
  'library:read',
  'library:manage',
  'question-bank:read',
  'question-bank:manage',
  'exam:view',
  'exam:admin',
  'academic-calendar:read',
  'academic-calendar:edit',
  'backup:download',
  'backup:read',
  'reports:read',
  'rbac:manage',
  'payroll:reports',
];

describe('library and question-paper read-only access', () => {
  const granted = libraryQpReadonlyPermissions(CATALOG);

  it('includes full library and question-paper rights', () => {
    expect(granted).toEqual(
      expect.arrayContaining([
        'library:manage',
        'library:circulate',
        'question-bank:publish',
      ]),
    );
  });

  it('keeps view access and leaves out write access for other modules', () => {
    expect(granted).toEqual(
      expect.arrayContaining([
        'students:read',
        'fees:read',
        'exam:view',
        'reports:read',
        'payroll:reports',
      ]),
    );
    expect(granted).not.toEqual(
      expect.arrayContaining([
        'students:manage',
        'students:verify-documents',
        'fees:manage',
        'fees:cash:collect',
        'exam:admin',
        'academic-calendar:edit',
        'rbac:manage',
        'backup:download',
      ]),
    );
  });

  it('allows library and question-paper changes and blocks other writes', () => {
    expect(restrictedStaffMayMutate('POST', '/api/v1/library/loans')).toBe(
      true,
    );
    expect(
      restrictedStaffMayMutate('DELETE', '/api/v1/question-bank/papers/1'),
    ).toBe(true);
    expect(restrictedStaffMayMutate('POST', '/api/v1/students')).toBe(false);
    expect(restrictedStaffMayMutate('PATCH', '/api/v1/fees/payments/1')).toBe(
      false,
    );
    expect(
      restrictedStaffMayMutate('POST', '/api/v1/auth/change-password'),
    ).toBe(true);
    expect(restrictedStaffMayMutate('GET', '/api/v1/students')).toBe(true);
    expect(
      restrictedStaffMayMutate('POST', '/api/v1/reports/students/export'),
    ).toBe(true);
  });

  it('matches only the three named accounts', () => {
    expect(isRestrictedLibraryStaff([], 'rehny@donboscocollege.ac.in')).toBe(
      true,
    );
    expect(
      isRestrictedLibraryStaff(
        ['college-admin'],
        'Stephen@donboscocollege.ac.in',
      ),
    ).toBe(true);
    expect(
      isRestrictedLibraryStaff(['librarian'], 'other@donboscocollege.ac.in'),
    ).toBe(false);
    expect(
      isRestrictedLibraryStaff(
        ['library-qp-readonly'],
        'other@donboscocollege.ac.in',
      ),
    ).toBe(true);
  });
});
