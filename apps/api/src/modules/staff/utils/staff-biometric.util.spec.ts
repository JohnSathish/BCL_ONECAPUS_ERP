import {
  assertBiometricIdUnique,
  normalizeBiometricId,
} from './staff-biometric.util';

describe('staff-biometric.util', () => {
  it('trims and caps biometric id length', () => {
    expect(normalizeBiometricId('  1001  ')).toBe('1001');
    expect(normalizeBiometricId('a'.repeat(60))?.length).toBe(50);
    expect(normalizeBiometricId('   ')).toBeUndefined();
  });

  it('checks institution-scoped duplicates', async () => {
    const prisma = {
      campus: {
        findMany: jest.fn().mockResolvedValue([{ id: 'campus-1' }]),
      },
      staffProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'other', fullName: 'Jane' }),
      },
    };

    await expect(
      assertBiometricIdUnique(prisma as never, 'tenant-1', '1001', {
        institutionId: 'inst-1',
      }),
    ).rejects.toThrow('Biometric ID already in use');
  });
});
