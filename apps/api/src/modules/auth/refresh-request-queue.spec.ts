import {
  processRefreshQueue,
  type RefreshQueueEntry,
} from '../../../../web/lib/auth/refresh-request-queue';

describe('processRefreshQueue', () => {
  it('resolves all queued requests with the new access token', () => {
    const resolved: string[] = [];
    const queue: RefreshQueueEntry[] = [
      { resolve: (t) => resolved.push(t), reject: () => {} },
      { resolve: (t) => resolved.push(t), reject: () => {} },
    ];

    const remaining = processRefreshQueue(queue, null, 'token-abc');

    expect(resolved).toEqual(['token-abc', 'token-abc']);
    expect(remaining).toEqual([]);
  });

  it('rejects all queued requests when refresh fails', () => {
    const err = new Error('refresh failed');
    let rejected = 0;
    const queue: RefreshQueueEntry[] = [
      { resolve: () => {}, reject: () => rejected++ },
      { resolve: () => {}, reject: () => rejected++ },
    ];

    processRefreshQueue(queue, err, null);

    expect(rejected).toBe(2);
  });
});
