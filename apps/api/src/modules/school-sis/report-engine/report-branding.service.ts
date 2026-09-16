import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { schoolLogoDataUri } from '../school-sis-monthly-fee-receipt';
import { DEFAULT_REPORT_DESIGN, type ReportBranding } from './report-types';

@Injectable()
export class SchoolReportBrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async load(tenantId: string): Promise<ReportBranding> {
    const [design, branding, fee, theme, mis] = await Promise.all([
      this.prisma.schoolReportDesign.findUnique({ where: { tenantId } }),
      this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
      this.prisma.schoolFeeSettings.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.appThemeSettings.findUnique({ where: { tenantId } }),
      this.prisma.schoolMisSettings.findUnique({ where: { tenantId } }),
    ]);
    const saved = (design?.settingsJson ?? {}) as Record<string, unknown>;
    const merged = { ...DEFAULT_REPORT_DESIGN, ...saved };
    const schoolName = String(
      merged.schoolName ||
        branding?.displayName ||
        fee?.schoolName ||
        DEFAULT_REPORT_DESIGN.schoolName,
    );
    const addressLine = String(
      merged.addressLine ||
        branding?.address ||
        fee?.schoolAddress ||
        DEFAULT_REPORT_DESIGN.addressLine,
    );
    return {
      ...DEFAULT_REPORT_DESIGN,
      ...merged,
      schoolName,
      shortName: String(
        merged.shortName || branding?.shortName || "St. Luke's",
      ),
      addressLine,
      city: String(merged.city || DEFAULT_REPORT_DESIGN.city),
      district: String(merged.district || DEFAULT_REPORT_DESIGN.district),
      state: String(merged.state || DEFAULT_REPORT_DESIGN.state),
      pin: String(merged.pin || DEFAULT_REPORT_DESIGN.pin),
      phone: String(merged.phone || ''),
      email: String(merged.email || ''),
      website: String(merged.website || ''),
      primaryColor: String(
        merged.primaryColor ||
          branding?.primaryColor ||
          theme?.primaryColor ||
          DEFAULT_REPORT_DESIGN.primaryColor,
      ),
      secondaryColor: String(
        merged.secondaryColor || DEFAULT_REPORT_DESIGN.secondaryColor,
      ),
      signatoryName: String(
        merged.signatoryName || fee?.signatoryName || mis?.signatoryName || '',
      ),
      footerText: String(
        merged.footerText ||
          mis?.footerText ||
          DEFAULT_REPORT_DESIGN.footerText,
      ),
      logoDataUri: schoolLogoDataUri(),
      showGeneratedBy: Boolean(merged.showGeneratedBy ?? true),
      showGeneratedAt: Boolean(merged.showGeneratedAt ?? true),
      showPageNumber: Boolean(merged.showPageNumber ?? true),
      showAcademicYear: Boolean(merged.showAcademicYear ?? true),
      showFilters: Boolean(merged.showFilters ?? true),
      showSignature: Boolean(merged.showSignature ?? false),
      showConfidential: Boolean(merged.showConfidential ?? false),
    };
  }

  async getSettings(tenantId: string) {
    const row = await this.prisma.schoolReportDesign.findUnique({
      where: { tenantId },
    });
    const branding = await this.load(tenantId);
    return {
      branding,
      settings: {
        ...DEFAULT_REPORT_DESIGN,
        ...((row?.settingsJson as object) ?? {}),
      },
    };
  }

  async saveSettings(
    tenantId: string,
    userId: string,
    patch: Record<string, unknown>,
  ) {
    const current = await this.prisma.schoolReportDesign.findUnique({
      where: { tenantId },
    });
    const next = {
      ...DEFAULT_REPORT_DESIGN,
      ...((current?.settingsJson as object) ?? {}),
      ...patch,
    };
    await this.prisma.schoolReportDesign.upsert({
      where: { tenantId },
      create: { tenantId, settingsJson: next, updatedBy: userId },
      update: { settingsJson: next, updatedBy: userId },
    });
    return this.getSettings(tenantId);
  }
}
