import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IaSettingsService } from './ia-settings.service';

export type IaAdmitEligibilityResult = {
  eligible: boolean;
  status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING';
  reasons: string[];
  missingFields: string[];
  attendancePercent: number | null;
  feeDue: number | null;
  flags: {
    academic: boolean;
    attendance: boolean;
    fee: boolean;
    administrative: boolean;
    dataComplete: boolean;
  };
};

type StudentEligibilityInput = {
  id: string;
  rollNumber?: string | null;
  enrollmentNumber?: string;
  programVersionId?: string | null;
  departmentId?: string | null;
  masterProfile?: {
    studentStatus?: string;
    admissionStatus?: string;
    photoPath?: string | null;
  } | null;
  academicStanding?: {
    lifecycleState?: string;
    programmeStatus?: string;
    registrationLocked?: boolean;
  } | null;
  semesterProgress?: Array<{ semesterSequence?: number; status?: string }>;
};

@Injectable()
export class IaAdmitEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IaSettingsService,
  ) {}

  async evaluateStudent(
    tenantId: string,
    student: StudentEligibilityInput,
    options?: { semesterNo?: number | null; isDefaulter?: boolean },
  ): Promise<IaAdmitEligibilityResult> {
    const cfg = await this.settings.getOrCreate(tenantId);
    const minAttendance = Number(cfg.attendanceMinPercent);
    const reasons: string[] = [];
    const missingFields: string[] = [];

    const profile = student.masterProfile;
    const standing = student.academicStanding;

    if (!student.rollNumber?.trim()) missingFields.push('Roll Number');
    if (!student.enrollmentNumber?.trim())
      missingFields.push('University Registration Number');
    if (!student.programVersionId) missingFields.push('Programme');
    if (!student.departmentId) missingFields.push('Department');
    if (!profile?.photoPath?.trim()) missingFields.push('Student Photo');

    const hasSemester =
      (student.semesterProgress?.length ?? 0) > 0 ||
      options?.semesterNo != null;
    if (!hasSemester) missingFields.push('Semester');

    let academicOk = true;
    const studentStatus = (profile?.studentStatus ?? 'STUDYING').toUpperCase();
    if (!['STUDYING', 'ACTIVE'].includes(studentStatus)) {
      academicOk = false;
      reasons.push(
        `Student status is ${studentStatus} (must be Active/Studying)`,
      );
    }
    const admissionStatus = (
      profile?.admissionStatus ?? 'ACTIVE'
    ).toUpperCase();
    if (admissionStatus !== 'ACTIVE') {
      academicOk = false;
      reasons.push(`Admission status is ${admissionStatus}`);
    }
    if (!student.programVersionId) {
      academicOk = false;
      reasons.push('Programme not assigned');
    }

    let adminOk = true;
    const lifecycle = (standing?.lifecycleState ?? 'ACTIVE').toUpperCase();
    if (
      ['SUSPENDED', 'DISCONTINUED', 'DETAINED', 'RUSTICATED'].includes(
        lifecycle,
      )
    ) {
      adminOk = false;
      reasons.push(`Administrative hold: ${lifecycle}`);
    }
    const programmeStatus = (
      standing?.programmeStatus ?? 'IN_PROGRESS'
    ).toUpperCase();
    if (['DISCONTINUED', 'DETAINED', 'SUSPENDED'].includes(programmeStatus)) {
      adminOk = false;
      reasons.push(`Programme status: ${programmeStatus}`);
    }
    if (standing?.registrationLocked) {
      adminOk = false;
      reasons.push('Registration locked');
    }

    const attendanceRows = await this.prisma.studentAttendanceSummary.findMany({
      where: {
        tenantId,
        studentId: student.id,
        periodKey: 'SEMESTER',
        ...(options?.semesterNo != null
          ? { semesterNo: options.semesterNo }
          : {}),
      },
      select: { percentage: true },
    });
    const attendancePercent = attendanceRows.length
      ? Math.round(
          attendanceRows.reduce((s, r) => s + Number(r.percentage ?? 0), 0) /
            attendanceRows.length,
        )
      : null;
    let attendanceOk = true;
    if (attendancePercent != null && attendancePercent < minAttendance) {
      attendanceOk = false;
      reasons.push(
        `Attendance ${attendancePercent}% below minimum ${minAttendance}%`,
      );
    } else if (attendancePercent == null && cfg.blockAdmitOnDefaulter) {
      attendanceOk = false;
      reasons.push('Attendance record not available');
    }

    const feeRow = await this.prisma.studentFeeSummary.findUnique({
      where: {
        tenantId_studentId: { tenantId, studentId: student.id },
      },
      select: { totalOutstanding: true, feeStatus: true },
    });
    const feeDue = Number(feeRow?.totalOutstanding ?? 0);
    let feeOk = true;
    if (feeDue > 0) {
      feeOk = false;
      reasons.push(
        `Examination/fee dues pending (₹${feeDue.toLocaleString('en-IN')})`,
      );
    }
    const feeStatus = (feeRow?.feeStatus ?? '').toUpperCase();
    if (feeStatus === 'HOLD' || feeStatus === 'CRITICAL_HOLD') {
      feeOk = false;
      reasons.push(`Critical fee hold (${feeStatus})`);
    }

    if (options?.isDefaulter && cfg.blockAdmitOnDefaulter) {
      attendanceOk = false;
      reasons.push('Listed as IA/attendance defaulter');
    }

    if (missingFields.length) {
      reasons.push(`Missing: ${missingFields.join(', ')}`);
    }

    const dataComplete = missingFields.length === 0;
    const eligible =
      academicOk && adminOk && attendanceOk && feeOk && dataComplete;

    return {
      eligible,
      status: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
      reasons: [...new Set(reasons)],
      missingFields,
      attendancePercent,
      feeDue: feeDue > 0 ? feeDue : null,
      flags: {
        academic: academicOk,
        attendance: attendanceOk,
        fee: feeOk,
        administrative: adminOk,
        dataComplete,
      },
    };
  }

  async evaluateBatch(
    tenantId: string,
    studentIds: string[],
    options?: { semesterNo?: number | null; defaulterIds?: Set<string> },
  ) {
    if (!studentIds.length) return new Map<string, IaAdmitEligibilityResult>();

    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: studentIds }, deletedAt: null },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        programVersionId: true,
        departmentId: true,
        masterProfile: {
          select: {
            studentStatus: true,
            admissionStatus: true,
            photoPath: true,
            gender: true,
            dateOfBirth: true,
            fullName: true,
          },
        },
        academicStanding: {
          select: {
            lifecycleState: true,
            programmeStatus: true,
            registrationLocked: true,
          },
        },
        semesterProgress: {
          select: { semesterSequence: true, status: true },
          take: 5,
        },
      },
    });

    const map = new Map<string, IaAdmitEligibilityResult>();
    for (const student of students) {
      map.set(
        student.id,
        await this.evaluateStudent(tenantId, student, {
          semesterNo: options?.semesterNo,
          isDefaulter: options?.defaulterIds?.has(student.id),
        }),
      );
    }
    return map;
  }
}
