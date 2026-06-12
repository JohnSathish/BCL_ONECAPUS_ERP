import { BadRequestException } from '@nestjs/common';
import { AcademicCatalogService } from './academic-catalog.service';

describe('AcademicCatalogService academic department guard', () => {
  const shiftScope = {} as never;
  const sectionStreams = {} as never;

  it('rejects administrative department when creating a programme', async () => {
    const prisma = {
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'd-admin',
          departmentType: 'ADMINISTRATIVE',
          name: 'Administration',
        }),
      },
      program: { findFirst: jest.fn() },
    };
    const service = new AcademicCatalogService(
      prisma as never,
      shiftScope,
      sectionStreams,
    );

    await expect(
      service.createProgram('tenant-1', {
        code: 'BA-ENG',
        name: 'English Honours',
        departmentId: 'd-admin',
        level: 'UG',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createProgram('tenant-1', {
        code: 'BA-ENG',
        name: 'English Honours',
        departmentId: 'd-admin',
        level: 'UG',
      }),
    ).rejects.toThrow(/academic department/i);
  });

  it('allows academic department when creating a programme', async () => {
    const prisma = {
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'd-arts',
          departmentType: 'ARTS',
          name: 'Economics',
        }),
      },
      program: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'p1', code: 'BA-ECO' }),
      },
    };
    const service = new AcademicCatalogService(
      prisma as never,
      shiftScope,
      sectionStreams,
    );

    await service.createProgram('tenant-1', {
      code: 'BA-ECO',
      name: 'Economics Honours',
      departmentId: 'd-arts',
      level: 'UG',
    });

    expect(prisma.program.create).toHaveBeenCalled();
  });
});
