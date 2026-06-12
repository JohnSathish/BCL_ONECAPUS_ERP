import { BadRequestException, ConflictException } from '@nestjs/common';

import { EmployeeCodeService } from './employee-code.service';

describe('EmployeeCodeService', () => {
  const tenantId = 'tenant-1';
  const institutionId = 'inst-1';

  const prisma = {
    institution: { findFirst: jest.fn() },
    staffEmployeeCodeSettings: { findUnique: jest.fn(), create: jest.fn() },
    staffEmployeeCodeTypePrefix: { findUnique: jest.fn() },
    staffEmployeeCodeSequence: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    staffEmployeeCodeAuditLog: { create: jest.fn() },
    staffProfile: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new EmployeeCodeService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.institution.findFirst.mockResolvedValue({ id: institutionId });
    prisma.staffEmployeeCodeSettings.findUnique.mockResolvedValue({
      tenantId,
      orgPrefix: 'DBC',
      sequenceLength: 3,
      separator: '-',
      autoGenerateOnCreate: true,
    });
    prisma.staffEmployeeCodeTypePrefix.findUnique.mockResolvedValue({
      staffType: 'TEACHING',
      typeSuffix: 'TCH',
      isActive: true,
    });
    prisma.staffProfile.findFirst.mockResolvedValue(null);
  });

  it('formats DBCTCH-26-001 preview for teaching 2026', async () => {
    prisma.staffEmployeeCodeSequence.findUnique.mockResolvedValue({
      nextSequence: 1,
    });

    const preview = await service.previewNextEmployeeCode(tenantId, {
      institutionId,
      staffType: 'TEACHING',
      joiningDate: '2026-07-01',
    });

    expect(preview.employeeCode).toBe('DBCTCH-26-001');
    expect(preview.fullPrefix).toBe('DBCTCH');
    expect(preview.sequence).toBe(1);
  });

  it('allocates DBCTCH-26-002 then DBCADM-26-001 with independent counters', async () => {
    prisma.$transaction
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          staffEmployeeCodeSequence: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'seq-1', nextSequence: 2 }),
            update: jest.fn(),
            create: jest.fn(),
          },
          staffProfile: { findFirst: jest.fn().mockResolvedValue(null) },
          staffEmployeeCodeAuditLog: { create: jest.fn() },
        }),
      )
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          staffEmployeeCodeSequence: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
            create: jest.fn(),
          },
          staffProfile: { findFirst: jest.fn().mockResolvedValue(null) },
          staffEmployeeCodeAuditLog: { create: jest.fn() },
        }),
      );

    prisma.staffEmployeeCodeTypePrefix.findUnique
      .mockResolvedValueOnce({
        staffType: 'TEACHING',
        typeSuffix: 'TCH',
        isActive: true,
      })
      .mockResolvedValueOnce({
        staffType: 'ADMIN',
        typeSuffix: 'ADM',
        isActive: true,
      });

    const first = await service.allocateNextEmployeeCode(tenantId, {
      institutionId,
      staffType: 'TEACHING',
      joiningDate: '2026-01-01',
    });
    const second = await service.allocateNextEmployeeCode(tenantId, {
      institutionId,
      staffType: 'ADMIN',
      joiningDate: '2026-01-01',
    });

    expect(first.employeeCode).toBe('DBCTCH-26-002');
    expect(second.employeeCode).toBe('DBCADM-26-001');
  });

  it('preview does not increment sequence', async () => {
    prisma.staffEmployeeCodeSequence.findUnique.mockResolvedValue({
      nextSequence: 3,
    });

    await service.previewNextEmployeeCode(tenantId, {
      institutionId,
      staffType: 'TEACHING',
      joiningDate: '2026-01-01',
    });
    await service.previewNextEmployeeCode(tenantId, {
      institutionId,
      staffType: 'TEACHING',
      joiningDate: '2026-01-01',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.staffEmployeeCodeSequence.update).not.toHaveBeenCalled();
  });

  it('blocks regeneration when staff type unchanged and code finalized', async () => {
    prisma.staffProfile.findFirst.mockResolvedValue({
      staffType: 'TEACHING',
      employeeCodeAllocatedAt: new Date(),
    });

    const result = await service.canRegenerateForStaff(
      tenantId,
      'staff-1',
      'TEACHING',
    );
    expect(result.allowed).toBe(false);
  });

  it('allows regeneration when staff type changed', async () => {
    prisma.staffProfile.findFirst.mockResolvedValue({
      staffType: 'TEACHING',
      employeeCodeAllocatedAt: new Date(),
    });

    const result = await service.canRegenerateForStaff(
      tenantId,
      'staff-1',
      'ADMIN',
    );
    expect(result.allowed).toBe(true);
  });

  it('rejects duplicate employee code on allocate', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          staffEmployeeCodeSequence: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            update: jest.fn(),
          },
          staffProfile: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
          },
          staffEmployeeCodeAuditLog: { create: jest.fn() },
        }),
    );

    await expect(
      service.allocateNextEmployeeCode(tenantId, {
        institutionId,
        staffType: 'TEACHING',
        joiningDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when staff type has no configured prefix', async () => {
    prisma.staffEmployeeCodeTypePrefix.findUnique.mockResolvedValue(null);

    await expect(
      service.previewNextEmployeeCode(tenantId, {
        institutionId,
        staffType: 'UNKNOWN',
        joiningDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
