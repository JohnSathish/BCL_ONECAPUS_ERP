import {
  evaluateRollEligibility,
  isTestOrDummyRecord,
} from './roll-number-eligibility';

describe('roll-number-eligibility', () => {
  it('detects import test student names', () => {
    expect(isTestOrDummyRecord({ fullName: 'Import Test Student Alpha' })).toBe(
      true,
    );
    expect(isTestOrDummyRecord({ fullName: 'Import Test Student Beta' })).toBe(
      true,
    );
    expect(isTestOrDummyRecord({ fullName: 'John Doe' })).toBe(false);
  });

  it('blocks test records from roll generation', () => {
    const result = evaluateRollEligibility({
      fullName: 'Import Test Student Alpha',
      programmeId: 'prog-1',
      departmentId: 'dept-1',
      admissionYear: 2026,
      streamId: 'stream-1',
      admissionBatchId: 'batch-1',
      admissionStatus: 'ACTIVE',
      studentStatus: 'STUDYING',
    });
    expect(result.blocked).toBe(true);
    expect(result.issues).toContain('TEST_RECORD');
  });

  it('blocks missing department', () => {
    const result = evaluateRollEligibility({
      fullName: 'Real Student',
      programmeId: 'prog-1',
      departmentId: null,
      admissionYear: 2026,
      streamId: 'stream-1',
      admissionBatchId: 'batch-1',
    });
    expect(result.blocked).toBe(true);
    expect(result.issues).toContain('MISSING_DEPARTMENT');
  });
});
