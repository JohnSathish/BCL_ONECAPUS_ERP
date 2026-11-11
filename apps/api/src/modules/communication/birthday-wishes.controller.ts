import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  BirthdayHistoryQueryDto,
  BirthdayListQueryDto,
  PreviewBirthdayWishDto,
  SaveBirthdaySettingsDto,
  SaveBirthdayTemplateDto,
  SendBirthdayWishesDto,
} from './dto/birthday-wishes.dto';
import { BirthdayWishesService } from './services/birthday-wishes.service';

@ApiBearerAuth()
@ApiTags('communication')
@Controller({ path: 'communication/birthdays', version: '1' })
export class BirthdayWishesController {
  constructor(private readonly wishes: BirthdayWishesService) {}

  @Get('overview')
  @RequireAnyPermission('communication:read', 'communication:manage')
  overview(@CurrentUser() user: JwtUser) {
    return this.wishes.overview(user.tid);
  }

  @Get('calendar')
  @RequireAnyPermission('communication:read', 'communication:manage')
  calendar(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.wishes.calendar(user.tid, month);
  }

  @Get('history/export')
  @RequireAnyPermission('communication:read', 'communication:manage')
  async exportHistory(
    @CurrentUser() user: JwtUser,
    @Query() query: BirthdayHistoryQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.wishes.exportHistory(user.tid, {
      ...query,
      format: query.format === 'pdf' ? 'pdf' : 'xlsx',
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.body);
  }

  @Get('history')
  @RequireAnyPermission('communication:read', 'communication:manage')
  history(
    @CurrentUser() user: JwtUser,
    @Query() query: BirthdayHistoryQueryDto,
  ) {
    return this.wishes.history(user.tid, query);
  }

  @Get('templates')
  @RequireAnyPermission('communication:read', 'communication:manage')
  templates(@CurrentUser() user: JwtUser) {
    return this.wishes.templates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission('communication:manage')
  createTemplate(
    @CurrentUser() user: JwtUser,
    @Body() body: SaveBirthdayTemplateDto,
  ) {
    return this.wishes.saveTemplate(user, body);
  }

  @Patch('templates/:id')
  @RequireAnyPermission('communication:manage')
  updateTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SaveBirthdayTemplateDto,
  ) {
    return this.wishes.updateTemplate(user, id, body);
  }

  @Get('settings')
  @RequireAnyPermission('communication:read', 'communication:manage')
  settings(@CurrentUser() user: JwtUser) {
    return this.wishes.getSettings(user.tid);
  }

  @Put('settings')
  @RequireAnyPermission('communication:manage')
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: SaveBirthdaySettingsDto,
  ) {
    return this.wishes.saveSettings(user, body);
  }

  @Post('preview')
  @RequireAnyPermission('communication:manage')
  preview(@CurrentUser() user: JwtUser, @Body() body: PreviewBirthdayWishDto) {
    return this.wishes.preview(user.tid, body);
  }

  @Post('send')
  @RequireAnyPermission('communication:manage')
  send(@CurrentUser() user: JwtUser, @Body() body: SendBirthdayWishesDto) {
    return this.wishes.send(user, body);
  }

  @Get()
  @RequireAnyPermission('communication:read', 'communication:manage')
  list(@CurrentUser() user: JwtUser, @Query() query: BirthdayListQueryDto) {
    return this.wishes.list(user.tid, query);
  }
}
