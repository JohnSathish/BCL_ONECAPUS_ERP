import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { SupportSettingsService } from './support-settings.service';

@Injectable()
export class SupportFaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SupportSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async listPublished(tenantId: string, q?: string) {
    await this.settings.ensureBootstrap(tenantId);
    return this.db().supportFaqCategory.findMany({
      where: {
        tenantId,
        isActive: true,
        articles: { some: { isPublished: true } },
      },
      include: {
        articles: {
          where: {
            isPublished: true,
            ...(q
              ? {
                  OR: [
                    { question: { contains: q, mode: 'insensitive' } },
                    { answer: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listAdmin(tenantId: string) {
    await this.settings.ensureBootstrap(tenantId);
    return this.db().supportFaqCategory.findMany({
      where: { tenantId },
      include: { articles: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(
    tenantId: string,
    data: { code: string; name: string; sortOrder?: number },
  ) {
    return this.db().supportFaqCategory.create({
      data: {
        id: randomUUID(),
        tenantId,
        code: data.code.toUpperCase(),
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async createArticle(
    tenantId: string,
    data: {
      categoryId: string;
      question: string;
      answer: string;
      keywords?: string[];
      isPublished?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.db().supportFaqArticle.create({
      data: {
        id: randomUUID(),
        tenantId,
        categoryId: data.categoryId,
        question: data.question.trim(),
        answer: data.answer.trim(),
        keywords: data.keywords ?? [],
        isPublished: data.isPublished ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateArticle(
    tenantId: string,
    id: string,
    data: Partial<{
      question: string;
      answer: string;
      keywords: string[];
      isPublished: boolean;
      sortOrder: number;
    }>,
  ) {
    const row = await this.db().supportFaqArticle.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('FAQ article not found');
    return this.db().supportFaqArticle.update({
      where: { id },
      data: {
        ...(data.question != null ? { question: data.question.trim() } : {}),
        ...(data.answer != null ? { answer: data.answer.trim() } : {}),
        ...(data.keywords != null ? { keywords: data.keywords } : {}),
        ...(data.isPublished != null ? { isPublished: data.isPublished } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async search(tenantId: string, query: string) {
    await this.settings.ensureBootstrap(tenantId);
    const q = query.trim();
    if (!q) return [];
    return this.db().supportFaqArticle.findMany({
      where: {
        tenantId,
        isPublished: true,
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { answer: { contains: q, mode: 'insensitive' } },
          { keywords: { has: q.toLowerCase() } },
        ],
      },
      include: { category: true },
      take: 10,
    });
  }
}
