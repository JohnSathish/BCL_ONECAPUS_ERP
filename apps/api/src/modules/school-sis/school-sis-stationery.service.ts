import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisAccountsPostingService } from './school-sis-accounts.posting.service';
import {
  STATIONERY_CATEGORY_SEED,
  STATIONERY_STARTER_PRICES,
} from './school-sis-stationery.catalog';
import type {
  AdjustStationeryStockDto,
  CompleteStationerySaleDto,
  CreateStationeryPurchaseDto,
  CreateStationeryReturnDto,
  ImportStationeryProductsDto,
  SaveStationeryCategoryDto,
  SaveStationeryProductDto,
  SaveStationerySettingsDto,
  SaveStationerySupplierDto,
} from './dto/school-stationery.dto';

export type StationeryActor = {
  userId: string;
  name: string;
  manage: boolean;
  cashier: boolean;
  admin: boolean;
  ip?: string;
};

const OPEN_SALE = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
] as const;

function n(v: Prisma.Decimal | number | string | null | undefined) {
  return Number(v ?? 0);
}

function jsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (Prisma.Decimal.isDecimal(v)) return Number(v);
      if (typeof v === 'bigint') return Number(v);
      return v;
    }),
  );
}

function money(v: number) {
  return Math.round(v);
}

function slugCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

@Injectable()
export class SchoolSisStationeryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly accounts: SchoolSisAccountsPostingService,
  ) {}

  private async year(tenantId: string) {
    return this.sis.currentYear(tenantId);
  }

  private async audit(
    tenantId: string,
    actor: StationeryActor,
    action: string,
    recordId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.schoolStationeryAuditLog.create({
      data: {
        tenantId,
        userId: actor.userId,
        action,
        recordId: recordId ?? null,
        oldValue: jsonSafe(oldValue),
        newValue: jsonSafe(newValue),
        ip: actor.ip ?? null,
      },
    });
  }

  private schemaPatched = false;

  /** Idempotent catch-up when the API image is ahead of `prisma migrate deploy`. */
  private async patchMissingColumns() {
    if (this.schemaPatched) return;
    const statements = [
      `ALTER TABLE "school"."school_stationery_sales" ADD COLUMN IF NOT EXISTS "cash_received" INTEGER`,
      `ALTER TABLE "school"."school_stationery_sales" ADD COLUMN IF NOT EXISTS "change_returned" INTEGER`,
      `ALTER TABLE "school"."school_stationery_sales" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "school_stationery_sales_tenant_id_idempotency_key_key" ON "school"."school_stationery_sales"("tenant_id", "idempotency_key")`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "subcategory_id" UUID`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "grade_id" UUID`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "academic_year_id" UUID`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "opening_stock" DECIMAL(14,3) NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "purchase_price" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "selling_price" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "tax_applicable" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "tax_percent" DECIMAL(6,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "discount_allowed" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "brand" TEXT`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "description" TEXT`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "barcode" TEXT`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "image_url" TEXT`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "remarks" TEXT`,
      `ALTER TABLE "school"."school_stationery_products" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`,
      `CREATE TABLE IF NOT EXISTS "school"."school_stationery_product_variants" (
        "id" UUID NOT NULL,
        "tenant_id" UUID NOT NULL,
        "product_id" UUID NOT NULL,
        "sku" TEXT NOT NULL,
        "barcode" TEXT,
        "label" TEXT NOT NULL,
        "size" TEXT,
        "gender" TEXT,
        "colour" TEXT,
        "house" TEXT,
        "academic_year" TEXT,
        "purchase_price" INTEGER,
        "selling_price" INTEGER,
        "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
        "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP(3),
        CONSTRAINT "school_stationery_product_variants_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "school_stationery_product_variants_tenant_id_sku_key" ON "school"."school_stationery_product_variants"("tenant_id", "sku")`,
      `CREATE INDEX IF NOT EXISTS "school_stationery_product_variants_tenant_id_product_id_idx" ON "school"."school_stationery_product_variants"("tenant_id", "product_id")`,
      `ALTER TABLE "school"."school_stationery_product_variants" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`,
      `ALTER TABLE "school"."school_stationery_product_variants" ADD COLUMN IF NOT EXISTS "purchase_price" INTEGER`,
      `ALTER TABLE "school"."school_stationery_product_variants" ADD COLUMN IF NOT EXISTS "selling_price" INTEGER`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch {
        /* Table may not exist until the full stationery migration has run. */
      }
    }
    this.schemaPatched = true;
  }

  private async productsForSale(tenantId: string, productIds: string[]) {
    type WithVariants = Prisma.SchoolStationeryProductGetPayload<{
      include: { variants: true };
    }>;
    const load = (withVariants: boolean) =>
      this.prisma.schoolStationeryProduct.findMany({
        where: { tenantId, id: { in: productIds }, deletedAt: null },
        include: withVariants ? { variants: true } : undefined,
      });
    try {
      return (await load(true)) as WithVariants[];
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        (err.code !== 'P2022' && err.code !== 'P2021')
      ) {
        throw err;
      }
      this.schemaPatched = false;
      await this.patchMissingColumns();
      try {
        return (await load(true)) as WithVariants[];
      } catch {
        const rows = await load(false);
        return rows.map((p) => ({ ...p, variants: [] })) as WithVariants[];
      }
    }
  }

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.patchMissingColumns();
    const existing = await this.prisma.schoolStationeryCategory.count({
      where: { tenantId, deletedAt: null },
    });
    if (existing === 0) {
      let sort = 0;
      for (const cat of STATIONERY_CATEGORY_SEED) {
        const parentId = randomUUID();
        await this.prisma.schoolStationeryCategory.create({
          data: {
            id: parentId,
            tenantId,
            code: cat.code,
            name: cat.name,
            sortOrder: sort++,
          },
        });
        let childSort = 0;
        for (const child of cat.children) {
          await this.prisma.schoolStationeryCategory.create({
            data: {
              tenantId,
              parentId,
              code: `${cat.code}_${child.code}`,
              name: child.name,
              sortOrder: childSort++,
            },
          });
        }
      }
    }
    await this.prisma.schoolStationerySettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
    await this.ensureStarterProducts(tenantId);
  }

  private async ensureStarterProducts(tenantId: string) {
    const productCount = await this.prisma.schoolStationeryProduct.count({
      where: { tenantId, deletedAt: null },
    });
    if (productCount > 0) return;
    const categories = await this.prisma.schoolStationeryCategory.findMany({
      where: { tenantId, deletedAt: null },
    });
    const parents = categories.filter((c) => !c.parentId);
    for (const parent of parents) {
      const prices = STATIONERY_STARTER_PRICES[parent.code] ?? {
        purchase: 20,
        sell: 30,
      };
      const children = categories.filter((c) => c.parentId === parent.id);
      for (const child of children) {
        const created = await this.prisma.schoolStationeryProduct.create({
          data: {
            tenantId,
            name: child.name,
            sku: child.code.slice(0, 40),
            categoryId: parent.id,
            subcategoryId: child.id,
            unit: 'PIECE',
            purchasePrice: prices.purchase,
            sellingPrice: prices.sell,
            minStock: 10,
            openingStock: 50,
            qtyOnHand: 50,
            remarks: 'Starter catalog item — update price and stock as needed.',
          },
        });
        await this.prisma.schoolStationeryStockMovement.create({
          data: {
            tenantId,
            productId: created.id,
            type: 'OPENING',
            qty: 50,
            qtyBefore: 0,
            qtyAfter: 50,
            reason: 'Starter catalog',
            userId: tenantId,
          },
        });
      }
    }
  }

  async getSettings(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolStationerySettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async saveSettings(
    tenantId: string,
    dto: SaveStationerySettingsDto,
    actor: StationeryActor,
  ) {
    if (!actor.manage)
      throw new BadRequestException(
        'Not allowed to change stationery settings',
      );
    const before = await this.getSettings(tenantId);
    const row = await this.prisma.schoolStationerySettings.update({
      where: { tenantId },
      data: {
        enabled: dto.enabled ?? before.enabled,
        invoicePrefix: dto.invoicePrefix?.trim() || before.invoicePrefix,
        startingNumber: dto.startingNumber ?? before.startingNumber,
        defaultPaymentMethod:
          dto.defaultPaymentMethod ?? before.defaultPaymentMethod,
        allowWalkInSales: dto.allowWalkInSales ?? before.allowWalkInSales,
        allowCreditSales: dto.allowCreditSales ?? before.allowCreditSales,
        allowNegativeStock: dto.allowNegativeStock ?? before.allowNegativeStock,
        defaultTaxPercent: dto.defaultTaxPercent ?? before.defaultTaxPercent,
        defaultDiscountPercent:
          dto.defaultDiscountPercent ?? before.defaultDiscountPercent,
        cashierMaxDiscountPercent:
          dto.cashierMaxDiscountPercent ?? before.cashierMaxDiscountPercent,
        managerMaxDiscountPercent:
          dto.managerMaxDiscountPercent ?? before.managerMaxDiscountPercent,
        lowStockAlert: dto.lowStockAlert ?? before.lowStockAlert,
        receiptFormat: dto.receiptFormat ?? before.receiptFormat,
        requireStudentSelection:
          dto.requireStudentSelection ?? before.requireStudentSelection,
        enableBarcode: dto.enableBarcode ?? before.enableBarcode,
        enableProductImages:
          dto.enableProductImages ?? before.enableProductImages,
        enableStockTracking:
          dto.enableStockTracking ?? before.enableStockTracking,
      },
    });
    await this.audit(tenantId, actor, 'SETTINGS_UPDATED', row.id, before, row);
    return row;
  }

  async listCategories(tenantId: string) {
    await this.ensureSetup(tenantId);
    const rows = await this.prisma.schoolStationeryCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const parents = rows.filter((r) => !r.parentId);
    return parents.map((p) => ({
      ...p,
      children: rows.filter((c) => c.parentId === p.id),
    }));
  }

  async saveCategory(
    tenantId: string,
    dto: SaveStationeryCategoryDto,
    actor: StationeryActor,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to manage categories');
    const code = slugCode(dto.code);
    const row = await this.prisma.schoolStationeryCategory.create({
      data: {
        tenantId,
        parentId: dto.parentId || null,
        code,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 99,
        active: dto.active ?? true,
      },
    });
    await this.audit(tenantId, actor, 'CATEGORY_CREATED', row.id, null, row);
    return row;
  }

  async listSuppliers(tenantId: string) {
    await this.ensureSetup(tenantId);
    const rows = await this.prisma.schoolStationerySupplier.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    const stats = await Promise.all(
      rows.map(async (s) => {
        const agg = await this.prisma.schoolStationeryPurchase.aggregate({
          where: { tenantId, supplierId: s.id, deletedAt: null },
          _sum: { grandTotal: true, amountPaid: true },
          _max: { purchaseDate: true },
        });
        const total = agg._sum.grandTotal ?? 0;
        const paid = agg._sum.amountPaid ?? 0;
        return {
          ...s,
          totalPurchases: total,
          pendingPayments: Math.max(0, total - paid),
          lastPurchase: agg._max.purchaseDate,
        };
      }),
    );
    return stats;
  }

  async saveSupplier(
    tenantId: string,
    dto: SaveStationerySupplierDto,
    actor: StationeryActor,
    id?: string,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to manage suppliers');
    const data = {
      name: dto.name.trim(),
      contactPerson: dto.contactPerson?.trim() || null,
      mobile: dto.mobile?.trim() || null,
      email: dto.email?.trim() || null,
      address: dto.address?.trim() || null,
      gstin: dto.gstin?.trim() || null,
      pan: dto.pan?.trim() || null,
      paymentTerms: dto.paymentTerms?.trim() || null,
      openingBalance: dto.openingBalance ?? 0,
      active: dto.active ?? true,
    };
    const row = id
      ? await this.prisma.schoolStationerySupplier.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolStationerySupplier.create({
          data: { tenantId, ...data },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'SUPPLIER_UPDATED' : 'SUPPLIER_CREATED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async listProducts(
    tenantId: string,
    q?: string,
    categoryId?: string,
    stock?: 'LOW' | 'OUT' | 'NORMAL' | 'ALL',
    take = 40,
  ) {
    await this.ensureSetup(tenantId);
    const term = q?.trim();
    const query = (lite: boolean) =>
      this.prisma.schoolStationeryProduct.findMany({
        where: {
          tenantId,
          deletedAt: null,
          AND: [
            categoryId
              ? lite
                ? { categoryId }
                : { OR: [{ categoryId }, { subcategoryId: categoryId }] }
              : {},
            term
              ? {
                  OR: [
                    { name: { contains: term, mode: 'insensitive' } },
                    { sku: { contains: term, mode: 'insensitive' } },
                    { barcode: { contains: term, mode: 'insensitive' } },
                    ...(lite
                      ? []
                      : [
                          {
                            category: {
                              name: {
                                contains: term,
                                mode: 'insensitive' as const,
                              },
                            },
                          },
                          {
                            subcategory: {
                              name: {
                                contains: term,
                                mode: 'insensitive' as const,
                              },
                            },
                          },
                        ]),
                  ],
                }
              : {},
          ],
        },
        include: lite
          ? { category: true }
          : {
              category: true,
              subcategory: true,
              variants: {
                where: { deletedAt: null },
                orderBy: { label: 'asc' },
              },
              grade: { select: { id: true, name: true, code: true } },
            },
        orderBy: { name: 'asc' },
        take: Math.min(100, Math.max(1, take)),
      });
    let rows;
    try {
      rows = await query(false);
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        (err.code !== 'P2022' && err.code !== 'P2021')
      ) {
        throw err;
      }
      this.schemaPatched = false;
      await this.patchMissingColumns();
      try {
        rows = await query(false);
      } catch {
        rows = await query(true);
      }
    }
    const mapped = rows.map((p) => {
      const qty = n(p.qtyOnHand);
      const min = n(p.minStock);
      const stockStatus =
        qty <= 0 ? 'OUT' : qty <= min && min > 0 ? 'LOW' : 'NORMAL';
      return {
        ...p,
        qtyOnHand: qty,
        minStock: min,
        openingStock: n(p.openingStock),
        taxPercent: n(p.taxPercent),
        stockStatus,
      };
    });
    if (stock && stock !== 'ALL')
      return mapped.filter((p) => p.stockStatus === stock);
    return mapped;
  }

  async getProduct(tenantId: string, id: string) {
    const row = await this.prisma.schoolStationeryProduct.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        subcategory: true,
        variants: { where: { deletedAt: null } },
        classMaps: { include: { grade: true } },
        supplier: true,
      },
    });
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async saveProduct(
    tenantId: string,
    dto: SaveStationeryProductDto,
    actor: StationeryActor,
    id?: string,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to manage products');
    if (id && actor.cashier) {
      const existing = await this.getProduct(tenantId, id);
      if (
        dto.purchasePrice != null &&
        dto.purchasePrice !== existing.purchasePrice
      ) {
        throw new BadRequestException('Cashiers cannot change purchase price');
      }
    }
    const settings = await this.getSettings(tenantId);
    const opening = dto.openingStock ?? 0;
    const data = {
      name: dto.name.trim(),
      sku: dto.sku.trim().toUpperCase(),
      barcode: dto.barcode?.trim() || null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId || null,
      brand: dto.brand?.trim() || null,
      description: dto.description?.trim() || null,
      unit: dto.unit || 'PIECE',
      purchasePrice: dto.purchasePrice ?? 0,
      sellingPrice: dto.sellingPrice,
      taxApplicable: dto.taxApplicable ?? false,
      taxPercent: dto.taxPercent ?? n(settings.defaultTaxPercent),
      discountAllowed: dto.discountAllowed ?? true,
      minStock: dto.minStock ?? 0,
      supplierId: dto.supplierId || null,
      active: dto.active ?? true,
      imageUrl: dto.imageUrl || null,
      remarks: dto.remarks?.trim() || null,
      gradeId: dto.gradeId || null,
      academicYearId: dto.academicYearId || null,
    };

    return this.prisma.$transaction(async (tx) => {
      let product;
      if (id) {
        const before = await tx.schoolStationeryProduct.findFirst({
          where: { id, tenantId, deletedAt: null },
        });
        if (!before) throw new NotFoundException('Product not found');
        product = await tx.schoolStationeryProduct.update({
          where: { id },
          data,
        });
        if (before.sellingPrice !== data.sellingPrice) {
          await tx.schoolStationeryAuditLog.create({
            data: {
              tenantId,
              userId: actor.userId,
              action: 'PRODUCT_PRICE_CHANGED',
              recordId: id,
              oldValue: { sellingPrice: before.sellingPrice },
              newValue: { sellingPrice: data.sellingPrice },
              ip: actor.ip ?? null,
            },
          });
        }
      } else {
        product = await tx.schoolStationeryProduct.create({
          data: {
            tenantId,
            ...data,
            openingStock: opening,
            qtyOnHand: 0,
          },
        });
        if (opening > 0) {
          await this.moveStock(tx, {
            tenantId,
            productId: product.id,
            qty: opening,
            type: 'OPENING',
            userId: actor.userId,
            allowNegative: true,
            refType: 'PRODUCT',
            refId: product.id,
            reason: 'Opening stock',
          });
        }
      }
      if (dto.variants) {
        for (const v of dto.variants) {
          const vOpening = v.qtyOnHand ?? 0;
          if (v.id) {
            await tx.schoolStationeryProductVariant.update({
              where: { id: v.id },
              data: {
                sku: v.sku.trim().toUpperCase(),
                label: v.label.trim(),
                barcode: v.barcode?.trim() || null,
                size: v.size || null,
                gender: v.gender || null,
                colour: v.colour || null,
                house: v.house || null,
                academicYear: v.academicYear || null,
                purchasePrice: v.purchasePrice ?? null,
                sellingPrice: v.sellingPrice ?? null,
                minStock: v.minStock ?? 0,
                active: v.active ?? true,
              },
            });
          } else {
            const created = await tx.schoolStationeryProductVariant.create({
              data: {
                tenantId,
                productId: product.id,
                sku: v.sku.trim().toUpperCase(),
                label: v.label.trim(),
                barcode: v.barcode?.trim() || null,
                size: v.size || null,
                gender: v.gender || null,
                colour: v.colour || null,
                house: v.house || null,
                academicYear: v.academicYear || null,
                purchasePrice: v.purchasePrice ?? null,
                sellingPrice: v.sellingPrice ?? null,
                minStock: v.minStock ?? 0,
                qtyOnHand: 0,
                active: v.active ?? true,
              },
            });
            if (vOpening > 0) {
              await this.moveStock(tx, {
                tenantId,
                productId: product.id,
                variantId: created.id,
                qty: vOpening,
                type: 'OPENING',
                userId: actor.userId,
                allowNegative: true,
                refType: 'VARIANT',
                refId: created.id,
                reason: 'Opening stock',
              });
            }
          }
        }
      }
      if (dto.classMaps) {
        await tx.schoolStationeryProductClassMapping.deleteMany({
          where: { productId: product.id, tenantId },
        });
        if (dto.classMaps.length) {
          await tx.schoolStationeryProductClassMapping.createMany({
            data: dto.classMaps.map((m) => ({
              tenantId,
              productId: product.id,
              gradeId: m.gradeId,
              sectionId: m.sectionId || null,
              gender: m.gender || null,
              academicYearId: m.academicYearId || null,
              studentCategory: m.studentCategory || null,
            })),
          });
        }
      }
      return tx.schoolStationeryProduct.findFirstOrThrow({
        where: { id: product.id },
        include: {
          variants: true,
          classMaps: true,
          category: true,
          subcategory: true,
        },
      });
    });
  }

  async deactivateProduct(
    tenantId: string,
    id: string,
    actor: StationeryActor,
  ) {
    if (!actor.manage) throw new BadRequestException('Not allowed');
    const used = await this.prisma.schoolStationerySaleItem.count({
      where: { productId: id, tenantId },
    });
    if (used > 0) {
      const row = await this.prisma.schoolStationeryProduct.update({
        where: { id },
        data: { active: false },
      });
      await this.audit(tenantId, actor, 'PRODUCT_INACTIVATED', id);
      return row;
    }
    await this.prisma.schoolStationeryProduct.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await this.audit(tenantId, actor, 'PRODUCT_DELETED', id);
    return { ok: true };
  }

  private async moveStock(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      productId: string;
      variantId?: string | null;
      qty: number;
      type: string;
      userId: string;
      allowNegative: boolean;
      refType?: string;
      refId?: string;
      reason?: string;
      remarks?: string;
    },
  ) {
    const qty = new Prisma.Decimal(input.qty);
    if (qty.eq(0)) return;
    if (input.variantId) {
      const variant = await tx.schoolStationeryProductVariant.findFirst({
        where: { id: input.variantId, tenantId: input.tenantId },
      });
      if (!variant) throw new NotFoundException('Variant not found');
      const before = new Prisma.Decimal(variant.qtyOnHand);
      const after = before.plus(qty);
      if (after.lt(0) && !input.allowNegative) {
        throw new BadRequestException(
          `Insufficient stock for ${variant.label}`,
        );
      }
      await tx.schoolStationeryProductVariant.update({
        where: { id: variant.id },
        data: { qtyOnHand: after },
      });
      const product = await tx.schoolStationeryProduct.findFirstOrThrow({
        where: { id: input.productId },
      });
      const pBefore = new Prisma.Decimal(product.qtyOnHand);
      const pAfter = pBefore.plus(qty);
      await tx.schoolStationeryProduct.update({
        where: { id: input.productId },
        data: { qtyOnHand: pAfter },
      });
      await tx.schoolStationeryStockMovement.create({
        data: {
          tenantId: input.tenantId,
          productId: input.productId,
          variantId: input.variantId,
          type: input.type,
          qty,
          qtyBefore: before,
          qtyAfter: after,
          refType: input.refType,
          refId: input.refId,
          reason: input.reason,
          remarks: input.remarks,
          userId: input.userId,
        },
      });
      return;
    }
    const product = await tx.schoolStationeryProduct.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');
    const before = new Prisma.Decimal(product.qtyOnHand);
    const after = before.plus(qty);
    if (after.lt(0) && !input.allowNegative) {
      throw new BadRequestException(`Insufficient stock for ${product.name}`);
    }
    await tx.schoolStationeryProduct.update({
      where: { id: product.id },
      data: { qtyOnHand: after },
    });
    await tx.schoolStationeryStockMovement.create({
      data: {
        tenantId: input.tenantId,
        productId: input.productId,
        type: input.type,
        qty,
        qtyBefore: before,
        qtyAfter: after,
        refType: input.refType,
        refId: input.refId,
        reason: input.reason,
        remarks: input.remarks,
        userId: input.userId,
      },
    });
  }

  private maxDiscountPct(
    settings: {
      cashierMaxDiscountPercent: Prisma.Decimal;
      managerMaxDiscountPercent: Prisma.Decimal;
    },
    actor: StationeryActor,
  ) {
    if (actor.admin) return 100;
    if (actor.manage && !actor.cashier)
      return n(settings.managerMaxDiscountPercent);
    return n(settings.cashierMaxDiscountPercent);
  }

  async searchStudents(tenantId: string, q: string) {
    const term = q.trim();
    if (!term) return [];
    const year = await this.year(tenantId);
    const or: Prisma.SchoolStudentWhereInput[] = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { admissionNumber: { contains: term, mode: 'insensitive' } },
      {
        enrollments: {
          some: { rollNumber: { contains: term, mode: 'insensitive' } },
        },
      },
    ];
    if (/^[0-9a-f-]{36}$/i.test(term)) or.push({ id: term });
    const students = await this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: or,
      },
      take: 20,
      include: {
        guardians: { include: { guardian: true }, take: 1 },
        enrollments: {
          where: { academicYearId: year.id, status: 'ACTIVE' },
          include: { section: { include: { grade: true } } },
          take: 1,
        },
      },
    });
    return students.map((s) => {
      const enr = s.enrollments[0];
      const g = s.guardians[0]?.guardian;
      return {
        id: s.id,
        fullName: s.fullName,
        admissionNumber: s.admissionNumber,
        gender: s.gender,
        phone: s.phone,
        className: enr
          ? `${enr.section.grade.name} - ${enr.section.name}`
          : null,
        gradeId: enr?.section.gradeId ?? null,
        sectionId: enr?.sectionId ?? null,
        academicYear: year.name,
        rollNumber: enr?.rollNumber ?? null,
        guardianName: g?.fullName ?? null,
        guardianPhone: g?.phone ?? null,
      };
    });
  }

  async completeSale(
    tenantId: string,
    dto: CompleteStationerySaleDto,
    actor: StationeryActor,
  ) {
    await this.ensureSetup(tenantId);
    const settings = await this.getSettings(tenantId);
    if (!settings.enabled)
      throw new BadRequestException('Stationery module is disabled');
    if (!dto.items?.length)
      throw new BadRequestException('Add at least one item');
    if (dto.customerType === 'STUDENT' && !dto.studentId) {
      throw new BadRequestException('Select a student');
    }
    if (dto.customerType === 'WALK_IN') {
      if (!settings.allowWalkInSales)
        throw new BadRequestException('Walk-in sales are disabled');
      if (settings.requireStudentSelection) {
        throw new BadRequestException('Student selection is required');
      }
      if (!dto.walkInName?.trim()) dto.walkInName = 'Walk-in Customer';
    }
    if (dto.idempotencyKey) {
      const existing = await this.prisma.schoolStationerySale.findFirst({
        where: { tenantId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return this.getSale(tenantId, existing.id);
    }
    await this.ensureSetup(tenantId);
    const year = await this.year(tenantId);
    const cap = this.maxDiscountPct(settings, actor);
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.productsForSale(tenantId, productIds);
    const byId = new Map(products.map((p) => [p.id, p]));

    const computed = dto.items.map((line) => {
      const product = byId.get(line.productId);
      if (!product || !product.active)
        throw new BadRequestException('Inactive or missing product');
      const variant = line.variantId
        ? product.variants.find((v) => v.id === line.variantId)
        : undefined;
      if (line.variantId && !variant)
        throw new BadRequestException('Variant not found');
      if (
        product.variants.filter((v) => v.active && !v.deletedAt).length &&
        !line.variantId
      ) {
        throw new BadRequestException(
          `Select a size/variant for ${product.name}`,
        );
      }
      const rate = variant?.sellingPrice ?? product.sellingPrice;
      const qty = line.qty;
      const onHand = n(variant?.qtyOnHand ?? product.qtyOnHand);
      if (
        !dto.draft &&
        settings.enableStockTracking &&
        !settings.allowNegativeStock &&
        qty > onHand + 0.0001
      ) {
        throw new BadRequestException(
          `Stock has changed. Please review the cart. Only ${onHand} units of ${product.name} are currently available.`,
        );
      }
      const gross = rate * qty;
      let discountAmt = 0;
      if (line.discountPct)
        discountAmt = money((gross * line.discountPct) / 100);
      if (discountAmt && !product.discountAllowed) {
        throw new BadRequestException(
          `Discount is not allowed on ${product.name}`,
        );
      }
      const pct = gross > 0 ? (discountAmt / gross) * 100 : 0;
      if (pct - cap > 0.01) {
        throw new BadRequestException(
          `Discount exceeds allowed maximum of ${cap}%`,
        );
      }
      const taxable = gross - discountAmt;
      const taxPct = product.taxApplicable ? n(product.taxPercent) : 0;
      const taxAmount = money((taxable * taxPct) / 100);
      const lineTotal = money(taxable + taxAmount);
      return {
        product,
        variant,
        qty,
        rate,
        discountAmt,
        discountPct: pct,
        taxPct,
        taxAmount,
        lineTotal,
        sku: variant?.sku ?? product.sku,
        name: product.name,
        variantLabel: variant?.label ?? null,
        unit: product.unit,
      };
    });

    const subtotal = computed.reduce((s, i) => s + money(i.rate * i.qty), 0);
    const itemDiscount = computed.reduce((s, i) => s + i.discountAmt, 0);
    let billDiscount = dto.billDiscount ?? 0;
    if (dto.billDiscountPct)
      billDiscount = money((subtotal * dto.billDiscountPct) / 100);
    const billPct = subtotal > 0 ? (billDiscount / subtotal) * 100 : 0;
    if (billPct - cap > 0.01) {
      throw new BadRequestException(
        `Bill discount exceeds allowed maximum of ${cap}%`,
      );
    }
    const taxAmount = computed.reduce((s, i) => s + i.taxAmount, 0);
    const grandTotal = Math.max(
      0,
      subtotal - itemDiscount - billDiscount + taxAmount,
    );
    const payments = dto.draft ? [] : (dto.payments ?? []);
    for (const p of payments) {
      if (p.method === 'CHEQUE' && !p.chequeNumber && !p.reference) {
        throw new BadRequestException('Cheque number is required');
      }
    }
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    if (amountPaid > grandTotal) {
      throw new BadRequestException('Paid amount cannot exceed grand total');
    }
    const cashPaid = payments
      .filter((p) => p.method === 'CASH')
      .reduce((s, p) => s + p.amount, 0);
    const cashReceived = dto.cashReceived ?? cashPaid;
    if (!dto.draft && cashPaid > 0 && cashReceived < cashPaid) {
      throw new BadRequestException('Insufficient cash received');
    }
    const changeReturned =
      cashReceived > cashPaid ? cashReceived - cashPaid : 0;
    const balanceDue = grandTotal - amountPaid;
    if (!dto.draft && balanceDue > 0 && !settings.allowCreditSales) {
      throw new BadRequestException(
        'Full payment is required (credit sales are disabled)',
      );
    }
    if (
      !dto.draft &&
      payments.some((p) => p.method === 'CREDIT') &&
      !settings.allowCreditSales
    ) {
      throw new BadRequestException('Credit sales are disabled');
    }
    let status = 'DRAFT';
    if (!dto.draft) {
      if (balanceDue <= 0) status = 'PAID';
      else if (amountPaid > 0) status = 'PARTIALLY_PAID';
      else status = 'PENDING_PAYMENT';
    }

    const invoiceNo = await this.nextInvoiceNo(
      tenantId,
      year.id,
      year.code,
      settings.invoicePrefix,
    );

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.schoolStationerySale.create({
        data: {
          tenantId,
          academicYearId: year.id,
          invoiceNo,
          status,
          customerType: dto.customerType,
          studentId: dto.studentId || null,
          walkInName: dto.walkInName?.trim() || null,
          walkInMobile: dto.walkInMobile?.trim() || null,
          walkInAddress: dto.walkInAddress?.trim() || null,
          subtotal,
          itemDiscount,
          billDiscount,
          billDiscountPct: dto.billDiscountPct ?? billPct,
          taxAmount,
          grandTotal,
          amountPaid,
          balanceDue,
          cashReceived: dto.draft ? null : cashReceived,
          changeReturned: dto.draft ? null : changeReturned,
          idempotencyKey: dto.idempotencyKey || null,
          notes: dto.notes?.trim() || null,
          cashierUserId: actor.userId,
          cashierName: actor.name,
          completedAt: dto.draft ? null : new Date(),
          items: {
            create: computed.map((i) => ({
              tenantId,
              productId: i.product.id,
              variantId: i.variant?.id ?? null,
              productName: i.name,
              variantLabel: i.variantLabel,
              sku: i.sku,
              unit: i.unit,
              qty: i.qty,
              rate: i.rate,
              discountAmt: i.discountAmt,
              discountPct: i.discountPct,
              taxPercent: i.taxPct,
              taxAmount: i.taxAmount,
              lineTotal: i.lineTotal,
            })),
          },
          payments: {
            create: payments.map((p) => ({
              tenantId,
              method: p.method,
              amount: p.amount,
              reference: p.reference || p.chequeNumber || null,
              notes:
                [p.bankName, p.instrumentDate, p.notes]
                  .filter(Boolean)
                  .join(' | ') || null,
            })),
          },
        },
        include: { items: true, payments: true, student: true },
      });

      if (!dto.draft && settings.enableStockTracking) {
        for (const line of computed) {
          await this.moveStock(tx, {
            tenantId,
            productId: line.product.id,
            variantId: line.variant?.id,
            qty: -line.qty,
            type: 'SALE',
            userId: actor.userId,
            allowNegative: settings.allowNegativeStock,
            refType: 'SALE',
            refId: created.id,
          });
        }
      }
      return created;
    });

    if (!dto.draft && amountPaid > 0) {
      await this.accounts.postStationerySale(tenantId, {
        saleId: sale.id,
        invoiceNo,
        amount: amountPaid,
        mode: (payments[0]?.method || 'CASH').toUpperCase(),
        actorUserId: actor.userId,
      });
    }

    await this.audit(
      tenantId,
      actor,
      dto.draft ? 'SALE_DRAFT' : 'SALE_CREATED',
      sale.id,
      null,
      {
        invoiceNo,
        grandTotal,
        amountPaid,
      },
    );
    return this.getSale(tenantId, sale.id);
  }

  private async nextInvoiceNo(
    tenantId: string,
    academicYearId: string,
    yearCode: string,
    prefix: string,
  ) {
    const seq = await this.prisma.$transaction(async (tx) => {
      const row = await tx.schoolIdSequence.upsert({
        where: {
          tenantId_academicYearId_kind: {
            tenantId,
            academicYearId,
            kind: 'STATIONERY',
          },
        },
        update: { lastValue: { increment: 1 } },
        create: { tenantId, academicYearId, kind: 'STATIONERY', lastValue: 1 },
      });
      return row.lastValue;
    });
    return `${prefix}-${yearCode}-${String(seq).padStart(6, '0')}`;
  }

  async getSale(tenantId: string, id: string) {
    const row = await this.prisma.schoolStationerySale.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        items: true,
        payments: true,
        student: {
          include: {
            guardians: { include: { guardian: true }, take: 1 },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { section: { include: { grade: true } } },
              take: 1,
            },
          },
        },
        academicYear: true,
        returns: { include: { items: true } },
      },
    });
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }

  async listSales(
    tenantId: string,
    query: {
      q?: string;
      status?: string;
      studentId?: string;
      from?: string;
      to?: string;
      take?: number;
    },
  ) {
    await this.ensureSetup(tenantId);
    const take = Math.min(100, query.take ?? 40);
    return this.prisma.schoolStationerySale.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                gte: query.from ? new Date(query.from) : undefined,
                lte: query.to ? new Date(`${query.to}T23:59:59`) : undefined,
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { invoiceNo: { contains: query.q, mode: 'insensitive' } },
                { walkInName: { contains: query.q, mode: 'insensitive' } },
                {
                  student: {
                    fullName: { contains: query.q, mode: 'insensitive' },
                  },
                },
                {
                  student: {
                    admissionNumber: { contains: query.q, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        student: { select: { fullName: true, admissionNumber: true } },
        payments: true,
        items: { select: { productName: true, qty: true, lineTotal: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async cancelSale(
    tenantId: string,
    id: string,
    reason: string | undefined,
    actor: StationeryActor,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to cancel sales');
    const sale = await this.getSale(tenantId, id);
    if (sale.status === 'CANCELLED')
      throw new BadRequestException('Already cancelled');
    if (sale.status === 'DRAFT') {
      await this.prisma.schoolStationerySale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });
      await this.audit(tenantId, actor, 'SALE_CANCELLED', id);
      return this.getSale(tenantId, id);
    }
    const settings = await this.getSettings(tenantId);
    await this.prisma.$transaction(async (tx) => {
      if (settings.enableStockTracking) {
        for (const item of sale.items) {
          const remaining = n(item.qty) - n(item.returnedQty);
          if (remaining <= 0) continue;
          await this.moveStock(tx, {
            tenantId,
            productId: item.productId,
            variantId: item.variantId,
            qty: remaining,
            type: 'SALE_RETURN',
            userId: actor.userId,
            allowNegative: true,
            refType: 'SALE',
            refId: sale.id,
            reason: 'Invoice cancelled',
          });
        }
      }
      await tx.schoolStationerySale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason || null,
        },
      });
    });
    await this.audit(
      tenantId,
      actor,
      'SALE_CANCELLED',
      id,
      { status: sale.status },
      { reason },
    );
    return this.getSale(tenantId, id);
  }

  async createPurchase(
    tenantId: string,
    dto: CreateStationeryPurchaseDto,
    actor: StationeryActor,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to record purchases');
    const year = await this.year(tenantId);
    const settings = await this.getSettings(tenantId);
    const computed = dto.items.map((line) => {
      const gross = line.rate * line.qty;
      const discount = line.discountAmt ?? 0;
      const tax = money(((gross - discount) * (line.taxPercent ?? 0)) / 100);
      return {
        ...line,
        taxAmount: tax,
        lineTotal: money(gross - discount + tax),
      };
    });
    const subtotal = computed.reduce((s, i) => s + money(i.rate * i.qty), 0);
    const discount = computed.reduce((s, i) => s + (i.discountAmt ?? 0), 0);
    const taxAmount = computed.reduce((s, i) => s + i.taxAmount, 0);
    const grandTotal = subtotal - discount + taxAmount;
    const purchase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.schoolStationeryPurchase.create({
        data: {
          tenantId,
          academicYearId: year.id,
          supplierId: dto.supplierId,
          invoiceNo: dto.invoiceNo.trim(),
          purchaseDate: new Date(dto.purchaseDate),
          subtotal,
          discount,
          taxAmount,
          grandTotal,
          paymentStatus: dto.paymentStatus || 'UNPAID',
          amountPaid: dto.amountPaid ?? 0,
          remarks: dto.remarks || null,
          userId: actor.userId,
          items: {
            create: computed.map((i) => ({
              tenantId,
              productId: i.productId,
              variantId: i.variantId || null,
              qty: i.qty,
              rate: i.rate,
              discountAmt: i.discountAmt ?? 0,
              taxPercent: i.taxPercent ?? 0,
              taxAmount: i.taxAmount,
              lineTotal: i.lineTotal,
            })),
          },
        },
      });
      if (settings.enableStockTracking) {
        for (const line of computed) {
          await this.moveStock(tx, {
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
            type: 'PURCHASE',
            userId: actor.userId,
            allowNegative: true,
            refType: 'PURCHASE',
            refId: created.id,
          });
        }
      }
      return created;
    });
    await this.audit(tenantId, actor, 'PURCHASE_CREATED', purchase.id);
    return this.prisma.schoolStationeryPurchase.findFirstOrThrow({
      where: { id: purchase.id },
      include: {
        items: { include: { product: true, variant: true } },
        supplier: true,
      },
    });
  }

  async listPurchases(tenantId: string) {
    return this.prisma.schoolStationeryPurchase.findMany({
      where: { tenantId, deletedAt: null },
      include: { supplier: true, items: true },
      orderBy: { purchaseDate: 'desc' },
      take: 80,
    });
  }

  async adjustStock(
    tenantId: string,
    dto: AdjustStationeryStockDto,
    actor: StationeryActor,
  ) {
    if (!actor.manage || actor.cashier) {
      throw new BadRequestException('Cashiers cannot adjust stock');
    }
    if (!dto.reason.trim()) throw new BadRequestException('Reason is required');
    const settings = await this.getSettings(tenantId);
    const typeMap: Record<string, string> = {
      DAMAGED: 'DAMAGED',
      LOST: 'LOST',
      FOUND: 'FOUND',
      PHYSICAL: 'ADJUSTMENT',
      OPENING: 'OPENING',
      OTHER: 'OTHER',
    };
    const signed =
      dto.adjustmentType === 'FOUND' || dto.adjustmentType === 'OPENING'
        ? Math.abs(dto.qty)
        : dto.adjustmentType === 'PHYSICAL'
          ? dto.qty
          : -Math.abs(dto.qty);
    await this.prisma.$transaction(async (tx) => {
      await this.moveStock(tx, {
        tenantId,
        productId: dto.productId,
        variantId: dto.variantId,
        qty: signed,
        type: typeMap[dto.adjustmentType] || 'ADJUSTMENT',
        userId: actor.userId,
        allowNegative: settings.allowNegativeStock,
        refType: 'ADJUSTMENT',
        reason: dto.reason,
        remarks: dto.remarks,
      });
    });
    await this.audit(
      tenantId,
      actor,
      'STOCK_ADJUSTED',
      dto.productId,
      null,
      dto,
    );
    return { ok: true };
  }

  async createReturn(
    tenantId: string,
    dto: CreateStationeryReturnDto,
    actor: StationeryActor,
  ) {
    if (!actor.manage)
      throw new BadRequestException('Not allowed to process returns');
    const sale = await this.getSale(tenantId, dto.saleId);
    if (
      !OPEN_SALE.includes(sale.status as (typeof OPEN_SALE)[number]) &&
      sale.status !== 'PARTIALLY_RETURNED'
    ) {
      throw new BadRequestException('This invoice cannot be returned');
    }
    const settings = await this.getSettings(tenantId);
    const year = await this.year(tenantId);
    const returnNo = await this.nextInvoiceNo(
      tenantId,
      year.id,
      year.code,
      'STN-R',
    );
    const result = await this.prisma.$transaction(async (tx) => {
      let refundTotal = 0;
      const created = await tx.schoolStationeryReturn.create({
        data: {
          tenantId,
          saleId: sale.id,
          returnNo,
          reason: dto.reason || null,
          userId: actor.userId,
        },
      });
      for (const line of dto.items) {
        const item = sale.items.find((i) => i.id === line.saleItemId);
        if (!item) throw new BadRequestException('Sale item not found');
        const remaining = n(item.qty) - n(item.returnedQty);
        if (line.qty > remaining + 0.0001) {
          throw new BadRequestException(
            `Return qty exceeds remaining for ${item.productName}`,
          );
        }
        const unitNet = n(item.qty) > 0 ? item.lineTotal / n(item.qty) : 0;
        const refundAmt = money(unitNet * line.qty);
        refundTotal += refundAmt;
        await tx.schoolStationeryReturnItem.create({
          data: {
            tenantId,
            returnId: created.id,
            saleItemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            qty: line.qty,
            condition: line.condition,
            refundAmt,
          },
        });
        await tx.schoolStationerySaleItem.update({
          where: { id: item.id },
          data: {
            returnedQty: new Prisma.Decimal(n(item.returnedQty) + line.qty),
          },
        });
        if (settings.enableStockTracking && line.condition === 'RESALABLE') {
          await this.moveStock(tx, {
            tenantId,
            productId: item.productId,
            variantId: item.variantId,
            qty: line.qty,
            type: 'SALE_RETURN',
            userId: actor.userId,
            allowNegative: true,
            refType: 'RETURN',
            refId: created.id,
          });
        } else if (settings.enableStockTracking) {
          await tx.schoolStationeryStockMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              variantId: item.variantId,
              type: 'DAMAGED',
              qty: 0,
              qtyBefore: 0,
              qtyAfter: 0,
              refType: 'RETURN',
              refId: created.id,
              reason: 'Damaged return — not restocked',
              userId: actor.userId,
            },
          });
        }
      }
      const itemsAfter = await tx.schoolStationerySaleItem.findMany({
        where: { saleId: sale.id },
      });
      const allReturned = itemsAfter.every(
        (i) => n(i.returnedQty) >= n(i.qty) - 0.0001,
      );
      await tx.schoolStationeryReturn.update({
        where: { id: created.id },
        data: { refundTotal },
      });
      await tx.schoolStationerySale.update({
        where: { id: sale.id },
        data: {
          status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED',
          amountPaid: Math.max(0, sale.amountPaid - refundTotal),
          balanceDue: Math.max(0, sale.balanceDue - refundTotal),
        },
      });
      return created.id;
    });
    await this.audit(tenantId, actor, 'RETURN_CREATED', result);
    return this.getSale(tenantId, sale.id);
  }

  async dashboard(tenantId: string) {
    await this.ensureSetup(tenantId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const closed = {
      status: {
        in: ['PAID', 'PARTIALLY_PAID', 'PENDING_PAYMENT', 'PARTIALLY_RETURNED'],
      },
    };
    const [todaySales, monthSales, pending, products, recent, paymentsToday] =
      await Promise.all([
        this.prisma.schoolStationerySale.aggregate({
          where: {
            tenantId,
            deletedAt: null,
            completedAt: { gte: start },
            ...closed,
          },
          _sum: { grandTotal: true, amountPaid: true },
          _count: true,
        }),
        this.prisma.schoolStationerySale.aggregate({
          where: {
            tenantId,
            deletedAt: null,
            completedAt: { gte: monthStart },
            ...closed,
          },
          _sum: { grandTotal: true },
        }),
        this.prisma.schoolStationerySale.aggregate({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID', 'CREDIT'] },
          },
          _sum: { balanceDue: true },
          _count: true,
        }),
        this.prisma.schoolStationeryProduct.findMany({
          where: { tenantId, deletedAt: null, active: true },
          select: { qtyOnHand: true, minStock: true, purchasePrice: true },
        }),
        this.prisma.schoolStationerySale.findMany({
          where: { tenantId, deletedAt: null },
          include: { student: { select: { fullName: true } }, payments: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
        this.prisma.schoolStationerySalePayment.findMany({
          where: { tenantId, createdAt: { gte: start } },
        }),
      ]);
    let low = 0;
    let out = 0;
    let value = 0;
    for (const p of products) {
      const qty = n(p.qtyOnHand);
      if (qty <= 0) out += 1;
      else if (qty <= n(p.minStock) && n(p.minStock) > 0) low += 1;
      value += qty * p.purchasePrice;
    }
    const byMethod: Record<string, number> = {};
    for (const p of paymentsToday) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
    }
    const daily = await this.prisma.$queryRaw<
      Array<{ d: Date; total: bigint }>
    >`
      SELECT date_trunc('day', completed_at) AS d, SUM(grand_total)::bigint AS total
      FROM school.school_stationery_sales
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND completed_at >= ${monthStart}
      GROUP BY 1
      ORDER BY 1
    `;
    const top = await this.prisma.schoolStationerySaleItem.groupBy({
      by: ['productName'],
      where: {
        tenantId,
        sale: { completedAt: { gte: monthStart }, deletedAt: null },
      },
      _sum: { lineTotal: true, qty: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 8,
    });
    return {
      todaySales: todaySales._sum.grandTotal ?? 0,
      todayTransactions: todaySales._count,
      todayCash: byMethod.CASH ?? 0,
      todayUpi: byMethod.UPI ?? 0,
      pendingPayments: pending._sum.balanceDue ?? 0,
      pendingCount: pending._count,
      lowStockItems: low,
      outOfStockItems: out,
      inventoryValue: money(value),
      monthlySales: monthSales._sum.grandTotal ?? 0,
      paymentBreakdown: byMethod,
      dailySales: daily.map((r) => ({ date: r.d, total: Number(r.total) })),
      topProducts: top.map((t) => ({
        name: t.productName,
        amount: t._sum.lineTotal ?? 0,
        qty: n(t._sum.qty),
      })),
      recent,
    };
  }

  async reports(
    tenantId: string,
    query: {
      from?: string;
      to?: string;
      categoryId?: string;
      paymentMethod?: string;
    },
  ) {
    const from = query.from
      ? new Date(query.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = query.to ? new Date(`${query.to}T23:59:59`) : new Date();
    const sales = await this.prisma.schoolStationerySale.findMany({
      where: {
        tenantId,
        deletedAt: null,
        completedAt: { gte: from, lte: to },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      include: {
        items: {
          include: {
            product: { select: { categoryId: true, subcategoryId: true } },
          },
        },
        payments: true,
        student: {
          select: {
            fullName: true,
            admissionNumber: true,
            enrollments: {
              take: 1,
              include: { section: { include: { grade: true } } },
            },
          },
        },
      },
    });
    const filtered = query.paymentMethod
      ? sales.filter((s) =>
          s.payments.some((p) => p.method === query.paymentMethod),
        )
      : sales;
    return {
      from,
      to,
      count: filtered.length,
      grandTotal: filtered.reduce((s, r) => s + r.grandTotal, 0),
      paid: filtered.reduce((s, r) => s + r.amountPaid, 0),
      outstanding: filtered.reduce((s, r) => s + r.balanceDue, 0),
      rows: filtered.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        date: s.completedAt ?? s.createdAt,
        customer:
          s.customerType === 'STUDENT' ? s.student?.fullName : s.walkInName,
        className: s.student?.enrollments[0]
          ? `${s.student.enrollments[0].section.grade.name}-${s.student.enrollments[0].section.name}`
          : null,
        grandTotal: s.grandTotal,
        paid: s.amountPaid,
        balance: s.balanceDue,
        status: s.status,
        cashier: s.cashierName,
        methods: s.payments.map((p) => p.method).join(', '),
      })),
    };
  }

  async stockMovements(tenantId: string, productId?: string) {
    return this.prisma.schoolStationeryStockMovement.findMany({
      where: { tenantId, ...(productId ? { productId } : {}) },
      include: {
        product: { select: { name: true, sku: true } },
        variant: { select: { label: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });
  }

  async importProducts(
    tenantId: string,
    dto: ImportStationeryProductsDto,
    actor: StationeryActor,
  ) {
    await this.ensureSetup(tenantId);
    const cats = await this.prisma.schoolStationeryCategory.findMany({
      where: { tenantId, deletedAt: null },
    });
    const byCode = new Map(cats.map((c) => [c.code, c]));
    const result = {
      total: dto.rows.length,
      success: 0,
      failed: 0,
      duplicate: 0,
      invalid: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>,
    };
    let i = 0;
    for (const row of dto.rows) {
      i += 1;
      try {
        const cat = byCode.get(slugCode(row.categoryCode));
        if (!cat) {
          result.invalid += 1;
          result.failed += 1;
          result.errors.push({
            row: i,
            sku: row.sku,
            error: 'Unknown category code',
          });
          continue;
        }
        const sub = row.subcategoryCode
          ? cats.find(
              (c) =>
                c.parentId === cat.id &&
                (c.code === slugCode(row.subcategoryCode!) ||
                  c.code.endsWith(`_${slugCode(row.subcategoryCode!)}`)),
            )
          : null;
        const exists = await this.prisma.schoolStationeryProduct.findFirst({
          where: {
            tenantId,
            sku: row.sku.trim().toUpperCase(),
            deletedAt: null,
          },
        });
        if (exists) {
          result.duplicate += 1;
          result.failed += 1;
          result.errors.push({ row: i, sku: row.sku, error: 'Duplicate SKU' });
          continue;
        }
        await this.saveProduct(
          tenantId,
          {
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
            categoryId: cat.id,
            subcategoryId: sub?.id,
            unit: row.unit || 'PIECE',
            purchasePrice: row.purchasePrice ?? 0,
            sellingPrice: row.sellingPrice,
            openingStock: row.openingStock ?? 0,
            minStock: row.minStock ?? 0,
          },
          actor,
        );
        result.success += 1;
      } catch (err) {
        result.failed += 1;
        result.invalid += 1;
        result.errors.push({
          row: i,
          sku: row.sku,
          error: err instanceof Error ? err.message : 'Invalid row',
        });
      }
    }
    return result;
  }

  async productTemplate() {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Products');
    sheet.columns = [
      { header: 'name', key: 'name', width: 32 },
      { header: 'sku', key: 'sku', width: 16 },
      { header: 'barcode', key: 'barcode', width: 16 },
      { header: 'categoryCode', key: 'categoryCode', width: 16 },
      { header: 'subcategoryCode', key: 'subcategoryCode', width: 20 },
      { header: 'unit', key: 'unit', width: 12 },
      { header: 'purchasePrice', key: 'purchasePrice', width: 14 },
      { header: 'sellingPrice', key: 'sellingPrice', width: 14 },
      { header: 'openingStock', key: 'openingStock', width: 14 },
      { header: 'minStock', key: 'minStock', width: 12 },
    ];
    sheet.addRow({
      name: 'Class 6 Mathematics Textbook',
      sku: 'BK-MTH-6',
      barcode: '',
      categoryCode: 'BOOKS',
      subcategoryCode: 'TEXT_BOOKS',
      unit: 'PIECE',
      purchasePrice: 180,
      sellingPrice: 200,
      openingStock: 150,
      minStock: 20,
    });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async suggestedForStudent(tenantId: string, studentId: string) {
    const year = await this.year(tenantId);
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, tenantId },
      include: {
        enrollments: {
          where: { academicYearId: year.id, status: 'ACTIVE' },
          include: { section: true },
        },
      },
    });
    const gradeId = student?.enrollments[0]?.section.gradeId;
    if (!gradeId) return [];
    return this.prisma.schoolStationeryProduct.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        OR: [{ gradeId }, { classMaps: { some: { gradeId } } }],
      },
      include: { variants: { where: { deletedAt: null, active: true } } },
      take: 40,
    });
  }
}
