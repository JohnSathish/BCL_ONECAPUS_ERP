import type { CatalogSectionRow } from '@/types/academic-engine';
import {
  electiveSlotBadge,
  expectedVtcStageForSemester,
  filterVtcSectionsForTrack,
} from '@/utils/vtc-track-utils';

function section(group: string, stage: number): CatalogSectionRow {
  return {
    id: `${group}-${stage}`,
    sectionCode: 'A',
    capacity: 30,
    waitlistCapacity: 0,
    shift: { id: 'shift-1', code: 'DAY', name: 'Day' },
    courseOffering: {
      id: `off-${group}-${stage}`,
      category: 'VTC',
      semesterSequence: 4,
      course: {
        code: `VTC-${group}`,
        title: 'VTC',
        credits: 2,
        vtcTrackGroupCode: group,
        vtcTrackStage: stage,
      },
    },
  };
}

describe('vtc-track-utils', () => {
  it('maps semester to VTC stage', () => {
    expect(expectedVtcStageForSemester(3)).toBe(1);
    expect(expectedVtcStageForSemester(4)).toBe(2);
    expect(expectedVtcStageForSemester(6)).toBe(3);
    expect(expectedVtcStageForSemester(5)).toBeNull();
  });

  it('filters VTC sections by locked track in semester 4', () => {
    const rows = [section('243.2', 2), section('263.2', 2), section('243.2', 1)];
    const filtered = filterVtcSectionsForTrack(rows, 4, '243.2');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.courseOffering.course.vtcTrackGroupCode).toBe('243.2');
  });

  it('returns semester choice badge for flexible electives', () => {
    expect(electiveSlotBadge('MDC', 2)).toBe('Semester choice');
    expect(electiveSlotBadge('VTC', 4, { vtcTrackGroupCode: '243.2' })).toContain(
      'Continuing Track',
    );
  });
});
