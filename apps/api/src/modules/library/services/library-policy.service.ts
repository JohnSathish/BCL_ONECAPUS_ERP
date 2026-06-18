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
    return 'student';
  }

  resolveLoanDays(
    policy: CirculationPolicy,
    memberType: string,
    categoryCode?: string | null,
  ): number {
    const code = categoryCode?.toUpperCase() ?? '';
    if (code === 'REFERENCE' || code.includes('REFERENCE')) {
      return policy.reference.allowIssue ? policy.reference.loanDays : 0;
    }
    if (code === 'RARE' || code.includes('RARE')) {
      return policy.rare.allowIssue ? policy.rare.loanDays : 0;
    }
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('loanDays' in rolePolicy) return rolePolicy.loanDays;
    return 14;
  }

  resolveMaxBooks(policy: CirculationPolicy, memberType: string): number {
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('maxBooks' in rolePolicy) return rolePolicy.maxBooks;
    return 3;
  }

  resolveMaxRenewals(
    policy: CirculationPolicy,
    memberType: string,
    settingsMaxRenewals: number,
  ): number {
    const role = this.memberRoleKey(memberType);
    const rolePolicy = policy[role];
    if ('maxRenewals' in rolePolicy && rolePolicy.maxRenewals > 0) {
      return rolePolicy.maxRenewals;
    }
    return settingsMaxRenewals;
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

    const maxBooks = this.resolveMaxBooks(policy, profile.memberType);
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
