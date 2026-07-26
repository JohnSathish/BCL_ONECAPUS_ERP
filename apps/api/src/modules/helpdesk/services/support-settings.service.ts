import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_FAQ_SEED,
  DEFAULT_SUPPORT_DEPARTMENTS,
} from '../constants/support-centre.constants';

@Injectable()
export class SupportSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async ensureBootstrap(tenantId: string) {
    const settings = await this.db().supportSettings.upsert({
      where: { tenantId },
      create: {
        id: randomUUID(),
        tenantId,
        contactEmail: 'support@donboscocollege.ac.in',
        contactPhone: '+91 3651 232 291',
        supportHours: 'Mon–Fri 9:00 AM – 4:00 PM',
        welcomeMessage:
          'Welcome to Don Bosco College Support Centre. How can we help you today?',
      },
      update: {},
    });

    const deptCount = await this.db().supportDepartment.count({
      where: { tenantId },
    });
    if (deptCount === 0) {
      for (const [i, d] of DEFAULT_SUPPORT_DEPARTMENTS.entries()) {
        const dept = await this.db().supportDepartment.create({
          data: {
            id: randomUUID(),
            tenantId,
            code: d.code,
            name: d.name,
            sortOrder: i,
            isActive: true,
          },
        });
        for (const category of d.categories) {
          await this.db().supportRoutingRule.create({
            data: {
              id: randomUUID(),
              tenantId,
              category,
              departmentId: dept.id,
              isActive: true,
            },
          });
        }
      }
    }

    const faqCount = await this.db().supportFaqCategory.count({
      where: { tenantId },
    });
    if (faqCount === 0) {
      for (const [i, seed] of DEFAULT_FAQ_SEED.entries()) {
        const cat = await this.db().supportFaqCategory.create({
          data: {
            id: randomUUID(),
            tenantId,
            code: seed.categoryCode,
            name: seed.categoryName,
            sortOrder: i,
            isActive: true,
          },
        });
        for (const [j, article] of seed.articles.entries()) {
          await this.db().supportFaqArticle.create({
            data: {
              id: randomUUID(),
              tenantId,
              categoryId: cat.id,
              question: article.question,
              answer: article.answer,
              keywords: article.keywords,
              isPublished: true,
              sortOrder: j,
            },
          });
        }
      }
    }

    return settings;
  }

  async getSettings(tenantId: string) {
    await this.ensureBootstrap(tenantId);
    return this.db().supportSettings.findUnique({ where: { tenantId } });
  }

  async updateSettings(
    tenantId: string,
    patch: {
      maxUploadMb?: number;
      allowedMimeJson?: string[];
      defaultAgentLang?: string;
      translationEnabled?: boolean;
      contactEmail?: string | null;
      contactPhone?: string | null;
      supportHours?: string | null;
      welcomeMessage?: string | null;
    },
  ) {
    await this.ensureBootstrap(tenantId);
    return this.db().supportSettings.update({
      where: { tenantId },
      data: {
        ...(patch.maxUploadMb != null
          ? { maxUploadMb: patch.maxUploadMb }
          : {}),
        ...(patch.allowedMimeJson
          ? { allowedMimeJson: patch.allowedMimeJson }
          : {}),
        ...(patch.defaultAgentLang
          ? { defaultAgentLang: patch.defaultAgentLang }
          : {}),
        ...(patch.translationEnabled != null
          ? { translationEnabled: patch.translationEnabled }
          : {}),
        ...(patch.contactEmail !== undefined
          ? { contactEmail: patch.contactEmail }
          : {}),
        ...(patch.contactPhone !== undefined
          ? { contactPhone: patch.contactPhone }
          : {}),
        ...(patch.supportHours !== undefined
          ? { supportHours: patch.supportHours }
          : {}),
        ...(patch.welcomeMessage !== undefined
          ? { welcomeMessage: patch.welcomeMessage }
          : {}),
      },
    });
  }

  listDepartments(tenantId: string) {
    return this.ensureBootstrap(tenantId).then(() =>
      this.db().supportDepartment.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  listRoutingRules(tenantId: string) {
    return this.ensureBootstrap(tenantId).then(() =>
      this.db().supportRoutingRule.findMany({
        where: { tenantId },
        include: { department: true },
        orderBy: { category: 'asc' },
      }),
    );
  }

  async upsertRoutingRule(
    tenantId: string,
    category: string,
    departmentId: string,
  ) {
    await this.ensureBootstrap(tenantId);
    return this.db().supportRoutingRule.upsert({
      where: { tenantId_category: { tenantId, category } },
      create: {
        id: randomUUID(),
        tenantId,
        category,
        departmentId,
        isActive: true,
      },
      update: { departmentId, isActive: true },
    });
  }

  listAgents(tenantId: string) {
    return this.db().supportAgent.findMany({
      where: { tenantId },
      include: { department: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertAgent(
    tenantId: string,
    data: {
      userId: string;
      departmentId?: string | null;
      displayName?: string | null;
      preferredLang?: string;
      maxConcurrent?: number;
      isActive?: boolean;
    },
  ) {
    return this.db().supportAgent.upsert({
      where: { tenantId_userId: { tenantId, userId: data.userId } },
      create: {
        id: randomUUID(),
        tenantId,
        userId: data.userId,
        departmentId: data.departmentId ?? null,
        displayName: data.displayName ?? null,
        preferredLang: data.preferredLang ?? 'ta',
        maxConcurrent: data.maxConcurrent ?? 5,
        isActive: data.isActive ?? true,
      },
      update: {
        departmentId: data.departmentId ?? undefined,
        displayName: data.displayName ?? undefined,
        preferredLang: data.preferredLang ?? undefined,
        maxConcurrent: data.maxConcurrent ?? undefined,
        isActive: data.isActive ?? undefined,
      },
    });
  }

  async setAgentPresence(
    tenantId: string,
    userId: string,
    isOnline: boolean,
    displayName?: string | null,
    preferredLang?: string | null,
  ) {
    await this.ensureBootstrap(tenantId);
    let agent = await this.db().supportAgent.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!agent) {
      const general = await this.db().supportDepartment.findFirst({
        where: { tenantId, code: 'GENERAL', isActive: true },
      });
      agent = await this.db().supportAgent.create({
        data: {
          id: randomUUID(),
          tenantId,
          userId,
          departmentId: general?.id ?? null,
          displayName: displayName?.trim() || null,
          preferredLang: preferredLang?.trim() || 'ta',
          isOnline,
          lastSeenAt: new Date(),
          isActive: true,
        },
        include: { department: true },
      });
      return agent;
    }

    return this.db().supportAgent.update({
      where: { id: agent.id },
      data: {
        isOnline,
        lastSeenAt: new Date(),
        ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
        ...(preferredLang?.trim()
          ? { preferredLang: preferredLang.trim() }
          : {}),
      },
      include: { department: true },
    });
  }
}
