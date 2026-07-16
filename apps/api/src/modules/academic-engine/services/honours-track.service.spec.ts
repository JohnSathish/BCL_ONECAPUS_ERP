import { HonoursTrackService } from './honours-track.service';
import { HONOURS_RESEARCH_ELIGIBILITY_PERCENT } from '../domain/fyugp-templates';

describe('HonoursTrackService', () => {
  const prisma = {
    student: { findFirst: jest.fn() },
    studentAcademicTrack: { findUnique: jest.fn(), upsert: jest.fn() },
    studentAcademicStanding: { findUnique: jest.fn(), update: jest.fn() },
  };

  const service = new HonoursTrackService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('blocks research when aggregate is below threshold without override', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      70,
      false,
    );
    expect(result.eligible).toBe(false);
    expect(result.requiresOverride).toBe(true);
    expect(result.blockReason).toContain(
      String(HONOURS_RESEARCH_ELIGIBILITY_PERCENT),
    );
  });

  it('blocks research when aggregate is missing without override', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      null,
      false,
    );
    expect(result.eligible).toBe(false);
    expect(result.requiresOverride).toBe(true);
    expect(result.blockReason).toMatch(/not recorded/i);
  });

  it('allows research track with eligibility override', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      60,
      true,
    );
    expect(result.eligible).toBe(true);
    expect(result.eligibilityOverride).toBe(true);
  });

  it('allows research when aggregate meets threshold', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      80,
      false,
    );
    expect(result.eligible).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it('persists track selection for eligible student', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' });
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      aggregatePercentageThroughSem6: 80,
    });
    prisma.studentAcademicTrack.upsert.mockResolvedValue({
      id: 'track-1',
      track: 'HONOURS_WITH_RESEARCH',
    });

    const saved = await service.setTrack('t1', 's1', {
      track: 'HONOURS_WITH_RESEARCH',
    });

    expect(saved.record.track).toBe('HONOURS_WITH_RESEARCH');
    expect(prisma.studentAcademicTrack.upsert).toHaveBeenCalled();
  });

  it('rejects research below threshold without override reason', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' });
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      aggregatePercentageThroughSem6: 70,
    });

    await expect(
      service.setTrack('t1', 's1', { track: 'HONOURS_WITH_RESEARCH' }),
    ).rejects.toThrow();
  });

  it('rejects override without a reason', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' });
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      aggregatePercentageThroughSem6: 70,
    });

    await expect(
      service.setTrack('t1', 's1', {
        track: 'HONOURS_WITH_RESEARCH',
        eligibilityOverride: true,
      }),
    ).rejects.toThrow(/reason/i);
  });
});
