import { AdmissionsCycleService } from './admissions-cycle.service';

/**
 * Lightweight smoke for prefix bump + year-short heuristics used by One-Click clone.
 * Instantiated without Nest DI — only exercise pure helper methods.
 */
describe('AdmissionsCycleService deriveApplicationNumberPrefix', () => {
  const svc = Object.create(
    AdmissionsCycleService.prototype,
  ) as AdmissionsCycleService;

  it('bumps YY from previous prefix using year name', () => {
    expect(svc.deriveApplicationNumberPrefix('2027-2028', 'DBCT26')).toBe(
      'DBCT27',
    );
  });

  it('falls back to DBCT{YY} when no previous prefix', () => {
    expect(svc.deriveApplicationNumberPrefix('2027-2028')).toBe('DBCT27');
  });

  it('preserves non-numeric prefix stem', () => {
    expect(svc.deriveApplicationNumberPrefix('2028-2029', 'FYUG26')).toBe(
      'FYUG28',
    );
  });
});
