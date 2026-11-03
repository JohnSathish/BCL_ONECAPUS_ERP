import {
  erpAccessBlockReason,
  erpRoleProblem,
  erpUsernameProblem,
  escalationProblem,
  isRoleOfferedForErp,
  nextErpAccountCode,
  normalizeErpUsername,
} from './erp-users.logic';

describe('ERP user rules', () => {
  it('keeps personal-dashboard roles out of ERP accounts', () => {
    for (const slug of ['student', 'faculty', 'staff', 'parent', 'applicant']) {
      expect(isRoleOfferedForErp(slug)).toBe(false);
      expect(erpRoleProblem(slug, ['students:read'])).not.toBeNull();
    }
    expect(isRoleOfferedForErp('school-admin')).toBe(false);
  });

  it('accepts ERP roles and custom roles that open the dashboard', () => {
    expect(erpRoleProblem('principal', [])).toBeNull();
    expect(erpRoleProblem('accountant', [])).toBeNull();
    expect(erpRoleProblem('custom-office', ['fees:read'])).toBeNull();
  });

  it('rejects a custom role with no ERP module permission', () => {
    expect(erpRoleProblem('custom-empty', [])).toMatch(/does not open/);
  });

  it('validates usernames', () => {
    expect(normalizeErpUsername('  Office.Admin ')).toBe('office.admin');
    expect(erpUsernameProblem('office.admin')).toBeNull();
    expect(erpUsernameProblem('ab')).not.toBeNull();
    expect(erpUsernameProblem('has space')).not.toBeNull();
    expect(erpUsernameProblem('a@b.com')).not.toBeNull();
  });

  it('numbers ERP user IDs after the highest existing one', () => {
    expect(nextErpAccountCode([])).toBe('ERP-0001');
    expect(nextErpAccountCode(['ERP-0002', 'ERP-0010', 'X-9'])).toBe(
      'ERP-0011',
    );
  });

  it('stops non-super-admins from granting more than they hold', () => {
    expect(
      escalationProblem({
        actorRoles: ['super-admin'],
        actorPermissions: [],
        targetRoleSlug: 'college-admin',
        targetPermissions: ['rbac:manage'],
      }),
    ).toBeNull();
    expect(
      escalationProblem({
        actorRoles: ['institution-admin'],
        actorPermissions: ['users:manage'],
        targetRoleSlug: 'super-admin',
        targetPermissions: [],
      }),
    ).toMatch(/Super Admin/);
    expect(
      escalationProblem({
        actorRoles: ['institution-admin'],
        actorPermissions: ['fees:read'],
        targetRoleSlug: 'accountant',
        targetPermissions: ['fees:read', 'fees:manage'],
      }),
    ).toMatch(/fees:manage/);
    expect(
      escalationProblem({
        actorRoles: ['institution-admin'],
        actorPermissions: ['fees:read', 'fees:manage'],
        targetRoleSlug: 'accountant',
        targetPermissions: ['fees:read'],
      }),
    ).toBeNull();
  });

  it('blocks ERP accounts that are inactive, locked or have access off', () => {
    const active = { isActive: true, accountStatus: 'active' };
    expect(
      erpAccessBlockReason(null, {
        isActive: false,
        accountStatus: 'inactive',
      }),
    ).toBeNull();
    expect(erpAccessBlockReason({ erpAccessEnabled: true }, active)).toBeNull();
    expect(erpAccessBlockReason({ erpAccessEnabled: false }, active)).toMatch(
      /turned off/,
    );
    expect(
      erpAccessBlockReason(
        { erpAccessEnabled: true },
        { isActive: true, accountStatus: 'locked' },
      ),
    ).toMatch(/locked/);
    expect(
      erpAccessBlockReason(
        { erpAccessEnabled: true },
        { isActive: false, accountStatus: 'inactive' },
      ),
    ).toMatch(/deactivated/);
  });
});
