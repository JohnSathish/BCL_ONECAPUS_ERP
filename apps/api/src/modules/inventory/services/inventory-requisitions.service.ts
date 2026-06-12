import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  ApproveRequisitionDto,
  ConvertRequisitionDto,
  CreateRequisitionDto,
  ListQueryDto,
} from '../dto/inventory.dto';
import {
  nextInventoryPoNumber,
  nextInventoryRequisitionNumber,
} from '../utils/inventory-barcode';

@Injectable()
export class InventoryRequisitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    return this.prisma.inventoryRequisition.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? { department: { contains: query.q, mode: 'insensitive' } }
          : {}),
      },
      include: {
        _count: { select: { lines: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.inventoryRequisition.findFirst({
      where: { tenantId, id },
      include: {
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                quantityOnHand: true,
              },
            },
          },
        },
        purchaseOrder: true,
      },
    });
    if (!row) throw new NotFoundException('Requisition not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateRequisitionDto) {
    if (!dto.lines?.length)
      throw new BadRequestException('At least one line is required');

    for (const line of dto.lines) {
      const item = await this.prisma.inventoryItem.findFirst({
        where: { tenantId: user.tid, id: line.itemId, status: 'ACTIVE' },
      });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);
    }

    const requisitionNo = await nextInventoryRequisitionNumber(
      this.prisma,
      user.tid,
    );

    return this.prisma.inventoryRequisition.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        requisitionNo,
        department: dto.department.trim(),
        requestedByName: dto.requestedByName?.trim(),
        notes: dto.notes?.trim(),
        lines: {
          create: dto.lines.map((line) => ({
            id: randomUUID(),
            tenantId: user.tid,
            itemId: line.itemId,
            quantityRequested: line.quantityRequested,
            notes: line.notes?.trim(),
          })),
        },
      },
      include: { lines: { include: { item: true } } },
    });
  }

  async submit(user: JwtUser, id: string) {
    const req = await this.get(user.tid, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only draft requisitions can be submitted');

    return this.prisma.inventoryRequisition.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { lines: { include: { item: true } } },
    });
  }

  async approve(user: JwtUser, id: string, dto: ApproveRequisitionDto) {
    const req = await this.get(user.tid, id);
    if (req.status !== 'SUBMITTED')
      throw new BadRequestException('Requisition must be submitted');

    for (const line of req.lines) {
      const override = dto.lines?.find((l) => l.lineId === line.id);
      const approved = override?.quantityApproved ?? line.quantityRequested;
      await this.prisma.inventoryRequisitionLine.update({
        where: { id: line.id },
        data: { quantityApproved: approved },
      });
    }

    return this.prisma.inventoryRequisition.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: user.sub,
        approvedAt: new Date(),
      },
      include: { lines: { include: { item: true } } },
    });
  }

  async reject(user: JwtUser, id: string) {
    const req = await this.get(user.tid, id);
    if (!['SUBMITTED', 'APPROVED'].includes(req.status)) {
      throw new BadRequestException('Requisition cannot be rejected');
    }

    return this.prisma.inventoryRequisition.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  async convertToPo(user: JwtUser, id: string, dto: ConvertRequisitionDto) {
    const req = await this.get(user.tid, id);
    if (req.status !== 'APPROVED')
      throw new BadRequestException('Requisition must be approved');
    if (req.purchaseOrderId)
      throw new BadRequestException('Already converted to PO');

    const vendor = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, id: dto.vendorId, status: 'ACTIVE' },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const poNumber = await nextInventoryPoNumber(this.prisma, user.tid);
    let totalAmount = new Prisma.Decimal(0);

    const linesData = await Promise.all(
      req.lines.map(async (line) => {
        const qty = line.quantityApproved ?? line.quantityRequested;
        const priceRow = await this.prisma.inventoryVendorPrice.findFirst({
          where: {
            tenantId: user.tid,
            vendorId: dto.vendorId,
            itemId: line.itemId,
            status: 'ACTIVE',
          },
        });
        const unitPrice = priceRow?.unitPrice ?? null;
        if (unitPrice) totalAmount = totalAmount.add(unitPrice.mul(qty));

        return {
          id: randomUUID(),
          tenantId: user.tid,
          itemId: line.itemId,
          description: line.item.name,
          sku: line.item.sku,
          quantityOrdered: qty,
          unitPrice,
        };
      }),
    );

    const po = await this.prisma.inventoryPurchaseOrder.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        poNumber,
        vendorId: dto.vendorId,
        storeId: dto.storeId,
        notes: dto.notes?.trim() ?? `From requisition ${req.requisitionNo}`,
        totalAmount: totalAmount.gt(0) ? totalAmount : undefined,
        createdById: user.sub,
        status: 'DRAFT',
        lines: { create: linesData },
      },
    });

    return this.prisma.inventoryRequisition.update({
      where: { id },
      data: { status: 'CONVERTED', purchaseOrderId: po.id },
      include: {
        lines: { include: { item: true } },
        purchaseOrder: { include: { vendor: true, lines: true } },
      },
    });
  }
}
