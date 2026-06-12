import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const HOD_CODE = 'HOD';

@Injectable()
export class StaffAdditionalRoleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, staffProfileId: string) {
    await this.assertStaff(tenantId, staffProfileId);
    return this.prisma.staffAdditionalRole.findMany({
      where: { tenantId, staffProfileId },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    staffProfileId: string,
    input: {
      roleCode: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const staff = await this.assertStaff(tenantId, staffProfileId);
    const def = await this.prisma.academicRoleDefinition.findFirst({
      where: { tenantId, code: input.roleCode, isActive: true },
    });
    if (!def) throw new BadRequestException(`Unknown role: ${input.roleCode}`);

    const role = await this.prisma.staffAdditionalRole.create({
      data: {
        tenantId,
        staffProfileId,
        roleCode: def.code,
        roleName: def.label,
        active: true,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      },
    });

    if (def.code === HOD_CODE && staff.departmentId) {
      await this.syncDepartmentHoD(
        tenantId,
        staff.departmentId,
        staffProfileId,
      );
    }

    return role;
  }

  async update(
    tenantId: string,
    staffProfileId: string,
    roleId: string,
    input: {
      active?: boolean;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    const staff = await this.assertStaff(tenantId, staffProfileId);
    const role = await this.prisma.staffAdditionalRole.findFirst({
      where: { id: roleId, tenantId, staffProfileId },
    });
    if (!role) throw new NotFoundException('Role assignment not found');

    const updated = await this.prisma.staffAdditionalRole.update({
      where: { id: roleId },
      data: {
        active: input.active,
        startDate:
          input.startDate === null
            ? null
            : input.startDate
              ? new Date(input.startDate)
              : undefined,
        endDate:
          input.endDate === null
            ? null
            : input.endDate
              ? new Date(input.endDate)
              : undefined,
      },
    });

    if (role.roleCode === HOD_CODE && staff.departmentId) {
      await this.syncDepartmentHoD(
        tenantId,
        staff.departmentId,
        input.active === false ? null : staffProfileId,
      );
    }

    return updated;
  }

  async remove(tenantId: string, staffProfileId: string, roleId: string) {
    const staff = await this.assertStaff(tenantId, staffProfileId);
    const role = await this.prisma.staffAdditionalRole.findFirst({
      where: { id: roleId, tenantId, staffProfileId },
    });
    if (!role) throw new NotFoundException('Role assignment not found');

    await this.prisma.staffAdditionalRole.delete({ where: { id: roleId } });

    if (role.roleCode === HOD_CODE && staff.departmentId) {
      await this.syncDepartmentHoD(tenantId, staff.departmentId, null);
    }

    return { ok: true };
  }

  async replaceActiveRoles(
    tenantId: string,
    staffProfileId: string,
    roleCodes: string[],
    departmentId?: string | null,
  ) {
    const normalizedRoleCodes = [
      ...new Set(
        (roleCodes ?? [])
          .filter((code): code is string => typeof code === 'string')
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];

    if (normalizedRoleCodes.length === 0) {
      const existing = await this.prisma.staffAdditionalRole.findMany({
        where: { tenantId, staffProfileId, active: true },
      });
      for (const row of existing) {
        await this.prisma.staffAdditionalRole.update({
          where: { id: row.id },
          data: { active: false, endDate: new Date() },
        });
      }
      if (departmentId) {
        const dept = await this.prisma.department.findFirst({
          where: { id: departmentId, tenantId },
          select: { hodId: true },
        });
        if (dept?.hodId === staffProfileId) {
          await this.syncDepartmentHoD(tenantId, departmentId, null);
        }
      }
      return;
    }

    const defs = await this.prisma.academicRoleDefinition.findMany({
      where: { tenantId, code: { in: normalizedRoleCodes }, isActive: true },
    });
    const defByCode = new Map(defs.map((d) => [d.code, d]));

    for (const code of normalizedRoleCodes) {
      if (!defByCode.has(code)) {
        throw new BadRequestException(`Unknown role: ${code}`);
      }
    }

    const existing = await this.prisma.staffAdditionalRole.findMany({
      where: { tenantId, staffProfileId, active: true },
    });

    const desired = new Set(normalizedRoleCodes);
    for (const row of existing) {
      if (!desired.has(row.roleCode)) {
        await this.prisma.staffAdditionalRole.update({
          where: { id: row.id },
          data: { active: false, endDate: new Date() },
        });
      }
    }

    for (const code of normalizedRoleCodes) {
      const def = defByCode.get(code)!;
      const current = existing.find((r) => r.roleCode === code && r.active);
      if (!current) {
        await this.prisma.staffAdditionalRole.create({
          data: {
            tenantId,
            staffProfileId,
            roleCode: def.code,
            roleName: def.label,
            active: true,
          },
        });
      }
    }

    if (normalizedRoleCodes.includes(HOD_CODE) && departmentId) {
      await this.syncDepartmentHoD(tenantId, departmentId, staffProfileId);
    } else if (!normalizedRoleCodes.includes(HOD_CODE) && departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId },
        select: { hodId: true },
      });
      if (dept?.hodId === staffProfileId) {
        await this.syncDepartmentHoD(tenantId, departmentId, null);
      }
    }
  }

  private async syncDepartmentHoD(
    tenantId: string,
    departmentId: string,
    hodStaffId: string | null,
  ) {
    await this.prisma.department.updateMany({
      where: { id: departmentId, tenantId, deletedAt: null },
      data: { hodId: hodStaffId },
    });
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
}
