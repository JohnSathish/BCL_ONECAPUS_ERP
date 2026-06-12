import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../database/prisma.service';
import {
  extensionForMime,
  validateBrandingImage,
  type ImageUploadKind,
} from '../../common/uploads/image-upload.validator';
import type { UpdateBrandingDto } from './dto/update-branding.dto';
import type { UpdateThemeDto } from './dto/update-theme.dto';
import {
  getPreset,
  PRESET_LIST,
  resolvePresetId,
  sanitizeCustomCss,
  THEME_PRESETS,
} from './theme-presets';

export type BrandingDto = {
  displayName: string;
  shortName?: string;
  campusName?: string;
  portalSubtitle?: string;
  address?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  loginBackgroundStyle: string;
  showPoweredBy: boolean;
  brandingEnabled: boolean;
  badges: string[];
};

export type ThemeSettingsDto = {
  id: string;
  tenantId: string;
  themeName: string;
  primaryColor?: string;
  sidebarBg?: string;
  sidebarText?: string;
  sidebarActive?: string;
  topbarBg?: string;
  cardBg?: string;
  borderColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  darkModeEnabled: boolean;
  compactSidebar: boolean;
  roundedStyle: string;
  appearanceMode: string;
  layoutJson: Record<string, unknown>;
  customCss?: string;
  customCssEnabled?: boolean;
  displayName?: string;
  brandingEnabled?: boolean;
};

@Injectable()
export class BrandingService {
  private readonly uploadRoot = join(process.cwd(), 'uploads', 'tenants');

  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    displayName: string;
    shortName: string | null;
    campusName: string | null;
    portalSubtitle: string | null;
    address: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    sidebarColor: string | null;
    loginBackgroundStyle: string;
    showPoweredBy: boolean;
    brandingEnabled: boolean;
    badges: unknown;
  }): BrandingDto {
    const badges = Array.isArray(row.badges) ? (row.badges as string[]) : [];
    return {
      displayName: row.displayName,
      shortName: row.shortName ?? undefined,
      campusName: row.campusName ?? undefined,
      portalSubtitle: row.portalSubtitle ?? undefined,
      address: row.address ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      faviconUrl: row.faviconUrl ?? undefined,
      primaryColor: row.primaryColor ?? undefined,
      accentColor: row.accentColor ?? undefined,
      sidebarColor: row.sidebarColor ?? undefined,
      loginBackgroundStyle: row.loginBackgroundStyle,
      showPoweredBy: row.showPoweredBy,
      brandingEnabled: row.brandingEnabled,
      badges,
    };
  }

  async getOrCreate(tenantId: string): Promise<BrandingDto> {
    let branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null },
        include: {
          institutions: { where: { deletedAt: null }, take: 1 },
        },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      branding = await this.prisma.tenantBranding.create({
        data: {
          tenantId,
          displayName: tenant.institutions[0]?.name ?? tenant.name,
          portalSubtitle: 'Campus ERP Portal',
          primaryColor: '#2563eb',
          accentColor: '#7c3aed',
        },
      });
    }
    return this.toDto(branding);
  }

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateBrandingDto,
  ): Promise<BrandingDto> {
    const existing = await this.getOrCreate(tenantId);
    const updated = await this.prisma.tenantBranding.update({
      where: { tenantId },
      data: {
        displayName: dto.displayName,
        shortName: dto.shortName ?? null,
        campusName: dto.campusName ?? null,
        portalSubtitle: dto.portalSubtitle ?? null,
        address: dto.address ?? null,
        primaryColor: dto.primaryColor ?? null,
        accentColor: dto.accentColor ?? null,
        sidebarColor: dto.sidebarColor ?? null,
        loginBackgroundStyle: dto.loginBackgroundStyle ?? 'gradient',
        showPoweredBy: dto.showPoweredBy ?? true,
        brandingEnabled: dto.brandingEnabled ?? true,
        badges: dto.badges ?? [],
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'branding.updated',
        entityType: 'tenant_branding',
        entityId: updated.id,
        metadata: {
          before: existing,
          after: this.toDto(updated),
        },
      },
    });

    return this.toDto(updated);
  }

  async uploadAsset(
    tenantId: string,
    userId: string,
    kind: ImageUploadKind,
    file: Express.Multer.File,
  ): Promise<BrandingDto> {
    const valid = validateBrandingImage(file, kind);
    await this.getOrCreate(tenantId);

    const dir = join(this.uploadRoot, tenantId, 'branding');
    await mkdir(dir, { recursive: true });

    const ext = extensionForMime(valid.mimetype);
    const filename = `${kind}.${ext}`;
    const diskPath = join(dir, filename);
    await writeFile(diskPath, valid.buffer);

    const publicPath = `/uploads/tenants/${tenantId}/branding/${filename}`;
    const field = kind === 'logo' ? 'logoUrl' : 'faviconUrl';

    const before = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const updated = await this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { [field]: publicPath },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action:
          kind === 'logo'
            ? 'branding.logo_uploaded'
            : 'branding.favicon_uploaded',
        entityType: 'tenant_branding',
        entityId: updated.id,
        metadata: {
          previousUrl:
            field === 'logoUrl'
              ? (before?.logoUrl ?? null)
              : (before?.faviconUrl ?? null),
          newUrl: publicPath,
          mimeType: valid.mimetype,
          size: valid.size,
        },
      },
    });

    return this.toDto(updated);
  }

  private toThemeDto(
    row: {
      id: string;
      tenantId: string;
      themeName: string;
      primaryColor: string | null;
      sidebarBg: string | null;
      sidebarText: string | null;
      sidebarActive: string | null;
      topbarBg: string | null;
      cardBg: string | null;
      borderColor: string | null;
      accentColor: string | null;
      fontFamily: string | null;
      logoUrl: string | null;
      darkModeEnabled: boolean;
      compactSidebar: boolean;
      roundedStyle: string;
      appearanceMode: string;
      layoutJson: unknown;
      customCss: string | null;
      customCssEnabled: boolean;
    },
    branding?: { displayName: string; brandingEnabled: boolean } | null,
  ): ThemeSettingsDto {
    const layoutJson =
      row.layoutJson &&
      typeof row.layoutJson === 'object' &&
      !Array.isArray(row.layoutJson)
        ? (row.layoutJson as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      tenantId: row.tenantId,
      themeName: row.themeName,
      primaryColor: row.primaryColor ?? undefined,
      sidebarBg: row.sidebarBg ?? undefined,
      sidebarText: row.sidebarText ?? undefined,
      sidebarActive: row.sidebarActive ?? undefined,
      topbarBg: row.topbarBg ?? undefined,
      cardBg: row.cardBg ?? undefined,
      borderColor: row.borderColor ?? undefined,
      accentColor: row.accentColor ?? undefined,
      fontFamily: row.fontFamily ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      darkModeEnabled: row.darkModeEnabled,
      compactSidebar: row.compactSidebar,
      roundedStyle: row.roundedStyle,
      appearanceMode: row.appearanceMode,
      layoutJson,
      customCss: row.customCss ?? undefined,
      customCssEnabled: row.customCssEnabled,
      displayName: branding?.displayName,
      brandingEnabled: branding?.brandingEnabled,
    };
  }

  async getOrCreateTheme(tenantId: string): Promise<ThemeSettingsDto> {
    const branding = await this.getOrCreate(tenantId);
    let theme = await this.prisma.appThemeSettings.findUnique({
      where: { tenantId },
    });
    if (!theme) {
      const preset = getPreset('dbc-enterprise-blue');
      theme = await this.prisma.appThemeSettings.create({
        data: {
          tenantId,
          themeName: preset.themeName,
          primaryColor: branding.primaryColor ?? preset.primaryColor,
          sidebarBg: branding.sidebarColor ?? preset.sidebarBg,
          accentColor: branding.accentColor ?? preset.accentColor,
          sidebarText: preset.sidebarText,
          sidebarActive: preset.sidebarActive,
          topbarBg: preset.topbarBg,
          cardBg: preset.cardBg,
          borderColor: preset.borderColor,
          fontFamily: preset.fontFamily,
          roundedStyle: preset.roundedStyle,
          layoutJson: preset.layout,
        },
      });
    }
    return this.toThemeDto(theme, {
      displayName: branding.displayName,
      brandingEnabled: branding.brandingEnabled,
    });
  }

  private themeDiff(before: ThemeSettingsDto, after: ThemeSettingsDto) {
    const keys = [
      'themeName',
      'primaryColor',
      'sidebarBg',
      'sidebarText',
      'sidebarActive',
      'topbarBg',
      'cardBg',
      'borderColor',
      'accentColor',
      'fontFamily',
      'darkModeEnabled',
      'compactSidebar',
      'roundedStyle',
      'appearanceMode',
      'layoutJson',
      'customCss',
      'customCssEnabled',
    ] as const;
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of keys) {
      const b = before[key];
      const a = after[key];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        changed[key] = { before: b, after: a };
      }
    }
    return changed;
  }

  async updateTheme(
    tenantId: string,
    userId: string,
    dto: UpdateThemeDto,
  ): Promise<ThemeSettingsDto> {
    const before = await this.getOrCreateTheme(tenantId);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as UpdateThemeDto;
    if (patch.customCss !== undefined) {
      patch.customCss = sanitizeCustomCss(patch.customCss);
    }
    const updated = await this.prisma.appThemeSettings.update({
      where: { tenantId },
      data: patch as Prisma.AppThemeSettingsUpdateInput,
    });

    const brandingPatch: Record<string, string | undefined> = {};
    if (dto.primaryColor !== undefined)
      brandingPatch.primaryColor = dto.primaryColor;
    if (dto.accentColor !== undefined)
      brandingPatch.accentColor = dto.accentColor;
    if (dto.sidebarBg !== undefined) brandingPatch.sidebarColor = dto.sidebarBg;
    if (Object.keys(brandingPatch).length > 0) {
      await this.prisma.tenantBranding.update({
        where: { tenantId },
        data: brandingPatch,
      });
    }

    const after = await this.getOrCreateTheme(tenantId);
    const diff = this.themeDiff(before, after);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'branding.theme_updated',
        entityType: 'app_theme_settings',
        entityId: updated.id,
        metadata: JSON.parse(JSON.stringify({ before, after, diff })),
      },
    });

    return after;
  }

  async applyThemePreset(
    tenantId: string,
    userId: string,
    presetId: string,
  ): Promise<ThemeSettingsDto> {
    const resolved = resolvePresetId(presetId);
    const preset = THEME_PRESETS[resolved];
    if (!preset)
      throw new NotFoundException(`Unknown theme preset: ${presetId}`);

    const before = await this.getOrCreateTheme(tenantId);
    const updated = await this.prisma.appThemeSettings.update({
      where: { tenantId },
      data: {
        themeName: preset.themeName,
        primaryColor: preset.primaryColor,
        accentColor: preset.accentColor,
        sidebarBg: preset.sidebarBg,
        sidebarText: preset.sidebarText,
        sidebarActive: preset.sidebarActive,
        topbarBg: preset.topbarBg,
        cardBg: preset.cardBg,
        borderColor: preset.borderColor,
        fontFamily: preset.fontFamily,
        roundedStyle: preset.roundedStyle,
        layoutJson: preset.layout,
      },
    });

    await this.prisma.tenantBranding.update({
      where: { tenantId },
      data: {
        primaryColor: preset.primaryColor,
        accentColor: preset.accentColor,
        sidebarColor: preset.sidebarBg,
      },
    });

    const after = await this.getOrCreateTheme(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'branding.theme_preset_applied',
        entityType: 'app_theme_settings',
        entityId: updated.id,
        metadata: JSON.parse(
          JSON.stringify({ presetId: resolved, before, after }),
        ),
      },
    });

    return after;
  }

  exportTheme(tenantId: string) {
    return this.getOrCreateTheme(tenantId).then((theme) => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      preset: theme.themeName,
      theme,
    }));
  }

  async importTheme(
    tenantId: string,
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<ThemeSettingsDto> {
    const themePayload =
      payload.theme && typeof payload.theme === 'object'
        ? (payload.theme as UpdateThemeDto)
        : (payload as UpdateThemeDto);
    return this.updateTheme(tenantId, userId, themePayload);
  }

  listThemePresets() {
    return PRESET_LIST.map((p) => ({
      id: p.themeName,
      label: p.label,
      primaryColor: p.primaryColor,
      sidebarBg: p.sidebarBg,
      accentColor: p.accentColor,
      category: p.category,
      purpose: p.purpose,
      mood: p.mood,
    }));
  }

  async listAudit(tenantId: string, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: { startsWith: 'branding.' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
  }
}
