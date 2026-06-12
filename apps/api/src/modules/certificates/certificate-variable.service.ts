import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StudentDisplaySettingsService } from '../administration/services/student-display-settings.service';

@Injectable()
export class CertificateVariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly displaySettings: StudentDisplaySettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async buildStudentVariables(
    tenantId: string,
    studentId: string,
    custom: Record<string, unknown> = {},
    issueMeta?: {
      verificationToken?: string;
      certificateNo?: string;
      categoryCode?: string;
      preview?: boolean;
    },
  ) {
    const [student, branding, signatures, lifecycleEvent] = await Promise.all([
      this.db().student.findFirst({
        where: { tenantId, id: studentId, deletedAt: null },
        include: {
          user: true,
          masterProfile: true,
          department: true,
          primaryShift: true,
          guardians: true,
          addresses: true,
          programVersion: {
            include: { program: { include: { department: true } } },
          },
          academicProfile: { include: { stream: true, admissionBatch: true } },
          academicStanding: true,
          majorMinorTrack: {
            include: { majorSubject: true, minorSubject: true },
          },
          semesterRegistrations: {
            include: {
              semester: true,
              lines: { include: { offering: { include: { course: true } } } },
            },
            orderBy: { semesterSequence: 'desc' },
            take: 1,
          },
        },
      }),
      this.db().tenantBranding.findFirst({ where: { tenantId } }),
      this.db().certificateSignature.findMany({
        where: { tenantId, isActive: true, deletedAt: null },
      }),
      this.db().studentLifecycleEvent.findFirst({
        where: {
          tenantId,
          studentId,
          eventType: { in: ['LEAVING', 'MIGRATION', 'ALUMNI', 'DROPOUT'] },
        },
        orderBy: { effectiveDate: 'desc' },
      }),
    ]);

    const currentRegistration = student?.semesterRegistrations?.[0];
    const storedFullName =
      student?.masterProfile?.fullName ?? student?.user?.email ?? '';
    const fullName = await this.displaySettings.formatNameForTenant(
      tenantId,
      storedFullName,
    );
    const programme = student?.programVersion?.program?.name ?? '';
    const department =
      student?.department?.name ??
      student?.programVersion?.program?.department?.name ??
      '';
    const guardian = student?.guardians?.[0];
    const fatherGuardian = student?.guardians?.find(
      (row: { guardianType?: string }) =>
        String(row.guardianType ?? '').toUpperCase() === 'FATHER',
    );
    const motherGuardian = student?.guardians?.find(
      (row: { guardianType?: string }) =>
        String(row.guardianType ?? '').toUpperCase() === 'MOTHER',
    );
    const admissionYear = student?.admissionDate
      ? new Date(student.admissionDate).getFullYear()
      : '';
    const sessionEnd = new Date().getFullYear();
    const academicSession = admissionYear
      ? `${admissionYear}–${sessionEnd}`
      : String(sessionEnd);

    const collegeName = branding?.displayName ?? 'Don Bosco College, Tura';
    const verifyBase =
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('WEB_APP_URL') ??
      'http://localhost:3000';
    const verificationToken = issueMeta?.verificationToken ?? '';
    const verificationUrl = verificationToken
      ? `${verifyBase.replace(/\/$/, '')}/verify/certificates/${verificationToken}`
      : 'verify.dbctura.edu.in';
    const verificationId = verificationToken
      ? `${issueMeta?.categoryCode === 'TRANSFER' ? 'TC' : 'DBC'}-${verificationToken.replace(/-/g, '').slice(0, 6).toUpperCase()}`
      : '';

    const principal = signatures.find(
      (s: { roleSlug: string }) => s.roleSlug === 'principal',
    );
    const registrar = signatures.find(
      (s: { roleSlug: string }) => s.roleSlug === 'registrar',
    );
    const logoUrl = branding?.logoUrl
      ? this.resolveAssetUrl(branding.logoUrl)
      : '';
    const sealRecord = signatures.find(
      (s: { roleSlug: string }) => s.roleSlug === 'seal',
    );
    const sealUrl =
      sealRecord?.sealPath ?? registrar?.sealPath ?? principal?.sealPath;

    const qrCode = verificationToken
      ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}" alt="Verify certificate" width="68" height="68"/>`
      : '';

    const gender = String(student?.masterProfile?.gender ?? '').toUpperCase();
    const studentTitle =
      gender === 'FEMALE' || gender === 'F'
        ? 'Ms.'
        : gender === 'MALE' || gender === 'M'
          ? 'Mr.'
          : 'Mr./Ms.';
    const sonDaughter =
      gender === 'FEMALE' || gender === 'F'
        ? 'daughter'
        : gender === 'MALE' || gender === 'M'
          ? 'son'
          : 'son/daughter';

    const permanentAddress = this.formatPermanentAddress(
      student?.addresses,
      student?.masterProfile?.address,
    );
    const fatherName =
      fatherGuardian?.fullName ??
      custom.father_name ??
      guardian?.fullName ??
      '';
    const motherName = motherGuardian?.fullName ?? custom.mother_name ?? '';
    const parentName =
      fatherName || motherName
        ? [fatherName, motherName].filter(Boolean).join(' / ')
        : '';
    const lastSemester = student?.academicStanding?.currentSemesterSequence;
    const lastSemesterCompleted =
      custom.last_semester_completed ??
      (lastSemester
        ? `Semester ${lastSemester}`
        : (currentRegistration?.semester?.name ?? ''));
    const academicStatus =
      custom.academic_status ??
      student?.masterProfile?.studentStatus ??
      student?.academicStanding?.standingStatus ??
      'Regular';
    const lifecycleMeta = (lifecycleEvent?.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const lifecycleReason = lifecycleEvent?.reason ?? '';
    const leavingDate =
      custom.date_of_leaving ??
      (lifecycleEvent?.effectiveDate
        ? new Date(lifecycleEvent.effectiveDate).toISOString().slice(0, 10)
        : '');
    const reasonForLeaving =
      custom.reason_for_leaving ??
      lifecycleMeta.reason_for_leaving ??
      lifecycleReason ??
      (lifecycleEvent?.eventType === 'MIGRATION'
        ? 'Migration'
        : 'Completed Programme');
    const conduct = custom.conduct ?? lifecycleMeta.conduct ?? 'Good';
    const attendance =
      custom.attendance ?? lifecycleMeta.attendance ?? 'Satisfactory';
    const feeClearance =
      custom.fee_clearance ??
      custom.fee_status ??
      lifecycleMeta.fee_clearance ??
      lifecycleMeta.fee_status ??
      'All dues cleared';
    const remarks =
      custom.remarks ?? lifecycleMeta.remarks ?? lifecycleReason ?? '';
    const industry =
      custom.industry ?? lifecycleMeta.industry ?? attendance ?? 'Satisfactory';
    const now = new Date();
    const trackMajor = String(
      custom.major_subject ??
        student?.majorMinorTrack?.majorSubject?.name ??
        '',
    ).trim();
    const programmeFields = this.buildProgrammeFields(programme, trackMajor);

    const snapshot = {
      student_name: fullName,
      student_title: studentTitle,
      son_daughter: sonDaughter,
      parent_name: parentName,
      permanent_address: permanentAddress,
      admission_number: student?.admissionNumber ?? '',
      registration_number:
        student?.enrollmentNumber ?? student?.admissionNumber ?? '',
      roll_number: student?.rollNumber ?? '',
      enrollment_number: student?.enrollmentNumber ?? '',
      programme,
      department,
      major_subject: programmeFields.majorSubject,
      degree_phrase: programmeFields.degreePhrase,
      minor_subject: student?.majorMinorTrack?.minorSubject?.name ?? '',
      semester:
        currentRegistration?.semester?.name ??
        String(student?.academicStanding?.currentSemesterSequence ?? ''),
      batch: student?.academicProfile?.admissionBatch?.batchCode ?? '',
      shift: student?.primaryShift?.name ?? '',
      stream: student?.academicProfile?.stream?.name ?? '',
      academic_year:
        currentRegistration?.semester?.academicYearIndex ?? String(sessionEnd),
      academic_session: academicSession,
      date_of_admission: student?.admissionDate
        ? new Date(student.admissionDate).toLocaleDateString('en-IN')
        : '',
      date_of_leaving: this.formatDisplayDate(leavingDate),
      date_of_birth: student?.masterProfile?.dateOfBirth
        ? new Date(student.masterProfile.dateOfBirth).toLocaleDateString(
            'en-IN',
          )
        : '',
      father_name: fatherName,
      mother_name: motherName,
      last_class_attended: custom.last_class_attended ?? lastSemesterCompleted,
      last_semester_completed: lastSemesterCompleted,
      academic_status: academicStatus,
      industry,
      reason_for_leaving: String(reasonForLeaving),
      conduct: String(conduct),
      attendance: String(attendance),
      fee_status: String(feeClearance),
      fee_clearance: String(feeClearance),
      remarks: String(remarks),
      study_period: admissionYear
        ? `${admissionYear} - ${sessionEnd}`
        : academicSession,
      completion_date: custom.completion_date ?? String(sessionEnd),
      examination_year: custom.examination_year ?? String(sessionEnd),
      examination_month_year:
        custom.examination_month_year ?? `May ${sessionEnd}`,
      cgpa: custom.cgpa ?? '',
      grade: custom.grade ?? '',
      marks: custom.marks ?? '',
      division: custom.division ?? 'Pass',
      college_name: collegeName,
      college_name_upper: 'DON BOSCO COLLEGE, TURA',
      university_name: 'North Eastern Hill University',
      university_affiliation: '(Affiliated to North Eastern Hill University)',
      naac_info: "NAAC Re-accredited with Grade 'B'",
      college_address: branding?.address ?? 'Tura – 794001, Meghalaya',
      college_pin: '794001',
      college_phone: custom.college_phone ?? '+91 3651 232 273',
      college_email: custom.college_email ?? 'principaldbct@gmail.com',
      college_website: custom.college_website ?? 'www.donboscocollege.ac.in',
      college_contact_line: `${custom.college_website ?? 'www.donboscocollege.ac.in'} | ${custom.college_email ?? 'principaldbct@gmail.com'} | ${custom.college_phone ?? '+91 3651 232 273'}`,
      principal_name: principal?.displayName ?? 'Principal',
      registrar_name: registrar?.displayName ?? '',
      principal_signature_block: this.buildSignatureBlock(
        principal?.displayName ?? 'Principal',
        'Principal',
        principal?.signaturePath,
        'dbc-signature',
      ),
      registrar_block: this.buildSignatureBlock(
        registrar?.displayName ?? '',
        'Registrar',
        registrar?.signaturePath,
        'dbc-tc-signature',
      ),
      certificate_number:
        issueMeta?.certificateNo ?? custom.certificate_number ?? '',
      memo_no: custom.memo_no ?? `DBC/M/${String(Date.now()).slice(-5)}`,
      verification_id: verificationId,
      document_id: verificationToken || '',
      verification_url: verificationUrl,
      verification_portal: 'verify.dbctura.edu.in',
      issued_timestamp: now.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      date_of_issue: now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      qr_code: qrCode,
      logo_block: logoUrl
        ? `<img class="dbc-logo" src="${logoUrl}" alt="College logo"/>`
        : `<div class="dbc-logo-placeholder">Don Bosco<br/>College Tura</div>`,
      seal_block: sealUrl
        ? `<img class="dbc-seal-img" src="${this.resolveAssetUrl(sealUrl)}" alt="Official seal"/>`
        : `<div class="dbc-seal-img" style="border:2px solid #94a3b8;border-radius:50%;width:72px;height:72px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b">SEAL</div>`,
      student_photo: student?.masterProfile?.photoPath ?? '',
      subjects:
        currentRegistration?.lines
          ?.map(
            (line: { offering: { course: { code: string } } }) =>
              line.offering.course.code,
          )
          .join(', ') ?? '',
    };

    return {
      ...custom,
      ...snapshot,
      major_subject: programmeFields.majorSubject,
      degree_phrase: programmeFields.degreePhrase,
    };
  }

  renderTemplate(html: string, variables: Record<string, unknown>) {
    return html.replace(
      /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
      (_match, key: string) => {
        const value = variables[key];
        return value === undefined || value === null ? '' : String(value);
      },
    );
  }

  private buildSignatureBlock(
    displayName: string,
    designation: string,
    signaturePath?: string | null,
    wrapperClass = 'dbc-signature',
  ) {
    const signatureImg = signaturePath
      ? `<img class="dbc-sig-img" src="${this.resolveAssetUrl(signaturePath)}" alt="${designation} signature"/>`
      : '';
    const line = displayName?.trim() ? displayName : '&nbsp;';
    return `<div class="${wrapperClass}">${signatureImg}<div class="line">${line}</div><div class="designation">${designation}</div><div class="dbc-digital">✓ Digitally signed record</div></div>`;
  }

  private buildProgrammeFields(programme: string, trackMajor: string) {
    const programmeName = programme.trim();
    const embeddedMatch = programmeName.match(/\bin\s+(.+)$/i);
    const embeddedSubject = embeddedMatch?.[1]?.trim() ?? '';
    const normalize = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/\s+honours$/i, '');

    let majorSubject = trackMajor;
    if (majorSubject && normalize(majorSubject) === normalize(programmeName)) {
      majorSubject = '';
    }
    if (!majorSubject && embeddedSubject) {
      majorSubject = `${embeddedSubject} Honours`;
    } else if (
      majorSubject &&
      embeddedSubject &&
      normalize(majorSubject) === normalize(embeddedSubject) &&
      !/\bHonours\b/i.test(majorSubject)
    ) {
      majorSubject = `${embeddedSubject} Honours`;
    }

    const majorBase = majorSubject ? normalize(majorSubject) : '';
    const programmeAlreadyIncludesMajor =
      Boolean(majorBase) &&
      (normalize(programmeName) === majorBase ||
        programmeName.toLowerCase().includes(` in ${majorBase}`));

    const degreePhrase =
      !majorSubject || programmeAlreadyIncludesMajor
        ? programmeName
        : `${programmeName} in ${majorSubject}`;

    return { majorSubject, degreePhrase };
  }

  private formatDisplayDate(value: unknown, fallback = new Date()): string {
    if (value === undefined || value === null || value === '') {
      return fallback.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatPermanentAddress(
    addresses?: Array<{
      addressType?: string;
      line1?: string;
      line2?: string;
      city?: string;
      district?: string;
      state?: string;
      pinCode?: string;
    }>,
    profileAddress?: unknown,
  ): string {
    const typed = addresses ?? [];
    const permanent =
      typed.find(
        (row) => String(row.addressType ?? '').toUpperCase() === 'PERMANENT',
      ) ??
      typed.find(
        (row) => String(row.addressType ?? '').toUpperCase() === 'HOME',
      ) ??
      typed[0];
    if (permanent) {
      return [
        permanent.line1,
        permanent.line2,
        permanent.city,
        permanent.district,
        permanent.state,
        permanent.pinCode,
      ]
        .filter(Boolean)
        .join(', ');
    }
    if (profileAddress && typeof profileAddress === 'object') {
      const row = profileAddress as Record<string, string | undefined>;
      return [
        row.line1,
        row.line2,
        row.city,
        row.district,
        row.state,
        row.pinCode,
        row.pincode,
      ]
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }

  private resolveAssetUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base =
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      'http://localhost:3001';
    return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
