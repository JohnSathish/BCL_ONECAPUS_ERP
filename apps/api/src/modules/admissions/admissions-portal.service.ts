import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { AuthService } from '../auth/auth.service';
import { UserProvisioningService } from '../administration/services/user-provisioning.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import { AdmissionsCycleService } from './admissions-cycle.service';
import { sanitizeDisplayText } from '../../common/utils/display-text.util';

@Injectable()
export class AdmissionsPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auth: AuthService,
    private readonly provisioning: UserProvisioningService,
    private readonly communication: CommunicationTriggerService,
    private readonly cycles: AdmissionsCycleService,
  ) {}

  async getPortalInfo(tenantId: string) {
    return this.cache.wrap(`admissions:portal:info:${tenantId}`, 900, () =>
      this.loadPortalInfo(tenantId),
    );
  }

  private async loadPortalInfo(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });

    const cycle = await this.cycles.getActiveCycle(tenantId);
    if (!cycle) {
      const draft = await this.prisma.admissionCycle.findFirst({
        where: { tenantId, deletedAt: null, status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
        include: { academicYear: true },
      });
      return {
        isOpen: false,
        cycle: draft,
        message: draft
          ? 'Registration has not opened yet.'
          : 'No admission cycle configured.',
        branding: this.brandingPayload(branding),
      };
    }

    const now = new Date();
    const regOpen =
      !cycle.registrationOpensAt || cycle.registrationOpensAt <= now;
    const regClosed =
      cycle.registrationClosesAt && cycle.registrationClosesAt < now;

    return {
      isOpen: regOpen && !regClosed,
      cycle,
      registrationOpensAt: cycle.registrationOpensAt,
      registrationClosesAt: cycle.registrationClosesAt,
      applicationDeadline: cycle.applicationDeadline,
      paymentDeadline: cycle.paymentDeadline,
      settings: cycle.settings,
      branding: this.brandingPayload(branding),
    };
  }

  private brandingPayload(
    branding: {
      displayName?: string | null;
      shortName?: string | null;
      portalSubtitle?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      logoUrl?: string | null;
    } | null,
  ) {
    return {
      displayName: branding?.displayName ?? 'Don Bosco College Tura',
      shortName: branding?.shortName ?? 'DBC Tura',
      portalSubtitle:
        sanitizeDisplayText(branding?.portalSubtitle) ??
        'FYUGP Online Admission',
      primaryColor: branding?.primaryColor ?? '#1e3a5f',
      accentColor: branding?.accentColor ?? '#c8102e',
      logoUrl: branding?.logoUrl ?? null,
    };
  }

  private async resolveCatalogContext(
    tenantId: string,
    cycleId: string | null,
  ) {
    if (!cycleId) return null;

    const cycleProgram = await this.prisma.admissionCycleProgram.findFirst({
      where: { cycleId, enabled: true },
      include: { program: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!cycleProgram) return null;

    const version = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        programId: cycleProgram.programId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const shifts = await this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true },
    });

    return {
      programId: cycleProgram.programId,
      programName: cycleProgram.program.name,
      programCode: cycleProgram.program.code,
      programVersionId: version?.id ?? null,
      semesterSequence: 1,
      shifts,
    };
  }

  async register(
    tenantId: string,
    dto: {
      fullName: string;
      email: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: string;
      acceptedPolicies?: boolean;
      password?: string;
    },
  ) {
    const portal = await this.getPortalInfo(tenantId);
    if (!portal.isOpen || !portal.cycle) {
      throw new BadRequestException('Registration is currently closed');
    }

    const cycle = portal.cycle;
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        cycleId: cycle.id,
        email,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        'An application already exists for this email',
      );
    }

    const applicationNumber = await this.cycles.nextApplicationNumber(cycle.id);
    const plainPassword = dto.password ?? this.generateTempPassword();
    const fullName = dto.fullName.trim().toUpperCase();

    const { user, plainPassword: generated } =
      await this.provisioning.ensureUserWithRoles(
        tenantId,
        email,
        ['applicant'],
        {
          password: plainPassword,
          username: applicationNumber,
          displayName: fullName,
          phone: dto.phone,
          mustResetPassword: !dto.password,
          userTypeForUsername: 'APPLICANT',
        },
      );

    const application = await this.prisma.admissionApplication.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        applicantUserId: user.id,
        applicationNumber,
        firstName: fullName,
        lastName: '',
        email,
        phone: dto.phone,
        status: 'draft',
        formData: {
          personal: {
            fullName,
            email,
            phone: dto.phone ?? '',
            dateOfBirth: dto.dateOfBirth ?? '',
            gender: dto.gender ?? '',
          },
        } as Prisma.InputJsonValue,
      },
    });

    await this.cycles.audit(
      tenantId,
      cycle.id,
      'application',
      application.id,
      'application.registered',
      user.id,
    );

    const passwordToSend = dto.password
      ? undefined
      : (generated ?? plainPassword);
    void this.notifyRegistered(tenantId, application, passwordToSend);

    return {
      applicationNumber,
      email,
      generatedPassword: passwordToSend,
      applicationId: application.id,
    };
  }

  async login(
    tenantId: string,
    applicationNumber: string,
    password: string,
    meta?: { userAgent?: string; ipAddress?: string },
    rememberMe?: boolean,
  ) {
    const identifier = applicationNumber.trim();
    const isEmail = identifier.includes('@');

    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { not: null },
        ...(isEmail
          ? { email: { equals: identifier, mode: 'insensitive' } }
          : { applicationNumber: identifier.toUpperCase() }),
      },
      include: {
        applicantUser: true,
        cycle: true,
      },
    });

    if (!application?.applicantUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(
      password,
      application.applicantUser.passwordHash,
    );
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (application.cycle?.status === 'ARCHIVED') {
      return this.auth.issueSessionForUser(
        tenantId,
        application.applicantUser.id,
        meta,
        rememberMe,
        { readOnly: true, applicationId: application.id },
      );
    }

    return this.auth.issueSessionForUser(
      tenantId,
      application.applicantUser.id,
      meta,
      rememberMe,
      { applicationId: application.id },
    );
  }

  async getMe(userId: string, tenantId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: {
        cycle: { include: { academicYear: true } },
        documents: true,
        program: true,
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const meritEntry = await this.prisma.meritListEntry.findFirst({
      where: {
        applicationId: application.id,
        meritList: { status: 'published', deletedAt: null },
      },
      orderBy: { meritList: { round: 'desc' } },
      include: { meritList: true },
    });

    const allocation = await this.prisma.seatAllocation.findFirst({
      where: {
        applicationId: application.id,
        deletedAt: null,
        status: { not: 'withdrawn' },
      },
      include: { shift: true },
    });

    const readOnly =
      application.cycle?.status === 'ARCHIVED' ||
      [
        'submitted',
        'under_review',
        'shortlisted',
        'allotted',
        'rejected',
      ].includes(application.status);

    const catalogContext = await this.resolveCatalogContext(
      tenantId,
      application.cycleId,
    );

    return {
      application,
      meritRank: meritEntry?.rank ?? null,
      meritRound: meritEntry?.meritList.round ?? null,
      allocation,
      readOnly,
      cycleArchived: application.cycle?.status === 'ARCHIVED',
      catalogContext,
    };
  }

  async getStatusTimeline(userId: string, tenantId: string) {
    const me = await this.getMe(userId, tenantId);
    return this.buildStatusTimeline(me);
  }

  buildStatusTimeline(
    me: Awaited<ReturnType<AdmissionsPortalService['getMe']>>,
  ) {
    const app = me.application;
    const steps = [
      { key: 'registered', label: 'Registered', done: true, at: app.createdAt },
      {
        key: 'form_started',
        label: 'Form Started',
        done: app.progressPercent > 0,
        at: app.lastSavedAt,
      },
      {
        key: 'submitted',
        label: 'Submitted',
        done: !!app.submittedAt,
        at: app.submittedAt,
      },
      {
        key: 'payment',
        label: 'Application fee paid',
        done: app.paymentStatus === 'PAID' || app.paymentStatus === 'WAIVED',
        at: null,
      },
      {
        key: 'merit',
        label: me.meritRank
          ? `Merit rank #${me.meritRank}`
          : 'Merit list published',
        done: me.meritRank != null,
        at: null,
      },
      {
        key: 'verified',
        label: 'Documents Verified',
        done: app.documentVerificationStatus === 'VERIFIED',
        at: null,
      },
      {
        key: 'allotted',
        label: 'Seat Allotted',
        done: app.status === 'allotted' || !!me.allocation,
        at: me.allocation?.allocatedAt ?? null,
      },
    ];
    return {
      steps,
      application: app,
      meritRank: me.meritRank,
      meritRound: me.meritRound,
      meritScore: app.meritScore != null ? Number(app.meritScore) : null,
      admissionFeeStatus: app.admissionFeeStatus,
      admissionFeeAmount:
        app.admissionFeeAmount != null ? Number(app.admissionFeeAmount) : null,
      waitingList: me.meritRound != null && me.meritRound > 1,
      allocation: me.allocation
        ? {
            status: me.allocation.status,
            shiftName: me.allocation.shift?.name ?? null,
            allocatedAt: me.allocation.allocatedAt,
          }
        : null,
    };
  }

  private generateTempPassword() {
    return `Db${Math.random().toString(36).slice(2, 8)}!`;
  }

  private async notifyRegistered(
    tenantId: string,
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    },
    password?: string,
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    await this.communication.trigger({
      tenantId,
      templateCode: 'APPLICANT_REGISTERED',
      triggerKey: 'admission.registered',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'USER',
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
        phone: application.phone ?? undefined,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        temp_password: password ?? '(set during registration)',
        institution_name: institutionName,
      },
    });
  }
}
