import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import {
  CreateApplicationDto,
  CreateIntakeDto,
  GenerateMeritListDto,
  RunSeatAllocationDto,
  UpdateAllocationStatusDto,
  UpdateApplicationStatusDto,
} from './dto/admissions.dto';
import { AdmissionsValidationService } from './admissions-validation.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import { LicenseEnforcementService } from '../licensing/services/license-enforcement.service';
import { resolveAdmissionFeeDue } from './admissions-fee.util';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionValidation: AdmissionsValidationService,
    private readonly communication: CommunicationTriggerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  async getSummary(tenantId: string) {
    const [intakes, applications, meritLists, allocations] =
      await this.prisma.$transaction([
        this.prisma.admissionIntake.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.admissionApplication.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.meritList.count({
          where: { tenantId, deletedAt: null, status: 'published' },
        }),
        this.prisma.seatAllocation.count({
          where: { tenantId, deletedAt: null, status: { not: 'withdrawn' } },
        }),
      ]);

    const pendingReview = await this.prisma.admissionApplication.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['submitted', 'under_review'] },
      },
    });

    return {
      intakes,
      applications,
      publishedMeritLists: meritLists,
      activeAllocations: allocations,
      pendingReview,
    };
  }

  listIntakes(tenantId: string) {
    return this.prisma.admissionIntake.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        program: true,
        academicYear: true,
        _count: {
          select: {
            applications: { where: { deletedAt: null } },
            allocations: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIntake(tenantId: string, dto: CreateIntakeDto) {
    await this.admissionValidation.validateIntakeProgram(
      tenantId,
      dto.programId,
    );

    return this.prisma.admissionIntake.create({
      data: {
        tenantId,
        programId: dto.programId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        code: dto.code,
        totalSeats: dto.totalSeats,
        status: dto.status ?? 'open',
        opensAt: new Date(),
      },
      include: { program: true, academicYear: true },
    });
  }

  async listApplications(
    tenantId: string,
    query: PaginationQueryDto & {
      intakeId?: string;
      cycleId?: string;
      status?: string;
      paymentStatus?: string;
      documentVerificationStatus?: string;
      paymentPending?: boolean;
      documentPending?: boolean;
      admissionFeePending?: boolean;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.intakeId ? { intakeId: query.intakeId } : {}),
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.documentVerificationStatus
        ? { documentVerificationStatus: query.documentVerificationStatus }
        : {}),
      ...(query.paymentPending
        ? {
            paymentStatus: { notIn: ['PAID', 'WAIVED'] },
            status: { not: 'draft' },
          }
        : {}),
      ...(query.documentPending
        ? {
            status: { not: 'draft' },
            documentVerificationStatus: { not: 'VERIFIED' },
          }
        : {}),
      ...(query.admissionFeePending
        ? {
            status: 'allotted',
            admissionFeeStatus: 'PENDING',
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              {
                applicationNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          intake: { include: { program: true } },
          cycle: {
            select: { id: true, code: true, title: true, status: true },
          },
          program: { select: { id: true, code: true, name: true } },
          academicStream: { select: { id: true, code: true, name: true } },
          preferredShift: { select: { id: true, code: true, name: true } },
          documents: true,
          seatAllocations: {
            where: { deletedAt: null },
            orderBy: { round: 'desc' },
            take: 1,
            include: {
              shift: { select: { id: true, code: true, name: true } },
            },
          },
          enrolledStudent: { select: { id: true } },
        },
        orderBy: [{ meritScore: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);

    return paginate(data, total, page, limit);
  }

  async createApplication(tenantId: string, dto: CreateApplicationDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      tenantId,
      'admission.create',
    );
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: dto.intakeId, tenantId, deletedAt: null },
    });
    if (!intake) throw new NotFoundException('Admission intake not found');
    if (intake.status !== 'open') {
      throw new BadRequestException('Intake is not open for applications');
    }

    const count = await this.prisma.admissionApplication.count({
      where: { intakeId: dto.intakeId },
    });
    const applicationNumber = `${intake.code}-${String(count + 1).padStart(4, '0')}`;

    const stream = await this.prisma.academicStream.findFirst({
      where: {
        id: dto.academicStreamId,
        tenantId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!stream) {
      throw new BadRequestException('Invalid academic stream');
    }

    if (dto.preferredShiftId) {
      const shiftCap = await this.prisma.admissionIntakeShift.findFirst({
        where: { intakeId: dto.intakeId, shiftId: dto.preferredShiftId },
      });
      if (!shiftCap) {
        throw new BadRequestException(
          'Selected shift is not open for this intake',
        );
      }
    }

    const application = await this.prisma.admissionApplication.create({
      data: {
        tenantId,
        intakeId: dto.intakeId,
        applicationNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        category: dto.category ?? 'GENERAL',
        preferredShiftId: dto.preferredShiftId,
        academicStreamId: dto.academicStreamId,
        meritScore: dto.meritScore,
        status: 'submitted',
        submittedAt: new Date(),
      },
      include: {
        intake: { include: { program: true } },
        academicStream: true,
      },
    });

    void this.notifyApplicationSubmitted(tenantId, application);
    return application;
  }

  private async notifyApplicationSubmitted(
    tenantId: string,
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      intake: { program: { name: string } } | null;
      program?: { name: string } | null;
    },
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const programName =
      application.intake?.program.name ??
      application.program?.name ??
      'FYUP Programme';
    await this.communication.trigger({
      tenantId,
      templateCode: 'ADMISSION_SUBMITTED',
      triggerKey: 'admission.submitted',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'USER',
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        program_name: programName,
        institution_name: institutionName,
      },
    });
  }

  async updateApplicationStatus(
    tenantId: string,
    id: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!app) throw new NotFoundException('Application not found');

    const updated = await this.prisma.admissionApplication.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'allotted'
          ? await this.allotmentAdmissionFeePatch(app)
          : {}),
        ...(dto.status === 'rejected'
          ? {
              admissionFeeStatus: 'NOT_APPLICABLE',
              admissionFeeAmount: null,
              admissionFeeReference: null,
            }
          : {}),
      },
      include: { intake: { include: { program: true } } },
    });

    if (dto.status === 'rejected') {
      void this.notifyApplicationRejected(tenantId, updated);
    }
    return updated;
  }

  private async allotmentAdmissionFeePatch(app: {
    cycleId: string | null;
    admissionFeeStatus: string;
    admissionFeeAmount: Prisma.Decimal | null;
  }) {
    if (
      app.admissionFeeStatus === 'PAID' ||
      app.admissionFeeStatus === 'WAIVED'
    ) {
      return {};
    }

    let due =
      app.admissionFeeAmount != null ? Number(app.admissionFeeAmount) : null;
    if (due == null && app.cycleId) {
      const cycle = await this.prisma.admissionCycle.findFirst({
        where: { id: app.cycleId },
        select: { settings: true },
      });
      due = resolveAdmissionFeeDue(
        (cycle?.settings as Record<string, unknown> | null) ?? null,
      );
    }

    return {
      admissionFeeStatus: 'PENDING',
      ...(due != null ? { admissionFeeAmount: due } : {}),
    };
  }

  private async notifyAdmissionOffer(
    tenantId: string,
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
      intake: { program: { name: string } } | null;
      program?: { name: string } | null;
    },
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const programName =
      application.intake?.program.name ??
      application.program?.name ??
      'FYUP Programme';
    await this.communication.trigger({
      tenantId,
      templateCode: 'ADMISSION_CONFIRMATION',
      triggerKey: 'admission.offer',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'USER',
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        program_name: programName,
        institution_name: institutionName,
      },
    });
  }

  private async notifyApplicationRejected(
    tenantId: string,
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      intake: { program: { name: string } } | null;
      program?: { name: string } | null;
    },
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const programName =
      application.intake?.program.name ??
      application.program?.name ??
      'FYUP Programme';
    await this.communication.trigger({
      tenantId,
      templateCode: 'ADMISSION_REJECTED',
      triggerKey: 'admission.rejected',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'USER',
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        program_name: programName,
        institution_name: institutionName,
      },
    });
  }

  async markPayment(
    tenantId: string,
    id: string,
    dto: { status: string; paymentReference?: string; amountPaid?: number },
    actorId?: string,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!app) throw new NotFoundException('Application not found');

    const updated = await this.prisma.admissionApplication.update({
      where: { id },
      data: {
        paymentStatus: dto.status,
        paymentReference: dto.paymentReference,
        amountPaid: dto.amountPaid,
      },
    });

    await this.prisma.admissionAuditLog.create({
      data: {
        tenantId,
        cycleId: app.cycleId,
        entityType: 'application',
        entityId: id,
        action: 'payment.updated',
        actorId,
        newValue: {
          status: dto.status,
          paymentReference: dto.paymentReference,
        },
      },
    });

    return updated;
  }

  async markAdmissionFee(
    tenantId: string,
    id: string,
    dto: {
      status: string;
      admissionFeeReference?: string;
      admissionFeeAmount?: number;
    },
    actorId?: string,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (
      dto.status === 'PAID' ||
      dto.status === 'WAIVED' ||
      (dto.status === 'PENDING' && dto.admissionFeeAmount !== undefined)
    ) {
      if (app.status !== 'allotted') {
        throw new BadRequestException(
          'Admission fee applies only after the applicant is selected for admission',
        );
      }
    }

    const updated = await this.prisma.admissionApplication.update({
      where: { id },
      data: {
        admissionFeeStatus: dto.status,
        admissionFeeReference: dto.admissionFeeReference,
        ...(dto.admissionFeeAmount !== undefined
          ? { admissionFeeAmount: dto.admissionFeeAmount }
          : {}),
      },
    });

    await this.prisma.admissionAuditLog.create({
      data: {
        tenantId,
        cycleId: app.cycleId,
        entityType: 'application',
        entityId: id,
        action: 'admission_fee.updated',
        actorId,
        newValue: {
          status: dto.status,
          admissionFeeReference: dto.admissionFeeReference,
          admissionFeeAmount: dto.admissionFeeAmount,
        },
      },
    });

    return updated;
  }

  async sendAdmissionOffer(tenantId: string, id: string) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { intake: { include: { program: true } }, program: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!['shortlisted', 'allotted'].includes(app.status)) {
      throw new BadRequestException(
        'Offer email is only for shortlisted or allotted applications',
      );
    }
    await this.notifyAdmissionOffer(tenantId, app);
    return { sent: true, applicationNumber: app.applicationNumber };
  }

  getAuditLog(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.admissionAuditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  listMeritLists(tenantId: string, intakeId?: string) {
    return this.prisma.meritList.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(intakeId ? { intakeId } : {}),
      },
      include: {
        intake: { include: { program: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ intakeId: 'asc' }, { round: 'desc' }],
    });
  }

  getMeritList(tenantId: string, id: string) {
    return this.prisma.meritList.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        intake: { include: { program: true } },
        entries: {
          orderBy: { rank: 'asc' },
          include: {
            application: true,
          },
        },
      },
    });
  }

  async generateMeritList(tenantId: string, dto: GenerateMeritListDto) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: dto.intakeId, tenantId, deletedAt: null },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    await this.admissionValidation.validateIntakeProgram(
      tenantId,
      intake.programId,
    );

    const round = dto.round ?? 1;
    const existing = await this.prisma.meritList.findFirst({
      where: { intakeId: dto.intakeId, round, deletedAt: null },
    });
    if (existing?.status === 'published') {
      throw new BadRequestException(
        'Published merit list cannot be regenerated',
      );
    }

    const applications = await this.prisma.admissionApplication.findMany({
      where: {
        tenantId,
        intakeId: dto.intakeId,
        deletedAt: null,
        status: { notIn: ['rejected'] },
      },
      orderBy: { meritScore: 'desc' },
    });

    const meritList = existing
      ? await this.prisma.meritList.update({
          where: { id: existing.id },
          data: { name: dto.name ?? existing.name, status: 'draft' },
        })
      : await this.prisma.meritList.create({
          data: {
            tenantId,
            intakeId: dto.intakeId,
            name: dto.name ?? `${intake.name} — Round ${round}`,
            round,
            status: 'draft',
          },
        });

    await this.prisma.meritListEntry.deleteMany({
      where: { meritListId: meritList.id },
    });

    if (applications.length > 0) {
      await this.prisma.meritListEntry.createMany({
        data: applications.map((app, idx) => ({
          tenantId,
          meritListId: meritList.id,
          applicationId: app.id,
          rank: idx + 1,
          score: app.meritScore,
        })),
      });
    }

    const result = await this.getMeritList(tenantId, meritList.id);
    if (!result)
      throw new NotFoundException('Merit list not found after generation');
    return result;
  }

  async publishMeritList(tenantId: string, id: string) {
    const list = await this.prisma.meritList.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!list) throw new NotFoundException('Merit list not found');

    return this.prisma.meritList.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: {
        intake: { include: { program: true } },
        _count: { select: { entries: true } },
      },
    });
  }

  listAllocations(tenantId: string, intakeId?: string) {
    return this.prisma.seatAllocation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(intakeId ? { intakeId } : {}),
      },
      include: {
        application: true,
        intake: { include: { program: true } },
      },
      orderBy: { allocatedAt: 'desc' },
    });
  }

  async runSeatAllocation(tenantId: string, dto: RunSeatAllocationDto) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: dto.intakeId, tenantId, deletedAt: null },
      include: {
        cycle: { select: { settings: true } },
        allocations: {
          where: { deletedAt: null, status: { not: 'withdrawn' } },
        },
      },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    await this.admissionValidation.validateIntakeProgram(
      tenantId,
      intake.programId,
    );

    const meritList = await this.prisma.meritList.findFirst({
      where: {
        id: dto.meritListId,
        intakeId: dto.intakeId,
        tenantId,
        deletedAt: null,
        status: 'published',
      },
      include: {
        entries: { orderBy: { rank: 'asc' }, include: { application: true } },
      },
    });
    if (!meritList) {
      throw new BadRequestException(
        'Merit list must be published before allocation',
      );
    }

    const round = dto.round ?? meritList.round;
    const alreadyAllocated = new Set(
      intake.allocations.map((a) => a.applicationId),
    );

    const shiftCaps = await this.prisma.admissionIntakeShift.findMany({
      where: { intakeId: dto.intakeId },
    });
    const allocatedByShift = new Map<string, number>();
    for (const a of intake.allocations) {
      if (a.shiftId) {
        allocatedByShift.set(
          a.shiftId,
          (allocatedByShift.get(a.shiftId) ?? 0) + 1,
        );
      }
    }

    const toAllocate: typeof meritList.entries = [];
    for (const entry of meritList.entries) {
      if (alreadyAllocated.has(entry.applicationId)) continue;
      const preferredShiftId = entry.application.preferredShiftId;
      if (preferredShiftId && shiftCaps.length > 0) {
        const cap = shiftCaps.find((c) => c.shiftId === preferredShiftId);
        if (!cap) continue;
        const used = allocatedByShift.get(preferredShiftId) ?? 0;
        if (used >= cap.totalSeats) continue;
        allocatedByShift.set(preferredShiftId, used + 1);
        toAllocate.push(entry);
        continue;
      }
      if (intake.allocations.length + toAllocate.length < intake.totalSeats) {
        toAllocate.push(entry);
      }
    }

    const created = await this.prisma.$transaction(
      toAllocate.map((entry) =>
        this.prisma.seatAllocation.create({
          data: {
            tenantId,
            intakeId: dto.intakeId,
            applicationId: entry.applicationId,
            shiftId: entry.application.preferredShiftId,
            round,
            status: 'provisional',
          },
        }),
      ),
    );

    const defaultAdmissionDue = resolveAdmissionFeeDue(
      (intake.cycle?.settings as Record<string, unknown> | null) ?? null,
    );

    await this.prisma.admissionApplication.updateMany({
      where: {
        id: { in: toAllocate.map((e) => e.applicationId) },
        status: { notIn: ['rejected', 'allotted'] },
      },
      data: {
        status: 'allotted',
        admissionFeeStatus: 'PENDING',
        admissionFeeAmount: defaultAdmissionDue,
      },
    });

    const totalAllocated = intake.allocations.length + created.length;
    return {
      allocated: created.length,
      seatsRemaining: Math.max(0, intake.totalSeats - totalAllocated),
      allocations: await this.listAllocations(tenantId, dto.intakeId),
    };
  }

  async updateAllocationStatus(
    tenantId: string,
    id: string,
    dto: UpdateAllocationStatusDto,
  ) {
    const allocation = await this.prisma.seatAllocation.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!allocation) throw new NotFoundException('Allocation not found');

    return this.prisma.seatAllocation.update({
      where: { id },
      data: { status: dto.status },
      include: {
        application: true,
        intake: { include: { program: true } },
      },
    });
  }
}
