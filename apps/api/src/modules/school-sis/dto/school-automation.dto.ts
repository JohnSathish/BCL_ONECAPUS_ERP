import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveAutomationWorkflowDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() module?: string;
  @IsString() triggerType!: string;
  @IsString() triggerEvent!: string;
  @IsObject() graphJson!: Record<string, unknown>;
  @IsOptional() @IsObject() scheduleJson?: Record<string, unknown>;
}

export class SaveAutomationTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() body!: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveAutomationSettingsDto {
  @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
  @IsOptional() @IsString() quietFrom?: string;
  @IsOptional() @IsString() quietTo?: string;
  @IsOptional() @IsString() holidayPolicy?: string;
  @IsOptional() maxSmsPerMinute?: number;
  @IsOptional() maxWaPerMinute?: number;
  @IsOptional() maxEmailPerMinute?: number;
  @IsOptional() maxPushPerMinute?: number;
  @IsOptional() retryAttempts?: number;
  @IsOptional() @IsBoolean() emergencyBypassQuiet?: boolean;
}

export class TestAutomationDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class RunAutomationDto {
  @IsOptional() @IsBoolean() confirm?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) studentIds?: string[];
}

export class AiWorkflowDto {
  @IsString() prompt!: string;
}

export class IncomingAutomationEventDto {
  @IsString() event!: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}
