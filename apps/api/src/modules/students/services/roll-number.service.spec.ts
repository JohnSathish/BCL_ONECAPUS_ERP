import { BadRequestException, ConflictException } from '@nestjs/common';

import { RollNumberService } from './roll-number.service';

describe('RollNumberService', () => {
  const tenantId = 'tenant-1';
  const institutionId = 'inst-1';
  const streamId = 'stream-arts';
  const batchId = 'batch-2026';

  const prisma = {
    academicStream: { findFirst: jest.fn() },
    admissionBatch: { findFirst: jest.fn() },
    rollPrefixConfig: { findFirst: jest.fn() },
    rollNumberSettings: { findUnique: jest.fn(), create: jest.fn() },
    rollNumberSequence: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    student: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    studentRollNumberAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const rollShiftRange = {
    allocateInShiftRange: jest.fn().mockResolvedValue(null),
    findShiftConfig: jest.fn().mockResolvedValue(null),
    hasActiveShiftRanges: jest.fn().mockResolvedValue(false),
  };

  const service = new RollNumberService(
    prisma as never,
    rollShiftRange as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.rollNumberSettings.findUnique.mockResolvedValue({
      tenantId,
      sequenceLength: 3,
      separator: '-',
      autoGenerateOnAdmit: true,
    });
    prisma.academicStream.findFirst.mockResolvedValue({
      id: streamId,
      code: 'ARTS',
      name: 'Arts',
    });
    prisma.admissionBatch.findFirst.mockResolvedValue({
      id: batchId,
      admissionYear: 2026,
      entrySession: { institutionId },
    });
    prisma.rollPrefixConfig.findFirst.mockResolvedValue({
      prefix: 'BA',
      isActive: true,
    });
    prisma.student.findFirst.mockResolvedValue(null);
  });

  it('formats BA26-001 preview for arts 2026', async () => {
    prisma.rollNumberSequence.findUnique.mockResolvedValue({ nextSequence: 1 });

    const preview = await service.previewNextRollNumber(tenantId, {
      streamId,
      admissionBatchId: batchId,
    });

    expect(preview.rollNumber).toBe('BA26-001');
    expect(preview.prefix).toBe('BA');
    expect(preview.sequence).toBe(1);
  });

  it('allocates BA26-002 then BS26-001 with independent counters', async () => {
    prisma.$transaction
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          rollNumberSequence: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'seq-1', nextSequence: 2 }),
            update: jest.fn(),
            create: jest.fn(),
          },
          student: { findFirst: jest.fn().mockResolvedValue(null) },
        }),
      )
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          rollNumberSequence: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
            create: jest.fn(),
          },
          student: { findFirst: jest.fn().mockResolvedValue(null) },
        }),
      );

    const arts = await service.allocateNextRollNumber(tenantId, {
      streamId,
      admissionBatchId: batchId,
    });
    expect(arts.rollNumber).toBe('BA26-002');

    prisma.academicStream.findFirst.mockResolvedValue({
      id: 'stream-sci',
      code: 'SCIENCE',
      name: 'Science',
    });
    prisma.rollPrefixConfig.findFirst.mockResolvedValue({
      prefix: 'BS',
      isActive: true,
    });

    const science = await service.allocateNextRollNumber(tenantId, {
      streamId: 'stream-sci',
      admissionBatchId: batchId,
    });
    expect(science.rollNumber).toBe('BS26-001');
  });

  it('preview does not increment sequence', async () => {
    prisma.rollNumberSequence.findUnique.mockResolvedValue({ nextSequence: 5 });

    await service.previewNextRollNumber(tenantId, {
      streamId,
      admissionBatchId: batchId,
    });
    await service.previewNextRollNumber(tenantId, {
      streamId,
      admissionBatchId: batchId,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.rollNumberSequence.update).not.toHaveBeenCalled();
  });

  it('uses BA27-001 for new admission year', async () => {
    prisma.admissionBatch.findFirst.mockResolvedValue({
      id: 'batch-2027',
      admissionYear: 2027,
      entrySession: { institutionId },
    });
    prisma.rollNumberSequence.findUnique.mockResolvedValue({ nextSequence: 1 });

    const preview = await service.previewNextRollNumber(tenantId, {
      streamId,
      admissionBatchId: 'batch-2027',
    });

    expect(preview.rollNumber).toBe('BA27-001');
  });

  it('rejects duplicate roll numbers within institution', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'other-student',
      rollNumber: 'BA26-001',
      academicProfile: { admissionBatch: { entrySession: { institutionId } } },
      campus: null,
    });

    await expect(
      service.validateRollNumberUnique(tenantId, institutionId, 'BA26-001'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when stream prefix is not configured', async () => {
    prisma.rollPrefixConfig.findFirst.mockResolvedValue(null);

    await expect(
      service.previewNextRollNumber(tenantId, {
        streamId,
        admissionBatchId: batchId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('formats roll numbers with configurable sequence length', () => {
    expect(
      service.formatRollNumber('BC', '26', 1, {
        sequenceLength: 4,
        separator: '-',
      }),
    ).toBe('BC26-0001');
  });
});
