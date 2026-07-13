import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpsertShortTermCourseDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() shortName?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() objectives?: string;
  @IsOptional() @IsArray() outcomes?: string[];
  @IsOptional() @IsString() bannerUrl?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsNumber() @Min(1) durationDays?: number;
  @IsOptional() @IsNumber() totalHours?: number;
  @IsOptional() @IsNumber() sessionsCount?: number;
  @IsOptional() @IsString() feeType?: string;
  @IsOptional() @IsObject() fees?: Record<string, unknown>;
  @IsOptional() @IsObject() eligibility?: Record<string, unknown>;
  @IsOptional() @IsNumber() @Min(1) maxSeats?: number;
  @IsOptional() @IsObject() certRules?: Record<string, unknown>;
  @IsOptional() @IsString() status?: string;
}

export class UpsertShortTermBatchDto {
  @IsUUID() courseId!: string;
  @IsString() batchCode!: string;
  @IsOptional() @IsDateString() regStartAt?: string;
  @IsOptional() @IsDateString() regEndAt?: string;
  @IsOptional() @IsDateString() courseStartAt?: string;
  @IsOptional() @IsDateString() courseEndAt?: string;
  @IsOptional() @IsString() classroom?: string;
  @IsOptional() @IsString() meetingLink?: string;
  @IsOptional() @IsString() status?: string;
}

export class AssignStaffDto {
  @IsUUID() staffUserId!: string;
  @IsString() role!: string;
}

export class UpsertSessionDto {
  @IsString() topic!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() venue?: string;
  @IsOptional() @IsString() meetingLink?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  rows!: Array<{ enrollmentId: string; status: string }>;
}

export class UpsertMaterialDto {
  @IsString() title!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() filePath?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

export class UpsertAssessmentDto {
  @IsString() title!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() maxMarks?: number;
  @IsOptional() @IsNumber() passMarks?: number;
  @IsOptional() @IsNumber() weightage?: number;
  @IsOptional() @IsBoolean() required?: boolean;
}

export class GradeAssessmentDto {
  @IsUUID() enrollmentId!: string;
  @IsNumber() marks!: number;
}

export class ApplyEnrollmentDto {
  @IsUUID() batchId!: string;
  @IsOptional() @IsBoolean() acceptTerms?: boolean;
}
