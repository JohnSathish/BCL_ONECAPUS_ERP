import type { CatalogSectionRow } from '@/types/academic-engine';
import { bindAutoAssignedSelections } from '@/components/students-module/add-student/utils/subject-basket';

describe('bindAutoAssignedSelections', () => {
  const catalog: CatalogSectionRow[] = [
    {
      id: 'sec-eco-200',
      sectionCode: 'A',
      capacity: 80,
      waitlistCapacity: 0,
      shift: { id: 'shift-1', code: 'DAY', name: 'Day' },
      courseOffering: {
        id: 'off-eco-200',
        category: 'MAJOR',
        semesterSequence: 3,
        majorPaperIndex: null,
        course: { code: 'ECO-200', title: 'Economics of Growth and Development', credits: 4 },
      },
    },
    {
      id: 'sec-eco-201',
      sectionCode: 'A',
      capacity: 80,
      waitlistCapacity: 0,
      shift: { id: 'shift-1', code: 'DAY', name: 'Day' },
      courseOffering: {
        id: 'off-eco-201',
        category: 'MAJOR',
        semesterSequence: 3,
        majorPaperIndex: null,
        course: { code: 'ECO-201', title: 'Mathematical Methods for Economics - I', credits: 4 },
      },
    },
  ];

  it('assigns two unique MAJOR sections for Economics Sem 3', () => {
    const selections = bindAutoAssignedSelections(
      {},
      ['MAJOR-1', 'MAJOR-2'],
      catalog,
      {
        categoryCounts: { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 },
        major: [],
        minor: [],
        structureRules: [],
        semesterRule: {
          categoryCounts: { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 },
        },
      } as never,
      'economics',
      '',
      3,
    );

    expect(selections['MAJOR-1']).toBe('sec-eco-200');
    expect(selections['MAJOR-2']).toBe('sec-eco-201');
    expect(new Set([selections['MAJOR-1'], selections['MAJOR-2']]).size).toBe(2);
  });
});
