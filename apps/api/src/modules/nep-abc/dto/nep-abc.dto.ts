import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAbcAccountDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  abcId?: string;
}

export class CreateAbcTransactionDto {
  @IsString()
  abcAccountId!: string;

  @IsString()
  direction!: 'credit' | 'debit';

  @IsNumber()
  credits!: number;

  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class CreateCreditLedgerEntryDto {
  @IsString()
  studentId!: string;

  @IsNumber()
  credits!: number;

  @IsString()
  entryType!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
