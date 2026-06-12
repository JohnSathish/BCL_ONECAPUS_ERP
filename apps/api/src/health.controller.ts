import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('live')
  live() {
    return this.health.live();
  }

  @Public()
  @Get('ready')
  ready() {
    return this.health.ready();
  }
}
