import type { CurriculumOfferingRow } from '@/types/curriculum-filters';

import {
  buildInitialPanelFilters,
  groupCurriculumRowsBySemesterAndCategory,
  resolveSmartDefaults,
  toggleQuickChip,
} from './curriculum-row-select-utils';

function mockRow(
  partial: Omit<Partial<CurriculumOfferingRow>, 'course'> & {
    id: string;
    course: { code: string; title: string; credits?: number };
  },
): CurriculumOfferingRow {
  return {
    programVersionId: 'pv-1',
    courseId: 'c-1',
    isElective: false,
    sections: [],
    ...partial,
    course: {
      id: 'course-1',
      courseType: 'CORE',
      credits: partial.course.credits ?? 4,
      code: partial.course.code,
      title: partial.course.title,
    },
  } as CurriculumOfferingRow;
}

describe('resolveSmartDefaults', () => {
  it('prefers mapping form values over URL filters', () => {
    expect(
      resolveSmartDefaults(
        { programVersionId: 'pv-form', category: 'MAJOR', semesterSequence: 3 },
        { programVersionId: 'pv-url', categories: ['MINOR'], semesters: [5] },
      ),
    ).toEqual({
      programVersionId: 'pv-form',
      category: 'MAJOR',
      semesterSequence: 3,
    });
  });

  it('falls back to URL filters when mapping form is empty', () => {
    expect(
      resolveSmartDefaults(
        { programVersionId: '', category: undefined, semesterSequence: undefined },
        { programVersionId: 'pv-url', categories: ['AEC'], semesters: [2] },
      ),
    ).toEqual({
      programVersionId: 'pv-url',
      category: 'AEC',
      semesterSequence: 2,
    });
  });
});

describe('buildInitialPanelFilters', () => {
  it('applies smart defaults when show all is off', () => {
    expect(
      buildInitialPanelFilters(
        { programVersionId: 'pv-1', category: 'MAJOR', semesterSequence: 3 },
        false,
      ),
    ).toEqual({
      search: '',
      category: 'MAJOR',
      semester: '3',
      programVersionId: 'pv-1',
      quickToggle: '',
      facultyAssigned: undefined,
    });
  });

  it('widens filters when show all is on', () => {
    expect(
      buildInitialPanelFilters(
        { programVersionId: 'pv-1', category: 'MAJOR', semesterSequence: 3 },
        true,
      ),
    ).toEqual({
      search: '',
      category: '',
      semester: '',
      programVersionId: 'pv-1',
      quickToggle: '',
      facultyAssigned: undefined,
    });
  });
});

describe('groupCurriculumRowsBySemesterAndCategory', () => {
  it('groups rows by semester then category in NEP order', () => {
    const rows = [
      mockRow({
        id: 'a',
        category: 'MDC',
        semesterSequence: 3,
        course: { code: 'MDC-210', title: 'Earth Sciences' },
      }),
      mockRow({
        id: 'b',
        category: 'MAJOR',
        semesterSequence: 3,
        course: { code: 'ECO-200', title: 'Economics' },
      }),
      mockRow({
        id: 'c',
        category: 'MAJOR',
        semesterSequence: 3,
        course: { code: 'ECO-201', title: 'Math Methods' },
      }),
    ];

    const grouped = groupCurriculumRowsBySemesterAndCategory(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.semester).toBe(3);
    expect(grouped[0]?.categories.map((g) => g.category)).toEqual(['MAJOR', 'MDC']);
    expect(grouped[0]?.categories[0]?.rows.map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('toggleQuickChip', () => {
  it('activates and deactivates shared pool quick filter', () => {
    const base = buildInitialPanelFilters({}, true);
    const activated = toggleQuickChip(
      { id: 'SHARED_POOLS', label: 'Shared Pools', kind: 'quickToggle', value: 'SHARED_POOLS' },
      base,
    );
    expect(activated.quickToggle).toBe('SHARED_POOLS');

    const deactivated = toggleQuickChip(
      { id: 'SHARED_POOLS', label: 'Shared Pools', kind: 'quickToggle', value: 'SHARED_POOLS' },
      activated,
    );
    expect(deactivated.quickToggle).toBe('');
  });
});
