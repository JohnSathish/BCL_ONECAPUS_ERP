import { syncProgramPromotionMappings } from './sync-promotion-mappings';

describe('syncProgramPromotionMappings', () => {
  it('creates mappings for matching offerings across semesters', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      courseOffering: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'from-1',
              category: 'MAJOR',
              majorPaperIndex: 1,
              course: { departmentId: 'dept-eco' },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'to-1',
              category: 'MAJOR',
              majorPaperIndex: 1,
              course: { departmentId: 'dept-eco' },
            },
          ]),
      },
      programPromotionMapping: { upsert },
    };

    const result = await syncProgramPromotionMappings(
      prisma as never,
      'tenant-1',
      'pv-1',
      [{ fromSequence: 1, toSequence: 2 }],
    );

    expect(result.created).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromOfferingId: 'from-1',
          toOfferingId: 'to-1',
        }),
      }),
    );
  });
});
