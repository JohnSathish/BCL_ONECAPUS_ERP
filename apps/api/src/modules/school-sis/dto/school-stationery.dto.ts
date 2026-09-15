import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SCHOOL_SIS_STATIONERY_PAY_METHODS,
  SCHOOL_SIS_STATIONERY_UNITS,
} from '../school-sis.constants';

export class SaveStationeryCategoryDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SaveStationerySupplierDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

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
  pan?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsInt()
  openingBalance?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StationeryVariantDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(80)
  sku!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsString()
  house?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsInt()
  purchasePrice?: number;

  @IsOptional()
  @IsInt()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  qtyOnHand?: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StationeryClassMapDto {
  @IsUUID()
  gradeId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  studentCategory?: string;
}

export class SaveStationeryProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(60)
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([...SCHOOL_SIS_STATIONERY_UNITS])
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number;

  @IsInt()
  @Min(0)
  sellingPrice!: number;

  @IsOptional()
  @IsBoolean()
  taxApplicable?: boolean;

  @IsOptional()
  @IsNumber()
  taxPercent?: number;

  @IsOptional()
  @IsBoolean()
  discountAllowed?: boolean;

  @IsOptional()
  @IsNumber()
  minStock?: number;

  @IsOptional()
  @IsNumber()
  openingStock?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationeryVariantDto)
  variants?: StationeryVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationeryClassMapDto)
  classMaps?: StationeryClassMapDto[];
}

export class SaveStationerySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  invoicePrefix?: string;

  @IsOptional()
  @IsInt()
  startingNumber?: number;

  @IsOptional()
  @IsIn([...SCHOOL_SIS_STATIONERY_PAY_METHODS])
  defaultPaymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  allowWalkInSales?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCreditSales?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsNumber()
  defaultTaxPercent?: number;

  @IsOptional()
  @IsNumber()
  defaultDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  cashierMaxDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  managerMaxDiscountPercent?: number;

  @IsOptional()
  @IsBoolean()
  lowStockAlert?: boolean;

  @IsOptional()
  @IsIn(['A4', 'A5', 'THERMAL'])
  receiptFormat?: string;

  @IsOptional()
  @IsBoolean()
  requireStudentSelection?: boolean;

  @IsOptional()
  @IsBoolean()
  enableBarcode?: boolean;

  @IsOptional()
  @IsBoolean()
  enableProductImages?: boolean;

  @IsOptional()
  @IsBoolean()
  enableStockTracking?: boolean;
}

export class StationerySaleLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  discountPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmt?: number;
}

export class StationeryPaymentDto {
  @IsIn([...SCHOOL_SIS_STATIONERY_PAY_METHODS])
  method!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @IsOptional()
  @IsDateString()
  instrumentDate?: string;
}

export class CompleteStationerySaleDto {
  @IsIn(['STUDENT', 'WALK_IN'])
  customerType!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  walkInName?: string;

  @IsOptional()
  @IsString()
  walkInMobile?: string;

  @IsOptional()
  @IsString()
  walkInAddress?: string;

  @IsOptional()
  @IsNumber()
  billDiscountPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  billDiscount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashReceived?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationerySaleLineDto)
  items!: StationerySaleLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationeryPaymentDto)
  payments?: StationeryPaymentDto[];
}

export class CancelStationerySaleDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class StationeryPurchaseLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsInt()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsInt()
  discountAmt?: number;

  @IsOptional()
  @IsNumber()
  taxPercent?: number;
}

export class CreateStationeryPurchaseDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  invoiceNo!: string;

  @IsDateString()
  purchaseDate!: string;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  paymentStatus?: string;

  @IsOptional()
  @IsInt()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationeryPurchaseLineDto)
  items!: StationeryPurchaseLineDto[];
}

export class AdjustStationeryStockDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsNumber()
  qty!: number;

  @IsIn(['DAMAGED', 'LOST', 'FOUND', 'PHYSICAL', 'OPENING', 'OTHER'])
  adjustmentType!: string;

  @IsString()
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class StationeryReturnLineDto {
  @IsUUID()
  saleItemId!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsIn(['RESALABLE', 'DAMAGED'])
  condition!: string;
}

export class CreateStationeryReturnDto {
  @IsUUID()
  saleId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationeryReturnLineDto)
  items!: StationeryReturnLineDto[];
}

export class ImportStationeryProductRowDto {
  @IsString()
  name!: string;

  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  categoryCode!: string;

  @IsOptional()
  @IsString()
  subcategoryCode?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  purchasePrice?: number;

  @IsInt()
  sellingPrice!: number;

  @IsOptional()
  @IsNumber()
  openingStock?: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;
}

export class ImportStationeryProductsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStationeryProductRowDto)
  rows!: ImportStationeryProductRowDto[];
}
