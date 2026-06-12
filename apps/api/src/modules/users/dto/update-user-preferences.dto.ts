import { IsIn, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  appearanceMode?: 'light' | 'dark' | 'system';
}
