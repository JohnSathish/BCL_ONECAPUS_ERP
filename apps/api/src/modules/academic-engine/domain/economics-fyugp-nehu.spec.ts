import {
  ECONOMICS_NEHU_PAPERS,
  ECONOMICS_MAJOR_ALLOWED_MINORS,
  MAJORS_ALLOWING_ECONOMICS_MINOR,
} from './economics-fyugp-nehu';

describe('economics-fyugp-nehu', () => {
  it('lists 16 NEHU Economics papers including internship ECO-303', () => {
    expect(ECONOMICS_NEHU_PAPERS).toHaveLength(16);
    expect(ECONOMICS_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'ECO-100',
      'ECO-150',
      'ECO-200',
      'ECO-201',
      'ECO-250',
      'ECO-251',
      'ECO-252',
      'ECO-253',
      'ECO-300',
      'ECO-301',
      'ECO-302',
      'ECO-303',
      'ECO-350',
      'ECO-351',
      'ECO-352',
      'ECO-353',
    ]);
  });

  it('documents major-minor matrix directions for Economics', () => {
    expect(ECONOMICS_MAJOR_ALLOWED_MINORS).toEqual([
      'Geography',
      'History',
      'Political Science',
      'Sociology',
    ]);
    expect(MAJORS_ALLOWING_ECONOMICS_MINOR).toContain('Commerce');
  });
});
