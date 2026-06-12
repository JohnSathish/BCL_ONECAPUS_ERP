import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StudentProfileSectionsService } from '../services/student-profile-sections.service';
import {
  BULK_UPDATE_FIELD_MAP,
  serializeFieldValue,
  type BulkUpdateFieldDef,
} from './bulk-update-fields';
import type { ProfileSectionKey } from '../domain/profile-sections';

type StudentWithProfile = Awaited<
  ReturnType<StudentProfileSectionsService['loadStudentForBulk']>
>;

@Injectable()
export class StudentBulkSectionWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sections: StudentProfileSectionsService,
  ) {}

  async readFieldValue(
    student: StudentWithProfile,
    fieldKey: string,
  ): Promise<unknown> {
    const def = BULK_UPDATE_FIELD_MAP.get(fieldKey);
    if (!def) return null;

    switch (fieldKey) {
      case 'fullName':
        return student.masterProfile?.fullName ?? null;
      case 'mobileNumber':
        return student.masterProfile?.mobileNumber ?? null;
      case 'email':
        return student.masterProfile?.email ?? student.user.email ?? null;
      case 'dateOfBirth':
        return student.masterProfile?.dateOfBirth ?? null;
      case 'gender':
        return student.masterProfile?.gender ?? null;
      case 'bloodGroupLookupId':
        return student.masterProfile?.bloodGroupLookupId ?? null;
      case 'rollNumber':
        return student.rollNumber ?? null;
      case 'enrollmentNumber':
        return student.enrollmentNumber ?? null;
      case 'primaryShiftId':
        return student.primaryShiftId ?? null;
      case 'studentStatus':
        return student.masterProfile?.studentStatus ?? null;
      case 'admissionStatus':
        return student.masterProfile?.admissionStatus ?? null;
      case 'programVersionId':
        return student.programVersionId ?? null;
      case 'streamId':
        return student.academicProfile?.streamId ?? null;
      case 'admissionBatchId':
        return student.academicProfile?.admissionBatchId ?? null;
      case 'majorSubjectSlug':
        return (
          student.programChoices.find((c) => c.choiceType === 'MAJOR')
            ?.subjectSlug ?? null
        );
      case 'minorSubjectSlug':
        return (
          student.programChoices.find((c) => c.choiceType === 'MINOR')
            ?.subjectSlug ?? null
        );
      case 'residenceType':
      case 'hostelBlock':
      case 'hostelRoom': {
        const rows = await this.prisma.$queryRaw<
          {
            residenceType: string | null;
            hostelBlock: string | null;
            hostelRoom: string | null;
          }[]
        >`
          SELECT
            residence_type AS "residenceType",
            hostel_block AS "hostelBlock",
            hostel_room AS "hostelRoom"
          FROM academic.student_academic_profiles
          WHERE tenant_id = ${student.tenantId}::uuid
            AND student_id = ${student.id}::uuid
        `;
        const row = rows[0];
        if (fieldKey === 'residenceType') return row?.residenceType ?? null;
        if (fieldKey === 'hostelBlock') return row?.hostelBlock ?? null;
        return row?.hostelRoom ?? null;
      }
      case 'categoryLookupId':
        return student.masterProfile?.categoryLookupId ?? null;
      case 'religionLookupId':
        return student.masterProfile?.religionLookupId ?? null;
      case 'tribeLookupId':
        return student.masterProfile?.tribeLookupId ?? null;
      case 'ews':
        return student.masterProfile?.ews ?? false;
      case 'differentlyAbled':
        return student.masterProfile?.differentlyAbled ?? false;
      case 'turaAddress': {
        const addr = student.addresses.find((a) => a.addressType === 'TURA');
        return addr ? this.formatAddress(addr) : null;
      }
      case 'homeAddress': {
        const addr = student.addresses.find((a) => a.addressType === 'HOME');
        return addr ? this.formatAddress(addr) : null;
      }
      case 'fatherName':
        return (
          student.guardians.find((g) => g.guardianType === 'FATHER')
            ?.fullName ?? null
        );
      case 'fatherPhone':
        return (
          student.guardians.find((g) => g.guardianType === 'FATHER')
            ?.contactNumber ?? null
        );
      case 'fatherOccupation':
        return (
          student.guardians.find((g) => g.guardianType === 'FATHER')
            ?.occupation ?? null
        );
      case 'motherName':
        return (
          student.guardians.find((g) => g.guardianType === 'MOTHER')
            ?.fullName ?? null
        );
      case 'motherPhone':
        return (
          student.guardians.find((g) => g.guardianType === 'MOTHER')
            ?.contactNumber ?? null
        );
      case 'guardianName':
        return (
          student.guardians.find((g) => g.guardianType === 'LOCAL_GUARDIAN')
            ?.fullName ?? null
        );
      case 'guardianPhone':
        return (
          student.guardians.find((g) => g.guardianType === 'LOCAL_GUARDIAN')
            ?.contactNumber ?? null
        );
      case 'MDC':
      case 'AEC':
      case 'SEC':
      case 'VAC':
      case 'VTC':
        return this.readNepCategoryOffering(student, fieldKey);
      default:
        return null;
    }
  }

  buildSectionPatches(
    fieldKeys: string[],
    values: Record<string, unknown>,
    updateMode: 'REPLACE' | 'APPEND' | 'CSV',
    current: Record<string, unknown>,
  ) {
    const patches: Partial<Record<ProfileSectionKey, Record<string, unknown>>> =
      {};

    for (const fieldKey of fieldKeys) {
      const def = BULK_UPDATE_FIELD_MAP.get(fieldKey);
      if (!def) continue;
      let next = values[fieldKey];
      if (next === undefined) continue;

      if (
        updateMode === 'APPEND' &&
        def.supportsAppend &&
        typeof next === 'string'
      ) {
        const prev = current[fieldKey];
        next = `${prev ? String(prev) + ' ' : ''}${next}`.trim();
      }

      const section = (patches[def.sectionKey as ProfileSectionKey] ??= {});

      switch (fieldKey) {
        case 'turaAddress':
          section.tura = this.parseAddressText(String(next));
          break;
        case 'homeAddress':
          section.home = this.parseAddressText(String(next));
          break;
        case 'fatherName':
          section.father = { ...(section.father as object), fullName: next };
          break;
        case 'fatherPhone':
          section.father = {
            ...(section.father as object),
            contactNumber: next,
          };
          break;
        case 'fatherOccupation':
          section.father = { ...(section.father as object), occupation: next };
          break;
        case 'motherName':
          section.mother = { ...(section.mother as object), fullName: next };
          break;
        case 'motherPhone':
          section.mother = {
            ...(section.mother as object),
            contactNumber: next,
          };
          break;
        case 'guardianName':
          section.localGuardian = {
            ...(section.localGuardian as object),
            fullName: next,
          };
          break;
        case 'guardianPhone':
          section.localGuardian = {
            ...(section.localGuardian as object),
            contactNumber: next,
          };
          break;
        default:
          section[fieldKey] = next;
          break;
      }
    }

    return patches;
  }

  async applySectionPatches(
    tenantId: string,
    studentId: string,
    patches: Partial<Record<ProfileSectionKey, Record<string, unknown>>>,
    actorId?: string,
  ) {
    for (const [sectionKey, dto] of Object.entries(patches)) {
      if (!dto || Object.keys(dto).length === 0) continue;
      if (sectionKey === 'fyugp_registration') continue;
      await this.sections.updateSection(
        tenantId,
        studentId,
        sectionKey,
        dto,
        actorId,
      );
    }
  }

  async writeAuditLogs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    actorId: string | undefined,
    changes: {
      fieldKey: string;
      sectionKey: string;
      oldValue: unknown;
      newValue: unknown;
    }[],
  ) {
    for (const change of changes) {
      const oldStr = serializeFieldValue(change.oldValue);
      const newStr = serializeFieldValue(change.newValue);
      if (oldStr === newStr) continue;
      await tx.studentProfileAuditLog.create({
        data: {
          tenantId,
          studentId,
          sectionKey: `bulk_update:${change.sectionKey}`,
          fieldKey: change.fieldKey,
          oldValue: oldStr,
          newValue: newStr,
          actorId,
        },
      });
    }
  }

  private formatAddress(addr: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    pinCode: string | null;
  }) {
    return [addr.line1, addr.line2, addr.city, addr.state, addr.pinCode]
      .filter(Boolean)
      .join(', ');
  }

  private parseAddressText(text: string) {
    return { line1: text.trim() };
  }

  private readNepCategoryOffering(
    student: StudentWithProfile,
    category: string,
  ) {
    const reg = student.semesterRegistrations?.[0];
    const line = reg?.lines?.find((l) => l.category === category);
    return line?.offeringId ?? line?.offeringSectionId ?? null;
  }
}

export type { BulkUpdateFieldDef };
