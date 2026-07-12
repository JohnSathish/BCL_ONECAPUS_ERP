import { IsOptional, IsString, MinLength } from 'class-validator';

export class IssueQrLoginDto {
  @IsOptional()
  @IsString()
  deviceHint?: string;
}

export class RedeemQrLoginDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class RedeemRfidLoginDto {
  @IsString()
  @MinLength(4)
  cardUid!: string;
}
