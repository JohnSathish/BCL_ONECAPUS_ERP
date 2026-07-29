import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WebsitePopup } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuditHelper } from '../administration/admin-audit.helper';
import { sanitizeWebsiteHtml } from './utils/website-html-sanitizer';
import { WebsiteService } from './website.service';

const POPUP_TYPES = [
  'IMAGE',
  'HTML',
  'VIDEO',
  'ANNOUNCEMENT',
  'BANNER',
] as const;
const POPUP_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
const SHOW_TRIGGERS = [
  'IMMEDIATE',
  'DELAY_5',
  'DELAY_10',
  'SCROLL_PERCENT',
  'EXIT_INTENT',
] as const;
const FREQUENCIES = [
  'EVERY_VISIT',
  'ONCE_PER_DAY',
  'ONCE_PER_WEEK',
  'ONCE_PER_BROWSER',
  'NEVER_SHOW_AGAIN',
] as const;
const POSITIONS = [
  'CENTER',
  'TOP',
  'BOTTOM',
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT',
] as const;
const ANIMATIONS = ['FADE', 'SLIDE_UP', 'SLIDE_DOWN', 'ZOOM', 'NONE'] as const;
const VIDEO_TYPES = ['YOUTUBE', 'VIMEO', 'MP4'] as const;
const PAGES = ['HOME'] as const;

const CLOSE_BEHAVIORS = [
  'X',
  'CLOSE_BUTTON',
  'ESC',
  'CLICK_OUTSIDE',
  'AUTO_CLOSE_5',
  'AUTO_CLOSE_10',
  'AUTO_CLOSE_15',
  'AUTO_CLOSE_30',
] as const;

export type WebsitePopupDto = {
  title: string;
  popupType?: string;
  contentHtml?: string;
  contentJson?: Record<string, unknown>;
  imageJson?: Record<string, unknown> | null;
  videoUrl?: string | null;
  videoType?: string | null;
  buttonJson?: Array<Record<string, unknown>>;
  status?: string;
  displayOrder?: number;
  showTrigger?: string;
  showDelay?: number;
  scrollPercent?: number | null;
  frequency?: string;
  closeBehavior?: string[];
  autoCloseSeconds?: number | null;
  position?: string;
  animation?: string;
  overlayJson?: Record<string, unknown>;
  sizeJson?: Record<string, unknown>;
  audienceJson?: Record<string, unknown>;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  page?: string;
};

@Injectable()
export class WebsitePopupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
    private readonly audit: AdminAuditHelper,
  ) {}

  async listAdmin(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websitePopup.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const authorIds = [
      ...new Set(rows.map((row) => row.createdById).filter(Boolean)),
    ] as string[];
    const authors =
      authorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, displayName: true, email: true },
          })
        : [];
    const authorById = new Map(authors.map((user) => [user.id, user]));
    return rows.map((row) =>
      this.mapPopup(row, authorById.get(row.createdById ?? '')),
    );
  }

  async listPublicActive(tenantId: string, pageQuery?: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const page = this.normalizePage(pageQuery);
    const rows = await this.prisma.websitePopup.findMany({
      where: {
        tenantId,
        siteId: site.id,
        status: 'ACTIVE',
        page,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const now = new Date();
    return rows
      .filter((row) => this.isScheduleEligible(row, now))
      .map((row) => this.mapPublicPopup(row));
  }

  async create(user: JwtUser, dto: WebsitePopupDto) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const data = this.buildWriteData(dto, user.sub, true);
    const row = await this.prisma.websitePopup.create({
      data: {
        ...(data as Prisma.WebsitePopupUncheckedCreateInput),
        tenantId: user.tid,
        siteId: site.id,
        createdById: user.sub,
      },
    });
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_created',
      entityType: 'website_popup',
      entityId: row.id,
      metadata: { title: row.title, popupType: row.popupType },
    });
    await this.revalidatePublicSite(user);
    return this.mapPopup(row);
  }

  async update(user: JwtUser, popupId: string, dto: Partial<WebsitePopupDto>) {
    const existing = await this.requirePopup(user.tid, popupId);
    const data = this.buildWriteData(dto, user.sub, false);
    const row = await this.prisma.websitePopup.update({
      where: { id: existing.id },
      data: data as Prisma.WebsitePopupUncheckedUpdateInput,
    });
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_updated',
      entityType: 'website_popup',
      entityId: row.id,
      metadata: { title: row.title },
    });
    await this.revalidatePublicSite(user);
    return this.mapPopup(row);
  }

  async delete(user: JwtUser, popupId: string) {
    const existing = await this.requirePopup(user.tid, popupId);
    await this.prisma.websitePopup.delete({ where: { id: existing.id } });
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_deleted',
      entityType: 'website_popup',
      entityId: existing.id,
      metadata: { title: existing.title },
    });
    await this.revalidatePublicSite(user);
    return { ok: true };
  }

  async updateStatus(user: JwtUser, popupId: string, status: string) {
    const existing = await this.requirePopup(user.tid, popupId);
    const normalized = status.toUpperCase();
    if (
      !POPUP_STATUSES.includes(normalized as (typeof POPUP_STATUSES)[number])
    ) {
      throw new BadRequestException('Invalid popup status');
    }
    const row = await this.prisma.websitePopup.update({
      where: { id: existing.id },
      data: { status: normalized, updatedById: user.sub },
    });
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_status_changed',
      entityType: 'website_popup',
      entityId: row.id,
      metadata: { status: normalized },
    });
    await this.revalidatePublicSite(user);
    return this.mapPopup(row);
  }

  async duplicate(user: JwtUser, popupId: string) {
    const existing = await this.requirePopup(user.tid, popupId);
    const row = await this.prisma.websitePopup.create({
      data: {
        tenantId: existing.tenantId,
        siteId: existing.siteId,
        title: `${existing.title} (Copy)`,
        popupType: existing.popupType,
        contentHtml: existing.contentHtml,
        contentJson: existing.contentJson ?? {},
        imageJson: existing.imageJson ?? undefined,
        videoUrl: existing.videoUrl,
        videoType: existing.videoType,
        buttonJson: existing.buttonJson ?? [],
        status: 'INACTIVE',
        displayOrder: existing.displayOrder + 1,
        showTrigger: existing.showTrigger,
        showDelay: existing.showDelay,
        scrollPercent: existing.scrollPercent,
        frequency: existing.frequency,
        closeBehavior: existing.closeBehavior ?? [],
        autoCloseSeconds: existing.autoCloseSeconds,
        position: existing.position,
        animation: existing.animation,
        overlayJson: existing.overlayJson ?? {},
        sizeJson: existing.sizeJson ?? {},
        audienceJson: existing.audienceJson ?? {},
        startDate: existing.startDate,
        endDate: existing.endDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        page: existing.page,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_created',
      entityType: 'website_popup',
      entityId: row.id,
      metadata: { duplicatedFrom: existing.id },
    });
    return this.mapPopup(row);
  }

  async preview(user: JwtUser, popupId: string) {
    const row = await this.requirePopup(user.tid, popupId);
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'website',
      action: 'website.popup_preview_rendered',
      entityType: 'website_popup',
      entityId: row.id,
    });
    return this.mapPublicPopup(row);
  }

  private async revalidatePublicSite(user: JwtUser) {
    const hook = process.env.WEBSITE_REVALIDATE_WEBHOOK_URL?.trim();
    if (!hook) return;
    try {
      const secret =
        process.env.WEBSITE_REVALIDATE_SECRET?.trim() ||
        process.env.REVALIDATE_SECRET?.trim();
      await fetch(hook, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-revalidate-secret': secret } : {}),
        },
        body: JSON.stringify({
          tenantId: user.tid,
          paths: ['/'],
          tags: ['website-cms'],
          requestedAt: new Date().toISOString(),
          requestedBy: user.sub,
          reason: 'website_popup_changed',
        }),
      });
    } catch {
      // Non-blocking: popup save still succeeds if college-web webhook is down
    }
  }

  private async requirePopup(tenantId: string, popupId: string) {
    const row = await this.prisma.websitePopup.findFirst({
      where: { id: popupId, tenantId },
    });
    if (!row) throw new NotFoundException('Popup not found');
    return row;
  }

  private normalizePage(pageQuery?: string) {
    const normalized = (pageQuery ?? 'home').trim().toUpperCase();
    if (normalized === 'HOME' || normalized === 'HOME_PAGE') return 'HOME';
    if (!PAGES.includes(normalized as (typeof PAGES)[number])) {
      throw new BadRequestException('Unsupported page target');
    }
    return normalized;
  }

  private isScheduleEligible(row: WebsitePopup, now: Date) {
    const today = this.toDateOnly(now);
    if (row.startDate && today < this.toDateOnly(row.startDate)) return false;
    if (row.endDate && today > this.toDateOnly(row.endDate)) return false;
    if (row.startTime || row.endTime) {
      const minutes = now.getHours() * 60 + now.getMinutes();
      const start = this.parseTimeMinutes(row.startTime);
      const end = this.parseTimeMinutes(row.endTime);
      if (start !== null && end !== null) {
        if (start <= end) {
          if (minutes < start || minutes > end) return false;
        } else if (minutes < start && minutes > end) {
          return false;
        }
      } else if (start !== null && minutes < start) {
        return false;
      } else if (end !== null && minutes > end) {
        return false;
      }
    }
    return true;
  }

  private toDateOnly(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private parseTimeMinutes(value?: string | null) {
    if (!value?.trim()) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  private buildWriteData(
    dto: Partial<WebsitePopupDto>,
    userId: string,
    isCreate: boolean,
  ) {
    const data: Record<string, unknown> = { updatedById: userId };

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Title is required');
      data.title = title;
    } else if (isCreate) {
      throw new BadRequestException('Title is required');
    }

    if (dto.popupType !== undefined) {
      const popupType = dto.popupType.toUpperCase();
      if (!POPUP_TYPES.includes(popupType as (typeof POPUP_TYPES)[number])) {
        throw new BadRequestException('Invalid popup type');
      }
      data.popupType = popupType;
    } else if (isCreate) {
      data.popupType = 'HTML';
    }

    if (dto.contentHtml !== undefined) {
      const contentHtml = sanitizeWebsiteHtml(dto.contentHtml ?? '');
      if (contentHtml.length > 400_000) {
        throw new BadRequestException('Popup HTML content is too large');
      }
      data.contentHtml = contentHtml;
    }

    if (dto.contentJson !== undefined) data.contentJson = dto.contentJson ?? {};
    if (dto.imageJson !== undefined)
      data.imageJson = this.normalizeImageJson(dto.imageJson);
    if (dto.videoUrl !== undefined)
      data.videoUrl = dto.videoUrl?.trim() || null;

    if (dto.videoType !== undefined) {
      const videoType = dto.videoType?.toUpperCase() || null;
      if (
        videoType &&
        !VIDEO_TYPES.includes(videoType as (typeof VIDEO_TYPES)[number])
      ) {
        throw new BadRequestException('Invalid video type');
      }
      data.videoType = videoType;
    }

    if (dto.buttonJson !== undefined) data.buttonJson = dto.buttonJson ?? [];

    if (dto.status !== undefined) {
      const status = dto.status.toUpperCase();
      if (!POPUP_STATUSES.includes(status as (typeof POPUP_STATUSES)[number])) {
        throw new BadRequestException('Invalid popup status');
      }
      data.status = status;
    } else if (isCreate) {
      data.status = 'INACTIVE';
    }

    if (dto.displayOrder !== undefined)
      data.displayOrder = Number(dto.displayOrder) || 0;

    if (dto.showTrigger !== undefined) {
      const showTrigger = dto.showTrigger.toUpperCase();
      if (
        !SHOW_TRIGGERS.includes(showTrigger as (typeof SHOW_TRIGGERS)[number])
      ) {
        throw new BadRequestException('Invalid show trigger');
      }
      data.showTrigger = showTrigger;
    }

    if (dto.showDelay !== undefined)
      data.showDelay = Math.max(0, Number(dto.showDelay) || 0);

    if (dto.scrollPercent !== undefined) {
      const scrollPercent =
        dto.scrollPercent === null
          ? null
          : Math.min(100, Math.max(0, Number(dto.scrollPercent)));
      data.scrollPercent = scrollPercent;
    }

    if (dto.frequency !== undefined) {
      const frequency = dto.frequency.toUpperCase();
      if (!FREQUENCIES.includes(frequency as (typeof FREQUENCIES)[number])) {
        throw new BadRequestException('Invalid frequency rule');
      }
      data.frequency = frequency;
    }

    if (dto.closeBehavior !== undefined) {
      const closeBehavior = (dto.closeBehavior ?? []).map((item) =>
        item.toUpperCase(),
      );
      for (const item of closeBehavior) {
        if (
          !CLOSE_BEHAVIORS.includes(item as (typeof CLOSE_BEHAVIORS)[number])
        ) {
          throw new BadRequestException(`Invalid close behavior: ${item}`);
        }
      }
      data.closeBehavior = closeBehavior;
      const autoFromBehavior = closeBehavior.find((item) =>
        item.startsWith('AUTO_CLOSE_'),
      );
      if (autoFromBehavior) {
        data.autoCloseSeconds = Number(
          autoFromBehavior.replace('AUTO_CLOSE_', ''),
        );
      } else if (dto.autoCloseSeconds !== undefined) {
        data.autoCloseSeconds = dto.autoCloseSeconds;
      }
    } else if (dto.autoCloseSeconds !== undefined) {
      data.autoCloseSeconds = dto.autoCloseSeconds;
    }

    if (dto.position !== undefined) {
      const position = dto.position.toUpperCase();
      if (!POSITIONS.includes(position as (typeof POSITIONS)[number])) {
        throw new BadRequestException('Invalid popup position');
      }
      data.position = position;
    }

    if (dto.animation !== undefined) {
      const animation = dto.animation.toUpperCase();
      if (!ANIMATIONS.includes(animation as (typeof ANIMATIONS)[number])) {
        throw new BadRequestException('Invalid popup animation');
      }
      data.animation = animation;
    }

    if (dto.overlayJson !== undefined) data.overlayJson = dto.overlayJson ?? {};
    if (dto.sizeJson !== undefined) data.sizeJson = dto.sizeJson ?? {};
    if (dto.audienceJson !== undefined)
      data.audienceJson = dto.audienceJson ?? {};

    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.startTime !== undefined)
      data.startTime = dto.startTime?.trim() || null;
    if (dto.endTime !== undefined) data.endTime = dto.endTime?.trim() || null;

    if (dto.page !== undefined) {
      const page = dto.page.toUpperCase();
      if (!PAGES.includes(page as (typeof PAGES)[number])) {
        throw new BadRequestException('Unsupported page target');
      }
      data.page = page;
    } else if (isCreate) {
      data.page = 'HOME';
    }

    return data;
  }

  private normalizeImageJson(value: unknown) {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const record = value as Record<string, unknown>;
    const url =
      (typeof record.url === 'string' && record.url.trim()) ||
      (typeof record.publicUrl === 'string' && record.publicUrl.trim()) ||
      (typeof record.imageUrl === 'string' && record.imageUrl.trim()) ||
      '';
    if (!url) return null;
    return {
      url,
      alt: typeof record.alt === 'string' ? record.alt : undefined,
      caption: typeof record.caption === 'string' ? record.caption : undefined,
    };
  }

  private mapPopup(
    row: WebsitePopup,
    author?: { displayName: string | null; email: string | null },
  ) {
    return {
      id: row.id,
      title: row.title,
      popupType: row.popupType,
      contentHtml: row.contentHtml,
      contentJson: row.contentJson ?? {},
      imageJson: this.normalizeImageJson(row.imageJson),
      videoUrl: row.videoUrl,
      videoType: row.videoType,
      buttonJson: row.buttonJson ?? [],
      status: row.status,
      displayOrder: row.displayOrder,
      showTrigger: row.showTrigger,
      showDelay: row.showDelay,
      scrollPercent: row.scrollPercent,
      frequency: row.frequency,
      closeBehavior: row.closeBehavior ?? [],
      autoCloseSeconds: row.autoCloseSeconds,
      position: row.position,
      animation: row.animation,
      overlayJson: row.overlayJson ?? {},
      sizeJson: row.sizeJson ?? {},
      audienceJson: row.audienceJson ?? {},
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      startTime: row.startTime,
      endTime: row.endTime,
      page: row.page,
      createdById: row.createdById,
      createdByName: author?.displayName || author?.email || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPublicPopup(row: WebsitePopup) {
    return {
      id: row.id,
      title: row.title,
      popupType: row.popupType,
      contentHtml: row.contentHtml,
      contentJson: row.contentJson ?? {},
      imageJson: this.normalizeImageJson(row.imageJson),
      videoUrl: row.videoUrl,
      videoType: row.videoType,
      buttonJson: row.buttonJson ?? [],
      displayOrder: row.displayOrder,
      showTrigger: row.showTrigger,
      showDelay: row.showDelay,
      scrollPercent: row.scrollPercent,
      frequency: row.frequency,
      closeBehavior: row.closeBehavior ?? [],
      autoCloseSeconds: row.autoCloseSeconds,
      position: row.position,
      animation: row.animation,
      overlayJson: row.overlayJson ?? {},
      sizeJson: row.sizeJson ?? {},
    };
  }
}

export {
  POPUP_TYPES,
  POPUP_STATUSES,
  SHOW_TRIGGERS,
  FREQUENCIES,
  POSITIONS,
  ANIMATIONS,
  VIDEO_TYPES,
  CLOSE_BEHAVIORS,
};
