import {
  assignFyugpFirstIaTimetable,
  inferFyugpRoutinePattern,
  normalizeFyugpCategory,
  resolveFyugpSlot,
} from './fyugp-first-ia-routine';

describe('normalizeFyugpCategory', () => {
  it('maps MAJOR family variants', () => {
    expect(normalizeFyugpCategory('MAJOR')).toBe('MAJOR');
    expect(normalizeFyugpCategory('Major 1')).toBe('MAJOR');
    expect(normalizeFyugpCategory('MAJOR_CORE')).toBe('MAJOR');
  });

  it('maps elective families', () => {
    expect(normalizeFyugpCategory('aec')).toBe('AEC');
    expect(normalizeFyugpCategory('MDC-210')).toBe('MDC');
    expect(normalizeFyugpCategory('SEC')).toBe('SEC');
    expect(normalizeFyugpCategory('VAC')).toBe('VAC');
    expect(normalizeFyugpCategory('MINOR')).toBe('MINOR');
  });

  it('returns null for unknown', () => {
    expect(normalizeFyugpCategory('XYZ')).toBeNull();
    expect(normalizeFyugpCategory(null)).toBeNull();
  });
});

describe('inferFyugpRoutinePattern', () => {
  it('detects Morning and Day from shift names', () => {
    expect(inferFyugpRoutinePattern('Morning Shift')).toBe('MORNING');
    expect(inferFyugpRoutinePattern('Day Shift')).toBe('DAY');
    expect(inferFyugpRoutinePattern(undefined)).toBe('DAY');
  });
});

describe('resolveFyugpSlot', () => {
  it('places Sem1 VAC on Saturday morning for Morning pattern', () => {
    expect(resolveFyugpSlot('MORNING', 1, { family: 'VAC' })).toEqual({
      dayOffset: 5,
      startTime: '07:15',
      endTime: '08:00',
    });
  });

  it('places Sem1 VAC on Friday afternoon for Day pattern', () => {
    expect(resolveFyugpSlot('DAY', 1, { family: 'VAC' })).toEqual({
      dayOffset: 4,
      startTime: '13:45',
      endTime: '14:10',
    });
  });

  it('places Sem5 MAJOR 4 on day 3 for Day morning slot', () => {
    expect(
      resolveFyugpSlot('DAY', 5, { family: 'MAJOR', majorIndex: 3 }),
    ).toEqual({
      dayOffset: 3,
      startTime: '09:45',
      endTime: '10:40',
    });
  });
});

describe('assignFyugpFirstIaTimetable', () => {
  const papers = [
    { id: 's1-maj', paperCode: 'MAJ-101', semesterNo: 1, category: 'MAJOR' },
    { id: 's1-min', paperCode: 'MIN-101', semesterNo: 1, category: 'MINOR' },
    { id: 's1-aec', paperCode: 'AEC-101', semesterNo: 1, category: 'AEC' },
    { id: 's1-mdc', paperCode: 'MDC-101', semesterNo: 1, category: 'MDC' },
    { id: 's1-sec', paperCode: 'SEC-101', semesterNo: 1, category: 'SEC' },
    { id: 's1-vac', paperCode: 'VAC-101', semesterNo: 1, category: 'VAC' },
    { id: 's3-m1', paperCode: 'MAJ-201', semesterNo: 3, category: 'MAJOR' },
    { id: 's3-m2', paperCode: 'MAJ-202', semesterNo: 3, category: 'MAJOR' },
    { id: 's5-m1', paperCode: 'MAJ-301', semesterNo: 5, category: 'MAJOR' },
    { id: 's5-m2', paperCode: 'MAJ-302', semesterNo: 5, category: 'MAJOR' },
    { id: 's5-m3', paperCode: 'MAJ-303', semesterNo: 5, category: 'MAJOR' },
    { id: 's5-m4', paperCode: 'MAJ-304', semesterNo: 5, category: 'MAJOR' },
    { id: 's5-min', paperCode: 'MIN-301', semesterNo: 5, category: 'MINOR' },
  ];

  it('assigns Morning pattern including Saturday VAC', () => {
    const { assignments, warnings, maxDayOffset } = assignFyugpFirstIaTimetable(
      papers,
      'MORNING',
    );
    expect(warnings).toEqual([]);
    expect(maxDayOffset).toBe(5);
    const vac = assignments.find((a) => a.paperId === 's1-vac');
    expect(vac).toMatchObject({
      dayOffset: 5,
      startTime: '07:15',
      endTime: '08:00',
    });
    const maj0 = assignments.find((a) => a.paperId === 's5-m1');
    expect(maj0).toMatchObject({ dayOffset: 0, startTime: '07:15' });
    const maj3 = assignments.find((a) => a.paperId === 's5-m4');
    expect(maj3).toMatchObject({ dayOffset: 3 });
  });

  it('assigns Day pattern Sem1 VAC to Friday afternoon', () => {
    const { assignments, maxDayOffset } = assignFyugpFirstIaTimetable(
      papers,
      'DAY',
    );
    expect(maxDayOffset).toBe(4);
    const vac = assignments.find((a) => a.paperId === 's1-vac');
    expect(vac).toMatchObject({
      dayOffset: 4,
      startTime: '13:45',
      endTime: '14:10',
    });
    const sec = assignments.find((a) => a.paperId === 's1-sec');
    expect(sec).toMatchObject({
      dayOffset: 4,
      startTime: '09:45',
      endTime: '10:40',
    });
  });

  it('warns for unmatched category', () => {
    const { assignments, warnings } = assignFyugpFirstIaTimetable(
      [
        {
          id: 'x',
          paperCode: 'OTH-1',
          semesterNo: 1,
          category: 'INTERNSHIP',
        },
      ],
      'DAY',
    );
    expect(assignments).toEqual([]);
    expect(warnings[0]).toContain('OTH-1');
  });
});
