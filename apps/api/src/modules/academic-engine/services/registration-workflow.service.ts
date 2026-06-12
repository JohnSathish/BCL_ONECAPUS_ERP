import { Injectable, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { RegistrationLineDto } from '../dto/academic-engine.dto';
import { isStudentChoiceCategory } from '../domain/registration-category-classification';

export type RegistrationWorkflowMode = 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID';

/** Phase 7 deferred — future admin add/drop policy (not yet persisted). */
export enum RegistrationAddDropPolicy {
  /** Add/drop disabled for the institution. */
  CLOSED = 'CLOSED',
  /** Administrators may add/drop on behalf of students. */
  ADMIN_ONLY = 'ADMIN_ONLY',
  /** Students may add/drop within an open window. */
  STUDENT_WINDOW = 'STUDENT_WINDOW',
}

export type RegistrationWorkflowSettings = {
  mode: RegistrationWorkflowMode;
  allowStudentSelfService: boolean;
  studentElectiveCategories: string[];
  batchRegistrationMode?: RegistrationWorkflowMode | null;
};

const DEFAULT_WORKFLOW: RegistrationWorkflowSettings = {
  mode: 'ADMIN_ONLY',
  allowStudentSelfService: false,
  studentElectiveCategories: ['MDC', 'SEC', 'AEC', 'VAC', 'VTC'],
};

@Injectable()
export class RegistrationWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  parseWorkflow(raw: unknown): RegistrationWorkflowSettings {
    if (!raw || typeof raw !== 'object') return DEFAULT_WORKFLOW;
    const o = raw as Record<string, unknown>;
    const mode = o.mode as RegistrationWorkflowMode;
    return {
      mode: mode === 'STUDENT_SELF' || mode === 'HYBRID' ? mode : 'ADMIN_ONLY',
      allowStudentSelfService: Boolean(o.allowStudentSelfService),
      studentElectiveCategories: Array.isArray(o.studentElectiveCategories)
        ? (o.studentElectiveCategories as string[])
        : DEFAULT_WORKFLOW.studentElectiveCategories,
    };
  }

  async getForStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: { campusId: true },
    });
    if (!student?.campusId) return DEFAULT_WORKFLOW;

    const [campus, academicProfile] = await Promise.all([
      this.prisma.campus.findUnique({
        where: { id: student.campusId },
        select: { institutionId: true },
      }),
      this.prisma.studentAcademicProfile.findUnique({
        where: { studentId },
        select: {
          admissionBatch: { select: { registrationMode: true } },
        },
      }),
    ]);

    if (!campus?.institutionId) return DEFAULT_WORKFLOW;

    const config = await this.prisma.institutionAcademicConfig.findUnique({
      where: { institutionId: campus.institutionId },
    });
    const institutionWorkflow = this.parseWorkflow(
      config?.registrationWorkflow,
    );
    return this.applyBatchRegistrationPolicy(
      institutionWorkflow,
      academicProfile?.admissionBatch?.registrationMode,
    );
  }

  private applyBatchRegistrationPolicy(
    settings: RegistrationWorkflowSettings,
    batchMode?: string | null,
  ): RegistrationWorkflowSettings {
    const batchRegistrationMode =
      batchMode === 'STUDENT_SELF' ||
      batchMode === 'HYBRID' ||
      batchMode === 'ADMIN_ONLY'
        ? (batchMode as RegistrationWorkflowMode)
        : null;

    if (batchRegistrationMode === 'ADMIN_ONLY') {
      return {
        ...settings,
        mode: 'ADMIN_ONLY',
        allowStudentSelfService: false,
        batchRegistrationMode: 'ADMIN_ONLY',
      };
    }

    return { ...settings, batchRegistrationMode };
  }

  async getForInstitution(tenantId: string, institutionId: string) {
    const config = await this.prisma.institutionAcademicConfig.findUnique({
      where: { institutionId },
    });
    if (!config || config.tenantId !== tenantId) {
      throw new NotFoundException('Institution config not found');
    }
    return this.parseWorkflow(config.registrationWorkflow);
  }

  async updateForInstitution(
    tenantId: string,
    institutionId: string,
    settings: Partial<RegistrationWorkflowSettings>,
  ) {
    const existing = await this.prisma.institutionAcademicConfig.findUnique({
      where: { institutionId },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Institution config not found');
    }
    const merged = {
      ...this.parseWorkflow(existing.registrationWorkflow),
      ...settings,
    };
    if (merged.mode === 'ADMIN_ONLY') {
      merged.allowStudentSelfService = false;
    } else if (merged.mode === 'STUDENT_SELF') {
      merged.allowStudentSelfService = true;
    }
    return this.prisma.institutionAcademicConfig.update({
      where: { institutionId },
      data: { registrationWorkflow: merged as object },
    });
  }

  assertStudentSelfServiceAllowed(settings: RegistrationWorkflowSettings) {
    if (settings.mode === 'ADMIN_ONLY' || !settings.allowStudentSelfService) {
      throw new BadRequestException(
        'Student self-registration is disabled. Contact your college administrator for subject allocation.',
      );
    }
  }

  assertStudentMayEditLines(settings: RegistrationWorkflowSettings) {
    this.assertStudentSelfServiceAllowed(settings);
  }

  mergeStudentLineUpdates(
    settings: RegistrationWorkflowSettings,
    existingLines: {
      category: string;
      offeringId: string;
      offeringSectionId: string | null;
    }[],
    incomingLines: RegistrationLineDto[],
  ): RegistrationLineDto[] {
    this.assertStudentMayEditLines(settings);
    const electiveCats = new Set(settings.studentElectiveCategories);

    for (const line of incomingLines) {
      if (!electiveCats.has(line.category)) {
        throw new BadRequestException(
          `Students cannot modify ${line.category} selections. Contact administration for compulsory subjects.`,
        );
      }
    }

    const preservedCompulsory = existingLines
      .filter((l) => !electiveCats.has(l.category))
      .map((l) => ({
        category: l.category,
        offeringId: l.offeringId,
        offeringSectionId: l.offeringSectionId ?? undefined,
      }));

    const incomingElectives = incomingLines.filter((l) =>
      electiveCats.has(l.category),
    );

    return [...preservedCompulsory, ...incomingElectives];
  }

  isElectiveCategory(
    category: string,
    settings: RegistrationWorkflowSettings,
    mandatoryFlag = true,
  ): boolean {
    return isStudentChoiceCategory(
      category,
      mandatoryFlag,
      settings.studentElectiveCategories,
    );
  }
}
