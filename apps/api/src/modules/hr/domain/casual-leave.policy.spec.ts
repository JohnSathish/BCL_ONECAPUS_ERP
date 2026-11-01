import {
  addDays,
  evaluateCasualLeave,
  isHiddenFromStaffLeave,
  staffCanApplyForLeave,
} from './casual-leave.policy';

const empty = {
  holidays: new Set<string>(),
  vacations: new Set<string>(),
  existingCasualDates: [] as string[],
  otherLeaveDates: [] as string[],
  allocated: 15,
  carried: 0,
  used: 0,
  pendingDates: [] as string[],
};

describe('casual leave policy', () => {
  it('counts one working day', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-02',
    });
    expect(result).toEqual({ ok: true, totalDays: 1 });
  });

  it('allows three consecutive working days', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-04',
    });
    expect(result).toEqual({ ok: true, totalDays: 3 });
  });

  it('rejects four consecutive working days', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-05',
    });
    expect(result.ok).toBe(false);
  });

  it('excludes Sunday and still allows the working days around it', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-10-30',
      to: '2026-11-02',
    });
    expect(result).toEqual({ ok: true, totalDays: 3 });
  });

  it('does not let Sunday start a new three-day spell', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-10-29',
      to: '2026-11-02',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/3 working days/);
  });

  it('joins an earlier casual leave across Sunday', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-02',
      existingCasualDates: ['2026-10-29', '2026-10-30', '2026-10-31'],
    });
    expect(result.ok).toBe(false);
  });

  it('allows Monday when only Friday and Saturday were already taken', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-02',
      existingCasualDates: ['2026-10-30', '2026-10-31'],
    });
    expect(result).toEqual({ ok: true, totalDays: 1 });
  });

  it('does not count a holiday inside the spell', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-05',
      holidays: new Set(['2026-11-04']),
    });
    expect(result).toEqual({ ok: true, totalDays: 3 });
  });

  it('rejects a Sunday-only request', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-01',
      to: '2026-11-01',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects leave when the remaining balance is short', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-03',
      used: 14,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Remaining: 1/);
  });

  it('rejects leave when the annual balance is exhausted', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-02',
      used: 15,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/exhausted/);
  });

  it('keeps pending days reserved without treating them as availed', () => {
    const result = evaluateCasualLeave({
      ...empty,
      from: '2026-11-02',
      to: '2026-11-03',
      pendingDates: Array.from({ length: 14 }, (_, index) =>
        addDays('2026-01-05', index),
      ),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects casual leave attached to another leave or a vacation', () => {
    expect(
      evaluateCasualLeave({
        ...empty,
        from: '2026-11-02',
        to: '2026-11-02',
        otherLeaveDates: ['2026-11-03'],
      }).ok,
    ).toBe(false);
    expect(
      evaluateCasualLeave({
        ...empty,
        from: '2026-11-02',
        to: '2026-11-02',
        vacations: new Set(['2026-10-31']),
      }).ok,
    ).toBe(false);
  });

  it('hides medical, earned, maternity, and paternity from staff apply', () => {
    expect(isHiddenFromStaffLeave({ code: 'SL', name: 'Sick Leave' })).toBe(
      true,
    );
    expect(isHiddenFromStaffLeave({ code: 'EL', name: 'Earned Leave' })).toBe(
      true,
    );
    expect(
      isHiddenFromStaffLeave({ code: 'MAT', name: 'Maternity Leave' }),
    ).toBe(true);
    expect(
      isHiddenFromStaffLeave({ code: 'PAT', name: 'Paternity Leave' }),
    ).toBe(true);
    expect(staffCanApplyForLeave({ code: 'CL', name: 'Casual Leave' })).toBe(
      true,
    );
  });
});
