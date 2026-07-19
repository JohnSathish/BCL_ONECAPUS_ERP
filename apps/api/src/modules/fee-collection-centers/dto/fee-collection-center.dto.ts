import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsNumber,
  Min,
  IsArray,
  IsIn,
} from 'class-validator';

export class RegisterFeeCollectionCenterDto {
  @IsString()
  @MinLength(2)
  businessName!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsString()
  mobileNumber!: string;

  @IsEmail()
  email!: string;

  @IsString()
  addressLine!: string;

  @IsString()
  district!: string;

  @IsString()
  state!: string;

  @IsString()
  pincode!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyCenterEmailDto {
  @IsUUID()
  centerId!: string;

  @IsString()
  token!: string;
}

export class VerifyCenterOtpDto {
  @IsUUID()
  centerId!: string;

  @IsString()
  otp!: string;
}

export class CenterStatusActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CenterPasswordResetDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class CenterStudentSearchDto {
  @IsString()
  @MinLength(2)
  query!: string;
}

export class CenterGatewayPayDto {
  @IsUUID()
  studentId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsArray()
  demandIds?: string[];
}

export class CenterReviewDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  reason?: string;
}
