import { schoolLoginCompacts } from './school-sis-login-lookup';

describe('schoolLoginCompacts', () => {
  it('treats SLS26-0108 and SLS2026-0108 as the same keys', () => {
    const short = schoolLoginCompacts('SLS26-0108');
    const long = schoolLoginCompacts('SLS2026-0108');
    expect(short).toEqual(expect.arrayContaining(['SLS260108', 'SLS20260108']));
    expect(long).toEqual(expect.arrayContaining(['SLS260108', 'SLS20260108']));
  });
});
