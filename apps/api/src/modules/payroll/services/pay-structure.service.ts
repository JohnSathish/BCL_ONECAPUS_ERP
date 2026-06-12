import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreatePayStructureDto,
  FormulaPreviewDto,
  PayStructureComponentDto,
  UpdatePayStructureDto,
} from '../dto/payroll.dto';
import {
  FormulaEngineService,
  type ComponentOverride,
  type FormulaNode,
} from './formula-engine.service';

@Injectable()
export class PayStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formula: FormulaEngineService,
  ) {}

  list(tenantId: string, structureType?: string) {
    return this.prisma.payStructureTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(structureType ? { structureType } : {}),
      },
      include: {
        components: {
          include: { paySalaryComponent: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ structureType: 'asc' }, { code: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.payStructureTemplate.findFirst({
      where: { id, tenantId },
      include: {
        components: {
          include: { paySalaryComponent: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Pay structure not found');
    return row;
  }

  async create(tenantId: string, dto: CreatePayStructureDto) {
    const template = await this.prisma.payStructureTemplate.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        structureType: dto.structureType,
        payScaleTypes: dto.payScaleTypes ?? [],
        description: dto.description,
      },
    });
    if (dto.components?.length) {
      await this.saveComponents(tenantId, template.id, dto.components);
    }
    return this.get(tenantId, template.id);
  }

  async saveComponents(
    tenantId: string,
    templateId: string,
    components: PayStructureComponentDto[],
  ) {
    const salaryComponents = await this.prisma.paySalaryComponent.findMany({
      where: { tenantId, deletedAt: null },
    });
    const codeById = new Map(salaryComponents.map((c) => [c.id, c.code]));
    const formulaDefs = components.map((c) => ({
      code: codeById.get(c.paySalaryComponentId) ?? 'UNKNOWN',
      formulaJson: c.formulaJson as FormulaNode,
    }));
    this.formula.detectCircularDependencies(formulaDefs);

    await this.prisma.payStructureComponent.deleteMany({
      where: { payStructureTemplateId: templateId },
    });
    for (const [idx, comp] of components.entries()) {
      await this.prisma.payStructureComponent.create({
        data: {
          tenantId,
          payStructureTemplateId: templateId,
          paySalaryComponentId: comp.paySalaryComponentId,
          formulaJson: comp.formulaJson as object,
          fixedOverride: comp.fixedOverride,
          sortOrder: comp.sortOrder ?? (idx + 1) * 10,
        },
      });
    }
  }

  previewFormula(dto: FormulaPreviewDto) {
    const context = { BASIC: dto.basicPay, ...(dto.context ?? {}) };
    const result = this.formula.evaluate(
      dto.formulaJson as FormulaNode,
      context,
    );
    return { amount: result.amount, trace: result.trace };
  }

  async previewStructure(
    tenantId: string,
    templateId: string,
    basicPay: number,
    componentOverrides?: Record<string, ComponentOverride> | null,
  ) {
    const template = await this.get(tenantId, templateId);
    const components = template.components.map((c) => ({
      code: c.paySalaryComponent.code,
      name: c.paySalaryComponent.name,
      componentType: c.paySalaryComponent.componentType,
      formulaJson: c.formulaJson as FormulaNode,
    }));
    return this.formula.computeAll(
      components,
      basicPay,
      {},
      componentOverrides,
    );
  }

  async update(tenantId: string, id: string, dto: UpdatePayStructureDto) {
    const existing = await this.prisma.payStructureTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Pay structure not found');

    await this.prisma.payStructureTemplate.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });

    if (dto.components?.length) {
      await this.saveComponents(tenantId, id, dto.components);
    }

    return this.get(tenantId, id);
  }
}
