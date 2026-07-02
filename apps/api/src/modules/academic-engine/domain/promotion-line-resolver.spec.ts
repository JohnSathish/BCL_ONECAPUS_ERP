import {
  priorLineSlotKey,
  resolveSuccessorOfferingId,
} from './promotion-line-resolver';

describe('promotion-line-resolver', () => {
  it('builds major slot keys with paper index', () => {
    expect(priorLineSlotKey('MAJOR', 2)).toBe('MAJOR-2');
    expect(priorLineSlotKey('MDC', null)).toBe('MDC');
  });

  it('maps ECO-100 major offering to ECO-150 via department match', async () => {
    const prisma = {
      programPromotionMapping: { findFirst: jest.fn().mockResolvedValue(null) },
      courseOffering: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'offering-eco-150',
            category: 'MAJOR',
            majorPaperIndex: null,
            course: {
              id: 'course-eco-150',
              code: 'ECO-150',
              departmentId: 'dept-eco',
              subjectSlug: 'economics',
              department: { id: 'dept-eco', code: 'ECO', name: 'Economics' },
            },
          },
        ]),
      },
    };

    const successor = await resolveSuccessorOfferingId(prisma as never, {
      tenantId: 'tenant-1',
      programVersionId: 'pv-ba-eco',
      toSequence: 2,
      priorLine: {
        offeringId: 'offering-eco-100',
        category: 'MAJOR',
        majorPaperIndex: null,
        course: {
          id: 'course-eco-100',
          code: 'ECO-100',
          departmentId: 'dept-eco',
          subjectSlug: 'economics',
          department: { id: 'dept-eco', code: 'ECO', name: 'Economics' },
        },
      },
      subjectSlug: 'economics',
    });

    expect(successor).toBe('offering-eco-150');
  });

  it('maps POL-100 minor offering to POL-151 via department match', async () => {
    const prisma = {
      programPromotionMapping: { findFirst: jest.fn().mockResolvedValue(null) },
      courseOffering: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'offering-pol-151',
            category: 'MINOR',
            majorPaperIndex: null,
            course: {
              id: 'course-pol-151',
              code: 'POL-151',
              departmentId: 'dept-pol',
              subjectSlug: 'political-science',
              department: {
                id: 'dept-pol',
                code: 'POL',
                name: 'Political Science',
              },
            },
          },
        ]),
      },
    };

    const successor = await resolveSuccessorOfferingId(prisma as never, {
      tenantId: 'tenant-1',
      programVersionId: 'pv-ba-eco',
      toSequence: 2,
      priorLine: {
        offeringId: 'offering-pol-100-minor',
        category: 'MINOR',
        majorPaperIndex: null,
        course: {
          id: 'course-pol-100',
          code: 'POL-100',
          departmentId: 'dept-pol',
          subjectSlug: 'political-science',
          department: {
            id: 'dept-pol',
            code: 'POL',
            name: 'Political Science',
          },
        },
      },
      subjectSlug: 'political-science',
    });

    expect(successor).toBe('offering-pol-151');
  });
});
