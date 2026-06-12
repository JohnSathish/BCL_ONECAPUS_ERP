import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StaffEmploymentService } from '../services/staff-employment.service';
import {
  STAFF_BULK_UPDATE_FIELD_MAP,
  serializeStaffBulkValue,
} from './staff-bulk-update-fields';

type StaffForBulk = Prisma.StaffProfileGetPayload<{
  include: {
    portalUser: true;
    additionalRoles: true;
  };
}>;

@Injectable()
export class StaffBulkSectionWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employment: StaffEmploymentService,
  ) {}

  loadStaffForBulk(tenantId: string, staffProfileId: string) {
    return this.prisma.staffProfile.findFirstOrThrow({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: {
        portalUser: true,
        additionalRoles: { where: { active: true } },
      },
    });
  }

  readFieldValue(staff: StaffForBulk, fieldKey: string): unknown {
    switch (fieldKey) {
      case 'portalEmail':
        return staff.portalUser?.email ?? null;
      case 'portalActive':
        return staff.portalUser?.isActive ?? false;
      case 'alternateEmail':
        return this.readJsonField(staff.addressJson, 'alternateEmail');
      case 'additionalRoleCodes':
        return staff.additionalRoles.map((r) => r.roleCode).join(',');
      case 'address':
      case 'city':
      case 'state':
      case 'postalCode':
      case 'teachingType':
      case 'eligibleSubjects':
      case 'researchRole':
      case 'facultyCategory':
        return this.readJsonField(
          fieldKey.startsWith('teaching') ||
            ['eligibleSubjects', 'researchRole', 'facultyCategory'].includes(
              fieldKey,
            )
            ? staff.attendanceDeviceMapping
            : staff.addressJson,
          fieldKey,
        );
      default:
        return (staff as unknown as Record<string, unknown>)[fieldKey] ?? null;
    }
  }

  buildPatches(
    fieldKeys: string[],
    values: Record<string, unknown>,
    updateMode: 'REPLACE' | 'APPEND' | 'CSV',
    current: Record<string, unknown>,
  ) {
    const patches: Record<string, Record<string, unknown>> = {};
    for (const fieldKey of fieldKeys) {
      const def = STAFF_BULK_UPDATE_FIELD_MAP.get(fieldKey);
      if (!def || values[fieldKey] === undefined) continue;
      let next = values[fieldKey];
      if (
        updateMode === 'APPEND' &&
        def.supportsAppend &&
        typeof next === 'string'
      ) {
        const prev = current[fieldKey];
        next = `${prev ? String(prev) + ' ' : ''}${next}`.trim();
      }
      const section = (patches[def.sectionKey] ??= {});
      section[fieldKey] = this.coerceValue(fieldKey, next);
    }
    return patches;
  }

  async applyPatches(
    tenantId: string,
    staffProfileId: string,
    patches: Record<string, Record<string, unknown>>,
  ) {
    const basicData = { ...(patches.basic ?? {}), ...(patches.device ?? {}) };
    const employmentData = patches.employment ?? {};
    const academicData = patches.academic ?? {};
    const portalData = patches.portal ?? {};
    const addressData = patches.address ?? {};

    if (Object.keys(basicData).length) {
      await this.prisma.staffProfile.update({
        where: { id: staffProfileId },
        data: basicData as Prisma.StaffProfileUpdateInput,
      });
    }

    if (
      Object.keys(employmentData).length ||
      academicData.additionalRoleCodes !== undefined
    ) {
      await this.employment.applyEmploymentUpdate(tenantId, staffProfileId, {
        ...employmentData,
        ...(academicData.additionalRoleCodes !== undefined
          ? {
              additionalRoleCodes: this.parseRoleCodes(
                academicData.additionalRoleCodes,
              ),
            }
          : {}),
      });
    }

    if (
      Object.keys(addressData).length ||
      portalData.alternateEmail !== undefined
    ) {
      const staff = await this.loadStaffForBulk(tenantId, staffProfileId);
      await this.prisma.staffProfile.update({
        where: { id: staffProfileId },
        data: {
          addressJson: {
            ...this.asRecord(staff.addressJson),
            ...addressData,
            ...(portalData.alternateEmail !== undefined
              ? { alternateEmail: portalData.alternateEmail }
              : {}),
          },
        },
      });
    }

    if (
      academicData.teachingType !== undefined ||
      academicData.eligibleSubjects !== undefined ||
      academicData.researchRole !== undefined ||
      academicData.facultyCategory !== undefined
    ) {
      const staff = await this.loadStaffForBulk(tenantId, staffProfileId);
      await this.prisma.staffProfile.update({
        where: { id: staffProfileId },
        data: {
          attendanceDeviceMapping: {
            ...this.asRecord(staff.attendanceDeviceMapping),
            ...(academicData.teachingType !== undefined
              ? { teachingType: academicData.teachingType }
              : {}),
            ...(academicData.eligibleSubjects !== undefined
              ? { eligibleSubjects: academicData.eligibleSubjects }
              : {}),
            ...(academicData.researchRole !== undefined
              ? { researchRole: academicData.researchRole }
              : {}),
            ...(academicData.facultyCategory !== undefined
              ? { facultyCategory: academicData.facultyCategory }
              : {}),
          },
        },
      });
    }

    if (
      portalData.portalEmail !== undefined ||
      portalData.portalActive !== undefined
    ) {
      const staff = await this.loadStaffForBulk(tenantId, staffProfileId);
      if (staff.portalUserId) {
        await this.prisma.user.update({
          where: { id: staff.portalUserId },
          data: {
            ...(portalData.portalEmail !== undefined
              ? { email: String(portalData.portalEmail) }
              : {}),
            ...(portalData.portalActive !== undefined
              ? {
                  isActive: Boolean(portalData.portalActive),
                  accountStatus: portalData.portalActive
                    ? 'active'
                    : 'inactive',
                }
              : {}),
          },
        });
      }
    }
  }

  async writeAuditLogs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    batchId: string,
    changes: {
      fieldKey: string;
      sectionKey: string;
      oldValue: unknown;
      newValue: unknown;
    }[],
  ) {
    if (!changes.length) return;
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        module: 'staff',
        action: 'bulk_update_apply',
        entityType: 'StaffBulkUpdateBatch',
        entityId: batchId,
        metadata: {
          changes: changes.map((change) => ({
            fieldKey: change.fieldKey,
            sectionKey: change.sectionKey,
            oldValue: serializeStaffBulkValue(change.oldValue),
            newValue: serializeStaffBulkValue(change.newValue),
          })),
        },
      },
    });
  }

  private coerceValue(fieldKey: string, value: unknown) {
    if (value === null || value === undefined) return null;
    if (['dateOfBirth', 'joiningDate'].includes(fieldKey)) {
      const text = String(value).trim();
      return text ? new Date(text) : null;
    }
    if (fieldKey === 'portalActive') {
      return ['true', 'active', 'yes', '1'].includes(
        String(value).trim().toLowerCase(),
      );
    }
    if (
      fieldKey === 'staffType' ||
      fieldKey === 'status' ||
      fieldKey === 'gender'
    ) {
      return String(value).trim().toUpperCase().replace(/\s+/g, '_');
    }
    return typeof value === 'string' ? value.trim() : value;
  }

  private parseRoleCodes(value: unknown) {
    if (Array.isArray(value)) return value.map(String);
    return String(value ?? '')
      .split(/[;,]/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
  }

  private readJsonField(json: Prisma.JsonValue | null, key: string) {
    return this.asRecord(json)[key] ?? null;
  }

  private asRecord(json: Prisma.JsonValue | null): Record<string, unknown> {
    return json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  }
}
