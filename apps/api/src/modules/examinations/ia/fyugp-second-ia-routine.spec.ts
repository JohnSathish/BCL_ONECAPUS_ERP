import {
  assignFyugpSecondIaTimetable,
  buildFyugpSecondIaDayNotice,
} from './fyugp-second-ia-routine';

describe('buildFyugpSecondIaDayNotice', () => {
  it('matches the Day Shift notice for 12–16 October 2026', () => {
    const rows = buildFyugpSecondIaDayNotice('2026-10-12');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      dateLabel: '12-10-2026',
      dayLabel: 'MONDAY',
      timingLabel: 'AFTERNOON 1:00-2:15',
      sem1: 'MDC',
      sem3: 'AEC',
      sem5: 'MINOR 302',
    });
    expect(rows[1]).toMatchObject({
      dateLabel: '13-10-2026',
      dayLabel: 'TUESDAY',
      timingLabel: 'MORNING 9:45-11:00',
      sem1: 'AEC',
      sem3: '--------',
      sem5: '--------',
    });
    expect(rows[2]).toMatchObject({
      timingLabel: 'AFTERNOON 1:00-2:15',
      sem1: 'SEC',
      sem3: 'MDC',
      sem5: '--------',
    });
    expect(rows[3]).toMatchObject({
      dateLabel: '14-10-2026',
      dayLabel: 'WEDNESDAY',
      sem1: 'VAC',
      sem3: 'SEC',
      sem5: 'MAJOR 300',
    });
    expect(rows[4]).toMatchObject({
      dateLabel: '15-10-2026',
      sem1: 'MINOR 100',
      sem3: 'MAJOR 200',
      sem5: 'MAJOR 301',
    });
    expect(rows[5]).toMatchObject({
      dateLabel: '16-10-2026',
      dayLabel: 'FRIDAY',
      sem1: 'MAJOR 100',
      sem3: 'MAJOR 201',
      sem5: 'MAJOR 302',
    });
  });
});

describe('assignFyugpSecondIaTimetable', () => {
  it('places each department major on the printed day', () => {
    const { assignments, warnings } = assignFyugpSecondIaTimetable([
      { id: 'bot300', paperCode: 'BOT-300', semesterNo: 5, category: 'MAJOR' },
      { id: 'bot301', paperCode: 'BOT-301', semesterNo: 5, category: 'MAJOR' },
      { id: 'bot302m', paperCode: 'BOT-302', semesterNo: 5, category: 'MAJOR' },
      { id: 'bot302n', paperCode: 'BOT-302', semesterNo: 5, category: 'MINOR' },
      { id: 'aec1', paperCode: 'AEC-120', semesterNo: 1, category: 'AEC' },
      { id: 'sec1', paperCode: 'SEC-131', semesterNo: 1, category: 'SEC' },
    ]);
    expect(warnings).toEqual([]);
    expect(assignments.find((a) => a.paperId === 'bot302n')).toMatchObject({
      dayOffset: 0,
      startTime: '13:00',
      endTime: '14:15',
      label: 'MINOR 302',
    });
    expect(assignments.find((a) => a.paperId === 'bot300')).toMatchObject({
      dayOffset: 2,
      label: 'MAJOR 300',
    });
    expect(assignments.find((a) => a.paperId === 'bot301')).toMatchObject({
      dayOffset: 3,
      label: 'MAJOR 301',
    });
    expect(assignments.find((a) => a.paperId === 'bot302m')).toMatchObject({
      dayOffset: 4,
      label: 'MAJOR 302',
    });
    expect(assignments.find((a) => a.paperId === 'aec1')).toMatchObject({
      dayOffset: 1,
      startTime: '09:45',
      endTime: '11:00',
    });
    expect(assignments.find((a) => a.paperId === 'sec1')).toMatchObject({
      dayOffset: 1,
      startTime: '13:00',
    });
  });

  it('keeps duplicate offerings of the same major code on one day', () => {
    const { assignments, warnings } = assignFyugpSecondIaTimetable([
      { id: 'a', paperCode: 'COM-200', semesterNo: 3, category: 'MAJOR' },
      { id: 'b', paperCode: 'COM-201', semesterNo: 3, category: 'MAJOR' },
      { id: 'c', paperCode: 'COM-201', semesterNo: 3, category: 'MAJOR' },
    ]);
    expect(warnings).toEqual([]);
    expect(assignments.find((a) => a.paperId === 'b')?.dayOffset).toBe(4);
    expect(assignments.find((a) => a.paperId === 'c')?.dayOffset).toBe(4);
  });
});
