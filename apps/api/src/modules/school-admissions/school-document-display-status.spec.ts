import { schoolDocumentDisplayStatus } from './school-document-display-status';

describe('schoolDocumentDisplayStatus', () => {
  it('shows NOT UPLOADED when no file exists', () => {
    expect(schoolDocumentDisplayStatus({ uploaded: false }).displayLabel).toBe(
      'NOT UPLOADED',
    );
  });

  it('shows UPLOADED – VERIFICATION PENDING for uploaded pending docs', () => {
    expect(
      schoolDocumentDisplayStatus({
        uploaded: true,
        verificationStatus: 'PENDING',
      }).displayLabel,
    ).toBe('UPLOADED – VERIFICATION PENDING');
  });

  it('shows VERIFIED and REJECTED – RESUBMISSION REQUIRED', () => {
    expect(
      schoolDocumentDisplayStatus({
        uploaded: true,
        verificationStatus: 'VERIFIED',
      }).displayLabel,
    ).toBe('VERIFIED');
    expect(
      schoolDocumentDisplayStatus({
        uploaded: true,
        verificationStatus: 'REJECTED',
      }).displayLabel,
    ).toBe('REJECTED – RESUBMISSION REQUIRED');
  });

  it('exposes a separate school verification label for payment section', () => {
    expect(
      schoolDocumentDisplayStatus({
        uploaded: true,
        verificationStatus: 'PENDING',
      }).schoolVerificationLabel,
    ).toBe('PENDING VERIFICATION');
  });
});
