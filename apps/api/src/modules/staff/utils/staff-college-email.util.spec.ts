import {
  isOfficialCollegeEmail,
  officialCollegeEmail,
} from './staff-college-email.util';

describe('staff-college-email.util', () => {
  it('recognises the college domain and ignores personal mail', () => {
    expect(isOfficialCollegeEmail(' Kaushik.CS@DonBoscoCollege.ac.in ')).toBe(
      true,
    );
    expect(isOfficialCollegeEmail('kaushikpaul345@gmail.com')).toBe(false);
    expect(isOfficialCollegeEmail('')).toBe(false);
  });

  it('prefers the profile email, then the public college email', () => {
    expect(
      officialCollegeEmail(
        'kaushik.cs@donboscocollege.ac.in',
        'other@donboscocollege.ac.in',
      ),
    ).toBe('kaushik.cs@donboscocollege.ac.in');
    expect(
      officialCollegeEmail(
        'kaushikpaul345@gmail.com',
        'kaushik.cs@donboscocollege.ac.in',
      ),
    ).toBe('kaushik.cs@donboscocollege.ac.in');
    expect(officialCollegeEmail('kaushikpaul345@gmail.com', null)).toBeNull();
  });
});
