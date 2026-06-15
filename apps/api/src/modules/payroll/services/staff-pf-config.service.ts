import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StaffPfConfig } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  buildPfOverridesFromConfig,
  mergeComponentOverrides,
  pfSchemeLabel,
  type PfConfigSnapshot,
} from './pf-config-overrides';
import { parseAssignmentOverrides } from './pay-statutory-overrides';
import type { ComponentOverride } from './formula-engine.service';

export type UpsertStaffPfConfigDto = {
  pfEnabled: boolean;
  employeePfApplicable?: boolean;
  employerPfApplicable?: boolean;
  pfScheme?: string;
  employeePfAmount?: number | null;
  employerPfAmount?: number | null;
  pfAccountNumber?: string | null;
  uanNumber?: string | null;
  effectiveFrom: string;
  remarks?: string | null;
};

export type BulkPfConfigDto = {
  staffProfileIds: string[];
  pfEnabled?: boolean;
  employeePfApplicable?: boolean;
  employerPfApplicable?: boolean;
  pfScheme?: string;
  employeePfAmount?: number | null;
  employerPfAmount?: number | null;
  effectiveFrom?: string;
  remarks?: string | null;
};

@Injectable()
export class StaffPfConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private toSnapshot(config: StaffPfConfig): PfConfigSnapshot {
    return {
      pfEnabled: config.pfEnabled,
      employeePfApplicable: config.employeePfApplicable,
      employerPfApplicable: config.employerPfApplicable,
      pfScheme: config.pfScheme,
      employeePfAmount:
        config.employeePfAmount != null
          ? Number(config.employeePfAmount)
          : null,
      employerPfAmount:
        config.employerPfAmount != null
          ? Number(config.employerPfAmount)
          : null,
      pfAccountNumber: config.pfAccountNumber,
      uanNumber: config.uanNumber,
      effectiveFrom: config.effectiveFrom,
      remarks: config.remarks,
    };
  }

  private serialize(config: StaffPfConfig) {
    return {
      id: config.id,
      staffProfileId: config.staffProfileId,
      pfEnabled: config.pfEnabled,
      employeePfApplicable: config.employeePfApplicable,
      employerPfApplicable: config.employerPfApplicable,
      pfScheme: config.pfScheme,
      pfSchemeLabel: pfSchemeLabel(config.pfScheme),
      employeePfAmount:
        config.employeePfAmount != null
          ? Number(config.employeePfAmount)
          : null,
      employerPfAmount:
        config.employerPfAmount != null
          ? Number(config.employerPfAmount)
          : null,
      pfAccountNumber: config.pfAccountNumber,
      uanNumber: config.uanNumber,
      effectiveFrom: config.effectiveFrom,
      remarks: config.remarks,
      updatedAt: config.updatedAt,
    };
  }

  async getForStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      select: { id: true, fullName: true, employeeCode: true, pfNumber: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const config = await this.prisma.staffPfConfig.findFirst({
      where: { tenantId, staffProfileId },
    });

    if (config) {
      return { staff, config: this.serialize(config) };
    }

    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
      select: { componentOverrides: true, effectiveFrom: true },
    });
    const parsed = parseAssignmentOverrides(
      assignment?.componentOverrides as Record<string, unknown> | null,
    );

    return {
      staff,
      config: {
        id: null,
        staffProfileId,
        pfEnabled: !parsed.pfExempt,
        employeePfApplicable: !parsed.pfExempt,
        employerPfApplicable: !parsed.pfExempt,
        pfScheme: parsed.pfExempt
          ? 'NOT_APPLICABLE'
          : parsed.cpfRate
            ? 'CPF'
            : 'PF_12_PERCENT',
        pfSchemeLabel: parsed.pfExempt
          ? 'Not Applicable'
          : parsed.cpfRate
            ? 'CPF'
            : 'PF 12%',
        employeePfAmount: null,
        employerPfAmount: parsed.cpfRate ?? null,
        pfAccountNumber: staff.pfNumber,
        uanNumber: null,
        effectiveFrom: assignment?.effectiveFrom ?? new Date(),
        remarks: parsed.pfExempt
          ? 'Derived from pay assignment PF exempt flag'
          : null,
        updatedAt: null,
      },
    };
  }

  async getHistory(tenantId: string, staffProfileId: string) {
    return this.prisma.staffPfConfigHistory.findMany({
      where: { tenantId, staffProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(
    user: JwtUser,
    staffProfileId: string,
    dto: UpsertStaffPfConfigDto,
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effective from date');
    }

    const employeeApplicable = dto.pfEnabled
      ? (dto.employeePfApplicable ?? true)
      : false;
    const employerApplicable = dto.pfEnabled
      ? (dto.employerPfApplicable ?? true)
      : false;
    const scheme = dto.pfEnabled
      ? (dto.pfScheme ?? 'PF_12_PERCENT')
      : 'NOT_APPLICABLE';

    const existing = await this.prisma.staffPfConfig.findFirst({
      where: { tenantId: user.tid, staffProfileId },
    });
    const action = !existing
      ? dto.pfEnabled
        ? 'ENABLED'
        : 'DISABLED'
      : existing.pfEnabled !== dto.pfEnabled
        ? dto.pfEnabled
          ? 'ENABLED'
          : 'DISABLED'
        : existing.pfScheme !== scheme
          ? 'SCHEME_CHANGED'
          : 'UPDATED';

    const data = {
      tenantId: user.tid,
      staffProfileId,
      pfEnabled: dto.pfEnabled,
      employeePfApplicable: employeeApplicable,
      employerPfApplicable: employerApplicable,
      pfScheme: scheme,
      employeePfAmount: dto.employeePfAmount ?? null,
      employerPfAmount: dto.employerPfAmount ?? null,
      pfAccountNumber: dto.pfAccountNumber ?? null,
      uanNumber: dto.uanNumber ?? null,
      effectiveFrom,
      remarks: dto.remarks ?? null,
      updatedById: user.sub,
      ...(existing ? {} : { createdById: user.sub }),
    };

    const config = existing
      ? await this.prisma.staffPfConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.staffPfConfig.create({ data });

    await this.prisma.staffPfConfigHistory.create({
      data: {
        tenantId: user.tid,
        staffProfileId,
        action,
        snapshot: this.toSnapshot(config) as object,
        effectiveFrom,
        userId: user.sub,
      },
    });

    if (dto.pfAccountNumber) {
      await this.prisma.staffProfile.update({
        where: { id: staffProfileId },
        data: { pfNumber: dto.pfAccountNumber },
      });
    }

    await this.syncAssignmentOverrides(user.tid, staffProfileId, config);

    return this.serialize(config);
  }

  async bulkUpdate(user: JwtUser, dto: BulkPfConfigDto) {
    if (!dto.staffProfileIds?.length) {
      throw new BadRequestException('Select at least one staff member');
    }

    const results: Array<{
      staffProfileId: string;
      ok: boolean;
      error?: string;
    }> = [];
    for (const staffProfileId of dto.staffProfileIds) {
      try {
        const current = await this.getForStaff(user.tid, staffProfileId);
        await this.upsert(user, staffProfileId, {
          pfEnabled: dto.pfEnabled ?? current.config.pfEnabled,
          employeePfApplicable:
            dto.employeePfApplicable ?? current.config.employeePfApplicable,
          employerPfApplicable:
            dto.employerPfApplicable ?? current.config.employerPfApplicable,
          pfScheme: dto.pfScheme ?? current.config.pfScheme,
          employeePfAmount:
            dto.employeePfAmount ?? current.config.employeePfAmount,
          employerPfAmount:
            dto.employerPfAmount ?? current.config.employerPfAmount,
          effectiveFrom:
            dto.effectiveFrom ??
            new Date(current.config.effectiveFrom).toISOString().slice(0, 10),
          remarks: dto.remarks ?? current.config.remarks,
          pfAccountNumber: current.config.pfAccountNumber,
          uanNumber: current.config.uanNumber,
        });
        results.push({ staffProfileId, ok: true });
      } catch (e) {
        results.push({
          staffProfileId,
          ok: false,
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
    }

    return {
      total: dto.staffProfileIds.length,
      updated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async syncFromPfExempt(
    tenantId: string,
    staffProfileId: string,
    pfExempt: boolean,
    userId?: string,
  ) {
    const effectiveFrom = new Date();
    const dto: UpsertStaffPfConfigDto = {
      pfEnabled: !pfExempt,
      employeePfApplicable: !pfExempt,
      employerPfApplicable: !pfExempt,
      pfScheme: pfExempt ? 'NOT_APPLICABLE' : 'PF_12_PERCENT',
      effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
      remarks: pfExempt
        ? 'Synced from pay assignment PF exempt'
        : 'Synced from pay assignment',
    };
    return this.upsert(
      { tid: tenantId, sub: userId ?? 'system' } as JwtUser,
      staffProfileId,
      dto,
    );
  }

  private async syncAssignmentOverrides(
    tenantId: string,
    staffProfileId: string,
    config: StaffPfConfig,
  ) {
    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
    });
    if (!assignment) return;

    const pfOverrides = buildPfOverridesFromConfig(this.toSnapshot(config));
    const existing = (assignment.componentOverrides ?? {}) as Record<
      string,
      ComponentOverride
    >;
    const merged = mergeComponentOverrides(existing, pfOverrides);

    await this.prisma.staffPayAssignment.update({
      where: { id: assignment.id },
      data: { componentOverrides: merged as object },
    });
  }

  async loadEffectiveMap(
    tenantId: string,
    staffProfileIds: string[],
    asOf: Date,
  ) {
    const configs = await this.prisma.staffPfConfig.findMany({
      where: { tenantId, staffProfileId: { in: staffProfileIds } },
    });
    const map = new Map<string, PfConfigSnapshot>();
    for (const c of configs) {
      map.set(c.staffProfileId, this.toSnapshot(c));
    }

    const missing = staffProfileIds.filter((id) => !map.has(id));
    if (missing.length) {
      const assignments = await this.prisma.staffPayAssignment.findMany({
        where: { tenantId, staffProfileId: { in: missing }, status: 'ACTIVE' },
        select: {
          staffProfileId: true,
          componentOverrides: true,
          effectiveFrom: true,
        },
      });
      for (const id of missing) {
        const assignment = assignments.find((a) => a.staffProfileId === id);
        const parsed = parseAssignmentOverrides(
          assignment?.componentOverrides as Record<string, unknown> | null,
        );
        map.set(id, {
          pfEnabled: !parsed.pfExempt,
          employeePfApplicable: !parsed.pfExempt,
          employerPfApplicable: !parsed.pfExempt,
          pfScheme: parsed.pfExempt
            ? 'NOT_APPLICABLE'
            : parsed.cpfRate
              ? 'CPF'
              : 'PF_12_PERCENT',
          employerPfAmount: parsed.cpfRate ?? null,
          effectiveFrom: assignment?.effectiveFrom ?? asOf,
        });
      }
    }
    return map;
  }

  async reportEnrolled(
    tenantId: string,
    query: { departmentId?: string; payScaleType?: string },
  ) {
    return this.staffPfReport(tenantId, true, query);
  }

  async reportExempt(
    tenantId: string,
    query: { departmentId?: string; payScaleType?: string },
  ) {
    return this.staffPfReport(tenantId, false, query);
  }

  private async staffPfReport(
    tenantId: string,
    enrolled: boolean,
    query: { departmentId?: string; payScaleType?: string },
  ) {
    const configs = await this.prisma.staffPfConfig.findMany({
      where: { tenantId },
    });
    const configByStaff = new Map(configs.map((c) => [c.staffProfileId, c]));

    const assignments = await this.prisma.staffPayAssignment.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(query.payScaleType ? { payScaleType: query.payScaleType } : {}),
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const rows: Array<Record<string, unknown>> = [];
    for (const a of assignments) {
      if (
        query.departmentId &&
        a.staffProfile.departmentId !== query.departmentId
      )
        continue;
      const cfg = configByStaff.get(a.staffProfileId);
      const pfEnabled = cfg
        ? cfg.pfEnabled && cfg.pfScheme !== 'NOT_APPLICABLE'
        : !parseAssignmentOverrides(
            a.componentOverrides as Record<string, unknown>,
          ).pfExempt;
      if (pfEnabled !== enrolled) continue;
      rows.push({
        staffProfileId: a.staffProfileId,
        employeeCode: a.staffProfile.employeeCode,
        fullName: a.staffProfile.fullName,
        department: a.staffProfile.department?.name ?? '—',
        payScaleType: a.payScaleType,
        pfScheme: cfg
          ? pfSchemeLabel(cfg.pfScheme)
          : enrolled
            ? 'PF 12%'
            : 'Not Applicable',
        employerPfAmount:
          cfg?.employerPfAmount != null ? Number(cfg.employerPfAmount) : null,
        employeePfAmount:
          cfg?.employeePfAmount != null ? Number(cfg.employeePfAmount) : null,
        uanNumber: cfg?.uanNumber ?? null,
        pfAccountNumber: cfg?.pfAccountNumber ?? null,
        effectiveFrom: cfg?.effectiveFrom ?? a.effectiveFrom,
      });
    }
    return { count: rows.length, rows };
  }

  async reportMonthlyContribution(
    tenantId: string,
    month: number,
    year: number,
  ) {
    const entries = await this.prisma.pfCpfLedgerEntry.findMany({
      where: { tenantId, month, year, contributionType: 'PF' },
      orderBy: { staffProfileId: 'asc' },
    });

    const staffIds = [...new Set(entries.map((e) => e.staffProfileId))];
    const staffRows = await this.prisma.staffProfile.findMany({
      where: { tenantId, id: { in: staffIds } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    });
    const staffById = new Map(staffRows.map((s) => [s.id, s]));

    const totals = entries.reduce(
      (acc, e) => {
        acc.employee += Number(e.employeeContribution);
        acc.employer += Number(e.employerContribution);
        return acc;
      },
      { employee: 0, employer: 0 },
    );

    return {
      month,
      year,
      count: entries.length,
      totalEmployee: totals.employee,
      totalEmployer: totals.employer,
      totalDeposit: totals.employee + totals.employer,
      rows: entries.map((e) => {
        const staff = staffById.get(e.staffProfileId);
        return {
          staffProfileId: e.staffProfileId,
          employeeCode: staff?.employeeCode ?? '—',
          fullName: staff?.fullName ?? '—',
          department: staff?.department?.name ?? '—',
          employeeContribution: Number(e.employeeContribution),
          employerContribution: Number(e.employerContribution),
          total:
            Number(e.employeeContribution) + Number(e.employerContribution),
        };
      }),
    };
  }

  async reportByDepartment(tenantId: string, month: number, year: number) {
    const report = await this.reportMonthlyContribution(tenantId, month, year);
    const byDept = new Map<
      string,
      { department: string; count: number; employee: number; employer: number }
    >();
    for (const row of report.rows) {
      const key = row.department as string;
      const cur = byDept.get(key) ?? {
        department: key,
        count: 0,
        employee: 0,
        employer: 0,
      };
      cur.count += 1;
      cur.employee += row.employeeContribution as number;
      cur.employer += row.employerContribution as number;
      byDept.set(key, cur);
    }
    return Array.from(byDept.values()).sort((a, b) =>
      a.department.localeCompare(b.department),
    );
  }

  async reportByPayStructure(tenantId: string, month: number, year: number) {
    const entries = await this.prisma.pfCpfLedgerEntry.findMany({
      where: { tenantId, month, year, contributionType: 'PF' },
      select: {
        staffProfileId: true,
        employeeContribution: true,
        employerContribution: true,
      },
    });
    const staffIds = [...new Set(entries.map((e) => e.staffProfileId))];
    const assignments = await this.prisma.staffPayAssignment.findMany({
      where: { tenantId, staffProfileId: { in: staffIds }, status: 'ACTIVE' },
      include: { payStructureTemplate: { select: { code: true, name: true } } },
    });
    const scaleByStaff = new Map(assignments.map((a) => [a.staffProfileId, a]));

    const byStructure = new Map<
      string,
      { structure: string; count: number; employee: number; employer: number }
    >();
    for (const e of entries) {
      const a = scaleByStaff.get(e.staffProfileId);
      const key = a
        ? `${a.payScaleType} · ${a.payStructureTemplate.name}`
        : 'Unassigned';
      const cur = byStructure.get(key) ?? {
        structure: key,
        count: 0,
        employee: 0,
        employer: 0,
      };
      cur.count += 1;
      cur.employee += Number(e.employeeContribution);
      cur.employer += Number(e.employerContribution);
      byStructure.set(key, cur);
    }
    return Array.from(byStructure.values());
  }

  async reportPfRegister(tenantId: string, month: number, year: number) {
    const contribution = await this.reportMonthlyContribution(
      tenantId,
      month,
      year,
    );
    const enrolled = await this.reportEnrolled(tenantId, {});
    const exempt = await this.reportExempt(tenantId, {});
    return {
      period: { month, year },
      summary: {
        enrolledStaff: enrolled.count,
        exemptStaff: exempt.count,
        contributingThisMonth: contribution.count,
        totalEmployeeContribution: contribution.totalEmployee,
        totalEmployerContribution: contribution.totalEmployer,
        totalPfDeposit: contribution.totalDeposit,
      },
      contributions: contribution.rows,
      enrolled: enrolled.rows,
      exempt: exempt.rows,
    };
  }
}
