import { PoolSectionProvisioningService } from './pool-section-provisioning.service';

describe('PoolSectionProvisioningService', () => {
  const prisma = {
    shift: { findFirst: jest.fn() },
    courseOffering: { findFirst: jest.fn(), findMany: jest.fn() },
    offeringSection: { findFirst: jest.fn(), create: jest.fn() },
    offeringSeatLedger: { upsert: jest.fn() },
    categoryPool: { findMany: jest.fn() },
    tenantAcademicSettings: { findUnique: jest.fn() },
  };

  const lmsWorkspaces = {
    provisionSectionWorkspace: jest.fn().mockResolvedValue(null),
    provisionPoolWorkspace: jest.fn().mockResolvedValue(null),
  };

  const service = new PoolSectionProvisioningService(
    prisma as never,
    lmsWorkspaces as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tenantAcademicSettings.findUnique.mockResolvedValue(null);
  });

  it('creates a default Day section when none exists', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-day', code: 'DAY' });
    prisma.courseOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      mappingSource: 'DIRECT',
      programVersionId: 'pv-1',
      capacity: 60,
      waitlistCapacity: 12,
    });
    prisma.offeringSection.findFirst.mockResolvedValue(null);
    prisma.offeringSection.create.mockResolvedValue({ id: 'sec-1' });
    prisma.offeringSeatLedger.upsert.mockResolvedValue({});

    const result = await service.ensureDefaultSection('tenant-1', 'off-1', {
      shiftCode: 'DAY',
    });

    expect(result.created).toBe(true);
    expect(result.sectionId).toBe('sec-1');
    expect(prisma.offeringSection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseOfferingId: 'off-1',
          shiftId: 'shift-day',
          sectionCode: 'A',
          capacity: 60,
        }),
      }),
    );
  });

  it('uses tenant default capacity for shared pool offerings at legacy default', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-day', code: 'DAY' });
    prisma.courseOffering.findFirst.mockResolvedValue({
      id: 'off-pool',
      mappingSource: 'SHARED_POOL',
      category: 'MDC',
      programVersionId: null,
      capacity: 40,
      waitlistCapacity: 10,
    });
    prisma.offeringSection.findFirst.mockResolvedValue(null);
    prisma.offeringSection.create.mockResolvedValue({ id: 'sec-pool' });
    prisma.offeringSeatLedger.upsert.mockResolvedValue({});

    await service.ensureDefaultSection('tenant-1', 'off-pool', {
      shiftCode: 'DAY',
    });

    expect(prisma.offeringSection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ capacity: 200 }),
      }),
    );
  });

  it('preserves customized shared pool offering capacity', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-day', code: 'DAY' });
    prisma.courseOffering.findFirst.mockResolvedValue({
      id: 'off-pool',
      mappingSource: 'SHARED_POOL',
      category: 'SEC',
      programVersionId: null,
      capacity: 60,
      waitlistCapacity: 10,
    });
    prisma.offeringSection.findFirst.mockResolvedValue(null);
    prisma.offeringSection.create.mockResolvedValue({ id: 'sec-custom' });
    prisma.offeringSeatLedger.upsert.mockResolvedValue({});

    await service.ensureDefaultSection('tenant-1', 'off-pool');

    expect(prisma.offeringSection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ capacity: 60 }),
      }),
    );
  });

  it('skips when section already exists', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-day', code: 'DAY' });
    prisma.courseOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      mappingSource: 'SHARED_POOL',
      capacity: 40,
      waitlistCapacity: 10,
    });
    prisma.offeringSection.findFirst.mockResolvedValue({ id: 'sec-existing' });

    const result = await service.ensureDefaultSection('tenant-1', 'off-1');

    expect(result).toEqual({ created: false, sectionId: 'sec-existing' });
    expect(prisma.offeringSection.create).not.toHaveBeenCalled();
  });
});
