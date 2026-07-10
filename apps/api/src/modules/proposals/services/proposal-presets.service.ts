import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateProposalPresetDto,
  UpdateProposalPresetDto,
} from '../dto/proposal.dto';

@Injectable()
export class ProposalPresetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenantId: string;
        name: string;
        data: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", name, data AS "data", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM public.proposal_presets
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC
    `);
    return rows;
  }

  async create(tenantId: string, dto: CreateProposalPresetDto) {
    await this.ensureTable();
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenantId: string;
        name: string;
        data: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      INSERT INTO public.proposal_presets (id, tenant_id, name, data)
      VALUES (${id}::uuid, ${tenantId}::uuid, ${dto.name}, ${JSON.stringify(dto.data)}::jsonb)
      RETURNING id, tenant_id AS "tenantId", name, data, created_at AS "createdAt", updated_at AS "updatedAt"
    `);
    return rows[0];
  }

  async update(tenantId: string, id: string, dto: UpdateProposalPresetDto) {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenantId: string;
        name: string;
        data: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      UPDATE public.proposal_presets
      SET
        name = COALESCE(${dto.name ?? null}, name),
        data = COALESCE(${dto.data ? JSON.stringify(dto.data) : null}::jsonb, data),
        updated_at = now()
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING id, tenant_id AS "tenantId", name, data, created_at AS "createdAt", updated_at AS "updatedAt"
    `);
    if (!rows[0]) throw new NotFoundException('Proposal preset not found');
    return rows[0];
  }

  async remove(tenantId: string, id: string) {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      DELETE FROM public.proposal_presets
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING id
    `);
    if (!rows[0]) throw new NotFoundException('Proposal preset not found');
    return { success: true };
  }

  private async ensureTable() {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS public.proposal_presets (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL,
        name text NOT NULL,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS proposal_presets_tenant_id_idx
      ON public.proposal_presets (tenant_id)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS proposal_presets_tenant_name_uidx
      ON public.proposal_presets (tenant_id, name)
    `);
  }
}
