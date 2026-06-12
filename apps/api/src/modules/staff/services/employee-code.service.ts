import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type EmployeeCodeContext = {
  institutionId: string;
  staffType: string;
  typeSuffix: string;
  orgPrefix: string;
  fullPrefix: string;
  joiningYear: number;
  yearSuffix: string;
};

export type EmployeeCodePreview = {
  employeeCode: string;
  fullPrefix: string;
  typeSuffix: string;
  orgPrefix: string;
  yearSuffix: string;
  sequence: number;
  joiningYear: number;
  staffType: string;
};

const DEFAULT_TYPE_SUFFIXES: Record<string, string> = {
  TEACHING: 'TCH',
  ADMIN: 'ADM',
  NON_TEACHING: 'NTS',
  GUEST: 'GST',
  VISITING: 'VIS',
  CONTRACT: 'CTR',
};

@Injectable()
export class EmployeeCodeService {
  constructor(private readonly prisma: PrismaService) {}

  formatEmployeeCode(
    fullPrefix: string,
    yearSuffix: string,
    sequence: number,
    settings: { sequenceLength: number; separator: string },
  ): string {
    const padded = String(sequence).padStart(settings.sequenceLength, '0');
    return `${fullPrefix}${settings.separator}${yearSuffix}${settings.separator}${padded}`;
  }

  async getSettings(tenantId: string) {
    let settings = await this.prisma.staffEmployeeCodeSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.prisma.staffEmployeeCodeSettings.create({
        data: {
          tenantId,
          orgPrefix: 'DBC',
          sequenceLength: 3,
          separator: '-',
          autoGenerateOnCreate: true,
        },
      });
    }
    return settings;
  }

  async resolveTypeSuffix(
    tenantId: string,
    staffType: string,
  ): Promise<string> {
    const row = await this.prisma.staffEmployeeCodeTypePrefix.findUnique({
      where: { tenantId_staffType: { tenantId, staffType } },
    });
    if (row?.isActive && row.typeSuffix.trim()) {
      return row.typeSuffix.trim().toUpperCase();
    }
    const fallback = DEFAULT_TYPE_SUFFIXES[staffType];
    if (!fallback) {
      throw new BadRequestException(
        `No employee code prefix configured for staff type ${staffType}`,
      );
    }
    return fallback;
  }

  async resolveInstitutionId(
    tenantId: string,
    institutionId?: string,
  ): Promise<string> {
    if (institutionId) {
      const inst = await this.prisma.institution.findFirst({
        where: { id: institutionId, tenantId, deletedAt: null },
      });
      if (!inst) throw new NotFoundException('Institution not found');
      return inst.id;
    }
    const inst = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!inst)
      throw new BadRequestException('No institution configured for tenant');
    return inst.id;
  }

  parseJoiningYear(joiningDate?: string | Date | null): number {
    if (joiningDate) {
      const d =
        joiningDate instanceof Date ? joiningDate : new Date(joiningDate);
      if (!Number.isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  }

  async resolveContext(
    tenantId: string,
    input: {
      institutionId?: string;
      staffType: string;
      joiningDate?: string | Date | null;
    },
  ): Promise<EmployeeCodeContext> {
    const [settings, institutionId, typeSuffix] = await Promise.all([
      this.getSettings(tenantId),
      this.resolveInstitutionId(tenantId, input.institutionId),
      this.resolveTypeSuffix(tenantId, input.staffType),
    ]);

    const orgPrefix = settings.orgPrefix.trim().toUpperCase();
    const joiningYear = this.parseJoiningYear(input.joiningDate);
    const yearSuffix = String(joiningYear).slice(-2);

    return {
      institutionId,
      staffType: input.staffType,
      typeSuffix,
      orgPrefix,
      fullPrefix: `${orgPrefix}${typeSuffix}`,
      joiningYear,
      yearSuffix,
    };
  }

  private async readNextSequence(
    tx: Prisma.TransactionClient | PrismaService,
    institutionId: string,
    prefix: string,
    joiningYear: number,
  ): Promise<number> {
    const row = await tx.staffEmployeeCodeSequence.findUnique({
      where: {
        institutionId_prefix_joiningYear: {
          institutionId,
          prefix,
          joiningYear,
        },
      },
    });
    return row?.nextSequence ?? 1;
  }

  async previewNextEmployeeCode(
    tenantId: string,
    input: {
      institutionId?: string;
      staffType: string;
      joiningDate?: string | Date | null;
    },
  ): Promise<EmployeeCodePreview> {
    const ctx = await this.resolveContext(tenantId, input);
    const settings = await this.getSettings(tenantId);
    const sequence = await this.readNextSequence(
      this.prisma,
      ctx.institutionId,
      ctx.fullPrefix,
      ctx.joiningYear,
    );
    const employeeCode = this.formatEmployeeCode(
      ctx.fullPrefix,
      ctx.yearSuffix,
      sequence,
      settings,
    );
    return {
      employeeCode,
      fullPrefix: ctx.fullPrefix,
      typeSuffix: ctx.typeSuffix,
      orgPrefix: ctx.orgPrefix,
      yearSuffix: ctx.yearSuffix,
      sequence,
      joiningYear: ctx.joiningYear,
      staffType: ctx.staffType,
    };
  }

  async allocateNextEmployeeCode(
    tenantId: string,
    input: {
      institutionId?: string;
      staffType: string;
      joiningDate?: string | Date | null;
      actorId?: string;
      staffProfileId?: string;
      action?: string;
    },
  ): Promise<EmployeeCodePreview> {
    const ctx = await this.resolveContext(tenantId, input);
    const settings = await this.getSettings(tenantId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.staffEmployeeCodeSequence.findUnique({
        where: {
          institutionId_prefix_joiningYear: {
            institutionId: ctx.institutionId,
            prefix: ctx.fullPrefix,
            joiningYear: ctx.joiningYear,
          },
        },
      });

      let sequence: number;
      if (existing) {
        sequence = existing.nextSequence;
        await tx.staffEmployeeCodeSequence.update({
          where: { id: existing.id },
          data: { nextSequence: sequence + 1 },
        });
      } else {
        sequence = 1;
        await tx.staffEmployeeCodeSequence.create({
          data: {
            tenantId,
            institutionId: ctx.institutionId,
            prefix: ctx.fullPrefix,
            joiningYear: ctx.joiningYear,
            nextSequence: 2,
          },
        });
      }

      const employeeCode = this.formatEmployeeCode(
        ctx.fullPrefix,
        ctx.yearSuffix,
        sequence,
        settings,
      );

      await this.validateEmployeeCodeUniqueTx(
        tx,
        tenantId,
        employeeCode,
        input.staffProfileId,
      );

      await tx.staffEmployeeCodeAuditLog.create({
        data: {
          tenantId,
          institutionId: ctx.institutionId,
          staffProfileId: input.staffProfileId,
          action: input.action ?? 'ALLOCATE',
          employeeCode,
          newValue: employeeCode,
          createdById: input.actorId,
          metadata: {
            staffType: ctx.staffType,
            joiningYear: ctx.joiningYear,
            sequence,
            fullPrefix: ctx.fullPrefix,
          },
        },
      });

      return {
        employeeCode,
        fullPrefix: ctx.fullPrefix,
        typeSuffix: ctx.typeSuffix,
        orgPrefix: ctx.orgPrefix,
        yearSuffix: ctx.yearSuffix,
        sequence,
        joiningYear: ctx.joiningYear,
        staffType: ctx.staffType,
      };
    });
  }

  async validateEmployeeCodeUniqueTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    employeeCode: string,
    excludeStaffProfileId?: string,
  ): Promise<void> {
    const existing = await tx.staffProfile.findFirst({
      where: {
        tenantId,
        employeeCode,
        deletedAt: null,
        ...(excludeStaffProfileId
          ? { id: { not: excludeStaffProfileId } }
          : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `Employee code ${employeeCode} is already in use`,
      );
    }
  }

  async canRegenerateForStaff(
    tenantId: string,
    staffProfileId: string,
    newStaffType: string,
  ): Promise<{ allowed: boolean; reason?: string; currentStaffType?: string }> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      select: { staffType: true, employeeCodeAllocatedAt: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (!staff.employeeCodeAllocatedAt) {
      return { allowed: true, currentStaffType: staff.staffType };
    }

    if (staff.staffType !== newStaffType) {
      return { allowed: true, currentStaffType: staff.staffType };
    }

    return {
      allowed: false,
      currentStaffType: staff.staffType,
      reason: 'Employee code is finalized. Change staff type to regenerate.',
    };
  }

  async logPreview(
    tenantId: string,
    preview: EmployeeCodePreview,
    institutionId: string,
    actorId?: string,
  ) {
    await this.prisma.staffEmployeeCodeAuditLog.create({
      data: {
        tenantId,
        institutionId,
        action: 'PREVIEW',
        employeeCode: preview.employeeCode,
        newValue: preview.employeeCode,
        createdById: actorId,
        metadata: {
          staffType: preview.staffType,
          joiningYear: preview.joiningYear,
          sequence: preview.sequence,
        },
      },
    });
  }
}
