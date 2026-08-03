import { StaffEmploymentService } from './staff-employment.service';

describe('StaffEmploymentService short code candidates', () => {
  const svc = Object.create(
    StaffEmploymentService.prototype,
  ) as StaffEmploymentService;

  it('prefers first+last initials as first candidate', () => {
    expect(svc.buildShortCodeCandidates('Biswajit Marak')[0]).toBe('BM');
  });

  it('only emits 2-letter codes', () => {
    for (const code of svc.buildShortCodeCandidates('John Michael Smith')) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('offers alternatives after initials', () => {
    const codes = svc.buildShortCodeCandidates('Biswajit Marak');
    expect(codes).toContain('BM');
    expect(codes).toContain('BI');
    expect(codes).toContain('MA');
    expect(codes.indexOf('BI')).toBeGreaterThan(codes.indexOf('BM'));
  });
});
