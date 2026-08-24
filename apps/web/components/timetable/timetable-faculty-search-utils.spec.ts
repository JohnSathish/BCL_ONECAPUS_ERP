import { describe, expect, it } from 'vitest';

import {
  compareTimetableFacultyMatches,
  matchesTimetableFaculty,
} from './timetable-faculty-search-utils';

const faculty = {
  chichi: { fullName: 'Chichi Ch Sangma', shortCode: 'CS', employeeCode: 'CT001' },
  colnat: { fullName: 'DR. COLNAT B MARAK', shortCode: 'CB', employeeCode: 'CT002' },
  target: { fullName: 'Catherine T Sangma', shortCode: 'CT', employeeCode: 'EMP88' },
  prefix: { fullName: 'Cynthia Tariang', shortCode: 'CTS', employeeCode: 'T100' },
};

describe('matchesTimetableFaculty', () => {
  it('matches staff short codes exactly for two-letter searches', () => {
    expect(matchesTimetableFaculty(faculty.target, 'CT')).toBe(true);
    expect(matchesTimetableFaculty(faculty.target, 'ct')).toBe(true);
  });

  it('does not treat employee codes like CT001 as a short-code hit for CT', () => {
    expect(matchesTimetableFaculty(faculty.chichi, 'CT')).toBe(false);
    expect(matchesTimetableFaculty(faculty.colnat, 'CT')).toBe(false);
  });

  it('still allows name searches and longer employee-code prefixes', () => {
    expect(matchesTimetableFaculty(faculty.chichi, 'Chichi')).toBe(true);
    expect(matchesTimetableFaculty(faculty.chichi, 'CT001')).toBe(true);
    expect(matchesTimetableFaculty(faculty.prefix, 'CT')).toBe(true);
  });
});

describe('compareTimetableFacultyMatches', () => {
  it('ranks exact short codes ahead of prefix matches', () => {
    const sorted = [faculty.prefix, faculty.target].sort(compareTimetableFacultyMatches('CT'));
    expect(sorted.map((row) => row.shortCode)).toEqual(['CT', 'CTS']);
  });
});
