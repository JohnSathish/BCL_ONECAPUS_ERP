import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { FeeFineEngineService } from './fee-fine-engine.service';
import { FeeSettlementReconciliationService } from './fee-settlement-reconciliation.service';
import { MonthlyFeeEngineService } from './monthly-fee-engine.service';

@Injectable()
export class FeeSchedulerService {
  private readonly logger = new Logger(FeeSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monthly: MonthlyFeeEngineService,
    private readonly fines: FeeFineEngineService,
    private readonly settlementRecon: FeeSettlementReconciliationService,
    private readonly notifications: UserNotificationsService,
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
        const settings = await this.db().feeFinanceSettings.findUnique({
          where: { tenantId: tenant.id },
          select: { studentPortalFeesEnabled: true },
        });
        if (settings?.studentPortalFeesEnabled === false) {
          this.logger.log(
            `Skipping monthly fee generation for tenant=${tenant.id} (student portal fees disabled)`,
          );
          continue;
        }
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
        const settings = await this.db().feeFinanceSettings.findUnique({
          where: { tenantId: tenant.id },
          select: { studentPortalFeesEnabled: true },
        });
        if (settings?.studentPortalFeesEnabled === false) continue;
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

  /** Daily 8:00 AM — notify Finance when settlement recon exceptions remain open. */
  @Cron('0 8 * * *')
  async notifySettlementExceptions() {
    const tenants = await this.db().tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    for (const tenant of tenants) {
      try {
        const count = await this.settlementRecon.countOpenExceptions(tenant.id);
        if (count <= 0) continue;

        const userIds = await this.settlementRecon.findFinanceUserIds(
          tenant.id,
        );
        if (!userIds.length) {
          this.logger.warn(
            `Settlement exceptions=${count} tenant=${tenant.id} but no fees:manage users`,
          );
          continue;
        }

        for (const userId of userIds) {
          await this.notifications.createInApp({
            tenantId: tenant.id,
            userId,
            type: 'FEE_SETTLEMENT_EXCEPTIONS',
            title: 'Fee settlement exceptions need review',
            body: `${count} settlement reconciliation exception(s) are open. Review matches, mismatches, and unsettled ERP payments.`,
            link: '/admin/fees/reconciliation',
            metadata: { exceptionCount: count },
          });
        }
        this.logger.log(
          `Settlement exception notify tenant=${tenant.id} count=${count} users=${userIds.length}`,
        );
      } catch (err) {
        this.logger.error(
          `Settlement exception notify failed for tenant ${tenant.id}`,
          err,
        );
      }
    }
  }
}
