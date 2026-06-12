import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const HEX_COLOR = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export class UpdateBrandingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campusName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  portalSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'primaryColor must be a hex color' })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'accentColor must be a hex color' })
  accentColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'sidebarColor must be a hex color' })
  sidebarColor?: string;

  @IsOptional()
  @IsIn(['gradient', 'solid', 'mesh'])
  loginBackgroundStyle?: string;

  @IsOptional()
  @IsBoolean()
  showPoweredBy?: boolean;

  @IsOptional()
  @IsBoolean()
  brandingEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  badges?: string[];
}
