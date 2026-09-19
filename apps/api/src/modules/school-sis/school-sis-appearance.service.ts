import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { SchoolSisService } from './school-sis.service';
import {
  APPEARANCE_THEME_PRESETS,
  DEFAULT_APPEARANCE_CONFIG,
  accessibilityScore,
  contrastRatio,
  isHexColor,
  mergeAppearanceConfig,
  sanitizeAppearanceCss,
  type AppearanceConfig,
} from './school-sis-appearance.catalog';
import type { SaveAppearanceDto } from './dto/school-appearance.dto';
import { SUPER_ROLE_SLUGS } from './school-sis-iam.catalog';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';

const LOGO_SLOTS = [
  'logo',
  'darkLogo',
  'mobileLogo',
  'favicon',
  'loginLogo',
] as const;

@Injectable()
export class SchoolSisAppearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  private canManage(user: JwtUser) {
    const p = user.permissions ?? [];
    return p.includes('*') || p.includes(SCHOOL_SIS_PERMISSION_MANAGE);
  }

  private canCss(user: JwtUser) {
    const roles = user.roles ?? [];
    return (
      this.canManage(user) &&
      (roles.some((r) => SUPER_ROLE_SLUGS.has(String(r).toLowerCase())) ||
        (user.permissions ?? []).includes('*'))
    );
  }

  private async row(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const existing = await this.prisma.schoolAppearanceSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.schoolAppearanceSettings.create({
      data: {
        tenantId,
        theme: 'royal',
        primaryColor: '#1A365D',
        secondaryColor: '#2B4C7E',
        accentColor: '#0EA5E9',
        configJson:
          DEFAULT_APPEARANCE_CONFIG as unknown as Prisma.InputJsonValue,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  private snapshot(
    row: Awaited<ReturnType<SchoolSisAppearanceService['row']>>,
  ) {
    const config = mergeAppearanceConfig(
      row.configJson as Partial<AppearanceConfig>,
    );
    return {
      theme: row.theme,
      mode: row.mode,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      accentColor: row.accentColor,
      successColor: row.successColor,
      warningColor: row.warningColor,
      dangerColor: row.dangerColor,
      fontFamily: row.fontFamily,
      logoUrl: row.logoUrl,
      darkLogoUrl: row.darkLogoUrl,
      mobileLogoUrl: row.mobileLogoUrl,
      faviconUrl: row.faviconUrl,
      sidebarStyle: row.sidebarStyle,
      sidebarWidth: row.sidebarWidth,
      sidebarPosition: row.sidebarPosition,
      borderRadius: row.borderRadius,
      cardStyle: row.cardStyle,
      buttonStyle: row.buttonStyle,
      loginLayout: row.loginLayout,
      loginBackground: row.loginBackground,
      loginOverlay: row.loginOverlay,
      customCss: row.customCss,
      config,
    };
  }

  private dto(
    row: Awaited<ReturnType<SchoolSisAppearanceService['row']>>,
    extra?: Record<string, unknown>,
  ) {
    const snap = this.snapshot(row);
    const textOnBg = contrastRatio(
      snap.config.colors.text,
      snap.config.colors.background,
    );
    const button = contrastRatio('#FFFFFF', snap.primaryColor);
    return {
      id: row.id,
      status: row.status,
      version: row.version,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      ...snap,
      accessibility: {
        score: accessibilityScore(snap.config),
        text: textOnBg,
        button,
      },
      presets: APPEARANCE_THEME_PRESETS,
      ...extra,
    };
  }

  async get(tenantId: string, user: JwtUser) {
    const row = await this.row(tenantId);
    return this.dto(row, {
      canManage: this.canManage(user),
      canCss: this.canCss(user),
    });
  }

  async published(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    try {
      const row = await this.row(tenantId);
      const snap = this.snapshot(row);
      return {
        theme: snap.theme,
        mode: snap.mode,
        primaryColor: snap.primaryColor,
        secondaryColor: snap.secondaryColor,
        accentColor: snap.accentColor,
        fontFamily: snap.fontFamily,
        logoUrl: snap.logoUrl,
        darkLogoUrl: snap.darkLogoUrl,
        mobileLogoUrl: snap.mobileLogoUrl,
        faviconUrl: snap.faviconUrl,
        sidebarStyle: snap.sidebarStyle,
        sidebarWidth: snap.sidebarWidth || 260,
        sidebarPosition: snap.sidebarPosition,
        borderRadius: snap.borderRadius,
        cardStyle: snap.cardStyle,
        loginLayout: snap.loginLayout,
        config: snap.config,
        customCss: snap.customCss,
        identity: snap.config.identity,
      };
    } catch {
      const config = DEFAULT_APPEARANCE_CONFIG;
      return {
        theme: 'royal',
        mode: 'system',
        primaryColor: '#1A365D',
        secondaryColor: '#2B4C7E',
        accentColor: '#0EA5E9',
        fontFamily: 'Inter',
        logoUrl: null,
        darkLogoUrl: null,
        mobileLogoUrl: null,
        faviconUrl: null,
        sidebarStyle: 'classic',
        sidebarWidth: 260,
        sidebarPosition: 'left',
        borderRadius: 16,
        cardStyle: 'elevated',
        loginLayout: 'split',
        config,
        customCss: '',
        identity: config.identity,
      };
    }
  }

  private applyPreset(
    theme: string,
    config: AppearanceConfig,
  ): AppearanceConfig {
    const preset = APPEARANCE_THEME_PRESETS.find((t) => t.id === theme);
    if (!preset || theme === 'custom') return config;
    return {
      ...config,
      colors: {
        ...config.colors,
        primary: preset.primary,
        secondary: preset.secondary,
        accent: preset.accent,
      },
    };
  }

  private assertColors(dto: SaveAppearanceDto, config: AppearanceConfig) {
    const colors = {
      primary: dto.primaryColor ?? config.colors.primary,
      background: config.colors.background,
      text: config.colors.text,
    };
    for (const value of Object.values(colors)) {
      if (value && !isHexColor(value))
        throw new BadRequestException('Colours must be 6-digit hex');
    }
    const ratio = contrastRatio(config.colors.text, config.colors.background);
    if (ratio < 3 && !config.colors.contrastOverride && !dto.contrastOverride) {
      throw new BadRequestException(
        'Text contrast is too low. Improve the colours or explicitly override the accessibility warning.',
      );
    }
  }

  async saveDraft(tenantId: string, user: JwtUser, dto: SaveAppearanceDto) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    const row = await this.row(tenantId);
    let config = mergeAppearanceConfig({
      ...(row.configJson as Partial<AppearanceConfig>),
      ...(dto.config as Partial<AppearanceConfig> | undefined),
    });
    if (dto.theme) config = this.applyPreset(dto.theme, config);
    if (dto.primaryColor) config.colors.primary = dto.primaryColor;
    if (dto.secondaryColor) config.colors.secondary = dto.secondaryColor;
    if (dto.accentColor) config.colors.accent = dto.accentColor;
    if (dto.contrastOverride != null)
      config.colors.contrastOverride = dto.contrastOverride;
    this.assertColors(dto, config);
    let customCss = row.customCss;
    if (dto.customCss != null) {
      if (!this.canCss(user))
        throw new ForbiddenException(
          'Advanced CSS is reserved for super admins',
        );
      try {
        customCss = sanitizeAppearanceCss(dto.customCss);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Invalid CSS',
        );
      }
    }
    const updated = await this.prisma.schoolAppearanceSettings.update({
      where: { id: row.id },
      data: {
        theme: dto.theme ?? row.theme,
        mode: dto.mode ?? row.mode,
        primaryColor: dto.primaryColor ?? config.colors.primary,
        secondaryColor: dto.secondaryColor ?? config.colors.secondary,
        accentColor: dto.accentColor ?? config.colors.accent,
        successColor: dto.successColor ?? row.successColor,
        warningColor: dto.warningColor ?? row.warningColor,
        dangerColor: dto.dangerColor ?? row.dangerColor,
        fontFamily: dto.fontFamily ?? config.typography.fontFamily,
        logoUrl: dto.logoUrl === undefined ? row.logoUrl : dto.logoUrl,
        darkLogoUrl:
          dto.darkLogoUrl === undefined ? row.darkLogoUrl : dto.darkLogoUrl,
        mobileLogoUrl:
          dto.mobileLogoUrl === undefined
            ? row.mobileLogoUrl
            : dto.mobileLogoUrl,
        faviconUrl:
          dto.faviconUrl === undefined ? row.faviconUrl : dto.faviconUrl,
        sidebarStyle: dto.sidebarStyle ?? config.sidebar.style,
        sidebarWidth: dto.sidebarWidth ?? config.sidebar.width,
        sidebarPosition: dto.sidebarPosition ?? config.sidebar.position,
        borderRadius: dto.borderRadius ?? row.borderRadius,
        cardStyle: dto.cardStyle ?? config.dashboard.cardStyle,
        buttonStyle: dto.buttonStyle ?? row.buttonStyle,
        loginLayout: dto.loginLayout ?? config.login.layout,
        loginBackground: dto.loginBackground ?? config.login.background,
        loginOverlay: dto.loginOverlay ?? config.login.overlay,
        customCss,
        configJson: config as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        updatedBy: user.sub,
      },
    });
    return this.dto(updated, { canManage: true, canCss: this.canCss(user) });
  }

  async publish(tenantId: string, user: JwtUser) {
    const row = await this.row(tenantId);
    const next = row.version + 1;
    await this.prisma.schoolAppearanceVersion.create({
      data: {
        tenantId,
        settingsId: row.id,
        version: next,
        label: `${row.theme} theme`,
        snapshot: this.snapshot(row) as unknown as Prisma.InputJsonValue,
        publishedBy: user.sub,
      },
    });
    const updated = await this.prisma.schoolAppearanceSettings.update({
      where: { id: row.id },
      data: {
        status: 'PUBLISHED',
        version: next,
        publishedAt: new Date(),
        updatedBy: user.sub,
      },
    });
    return this.dto(updated, {
      canManage: true,
      canCss: this.canCss(user),
      published: true,
    });
  }

  async reset(tenantId: string, user: JwtUser) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    const row = await this.row(tenantId);
    const updated = await this.prisma.schoolAppearanceSettings.update({
      where: { id: row.id },
      data: {
        theme: 'royal',
        mode: 'system',
        primaryColor: '#1A365D',
        secondaryColor: '#2B4C7E',
        accentColor: '#0EA5E9',
        configJson:
          DEFAULT_APPEARANCE_CONFIG as unknown as Prisma.InputJsonValue,
        customCss: '',
        status: 'DRAFT',
        updatedBy: user.sub,
      },
    });
    return this.dto(updated, { canManage: true, canCss: this.canCss(user) });
  }

  async versions(tenantId: string, user: JwtUser) {
    await this.get(tenantId, user);
    return this.prisma.schoolAppearanceVersion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async restore(tenantId: string, user: JwtUser, versionId: string) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    const ver = await this.prisma.schoolAppearanceVersion.findFirst({
      where: { id: versionId, tenantId },
    });
    if (!ver) throw new NotFoundException('Version not found');
    const snap = ver.snapshot as SaveAppearanceDto & {
      config?: AppearanceConfig;
    };
    return this.saveDraft(tenantId, user, {
      ...snap,
      config: snap.config as unknown as Record<string, unknown>,
    });
  }

  async listThemes(tenantId: string) {
    const row = await this.row(tenantId);
    return this.prisma.schoolAppearanceTheme.findMany({
      where: { tenantId, settingsId: row.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveTheme(
    tenantId: string,
    user: JwtUser,
    name: string,
    description?: string,
  ) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    const row = await this.row(tenantId);
    return this.prisma.schoolAppearanceTheme.create({
      data: {
        tenantId,
        settingsId: row.id,
        name: name.trim().slice(0, 80) || 'Untitled theme',
        description: (description ?? '').slice(0, 240),
        snapshot: this.snapshot(row) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async applyTheme(tenantId: string, user: JwtUser, themeId: string) {
    const theme = await this.prisma.schoolAppearanceTheme.findFirst({
      where: { id: themeId, tenantId },
    });
    if (!theme) throw new NotFoundException('Theme not found');
    const snap = theme.snapshot as SaveAppearanceDto & {
      config?: AppearanceConfig;
    };
    return this.saveDraft(tenantId, user, {
      ...snap,
      config: snap.config as unknown as Record<string, unknown>,
    });
  }

  async deleteTheme(tenantId: string, user: JwtUser, themeId: string) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    await this.prisma.schoolAppearanceTheme.deleteMany({
      where: { id: themeId, tenantId },
    });
    return { ok: true };
  }

  async exportJson(tenantId: string, user: JwtUser) {
    const row = await this.row(tenantId);
    void user;
    return {
      kind: 'st-lukes-appearance',
      version: 1,
      snapshot: this.snapshot(row),
    };
  }

  async importJson(
    tenantId: string,
    user: JwtUser,
    snapshot: Record<string, unknown>,
  ) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new BadRequestException('Invalid appearance JSON');
    }
    return this.saveDraft(tenantId, user, snapshot as SaveAppearanceDto);
  }

  async uploadLogo(
    tenantId: string,
    user: JwtUser,
    slot: string,
    file?: Express.Multer.File,
  ) {
    if (!this.canManage(user))
      throw new ForbiddenException('Appearance is managed by administrators');
    if (!LOGO_SLOTS.includes(slot as (typeof LOGO_SLOTS)[number])) {
      throw new BadRequestException('Unknown logo slot');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Select an image');
    if (file.size > 2_500_000)
      throw new BadRequestException('Image must be under 2.5 MB');
    const mime = file.mimetype || '';
    if (!/image\/(png|jpeg|jpg|webp|svg\+xml)/i.test(mime)) {
      throw new BadRequestException('Use PNG, JPG, SVG or WebP');
    }
    const ext = extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)
      ? ext
      : '.png';
    const key = `school-appearance/${tenantId}/${slot}-${randomUUID()}${safeExt}`;
    const disk = join(resolveUploadRoot(), key);
    await mkdir(dirname(disk), { recursive: true });
    await writeFile(disk, file.buffer);
    const url = `/uploads/${key}`;
    const row = await this.row(tenantId);
    const config = mergeAppearanceConfig(
      row.configJson as Partial<AppearanceConfig>,
    );
    const data: Prisma.SchoolAppearanceSettingsUpdateInput = {
      updatedBy: user.sub,
      status: 'DRAFT',
    };
    if (slot === 'logo') data.logoUrl = url;
    if (slot === 'darkLogo') data.darkLogoUrl = url;
    if (slot === 'mobileLogo') data.mobileLogoUrl = url;
    if (slot === 'favicon') data.faviconUrl = url;
    if (slot === 'loginLogo') config.identity.loginLogoUrl = url;
    data.configJson = config as unknown as Prisma.InputJsonValue;
    const updated = await this.prisma.schoolAppearanceSettings.update({
      where: { id: row.id },
      data,
    });
    return this.dto(updated, {
      canManage: true,
      canCss: this.canCss(user),
      uploaded: url,
    });
  }
}
