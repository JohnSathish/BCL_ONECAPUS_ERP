import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';

export class UpsertAcademicSettingsDto {
  @IsOptional()
  @IsBoolean()
  cbcsEnabled?: boolean;

  @IsOptional()
  @IsObject()
  nepProfile?: {
    multipleEntryExit?: boolean;
    abcEnabled?: boolean;
    interdisciplinaryEnabled?: boolean;
    skillCoursesRequired?: boolean;
  };

  @IsOptional()
  @IsObject()
  creditPolicy?: {
    minCreditsPerSemester?: number;
    maxCreditsPerSemester?: number;
    minCreditsForDegree?: number;
    gradePointScale?: number;
    defaultSharedPoolCapacity?: number;
  };
}

export class NepProfileDto {
  @IsOptional()
  @IsBoolean()
  multipleEntryExit?: boolean;

  @IsOptional()
  @IsBoolean()
  abcEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  interdisciplinaryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  skillCoursesRequired?: boolean;
}

export class CreditPolicyDto {
  @IsOptional()
  @IsNumber()
  minCreditsPerSemester?: number;

  @IsOptional()
  @IsNumber()
  maxCreditsPerSemester?: number;

  @IsOptional()
  @IsNumber()
  minCreditsForDegree?: number;

  @IsOptional()
  @IsNumber()
  gradePointScale?: number;

  @IsOptional()
  @IsNumber()
  defaultSharedPoolCapacity?: number;
}
