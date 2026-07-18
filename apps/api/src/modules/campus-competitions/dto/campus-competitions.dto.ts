import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  HOUSE_COORDINATOR_ROLES,
  MEET_STATUSES,
  MEET_TYPES,
} from '../domain/competition.constants';

export class UpsertHouseDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  motto?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: string;
}

export class UpsertCoordinatorDto {
  @IsUUID()
  staffId!: string;

  @IsIn([...HOUSE_COORDINATOR_ROLES])
  role!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AllocateStudentsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsUUID()
  houseId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class AutoAllocateDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsBoolean()
  balanceGender?: boolean;

  @IsOptional()
  @IsBoolean()
  balanceDepartment?: boolean;
}

export class TransferStudentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  toHouseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AllocateByKeysDto {
  @IsUUID()
  houseId!: string;

  @IsArray()
  @IsString({ each: true })
  studentKeys!: string[];

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class TransferByKeyDto {
  @IsString()
  studentKey!: string;

  @IsUUID()
  toHouseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkTransferDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsUUID()
  toHouseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignBibsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  startFrom?: number;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpsertMeetDto {
  @IsString()
  name!: string;

  @IsIn(MEET_TYPES.map((t) => t.code))
  meetType!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class TransitionMeetStatusDto {
  @IsIn([...MEET_STATUSES])
  status!: string;
}

export class UpsertPointRulesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  firstPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  secondPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  thirdPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  participationPoints?: number;
}

export class UpsertEventDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['OPEN', 'MALE', 'FEMALE', 'MIXED'])
  gender?: string;

  @IsOptional()
  @IsString()
  ageGroup?: string;

  @IsOptional()
  @IsIn(['INDIVIDUAL', 'TEAM'])
  entryMode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamSize?: number;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsUUID()
  judgeStaffId?: string;
}

export class RegisterEntryDto {
  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  houseId?: string;
}

export class CreateTeamDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  houseId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members?: TeamMemberDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberKeys?: string[];
}

export class TeamMemberDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  sequence?: number;
}

export class GenerateFixturesDto {
  @IsOptional()
  @IsIn(['HEATS', 'KNOCKOUT', 'ROUND_ROBIN'])
  mode?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  heatSize?: number;
}

export class ResultItemDto {
  @IsOptional()
  @IsUUID()
  entryId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsInt()
  @Min(1)
  position!: number;

  @IsOptional()
  @IsString()
  metricValue?: string;

  @IsOptional()
  @IsString()
  metricUnit?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpsertResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultItemDto)
  results!: ResultItemDto[];

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
