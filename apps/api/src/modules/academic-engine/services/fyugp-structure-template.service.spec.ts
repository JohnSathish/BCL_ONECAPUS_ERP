import { FyugpStructureTemplateService } from './fyugp-structure-template.service';

describe('FyugpStructureTemplateService', () => {
  const prisma = {
    fyugpStructureTemplate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    programVersion: {
      findMany: jest.fn(),
    },
    semesterStructureRule: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    programStructureTemplate: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const academicCatalog = {
    assertProgramVersion: jest.fn(),
  };

  const service = new FyugpStructureTemplateService(
    prisma as never,
    academicCatalog as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves ALL_UG programme versions', async () => {
    prisma.programVersion.findMany.mockResolvedValue([
      {
        id: 'pv-1',
        version: 1,
        program: { id: 'p-1', code: 'BA', name: 'BA Education', level: 'UG' },
      },
    ]);

    const targets = await service.resolveApplyTargets('tenant-1', {
      mode: 'ALL_UG',
    });

    expect(prisma.programVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          program: expect.objectContaining({ level: 'UG' }),
        }),
      }),
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].programCode).toBe('BA');
  });

  it('preview marks existing versions as skipped when using SKIP_EXISTING', async () => {
    prisma.fyugpStructureTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      tenantId: 'tenant-1',
      templateName: 'NEHU FYUGP UG Structure 2026',
      totalSemesters: 8,
      lines: [
        {
          semesterNo: 1,
          categoryType: 'MAJOR',
          subjectCount: 1,
          continuityRule: null,
          creditRule: null,
          optionalFlag: false,
        },
      ],
    });
    prisma.programVersion.findMany.mockResolvedValue([
      {
        id: 'pv-1',
        version: 1,
        program: { id: 'p-1', code: 'BA', name: 'BA Education', level: 'UG' },
      },
    ]);
    prisma.semesterStructureRule.findMany.mockResolvedValue([
      {
        programVersionId: 'pv-1',
        semesterSequence: 1,
        categoryCounts: { MAJOR: 2 },
        continuityRules: {},
        categoryMeta: null,
      },
    ]);

    const preview = await service.previewApply('tenant-1', 'tpl-1', {
      mode: 'ALL_UG',
      conflictStrategy: 'SKIP_EXISTING',
    });

    expect(preview.items[0].skipped).toBe(true);
    expect(preview.items[0].skippedReason).toContain('Existing');
  });

  it('preview includes changed semesters for REPLACE_ALL', async () => {
    prisma.fyugpStructureTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      tenantId: 'tenant-1',
      templateName: 'NEHU FYUGP UG Structure 2026',
      totalSemesters: 8,
      lines: [
        {
          semesterNo: 1,
          categoryType: 'MAJOR',
          subjectCount: 1,
          continuityRule: null,
          creditRule: null,
          optionalFlag: false,
        },
        {
          semesterNo: 1,
          categoryType: 'MINOR',
          subjectCount: 1,
          continuityRule: null,
          creditRule: null,
          optionalFlag: false,
        },
      ],
    });
    prisma.programVersion.findMany.mockResolvedValue([
      {
        id: 'pv-1',
        version: 1,
        program: { id: 'p-1', code: 'BA', name: 'BA Education', level: 'UG' },
      },
    ]);
    prisma.semesterStructureRule.findMany.mockResolvedValue([
      {
        programVersionId: 'pv-1',
        semesterSequence: 1,
        categoryCounts: { MAJOR: 2 },
        continuityRules: {},
        categoryMeta: null,
      },
    ]);

    const preview = await service.previewApply('tenant-1', 'tpl-1', {
      mode: 'SELECTED_VERSIONS',
      programVersionIds: ['pv-1'],
      conflictStrategy: 'REPLACE_ALL',
    });

    expect(preview.items[0].skipped).toBe(false);
    expect(preview.items[0].changedSemesters).toContain(1);
  });
});
