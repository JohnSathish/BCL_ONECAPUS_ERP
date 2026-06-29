import {
  EXPORTS_QUEUE_JOB_NAMES,
  isNestApiExportJob,
  isWorkerOwnedExportJob,
  NEST_API_EXPORT_JOB_NAMES,
} from './exports-queue.jobs';

describe('exports queue job registry', () => {
  it('treats student import as a Nest API job', () => {
    expect(isNestApiExportJob('student-import-commit')).toBe(true);
    expect(NEST_API_EXPORT_JOB_NAMES.has('student-import-commit')).toBe(true);
  });

  it('treats fee receipt PDF as worker-owned', () => {
    expect(isWorkerOwnedExportJob('fee-receipt-pdf')).toBe(true);
    expect(isNestApiExportJob('fee-receipt-pdf')).toBe(false);
  });

  it('lists every known exports job name once', () => {
    expect(new Set(EXPORTS_QUEUE_JOB_NAMES).size).toBe(
      EXPORTS_QUEUE_JOB_NAMES.length,
    );
    expect(EXPORTS_QUEUE_JOB_NAMES).toContain('student-import-commit');
  });
});
