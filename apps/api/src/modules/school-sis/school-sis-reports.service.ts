import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisReportsQueryService } from './school-sis-reports-query.service';
import { SchoolReportEngineService } from './report-engine/report-engine.service';
import { SchoolReportBrandingService } from './report-engine/report-branding.service';
import type { ReportDocument } from './report-engine/report-types';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';

@Injectable()
export class SchoolSisReportsService {
  private readonly log = new Logger(SchoolSisReportsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly query: SchoolSisReportsQueryService,
    private readonly engine: SchoolReportEngineService,
    private readonly branding: SchoolReportBrandingService,
  ) {}

  catalog(user: JwtUser) {
    return this.query.catalog(user.roles ?? [], user.permissions ?? []);
  }

  preview(
    tenantId: string,
    user: JwtUser,
    key: string,
    filters: Record<string, string>,
  ) {
    this.assertExport(user, key, 'html');
    return this.query.run(
      tenantId,
      key,
      { ...filters, page: 1, limit: 50 },
      user.roles ?? [],
      user.permissions ?? [],
    );
  }

  async export(
    tenantId: string,
    user: JwtUser,
    body: {
      key: string;
      format: 'pdf' | 'xlsx' | 'html' | 'csv';
      filters?: Record<string, string>;
      orientation?: 'portrait' | 'landscape';
      ip?: string;
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertExport(user, body.key, body.format);
    const filters = { ...(body.filters ?? {}) };
    if (filters.date && !filters.dateFrom) {
      filters.dateFrom = filters.date;
      filters.dateTo = filters.date;
    }
    const result = await this.query.run(
      tenantId,
      body.key,
      { ...filters, page: 1, limit: 20_000, exportMode: true },
      user.roles ?? [],
      user.permissions ?? [],
    );
    const year = String(
      filters.academicYear ||
        (result.filtersApplied as { academicYearId?: string }).academicYearId ||
        '',
    );
    const columns = result.columns.map((c) => ({ key: c.key, label: c.label }));
    const totals: Record<string, number> = {};
    for (const col of columns) {
      const label = col.label.toLowerCase();
      if (
        !/amount|fee|total|collection|tuition|arrear|paid|due|₹|outstanding|cash|upi/.test(
          label,
        )
      ) {
        continue;
      }
      totals[col.key] = result.rows.reduce(
        (sum, row) => sum + (Number(row[col.key]) || 0),
        0,
      );
    }
    const document: ReportDocument = {
      key: result.report.key,
      title: result.report.title,
      subtitle: result.report.description,
      academicYear: year || undefined,
      filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      kpis: result.kpis.map((k) => ({ label: k.label, value: k.value })),
      columns,
      rows: result.rows,
      totals: Object.keys(totals).length ? totals : undefined,
      official: result.report.module === 'fees',
      confidential: Boolean(result.report.sensitive),
      orientation: body.orientation,
      generatedBy: user.email,
    };
    try {
      return await this.engine.generate({
        tenantId,
        format: body.format,
        document,
        userId: user.sub,
        ip: body.ip,
      });
    } catch (err) {
      this.log.error(err);
      throw new BadRequestException(
        err instanceof ForbiddenException
          ? err.message
          : 'Unable to generate the report. Please try again.',
      );
    }
  }

  audits(tenantId: string) {
    return this.prisma.schoolReportExportAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  design(tenantId: string) {
    return this.branding.getSettings(tenantId);
  }

  saveDesign(tenantId: string, user: JwtUser, patch: Record<string, unknown>) {
    if (!this.has(user, SCHOOL_SIS_PERMISSION_MANAGE, 'reports.manage')) {
      throw new ForbiddenException(
        'Only administrators can change report design',
      );
    }
    return this.branding.saveSettings(tenantId, user.sub, patch);
  }

  private assertExport(user: JwtUser, key: string, format: string) {
    const financial =
      key.startsWith('fee_') ||
      key.includes('collection') ||
      key.includes('salary');
    if (
      financial &&
      !this.has(
        user,
        SCHOOL_SIS_PERMISSION_MANAGE,
        'fees.collection.view',
        'fees.reports.export',
        'reports.financial',
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to export this financial report',
      );
    }
    if (
      format === 'pdf' &&
      !this.has(
        user,
        SCHOOL_SIS_PERMISSION_MANAGE,
        'reports.export.pdf',
        'fees.reports.export',
        'reports.view',
        SCHOOL_SIS_PERMISSION_READ,
      )
    ) {
      throw new ForbiddenException('You do not have permission to export PDF');
    }
    if (
      format === 'xlsx' &&
      !this.has(
        user,
        SCHOOL_SIS_PERMISSION_MANAGE,
        'reports.export.excel',
        'fees.reports.export',
        'reports.view',
        SCHOOL_SIS_PERMISSION_READ,
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to export Excel',
      );
    }
  }

  private has(user: JwtUser, ...need: string[]) {
    const p = user.permissions ?? [];
    return p.includes('*') || need.some((n) => p.includes(n));
  }
}
