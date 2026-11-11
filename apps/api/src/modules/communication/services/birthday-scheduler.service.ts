import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BirthdayWishesService } from './birthday-wishes.service';

@Injectable()
export class BirthdaySchedulerService {
  constructor(private readonly wishes: BirthdayWishesService) {}

  /** Check every minute and send once, at or after the configured IST time. */
  @Cron('* * * * *', { timeZone: 'Asia/Kolkata' })
  async runDailyBirthdayScan() {
    await this.wishes.runDueAutomations();
  }
}
