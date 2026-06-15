import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export type LoginContextDto = {
  tenantSlug: string;
  institution: {
    displayName: string;
    shortName?: string;
    campusName?: string;
    portalSubtitle?: string;
    address?: string;
    logoUrl?: string;
    faviconUrl?: string;
    badges?: string[];
  };
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    sidebarColor?: string;
  };
  loginBackgroundStyle: 'gradient' | 'solid' | 'mesh';
  showPoweredBy: boolean;
  brandingEnabled: boolean;
  poweredBy: 'BCL OneCampus ERP';
};

@Injectable()
export class TenantResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  normalizeHost(raw: string): string {
    const trimmed = raw.trim().toLowerCase();
    const withoutPort = trimmed.split(':')[0] ?? trimmed;
    return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
  }

  extractHostFromHeaders(
    hostHeader?: string,
    forwardedHost?: string | string[],
  ): string {
    const forwarded =
      typeof forwardedHost === 'string'
        ? forwardedHost.split(',')[0]?.trim()
        : Array.isArray(forwardedHost)
          ? forwardedHost[0]?.trim()
          : undefined;
    const host = forwarded || hostHeader || '';
    return this.normalizeHost(host);
  }

  private mapDevLoginHost(host: string): string {
    const normalized = this.normalizeHost(host);
    if (this.config.get<string>('NODE_ENV') === 'production') {
      return normalized;
    }
    const devLoginHost = this.config.get<string>(
      'DEV_LOGIN_HOST',
      'demo.localhost',
    );
    if (
      !normalized ||
      normalized === 'localhost' ||
      normalized === '127.0.0.1'
    ) {
      return this.normalizeHost(devLoginHost);
    }
    return normalized;
  }

  async resolveSlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        deletedAt: null,
        status: 'active',
      },
    });
    if (!tenant) throw new NotFoundException('Institution not found');
    return tenant;
  }

  async resolveHost(host: string) {
    const normalized = this.mapDevLoginHost(host);
    if (!normalized) {
      throw new NotFoundException('Institution portal not found');
    }

    const allowUnverified =
      this.config.get<string>('ALLOW_UNVERIFIED_DOMAINS', 'false') === 'true';

    const domain = await this.prisma.tenantDomain.findFirst({
      where: {
        host: normalized,
        deletedAt: null,
        ...(allowUnverified ? {} : { verified: true }),
      },
      include: {
        tenant: {
          include: {
            branding: true,
            institutions: {
              where: { deletedAt: null },
              take: 1,
              include: {
                campuses: {
                  where: { deletedAt: null },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (
      !domain?.tenant ||
      domain.tenant.deletedAt ||
      domain.tenant.status !== 'active'
    ) {
      throw new NotFoundException('Institution portal not found');
    }

    return domain.tenant;
  }

  async getLoginContext(host: string): Promise<LoginContextDto> {
    const tenant = await this.resolveHost(host);
    const branding = tenant.branding;
    const institution = tenant.institutions[0];
    const campus = institution?.campuses[0];

    const badges = Array.isArray(branding?.badges)
      ? (branding.badges as string[])
      : [];

    const bgStyle = branding?.loginBackgroundStyle ?? 'gradient';
    const loginBackgroundStyle =
      bgStyle === 'solid' || bgStyle === 'mesh' ? bgStyle : 'gradient';

    return {
      tenantSlug: tenant.slug,
      institution: {
        displayName: branding?.displayName ?? institution?.name ?? tenant.name,
        shortName: branding?.shortName ?? undefined,
        campusName: branding?.campusName ?? campus?.name,
        portalSubtitle: branding?.portalSubtitle ?? 'Campus ERP Portal',
        address: branding?.address ?? undefined,
        logoUrl: branding?.logoUrl ?? undefined,
        faviconUrl: branding?.faviconUrl ?? undefined,
        badges: badges.length > 0 ? badges : undefined,
      },
      theme: {
        primaryColor: branding?.primaryColor ?? '#2563eb',
        accentColor: branding?.accentColor ?? '#7c3aed',
        sidebarColor: branding?.sidebarColor ?? undefined,
      },
      loginBackgroundStyle,
      showPoweredBy: branding?.showPoweredBy ?? true,
      brandingEnabled: branding?.brandingEnabled ?? true,
      poweredBy: 'BCL OneCampus ERP',
    };
  }
}
