import { classifyPushFailure } from './school-sis-push-errors';

describe('classifyPushFailure', () => {
  it('maps unregistered tokens to a school-safe message', () => {
    const row = classifyPushFailure('UNREGISTERED');
    expect(row.label).toBe('Device registration is no longer valid');
    expect(row.retryable).toBe(false);
  });

  it('treats quota and unavailable as retryable', () => {
    expect(classifyPushFailure('UNAVAILABLE').retryable).toBe(true);
    expect(classifyPushFailure('messaging/quota-exceeded').retryable).toBe(
      true,
    );
  });

  it('maps APNs auth failures to a clear Firebase console action', () => {
    const row = classifyPushFailure('messaging/third-party-auth-error');
    expect(row.key).toBe('APNS_CONFIG');
    expect(row.label).toBe('Apple Push (APNs) not configured in Firebase');
    expect(row.retryable).toBe(false);
  });
});
