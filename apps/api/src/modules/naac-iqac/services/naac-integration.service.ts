import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GovernanceNaacService } from '../../governance/services/governance-naac.service';
import { GovernanceMeetingService } from '../../governance/services/governance-meeting.service';
import { GovernanceAtrService } from '../../governance/services/governance-atr.service';
import { GovernanceCommitteeService } from '../../governance/services/governance-committee.service';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly governanceNaac: GovernanceNaacService,
    private readonly meetings: GovernanceMeetingService,
    private readonly atr: GovernanceAtrService,
    private readonly committees: GovernanceCommitteeService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async iqacSummary(tenantId: string) {
    const [iqacCommittee, naacEvidence, openAtr, recentMeetings] =
      await Promise.all([
        this.committees.list(tenantId, { q: 'IQAC', limit: 5 }),
        this.governanceNaac.evidenceSummary(tenantId),
        this.atr.list(tenantId, { limit: 10 }),
        this.meetings.list(tenantId, { limit: 5 }),
      ]);

    const iqac = (iqacCommittee.items ?? []).find(
      (c: { shortCode?: string; name?: string }) =>
        c.shortCode?.includes('IQAC') || c.name?.toUpperCase().includes('IQAC'),
    );

    return {
      iqacCommittee: iqac ?? null,
      governanceEvidenceByCriterion: naacEvidence,
      openAtrCount: (openAtr.items ?? []).filter(
        (a: { status?: string }) => a.status !== 'CLOSED',
      ).length,
      recentMeetings: recentMeetings.items ?? [],
      links: {
        meetings: '/admin/governance/meetings',
        atr: '/admin/governance/atr',
        committees: '/admin/governance/committees',
      },
    };
  }

  async listMeetings(tenantId: string) {
    return this.meetings.list(tenantId, { limit: 50 });
  }

  async listAtr(tenantId: string) {
    return this.atr.list(tenantId, { limit: 50 });
  }
}
