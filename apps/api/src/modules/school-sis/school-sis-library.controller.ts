import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { RequiresSchoolLicense } from './school-sis-license.decorators';
import {
  SIS_LIB_FINES,
  SIS_LIB_ISSUE,
  SIS_LIB_MANAGE,
  SIS_LIB_RETURN,
  SIS_LIB_SELF,
  SIS_LIB_VIEW,
} from './school-sis-library.perms';
import { SchoolSisLibraryService } from './school-sis-library.service';

@ApiBearerAuth()
@ApiTags('school-sis-library')
@RequiresSchoolLicense('library')
@Controller({ path: 'school-sis/library', version: '1' })
export class SchoolSisLibraryController {
  constructor(private readonly lib: SchoolSisLibraryService) {}

  @Get('dashboard')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  dash(@CurrentUser() user: JwtUser) {
    return this.lib.dashboard(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.lib.ensure(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.saveSettings(user.tid, body);
  }

  @Get('rules')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  rules(@CurrentUser() user: JwtUser) {
    return this.lib.rules(user.tid);
  }

  @Post('rules')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  saveRule(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.saveRule(user.tid, body);
  }

  @Get('masters')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  masters(@CurrentUser() user: JwtUser) {
    return this.lib.masters(user.tid);
  }

  @Post('masters/:kind')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  saveMaster(
    @CurrentUser() user: JwtUser,
    @Param('kind') kind: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.saveMaster(user.tid, kind, body);
  }

  @Get('books')
  @RequireAnyPermission(...SIS_LIB_VIEW, ...SIS_LIB_SELF)
  books(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('available') available?: string,
  ) {
    return this.lib.books(user.tid, { search, available });
  }

  @Get('books/:id')
  @RequireAnyPermission(...SIS_LIB_VIEW, ...SIS_LIB_SELF)
  book(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lib.getBook(user.tid, id);
  }

  @Post('books')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  saveBook(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.saveBook(user.tid, body);
  }

  @Patch('books/:id')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  editBook(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.saveBook(user.tid, body, id);
  }

  @Post('books/:id/copies')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  copies(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { qty?: number; locationId?: string },
  ) {
    return this.lib.addCopies(user.tid, id, body.qty ?? 1, body.locationId);
  }

  @Post('labels')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  async labels(
    @CurrentUser() user: JwtUser,
    @Body() body: { copyIds: string[] },
    @Res() res: Response,
  ) {
    const out = await this.lib.labelsPdf(user.tid, body.copyIds ?? []);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    return res.send(out.buffer);
  }

  @Post('members/sync')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  sync(@CurrentUser() user: JwtUser) {
    return this.lib.syncMembers(user.tid);
  }

  @Get('members')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  members(
    @CurrentUser() user: JwtUser,
    @Query('kind') kind?: string,
    @Query('search') search?: string,
  ) {
    return this.lib.members(user.tid, kind, search);
  }

  @Get('lookup/member')
  @RequireAnyPermission(...SIS_LIB_ISSUE, ...SIS_LIB_RETURN)
  lookupMember(@CurrentUser() user: JwtUser, @Query('q') q = '') {
    return this.lib.lookupMember(user.tid, q);
  }

  @Get('lookup/copy')
  @RequireAnyPermission(...SIS_LIB_ISSUE, ...SIS_LIB_RETURN)
  lookupCopy(@CurrentUser() user: JwtUser, @Query('q') q = '') {
    return this.lib.lookupCopy(user.tid, q);
  }

  @Post('loans')
  @RequireAnyPermission(...SIS_LIB_ISSUE)
  issue(
    @CurrentUser() user: JwtUser,
    @Body() body: { memberQuery: string; copyQuery: string },
    @Req() req: Request,
  ) {
    return this.lib.issue(user.tid, body, user.sub, extractClientIp(req));
  }

  @Post('loans/return')
  @RequireAnyPermission(...SIS_LIB_RETURN)
  ret(
    @CurrentUser() user: JwtUser,
    @Body() body: { copyQuery: string; condition?: string; notes?: string },
    @Req() req: Request,
  ) {
    return this.lib.returnCopy(user.tid, body, user.sub, extractClientIp(req));
  }

  @Post('loans/:id/renew')
  @RequireAnyPermission(...SIS_LIB_ISSUE, ...SIS_LIB_SELF)
  renew(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lib.renew(user.tid, id, user.sub);
  }

  @Get('loans')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  loans(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.lib.loans(user.tid, status);
  }

  @Get('reservations')
  @RequireAnyPermission(...SIS_LIB_VIEW, ...SIS_LIB_SELF)
  reservations(@CurrentUser() user: JwtUser) {
    return this.lib.reservations(user.tid);
  }

  @Post('reservations')
  @RequireAnyPermission(...SIS_LIB_ISSUE, ...SIS_LIB_SELF)
  reserve(
    @CurrentUser() user: JwtUser,
    @Body() body: { bookId: string; memberId: string },
  ) {
    return this.lib.reserve(user.tid, body.bookId, body.memberId);
  }

  @Get('fines')
  @RequireAnyPermission(...SIS_LIB_VIEW, ...SIS_LIB_FINES)
  fines(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.lib.fines(user.tid, status);
  }

  @Post('fines/:id/pay')
  @RequireAnyPermission(...SIS_LIB_FINES)
  pay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { amount?: number; mode?: string },
  ) {
    return this.lib.payFine(user.tid, id, body, user.sub);
  }

  @Post('fines/:id/waive')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  waive(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.lib.waiveFine(user.tid, id, body.reason || 'Waived', user.sub);
  }

  @Post('copies/:id/lost')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  lost(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { recovery?: number },
  ) {
    return this.lib.markLost(user.tid, id, user.sub, body.recovery);
  }

  @Get('purchases')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  purchases(@CurrentUser() user: JwtUser) {
    return this.lib.purchases(user.tid);
  }

  @Post('purchases')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  savePurchase(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lib.savePurchase(user.tid, body, user.sub);
  }

  @Post('purchases/:id/receive')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  receive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lib.receivePurchase(user.tid, id);
  }

  @Post('stock')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  startStock(@CurrentUser() user: JwtUser) {
    return this.lib.startStock(user.tid, user.sub);
  }

  @Post('stock/:id/scan')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  scan(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { barcode: string },
  ) {
    return this.lib.scanStock(user.tid, id, body.barcode);
  }

  @Post('stock/:id/close')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  closeStock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lib.closeStock(user.tid, id);
  }

  @Get('clearance/:studentId')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  clearance(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.lib.clearance(user.tid, studentId);
  }

  @Get('me')
  @RequireAnyPermission(...SIS_LIB_SELF)
  me(@CurrentUser() user: JwtUser, @Query('studentId') studentId?: string) {
    return this.lib.mine(user.tid, user.sub, studentId);
  }

  @Get('audit')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  audit(@CurrentUser() user: JwtUser) {
    return this.lib.audit(user.tid);
  }

  @Get('activity')
  @RequireAnyPermission(...SIS_LIB_MANAGE)
  activity(@CurrentUser() user: JwtUser) {
    return this.lib.librarianActivity(user.tid);
  }

  @Get('export/:key')
  @RequireAnyPermission(...SIS_LIB_VIEW)
  async export(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query('format') format: 'pdf' | 'xlsx' | 'csv' | 'html' = 'pdf',
    @Res() res: Response,
  ) {
    const out = await this.lib.exportReport(user.tid, key, format);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    return res.send(out.buffer);
  }
}
