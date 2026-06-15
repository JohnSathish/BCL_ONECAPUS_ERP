import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MAPPING_SOURCE } from '../domain/category-pools';
import {
  isSharedPoolOffering,
  resolveSharedPoolSectionCapacity,
  resolveTenantSharedPoolCapacity,
  SHARED_POOL_CAPACITY_CATEGORIES,
} from '../domain/section-capacity';
import { LmsWorkspaceService } from '../../lms/services/lms-workspace.service';

export type ProvisionPoolSectionsOptions = {
  semesterNo?: number;
  categories?: string[];
  shiftCode?: string;
  institutionId?: string;
  poolId?: string;
};

export type ProvisionPoolSectionsResult = {
  created: number;
  skipped: number;
  total: number;
  shiftCode: string;
  details: Array<{ offeringId: string; courseCode: string; created: boolean }>;
};

@Injectable()
export class PoolSectionProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lmsWorkspaces?: LmsWorkspaceService,
  ) {}

  async resolveDefaultShiftId(
    tenantId: string,
    shiftCode = 'DAY',
  ): Promise<string> {
    const normalized = shiftCode.trim().toUpperCase();
    const shift = await this.prisma.shift.findFirst({
      where: { tenantId, deletedAt: null, code: normalized },
      orderBy: { sortOrder: 'asc' },
    });
    if (shift) return shift.id;

    const fallback = await this.prisma.shift.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    if (!fallback) {
      throw new BadRequestException(
        'No academic shifts configured. Create a Day shift first.',
      );
    }
    return fallback.id;
  }

  async ensureDefaultSection(
    tenantId: string,
    offeringId: string,
    opts?: {
      shiftId?: string;
      shiftCode?: string;
      sectionCode?: string;
      capacity?: number;
      waitlistCapacity?: number;
    },
  ): Promise<{ created: boolean; sectionId: string }> {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: offeringId, tenantId, deletedAt: null },
    });
    if (!offering) throw new NotFoundException('Offering not found');

    const shiftId =
      opts?.shiftId ??
      (await this.resolveDefaultShiftId(tenantId, opts?.shiftCode ?? 'DAY'));
    const sectionCode = (opts?.sectionCode ?? 'A').trim().toUpperCase();

    const existing = await this.prisma.offeringSection.findFirst({
      where: {
        courseOfferingId: offeringId,
        shiftId,
        sectionCode,
        deletedAt: null,
        status: 'active',
      },
    });
    if (existing) return { created: false, sectionId: existing.id };

    const tenantDefaultCapacity = await resolveTenantSharedPoolCapacity(
      this.prisma,
      tenantId,
    );
    const capacity = isSharedPoolOffering(offering)
      ? resolveSharedPoolSectionCapacity({
          explicitCapacity: opts?.capacity,
          offeringCapacity: offering.capacity,
          tenantDefaultCapacity,
        })
      : (opts?.capacity ?? offering.capacity ?? 80);

    const section = await this.prisma.offeringSection.create({
      data: {
        tenantId,
        courseOfferingId: offeringId,
        shiftId,
        sectionCode,
        capacity,
        waitlistCapacity:
          opts?.waitlistCapacity ?? offering.waitlistCapacity ?? 10,
        status: 'active',
      },
    });

    await this.prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: { tenantId, offeringSectionId: section.id },
      update: {},
    });

    void this.lmsWorkspaces?.provisionSectionWorkspace(tenantId, section.id);
    void this.lmsWorkspaces?.provisionPoolWorkspace(tenantId, offeringId);

    return { created: true, sectionId: section.id };
  }

  async provisionPoolOfferings(
    tenantId: string,
    filters: ProvisionPoolSectionsOptions = {},
  ): Promise<ProvisionPoolSectionsResult> {
    const categories = (
      filters.categories ?? [...SHARED_POOL_CAPACITY_CATEGORIES]
    ).map((c) => c.trim().toUpperCase());
    const shiftCode = (filters.shiftCode ?? 'DAY').trim().toUpperCase();
    const shiftId = await this.resolveDefaultShiftId(tenantId, shiftCode);

    const poolWhere: Prisma.CategoryPoolWhereInput = {
      tenantId,
      active: true,
      categoryType: { in: categories },
      ...(filters.semesterNo != null ? { semesterNo: filters.semesterNo } : {}),
      ...(filters.institutionId
        ? { institutionId: filters.institutionId }
        : {}),
      ...(filters.poolId ? { id: filters.poolId } : {}),
    };

    const pools = await this.prisma.categoryPool.findMany({
      where: poolWhere,
      select: { id: true },
    });
    const poolIds = pools.map((p) => p.id);
    if (!poolIds.length) {
      return { created: 0, skipped: 0, total: 0, shiftCode, details: [] };
    }

    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        mappingSource: MAPPING_SOURCE.SHARED_POOL,
        categoryPoolId: { in: poolIds },
        ...(filters.semesterNo != null
          ? { semesterSequence: filters.semesterNo }
          : {}),
      },
      include: { course: { select: { code: true } } },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    });

    let created = 0;
    let skipped = 0;
    const details: ProvisionPoolSectionsResult['details'] = [];

    for (const offering of offerings) {
      const result = await this.ensureDefaultSection(tenantId, offering.id, {
        shiftId,
        sectionCode: 'A',
      });
      if (result.created) created += 1;
      else skipped += 1;
      details.push({
        offeringId: offering.id,
        courseCode: offering.course.code,
        created: result.created,
      });
    }

    return {
      created,
      skipped,
      total: offerings.length,
      shiftCode,
      details,
    };
  }
}
