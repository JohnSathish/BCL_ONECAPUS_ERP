import { StudentAttendanceSchedulerService } from './student-attendance-scheduler.service';

describe('StudentAttendanceSchedulerService', () => {
  function setup(overrides?: {
    tenants?: Array<{ id: string; slug: string }>;
    publishedCount?: number;
    generateResult?: Record<string, unknown>;
    generateImpl?: (tenantId: string) => Promise<unknown>;
  }) {
    const prisma = {
      tenant: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            overrides?.tenants ?? [{ id: 't1', slug: 'demo' }],
          ),
      },
      timetablePlan: {
        count: jest.fn().mockResolvedValue(overrides?.publishedCount ?? 1),
      },
    };
    const attendance = {
      generateSessionsForTenant: jest.fn().mockImplementation(
        overrides?.generateImpl ??
          (async () =>
            overrides?.generateResult ?? {
              created: 12,
              skipped: false,
            }),
      ),
    };
    const scheduler = new StudentAttendanceSchedulerService(
      prisma as any,
      attendance as any,
    );
    return { scheduler, prisma, attendance };
  }

  it('generates sessions for active tenants with a published timetable', async () => {
    const { scheduler, attendance, prisma } = setup();
    await scheduler.generateMorningSessions();
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      where: { status: 'active', deletedAt: null },
      select: { id: true, slug: true },
    });
    expect(attendance.generateSessionsForTenant).toHaveBeenCalledTimes(1);
    expect(attendance.generateSessionsForTenant).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
      null,
    );
  });

  it('skips tenants that have no published timetable', async () => {
    const { scheduler, attendance } = setup({ publishedCount: 0 });
    await scheduler.generateMorningSessions();
    expect(attendance.generateSessionsForTenant).not.toHaveBeenCalled();
  });

  it('continues other tenants when one generate fails', async () => {
    const { scheduler, attendance } = setup({
      tenants: [
        { id: 't1', slug: 'broken' },
        { id: 't2', slug: 'demo' },
      ],
      generateImpl: async (tenantId: string) => {
        if (tenantId === 't1') throw new Error('db down');
        return { created: 4 };
      },
    });
    await scheduler.generateMorningSessions();
    expect(attendance.generateSessionsForTenant).toHaveBeenCalledTimes(2);
  });

  it('does not start a second run while the first is in progress', async () => {
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    const { scheduler, attendance } = setup({
      generateImpl: async () => {
        started();
        await blocked;
        return { created: 1 };
      },
    });
    const first = scheduler.generateMorningSessions();
    await startedGate;
    await scheduler.generateMorningSessions();
    release();
    await first;
    expect(attendance.generateSessionsForTenant).toHaveBeenCalledTimes(1);
  });

  it('skips the 07:00 retry after a successful 06:00 run on the same date', async () => {
    const { scheduler, attendance } = setup();
    await scheduler.generateMorningSessions();
    await scheduler.generateMorningSessions();
    expect(attendance.generateSessionsForTenant).toHaveBeenCalledTimes(1);
  });
});
