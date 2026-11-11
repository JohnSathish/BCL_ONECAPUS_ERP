import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { patchDemoAccountExclusion } from './exclude-demo-accounts';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private demoExclusionInstalled = false;

  async onModuleInit() {
    this.installDemoExclusion();
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Student and staff list/count queries omit DEMO accounts. A lookup by id,
   * roll number, or employee code still finds them so the demo login works.
   * Interactive transactions get the same filter.
   */
  private installDemoExclusion() {
    if (this.demoExclusionInstalled) return;
    this.demoExclusionInstalled = true;
    patchDemoAccountExclusion(this);
    const original = this.$transaction.bind(this);
    this.$transaction = ((arg: unknown, options?: unknown) => {
      if (typeof arg === 'function') {
        return original(async (tx: object) => {
          patchDemoAccountExclusion(tx);
          return (arg as (tx: object) => Promise<unknown>)(tx);
        }, options as never);
      }
      return original(arg as never, options as never);
    }) as typeof this.$transaction;
  }
}
