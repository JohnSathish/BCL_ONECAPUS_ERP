import { StepUpService } from './step-up.service';

describe('StepUpService', () => {
  const secret = 'step-up-test-secret';

  function service() {
    return new StepUpService(
      { user: { findFirst: jest.fn() } } as never,
      { verifyTotp: jest.fn() } as never,
      { getOrThrow: () => secret } as never,
    );
  }

  it('accepts a signed confirmation when the cache did not store it', async () => {
    const stepUp = service();
    const token = (
      stepUp as unknown as { sign: (userId: string) => string }
    ).sign('user-1');

    await expect(stepUp.verify('user-1', token)).resolves.toBe(true);
    await expect(stepUp.verify('user-2', token)).resolves.toBe(false);
  });

  it('accepts the same confirmation again within its lifetime', async () => {
    const stepUp = service();
    const token = (
      stepUp as unknown as { sign: (userId: string) => string }
    ).sign('user-1');

    await expect(stepUp.verify('user-1', token)).resolves.toBe(true);
    await expect(stepUp.verify('user-1', token)).resolves.toBe(true);
  });

  it('rejects a confirmation that was not signed by this server', async () => {
    const stepUp = service();

    await expect(stepUp.verify('user-1', 'not-a-real-token')).resolves.toBe(
      false,
    );
  });
});
