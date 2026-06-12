import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsernameGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    tenantId: string,
    userType: string,
    programmeCode?: string,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.usernameGenerationRule.findFirst({
        where: { tenantId, userType, isActive: true },
      });
      if (!rule) {
        throw new NotFoundException(
          `Username rule not configured for ${userType}`,
        );
      }

      const seq = rule.nextSequence;
      await tx.usernameGenerationRule.update({
        where: { id: rule.id },
        data: { nextSequence: seq + 1 },
      });

      const year = rule.includeYear ? String(new Date().getFullYear()) : '';
      const prefix = programmeCode?.trim() || rule.prefix;
      const padded = String(seq).padStart(rule.zeroPadding, '0');
      return `${prefix}${year}${padded}${rule.suffix}`;
    });
  }

  async listRules(tenantId: string) {
    return this.prisma.usernameGenerationRule.findMany({
      where: { tenantId },
      orderBy: { userType: 'asc' },
    });
  }
}
