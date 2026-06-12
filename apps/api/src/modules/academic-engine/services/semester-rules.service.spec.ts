import { SemesterRulesService } from './semester-rules.service';
import {
  DEFAULT_SEMESTER_8_PATHWAY_VARIANTS,
  DEFAULT_FYUGP_SEMESTER_RULES,
} from '../domain/fyugp-templates';

describe('SemesterRulesService', () => {
  const sem7 = DEFAULT_FYUGP_SEMESTER_RULES.find(
    (r) => r.semesterSequence === 7,
  )!;
  const sem8 = DEFAULT_FYUGP_SEMESTER_RULES.find(
    (r) => r.semesterSequence === 8,
  )!;

  const prisma = {
    semesterStructureRule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    programStructureTemplate: {
      findFirst: jest.fn(),
    },
    studentAcademicTrack: {
      findFirst: jest.fn(),
    },
  };

  const service = new SemesterRulesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.programStructureTemplate.findFirst.mockResolvedValue({
      semesterCreditTarget: 20,
    });
  });

  it('returns resolved semester 7 rule with summary', async () => {
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      semesterSequence: 7,
      categoryCounts: sem7.categoryCounts,
      continuityRules: sem7.continuityRules,
      categoryMeta: sem7.categoryMeta,
      pathwayVariants: null,
      semesterCreditTarget: 20,
      lines: [],
    });

    const result = await service.getSemesterRule('tenant', 'pv-1', 7);
    expect(result.categoryCounts).toEqual({ MAJOR: 3, MINOR: 2 });
    expect(result.summary).toBe('3 Major + 2 Minor');
  });

  it('merges semester 8 honours-with-research pathway', async () => {
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      semesterSequence: 8,
      categoryCounts: sem8.categoryCounts,
      continuityRules: sem8.continuityRules,
      categoryMeta: sem8.categoryMeta,
      pathwayVariants: DEFAULT_SEMESTER_8_PATHWAY_VARIANTS,
      semesterCreditTarget: 20,
      lines: [],
    });

    const result = await service.getSemesterRule(
      'tenant',
      'pv-1',
      8,
      'HONOURS_WITH_RESEARCH',
    );
    expect(result.categoryCounts).toEqual({ DISSERTATION: 1, MAJOR: 2 });
    expect(result.honoursTrack).toBe('HONOURS_WITH_RESEARCH');
  });

  it('defaults honours track to HONOURS when no student track record', async () => {
    prisma.studentAcademicTrack.findFirst.mockResolvedValue(null);
    const track = await service.resolveHonoursTrackForStudent(
      'tenant',
      'student-1',
      8,
    );
    expect(track).toBe('HONOURS');
  });
});
