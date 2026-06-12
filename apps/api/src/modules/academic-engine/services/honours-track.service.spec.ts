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

  it('warns when aggregate is below research threshold', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      70,
      false,
    );
    expect(result.warning).toContain(
      String(HONOURS_RESEARCH_ELIGIBILITY_PERCENT),
    );
    expect(result.eligible).toBe(true);
  });

  it('allows research track with eligibility override', () => {
    const result = service.evaluateEligibility(
      'HONOURS_WITH_RESEARCH',
      60,
      true,
    );
    expect(result.warning).toBeNull();
    expect(result.eligibilityOverride).toBe(true);
  });

  it('persists track selection for student', async () => {
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
});
