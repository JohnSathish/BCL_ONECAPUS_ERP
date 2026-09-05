import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class SchoolApplicantRegisterDto {
  @IsString()
  @MinLength(2)
  childFullName!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date of birth must be a calendar date (YYYY-MM-DD)',
  })
  dateOfBirth!: string;

  @IsString()
  gender!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  phone!: string;

  @IsBoolean()
  @Equals(true, {
    message:
      'You must confirm Nursery attendance and the age eligibility rules',
  })
  acceptedPolicies!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class SchoolRequestOtpDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  childFullName?: string;
}

export class SchoolApplicantLoginDto {
  @IsString()
  @MinLength(4)
  applicationNumber!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class SchoolPasswordResetRequestDto {
  @IsString()
  @MinLength(4)
  emailOrApplicationNumber!: string;
}

export class SchoolPasswordResetConfirmDto {
  @IsString()
  @MinLength(4)
  emailOrApplicationNumber!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class SchoolSaveFormDraftDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  currentStep?: number;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  progressPercent?: number;
}

export class SchoolSavePaymentTransactionDto {
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/\- ]*$/, {
    message:
      'Enter a valid bank transaction / UTR / reference number (letters, numbers, hyphens, or slashes)',
  })
  paymentTransactionReference!: string;
}

export class SchoolOfficeListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsIn(['pending', 'verified', 'rejected', 'incomplete'])
  documentVerification?: 'pending' | 'verified' | 'rejected' | 'incomplete';

  @IsOptional()
  @IsIn(['ready', 'granted', 'not_granted'])
  decisionQueue?: 'ready' | 'granted' | 'not_granted';

  @IsOptional()
  @IsIn(['GENERAL_UR', 'SC', 'ST', 'OBC', 'OTHER'])
  category?: 'GENERAL_UR' | 'SC' | 'ST' | 'OBC' | 'OTHER';
}

export class SchoolVerifyPaymentDto {
  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class SchoolRejectPaymentDto {
  @IsString()
  @MinLength(3)
  remarks!: string;
}

export class SchoolVerifyDocumentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SchoolRejectDocumentDto {
  @IsString()
  @MinLength(3)
  remarks!: string;
}

export class SchoolDecisionDto {
  @IsIn(['GRANTED', 'NOT_GRANTED'])
  decision!: 'GRANTED' | 'NOT_GRANTED';

  @IsOptional()
  @IsString()
  indexNumber?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SchoolDocumentRequirementsUpdateDto {
  @IsObject()
  documentRequirements!: {
    rules: Array<{
      id?: string;
      slotCode: 'CASTE_CERT' | 'MOTHER_ST_CERT' | 'FATHER_SC_OBC_CERT';
      label: string;
      helperText?: string;
      communities?: string[];
      categories?: string[];
      required?: boolean;
    }>;
  };
}

export class SchoolAdmissionWindowUpdateDto {
  @IsBoolean()
  newAdmissionsEnabled!: boolean;

  /** ISO datetime or null to clear. */
  @IsOptional()
  @IsString()
  registrationOpensAt?: string | null;

  /** ISO datetime or null to clear. Last date/time for new applications. */
  @IsOptional()
  @IsString()
  registrationClosesAt?: string | null;
}
