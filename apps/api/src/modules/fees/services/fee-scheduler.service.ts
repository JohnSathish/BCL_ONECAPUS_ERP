import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { FeeFineEngineService } from './fee-fine-engine.service';
import { MonthlyFeeEngineService } from './monthly-fee-engine.service';

@Injectable()
export class FeeSchedulerService {
  private readonly logger = new Logger(FeeSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monthly: MonthlyFeeEngineService,
    private readonly fines: FeeFineEngineService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  @Cron('0 0 1 * *')
  async generateMonthlyDemands() {
    const tenants = await this.db().tenant.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const tenant of tenants) {
      try {
        const result = await this.monthly.generateBulk(tenant.id);
        this.logger.log(
          `Monthly fees ${result.billingPeriod} tenant=${tenant.id}: created=${result.created} skipped=${result.skipped}`,
        );
      } catch (err) {
        this.logger.error(
          `Monthly fee generation failed for tenant ${tenant.id}`,
          err,
        );
      }
    }
  }

  @Cron('0 6 * * *')
  async accrueLateFees() {
    const tenants = await this.db().tenant.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const tenant of tenants) {
      try {
        const result = await this.fines.accrueForTenant(tenant.id);
        if (result.updated > 0) {
          this.logger.log(
            `Late fees tenant=${tenant.id}: updated=${result.updated}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Late fee accrual failed for tenant ${tenant.id}`,
          err,
        );
      }
    }
  }
}
