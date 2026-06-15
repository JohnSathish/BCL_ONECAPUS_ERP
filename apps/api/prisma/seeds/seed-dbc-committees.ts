import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
  academicYearLabel,
} from '../../src/modules/governance/constants/governance.constants';

type SeedMember = {
  displayName: string;
  role: string;
  designation?: string;
  isExternal?: boolean;
};

type SeedCommittee = {
  name: string;
  shortCode: string;
  committeeType: string;
  category: string;
  description?: string;
  exOfficioMembers?: SeedMember[];
};

type SeedPayload = {
  academicYear?: string;
  committees: SeedCommittee[];
};

export async function seedDbcCommittees(
  prisma: PrismaClient,
  tenantId: string,
  createdById?: string,
) {
  const db = prisma as unknown as Record<string, any>;
  const filePath = join(__dirname, 'dbc-committees.json');
  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as SeedPayload;
  const academicYear = payload.academicYear ?? academicYearLabel();

  await db.governanceSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      defaultAcademicYear: academicYear,
      noticePrefix: 'DBC/CIRC',
      performanceWeights: DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
    },
    update: {
      defaultAcademicYear: academicYear,
    },
  });

  let committeeCount = 0;
  let memberCount = 0;

  for (const committee of payload.committees) {
    const row = await db.governanceCommittee.upsert({
      where: {
        tenantId_shortCode: { tenantId, shortCode: committee.shortCode },
      },
      create: {
        tenantId,
        name: committee.name,
        shortCode: committee.shortCode,
        committeeType: committee.committeeType,
        category: committee.category,
        description: committee.description,
        academicYear,
        status: 'ACTIVE',
        metadata: { exOfficioBlock: committee.exOfficioMembers ?? [] },
        createdById,
      },
      update: {
        name: committee.name,
        committeeType: committee.committeeType,
        category: committee.category,
        description: committee.description,
        academicYear,
        status: 'ACTIVE',
        metadata: { exOfficioBlock: committee.exOfficioMembers ?? [] },
      },
    });
    committeeCount += 1;

    for (const member of committee.exOfficioMembers ?? []) {
      const existing = await db.governanceCommitteeMember.findFirst({
        where: {
          tenantId,
          committeeId: row.id,
          displayName: member.displayName,
          role: member.role,
        },
      });
      if (existing) continue;

      await db.governanceCommitteeMember.create({
        data: {
          tenantId,
          committeeId: row.id,
          displayName: member.displayName,
          role: member.role,
          designation: member.designation,
          isExternal: member.isExternal ?? false,
          status: 'ACTIVE',
        },
      });
      memberCount += 1;
    }
  }

  return { committeeCount, memberCount, academicYear };
}
