import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DemoRequestService } from './demo-request.service';
import { DemoRequestDto } from './dto/demo-request.dto';

@ApiTags('marketing')
@Controller({ path: 'marketing', version: '1' })
export class DemoRequestController {
  constructor(private readonly demoRequests: DemoRequestService) {}

  @Public()
  @Post('demo-request')
  submit(@Body() dto: DemoRequestDto) {
    return this.demoRequests.submit(dto);
  }
}
