import { assertAdvancedSemesterDocuments } from './advanced-semester-document-gate';

describe('assertAdvancedSemesterDocuments', () => {
  const prisma = {
    student: { findFirst: jest.fn() },
    studentDocument: { findMany: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('skips below semester 7', async () => {
    await expect(
      assertAdvancedSemesterDocuments(prisma as never, 't1', 's1', 6),
    ).resolves.toBeUndefined();
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('requires marksheet for Sem 7+', async () => {
    prisma.student.findFirst.mockResolvedValue({
      masterProfile: { admissionType: 'REGULAR' },
    });
    prisma.studentDocument.findMany.mockResolvedValue([]);

    await expect(
      assertAdvancedSemesterDocuments(prisma as never, 't1', 's1', 7),
    ).rejects.toThrow(/marksheet/i);
  });

  it('requires migration doc for LATERAL Sem 7+', async () => {
    prisma.student.findFirst.mockResolvedValue({
      masterProfile: { admissionType: 'LATERAL' },
    });
    prisma.studentDocument.findMany.mockResolvedValue([
      { documentType: 'MARKSHEET' },
    ]);

    await expect(
      assertAdvancedSemesterDocuments(prisma as never, 't1', 's1', 7),
    ).rejects.toThrow(/MIGRATION|TC/i);
  });

  it('passes when marksheet and migration present for LATERAL', async () => {
    prisma.student.findFirst.mockResolvedValue({
      masterProfile: { admissionType: 'LATERAL' },
    });
    prisma.studentDocument.findMany.mockResolvedValue([
      { documentType: 'MARKSHEETS_STD_X_ONWARDS' },
      { documentType: 'MIGRATION' },
    ]);

    await expect(
      assertAdvancedSemesterDocuments(prisma as never, 't1', 's1', 8),
    ).resolves.toBeUndefined();
  });
});
