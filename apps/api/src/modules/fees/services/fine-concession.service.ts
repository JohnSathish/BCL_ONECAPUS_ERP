import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { ConcessionDto, FineRuleDto } from '../dto/fees.dto';
import { FeeLedgerService } from './fee-ledger.service';

@Injectable()
export class FineConcessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  fineRules(tenantId: string) {
    return this.db().feeFineRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createFineRule(user: JwtUser, dto: FineRuleDto) {
    return this.db().feeFineRule.create({
      data: {
        tenantId: user.tid,
        code: dto.code,
        name: dto.name,
        ruleType: dto.ruleType,
        amount: dto.amount,
        graceDays: dto.graceDays ?? 0,
      },
    });
  }

  async requestConcession(user: JwtUser, dto: ConcessionDto) {
    const demand = dto.demandId
      ? await this.db().studentFeeDemand.findFirst({
          where: { tenantId: user.tid, id: dto.demandId },
        })
      : null;
    const approvedAmount = demand
      ? this.calculateConcession(dto, Number(demand.balanceAmount ?? 0))
      : dto.value;
    return this.db().feeConcession.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        demandId: dto.demandId,
        concessionType: dto.concessionType,
        calculationType: dto.calculationType,
        value: dto.value,
        approvedAmount,
        status: 'PENDING',
        reason: dto.reason,
        requestedById: user.sub,
      },
    });
  }

  async approveConcession(user: JwtUser, id: string) {
    const concession = await this.db().feeConcession.findFirst({
      where: { tenantId: user.tid, id },
    });
    const updated = await this.db().feeConcession.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: user.sub,
        approvedAt: new Date(),
      },
    });
    if (concession?.demandId) {
      const demand = await this.db().studentFeeDemand.findFirst({
        where: { id: concession.demandId, tenantId: user.tid },
      });
      const amount = Number(concession.approvedAmount ?? 0);
      await this.db().studentFeeDemand.update({
        where: { id: concession.demandId },
        data: {
          concessionAmount: Number(demand?.concessionAmount ?? 0) + amount,
          balanceAmount: Math.max(
            0,
            Number(demand?.balanceAmount ?? 0) - amount,
          ),
        },
      });
      await this.ledger.post({
        tenantId: user.tid,
        studentId: concession.studentId,
        demandId: concession.demandId,
        concessionId: concession.id,
        entryType: 'CONCESSION',
        creditAmount: amount,
        referenceType: 'CONCESSION',
        referenceId: concession.id,
        description: concession.reason ?? 'Fee concession approved',
        postedById: user.sub,
      });
    }
    return updated;
  }

  private calculateConcession(dto: ConcessionDto, balance: number) {
    if (dto.calculationType === 'FULL_WAIVER') return balance;
    if (dto.calculationType === 'PERCENTAGE')
      return Math.round((balance * dto.value) / 100);
    return Math.min(dto.value, balance);
  }
}
