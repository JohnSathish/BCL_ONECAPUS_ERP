import { BadRequestException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StudentDisplaySettingsService } from '../../administration/services/student-display-settings.service';
import { StudentAttendanceService } from '../../student-attendance/student-attendance.service';
import { FeeLedgerService } from '../../fees/services/fee-ledger.service';
import { LmsDashboardService } from '../../lms/services/lms-dashboard.service';
import { ExaminationsService } from '../../examinations/examinations.service';
import { IdCardsService } from '../../id-cards/id-cards.service';
import type {
  StudentIdCardPrintRequestDto,
  StudentPortalChangeRequestDto,
  StudentPortalChangeSection,
} from '../dto/student-portal-profile.dto';
import { StudentAssetsService } from './student-assets.service';
import { StudentPortalService } from './student-portal.service';
import { StudentProfileService } from './student-profile.service';

const SNAPSHOT_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
};

function maskNationalId(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

@Injectable()
export class StudentPortalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: StudentPortalService,
    private readonly profiles: StudentProfileService,
    private readonly displaySettings: StudentDisplaySettingsService,
    private readonly attendance: StudentAttendanceService,
    private readonly fees: FeeLedgerService,
    private readonly assets: StudentAssetsService,
    private readonly lms: LmsDashboardService,
    private readonly examinations: ExaminationsService,
    private readonly idCards: IdCardsService,
  ) {}

  async getMyProfile(user: JwtUser) {
    const student = await this.portal.resolveStudent(user);
    const [profile, format, attendance, ledger, changeRequests, sessions] =
      await Promise.all([
        this.profiles.getFullProfile(user.tid, student.id),
        this.displaySettings.getFormat(user.tid),
        this.attendance.studentPortalSummary(user).catch(() => null),
        this.fees.myLedger(user.tid, user.sub).catch(() => null),
        this.listChangeRequests(user.tid, student.id),
        this.listDeviceSessions(user.tid, user.sub),
      ]);

    const lookupIds = [
      profile.bloodGroupLookupId,
      profile.religionLookupId,
      profile.categoryLookupId,
    ].filter(Boolean) as string[];

    const lookups =
      lookupIds.length > 0
        ? await this.prisma.masterLookup.findMany({
            where: { tenantId: user.tid, id: { in: lookupIds } },
            select: { id: true, label: true, lookupType: true },
          })
        : [];
    const lookupMap = new Map(lookups.map((l) => [l.id, l.label]));

    const currentReg = profile.registrations?.[0];
    const academicSubjects = (currentReg?.lines ?? [])
      .filter((l) =>
        ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'].includes(
          String(l.category ?? '').toUpperCase(),
        ),
      )
      .map((l) => ({
        category: String(l.category ?? '').toUpperCase(),
        label:
          SNAPSHOT_LABELS[String(l.category ?? '').toUpperCase()] ?? l.category,
        title: l.offering?.course?.title ?? l.offering?.course?.code ?? '—',
      }));

    const demands = ledger?.demands ?? [];
    const feeDue = demands.reduce(
      (sum: number, d: { balanceAmount?: unknown }) =>
        sum + Number(d.balanceAmount ?? 0),
      0,
    );
    const feePaid = demands.reduce(
      (sum: number, d: { paidAmount?: unknown }) =>
        sum + Number(d.paidAmount ?? 0),
      0,
    );

    const certIssues = await this.prisma.certificateIssue.findMany({
      where: {
        tenantId: user.tid,
        studentId: student.id,
        status: 'ISSUED',
        revokedAt: null,
      },
      select: {
        id: true,
        certificateNo: true,
        issuedAt: true,
        category: { select: { name: true, code: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 20,
    });

    const displayName = this.displaySettings.formatName(
      profile.fullName,
      format,
    );

    const permanentAddress = profile.addresses?.find(
      (a) => a.addressType === 'PERMANENT',
    );
    const currentAddress = profile.addresses?.find(
      (a) => a.addressType === 'CURRENT' || a.addressType === 'CORRESPONDENCE',
    );
    const father = profile.guardians?.find((g) => g.guardianType === 'FATHER');
    const mother = profile.guardians?.find((g) => g.guardianType === 'MOTHER');
    const guardian = profile.guardians?.find(
      (g) =>
        g.guardianType === 'GUARDIAN' || g.guardianType === 'LOCAL_GUARDIAN',
    );

    const parentMobile =
      father?.contactNumber ??
      mother?.contactNumber ??
      guardian?.contactNumber ??
      null;

    const [libraryLoans, lmsDashboard, examResults, activityLogs] =
      await Promise.all([
        this.prisma.libraryLoan.count({
          where: {
            tenantId: user.tid,
            studentId: student.id,
            status: 'ACTIVE',
            returnedAt: null,
          },
        }),
        this.lms.studentDashboard(user).catch(() => null),
        this.examinations.studentResults(user).catch(() => ({
          summaries: [],
          marks: [],
          papers: [],
        })),
        this.prisma.auditLog.findMany({
          where: {
            tenantId: user.tid,
            OR: [
              { entityType: 'student', entityId: student.id },
              { userId: user.sub, module: 'student_portal' },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
      ]);

    const lmsCards =
      (lmsDashboard as { cards?: Record<string, number> } | null)?.cards ?? {};
    const summaries =
      (
        examResults as {
          summaries?: { sgpa?: unknown; cgpa?: unknown }[];
        } | null
      )?.summaries ?? [];
    const latest = summaries[0];
    const cgpa =
      latest?.cgpa != null
        ? Number(latest.cgpa)
        : latest?.sgpa != null
          ? Number(latest.sgpa)
          : null;

    const documentRows = (profile.documents ?? []).map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      verificationStatus: doc.verificationStatus ?? 'PENDING',
      uploadedAt: doc.createdAt,
    }));

    const requiredDocuments = this.buildRequiredDocuments(documentRows);
    const profileCompletion = this.computeProfileCompletion({
      photoUrl: profile.photoPath,
      mobileNumber: profile.mobileNumber,
      email: profile.email,
      bloodGroup: profile.bloodGroupLookupId
        ? lookupMap.get(profile.bloodGroupLookupId)
        : null,
      parentMobile,
      fatherName: father?.fullName,
      motherName: mother?.fullName,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      rfidAssigned: Boolean(profile.rfidNumber),
      requiredDocuments,
    });

    const currentSemester = profile.semester ?? 1;
    const totalSemesters = 6;
    const overallAttendance =
      attendance?.overall != null
        ? Number(attendance.overall)
        : profile.attendancePercent != null
          ? Number(profile.attendancePercent)
          : null;

    const recentActivity = this.buildRecentActivity(activityLogs, {
      feePaid,
      certCount: certIssues.length,
      libraryLoans,
    });

    const achievements = [
      {
        code: 'attendance_star',
        label: 'Attendance Star',
        earned: overallAttendance != null && overallAttendance >= 90,
      },
      {
        code: 'library_reader',
        label: 'Library Reader',
        earned: libraryLoans > 0,
      },
      {
        code: 'fee_compliance',
        label: 'Fee Compliance',
        earned: feeDue <= 0,
      },
      {
        code: 'top_performer',
        label: 'Top Performer',
        earned: cgpa != null && cgpa >= 8,
      },
    ];

    return {
      personal: {
        photoUrl: profile.photoPath ?? null,
        registrationNumber: profile.applicationNumber ?? null,
        rollNumber: profile.rollNumber ?? profile.enrollmentNumber,
        enrollmentNumber: profile.enrollmentNumber,
        rfidNumber: profile.rfidNumber ?? null,
        admissionNumber: profile.admissionNumber ?? null,
        fullName: profile.fullName,
        displayFullName: displayName,
        gender: profile.gender ?? null,
        dateOfBirth: profile.dateOfBirth ?? null,
        bloodGroup: profile.bloodGroupLookupId
          ? (lookupMap.get(profile.bloodGroupLookupId) ?? null)
          : null,
        aadhaarMasked: maskNationalId(profile.nationalId),
        category: profile.categoryLookupId
          ? (lookupMap.get(profile.categoryLookupId) ?? null)
          : null,
        religion: profile.religionLookupId
          ? (lookupMap.get(profile.religionLookupId) ?? null)
          : null,
        nationality: 'Indian',
      },
      academic: {
        programme: profile.programme ?? null,
        department: profile.departmentName ?? null,
        major: profile.majorSubject ?? null,
        minor: profile.minorSubject ?? null,
        subjects: academicSubjects,
        semester: profile.semester ?? null,
        shift: profile.shift ?? null,
        batch: profile.batch ?? null,
        academicYear: profile.entrySession ?? null,
        readOnly: true,
      },
      contact: {
        mobileNumber: profile.mobileNumber ?? null,
        alternateMobile: null,
        personalEmail: profile.email ?? null,
        currentAddress: currentAddress ?? permanentAddress ?? null,
        emergencyContact: null,
        editable: true,
      },
      parents: {
        fatherName: father?.fullName ?? null,
        motherName: mother?.fullName ?? null,
        guardianName: guardian?.fullName ?? null,
        parentMobile,
        fatherMobile: father?.contactNumber ?? null,
        motherMobile: mother?.contactNumber ?? null,
        editable: true,
      },
      documents: documentRows,
      requiredDocuments,
      profileCompletion,
      academicProgress: {
        currentSemester,
        totalSemesters,
      },
      statistics: {
        libraryBooks: libraryLoans,
        certificates: certIssues.length,
        assignments: Number(lmsCards.assignmentsDue ?? 0),
        attendance: overallAttendance,
        cgpa,
      },
      achievements,
      recentActivity,
      rfid: {
        assigned: Boolean(profile.rfidNumber),
        rfidNumber: profile.rfidNumber ?? null,
        cardNumber: profile.enrollmentNumber,
        issueDate: profile.admissionDate ?? null,
      },
      attendance: {
        overall: attendance?.overall ?? profile.attendancePercent ?? null,
        subjects: attendance?.subjects ?? [],
        eligibility: profile.attendanceEligibility ?? null,
        readOnly: true,
      },
      fees: {
        currentDue: feeDue,
        paidAmount: feePaid,
        status: feeDue > 0 ? 'PENDING' : 'PAID',
        readOnly: true,
      },
      certificates: certIssues.map((c) => ({
        id: c.id,
        type: c.category?.name ?? c.category?.code ?? 'Certificate',
        certificateNo: c.certificateNo,
        issuedAt: c.issuedAt,
      })),
      changeRequests,
      sessions,
    };
  }

  async submitChangeRequest(user: JwtUser, dto: StudentPortalChangeRequestDto) {
    const student = await this.portal.resolveStudent(user);
    this.assertEditableFields(dto.section, dto.changes);

    const entry = await this.prisma.auditLog.create({
      data: {
        tenantId: user.tid,
        userId: user.sub,
        module: 'student_portal',
        action: 'student.profile_change_request',
        entityType: 'student',
        entityId: student.id,
        metadata: {
          section: dto.section,
          changes: dto.changes,
          status: 'PENDING',
          submittedAt: new Date().toISOString(),
        },
      },
    });

    return {
      id: entry.id,
      section: dto.section,
      status: 'PENDING' as const,
      message: 'Your update request has been submitted for admin approval.',
    };
  }

  async submitIdCardPrintRequest(
    user: JwtUser,
    dto: StudentIdCardPrintRequestDto,
  ) {
    const student = await this.portal.resolveStudent(user);
    const request = await this.idCards.createStudentPrintRequest(
      user,
      student.id,
      dto.requestType,
      dto.note,
    );
    return {
      id: request.id,
      requestType: dto.requestType,
      status: 'PENDING' as const,
      message: 'Your ID card print request has been sent to the admin office.',
    };
  }

  async listIdCardPrintRequests(tenantId: string, studentId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'student',
        entityId: studentId,
        action: 'student.id_card_print_request',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        requestType: String(meta.requestType ?? 'NEW'),
        status: String(meta.status ?? 'PENDING'),
        note: meta.note ? String(meta.note) : null,
        submittedAt: row.createdAt.toISOString(),
      };
    });
  }

  async listAllIdCardPrintRequests(tenantId: string, status?: string) {
    return this.idCards.listPrintRequests(tenantId, status);
  }

  async listChangeRequests(tenantId: string, studentId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'student',
        entityId: studentId,
        action: 'student.profile_change_request',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        section: String(meta.section ?? ''),
        status: String(meta.status ?? 'PENDING'),
        changes: meta.changes ?? {},
        submittedAt: row.createdAt.toISOString(),
      };
    });
  }

  async uploadDocument(
    user: JwtUser,
    documentType: string,
    file: Express.Multer.File,
  ) {
    const student = await this.portal.resolveStudent(user);
    const allowed = new Set([
      'AADHAAR',
      'PAN',
      'TC',
      'MIGRATION',
      'PHOTO',
      'SIGNATURE',
      'TRANSFER_CERTIFICATE',
      'MIGRATION_CERTIFICATE',
      'PASSPORT_PHOTO',
    ]);
    const normalized = documentType.toUpperCase().replace(/\s+/g, '_');
    if (!allowed.has(normalized)) {
      throw new BadRequestException(
        'Document type not allowed for student upload',
      );
    }

    const doc = await this.assets.uploadDocument(
      user.tid,
      student.id,
      normalized,
      file,
      user.sub,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tid,
        userId: user.sub,
        module: 'student_portal',
        action: 'student.document_uploaded',
        entityType: 'student_document',
        entityId: doc.id,
        metadata: {
          documentType: normalized,
          status: 'PENDING',
          fileName: file.originalname,
        },
      },
    });

    return {
      ...doc,
      status: 'PENDING',
      message: 'Document uploaded and pending admin verification.',
    };
  }

  async listDeviceSessions(tenantId: string, userId: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { tenantId, userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { lastLoginAt: true },
    });

    return {
      lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
      devices: sessions.map((s, index) => {
        const meta = (s.metadata ?? {}) as Record<string, string | undefined>;
        return {
          id: s.id,
          label:
            meta.deviceLabel ??
            (index === 0 ? 'Current device' : 'Previous session'),
          userAgent: s.userAgent ?? 'Unknown device',
          ipAddress: s.ipAddress ?? '—',
          clientType: meta.clientType ?? 'web',
          appType: meta.appType ?? null,
          appVersion: meta.appVersion ?? null,
          lastActiveAt: s.updatedAt.toISOString(),
          isCurrent: index === 0,
        };
      }),
    };
  }

  private assertEditableFields(
    section: StudentPortalChangeSection,
    changes: Record<string, string | null>,
  ) {
    const allowed: Record<StudentPortalChangeSection, Set<string>> = {
      contact: new Set([
        'mobileNumber',
        'alternateMobile',
        'personalEmail',
        'currentAddressLine1',
        'currentAddressLine2',
        'currentCity',
        'currentState',
        'currentPinCode',
        'emergencyContact',
      ]),
      parent: new Set([
        'fatherName',
        'motherName',
        'guardianName',
        'parentMobile',
      ]),
    };

    for (const key of Object.keys(changes)) {
      if (!allowed[section].has(key)) {
        throw new BadRequestException(
          `Field "${key}" cannot be updated by students.`,
        );
      }
    }
  }

  private buildRequiredDocuments(
    documents: { documentType: string; verificationStatus: string }[],
  ) {
    const uploadedTypes = new Set(
      documents.map((d) => d.documentType.toUpperCase().replace(/\s+/g, '_')),
    );
    const verifiedTypes = new Set(
      documents
        .filter(
          (d) =>
            d.verificationStatus === 'VERIFIED' ||
            d.verificationStatus === 'APPROVED',
        )
        .map((d) => d.documentType.toUpperCase().replace(/\s+/g, '_')),
    );

    const specs = [
      { type: 'AADHAAR', label: 'Aadhaar', aliases: ['AADHAAR'] },
      {
        type: 'TRANSFER_CERTIFICATE',
        label: 'Transfer Certificate',
        aliases: ['TC', 'TRANSFER_CERTIFICATE'],
      },
      {
        type: 'PASSPORT_PHOTO',
        label: 'Photo',
        aliases: ['PHOTO', 'PASSPORT_PHOTO'],
      },
      { type: 'SIGNATURE', label: 'Signature', aliases: ['SIGNATURE'] },
    ];

    return specs.map((spec) => {
      const uploaded = spec.aliases.some((a) => uploadedTypes.has(a));
      const verified = spec.aliases.some((a) => verifiedTypes.has(a));
      return { type: spec.type, label: spec.label, uploaded, verified };
    });
  }

  private computeProfileCompletion(input: {
    photoUrl?: string | null;
    mobileNumber?: string | null;
    email?: string | null;
    bloodGroup?: string | null;
    parentMobile?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    gender?: string | null;
    dateOfBirth?: Date | string | null;
    rfidAssigned: boolean;
    requiredDocuments: { uploaded: boolean; label: string }[];
  }) {
    const checks: { label: string; ok: boolean }[] = [
      { label: 'Photo', ok: Boolean(input.photoUrl) },
      { label: 'Mobile Number', ok: Boolean(input.mobileNumber) },
      { label: 'Email', ok: Boolean(input.email) },
      { label: 'Blood Group', ok: Boolean(input.bloodGroup) },
      { label: 'Parent Mobile', ok: Boolean(input.parentMobile) },
      { label: 'Father Name', ok: Boolean(input.fatherName) },
      { label: 'Mother Name', ok: Boolean(input.motherName) },
      { label: 'Gender', ok: Boolean(input.gender) },
      { label: 'Date of Birth', ok: Boolean(input.dateOfBirth) },
      { label: 'RFID Card', ok: input.rfidAssigned },
      ...input.requiredDocuments.map((d) => ({
        label: d.label,
        ok: d.uploaded,
      })),
    ];

    const completed = checks.filter((c) => c.ok).length;
    const percent = checks.length
      ? Math.round((completed / checks.length) * 100)
      : 0;

    return {
      percent,
      missing: checks.filter((c) => !c.ok).map((c) => c.label),
    };
  }

  private buildRecentActivity(
    logs: { id: string; action: string; createdAt: Date; metadata: unknown }[],
    ctx: { feePaid: number; certCount: number; libraryLoans: number },
  ) {
    const items = logs.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      let title = 'Profile activity';
      if (row.action.includes('document')) title = 'Document uploaded';
      if (row.action.includes('change_request'))
        title = 'Profile update submitted';
      if (row.action.includes('attendance')) title = 'Attendance updated';
      if (meta.documentType) {
        title = `${String(meta.documentType).replace(/_/g, ' ')} uploaded`;
      }
      return {
        id: row.id,
        type: row.action,
        title,
        occurredAt: row.createdAt.toISOString(),
      };
    });

    if (ctx.feePaid > 0 && items.length < 8) {
      items.push({
        id: 'fee-receipt',
        type: 'fee',
        title: 'Fee receipt generated',
        occurredAt: new Date().toISOString(),
      });
    }
    if (ctx.libraryLoans > 0 && items.length < 8) {
      items.push({
        id: 'library-issue',
        type: 'library',
        title: 'Library book issued',
        occurredAt: new Date().toISOString(),
      });
    }
    if (ctx.certCount > 0 && items.length < 8) {
      items.push({
        id: 'certificate',
        type: 'certificate',
        title: 'Certificate approved',
        occurredAt: new Date().toISOString(),
      });
    }

    return items.slice(0, 8);
  }
}
