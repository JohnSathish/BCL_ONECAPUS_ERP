import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InstitutionAcademicConfigService } from './institution-academic-config.service';
import type { ProvisionFyugpDto } from '../dto/academic-lifecycle.dto';

const FYUGP_6_SEMESTERS: {
  semesterNumber: number;
  semesterType: string;
  academicYearIndex: number;
  progressionOrder: number;
  isTerminal: boolean;
  sequenceInYear: number;
}[] = [
  {
    semesterNumber: 1,
    semesterType: 'ODD',
    academicYearIndex: 1,
    progressionOrder: 1,
    isTerminal: false,
    sequenceInYear: 1,
  },
  {
    semesterNumber: 2,
    semesterType: 'EVEN',
    academicYearIndex: 1,
    progressionOrder: 2,
    isTerminal: false,
    sequenceInYear: 2,
  },
  {
    semesterNumber: 3,
    semesterType: 'ODD',
    academicYearIndex: 2,
    progressionOrder: 3,
    isTerminal: false,
    sequenceInYear: 1,
  },
  {
    semesterNumber: 4,
    semesterType: 'EVEN',
    academicYearIndex: 2,
    progressionOrder: 4,
    isTerminal: false,
    sequenceInYear: 2,
  },
  {
    semesterNumber: 5,
    semesterType: 'ODD',
    academicYearIndex: 3,
    progressionOrder: 5,
    isTerminal: false,
    sequenceInYear: 1,
  },
  {
    semesterNumber: 6,
    semesterType: 'EVEN',
    academicYearIndex: 3,
    progressionOrder: 6,
    isTerminal: true,
    sequenceInYear: 2,
  },
];

@Injectable()
export class SemesterLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: InstitutionAcademicConfigService,
  ) {}

  async getStructure(tenantId: string, institutionId: string) {
    const config = await this.configService.get(tenantId, institutionId);
    const years = await this.prisma.academicYear.findMany({
      where: { tenantId, institutionId, deletedAt: null },
      orderBy: { academicYearIndex: 'asc' },
      include: {
        semesters: {
          where: { deletedAt: null },
          orderBy: { progressionOrder: 'asc' },
        },
      },
    });

    return { config, years };
  }

  async provisionFyugp(
    tenantId: string,
    institutionId: string,
    dto: ProvisionFyugpDto,
  ) {
    const config = await this.configService.get(tenantId, institutionId);
    if (config.maxActiveSemesters < 6) {
      throw new BadRequestException(
        'Institution maxActiveSemesters must be at least 6 for FYUGP 3Y provision',
      );
    }

    const existing = await this.prisma.semester.count({
      where: {
        tenantId,
        institutionId,
        deletedAt: null,
        semesterNumber: { lte: config.maxActiveSemesters },
      },
    });
    if (existing >= config.maxActiveSemesters) {
      throw new ConflictException(
        'FYUGP semesters already provisioned for this institution',
      );
    }

    const baseStart = dto.startDate ?? new Date('2026-07-01');
    const baseYearName = dto.baseYearName ?? '2026-27';

    const createdYears: string[] = [];

    return this.prisma.$transaction(async (tx) => {
      for (let yearIdx = 1; yearIdx <= config.operationalYears; yearIdx++) {
        const yearStart = new Date(baseStart);
        yearStart.setFullYear(yearStart.getFullYear() + (yearIdx - 1));
        const yearEnd = new Date(yearStart);
        yearEnd.setFullYear(yearEnd.getFullYear() + 1);
        yearEnd.setDate(yearEnd.getDate() - 1);

        const yearName =
          yearIdx === 1
            ? baseYearName
            : `${yearStart.getFullYear()}-${String(yearEnd.getFullYear()).slice(-2)}`;

        const ay = await tx.academicYear.create({
          data: {
            tenantId,
            institutionId,
            name: yearName,
            startDate: yearStart,
            endDate: yearEnd,
            status: yearIdx === 1 ? 'ACTIVE' : 'UPCOMING',
            academicYearIndex: yearIdx,
          },
        });
        createdYears.push(ay.id);

        const semsForYear = FYUGP_6_SEMESTERS.filter(
          (s) => s.academicYearIndex === yearIdx,
        );

        for (const def of semsForYear) {
          const semStart = new Date(yearStart);
          if (def.sequenceInYear === 2) {
            semStart.setMonth(semStart.getMonth() + 5);
          }
          const semEnd = new Date(semStart);
          semEnd.setMonth(semEnd.getMonth() + 4);

          await tx.semester.create({
            data: {
              tenantId,
              institutionId,
              academicYearId: ay.id,
              name: `Semester ${def.semesterNumber}`,
              sequence: def.sequenceInYear,
              semesterNumber: def.semesterNumber,
              semesterType: def.semesterType,
              progressionOrder: def.progressionOrder,
              academicYearIndex: def.academicYearIndex,
              isTerminal: def.isTerminal,
              status: 'PLANNED',
              startDate: semStart,
              endDate: semEnd,
            },
          });
        }
      }

      return this.getStructure(tenantId, institutionId);
    });
  }

  async freezeSemester(
    tenantId: string,
    semesterId: string,
    frozenById?: string,
  ) {
    const sem = await this.prisma.semester.findFirst({
      where: { id: semesterId, tenantId, deletedAt: null },
    });
    if (!sem) throw new NotFoundException('Semester not found');
    if (sem.status === 'FROZEN') {
      throw new BadRequestException('Semester is already frozen');
    }

    return this.prisma.semester.update({
      where: { id: semesterId },
      data: {
        status: 'FROZEN',
        isActive: false,
        registrationOpen: false,
        attendanceEnabled: false,
        examinationEnabled: false,
        timetableEnabled: false,
        feeCycleEnabled: false,
        resultProcessingEnabled: false,
        frozenAt: new Date(),
        frozenById: frozenById ?? null,
      },
    });
  }

  async getSemester(tenantId: string, semesterId: string) {
    const sem = await this.prisma.semester.findFirst({
      where: { id: semesterId, tenantId, deletedAt: null },
      include: { academicYear: true },
    });
    if (!sem) throw new NotFoundException('Semester not found');
    return sem;
  }

  async getSemesterDefinition(
    tenantId: string,
    institutionId: string,
    semesterNumber: number,
  ) {
    const sem = await this.prisma.semester.findFirst({
      where: {
        tenantId,
        institutionId,
        semesterNumber,
        deletedAt: null,
      },
      include: { academicYear: true },
    });
    if (!sem) {
      throw new NotFoundException(
        `Semester ${semesterNumber} definition not found`,
      );
    }
    return sem;
  }
}
