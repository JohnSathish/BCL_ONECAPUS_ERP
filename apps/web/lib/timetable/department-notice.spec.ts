import { describe, expect, it } from 'vitest';
import type { TimetableEntry, TimetableMatrix } from '../../services/timetable';
import {
  formatNoticeCell,
  noticeSemesterRows,
  saturdayNoticeColumns,
  weekdayNoticeColumns,
} from './department-notice';

function entry(partial: Partial<TimetableEntry>): TimetableEntry {
  return {
    id: partial.id ?? 'e1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '09:50',
    slotType: 'MAJOR',
    ...partial,
  };
}

function matrix(rows: TimetableMatrix['rows']): TimetableMatrix {
  return { days: [], slots: [], rows };
}

describe('department-notice print helpers', () => {
  it('formats major cells as category plus initials', () => {
    expect(
      formatNoticeCell([
        entry({
          fyugpCategory: 'MAJOR',
          course: { code: 'GAR-100', title: 'Garo Major' },
          staffProfile: { shortCode: 'SS', fullName: 'Sengsil Sangma' },
        }),
      ]),
    ).toBe('MAJOR SS');
  });

  it('merges pool faculty initials in one cell', () => {
    expect(
      formatNoticeCell([
        entry({
          fyugpCategory: 'MDC',
          staffProfile: { shortCode: 'BC', fullName: 'Bina Ch Marak' },
          metadata: {
            displayAsCategoryOnly: true,
            facultyTeam: [{ shortCode: 'KA' }],
          },
        }),
      ]),
    ).toBe('MDC BC,KA');
  });

  it('always prints Sem 1, 3 and 5 for odd mode', () => {
    const oddMatrix = matrix([
      {
        id: 'r1',
        dayOfWeek: 1,
        label: 'P1',
        startTime: '09:00',
        endTime: '09:50',
        entries: [entry({ semesterSequence: 5 }), entry({ semesterSequence: 1 })],
      },
    ]);
    expect(noticeSemesterRows(oddMatrix, 'ODD')).toEqual([1, 3, 5]);
  });

  it('uses weekday periods including break, and Saturday teaching columns only', () => {
    const weekMatrix = matrix([
      {
        id: 'm1',
        dayOfWeek: 1,
        label: 'P1',
        startTime: '09:00',
        endTime: '09:50',
        entries: [],
      },
      {
        id: 'b1',
        dayOfWeek: 1,
        label: 'Lunch',
        startTime: '12:10',
        endTime: '12:40',
        isBreak: true,
        isLunch: true,
        entries: [],
      },
      {
        id: 'm2',
        dayOfWeek: 1,
        label: 'P4',
        startTime: '12:40',
        endTime: '13:30',
        entries: [],
      },
      {
        id: 's1',
        dayOfWeek: 6,
        label: 'P1',
        startTime: '09:00',
        endTime: '09:50',
        entries: [],
      },
      {
        id: 's2',
        dayOfWeek: 6,
        label: 'P2',
        startTime: '09:50',
        endTime: '10:40',
        entries: [],
      },
    ]);
    expect(weekdayNoticeColumns(weekMatrix).some((col) => col.isBreak)).toBe(true);
    expect(saturdayNoticeColumns(weekMatrix).map((col) => col.startTime)).toEqual([
      '09:00',
      '09:50',
    ]);
  });
});
