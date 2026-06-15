import type { PrismaClient } from '@prisma/client';
import metricsData from './naac-metrics.json';

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

  let metricCount = 0;
  for (const m of metricsData.metrics) {
    const criterionId = criterionByNum.get(m.criterion);
    if (!criterionId) continue;
    await db.naacMetric.upsert({
      where: { tenantId_code: { tenantId, code: m.code } },
      update: {
        title: m.title,
        dataType: m.dataType,
        isMandatory: m.isMandatory,
        criterionId,
      },
      create: {
        tenantId,
        criterionId,
        code: m.code,
        title: m.title,
        dataType: m.dataType,
        isMandatory: m.isMandatory,
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

  const aqar = await db.naacAqar.upsert({
    where: { tenantId_academicYear: { tenantId, academicYear: '2025-26' } },
    update: { title: 'AQAR 2025-26' },
    create: {
      tenantId,
      academicYear: '2025-26',
      title: 'AQAR 2025-26',
      status: 'DRAFT',
      institutionProfile: { year: '2025-26' },
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

  return {
    criterionCount: metricsData.criteria.length,
    metricCount,
    aqarId: aqar.id,
  };
}
