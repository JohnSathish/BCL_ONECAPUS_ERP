import { StepUpService } from './step-up.service';

describe('StepUpService', () => {
  const secret = 'step-up-test-secret';

  function service(cache: { get: jest.Mock; set: jest.Mock }) {
    return new StepUpService(
      { user: { findFirst: jest.fn() } } as never,
      cache as never,
      { verifyTotp: jest.fn() } as never,
      { getOrThrow: () => secret } as never,
    );
  }

  it('accepts a signed confirmation when the cache did not store it', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const stepUp = service(cache);
    const token = (
      stepUp as unknown as { sign: (userId: string) => string }
    ).sign('user-1');

    await expect(stepUp.verify('user-1', token)).resolves.toBe(true);
    await expect(stepUp.verify('user-2', token)).resolves.toBe(false);
  });

  it('rejects a confirmation that was already used', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue({ used: true }),
      set: jest.fn(),
    };
    const stepUp = service(cache);
    const token = (
      stepUp as unknown as { sign: (userId: string) => string }
    ).sign('user-1');

    await expect(stepUp.verify('user-1', token)).resolves.toBe(false);
  });

  it('rejects a confirmation that was not signed by this server', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    };
    const stepUp = service(cache);

    await expect(stepUp.verify('user-1', 'not-a-real-token')).resolves.toBe(
      false,
    );
  });
});
