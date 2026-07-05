import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AiChatDto {
  @IsString()
  @MaxLength(1000)
  question!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class AiSelectFieldsDto {
  @IsUUID()
  sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  columns!: string[];

  @IsOptional()
  @IsString()
  format?: 'xlsx' | 'csv' | 'pdf';
}

export class AiConfirmDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  confirmationId!: string;
}
