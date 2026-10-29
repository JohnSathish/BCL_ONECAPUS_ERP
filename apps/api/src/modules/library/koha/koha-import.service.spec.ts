import { KohaImportService } from './koha-import.service';

describe('Koha import dry run', () => {
  it('checks the staged catalogue without creating books or copies', async () => {
    const update = jest.fn().mockResolvedValue({});
    const createBook = jest.fn();
    const createCopy = jest.fn();
    const prisma = {
      libraryKohaImportBatch: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'batch-1',
          tenantId: 'tenant-1',
          status: 'STAGED',
          summary: { notes: [] },
        }),
        update,
      },
      libraryBook: {
        count: jest.fn().mockResolvedValue(12),
        create: createBook,
      },
      libraryBookCopy: { create: createCopy },
      libraryKohaStagedBook: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      libraryKohaStagedCopy: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      libraryAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new KohaImportService(prisma as never);
    await service.dryRun('tenant-1', 'user-1', 'batch-1');
    expect(createBook).not.toHaveBeenCalled();
    expect(createCopy).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRY_RUN' }),
      }),
    );
    expect(prisma.libraryBook.count).toHaveBeenCalledTimes(2);
  });
});
