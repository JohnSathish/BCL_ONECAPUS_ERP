import { expandClass12SubjectColumns } from './class12-report-columns';

describe('expandClass12SubjectColumns', () => {
  const columns = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'class12SubjectList', label: 'Class XII Subjects and Marks' },
    { key: 'department', label: 'Department' },
  ];

  it('puts each subject in its own numeric column and leaves missing subjects blank', () => {
    const expanded = expandClass12SubjectColumns(columns, [
      {
        rollNumber: 'BA24-015',
        fullName: 'Student A',
        class12SubjectList: 'English 41, History 30',
        department: 'English',
        class12MarksBySubject: {
          english: { display: 'English', marks: 41, sortOrder: 1 },
          history: { display: 'History', marks: 30, sortOrder: 4 },
          'political science': {
            display: 'Political Science',
            marks: 52,
            sortOrder: 5,
          },
        },
      },
      {
        rollNumber: 'BA24-021',
        fullName: 'Student B',
        department: 'Political Science',
        class12MarksBySubject: {
          english: { display: 'English', marks: 63, sortOrder: 1 },
          education: { display: 'Education', marks: 67, sortOrder: 3 },
          'garo(mil)': { display: 'Garo(MIL)', marks: 70, sortOrder: 2 },
        },
      },
    ]);

    expect(expanded.columns.map((column) => column.label)).toEqual([
      'Roll Number',
      'Full Name',
      'English',
      'Garo(MIL)',
      'Education',
      'History',
      'Political Science',
      'Department',
    ]);
    expect(expanded.rows[0]).toMatchObject({
      rollNumber: 'BA24-015',
      'class12mark:english': 41,
      'class12mark:history': 30,
      'class12mark:political science': 52,
      'class12mark:education': '',
      'class12mark:garo(mil)': '',
    });
    expect(expanded.rows[0]).not.toHaveProperty('class12SubjectList');
    expect(expanded.rows[1]?.['class12mark:education']).toBe(67);
    expect(expanded.rows[1]?.['class12mark:history']).toBe('');
  });

  it('keeps a zero mark and drops the combined column when nobody has subjects', () => {
    const withZero = expandClass12SubjectColumns(
      [{ key: 'class12SubjectList', label: 'Class XII Subjects and Marks' }],
      [
        {
          class12MarksBySubject: {
            english: { display: 'English', marks: 0, sortOrder: 1 },
          },
        },
      ],
    );
    expect(withZero.rows[0]?.['class12mark:english']).toBe(0);

    const empty = expandClass12SubjectColumns(columns, [
      { rollNumber: 'BA24-001', class12SubjectList: '' },
    ]);
    expect(empty.columns.map((column) => column.key)).toEqual([
      'rollNumber',
      'fullName',
      'department',
    ]);
  });

  it('leaves reports that do not ask for Class XII marks unchanged', () => {
    const rows = [{ rollNumber: 'BA24-001' }];
    const same = expandClass12SubjectColumns(
      [{ key: 'rollNumber', label: 'Roll Number' }],
      rows,
    );
    expect(same.columns).toEqual([{ key: 'rollNumber', label: 'Roll Number' }]);
    expect(same.rows).toBe(rows);
  });
});
