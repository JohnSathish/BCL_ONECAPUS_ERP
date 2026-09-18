import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SaveAppearanceDto {
  @IsOptional() @IsString() theme?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() successColor?: string;
  @IsOptional() @IsString() warningColor?: string;
  @IsOptional() @IsString() dangerColor?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsString() logoUrl?: string | null;
  @IsOptional() @IsString() darkLogoUrl?: string | null;
  @IsOptional() @IsString() mobileLogoUrl?: string | null;
  @IsOptional() @IsString() faviconUrl?: string | null;
  @IsOptional() @IsString() sidebarStyle?: string;
  @IsOptional() @IsInt() @Min(200) @Max(360) sidebarWidth?: number;
  @IsOptional() @IsString() sidebarPosition?: string;
  @IsOptional() @IsInt() @Min(8) @Max(24) borderRadius?: number;
  @IsOptional() @IsString() cardStyle?: string;
  @IsOptional() @IsString() buttonStyle?: string;
  @IsOptional() @IsString() loginLayout?: string;
  @IsOptional() @IsString() loginBackground?: string;
  @IsOptional() @IsInt() @Min(0) @Max(90) loginOverlay?: number;
  @IsOptional() @IsString() customCss?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() contrastOverride?: boolean;
}

export class SaveAppearanceThemeDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
}

export class ImportAppearanceDto {
  @IsObject() snapshot!: Record<string, unknown>;
}
