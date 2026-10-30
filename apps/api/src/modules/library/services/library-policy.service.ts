import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { LibraryMemberProfile } from './library-member-lookup.service';
import {
  mergeCirculationPolicy,
  mergeFinePolicy,
  type CirculationPolicy,
  type FinePolicy,
} from '../domain/library-policy.types';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
  ) {}

  async getPolicies(tenantId: string) {
    const s = await this.settings.getSettings(tenantId);
    return {
      circulation: mergeCirculationPolicy(s.circulationPolicy),
      fine: mergeFinePolicy(s.finePolicy),
    };
  }

  memberRoleKey(memberType: string): keyof CirculationPolicy {
    if (memberType === 'FACULTY') return 'faculty';
    if (memberType === 'STAFF') return 'staff';
    if (memberType === 'RESEARCH_SCHOLAR') return 'researchScholar';
    return 'student';
  }

  resolveLoanDays(
    policy: CirculationPolicy,
    memberType: string,
    categoryCode?: string | null,
    overrideDays?: number | null,
  ): number {
    const code = categoryCode?.toUpperCase() ?? '';
    if (code === 'REFERENCE' || code.includes('REFERENCE')) {
      return policy.reference.allowIssue ? policy.reference.loanDays : 0;
    }
    if (code === 'RARE' || code.includes('RARE')) {
      return policy.rare.allowIssue ? policy.rare.loanDays : 0;
    }
    if (overrideDays != null) return overrideDays;
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('loanDays' in rolePolicy) return rolePolicy.loanDays;
    return 14;
  }

  resolveMaxBooks(
    policy: CirculationPolicy,
    memberType: string,
    overrideBooks?: number | null,
  ): number {
    if (overrideBooks != null) return overrideBooks;
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('maxBooks' in rolePolicy) return rolePolicy.maxBooks;
    return 3;
  }

  resolveMaxRenewals(
    policy: CirculationPolicy,
    memberType: string,
    settingsMaxRenewals: number,
    overrideRenewals?: number | null,
  ): number {
    if (overrideRenewals != null) return overrideRenewals;
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('maxRenewals' in rolePolicy && rolePolicy.maxRenewals > 0) {
      return rolePolicy.maxRenewals;
    }
    return settingsMaxRenewals;
  }

  async loadBorrowRules(
    tenantId: string,
    person: { studentId?: string | null; staffProfileId?: string | null },
  ) {
    const membership = person.studentId
      ? await this.prisma.libraryMembership.findFirst({
          where: { tenantId, studentId: person.studentId },
        })
      : person.staffProfileId
        ? await this.prisma.libraryMembership.findFirst({
            where: { tenantId, staffProfileId: person.staffProfileId },
          })
        : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expires = membership?.expiresAt
      ? new Date(membership.expiresAt)
      : null;
    if (expires) expires.setHours(0, 0, 0, 0);
    return {
      blocked: membership?.status === 'BLOCKED',
      blockReason: membership?.blockReason ?? null,
      expired: Boolean(expires && expires < today),
      fineExempt: membership?.fineExempt ?? false,
      loanLimit: membership?.loanLimit ?? null,
      loanDays: membership?.loanDays ?? null,
      maxRenewals: membership?.maxRenewals ?? null,
    };
  }

  assertCanBorrow(rules: {
    blocked: boolean;
    blockReason: string | null;
    expired: boolean;
  }) {
    if (rules.blocked) {
      throw new BadRequestException(
        rules.blockReason
          ? `Borrowing is blocked: ${rules.blockReason.replaceAll('_', ' ').toLowerCase()}.`
          : 'Borrowing is blocked for this member.',
      );
    }
    if (rules.expired) {
      throw new BadRequestException('This library membership has expired.');
    }
  }

  async validateIssue(
    tenantId: string,
    profile: LibraryMemberProfile,
    categoryCode?: string | null,
  ) {
    const s = await this.settings.getSettings(tenantId);
    const policy = mergeCirculationPolicy(s.circulationPolicy);
    const code = categoryCode?.toUpperCase() ?? '';

    if (code === 'REFERENCE' || code.includes('REFERENCE')) {
      if (!policy.reference.allowIssue) {
        throw new BadRequestException('Reference books cannot be issued');
      }
    }
    if (code === 'RARE' || code.includes('RARE')) {
      if (!policy.rare.allowIssue) {
        throw new BadRequestException('Rare books cannot be issued from desk');
      }
    }

    const rules = await this.loadBorrowRules(tenantId, profile);
    this.assertCanBorrow(rules);
    const maxBooks = this.resolveMaxBooks(
      policy,
      profile.memberType,
      rules.loanLimit,
    );
    const activeCount = await this.countActiveLoans(tenantId, profile);
    if (activeCount >= maxBooks) {
      throw new BadRequestException(
        `Issue limit reached (${maxBooks} books). Return a book before borrowing more.`,
      );
    }
  }

  async countActiveLoans(
    tenantId: string,
    profile: LibraryMemberProfile,
  ): Promise<number> {
    return this.prisma.libraryLoan.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(profile.studentId ? { studentId: profile.studentId } : {}),
        ...(profile.staffProfileId
          ? { staffProfileId: profile.staffProfileId }
          : {}),
      },
    });
  }

  computeDueDate(loanDays: number, from = new Date()): Date {
    const due = new Date(from);
    due.setDate(due.getDate() + loanDays);
    return due;
  }

  formatBookLocation(book: {
    rack?: string | null;
    shelf?: string | null;
    section?: string | null;
    row?: string | null;
    location?: string | null;
  }): string | null {
    const parts = [
      book.section,
      book.rack ? `Rack ${book.rack}` : null,
      book.shelf ? `Shelf ${book.shelf}` : null,
      book.row ? `Row ${book.row}` : null,
      book.location,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
}

export type { CirculationPolicy, FinePolicy };
