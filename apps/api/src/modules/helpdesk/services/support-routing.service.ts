import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SupportSettingsService } from './support-settings.service';

@Injectable()
export class SupportRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SupportSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async resolveDepartmentId(tenantId: string, category: string) {
    await this.settings.ensureBootstrap(tenantId);
    const rule = await this.db().supportRoutingRule.findFirst({
      where: { tenantId, category, isActive: true },
    });
    if (rule?.departmentId) return rule.departmentId as string;

    const general = await this.db().supportDepartment.findFirst({
      where: { tenantId, code: 'GENERAL', isActive: true },
    });
    return (general?.id as string | undefined) ?? null;
  }

  async pickAgentForDepartment(tenantId: string, departmentId: string | null) {
    if (!departmentId) return null;
    const agents = await this.db().supportAgent.findMany({
      where: {
        tenantId,
        departmentId,
        isActive: true,
      },
      orderBy: [{ isOnline: 'desc' }, { updatedAt: 'asc' }],
    });
    for (const agent of agents) {
      const openCount = await this.db().supportChatThread.count({
        where: {
          tenantId,
          agentId: agent.id,
          status: { in: ['OPEN', 'ASSIGNED', 'WAITING'] },
        },
      });
      if (openCount < (agent.maxConcurrent ?? 5)) return agent;
    }
    return agents[0] ?? null;
  }
}
