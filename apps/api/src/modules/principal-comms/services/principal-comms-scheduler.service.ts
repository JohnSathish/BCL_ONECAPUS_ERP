import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrincipalCommsSyncService } from './principal-comms-sync.service';

@Injectable()
export class PrincipalCommsSchedulerService {
  private readonly logger = new Logger(PrincipalCommsSchedulerService.name);

  constructor(private readonly sync: PrincipalCommsSyncService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollMailboxes() {
    try {
      await this.sync.syncAllActiveAccounts();
    } catch (err) {
      this.logger.warn(`Principal mail poll failed: ${(err as Error).message}`);
    }
  }
}
