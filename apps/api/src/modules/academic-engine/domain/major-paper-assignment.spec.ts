import {
  assignMajorPaperSlots,
  dedupeMajorPaperRowsByCourse,
  requiredMajorPaperCount,
  resolveMajorPaperForSlot,
  sortMajorPaperRows,
} from './major-paper-assignment';

describe('major-paper-assignment', () => {
  const eco200 = {
    majorPaperIndex: null,
    displayOrder: null,
    courseId: 'course-eco-200',
    course: { code: 'ECO-200' },
  };
  const eco201 = {
    majorPaperIndex: null,
    displayOrder: null,
    courseId: 'course-eco-201',
    course: { code: 'ECO-201' },
  };

  it('returns MAJOR count from categoryCounts', () => {
    expect(requiredMajorPaperCount({ MAJOR: 2, MDC: 1 })).toBe(2);
    expect(requiredMajorPaperCount({ MDC: 1 })).toBe(0);
  });

  it('sorts by majorPaperIndex then course code', () => {
    const sorted = sortMajorPaperRows([
      { ...eco201, majorPaperIndex: 2 },
      { ...eco200, majorPaperIndex: 1 },
      eco200,
    ]);
    expect(sorted.map((r) => r.course.code)).toEqual([
      'ECO-200',
      'ECO-201',
      'ECO-200',
    ]);
  });

  it('assigns unique papers to slots when indices are unset', () => {
    const assigned = assignMajorPaperSlots([eco201, eco200], 2);
    expect(assigned.map((r) => r.course.code)).toEqual(['ECO-200', 'ECO-201']);
  });

  it('skips duplicate course IDs', () => {
    const deduped = dedupeMajorPaperRowsByCourse([eco200, eco200, eco201]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((r) => r.course.code)).toEqual(['ECO-200', 'ECO-201']);
  });

  it('resolves slot 1 then slot 2 without reuse', () => {
    const used = new Set<string>();
    const first = resolveMajorPaperForSlot([eco201, eco200], 0, used);
    expect(first?.course.code).toBe('ECO-200');
    used.add(first!.courseId);
    const second = resolveMajorPaperForSlot([eco201, eco200], 1, used);
    expect(second?.course.code).toBe('ECO-201');
  });
});
