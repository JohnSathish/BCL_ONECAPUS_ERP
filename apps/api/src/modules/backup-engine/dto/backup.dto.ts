import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  BACKUP_FREQUENCIES,
  BACKUP_TYPES,
  CLOUD_PROVIDERS,
  RESTORE_MODES,
} from '../backup.constants';

export class UpdateBackupScheduleDto {
  @ApiPropertyOptional({ enum: BACKUP_FREQUENCIES })
  @IsOptional()
  @IsIn([...BACKUP_FREQUENCIES])
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ enum: BACKUP_TYPES })
  @IsOptional()
  @IsIn([...BACKUP_TYPES])
  backupType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRetentionPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  keepCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  keepDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoCleanupEnabled?: boolean;
}

export class UpdateCloudTargetDto {
  @ApiProperty({ enum: CLOUD_PROVIDERS })
  @IsIn([...CLOUD_PROVIDERS])
  provider!: string;

  @ApiProperty()
  @IsString()
  bucket!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pathPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessKeyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretAccessKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TriggerBackupRunDto {
  @ApiProperty({ enum: BACKUP_TYPES })
  @IsIn([...BACKUP_TYPES])
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class TenantExportDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;
}

export class RestoreBackupDto {
  @ApiProperty()
  @IsUUID()
  runId!: string;

  @ApiProperty({ enum: RESTORE_MODES })
  @IsIn([...RESTORE_MODES])
  mode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmText?: string;
}

export class ListBackupRunsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class ListBackupLogsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;
}
