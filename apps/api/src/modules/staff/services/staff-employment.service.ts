import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StaffAdditionalRoleService } from './staff-additional-role.service';
import { EmployeeCodeService } from './employee-code.service';
import { StaffLifecycleService } from './staff-lifecycle.service';
import {
  inferTeachingShiftCategory,
  isTeachingShiftCategory,
  resolveShiftIdsByCode,
  shiftAssignmentForCategory,
  teachingShiftCategoryLabel,
  type TeachingShiftCategory,
} from './staff-shift-category';
import {
  validateEmploymentCombination,
  supportsAdditionalAcademicRoles,
} from './staff-employment-rules';

const SHORT_CODE_RE = /^[A-Z0-9]{1,10}$/;

export type EmploymentUpdatePayload = {
  departmentId?: string | null;
  designationId?: string | null;
  primaryShiftId?: string | null;
  additionalShiftIds?: string[];
  teachingShiftCategory?: TeachingShiftCategory | string;
  additionalRoleCodes?: string[];
  shortCode?: string | null;
  staffType?: string;
  employmentType?: string;
  status?: string;
  joiningDate?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  relievingDate?: string | null;
  retirementDate?: string | null;
  lastWorkingDate?: string | null;
  resignationReason?: string | null;
};

@Injectable()
export class StaffEmploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: StaffAdditionalRoleService,
    private readonly lifecycle: StaffLifecycleService,
    private readonly employeeCodes: EmployeeCodeService,
  ) {}

  suggestShortCode(fullName: string): string {
    return this.buildShortCodeCandidates(fullName)[0] ?? '';
  }

  /** Preferred 2-letter candidates from a name (initials first). */
  buildShortCodeCandidates(fullName: string): string[] {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean);
    if (parts.length === 0) return [];

    const out: string[] = [];
    const push = (code: string) => {
      const normalized = code.toUpperCase().slice(0, 2);
      if (normalized.length === 2 && !out.includes(normalized))
        out.push(normalized);
    };

    if (parts.length === 1) {
      const w = parts[0].toUpperCase();
      if (w.length >= 2) push(w.slice(0, 2));
      if (w.length >= 3) push(w[0] + w[2]);
      if (w.length >= 4) push(w[0] + w[3]);
    } else {
      const first = parts[0].toUpperCase();
      const last = parts[parts.length - 1].toUpperCase();
      push(first[0] + last[0]);
      if (first.length >= 2) push(first.slice(0, 2));
      if (last.length >= 2) push(last.slice(0, 2));
      if (last.length >= 2) push(first[0] + last[1]);
      if (first.length >= 2) push(first[0] + first[1]);
      if (parts.length >= 3) {
        const mid = parts[1].toUpperCase();
        push(first[0] + mid[0]);
        push(mid[0] + last[0]);
      }
    }

    // Same-letter start sweep from primary initial (still 2 letters)
    const seed = out[0]?.[0] ?? 'A';
    for (let i = 0; i < 26; i += 1) {
      const second = String.fromCharCode(65 + i); // A-Z
      push(seed + second);
    }

    return out;
  }

  /**
   * Suggest a free 2-letter short code.
   * Always checks staff_profiles in the DB for already allotted codes before returning.
   */
  async suggestUniqueShortCode(
    tenantId: string,
    fullName: string,
    opts: {
      departmentId?: string | null;
      primaryShiftId?: string | null;
      campusId?: string | null;
      excludeStaffId?: string;
    } = {},
  ): Promise<{ shortCode: string; campusId: string | null }> {
    let campusId =
      opts.campusId ??
      (await this.resolveCampusId(
        tenantId,
        opts.departmentId,
        opts.primaryShiftId,
      ));

    if (!campusId) {
      const fallbackCampus = await this.prisma.campus.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      campusId = fallbackCampus?.id ?? null;
    }

    if (!campusId) {
      throw new BadRequestException(
        'Select a department or shift before suggesting a short code',
      );
    }

    const candidates = this.buildShortCodeCandidates(fullName);
    if (!candidates.length) {
      throw new BadRequestException(
        'Enter a staff full name before suggesting a short code',
      );
    }

    const takenRows = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        campusId,
        deletedAt: null,
        shortCode: { not: null },
        ...(opts.excludeStaffId ? { NOT: { id: opts.excludeStaffId } } : {}),
      },
      select: { shortCode: true },
    });
    const taken = new Set(
      takenRows
        .map((r) => (r.shortCode ?? '').trim().toUpperCase())
        .filter(Boolean),
    );

    const tryCode = async (code: string): Promise<string | null> => {
      if (taken.has(code)) return null;
      // Final DB guard (case-insensitive) before returning a suggestion
      const clash = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,
          campusId,
          deletedAt: null,
          shortCode: { equals: code, mode: 'insensitive' },
          ...(opts.excludeStaffId ? { NOT: { id: opts.excludeStaffId } } : {}),
        },
        select: { id: true },
      });
      if (clash) {
        taken.add(code);
        return null;
      }
      return code;
    };

    for (const code of candidates) {
      const free = await tryCode(code);
      if (free) return { shortCode: free, campusId };
    }

    for (let a = 0; a < 26; a += 1) {
      for (let b = 0; b < 26; b += 1) {
        const code = String.fromCharCode(65 + a) + String.fromCharCode(65 + b);
        const free = await tryCode(code);
        if (free) return { shortCode: free, campusId };
      }
    }

    throw new ConflictException(
      'No free 2-letter short codes left on this campus',
    );
  }

  normalizeShortCode(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    const normalized = value.trim().toUpperCase();
    if (!SHORT_CODE_RE.test(normalized)) {
      throw new BadRequestException(
        'Short code must be 1-10 uppercase letters or digits',
      );
    }
    return normalized;
  }

  async resolveCampusId(
    tenantId: string,
    departmentId?: string | null,
    primaryShiftId?: string | null,
  ): Promise<string | null> {
    if (departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId, deletedAt: null },
        select: { campusId: true },
      });
      if (dept?.campusId) return dept.campusId;
    }
    if (primaryShiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: primaryShiftId, tenantId, deletedAt: null },
        select: { campusId: true },
      });
      if (shift?.campusId) return shift.campusId;
    }
    return null;
  }

  async assertShortCodeUnique(
    campusId: string | null,
    shortCode: string | null,
    excludeStaffId?: string,
  ) {
    if (!campusId || !shortCode) return;
    const taken = await this.prisma.staffProfile.findFirst({
      where: {
        campusId,
        shortCode,
        deletedAt: null,
        ...(excludeStaffId ? { NOT: { id: excludeStaffId } } : {}),
      },
    });
    if (taken) {
      throw new ConflictException('Short code already in use in this campus');
    }
  }

  async syncShifts(
    tenantId: string,
    staffProfileId: string,
    primaryShiftId: string | null | undefined,
    additionalShiftIds: string[] = [],
  ) {
    const allShiftIds = new Set<string>();
    if (primaryShiftId) allShiftIds.add(primaryShiftId);
    for (const id of additionalShiftIds) {
      if (id && id !== primaryShiftId) allShiftIds.add(id);
    }

    for (const shiftId of allShiftIds) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: shiftId, tenantId, deletedAt: null, status: 'ACTIVE' },
      });
      if (!shift) throw new BadRequestException(`Invalid shift: ${shiftId}`);
    }

    const existing = await this.prisma.staffShiftAssignment.findMany({
      where: { tenantId, staffProfileId },
    });

    for (const row of existing) {
      if (!allShiftIds.has(row.shiftId)) {
        await this.prisma.staffShiftAssignment.update({
          where: { id: row.id },
          data: { active: false, isPrimary: false },
        });
      }
    }

    for (const shiftId of allShiftIds) {
      await this.prisma.staffShiftAssignment.upsert({
        where: {
          staffProfileId_shiftId: { staffProfileId, shiftId },
        },
        create: {
          tenantId,
          staffProfileId,
          shiftId,
          isPrimary: shiftId === primaryShiftId,
          active: true,
        },
        update: {
          isPrimary: shiftId === primaryShiftId,
          active: true,
        },
      });
    }
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return new Date(value);
  }

  async assertValidEmploymentCombo(
    tenantId: string,
    staffType: string,
    designationId?: string | null,
    departmentId?: string | null,
    additionalRoleCodes?: string[],
  ) {
    let designationCategory: string | null = null;
    if (designationId) {
      const designation = await this.prisma.designation.findFirst({
        where: { id: designationId, tenantId, isActive: true },
        select: { category: true },
      });
      if (!designation) throw new BadRequestException('Invalid designation');
      designationCategory = designation.category;
    }

    let departmentType: string | null = null;
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId, deletedAt: null },
        select: { departmentType: true },
      });
      if (!department) throw new BadRequestException('Invalid department');
      departmentType = department.departmentType;
    }

    const errors = validateEmploymentCombination({
      staffType,
      designationCategory,
      departmentType,
      additionalRoleCodes,
    });
    if (errors.length) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  async applyEmploymentUpdate(
    tenantId: string,
    staffProfileId: string,
    payload: EmploymentUpdatePayload,
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    // UI selects send "" for cleared optional UUIDs — Prisma UUID columns reject that (P2023).
    const nullIfEmpty = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      if (value === null || String(value).trim() === '') return null;
      return value;
    };

    const departmentId =
      payload.departmentId !== undefined
        ? nullIfEmpty(payload.departmentId)
        : staff.departmentId;
    let primaryShiftId =
      payload.primaryShiftId !== undefined
        ? nullIfEmpty(payload.primaryShiftId)
        : staff.primaryShiftId;
    let additionalShiftIds =
      payload.additionalShiftIds !== undefined
        ? payload.additionalShiftIds.filter((id) => Boolean(id?.trim?.() ?? id))
        : undefined;
    const staffType =
      payload.staffType !== undefined ? payload.staffType : staff.staffType;
    const designationId =
      payload.designationId !== undefined
        ? nullIfEmpty(payload.designationId)
        : staff.designationId;

    const staffTypeChanging =
      payload.staffType !== undefined && payload.staffType !== staff.staffType;
    const shouldClearAcademicRoles =
      staffTypeChanging && !supportsAdditionalAcademicRoles(staffType);

    let roleCodesForValidation = payload.additionalRoleCodes;
    if (shouldClearAcademicRoles) {
      roleCodesForValidation = [];
    } else if (roleCodesForValidation === undefined) {
      const activeRoles = await this.prisma.staffAdditionalRole.findMany({
        where: { tenantId, staffProfileId, active: true },
        select: { roleCode: true },
      });
      roleCodesForValidation = activeRoles.map((r) => r.roleCode);
    }

    await this.assertValidEmploymentCombo(
      tenantId,
      staffType,
      designationId,
      departmentId,
      roleCodesForValidation,
    );

    const campusId = await this.resolveCampusId(
      tenantId,
      departmentId,
      primaryShiftId,
    );

    let shortCode = staff.shortCode;
    if (payload.shortCode !== undefined) {
      shortCode = this.normalizeShortCode(payload.shortCode);
      await this.assertShortCodeUnique(campusId, shortCode, staffProfileId);
    }

    const updateData: Record<string, unknown> = {};
    if (payload.staffType !== undefined)
      updateData.staffType = payload.staffType;
    if (payload.employmentType !== undefined) {
      updateData.employmentType = payload.employmentType;
    }
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.departmentId !== undefined) {
      updateData.departmentId = payload.departmentId;
    }
    if (payload.designationId !== undefined) {
      updateData.designationId = payload.designationId;
    }
    if (payload.primaryShiftId !== undefined) {
      updateData.primaryShiftId = payload.primaryShiftId;
    }
    if (payload.teachingShiftCategory !== undefined) {
      if (!isTeachingShiftCategory(payload.teachingShiftCategory)) {
        throw new BadRequestException('Invalid teaching shift category');
      }
      updateData.teachingShiftCategory = payload.teachingShiftCategory;
      const shiftIds = await this.loadTeachingShiftIds(tenantId);
      const assignment = shiftAssignmentForCategory(
        payload.teachingShiftCategory,
        shiftIds,
      );
      primaryShiftId = assignment.primaryShiftId;
      additionalShiftIds = assignment.additionalShiftIds;
      updateData.primaryShiftId = assignment.primaryShiftId;
    }
    if (payload.shortCode !== undefined) updateData.shortCode = shortCode;
    if (campusId !== staff.campusId) updateData.campusId = campusId;

    const dateFields = [
      'joiningDate',
      'probationEndDate',
      'confirmationDate',
      'relievingDate',
      'retirementDate',
      'lastWorkingDate',
    ] as const;
    for (const field of dateFields) {
      const parsed = this.parseDate(payload[field]);
      if (parsed !== undefined) updateData[field] = parsed;
    }
    if (payload.resignationReason !== undefined) {
      updateData.resignationReason = payload.resignationReason;
    }

    if (staffTypeChanging && staff.employeeCodeAutoGenerated) {
      let institutionId: string | undefined;
      if (campusId) {
        const campus = await this.prisma.campus.findFirst({
          where: { id: campusId, tenantId, deletedAt: null },
          select: { institutionId: true },
        });
        institutionId = campus?.institutionId;
      }
      const joiningDate =
        payload.joiningDate !== undefined
          ? payload.joiningDate
          : staff.joiningDate?.toISOString().slice(0, 10);
      const allocated = await this.employeeCodes.allocateNextEmployeeCode(
        tenantId,
        {
          institutionId,
          staffType,
          joiningDate,
          staffProfileId,
          action: 'REGENERATE',
        },
      );
      updateData.employeeCode = allocated.employeeCode;
      updateData.employeeCodeAllocatedAt = new Date();
    }

    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: updateData,
    });

    if (
      payload.primaryShiftId !== undefined ||
      payload.additionalShiftIds !== undefined ||
      payload.teachingShiftCategory !== undefined
    ) {
      const existingAssignments =
        await this.prisma.staffShiftAssignment.findMany({
          where: { tenantId, staffProfileId, active: true, isPrimary: false },
          select: { shiftId: true },
        });
      await this.syncShifts(
        tenantId,
        staffProfileId,
        primaryShiftId,
        additionalShiftIds ?? existingAssignments.map((row) => row.shiftId),
      );
    }

    if (payload.additionalRoleCodes !== undefined) {
      await this.roles.replaceActiveRoles(
        tenantId,
        staffProfileId,
        payload.additionalRoleCodes.filter(
          (code): code is string =>
            typeof code === 'string' && code.trim().length > 0,
        ),
        departmentId,
      );
    } else if (shouldClearAcademicRoles) {
      await this.roles.replaceActiveRoles(
        tenantId,
        staffProfileId,
        [],
        departmentId,
      );
    }

    const relievingTriggered =
      payload.relievingDate !== undefined ||
      payload.status === 'RELIEVED' ||
      payload.status === 'RETIRED' ||
      payload.status === 'CONTRACT_ENDED';

    if (relievingTriggered) {
      await this.lifecycle.applyRelievingEffects(tenantId, staffProfileId);
    }

    return this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId },
    });
  }

  async loadTeachingShiftIds(tenantId: string) {
    const shifts = await this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, code: true },
    });
    return resolveShiftIdsByCode(shifts);
  }

  async applyTeachingShiftCategory(
    tenantId: string,
    staffProfileId: string,
    category: TeachingShiftCategory,
    options?: { mergeWithExistingDay?: boolean },
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: {
        primaryShift: { select: { code: true } },
        shiftAssignments: {
          where: { active: true },
          include: { shift: { select: { code: true } } },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    let nextCategory = category;
    if (options?.mergeWithExistingDay && category === 'MORNING') {
      const current = inferTeachingShiftCategory(
        staff.primaryShift?.code ?? null,
        staff.shiftAssignments
          .filter((row) => !row.isPrimary)
          .map((row) => row.shift.code),
      );
      if (current === 'BOTH') {
        nextCategory = 'BOTH';
      } else if (current === 'DAY') {
        nextCategory = 'BOTH';
      }
    }

    return this.applyEmploymentUpdate(tenantId, staffProfileId, {
      teachingShiftCategory: nextCategory,
    });
  }

  teachingShiftCategoryLabel = teachingShiftCategoryLabel;

  async listAcademicRoles(tenantId: string) {
    return this.prisma.academicRoleDefinition.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { id: true, code: true, label: true, sortOrder: true },
    });
  }

  isSchedulable(staff: {
    status: string;
    relievingDate: Date | null;
    shiftAssignments?: { active: boolean }[];
  }): boolean {
    if (staff.status !== 'ACTIVE') return false;
    if (staff.relievingDate && staff.relievingDate <= new Date()) return false;
    const hasActiveShift =
      staff.shiftAssignments?.some((s) => s.active) ?? false;
    return hasActiveShift;
  }
}
