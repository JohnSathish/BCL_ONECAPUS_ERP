import {
  buildNoticeboardRowsFromPapers,
  buildNoticeboardRowsFromPlan,
} from './ia-noticeboard-grid';

describe('buildNoticeboardRowsFromPlan', () => {
  it('builds Morning First IA grid like the printed notice', () => {
    const rows = buildNoticeboardRowsFromPlan('2026-08-24', 'MORNING');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      dateLabel: '24-08-2026',
      dayLabel: 'MONDAY',
      timingLabel: 'MORNING 7:15-8:00',
      sem1: 'MAJOR',
      sem3: 'MAJOR 1',
      sem5: 'MAJOR 1',
    });
    expect(rows[5]).toMatchObject({
      dateLabel: '29-08-2026',
      dayLabel: 'SATURDAY',
      sem1: 'VAC',
      sem3: '--------',
      sem5: '--------',
    });
  });

  it('builds Day Shift with Friday SEC morning and VAC afternoon (12-hour times)', () => {
    const rows = buildNoticeboardRowsFromPlan('2026-08-24', 'DAY');
    expect(rows).toHaveLength(6);
    expect(rows[0].timingLabel).toBe('MORNING 9:45-10:40');
    expect(rows[4]).toMatchObject({
      dateLabel: '28-08-2026',
      dayLabel: 'FRIDAY',
      timingLabel: 'MORNING 9:45-10:40',
      sem1: 'SEC',
      sem3: 'SEC',
      sem5: 'MINOR',
    });
    expect(rows[5]).toMatchObject({
      dateLabel: '28-08-2026',
      dayLabel: 'FRIDAY',
      timingLabel: '1:45-2:10',
      sem1: 'VAC',
      sem3: '--------',
      sem5: '--------',
    });
  });
});

describe('buildNoticeboardRowsFromPapers', () => {
  it('pivots scheduled papers into semester columns', () => {
    const rows = buildNoticeboardRowsFromPapers(
      [
        {
          id: '1',
          paperCode: 'ECO-100',
          semesterNo: 1,
          category: 'MAJOR',
          examDate: '2026-08-24',
          startTime: '07:15',
          endTime: '08:00',
        },
        {
          id: '2',
          paperCode: 'ECO-200',
          semesterNo: 3,
          category: 'MAJOR',
          examDate: '2026-08-24',
          startTime: '07:15',
          endTime: '08:00',
        },
        {
          id: '3',
          paperCode: 'ECO-201',
          semesterNo: 3,
          category: 'MAJOR',
          examDate: '2026-08-25',
          startTime: '07:15',
          endTime: '08:00',
        },
      ],
      'MORNING',
    );
    expect(rows[0].sem1).toBe('MAJOR');
    expect(rows[0].sem3).toBe('MAJOR 1');
    expect(rows[1].sem3).toBe('MAJOR 2');
  });
});
