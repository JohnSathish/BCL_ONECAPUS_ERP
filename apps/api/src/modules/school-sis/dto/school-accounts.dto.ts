import {
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AcctLineDto {
  @IsOptional()
  @IsString()
  accountId?: string;
  @IsOptional()
  @IsString()
  systemKey?: string;
  @IsOptional()
  @IsNumberString()
  debit?: string;
  @IsOptional()
  @IsNumberString()
  credit?: string;
  @IsOptional()
  @IsString()
  particulars?: string;
  @IsOptional()
  @IsString()
  costCentreId?: string;
}

export class AcctVoucherDto {
  @IsString()
  voucherType!: string;
  @IsString()
  date!: string;
  @IsString()
  narration!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcctLineDto)
  lines!: AcctLineDto[];
  @IsOptional()
  @IsString()
  payerName?: string;
  @IsOptional()
  @IsString()
  payeeName?: string;
  @IsOptional()
  @IsString()
  studentId?: string;
  @IsOptional()
  @IsString()
  vendorId?: string;
  @IsOptional()
  @IsString()
  costCentreId?: string;
  @IsOptional()
  @IsString()
  paymentMode?: string;
  @IsOptional()
  @IsString()
  bankAccountId?: string;
  @IsOptional()
  @IsString()
  referenceNo?: string;
  @IsOptional()
  @IsString()
  chequeNo?: string;
  @IsOptional()
  autoPost?: boolean;
}

export class AcctAccountDto {
  @IsString()
  code!: string;
  @IsString()
  name!: string;
  @IsString()
  type!: string;
  @IsOptional()
  @IsString()
  parentId?: string;
  @IsOptional()
  @IsString()
  moduleKey?: string;
  @IsOptional()
  @IsNumberString()
  openingBalance?: string;
  @IsOptional()
  @IsString()
  openingSide?: string;
}

export class AcctVendorDto {
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  code?: string;
  @IsOptional()
  @IsString()
  contact?: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @IsString()
  pan?: string;
  @IsOptional()
  @IsString()
  gstin?: string;
  @IsOptional()
  @IsString()
  bankName?: string;
  @IsOptional()
  @IsString()
  accountNumber?: string;
  @IsOptional()
  @IsString()
  ifsc?: string;
  @IsOptional()
  @IsString()
  category?: string;
}

export class AcctBankDto {
  @IsString()
  name!: string;
  @IsString()
  bankName!: string;
  @IsString()
  accountNumber!: string;
  @IsOptional()
  @IsString()
  branch?: string;
  @IsOptional()
  @IsString()
  ifsc?: string;
  @IsOptional()
  @IsNumberString()
  openingBalance?: string;
}

export class AcctBillDto {
  @IsString()
  vendorId!: string;
  @IsString()
  billNo!: string;
  @IsString()
  billDate!: string;
  @IsOptional()
  @IsString()
  dueDate?: string;
  @IsArray()
  lines!: Array<{ accountId: string; description: string; amount: string }>;
}

export class AcctBudgetDto {
  @IsString()
  name!: string;
  @IsArray()
  lines!: Array<{
    accountId: string;
    amount: string;
    costCentreId?: string;
    monthKey?: string;
  }>;
}

export class AcctAssetDto {
  @IsString()
  name!: string;
  @IsString()
  category!: string;
  @IsString()
  purchaseDate!: string;
  @IsNumberString()
  purchaseValue!: string;
  @IsOptional()
  usefulLifeMonths?: number;
}

export class AcctTaxConfigDto {
  @IsString()
  taxKind!: string;
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  lawRef?: string;
  @IsOptional()
  @IsString()
  sectionRef?: string;
  rateBps!: number;
  @IsOptional()
  @IsNumberString()
  threshold?: string;
  @IsString()
  effectiveFrom!: string;
  @IsOptional()
  @IsString()
  effectiveTo?: string;
}

export class AcctCashCloseDto {
  @IsString()
  closeDate!: string;
  @IsNumberString()
  actualCash!: string;
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class AcctBankImportDto {
  @IsString()
  bankAccountId!: string;
  @IsArray()
  rows!: Array<{
    txnDate: string;
    amount: string;
    side: string;
    reference?: string;
    utr?: string;
    chequeNo?: string;
    narration?: string;
  }>;
}

export class AcctApprovalRuleDto {
  @IsOptional()
  @IsString()
  voucherType?: string;
  @IsNumberString()
  minAmount!: string;
  @IsOptional()
  @IsNumberString()
  maxAmount?: string;
  @IsString()
  approverRole!: string;
}

export class AcctGatewaySettleDto {
  @IsString()
  settlementId!: string;
  @IsNumberString()
  gross!: string;
  @IsNumberString()
  charges!: string;
  @IsNumberString()
  bank!: string;
}
