import {
  buildProgramVersionDepartmentMap,
  resolveDepartmentIdForProgramVersion,
} from '@/components/students-module/add-student/utils/program-department-map';
import type { Program } from '@/types/programs';

describe('program-department-map', () => {
  const programs: Program[] = [
    {
      id: 'prog-1',
      code: 'BA-ECO',
      name: 'BA Economics',
      departmentId: 'dept-eco',
      department: { id: 'dept-eco', name: 'Economics', code: 'ECO' },
      versions: [
        { id: 'pv-1', programId: 'prog-1', version: 1, status: 'PUBLISHED', cbcsEnabled: true },
        { id: 'pv-draft', programId: 'prog-1', version: 2, status: 'DRAFT', cbcsEnabled: true },
      ],
    },
  ];

  it('maps published versions to programme department', () => {
    const map = buildProgramVersionDepartmentMap(programs);
    expect(map['pv-1']).toBe('dept-eco');
    expect(map['pv-draft']).toBeUndefined();
  });

  it('resolves department id for selected programme version', () => {
    const map = buildProgramVersionDepartmentMap(programs);
    expect(resolveDepartmentIdForProgramVersion('pv-1', map)).toBe('dept-eco');
    expect(resolveDepartmentIdForProgramVersion('missing', map)).toBeUndefined();
  });
});
