import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DashboardAiAskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;
}
