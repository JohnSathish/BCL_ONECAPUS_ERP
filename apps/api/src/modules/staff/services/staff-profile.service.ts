import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { StaffProfileSection } from '../dto/staff.dto';
import { STAFF_PROFILE_SECTIONS } from '../dto/staff.dto';
import { StaffEmploymentService } from './staff-employment.service';
import { teachingShiftCategoryLabel } from './staff-shift-category';
import { StaffProvisioningService } from './staff-provisioning.service';
import {
  assertBiometricIdUnique,
  normalizeBiometricId,
  BIOMETRIC_ID_MAX_LENGTH,
} from '../utils/staff-biometric.util';

const profileInclude = {
  department: { select: { id: true, code: true, name: true } },
  designation: { select: { id: true, code: true, label: true } },
  primaryShift: { select: { id: true, code: true, name: true } },
  portalUser: {
    select: {
      id: true,
      email: true,
      username: true,
      isActive: true,
      accountStatus: true,
      mustResetPassword: true,
      lastLoginAt: true,
    },
  },
  additionalRoles: {
    where: { active: true },
    orderBy: { createdAt: 'asc' as const },
  },
  shiftAssignments: {
    where: { active: true },
    include: { shift: { select: { id: true, code: true, name: true } } },
  },
  subjectAssignments: {
    include: {
      course: { select: { id: true, code: true, title: true } },
      offeringSection: { select: { id: true, sectionCode: true } },
      shift: { select: { id: true, code: true, name: true } },
      programVersion: {
        select: {
          id: true,
          program: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  documents: { orderBy: { createdAt: 'desc' as const } },
  publications: { orderBy: { publishedAt: 'desc' as const } },
  awards: { orderBy: { awardDate: 'desc' as const } },
  qualifications: { orderBy: { createdAt: 'desc' as const } },
  workloads: {
    include: { academicYear: { select: { id: true, name: true } } },
  },
  offeringSections: {
    where: { deletedAt: null },
    include: {
      shift: { select: { id: true, code: true, name: true } },
      courseOffering: {
        include: { course: { select: { code: true, title: true } } },
      },
    },
  },
  quarterOccupancies: {
    include: {
      quarter: {
        select: {
          code: true,
          quarterNumber: true,
          quarterType: true,
          block: true,
        },
      },
    },
    orderBy: { allottedAt: 'desc' as const },
  },
} satisfies Prisma.StaffProfileInclude;

@Injectable()
export class StaffProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: StaffProvisioningService,
    private readonly employment: StaffEmploymentService,
  ) {}

  async getProfile(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: profileInclude,
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    let bloodGroup: string | null = null;
    if (staff.bloodGroupLookupId) {
      const lookup = await this.prisma.masterLookup.findFirst({
        where: { id: staff.bloodGroupLookupId, tenantId },
        select: { label: true },
      });
      bloodGroup = lookup?.label ?? null;
    }

    return {
      ...this.toProfileResponse(staff),
      bloodGroupLookupId: staff.bloodGroupLookupId,
      bloodGroup,
    };
  }

  async updateSection(
    tenantId: string,
    staffProfileId: string,
    sectionKey: string,
    payload: Record<string, unknown>,
  ) {
    if (!STAFF_PROFILE_SECTIONS.includes(sectionKey as StaffProfileSection)) {
      throw new BadRequestException(`Unknown profile section: ${sectionKey}`);
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (sectionKey === 'basic') {
      const nextBiometricId =
        payload.biometricId === null
          ? null
          : typeof payload.biometricId === 'string'
            ? normalizeBiometricId(payload.biometricId)
            : undefined;
      if (nextBiometricId && nextBiometricId !== staff.biometricId) {
        if (nextBiometricId.length > BIOMETRIC_ID_MAX_LENGTH) {
          throw new BadRequestException(
            `Biometric ID must be at most ${BIOMETRIC_ID_MAX_LENGTH} characters.`,
          );
        }
        await assertBiometricIdUnique(this.prisma, tenantId, nextBiometricId, {
          campusId: staff.campusId,
          departmentId: staff.departmentId,
          primaryShiftId: staff.primaryShiftId,
          excludeStaffId: staffProfileId,
        });
      }
    }

    if (sectionKey === 'employment') {
      await this.employment.applyEmploymentUpdate(tenantId, staffProfileId, {
        staffType: payload.staffType as string | undefined,
        employmentType: payload.employmentType as string | undefined,
        status: payload.status as string | undefined,
        departmentId: payload.departmentId as string | null | undefined,
        designationId: payload.designationId as string | null | undefined,
        primaryShiftId: payload.primaryShiftId as string | null | undefined,
        additionalShiftIds: payload.additionalShiftIds as string[] | undefined,
        teachingShiftCategory: payload.teachingShiftCategory as
          | string
          | undefined,
        additionalRoleCodes: payload.additionalRoleCodes as
          | string[]
          | undefined,
        shortCode: payload.shortCode as string | null | undefined,
        joiningDate: payload.joiningDate as string | null | undefined,
        probationEndDate: payload.probationEndDate as string | null | undefined,
        confirmationDate: payload.confirmationDate as string | null | undefined,
        relievingDate: payload.relievingDate as string | null | undefined,
        retirementDate: payload.retirementDate as string | null | undefined,
        lastWorkingDate: payload.lastWorkingDate as string | null | undefined,
        resignationReason: payload.resignationReason as
          | string
          | null
          | undefined,
      });
      return this.getProfile(tenantId, staffProfileId);
    }

    const data = this.buildSectionUpdate(
      sectionKey as StaffProfileSection,
      payload,
    );

    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data,
    });

    return this.getProfile(tenantId, staffProfileId);
  }

  toDirectoryRow(staff: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    photoUrl?: string | null;
    staffType: string;
    employmentType: string;
    status: string;
    rfidNo: string | null;
    joiningDate: Date | null;
    shortCode?: string | null;
    relievingDate?: Date | null;
    department: { id: string; code: string; name: string } | null;
    designation: { id: string; code: string; label: string } | null;
    primaryShift: { id: string; code: string; name: string } | null;
    teachingShiftCategory?: string;
    additionalRoles?: { roleCode: string; roleName: string; active: boolean }[];
    portalUser: {
      id: string;
      email: string;
      isActive: boolean;
      accountStatus: string;
      mustResetPassword: boolean;
    } | null;
    _count?: {
      subjectAssignments: number;
      offeringSections: number;
      publications?: number;
    };
    quarterOccupancies?: { quarter: { code: string; quarterNumber: string } }[];
  }) {
    const activeRoles = (staff.additionalRoles ?? []).filter((r) => r.active);
    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      shortCode: staff.shortCode ?? null,
      email: staff.email ?? staff.portalUser?.email ?? null,
      mobile: staff.mobile,
      photoUrl: staff.photoUrl ?? null,
      staffType: staff.staffType,
      employmentType: staff.employmentType,
      status: staff.status,
      rfidNo: staff.rfidNo,
      joiningDate: staff.joiningDate,
      department: staff.department?.name ?? null,
      departmentId: staff.department?.id ?? null,
      designation: staff.designation?.label ?? null,
      designationId: staff.designation?.id ?? null,
      additionalRoles: activeRoles.map((r) => ({
        code: r.roleCode,
        label: r.roleName,
      })),
      shift: staff.primaryShift?.name ?? null,
      primaryShiftId: staff.primaryShift?.id ?? null,
      teachingShiftCategory: staff.teachingShiftCategory ?? 'DAY',
      teachingShiftLabel: teachingShiftCategoryLabel(
        staff.teachingShiftCategory,
      ),
      portalActive: staff.portalUser?.isActive ?? false,
      portalPending:
        !!staff.portalUser &&
        (staff.portalUser.mustResetPassword ||
          staff.portalUser.accountStatus === 'pending'),
      subjectAssignments: staff._count?.subjectAssignments ?? 0,
      timetableSections: staff._count?.offeringSections ?? 0,
      publicationCount: staff._count?.publications ?? 0,
      quarter: staff.quarterOccupancies?.[0]?.quarter?.code ?? null,
      quarterNumber:
        staff.quarterOccupancies?.[0]?.quarter?.quarterNumber ?? null,
      isSchedulable: this.employment.isSchedulable({
        status: staff.status,
        relievingDate: staff.relievingDate ?? null,
      }),
    };
  }

  private buildSectionUpdate(
    sectionKey: StaffProfileSection,
    payload: Record<string, unknown>,
  ): Prisma.StaffProfileUpdateInput {
    switch (sectionKey) {
      case 'basic':
        return {
          fullName:
            typeof payload.fullName === 'string'
              ? payload.fullName.trim()
              : undefined,
          gender:
            typeof payload.gender === 'string' ? payload.gender : undefined,
          dateOfBirth:
            typeof payload.dateOfBirth === 'string'
              ? new Date(payload.dateOfBirth)
              : payload.dateOfBirth === null
                ? null
                : undefined,
          mobile:
            typeof payload.mobile === 'string'
              ? payload.mobile.trim()
              : undefined,
          email:
            typeof payload.email === 'string'
              ? payload.email.trim().toLowerCase()
              : undefined,
          aadhaarNo:
            typeof payload.aadhaarNo === 'string'
              ? payload.aadhaarNo.trim()
              : payload.aadhaarNo === null
                ? null
                : undefined,
          panNo:
            typeof payload.panNo === 'string'
              ? payload.panNo.trim()
              : payload.panNo === null
                ? null
                : undefined,
          photoUrl:
            typeof payload.photoUrl === 'string' ? payload.photoUrl : undefined,
          rfidNo:
            typeof payload.rfidNo === 'string'
              ? payload.rfidNo.trim()
              : payload.rfidNo === null
                ? null
                : undefined,
          biometricId:
            typeof payload.biometricId === 'string'
              ? payload.biometricId.trim()
              : payload.biometricId === null
                ? null
                : undefined,
          qualification:
            typeof payload.qualification === 'string'
              ? payload.qualification
              : undefined,
          specialization:
            typeof payload.specialization === 'string'
              ? payload.specialization
              : undefined,
          experienceYears:
            typeof payload.experienceYears === 'number'
              ? payload.experienceYears
              : undefined,
          bloodGroupLookupId:
            typeof payload.bloodGroupLookupId === 'string'
              ? payload.bloodGroupLookupId.trim() || null
              : payload.bloodGroupLookupId === null
                ? null
                : undefined,
        };
      case 'employment':
        return {};
      case 'portal':
        return {
          attendanceDeviceMapping:
            payload.attendanceDeviceMapping === null
              ? Prisma.JsonNull
              : payload.attendanceDeviceMapping !== undefined
                ? (payload.attendanceDeviceMapping as Prisma.InputJsonValue)
                : undefined,
          emergencyContactJson:
            payload.emergencyContactJson === null
              ? Prisma.JsonNull
              : payload.emergencyContactJson !== undefined
                ? (payload.emergencyContactJson as Prisma.InputJsonValue)
                : undefined,
        };
      case 'salary':
        return {
          bankName:
            typeof payload.bankName === 'string'
              ? payload.bankName
              : payload.bankName === null
                ? null
                : undefined,
          accountNumber:
            typeof payload.accountNumber === 'string'
              ? payload.accountNumber
              : payload.accountNumber === null
                ? null
                : undefined,
          ifsc:
            typeof payload.ifsc === 'string'
              ? payload.ifsc
              : payload.ifsc === null
                ? null
                : undefined,
          pfNumber:
            typeof payload.pfNumber === 'string'
              ? payload.pfNumber
              : payload.pfNumber === null
                ? null
                : undefined,
          basicPay:
            payload.basicPay != null
              ? String(payload.basicPay)
              : payload.basicPay === null
                ? null
                : undefined,
          salaryStructure:
            payload.salaryStructure === null
              ? Prisma.JsonNull
              : payload.salaryStructure !== undefined
                ? (payload.salaryStructure as Prisma.InputJsonValue)
                : undefined,
        };
      case 'address':
        return {
          addressJson:
            payload.addressJson === null
              ? Prisma.JsonNull
              : payload.addressJson !== undefined
                ? (payload.addressJson as Prisma.InputJsonValue)
                : undefined,
        };
      default:
        throw new BadRequestException(`Unsupported section: ${sectionKey}`);
    }
  }

  private toProfileResponse(
    staff: Prisma.StaffProfileGetPayload<{ include: typeof profileInclude }>,
  ) {
    const directory = this.toDirectoryRow(staff);
    const additionalShiftIds = staff.shiftAssignments
      .filter((a) => !a.isPrimary)
      .map((a) => a.shiftId);
    return {
      ...directory,
      gender: staff.gender,
      dateOfBirth: staff.dateOfBirth,
      aadhaarNo: staff.aadhaarNo,
      panNo: staff.panNo,
      photoUrl: staff.photoUrl,
      biometricId: staff.biometricId,
      qualification: staff.qualification,
      specialization: staff.specialization,
      experienceYears: staff.experienceYears,
      probationEndDate: staff.probationEndDate,
      confirmationDate: staff.confirmationDate,
      relievingDate: staff.relievingDate,
      retirementDate: staff.retirementDate,
      lastWorkingDate: staff.lastWorkingDate,
      resignationReason: staff.resignationReason,
      campusId: staff.campusId,
      additionalShiftIds,
      addressJson: staff.addressJson,
      emergencyContactJson: staff.emergencyContactJson,
      attendanceDeviceMapping: staff.attendanceDeviceMapping,
      bankName: staff.bankName,
      accountNumber: staff.accountNumber,
      ifsc: staff.ifsc,
      pfNumber: staff.pfNumber,
      basicPay: staff.basicPay,
      salaryStructure: staff.salaryStructure,
      portalUser: staff.portalUser,
      shiftAssignments: staff.shiftAssignments,
      additionalRoles: staff.additionalRoles,
      subjectAssignments: staff.subjectAssignments,
      offeringSections: staff.offeringSections,
      documents: staff.documents,
      publications: staff.publications,
      awards: staff.awards,
      qualifications: staff.qualifications,
      workloads: staff.workloads,
      accommodation: this.buildAccommodationSummary(staff.quarterOccupancies),
      isSchedulable: this.employment.isSchedulable({
        status: staff.status,
        relievingDate: staff.relievingDate,
        shiftAssignments: staff.shiftAssignments,
      }),
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  private buildAccommodationSummary(
    occupancies: {
      id: string;
      status: string;
      allottedAt: Date;
      vacatedAt: Date | null;
      monthlyRent: unknown;
      waterCharge: unknown;
      electricityCharge: unknown;
      maintenanceCharge: unknown;
      internetCharge: unknown;
      payrollDeductionEnabled: boolean;
      quarter: {
        code: string;
        quarterNumber: string;
        quarterType: string;
        block: string | null;
      };
    }[],
  ) {
    const active = occupancies.find((o) => o.status === 'ACTIVE') ?? null;
    return {
      status: active ? 'OCCUPIED' : 'NONE',
      active: active
        ? {
            occupancyId: active.id,
            quarterNumber: active.quarter.code,
            quarterType: active.quarter.quarterType,
            building: active.quarter.block,
            allottedAt: active.allottedAt,
            monthlyRent: Number(active.monthlyRent),
            waterCharge: Number(active.waterCharge),
            electricityCharge: Number(active.electricityCharge),
            maintenanceCharge: Number(active.maintenanceCharge),
            internetCharge: Number(active.internetCharge),
            payrollDeductionEnabled: active.payrollDeductionEnabled,
          }
        : null,
      history: occupancies.map((h) => ({
        id: h.id,
        status: h.status,
        quarterNumber: h.quarter.code,
        quarterType: h.quarter.quarterType,
        building: h.quarter.block,
        allottedAt: h.allottedAt,
        vacatedAt: h.vacatedAt,
        monthlyRent: Number(h.monthlyRent),
      })),
    };
  }
}
