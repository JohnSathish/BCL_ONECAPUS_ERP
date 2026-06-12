import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const HEX_COLOR = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  themeName?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'primaryColor must be a hex color' })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'sidebarBg must be a hex color' })
  sidebarBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'sidebarText must be a hex color' })
  sidebarText?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'sidebarActive must be a hex color' })
  sidebarActive?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'topbarBg must be a hex color' })
  topbarBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'cardBg must be a hex color' })
  cardBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'borderColor must be a hex color' })
  borderColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'accentColor must be a hex color' })
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fontFamily?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  darkModeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  compactSidebar?: boolean;

  @IsOptional()
  @IsIn(['sm', 'md', 'lg', 'xl', '2xl'])
  roundedStyle?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  appearanceMode?: string;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  customCss?: string;

  @IsOptional()
  @IsBoolean()
  customCssEnabled?: boolean;
}
