import {
  pickMarkedRows,
  sessionCountsForCurrentSemester,
} from './attendance-portal.util';

describe('sessionCountsForCurrentSemester', () => {
  const registeredCourseIds = new Set(['eng-course']);
  const registeredSectionIds = new Set(['eng-section']);

  it('includes a class already stored on the current semester', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: 3,
        sessionSemester: 3,
      }),
    ).toBe(true);
  });

  it('includes a semester 1 session when the subject group is semester 3', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: 3,
        sessionSemester: 1,
        groupSemester: 3,
      }),
    ).toBe(true);
  });

  it('includes a session for a course the student is registered for', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: 3,
        sessionSemester: 1,
        courseId: 'eng-course',
        registeredCourseIds,
      }),
    ).toBe(true);
  });

  it('includes a session for the student section even when the semester number differs', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: 3,
        sessionSemester: 1,
        offeringSectionId: 'eng-section',
        registeredSectionIds,
      }),
    ).toBe(true);
  });

  it('leaves an unrelated older semester out of the current register', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: 3,
        sessionSemester: 1,
        courseId: 'other-course',
        registeredCourseIds,
      }),
    ).toBe(false);
  });

  it('keeps every marked class when the current semester is unknown', () => {
    expect(
      sessionCountsForCurrentSemester({
        currentSemester: null,
        sessionSemester: 1,
      }),
    ).toBe(true);
  });
});

describe('pickMarkedRows', () => {
  it('keeps the live class when a duplicate session was removed', () => {
    const rows = pickMarkedRows([
      { key: 'day-1', deleted: true, status: 'P' },
      { key: 'day-1', deleted: false, status: 'A' },
    ]);
    expect(rows).toEqual([{ key: 'day-1', deleted: false, status: 'A' }]);
  });

  it('keeps a removed session when it is the only marked copy', () => {
    const rows = pickMarkedRows([{ key: 'day-1', deleted: true, status: 'P' }]);
    expect(rows).toEqual([{ key: 'day-1', deleted: true, status: 'P' }]);
  });
});
