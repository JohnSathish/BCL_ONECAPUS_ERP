import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateAbcAccountDto,
  CreateAbcTransactionDto,
  CreateCreditLedgerEntryDto,
} from './dto/nep-abc.dto';
import { NepAbcService } from './nep-abc.service';

@ApiBearerAuth()
@ApiTags('nep-abc')
@RequireAnyPermission('abc:read', 'abc:manage', 'academic:read')
@Controller({ path: 'nep-abc', version: '1' })
export class NepAbcController {
  constructor(private readonly service: NepAbcService) {}

  @Get('students/:studentId/credits')
  ledger(@CurrentUser() user: JwtUser, @Param('studentId') studentId: string) {
    return this.service.getStudentLedger(user.tid, studentId);
  }

  @Get('students/:studentId/credits/balance')
  balance(@CurrentUser() user: JwtUser, @Param('studentId') studentId: string) {
    return this.service.getStudentCreditBalance(user.tid, studentId);
  }

  @Post('credits')
  createLedger(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCreditLedgerEntryDto,
  ) {
    return this.service.createLedgerEntry(user.tid, dto);
  }

  @Get('students/:studentId/abc')
  abcAccount(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.service.getAbcAccount(user.tid, studentId);
  }

  @Post('abc/accounts')
  createAbc(@CurrentUser() user: JwtUser, @Body() dto: CreateAbcAccountDto) {
    return this.service.createAbcAccount(user.tid, dto);
  }

  @Post('abc/transactions')
  createTxn(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAbcTransactionDto,
  ) {
    return this.service.createAbcTransaction(user.tid, dto);
  }

  @Get('students/:studentId/abc/export')
  export(@CurrentUser() user: JwtUser, @Param('studentId') studentId: string) {
    return this.service.exportPortabilityPayload(user.tid, studentId);
  }
}
