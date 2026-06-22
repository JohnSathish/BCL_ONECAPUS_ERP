import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AppointmentOrderService } from './services/appointment-order.service';

@ApiTags('verify')
@Controller({ path: 'verify/appointment-order', version: '1' })
export class AppointmentOrderVerifyController {
  constructor(private readonly orders: AppointmentOrderService) {}

  @Public()
  @Get(':token')
  verify(@Param('token') token: string) {
    return this.orders.verifyPublic(token);
  }
}
