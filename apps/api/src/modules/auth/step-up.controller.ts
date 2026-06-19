import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { StepUpService } from './step-up.service';
import { IsOptional, IsString, Length } from 'class-validator';

class StepUpDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  @Length(4, 12)
  totpCode?: string;
}

@ApiBearerAuth()
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class StepUpController {
  constructor(private readonly stepUp: StepUpService) {}

  @Post('step-up')
  stepUpAuth(@CurrentUser() user: JwtUser, @Body() dto: StepUpDto) {
    return this.stepUp.authenticate(user.sub, dto);
  }
}
