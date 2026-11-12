import {
  isDirectIdentityLookup,
  mentionsAccountType,
  withNormalAccount,
} from './exclude-demo-accounts';

describe('demo account list filter', () => {
  it('adds NORMAL to a class-list filter', () => {
    expect(withNormalAccount({ tenantId: 't', deletedAt: null })).toEqual({
      AND: [{ tenantId: 't', deletedAt: null }, { accountType: 'NORMAL' }],
    });
  });

  it('leaves an explicit DEMO lookup unchanged', () => {
    const where = { accountType: 'DEMO', tenantId: 't' };
    expect(withNormalAccount(where)).toBe(where);
  });

  it('sees accountType nested in AND', () => {
    expect(mentionsAccountType({ AND: [{ accountType: 'DEMO' }] })).toBe(true);
    expect(mentionsAccountType({ tenantId: 't' })).toBe(false);
  });

  it('keeps an attendance id lookup from hiding the student', () => {
    const where = { id: { in: ['student-1'] } };
    expect(isDirectIdentityLookup(where)).toBe(true);
    expect(withNormalAccount(where)).toBe(where);
  });

  it('still hides demo rows from a department list', () => {
    expect(isDirectIdentityLookup({ tenantId: 't', departmentId: 'd' })).toBe(
      false,
    );
    expect(
      isDirectIdentityLookup({
        OR: [{ rollNumber: { contains: 'BA' } }],
      }),
    ).toBe(false);
  });
});
