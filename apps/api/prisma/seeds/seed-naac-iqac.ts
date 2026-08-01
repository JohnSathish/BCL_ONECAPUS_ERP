import type { PrismaClient } from '@prisma/client';
import metricsData from './naac-metrics.json';
import tablesData from './naac-metric-tables.json';

const AQAR_SECTION_KEYS = [
  'profile',
  'criterion_1',
  'criterion_2',
  'criterion_3',
  'criterion_4',
  'criterion_5',
  'criterion_6',
  'criterion_7',
  'best_practices',
  'institutional_distinctiveness',
] as const;

type SeedMetric = {
  criterion: number;
  keyIndicator?: string;
  code: string;
  title: string;
  dataType: string;
  metricType?: string;
  isMandatory: boolean;
  weightage?: number;
  parentCode?: string;
  benchmarkNotes?: string;
  erpSourceKey?: string;
};

type SeedKeyIndicator = {
  criterion: number;
  code: string;
  title: string;
  description?: string;
  sortOrder?: number;
};

export async function seedNaacIqac(prisma: PrismaClient, tenantId: string) {
  const db = prisma as unknown as Record<string, any>;

  for (const c of metricsData.criteria) {
    await db.naacCriterion.upsert({
      where: { tenantId_criterion: { tenantId, criterion: c.criterion } },
      update: {
        title: c.title,
        description: c.description,
        sortOrder: c.criterion,
      },
      create: {
        tenantId,
        criterion: c.criterion,
        title: c.title,
        description: c.description,
        sortOrder: c.criterion,
      },
    });
  }

  const criteriaRows = await db.naacCriterion.findMany({ where: { tenantId } });
  const criterionByNum = new Map(
    criteriaRows.map((r: { criterion: number; id: string }) => [
      r.criterion,
      r.id,
    ]),
  );

  const keyIndicators = (metricsData as { keyIndicators?: SeedKeyIndicator[] })
    .keyIndicators;
  if (keyIndicators?.length) {
    for (const ki of keyIndicators) {
      const criterionId = criterionByNum.get(ki.criterion);
      if (!criterionId) continue;
      await db.naacKeyIndicator.upsert({
        where: { tenantId_code: { tenantId, code: ki.code } },
        update: {
          title: ki.title,
          description: ki.description ?? null,
          criterionId,
          sortOrder: ki.sortOrder ?? 0,
        },
        create: {
          tenantId,
          criterionId,
          code: ki.code,
          title: ki.title,
          description: ki.description ?? null,
          sortOrder: ki.sortOrder ?? 0,
        },
      });
    }
  }

  const kiRows = await db.naacKeyIndicator.findMany({ where: { tenantId } });
  const kiByCode = new Map(
    kiRows.map((r: { code: string; id: string }) => [r.code, r.id]),
  );

  let metricCount = 0;
  for (const m of metricsData.metrics as SeedMetric[]) {
    const criterionId = criterionByNum.get(m.criterion);
    if (!criterionId) continue;
    const keyIndicatorId = m.keyIndicator
      ? (kiByCode.get(m.keyIndicator) ?? null)
      : null;
    await db.naacMetric.upsert({
      where: { tenantId_code: { tenantId, code: m.code } },
      update: {
        title: m.title,
        dataType: m.dataType,
        metricType: m.metricType ?? 'QLM',
        isMandatory: m.isMandatory,
        criterionId,
        keyIndicatorId,
        weightage: m.weightage ?? null,
        parentCode: m.parentCode ?? null,
        benchmarkNotes: m.benchmarkNotes ?? null,
        erpSourceKey: m.erpSourceKey ?? null,
        sortOrder: metricCount,
      },
      create: {
        tenantId,
        criterionId,
        keyIndicatorId,
        code: m.code,
        title: m.title,
        dataType: m.dataType,
        metricType: m.metricType ?? 'QLM',
        isMandatory: m.isMandatory,
        weightage: m.weightage ?? null,
        parentCode: m.parentCode ?? null,
        benchmarkNotes: m.benchmarkNotes ?? null,
        erpSourceKey: m.erpSourceKey ?? null,
        sortOrder: metricCount,
      },
    });
    metricCount += 1;
  }

  await db.naacSettings.upsert({
    where: { tenantId },
    update: {
      activeAqarYear: '2025-26',
      institutionProfile: {
        name: 'Don Bosco College Tura',
        affiliation: 'NEHU, Shillong',
        naacCycle: 'Cycle 2',
      },
    },
    create: {
      tenantId,
      activeAqarYear: '2025-26',
      institutionProfile: {
        name: 'Don Bosco College Tura',
        affiliation: 'NEHU, Shillong',
        naacCycle: 'Cycle 2',
      },
    },
  });

  const academicYear = '2025-26';
  const allMetrics = await db.naacMetric.findMany({
    where: { tenantId },
    select: { id: true },
  });
  for (const metric of allMetrics) {
    await db.naacMetricWorkspace.upsert({
      where: {
        tenantId_metricId_academicYear: {
          tenantId,
          metricId: metric.id,
          academicYear,
        },
      },
      update: {},
      create: {
        tenantId,
        metricId: metric.id,
        academicYear,
        status: 'NOT_STARTED',
        progressPct: 0,
      },
    });
  }

  let tableDefCount = 0;
  const tableCatalog = tablesData as {
    tables?: Array<{
      code: string;
      sheetName: string;
      title: string;
      metricCodes: string[];
      columns: unknown;
      layoutHints?: unknown;
      sortOrder?: number;
    }>;
  };
  for (const t of tableCatalog.tables ?? []) {
    await db.naacMetricTableDefinition.upsert({
      where: { tenantId_code: { tenantId, code: t.code } },
      update: {
        sheetName: t.sheetName,
        title: t.title,
        metricCodes: t.metricCodes,
        columns: t.columns,
        layoutHints: t.layoutHints ?? {},
        sortOrder: t.sortOrder ?? tableDefCount,
      },
      create: {
        tenantId,
        code: t.code,
        sheetName: t.sheetName,
        title: t.title,
        metricCodes: t.metricCodes,
        columns: t.columns,
        layoutHints: t.layoutHints ?? {},
        sortOrder: t.sortOrder ?? tableDefCount,
      },
    });
    tableDefCount += 1;
  }

  const aqar = await db.naacAqar.upsert({
    where: { tenantId_academicYear: { tenantId, academicYear } },
    update: { title: 'AQAR 2025-26' },
    create: {
      tenantId,
      academicYear,
      title: 'AQAR 2025-26',
      status: 'DRAFT',
      institutionProfile: { year: academicYear },
    },
  });

  for (const sectionKey of AQAR_SECTION_KEYS) {
    await db.naacAqarSection.upsert({
      where: {
        tenantId_aqarId_sectionKey: { tenantId, aqarId: aqar.id, sectionKey },
      },
      update: {},
      create: {
        tenantId,
        aqarId: aqar.id,
        sectionKey,
        content: {},
        completionPct: 0,
      },
    });
  }

  const calendarEvents = [
    {
      title: 'AQAR 2025-26 Submission Due',
      eventType: 'AQAR_DUE',
      dueDate: new Date('2026-06-30'),
      description: 'Submit AQAR to NAAC',
    },
    {
      title: 'IQAC Quarterly Meeting',
      eventType: 'IQAC_MEETING',
      dueDate: new Date('2026-03-15'),
      description: 'Review criterion-wise progress',
    },
    {
      title: 'Department NAAC Data Submission',
      eventType: 'DEPT_SUBMISSION',
      dueDate: new Date('2026-04-30'),
      description: 'All departments submit evidence',
    },
    {
      title: 'Academic Audit',
      eventType: 'ACADEMIC_AUDIT',
      dueDate: new Date('2026-02-28'),
      description: 'Internal academic audit',
    },
    {
      title: 'Feedback Collection',
      eventType: 'FEEDBACK',
      dueDate: new Date('2026-01-31'),
      description: 'Student and stakeholder feedback',
    },
  ];

  for (const ev of calendarEvents) {
    const existing = await db.naacCalendarEvent.findFirst({
      where: { tenantId, title: ev.title, eventType: ev.eventType },
    });
    if (!existing) {
      await db.naacCalendarEvent.create({
        data: { tenantId, ...ev },
      });
    }
  }

  // Seed multi-level approval definitions (platform workflow engine)
  const metricSteps = [
    { stepOrder: 1, name: 'Faculty submit / attest', assigneeRole: 'FACULTY' },
    { stepOrder: 2, name: 'Metric Coordinator', assigneeRole: 'METRIC_COORD' },
    {
      stepOrder: 3,
      name: 'Criterion Coordinator',
      assigneeRole: 'CRITERION_COORD',
    },
    { stepOrder: 4, name: 'IQAC Coordinator', assigneeRole: 'IQAC_COORD' },
    { stepOrder: 5, name: 'Principal', assigneeRole: 'PRINCIPAL' },
  ];
  const dvvSteps = [
    {
      stepOrder: 1,
      name: 'Metric Coordinator review',
      assigneeRole: 'METRIC_COORD',
    },
    { stepOrder: 2, name: 'IQAC Coordinator', assigneeRole: 'IQAC_COORD' },
    { stepOrder: 3, name: 'Principal', assigneeRole: 'PRINCIPAL' },
  ];

  for (const def of [
    {
      code: 'NAAC_METRIC_APPROVAL',
      name: 'NAAC Metric Approval',
      entityType: 'NaacMetricWorkspace',
      steps: metricSteps,
    },
    {
      code: 'NAAC_DVV_CLARIFICATION',
      name: 'NAAC DVV Clarification Approval',
      entityType: 'NaacDvvClarification',
      steps: dvvSteps,
    },
  ]) {
    const existing = await db.workflowDefinition.findUnique({
      where: { tenantId_code: { tenantId, code: def.code } },
    });
    const metadata = {
      overridePermission: 'naac-iqac:manage',
      approvalFacade: true,
    };
    if (existing) {
      await db.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          name: def.name,
          entityType: def.entityType,
          isActive: true,
          metadata,
        },
      });
      await db.workflowStep.deleteMany({
        where: { definitionId: existing.id },
      });
      await db.workflowStep.createMany({
        data: def.steps.map((s) => ({
          tenantId,
          definitionId: existing.id,
          stepOrder: s.stepOrder,
          name: s.name,
          assigneeRole: s.assigneeRole,
        })),
      });
    } else {
      await db.workflowDefinition.create({
        data: {
          tenantId,
          code: def.code,
          name: def.name,
          description: def.name,
          entityType: def.entityType,
          isActive: true,
          metadata,
          steps: {
            create: def.steps.map((s) => ({
              tenantId,
              stepOrder: s.stepOrder,
              name: s.name,
              assigneeRole: s.assigneeRole,
            })),
          },
        },
      });
    }
  }

  return {
    criterionCount: metricsData.criteria.length,
    keyIndicatorCount: keyIndicators?.length ?? 0,
    metricCount,
    workspaceCount: allMetrics.length,
    tableDefinitionCount: tableDefCount,
    aqarId: aqar.id,
  };
}
