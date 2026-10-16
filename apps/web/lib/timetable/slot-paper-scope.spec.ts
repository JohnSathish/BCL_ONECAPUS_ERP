import { describe, expect, it } from 'vitest';
import {
  courseMatchesTimetableDepartment,
  departmentsForSlotScope,
  findDepartmentForStream,
  isDepartmentScopedTimetableCategory,
  slotStreamScope,
  timetableOfferingCategory,
} from './slot-paper-scope';

const departments = [
  { id: 'bot', name: 'Department of Botany', code: 'BOT' },
  { id: 'che', name: 'Chemistry', code: 'CHE' },
];

describe('slot paper scope', () => {
  it('keeps major and lab on the timetable department', () => {
    expect(isDepartmentScopedTimetableCategory('MAJOR')).toBe(true);
    expect(isDepartmentScopedTimetableCategory('LAB')).toBe(true);
    expect(isDepartmentScopedTimetableCategory('AEC')).toBe(false);
    expect(isDepartmentScopedTimetableCategory('MINOR')).toBe(false);
  });

  it('maps offering categories and leaves lab unset', () => {
    expect(timetableOfferingCategory('major')).toBe('MAJOR');
    expect(timetableOfferingCategory('LAB')).toBeUndefined();
  });

  it('keeps Botany semester papers and leaves other departments out', () => {
    const botany = departments[0]!;
    expect(courseMatchesTimetableDepartment({ code: 'BOT-301', departmentId: 'bot' }, botany)).toBe(
      true,
    );
    expect(courseMatchesTimetableDepartment({ code: 'BOT-301', departmentId: null }, botany)).toBe(
      true,
    );
    expect(courseMatchesTimetableDepartment({ code: 'AEC-224', departmentId: 'hin' }, botany)).toBe(
      false,
    );
    expect(courseMatchesTimetableDepartment({ code: 'BOT-301', departmentId: 'che' }, botany)).toBe(
      false,
    );
    expect(courseMatchesTimetableDepartment({ code: 'CHE-301', departmentId: 'che' }, botany)).toBe(
      false,
    );
  });

  it('matches a stream to its department', () => {
    expect(findDepartmentForStream(departments, 'Botany', 'BOTANY')?.id).toBe('bot');
    expect(findDepartmentForStream(departments, 'Chemistry', 'CHE')?.id).toBe('che');
  });

  it('limits a faculty timetable to its own departments', () => {
    expect(
      slotStreamScope({
        streamId: 'commerce',
        streams: [
          { id: 'commerce', code: 'COMMERCE', name: 'Commerce', departments: ['COMMERCE'] },
        ],
      }),
    ).toEqual({
      streamName: 'Commerce',
      streamCode: 'COMMERCE',
      departmentNames: ['COMMERCE'],
    });
    expect(
      slotStreamScope({
        streamId: 'science',
        streams: [
          { id: 'science', code: 'SCIENCE', name: 'Science', departments: ['Botany', 'Chemistry'] },
        ],
      }).departmentNames,
    ).toEqual(['Botany', 'Chemistry']);
    expect(
      slotStreamScope({
        streamId: 'bot',
        streams: [{ id: 'bot', code: 'BOT', name: 'Botany', departments: [] }],
      }),
    ).toEqual({ streamName: 'Botany', streamCode: 'BOT' });
  });

  it('keeps Commerce major papers and leaves other departments out', () => {
    const catalog = [...departments, { id: 'com', name: 'Department of Commerce', code: 'COM' }];
    const matched = departmentsForSlotScope(catalog, {
      streamName: 'Commerce',
      streamCode: 'COMMERCE',
      departmentNames: ['COMMERCE'],
    });
    expect(matched.map((department) => department.id)).toEqual(['com']);
    const commerce = matched[0]!;
    expect(
      courseMatchesTimetableDepartment({ code: 'COM-100', departmentId: 'com' }, commerce),
    ).toBe(true);
    expect(
      courseMatchesTimetableDepartment({ code: 'BOT-100', departmentId: 'bot' }, commerce),
    ).toBe(false);
    expect(
      courseMatchesTimetableDepartment({ code: 'ENG-100', departmentId: null }, commerce),
    ).toBe(false);
  });
});
