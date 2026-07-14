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

    // Concurrent-cohort model: every FYUGP semester (1..N) runs inside ONE
    // operational academic year — odd semesters (1,3,5) in the Jul–Dec cycle and
    // even semesters (2,4,6) in the Jan–Jun cycle, taught in parallel to the
    // different year-groups. resolveCalendarSemester() and activateCycle() assume
    // exactly one Semester row per number anchored to the current year, so we must
    // NOT scatter semesters across future academic years — doing so strands senior
    // cohorts on years they are not actually studying in.
    const yearStart = new Date(baseStart);
    const yearEnd = new Date(yearStart);
    yearEnd.setFullYear(yearEnd.getFullYear() + 1);
    yearEnd.setDate(yearEnd.getDate() - 1);

    const cycleSplit = new Date(yearStart);
    cycleSplit.setMonth(cycleSplit.getMonth() + 6);

    const oddStart = new Date(yearStart);
    const oddEnd = new Date(cycleSplit);
    oddEnd.setDate(oddEnd.getDate() - 1);
    const evenStart = new Date(cycleSplit);
    const evenEnd = new Date(yearEnd);

    return this.prisma.$transaction(async (tx) => {
      const ay = await tx.academicYear.create({
        data: {
          tenantId,
          institutionId,
          name: baseYearName,
          startDate: yearStart,
          endDate: yearEnd,
          status: 'ACTIVE',
          academicYearIndex: 1,
        },
      });

      const definitions = FYUGP_6_SEMESTERS.filter(
        (s) => s.semesterNumber <= config.maxActiveSemesters,
      );

      for (const def of definitions) {
        const isOdd = def.semesterType === 'ODD';
        await tx.semester.create({
          data: {
            tenantId,
            institutionId,
            academicYearId: ay.id,
            name: `Semester ${def.semesterNumber}`,
            // Within-year sequence must be unique per academic year
            // (@@unique([academicYearId, sequence])); use the program semester
            // number so all slots are distinct and list in order 1..N.
            sequence: def.semesterNumber,
            semesterNumber: def.semesterNumber,
            semesterType: def.semesterType,
            progressionOrder: def.progressionOrder,
            // Program year (1/2/3) the semester belongs to — not the calendar year.
            academicYearIndex: def.academicYearIndex,
            isTerminal: def.isTerminal,
            status: 'PLANNED',
            startDate: isOdd ? oddStart : evenStart,
            endDate: isOdd ? oddEnd : evenEnd,
          },
        });
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
