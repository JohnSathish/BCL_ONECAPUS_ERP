import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { AuthService } from '../auth/auth.service';
import { UserProvisioningService } from '../administration/services/user-provisioning.service';
import { AdmissionsCycleService } from '../admissions/admissions-cycle.service';
import { sanitizeDisplayText } from '../../common/utils/display-text.util';
import {
  evaluateSchoolAgeEligibility,
  evaluateSchoolAdmissionWindow,
  isSchoolCycleSettings,
  schoolMaxOnlineApplications,
  type SchoolCycleSettings,
} from './school-admission.constants';
import { normalizeSchoolDocumentRequirements } from './school-document-requirements';
import {
  generateSchoolLoginPin,
  isSchoolLoginPin,
  normalizeSchoolApplicationNumber,
  normalizeSchoolLoginPin,
  SCHOOL_LOGIN_PIN_MESSAGE,
} from './school-login-pin';
import { SchoolAdmissionsMailService } from './school-admissions-mail.service';

const OTP_TTL_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 45;
const OTP_MAX_ATTEMPTS = 5;

type SchoolOtpRecord = {
  hash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
};

@Injectable()
export class SchoolAdmissionsPortalService {
  private readonly memoryOtp = new Map<string, SchoolOtpRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly provisioning: UserProvisioningService,
    private readonly cycles: AdmissionsCycleService,
    private readonly cache: CacheService,
    private readonly mail: SchoolAdmissionsMailService,
    private readonly config: ConfigService,
  ) {}

  async getPortalInfo(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const cycle = await this.getSchoolCycle(tenantId);
    const settings = cycle
      ? this.withDocumentRequirements(cycle.settings as SchoolCycleSettings)
      : null;

    if (!cycle) {
      return {
        isOpen: false,
        status: 'CLOSED' as const,
        newAdmissionsEnabled: false,
        cycle: null,
        settings: null,
        message: 'Online admissions are currently closed.',
        closedReason: 'cycle_unavailable' as const,
        lastDateLabel: null,
        maxOnlineApplications: null,
        applicationCount: 0,
        seatsRemaining: null,
        branding: this.brandingPayload(branding),
      };
    }

    const applicationCount = await this.countCycleApplications(
      tenantId,
      cycle.id,
    );
    const window = evaluateSchoolAdmissionWindow({
      cycleStatus: cycle.status,
      settings: settings ?? undefined,
      registrationOpensAt: cycle.registrationOpensAt,
      registrationClosesAt: cycle.registrationClosesAt,
      currentApplicationCount: applicationCount,
    });

    return {
      isOpen: window.isOpen,
      status: window.status,
      newAdmissionsEnabled: window.newAdmissionsEnabled,
      closedReason: window.closedReason,
      lastDateLabel: window.lastDateLabel,
      maxOnlineApplications: window.maxOnlineApplications,
      applicationCount: window.applicationCount,
      seatsRemaining: window.seatsRemaining,
      cycle,
      settings,
      registrationOpensAt: cycle.registrationOpensAt,
      registrationClosesAt: cycle.registrationClosesAt,
      applicationDeadline: cycle.applicationDeadline,
      paymentDeadline: cycle.paymentDeadline,
      message: window.message,
      branding: this.brandingPayload(branding),
    };
  }

  async requestEmailOtp(
    tenantId: string,
    dto: { email: string; childFullName?: string },
  ) {
    const portal = await this.getPortalInfo(tenantId);
    if (!portal.isOpen || !portal.cycle) {
      throw new BadRequestException(
        portal.message || 'Online admissions are currently closed.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, cycleId: portal.cycle.id, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: 'SCHOOL_APPLICATION_EMAIL_EXISTS',
        message:
          'An application is already registered with this email address. Please use your existing login to continue.',
      });
    }

    const key = this.otpKey(tenantId, email);
    const current = await this.readOtp(key);
    if (
      current &&
      Date.now() - current.lastSentAt < OTP_RESEND_SECONDS * 1000
    ) {
      throw new BadRequestException(
        `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP`,
      );
    }

    const otp = String(randomInt(100000, 999999));
    const record: SchoolOtpRecord = {
      hash: this.hashOtp(email, otp),
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      lastSentAt: Date.now(),
      attempts: 0,
    };
    await this.writeOtp(key, record);

    const schoolName =
      portal.branding?.displayName ?? 'Tura Public School, Tura';
    const sent = await this.mail.sendOtp({
      to: email,
      schoolName,
      childName: dto.childFullName?.trim() || '',
      otp,
      minutes: OTP_TTL_SECONDS / 60,
    });
    if (!sent.ok) {
      throw new BadRequestException(
        sent.error ||
          'Could not send the verification email. Please try again or contact the school office.',
      );
    }

    return {
      ok: true,
      email,
      expiresInSeconds: OTP_TTL_SECONDS,
      message: `A 6-digit OTP has been sent to ${email}`,
    };
  }

  async register(
    tenantId: string,
    dto: {
      childFullName: string;
      email: string;
      phone: string;
      dateOfBirth: string;
      gender: string;
      acceptedPolicies?: boolean;
      otp: string;
    },
  ) {
    if (dto.acceptedPolicies !== true) {
      throw new BadRequestException(
        'You must accept the admission instructions and eligibility rules',
      );
    }

    const portal = await this.getPortalInfo(tenantId);
    if (!portal.isOpen || !portal.cycle || !portal.settings) {
      throw new BadRequestException(
        portal.message || 'Online admissions are currently closed.',
      );
    }

    const settings = portal.settings;
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const childFullName = dto.childFullName.trim().toUpperCase();
    await this.assertValidOtp(tenantId, email, dto.otp);

    const age = evaluateSchoolAgeEligibility(
      dto.dateOfBirth,
      settings.censusDate,
      settings.minAgeYears,
      settings.maxAgeYearsExclusive,
    );
    if (!age.eligible) {
      throw new BadRequestException(age.message);
    }

    const existing = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        cycleId: portal.cycle.id,
        deletedAt: null,
        OR: [{ email }, { phone }],
      },
    });
    if (existing) {
      const sameEmail = existing.email.trim().toLowerCase() === email;
      throw new ConflictException({
        errorCode: sameEmail
          ? 'SCHOOL_APPLICATION_EMAIL_EXISTS'
          : 'SCHOOL_APPLICATION_PHONE_EXISTS',
        message: sameEmail
          ? 'An application is already registered with this email address. Please use your existing login to continue.'
          : 'An application is already registered with this mobile number. Please use your existing login to continue.',
      });
    }

    const taken = await this.countCycleApplications(tenantId, portal.cycle.id);
    const max = schoolMaxOnlineApplications(settings);
    if (taken >= max) {
      throw new BadRequestException(
        `Online applications are closed. The school has reached the limit of ${max} applications.`,
      );
    }

    const applicationNumber = await this.cycles.nextApplicationNumber(
      portal.cycle.id,
    );
    const plainPassword = generateSchoolLoginPin();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const { user } = await this.provisioning.ensureUserWithRoles(
      tenantId,
      email,
      ['applicant'],
      {
        password: plainPassword,
        passwordHash,
        username: applicationNumber,
        displayName: childFullName,
        phone,
        mustResetPassword: false,
        userTypeForUsername: 'APPLICANT',
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustResetPassword: false,
        isActive: true,
        accountStatus: 'active',
        deletedAt: null,
        username: applicationNumber,
      },
    });

    const application = await this.prisma.admissionApplication.create({
      data: {
        tenantId,
        cycleId: portal.cycle.id,
        applicantUserId: user.id,
        applicationNumber,
        firstName: childFullName,
        lastName: '',
        email,
        phone,
        status: 'draft',
        formData: {
          child: {
            fullName: childFullName,
            dateOfBirth: dto.dateOfBirth,
            gender: dto.gender,
            attendedNursery: true,
          },
          father: { mobile: phone },
          eligibility: {
            ageEligible: age.eligible,
            ageMessage: age.message,
            age: age.age,
          },
        } as Prisma.InputJsonValue,
      },
    });

    await this.cycles.audit(
      tenantId,
      portal.cycle.id,
      'application',
      application.id,
      'school.application.registered',
      user.id,
    );

    await this.clearOtp(this.otpKey(tenantId, email));
    const passwordToSend = plainPassword;
    const schoolName =
      portal.branding?.displayName ?? 'Tura Public School, Tura';
    const credentialsEmail = await this.mail.sendCredentials({
      to: email,
      schoolName,
      childName: childFullName,
      username: applicationNumber,
      password: passwordToSend,
      loginUrl: this.loginUrl(),
    });

    return {
      applicationNumber,
      username: applicationNumber,
      email,
      password: passwordToSend,
      generatedPassword: passwordToSend,
      applicationId: application.id,
      ageWarning: undefined,
      emailSent: credentialsEmail.ok,
      message: credentialsEmail.ok
        ? 'Registration successful. Login details have been sent to your email.'
        : 'Registration successful, but the login email could not be sent. Use the PIN shown below.',
    };
  }

  async requestPasswordResetOtp(
    tenantId: string,
    dto: { emailOrApplicationNumber: string },
  ) {
    const identifier = dto.emailOrApplicationNumber.trim();
    if (!identifier) {
      throw new BadRequestException(
        'Enter your application number or parent email',
      );
    }
    const isEmail = identifier.includes('@');
    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { not: null },
        ...(isEmail
          ? { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } }
          : { applicationNumber: identifier.toUpperCase() }),
      },
      include: { cycle: true, applicantUser: true },
    });

    // Generic response to avoid account enumeration.
    const generic = {
      ok: true,
      message:
        'If an account matches, a PIN-reset OTP has been sent to the registered parent email.',
      expiresInSeconds: OTP_TTL_SECONDS,
    };

    if (
      !application?.applicantUser?.email ||
      !isSchoolCycleSettings(application.cycle?.settings)
    ) {
      return generic;
    }

    const email = application.applicantUser.email.trim().toLowerCase();
    const key = this.passwordResetOtpKey(tenantId, email);
    const current = await this.readOtp(key);
    if (
      current &&
      Date.now() - current.lastSentAt < OTP_RESEND_SECONDS * 1000
    ) {
      throw new BadRequestException(
        `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP`,
      );
    }

    const otp = String(randomInt(100000, 999999));
    await this.writeOtp(key, {
      hash: this.hashOtp(email, otp),
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      lastSentAt: Date.now(),
      attempts: 0,
    });

    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const schoolName = branding?.displayName ?? 'Tura Public School, Tura';
    const sent = await this.mail.sendOtp({
      to: email,
      schoolName,
      childName: application.firstName || '',
      otp,
      minutes: OTP_TTL_SECONDS / 60,
    });
    if (!sent.ok) {
      throw new BadRequestException(
        sent.error ||
          'Could not send the PIN-reset email. Please try again or contact the school office.',
      );
    }

    return {
      ...generic,
      emailHint: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    };
  }

  async resetPasswordWithOtp(
    tenantId: string,
    dto: {
      emailOrApplicationNumber: string;
      otp: string;
      newPassword: string;
    },
  ) {
    const identifier = dto.emailOrApplicationNumber.trim();
    const isEmail = identifier.includes('@');
    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { not: null },
        ...(isEmail
          ? { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } }
          : { applicationNumber: identifier.toUpperCase() }),
      },
      include: { cycle: true, applicantUser: true },
    });
    if (
      !application?.applicantUser?.email ||
      !isSchoolCycleSettings(application.cycle?.settings)
    ) {
      throw new BadRequestException('Invalid reset request');
    }

    const email = application.applicantUser.email.trim().toLowerCase();
    await this.assertValidOtp(tenantId, email, dto.otp, 'password-reset');

    const newPassword = dto.newPassword.trim();
    if (!isSchoolLoginPin(newPassword)) {
      throw new BadRequestException(SCHOOL_LOGIN_PIN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: application.applicantUserId! },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustResetPassword: false,
      },
    });
    await this.clearOtp(this.passwordResetOtpKey(tenantId, email));

    return {
      ok: true,
      message: 'PIN updated. You can sign in with your new 6-digit PIN.',
      applicationNumber: application.applicationNumber,
    };
  }

  async login(
    tenantId: string,
    applicationNumber: string,
    password: string,
    meta?: { userAgent?: string; ipAddress?: string },
    rememberMe?: boolean,
  ) {
    const identifierRaw = String(applicationNumber ?? '').trim();
    const pin = normalizeSchoolLoginPin(String(password ?? ''));
    const isEmail = identifierRaw.includes('@');
    const identifier = isEmail
      ? identifierRaw.toLowerCase()
      : normalizeSchoolApplicationNumber(identifierRaw);

    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { not: null },
        ...(isEmail
          ? { email: { equals: identifier, mode: 'insensitive' } }
          : {
              OR: [
                {
                  applicationNumber: {
                    equals: identifier,
                    mode: 'insensitive',
                  },
                },
                {
                  applicantUser: {
                    username: { equals: identifier, mode: 'insensitive' },
                  },
                },
              ],
            }),
      },
      include: { applicantUser: true, cycle: true },
    });

    if (!application?.applicantUser?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      !application.applicantUser.isActive ||
      application.applicantUser.deletedAt
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(
      pin,
      application.applicantUser.passwordHash,
    );
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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
    if (!isSchoolCycleSettings(application.cycle?.settings)) {
      throw new NotFoundException('Application not found');
    }

    const settings = this.withDocumentRequirements(application.cycle.settings);

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const child = (formData.child ?? {}) as { dateOfBirth?: string };
    const age = evaluateSchoolAgeEligibility(
      child.dateOfBirth ?? '',
      settings.censusDate,
      settings.minAgeYears,
      settings.maxAgeYearsExclusive,
    );

    const proof = application.documents.find(
      (doc) => doc.slotCode === 'PAYMENT_RECEIPT',
    );
    const paymentProofStatus = proof
      ? proof.verificationStatus === 'VERIFIED'
        ? 'VERIFIED'
        : proof.verificationStatus === 'REJECTED'
          ? 'REJECTED'
          : 'UPLOADED_PENDING'
      : 'NOT_UPLOADED';

    const readOnly = [
      'submitted',
      'under_review',
      'shortlisted',
      'allotted',
      'rejected',
    ].includes(application.status);

    const office = (formData.office ?? {}) as {
      decision?: string;
      indexNumber?: string;
    };
    const submission = (formData.submission ?? null) as Record<
      string,
      unknown
    > | null;

    return {
      application,
      settings,
      age,
      paymentProofStatus,
      readOnly,
      officeDecision: office.decision ?? null,
      indexNumber: office.indexNumber ?? null,
      submission,
    };
  }

  async requireSchoolCycle(tenantId: string) {
    const cycle = await this.getSchoolCycle(tenantId);
    if (!cycle) {
      throw new BadRequestException(
        'School admission is not configured for this institution',
      );
    }
    return cycle;
  }

  private async getSchoolCycle(tenantId: string) {
    const open = await this.prisma.admissionCycle.findFirst({
      where: { tenantId, status: 'OPEN', deletedAt: null },
      include: { academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
    if (open && isSchoolCycleSettings(open.settings)) return open;

    const any = await this.prisma.admissionCycle.findFirst({
      where: { tenantId, deletedAt: null, status: { not: 'ARCHIVED' } },
      include: { academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
    if (any && isSchoolCycleSettings(any.settings)) return any;
    return null;
  }

  private countCycleApplications(tenantId: string, cycleId: string) {
    return this.prisma.admissionApplication.count({
      where: { tenantId, cycleId, deletedAt: null },
    });
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
      displayName: branding?.displayName ?? 'Tura Public School',
      shortName: branding?.shortName ?? 'TPS Tura',
      portalSubtitle:
        sanitizeDisplayText(branding?.portalSubtitle) ??
        'K.G. Online Admission',
      primaryColor: branding?.primaryColor ?? '#1b4d3e',
      accentColor: branding?.accentColor ?? '#c5a572',
      logoUrl: branding?.logoUrl ?? null,
    };
  }

  private loginUrl() {
    return (
      this.config.get<string>('SCHOOL_ADMISSIONS_LOGIN_URL') ||
      'http://admission.tps.localhost:3000/school-admissions-portal/login'
    );
  }

  private otpKey(tenantId: string, email: string) {
    return `school-adm-otp:${tenantId}:${email}`;
  }

  private passwordResetOtpKey(tenantId: string, email: string) {
    return `school-adm-pw-otp:${tenantId}:${email}`;
  }

  private hashOtp(email: string, otp: string) {
    return createHash('sha256').update(`${email}:${otp}`).digest('hex');
  }

  private async readOtp(key: string): Promise<SchoolOtpRecord | null> {
    const cached = await this.cache.get<SchoolOtpRecord>(key);
    if (cached) {
      return {
        ...cached,
        attempts: Number(cached.attempts ?? 0),
      };
    }
    const memory = this.memoryOtp.get(key);
    if (!memory || memory.expiresAt < Date.now()) {
      this.memoryOtp.delete(key);
      return null;
    }
    return memory;
  }

  private async writeOtp(key: string, value: SchoolOtpRecord) {
    this.memoryOtp.set(key, value);
    await this.cache.set(key, value, OTP_TTL_SECONDS);
  }

  private async clearOtp(key: string) {
    this.memoryOtp.delete(key);
    await this.cache.del(key);
  }

  private async assertValidOtp(
    tenantId: string,
    email: string,
    otp: string,
    purpose: 'register' | 'password-reset' = 'register',
  ) {
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Enter the 6-digit email OTP');
    }
    const key =
      purpose === 'password-reset'
        ? this.passwordResetOtpKey(tenantId, email)
        : this.otpKey(tenantId, email);
    const record = await this.readOtp(key);
    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'The email OTP has expired. Please request a new code.',
      );
    }
    if (record.hash !== this.hashOtp(email, code)) {
      const attempts = Number(record.attempts ?? 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.clearOtp(key);
        throw new BadRequestException(
          'Too many incorrect OTP attempts. Please request a new code.',
        );
      }
      await this.writeOtp(key, { ...record, attempts });
      throw new BadRequestException(
        `The email OTP is not valid (${OTP_MAX_ATTEMPTS - attempts} attempts left)`,
      );
    }
  }

  private withDocumentRequirements(
    settings: SchoolCycleSettings,
  ): SchoolCycleSettings {
    return {
      ...settings,
      documentRequirements: normalizeSchoolDocumentRequirements(
        settings.documentRequirements,
      ),
    };
  }
}
