import { describe, expect, it } from 'vitest';
import {
  courseMatchesTimetableDepartment,
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

  it('does not lock a faculty group that contains many departments', () => {
    expect(
      slotStreamScope({
        streamId: 'science',
        streams: [
          { id: 'science', code: 'SCIENCE', name: 'Science', departments: ['Botany', 'Chemistry'] },
          { id: 'bot', code: 'BOT', name: 'Botany', departments: [] },
        ],
      }),
    ).toEqual({});
    expect(
      slotStreamScope({
        streamId: 'bot',
        streams: [{ id: 'bot', code: 'BOT', name: 'Botany', departments: [] }],
      }),
    ).toEqual({ streamName: 'Botany', streamCode: 'BOT' });
  });
});
