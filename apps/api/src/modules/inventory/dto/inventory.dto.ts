import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  transactionType?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CreateItemDto {
  @IsUUID()
  storeId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class StockMovementDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  issuedToName?: string;

  @IsOptional()
  @IsUUID()
  issuedToStaffId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstin?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class PurchaseOrderLineDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class ReceivePoLineDto {
  @IsUUID()
  lineId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class LabelBatchDto {
  @IsOptional()
  itemIds?: string[];

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpsertVendorPriceDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadDays?: number;
}

export class RequisitionLineDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityRequested!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRequisitionDto {
  @IsString()
  @IsNotEmpty()
  department!: string;

  @IsOptional()
  @IsString()
  requestedByName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionLineDto)
  lines!: RequisitionLineDto[];
}

export class ApproveRequisitionDto {
  @IsOptional()
  lines?: { lineId: string; quantityApproved: number }[];
}

export class ConvertRequisitionDto {
  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePoFromSuggestionDto {
  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds!: string[];
}
