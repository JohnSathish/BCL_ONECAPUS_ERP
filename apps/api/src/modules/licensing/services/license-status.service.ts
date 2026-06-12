import { Injectable } from '@nestjs/common';
import type {
  LicenseComputed,
  LicenseSeverity,
  LicenseStatus,
  TenantLicenseRow,
} from '../licensing.types';

const MS_PER_DAY = 86_400_000;
const NEAR_EXPIRY_THRESHOLDS = [60, 30, 15, 7];

@Injectable()
export class LicenseStatusService {
  compute(license: TenantLicenseRow, now = new Date()): LicenseComputed {
    if (license.suspendedAt) {
      return {
        status: 'SUSPENDED',
        nearExpiryTier: null,
        daysRemaining: this.daysUntil(license.expiryDate, now),
        blockingDate: this.blockingDate(license),
        progressPercent: this.progress(license, now),
        severity: 'gray',
        isWriteBlocked: true,
      };
    }

    if (!license.expiryDate) {
      return {
        status: 'ACTIVE',
        nearExpiryTier: null,
        daysRemaining: null,
        blockingDate: null,
        progressPercent: 100,
        severity: 'green',
        isWriteBlocked: false,
      };
    }

    const daysRemaining = this.daysUntil(license.expiryDate, now);
    const blocking = this.blockingDate(license);

    if (blocking && now >= blocking) {
      return {
        status: 'EXPIRED',
        nearExpiryTier: 0,
        daysRemaining,
        blockingDate: blocking,
        progressPercent: this.progress(license, now),
        severity: 'red',
        isWriteBlocked: true,
      };
    }

    if (daysRemaining !== null && daysRemaining < 0) {
      return {
        status: 'GRACE_PERIOD',
        nearExpiryTier: 0,
        daysRemaining,
        blockingDate: blocking,
        progressPercent: this.progress(license, now),
        severity: 'red',
        isWriteBlocked: false,
      };
    }

    const tier =
      NEAR_EXPIRY_THRESHOLDS.find(
        (t) => daysRemaining !== null && daysRemaining <= t,
      ) ?? null;
    if (tier !== null) {
      return {
        status: 'NEAR_EXPIRY',
        nearExpiryTier: tier,
        daysRemaining,
        blockingDate: blocking,
        progressPercent: this.progress(license, now),
        severity: this.severity(daysRemaining),
        isWriteBlocked: false,
      };
    }

    return {
      status: 'ACTIVE',
      nearExpiryTier: null,
      daysRemaining,
      blockingDate: blocking,
      progressPercent: this.progress(license, now),
      severity: this.severity(daysRemaining),
      isWriteBlocked: false,
    };
  }

  severity(daysRemaining: number | null): LicenseSeverity {
    if (daysRemaining === null) return 'green';
    if (daysRemaining <= 7) return 'red';
    if (daysRemaining <= 30) return 'orange';
    if (daysRemaining <= 90) return 'yellow';
    return 'green';
  }

  alertMessage(
    status: LicenseStatus,
    daysRemaining: number | null,
  ): string | null {
    if (status === 'SUSPENDED') {
      return 'Your ERP license has been suspended. Please contact BaseCode Labs Pvt. Ltd. immediately.';
    }
    if (status === 'EXPIRED') {
      return 'Your ERP license has expired. Please contact BaseCode Labs Pvt. Ltd. immediately.';
    }
    if (status === 'GRACE_PERIOD') {
      return 'Your ERP license is in grace period. Renewal is required to avoid write restrictions.';
    }
    if (status === 'NEAR_EXPIRY' && daysRemaining !== null) {
      if (daysRemaining <= 7) {
        return `Critical: Your ERP license expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`;
      }
      if (daysRemaining <= 15) {
        return `Urgent: Your ERP license expires in ${daysRemaining} days.`;
      }
      if (daysRemaining <= 30) {
        return `Your ERP license expires in ${daysRemaining} days. Renewal is recommended.`;
      }
      if (daysRemaining <= 60) {
        return `Your ERP license will expire in ${daysRemaining} days. Please renew before expiry.`;
      }
    }
    return null;
  }

  showMarquee(status: LicenseStatus, daysRemaining: number | null): boolean {
    if (
      status === 'SUSPENDED' ||
      status === 'EXPIRED' ||
      status === 'GRACE_PERIOD'
    )
      return true;
    return daysRemaining !== null && daysRemaining <= 15;
  }

  private daysUntil(expiryDate: Date | null, now: Date): number | null {
    if (!expiryDate) return null;
    const end = new Date(expiryDate);
    end.setHours(0, 0, 0, 0);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
  }

  private blockingDate(license: TenantLicenseRow): Date | null {
    if (!license.expiryDate) return null;
    const d = new Date(license.expiryDate);
    d.setDate(d.getDate() + license.gracePeriodDays);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private progress(license: TenantLicenseRow, now: Date): number {
    if (!license.expiryDate) return 100;
    const start = new Date(license.startDate).getTime();
    const end = new Date(license.expiryDate).getTime();
    if (end <= start) return 0;
    const elapsed = Math.min(Math.max(now.getTime() - start, 0), end - start);
    return Math.round((elapsed / (end - start)) * 100);
  }
}
