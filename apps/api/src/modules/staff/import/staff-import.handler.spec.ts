import { StaffImportHandler } from './staff-import.handler';

describe('StaffImportHandler', () => {
  const prisma = {
    department: { findMany: jest.fn() },
    designation: { findMany: jest.fn() },
    shift: { findMany: jest.fn() },
    course: { findMany: jest.fn() },
    staffProfile: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };

  const provisioning = {
    create: jest.fn(),
    mergeFromImport: jest.fn(),
  };

  const commitHelper = {
    applyPostProfileSteps: jest.fn(),
  };

  const handler = new StaffImportHandler(
    prisma as never,
    provisioning as never,
    commitHelper as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', code: 'CS', name: 'Computer Science' },
    ]);
    prisma.designation.findMany.mockResolvedValue([
      { id: 'des-1', code: 'PROF', label: 'Professor' },
    ]);
    prisma.shift.findMany.mockResolvedValue([
      { id: 'shift-1', code: 'MORNING' },
    ]);
    prisma.course.findMany.mockResolvedValue([
      { id: 'course-1', code: 'CS101' },
      { id: 'course-2', code: 'CS102' },
    ]);
    prisma.staffProfile.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('validates a teaching staff row', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,
        raw: {
          employeeCode: 'EMP1001',
          fullName: 'Jane Faculty',
          mobile: '9876543210',
          email: 'jane@demo.edu',
          staffType: 'TEACHING',
          departmentCode: 'CS',
          subjectCodes: 'CS101,CS102',
          createPortalUser: 'YES',
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.courseIds).toEqual(['course-1', 'course-2']);
  });

  it('rejects duplicate staff code in CREATE mode', async () => {
    prisma.staffProfile.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        employeeCode: 'EMP1001',
        email: 'existing@demo.edu',
        mobile: '9000000000',
      },
    ]);

    const results = await handler.parseAndValidate(
      'tenant',
      [
        {
          rowNumber: 2,
          raw: {
            employeeCode: 'EMP1001',
            fullName: 'Jane Faculty',
            mobile: '9876543210',
            staffType: 'TEACHING',
            departmentCode: 'CS',
          },
        },
      ],
      { importMode: 'CREATE' },
    );

    expect(results[0]?.status).toBe('INVALID');
    expect(results[0]?.errors).toContain('Staff code already exists');
  });

  it('allows existing staff code in MERGE mode', async () => {
    prisma.staffProfile.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        employeeCode: 'EMP1001',
        email: 'jane@demo.edu',
        mobile: '9876543210',
      },
    ]);

    const results = await handler.parseAndValidate(
      'tenant',
      [
        {
          rowNumber: 2,
          raw: {
            employeeCode: 'EMP1001',
            fullName: 'Jane Faculty Updated',
            mobile: '9876543210',
            email: 'jane@demo.edu',
            staffType: 'TEACHING',
            departmentCode: 'CS',
            createPortalUser: 'NO',
          },
        },
      ],
      { importMode: 'MERGE' },
    );

    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.existingStaffId).toBe('staff-1');
  });

  it('rejects invalid staff type', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,
        raw: {
          employeeCode: 'EMP1002',
          fullName: 'Bad Type',
          mobile: '9876543210',
          staffType: 'INVALID_TYPE',
          departmentCode: 'CS',
        },
      },
    ]);

    expect(results[0]?.status).toBe('INVALID');
    expect(
      results[0]?.errors.some((e) => e.includes('Invalid staff type')),
    ).toBe(true);
  });

  it('warns on unknown subject codes for teaching staff', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,
        raw: {
          employeeCode: 'EMP1003',
          fullName: 'Jane Faculty',
          mobile: '9876543210',
          staffType: 'TEACHING',
          departmentCode: 'CS',
          subjectCodes: 'CS101,UNKNOWN999',
          createPortalUser: 'NO',
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.warnings?.some((w) => w.includes('UNKNOWN999'))).toBe(
      true,
    );
  });

  it('respects create_portal_user NO', async () => {
    const results = await handler.parseAndValidate('tenant', [
      {
        rowNumber: 2,
        raw: {
          employeeCode: 'EMP1004',
          fullName: 'No Portal',
          mobile: '9876543210',
          staffType: 'NON_TEACHING',
          departmentCode: 'CS',
          createPortalUser: 'NO',
        },
      },
    ]);

    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.createPortalAccount).toBe(false);
  });

  it('creates staff and applies post steps on commit', async () => {
    provisioning.create.mockResolvedValue({ staff: { id: 'new-staff-1' } });
    commitHelper.applyPostProfileSteps.mockResolvedValue(undefined);

    const normalized = {
      employeeCode: 'EMP2000',
      fullName: 'New Staff',
      mobile: '9876543210',
      staffType: 'TEACHING',
      departmentId: 'dept-1',
      courseIds: ['course-1'],
      createPortalAccount: true,
      email: 'new@demo.edu',
    };

    const created = await handler.commitRows(
      {
        tenantId: 'tenant',
        userId: 'user-1',
        batchId: 'batch-1',
        options: { importMode: 'CREATE' },
      },
      [{ rowNumber: 2, normalized: normalized as never }],
    );

    expect(provisioning.create).toHaveBeenCalled();
    expect(commitHelper.applyPostProfileSteps).toHaveBeenCalledWith(
      'tenant',
      'new-staff-1',
      normalized,
      { replaceEligibility: false },
    );
    expect(created[0]?.entityId).toBe('new-staff-1');
  });
});
