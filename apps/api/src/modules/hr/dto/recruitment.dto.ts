import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateVacancyDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsString()
  staffType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  vacanciesCount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  closingDate?: string;
}

export class UpdateVacancyStatusDto {
  @IsString()
  status!: string;
}

export class CreateRecruitmentApplicationDto {
  @IsUUID()
  vacancyId!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsInt()
  experienceYears?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInterviewDto {
  @IsUUID()
  applicationId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  panelJson?: unknown;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOfferDto {
  @IsUUID()
  applicationId!: string;

  @IsOptional()
  @IsNumber()
  offeredSalary?: number;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;
}

export class AcceptOfferDto {
  @IsUUID()
  staffProfileId!: string;
}
