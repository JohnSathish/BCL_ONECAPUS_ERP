import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { KioskScanDto } from '../dto/campus-access.dto';
import { CampusKioskService } from '../services/campus-kiosk.service';

@ApiTags('campus-access-kiosk')
@Controller({ path: 'public/kiosk', version: '1' })
export class CampusKioskPublicController {
  constructor(private readonly kiosk: CampusKioskService) {}

  @Public()
  @Get(':code/bootstrap')
  bootstrap(@Param('code') code: string, @Query('token') token: string) {
    if (!token?.trim()) throw new BadRequestException('token required');
    return this.kiosk.bootstrap(code, token);
  }

  @Public()
  @Get(':code/live')
  live(@Param('code') code: string, @Query('token') token: string) {
    if (!token?.trim()) throw new BadRequestException('token required');
    return this.kiosk.live(code, token);
  }

  @Public()
  @Post(':code/scan')
  scan(
    @Param('code') code: string,
    @Query('token') token: string,
    @Body() dto: KioskScanDto,
  ) {
    if (!token?.trim()) throw new BadRequestException('token required');
    return this.kiosk.scan(code, token, dto.scanCode);
  }
}
