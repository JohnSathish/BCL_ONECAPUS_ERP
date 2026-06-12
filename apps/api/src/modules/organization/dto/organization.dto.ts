import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export const DEPARTMENT_TYPES = [
  'ACADEMIC',
  'ARTS',
  'SCIENCE',
  'COMMERCE',
  'PROFESSIONAL',
  'INTERDISCIPLINARY',
  'ADMINISTRATIVE',
] as const;

export const DEPARTMENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class OrganizationReferenceQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class DepartmentListQueryDto {
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsIn(DEPARTMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(['ACADEMIC', 'ADMINISTRATIVE'])
  type?: 'ACADEMIC' | 'ADMINISTRATIVE';

  @IsOptional()
  @IsIn(['academic', 'administrative'])
  scope?: 'academic' | 'administrative';

  @IsOptional()
  @IsString()
  departmentType?: string;
}

export class FacultyQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreateInstitutionDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateCampusDto {
  @IsString()
  institutionId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateDepartmentDto {
  @IsUUID()
  institutionId!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsOptional()
  @IsIn(DEPARTMENT_TYPES)
  departmentType?: string;

  @IsOptional()
  @IsUUID()
  hodId?: string;

  @IsOptional()
  @IsIn(DEPARTMENT_STATUSES)
  status?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsUUID()
  campusId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsIn(DEPARTMENT_TYPES)
  departmentType?: string;

  @IsOptional()
  @IsUUID()
  hodId?: string | null;

  @IsOptional()
  @IsIn(DEPARTMENT_STATUSES)
  status?: string;
}

export class CreateAcademicYearDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;
}

export class CreateSemesterDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  sequence?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
