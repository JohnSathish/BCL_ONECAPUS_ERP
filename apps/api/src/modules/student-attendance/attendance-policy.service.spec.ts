import { AttendancePolicyService } from './attendance-policy.service';

function service() {
  return new AttendancePolicyService({} as any);
}

describe('AttendancePolicyService collection modes', () => {
  const entries = [
    {
      id: 'e1',
      periodNo: 1,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '09:00',
    },
    {
      id: 'e2',
      periodNo: 2,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '09:45',
    },
    {
      id: 'e3',
      periodNo: 3,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '10:45',
    },
    {
      id: 'e4',
      periodNo: 4,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '11:30',
    },
    {
      id: 'e5',
      periodNo: 5,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '13:00',
    },
    {
      id: 'e6',
      periodNo: 6,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '13:45',
    },
    {
      id: 'b1',
      periodNo: 0,
      planId: 'plan-a',
      shiftId: 'shift-day',
      sectionCode: 'A',
      offeringSectionId: 'sec-1',
      startTime: '12:15',
      isBreak: true,
      slotType: 'LUNCH',
    },
  ];

  it('aliases EVERY_PERIOD to PERIOD_WISE', () => {
    const s = service();
    expect(s.canonicalMode('EVERY_PERIOD')).toBe('PERIOD_WISE');
    expect(s.canonicalMode('PERIOD_WISE')).toBe('PERIOD_WISE');
    expect(s.isPeriodAggregationMode('EVERY_PERIOD')).toBe(true);
  });

  it('PERIOD_WISE / EVERY_PERIOD generates all teaching periods', () => {
    const s = service();
    const resolved = s.resolveCountableEntries('PERIOD_WISE', entries);
    expect(resolved.map((r) => r.entry.id)).toEqual([
      'e1',
      'e2',
      'e3',
      'e4',
      'e5',
      'e6',
    ]);
    expect(resolved.every((r) => r.collectionUnit === 'PERIOD')).toBe(true);
  });

  it('ONCE_PER_DAY keeps only first period per cohort', () => {
    const s = service();
    const resolved = s.resolveCountableEntries('ONCE_PER_DAY', entries);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].entry.id).toBe('e1');
    expect(resolved[0].collectionUnit).toBe('DAY');
  });

  it('ONCE_PER_DAY creates one session per section cohort', () => {
    const s = service();
    const withB = [
      ...entries,
      {
        id: 'b-first',
        periodNo: 1,
        planId: 'plan-a',
        shiftId: 'shift-day',
        sectionCode: 'B',
        offeringSectionId: 'sec-b',
        startTime: '09:00',
      },
      {
        id: 'b-second',
        periodNo: 2,
        planId: 'plan-a',
        shiftId: 'shift-day',
        sectionCode: 'B',
        offeringSectionId: 'sec-b',
        startTime: '09:45',
      },
    ];
    const resolved = s.resolveCountableEntries('ONCE_PER_DAY', withB);
    expect(resolved.map((r) => r.entry.id).sort()).toEqual(['b-first', 'e1']);
  });

  it('MORNING_AFTERNOON picks earliest AM and PM around lunch gap', () => {
    const s = service();
    const resolved = s.resolveCountableEntries('MORNING_AFTERNOON', entries);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((r) => r.collectionUnit)).toEqual([
      'MORNING',
      'AFTERNOON',
    ]);
    expect(resolved[0].entry.id).toBe('e1');
    expect(resolved[1].entry.id).toBe('e5');
  });

  it('FIRST_LAST counts only first and last teaching periods', () => {
    const s = service();
    const resolved = s.resolveCountableEntries('FIRST_LAST', entries);
    expect(resolved.map((r) => r.entry.id)).toEqual(['e1', 'e6']);
  });

  it('unit labels adapt by mode', () => {
    const s = service();
    expect(s.unitLabels('ONCE_PER_DAY').working).toBe('Working Days');
    expect(s.unitLabels('MORNING_AFTERNOON').working).toBe('Working Sessions');
    expect(s.unitLabels('PERIOD_WISE').working).toBe('Working Periods');
  });

  it('isEntryCountable respects collectionUnit tags in day mode', () => {
    const s = service();
    expect(
      s.isEntryCountable({
        mode: 'ONCE_PER_DAY',
        periodNo: 1,
        teachingPeriodNos: [1, 2, 3],
        collectionUnit: 'DAY',
      }),
    ).toBe(true);
    expect(
      s.isEntryCountable({
        mode: 'ONCE_PER_DAY',
        periodNo: 2,
        teachingPeriodNos: [1, 2, 3],
        collectionUnit: 'PERIOD',
      }),
    ).toBe(false);
  });

  it('day percentage formula PresentDays / WorkingDays', () => {
    const presentDays = 18;
    const workingDays = 20;
    const percentage = Math.round((presentDays / workingDays) * 10000) / 100;
    expect(percentage).toBe(90);
  });
});
