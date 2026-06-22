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
  @IsString()
  jobDescriptionHtml?: string;

  @IsOptional()
  @IsString()
  qualificationRequired?: string;

  @IsOptional()
  @IsString()
  experienceRequired?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsDateString()
  closingDate?: string;

  @IsOptional()
  @IsString()
  advertisementPdfUrl?: string;

  @IsOptional()
  @IsString()
  termsPdfUrl?: string;

  @IsOptional()
  @IsString()
  instructionsHtml?: string;

  @IsOptional()
  eligibilityJson?: unknown;
}

export class UpdateVacancyStatusDto {
  @IsString()
  status!: string;
}

export class UpdateVacancyDto {
  @IsOptional()
  @IsString()
  title?: string;

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
  @IsString()
  jobDescriptionHtml?: string;

  @IsOptional()
  @IsString()
  qualificationRequired?: string;

  @IsOptional()
  @IsString()
  experienceRequired?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsDateString()
  closingDate?: string;

  @IsOptional()
  @IsString()
  advertisementPdfUrl?: string;

  @IsOptional()
  @IsString()
  termsPdfUrl?: string;

  @IsOptional()
  @IsString()
  instructionsHtml?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  selectionCommitteeJson?: unknown;
}

export class UpdateApplicationStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  notify?: boolean;
}

export class SendDocumentsReminderDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  panelJson?: unknown;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
