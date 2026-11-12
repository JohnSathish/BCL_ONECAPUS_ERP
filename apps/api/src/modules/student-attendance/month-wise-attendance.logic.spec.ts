import {
  attendanceBandCounts,
  attendanceTone,
  listMonthColumns,
  matchesOverallPercentage,
  percentageFilterForBand,
  summarizeMonthWise,
} from './month-wise-attendance.logic';

describe('month-wise attendance', () => {
  const months = listMonthColumns('2026-01', '2026-04');

  function marksFor(
    studentId: string,
    counts: Array<[month: string, attended: number, conducted: number]>,
  ) {
    const marks = [];
    for (const [month, attended, conducted] of counts) {
      for (let index = 0; index < conducted; index += 1) {
        marks.push({
          studentId,
          monthKey: month,
          classKey: `${month}-${index}`,
          status: index < attended ? 'P' : 'A',
        });
      }
    }
    return marks;
  }

  it('lists one column per month in the selected range', () => {
    expect(months.map((column) => column.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('rejects a range longer than a year', () => {
    expect(() => listMonthColumns('2026-01', '2027-02')).toThrow(/12 months/);
  });

  it('calculates overall from totals, not the average of monthly percentages', () => {
    const marks = marksFor('student-a', [
      ['2026-01', 18, 20],
      ['2026-02', 16, 20],
      ['2026-03', 19, 22],
      ['2026-04', 17, 20],
    ]);
    const report = summarizeMonthWise({
      months,
      marks,
      conductedKeys: marks.map((mark) => ({
        monthKey: mark.monthKey,
        classKey: mark.classKey,
      })),
    });
    const row = report.rows[0];
    expect(row.months.map((month) => month.display)).toEqual([
      '18/20 (90%)',
      '16/20 (80%)',
      '19/22 (86.36%)',
      '17/20 (85%)',
    ]);
    expect(row.overall.display).toBe('70/82 (85.37%)');
    expect(row.overall.percentage).toBeCloseTo((70 / 82) * 100, 8);
    expect(report.totalConducted).toBe(82);
  });

  it('shows N/A for a month with no marks and leaves that month out of the total', () => {
    const marks = marksFor('student-b', [['2026-03', 10, 10]]);
    const report = summarizeMonthWise({
      months,
      marks,
      conductedKeys: [],
    });
    const row = report.rows[0];
    expect(row.months[0].display).toBe('N/A');
    expect(row.months[0].percentage).toBeNull();
    expect(row.overall.display).toBe('10/10 (100%)');
  });

  it('counts a repeated class once', () => {
    const report = summarizeMonthWise({
      months: listMonthColumns('2026-01', '2026-01'),
      marks: [
        { studentId: 's', monthKey: '2026-01', classKey: 'day-1', status: 'P' },
        { studentId: 's', monthKey: '2026-01', classKey: 'day-1', status: 'A' },
      ],
      conductedKeys: [{ monthKey: '2026-01', classKey: 'day-1' }],
    });
    expect(report.rows[0].overall.display).toBe('1/1 (100%)');
    expect(report.months[0].conducted).toBe(1);
  });

  it('does not treat an exempted class as conducted', () => {
    const report = summarizeMonthWise({
      months: listMonthColumns('2026-01', '2026-01'),
      marks: [
        {
          studentId: 's',
          monthKey: '2026-01',
          classKey: 'day-1',
          status: 'EXEMPTED',
        },
      ],
      conductedKeys: [],
    });
    expect(report.rows[0].overall.display).toBe('N/A');
  });

  it('colours the shortage bands from the raw percentage', () => {
    expect(attendanceTone(49.99)).toBe('red');
    expect(attendanceTone(50)).toBe('light-red');
    expect(attendanceTone(59.996)).toBe('light-red');
    expect(attendanceTone(60)).toBe('orange');
    expect(attendanceTone(74.996)).toBe('orange');
    expect(attendanceTone(75)).toBe('green');
    expect(attendanceTone(null)).toBe('muted');
  });

  it('keeps a student just under 60 in the below-60 filter', () => {
    const below60 = percentageFilterForBand('below-60');
    expect(matchesOverallPercentage(59.996, below60)).toBe(true);
    expect(matchesOverallPercentage(60, below60)).toBe(false);
    expect(matchesOverallPercentage(null, below60)).toBe(false);
    expect(
      matchesOverallPercentage(75, percentageFilterForBand('at-least-75')),
    ).toBe(true);
    expect(
      matchesOverallPercentage(75, percentageFilterForBand('above-75')),
    ).toBe(false);
    expect(
      matchesOverallPercentage(40, percentageFilterForBand('custom', 40, 60)),
    ).toBe(true);
    expect(
      matchesOverallPercentage(
        60.01,
        percentageFilterForBand('custom', 40, 60),
      ),
    ).toBe(false);
  });

  it('counts each shortage band from the raw percentage', () => {
    expect(attendanceBandCounts([49.9, 59.996, 60, 74.996, 75, null])).toEqual({
      students: 6,
      below50: 1,
      below60: 2,
      below75: 4,
      atLeast75: 1,
      unmarked: 1,
    });
  });
});
