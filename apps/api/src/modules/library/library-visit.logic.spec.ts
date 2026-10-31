import {
  decideLibraryScan,
  pickActiveOpenVisit,
  previousRange,
  staleVisitSignOut,
  visitPresentation,
  visitRange,
} from './library-visit.logic';

describe('library visit presentation', () => {
  const entry = new Date('2026-09-24T04:05:00.000Z');

  it('keeps an open visit inside and marks the duration as ongoing', () => {
    const result = visitPresentation(
      entry,
      null,
      null,
      new Date('2026-09-24T04:20:00.000Z'),
    );
    expect(result.status).toBe('INSIDE');
    expect(result.ongoing).toBe(true);
    expect(result.durationMinutes).toBe(15);
  });

  it('uses the recorded exit for a completed visit', () => {
    const exit = new Date('2026-09-24T04:33:00.000Z');
    const result = visitPresentation(entry, exit, 28);
    expect(result.status).toBe('COMPLETED');
    expect(result.durationMinutes).toBe(28);
    expect(result.ongoing).toBe(false);
  });

  it('flags an exit that is earlier than the entry', () => {
    const result = visitPresentation(
      entry,
      new Date('2026-09-24T03:00:00.000Z'),
      10,
    );
    expect(result.status).toBe('REVIEW');
    expect(result.durationMinutes).toBeNull();
  });

  it('rejects a custom range that ends before it starts', () => {
    expect(() =>
      visitRange({ period: 'custom', from: '2026-09-20', to: '2026-09-14' }),
    ).toThrow(/end date/i);
  });

  it('places the comparison window immediately before the selected range', () => {
    const range = visitRange({
      period: 'custom',
      from: '2026-09-14',
      to: '2026-09-14',
      now: new Date('2026-09-24T10:00:00'),
    });
    const previous = previousRange(range);
    expect(previous.to.getTime()).toBeLessThan(range.from.getTime());
  });
});

describe('staleVisitSignOut', () => {
  const entry = new Date('2026-10-30T08:00:00');

  it('leaves a visit open during the first hour', () => {
    expect(
      staleVisitSignOut(entry, new Date('2026-10-30T08:59:00')),
    ).toBeNull();
  });

  it('signs the visit out at one hour, not at the time the job runs', () => {
    const result = staleVisitSignOut(entry, new Date('2026-10-30T14:30:00'));
    expect(result).toEqual({
      exitAt: new Date('2026-10-30T09:00:00'),
      durationMinutes: 60,
      exitMethod: 'AUTO',
    });
  });
});

describe('decideLibraryScan', () => {
  const entry = new Date('2026-10-31T09:00:00');
  const rules = { minStaySeconds: 60, duplicateWindowSeconds: 5 };

  it('registers an entry when the student is outside', () => {
    expect(
      decideLibraryScan({
        memberType: 'STUDENT',
        openEntryAt: null,
        lastAcceptedAt: null,
        now: entry,
        ...rules,
      }).action,
    ).toBe('ENTRY');
  });

  it('ignores a second scan two seconds after entry', () => {
    const decision = decideLibraryScan({
      memberType: 'STUDENT',
      openEntryAt: entry,
      lastAcceptedAt: entry,
      now: new Date(entry.getTime() + 2_000),
      ...rules,
    });
    expect(decision.action).toBe('IGNORED');
  });

  it('rejects an exit at 10 seconds and at 59 seconds', () => {
    for (const seconds of [10, 59]) {
      const decision = decideLibraryScan({
        memberType: 'STUDENT',
        openEntryAt: entry,
        lastAcceptedAt: entry,
        now: new Date(entry.getTime() + seconds * 1000),
        ...rules,
      });
      expect(decision.action).toBe('TOO_SOON');
      if (decision.action === 'TOO_SOON') {
        expect(decision.remainingSeconds).toBe(60 - seconds);
      }
    }
  });

  it('allows the exit once 60 seconds have passed', () => {
    expect(
      decideLibraryScan({
        memberType: 'STUDENT',
        openEntryAt: entry,
        lastAcceptedAt: entry,
        now: new Date(entry.getTime() + 60_000),
        ...rules,
      }).action,
    ).toBe('EXIT');
  });

  it('lets staff leave inside the first minute', () => {
    expect(
      decideLibraryScan({
        memberType: 'STAFF',
        openEntryAt: entry,
        lastAcceptedAt: entry,
        now: new Date(entry.getTime() + 10_000),
        ...rules,
      }).action,
    ).toBe('EXIT');
  });

  it('closes only the latest open visit when two sessions are open', () => {
    const older = { id: 'older', entryAt: new Date('2026-10-31T08:00:00') };
    const newer = { id: 'newer', entryAt: new Date('2026-10-31T09:00:00') };
    const rows = [older, newer];
    const active = pickActiveOpenVisit(rows);
    const closing = rows.filter((row) => row.id === active?.id);
    expect(closing).toHaveLength(1);
    expect(closing[0]?.id).toBe('newer');
    expect(
      decideLibraryScan({
        memberType: 'STUDENT',
        openEntryAt: active?.entryAt ?? null,
        lastAcceptedAt: active?.entryAt ?? null,
        now: new Date('2026-10-31T09:02:00'),
        ...rules,
      }).action,
    ).toBe('EXIT');
  });
});
