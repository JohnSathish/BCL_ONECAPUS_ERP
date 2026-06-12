import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCoPoMapDto,
  CreateCourseOutcomeDto,
  CreateProgramOutcomeDto,
  RunAttainmentDto,
} from './dto/obe.dto';

@Injectable()
export class ObeService {
  constructor(private readonly prisma: PrismaService) {}

  listProgramOutcomes(tenantId: string, programVersionId: string) {
    return this.prisma.programOutcome.findMany({
      where: { tenantId, programVersionId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  createProgramOutcome(tenantId: string, dto: CreateProgramOutcomeDto) {
    return this.prisma.programOutcome.create({
      data: {
        tenantId,
        programVersionId: dto.programVersionId,
        code: dto.code,
        title: dto.title,
        description: dto.description,
        bloomLevel: dto.bloomLevel,
      },
    });
  }

  listCourseOutcomes(tenantId: string, courseId: string) {
    return this.prisma.courseOutcome.findMany({
      where: { tenantId, courseId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  createCourseOutcome(tenantId: string, dto: CreateCourseOutcomeDto) {
    return this.prisma.courseOutcome.create({
      data: {
        tenantId,
        courseId: dto.courseId,
        code: dto.code,
        title: dto.title,
        bloomLevel: dto.bloomLevel,
      },
    });
  }

  listMappings(tenantId: string, programVersionId?: string) {
    return this.prisma.coPoMap.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(programVersionId ? { programOutcome: { programVersionId } } : {}),
      },
      include: { courseOutcome: true, programOutcome: true },
    });
  }

  createMapping(tenantId: string, dto: CreateCoPoMapDto) {
    return this.prisma.coPoMap.create({
      data: {
        tenantId,
        courseOutcomeId: dto.courseOutcomeId,
        programOutcomeId: dto.programOutcomeId,
        weight: dto.weight,
      },
      include: { courseOutcome: true, programOutcome: true },
    });
  }

  async runAttainment(tenantId: string, dto: RunAttainmentDto) {
    const mappings = await this.listMappings(tenantId, dto.programVersionId);
    const poCount = new Set(mappings.map((m) => m.programOutcomeId)).size;
    const coCount = new Set(mappings.map((m) => m.courseOutcomeId)).size;

    const results = {
      programVersionId: dto.programVersionId,
      mappedPairs: mappings.length,
      programOutcomes: poCount,
      courseOutcomes: coCount,
      attainment: mappings.map((m) => ({
        co: m.courseOutcome.code,
        po: m.programOutcome.code,
        weight: m.weight ? Number(m.weight) : 1,
        attainmentPercent: 72.5,
      })),
      note: 'MVP placeholder — wire assessment data for NBA-grade attainment',
    };

    return this.prisma.outcomeAttainmentRun.create({
      data: {
        tenantId,
        programVersionId: dto.programVersionId,
        label: dto.label ?? `run-${Date.now()}`,
        parameters: { engine: 'mvp-v1' },
        results,
        status: 'completed',
      },
    });
  }

  listAttainmentRuns(tenantId: string, programVersionId: string) {
    return this.prisma.outcomeAttainmentRun.findMany({
      where: { tenantId, programVersionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
