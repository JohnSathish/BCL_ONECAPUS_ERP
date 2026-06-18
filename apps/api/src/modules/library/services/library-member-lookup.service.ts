import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { LibraryQrService } from './library-qr.service';

export type LibraryMemberType = 'STUDENT' | 'STAFF' | 'FACULTY' | 'VISITOR';

export type LibraryMemberProfile = {
  memberType: LibraryMemberType;
  memberId: string;
  studentId?: string;
  staffProfileId?: string;
  visitorId?: string;
  fullName: string;
  photoUrl?: string | null;
  registrationNumber?: string;
  department?: string | null;
  programme?: string | null;
  semester?: number | null;
  gender?: string | null;
  academicYear?: string | null;
  designation?: string | null;
  status: string;
  active: boolean;
};

@Injectable()
export class LibraryMemberLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: LibraryQrService,
  ) {}

  normalizeScanCode(raw: string) {
    return raw
      .trim()
      .replace(/\r?\n$/, '')
      .trim();
  }

  async lookup(
    tenantId: string,
    scanCode: string,
  ): Promise<LibraryMemberProfile> {
    const { code } = this.qr.resolveScanCode(scanCode);
    if (!code) throw new NotFoundException('Invalid scan code');

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rfidNumber: code },
          { enrollmentNumber: { equals: code, mode: 'insensitive' } },
          { rollNumber: { equals: code, mode: 'insensitive' } },
          { applicationNumber: { equals: code, mode: 'insensitive' } },
          { admissionNumber: { equals: code, mode: 'insensitive' } },
          {
            masterProfile: {
              mobileNumber: {
                contains: code.replace(/\D/g, '').slice(-10),
              },
            },
          },
        ],
      },
      include: {
        masterProfile: true,
        department: { select: { name: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        academicStanding: {
          select: { currentSemesterSequence: true, lifecycleState: true },
        },
        academicProfile: {
          include: {
            admissionBatch: {
              include: { entrySession: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (student) {
      const lifecycle = student.academicStanding?.lifecycleState ?? 'ACTIVE';
      return {
        memberType: 'STUDENT',
        memberId: student.id,
        studentId: student.id,
        fullName: student.masterProfile?.fullName ?? student.enrollmentNumber,
        photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
        registrationNumber: student.enrollmentNumber,
        department: student.department?.name ?? null,
        programme:
          student.programVersion?.program?.name ??
          student.programVersion?.program?.code ??
          null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
        gender: student.masterProfile?.gender ?? null,
        academicYear:
          student.academicProfile?.admissionBatch?.entrySession?.name ?? null,
        status: lifecycle,
        active: lifecycle === 'ACTIVE' || lifecycle === 'REGISTERED',
      };
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rfidNo: code },
          { biometricId: code },
          { biometricExternalUserId: code },
          { employeeCode: { equals: code, mode: 'insensitive' } },
        ],
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { label: true } },
      },
    });

    if (staff) {
      const isFaculty = staff.staffType === 'TEACHING';
      return {
        memberType: isFaculty ? 'FACULTY' : 'STAFF',
        memberId: staff.id,
        staffProfileId: staff.id,
        fullName: staff.fullName,
        photoUrl: staff.photoUrl,
        registrationNumber: staff.employeeCode,
        department: staff.department?.name ?? null,
        designation: staff.designation?.label ?? null,
        gender: staff.gender,
        status: staff.status,
        active: staff.status === 'ACTIVE',
      };
    }

    const visitor = await this.prisma.libraryVisitor.findFirst({
      where: { tenantId, passNumber: code },
    });

    if (visitor) {
      return {
        memberType: 'VISITOR',
        memberId: visitor.id,
        visitorId: visitor.id,
        fullName: visitor.fullName,
        registrationNumber: visitor.passNumber,
        department: visitor.institution,
        status: 'VISITOR',
        active: true,
      };
    }

    throw new NotFoundException(`No member found for scan code: ${code}`);
  }
}
