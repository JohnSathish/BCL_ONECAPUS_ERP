import { StudentImportHandler } from './student-import.handler';

describe('StudentImportHandler', () => {
  const prisma = {
    programVersion: { findMany: jest.fn() },

    admissionBatch: { findMany: jest.fn() },

    academicStream: { findMany: jest.fn() },

    shift: { findMany: jest.fn() },

    department: { findMany: jest.fn() },

    student: { findMany: jest.fn() },

    masterLookup: { findMany: jest.fn() },

    academicYear: { findMany: jest.fn() },

    campus: { findMany: jest.fn() },
  };

  const handler = new StudentImportHandler(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.programVersion.findMany.mockResolvedValue([
      { id: 'pv-1', program: { code: 'BCA' } },
    ]);

    prisma.admissionBatch.findMany.mockResolvedValue([
      {
        id: 'batch-1',

        batchCode: '2026-BCA',

        currentSemester: 1,

        entrySessionId: 'session-1',
      },
    ]);

    prisma.academicStream.findMany.mockResolvedValue([
      { id: 'stream-1', code: 'SCIENCE' },
    ]);

    prisma.shift.findMany.mockResolvedValue([
      { id: 'shift-1', code: 'MORNING', campusId: 'campus-1' },
    ]);

    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', code: 'CS', campusId: 'campus-1' },
    ]);

    prisma.student.findMany.mockResolvedValue([]);

    prisma.masterLookup.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        code: 'GENERAL',
        label: 'General',
        lookupType: 'CATEGORY',
      },

      {
        id: 'rel-1',
        code: 'CHRISTIAN',
        label: 'Christian',
        lookupType: 'RELIGION',
      },
    ]);

    prisma.academicYear.findMany.mockResolvedValue([
      { id: 'session-1', name: '2026-27' },
    ]);

    prisma.campus.findMany.mockResolvedValue([{ id: 'campus-1' }]);
  });

  it('validates a correct row', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,

        raw: {
          registrationNumber: 'REG001',

          rollNumber: '001',

          fullName: 'Jane Doe',

          email: 'jane@example.com',

          programmeCode: 'BCA',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',

          categoryCode: 'GENERAL',
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');

    expect(results[0]?.normalized?.programVersionId).toBe('pv-1');
  });

  it('rejects duplicate registration in file', async () => {
    const rows = [
      {
        rowNumber: 2,

        raw: {
          registrationNumber: 'REG001',

          fullName: 'A',

          email: 'a@example.com',

          programmeCode: 'BCA',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',
        },
      },

      {
        rowNumber: 3,

        raw: {
          registrationNumber: 'REG001',

          fullName: 'B',

          email: 'b@example.com',

          programmeCode: 'BCA',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',
        },
      },
    ];

    const results = await handler.parseAndValidate('tenant', rows);

    expect(results[1]?.status).toBe('INVALID');

    expect(results[1]?.errors.join(' ')).toMatch(/Duplicate registration/);
  });

  it('rejects unknown programme code', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,

        raw: {
          registrationNumber: 'REG002',

          fullName: 'Jane',

          email: 'jane@example.com',

          programmeCode: 'UNKNOWN',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',
        },
      },
    ]);

    expect(results[0]?.status).toBe('INVALID');

    expect(results[0]?.errors.join(' ')).toMatch(/Unknown programme/);
  });

  it('resolves shift by campus when duplicate codes exist across campuses', async () => {
    prisma.shift.findMany.mockResolvedValue([
      { id: 'shift-a', code: 'MORNING', campusId: 'campus-a' },

      { id: 'shift-b', code: 'MORNING', campusId: 'campus-b' },
    ]);

    prisma.campus.findMany.mockResolvedValue([
      { id: 'campus-a' },
      { id: 'campus-b' },
    ]);

    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', code: 'CS', campusId: 'campus-b' },
    ]);

    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,

        raw: {
          registrationNumber: 'REG003',

          fullName: 'Jane',

          email: 'jane@example.com',

          programmeCode: 'BCA',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',

          majorDeptCode: 'CS',
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');

    expect(results[0]?.normalized?.shiftId).toBe('shift-b');
  });

  it('allows existing registration in MERGE mode', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',

        enrollmentNumber: 'REG001',

        rollNumber: '001',

        rfidNumber: null,

        user: { email: 'jane@example.com' },

        masterProfile: { nationalId: null },
      },
    ]);

    const results = await handler.parseAndValidate(
      'tenant',

      [
        {
          rowNumber: 2,

          raw: {
            registrationNumber: 'REG001',

            rollNumber: '001',

            fullName: 'Jane Doe',

            email: 'jane@example.com',

            programmeCode: 'BCA',

            batchCode: '2026-BCA',

            streamCode: 'SCIENCE',

            shiftCode: 'MORNING',
          },
        },
      ],

      { importMode: 'MERGE' },
    );

    expect(results[0]?.status).toBe('VALID');

    expect(results[0]?.normalized?.existingStudentId).toBe('student-1');
  });

  it('flags semester override when current semester differs from batch', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,

        raw: {
          registrationNumber: 'REG004',

          fullName: 'Jane',

          email: 'jane2@example.com',

          programmeCode: 'BCA',

          batchCode: '2026-BCA',

          streamCode: 'SCIENCE',

          shiftCode: 'MORNING',

          currentSemester: 3,
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');

    expect(results[0]?.normalized?.semesterOverride).toBe(true);

    expect(results[0]?.normalized?.currentSemester).toBe(3);
  });

  it('parses CODE - Name dropdown values when resolving subject codes', () => {
    const parsed = (
      handler as unknown as {
        parseSubjectImportInput: (v: string) => { codeCandidate: string };
      }
    ).parseSubjectImportInput('GAR100 - Garo Major');
    expect(parsed.codeCandidate).toBe('GAR100');
  });

  it('parses plain course codes from subject code columns', () => {
    const parsed = (
      handler as unknown as {
        parseSubjectImportInput: (v: string) => { codeCandidate: string };
      }
    ).parseSubjectImportInput('EDU101');
    expect(parsed.codeCandidate).toBe('EDU101');
  });
});
