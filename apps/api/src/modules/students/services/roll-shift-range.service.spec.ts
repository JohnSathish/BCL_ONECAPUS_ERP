import { BadRequestException } from '@nestjs/common';

import { RollShiftRangeService } from './roll-shift-range.service';

describe('RollShiftRangeService', () => {
  const tenantId = 'tenant-1';
  const institutionId = 'inst-1';
  const studentId = 'student-1';
  const fromShiftId = 'shift-day';
  const toShiftId = 'shift-morning';

  const prisma = {
    student: { findFirst: jest.fn(), update: jest.fn() },
    shift: { findFirst: jest.fn() },
    campus: { findFirst: jest.fn() },
    rollNumberSettings: { findUnique: jest.fn() },
    rollPrefixConfig: { findFirst: jest.fn() },
    rollShiftRangeConfig: {
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    studentShiftTransfer: { create: jest.fn(), update: jest.fn() },
    studentAcademicProfile: { updateMany: jest.fn() },
    studentRollNumberAuditLog: { create: jest.fn() },
    rollNumberVacancy: { upsert: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const service = new RollShiftRangeService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.rollNumberSettings.findUnique.mockResolvedValue({
      sequenceLength: 3,
      separator: '-',
    });
    prisma.rollPrefixConfig.findFirst.mockResolvedValue({ prefix: 'BA' });
    prisma.rollShiftRangeConfig.count.mockResolvedValue(1);
    prisma.shift.findFirst.mockResolvedValue({
      id: toShiftId,
      code: 'MOR',
      name: 'Morning',
    });
    prisma.student.findFirst.mockResolvedValue({
      id: studentId,
      rollNumber: 'BA26-455',
      primaryShiftId: fromShiftId,
      campusId: null,
      primaryShift: { id: fromShiftId, code: 'DAY', name: 'Day' },
      academicProfile: {
        streamId: 'stream-1',
        stream: { id: 'stream-1', code: 'ARTS' },
        admissionBatchId: 'batch-1',
        admissionBatch: {
          admissionYear: 2026,
          entrySession: { institutionId },
        },
      },
    });
    prisma.rollShiftRangeConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      sequenceStart: 1,
      sequenceEnd: 999,
      nextSequence: 756,
    });
  });

  it('parses BA26-755 into prefix, year, and sequence', () => {
    const parsed = service.parseRollNumber('BA26-755');
    expect(parsed).toEqual({
      prefix: 'BA',
      yearSuffix: '26',
      separator: '-',
      sequence: 755,
      admissionYear: 2026,
    });
  });

  it('formats BA26-756 from components', () => {
    const formatted = service.formatRollNumber('BA', '26', 756, {
      sequenceLength: 3,
      separator: '-',
    });
    expect(formatted).toBe('BA26-756');
  });

  it('previewShiftTransfer returns next roll without incrementing sequence', async () => {
    const preview = await service.previewShiftTransfer(tenantId, {
      studentId,
      toShiftId,
    });

    expect(preview.previewRollNumber).toBe('BA26-756');
    expect(preview.currentRollNumber).toBe('BA26-455');
    expect(prisma.rollShiftRangeConfig.update).not.toHaveBeenCalled();
  });

  it('previewShiftTransfer rejects when student already on target shift', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: studentId,
      rollNumber: 'BA26-455',
      primaryShiftId: toShiftId,
      campusId: null,
      primaryShift: { id: toShiftId, code: 'MOR', name: 'Morning' },
      academicProfile: {
        streamId: 'stream-1',
        stream: { id: 'stream-1', code: 'ARTS' },
        admissionBatchId: 'batch-1',
        admissionBatch: {
          admissionYear: 2026,
          entrySession: { institutionId },
        },
      },
    });

    await expect(
      service.previewShiftTransfer(tenantId, { studentId, toShiftId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allocateInShiftRange retries when roll number is already taken', async () => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'cfg-1',
            sequence_start: 756,
            sequence_end: 999,
            next_sequence: 756,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'cfg-1',
            sequence_start: 756,
            sequence_end: 999,
            next_sequence: 757,
          },
        ]),
      rollShiftRangeConfig: { update: jest.fn() },
      student: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'other' })
          .mockResolvedValueOnce(null),
      },
      rollNumberVacancy: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const allocated = await service.allocateInShiftRange(
      tx as never,
      tenantId,
      {
        institutionId,
        shiftId: toShiftId,
        admissionYear: 2026,
        prefix: 'BA',
        yearSuffix: '26',
        streamCode: 'ARTS',
        settings: { sequenceLength: 3, separator: '-' },
        excludeStudentId: studentId,
      },
    );

    expect(allocated?.rollNumber).toBe('BA26-757');
    expect(tx.rollShiftRangeConfig.update).toHaveBeenCalledTimes(2);
  });
});
