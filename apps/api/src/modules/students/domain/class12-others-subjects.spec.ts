import {
  OTHERS_ARTS_SUBJECTS,
  OTHERS_COMMERCE_SUBJECTS,
  OTHERS_SCIENCE_SUBJECTS,
  othersSubjectsForStream,
} from './class12-others-subjects';

describe('Others Class XII subjects', () => {
  it('loads the Assam commerce papers for Others + Commerce', () => {
    const names = othersSubjectsForStream('COMMERCE').map(
      (row) => row.subjectName,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'English',
        'MIL (Garo)',
        'Business Studies',
        'Finance',
        'Economics',
        'Accountancy',
      ]),
    );
    expect(names).not.toContain('Education');
    expect(names).not.toContain('Physics');
  });

  it('keeps Arts subjects, including English and Hindi, off the commerce list', () => {
    const arts = OTHERS_ARTS_SUBJECTS.map((row) => row.subjectName);
    expect(arts).toEqual(
      expect.arrayContaining([
        'English',
        'Hindi',
        'Economics',
        'Education',
        'Geography',
        'History',
        'Political Science',
        'Sociology',
        'Logic and Philosophy',
      ]),
    );
    expect(arts).not.toContain('Accountancy');
    expect(arts).not.toContain('Finance');
  });

  it('leaves the Others science list as English and Hindi', () => {
    expect(OTHERS_SCIENCE_SUBJECTS.map((row) => row.subjectName)).toEqual([
      'English',
      'Hindi',
    ]);
    expect(
      othersSubjectsForStream('SCIENCE').map((row) => row.subjectName),
    ).not.toContain('Business Studies');
  });

  it('does not put commerce papers on an unknown stream', () => {
    expect(
      othersSubjectsForStream('VOCATIONAL').map((row) => row.subjectName),
    ).toEqual(['English', 'Hindi']);
  });
});
