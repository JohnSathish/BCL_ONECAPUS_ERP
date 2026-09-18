import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SchoolSisAppearanceService } from './school-sis-appearance.service';
import {
  ImportAppearanceDto,
  SaveAppearanceDto,
  SaveAppearanceThemeDto,
} from './dto/school-appearance.dto';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
] as const;
const MANAGE = [SCHOOL_SIS_PERMISSION_MANAGE] as const;

@ApiBearerAuth()
@ApiTags('school-sis-appearance')
@Controller({ path: 'school-sis/appearance', version: '1' })
export class SchoolSisAppearanceController {
  constructor(private readonly appearance: SchoolSisAppearanceService) {}

  @Get()
  @RequireAnyPermission(...VIEW)
  get(@CurrentUser() user: JwtUser) {
    return this.appearance.get(user.tid, user);
  }

  @Get('published')
  @RequireAnyPermission(...VIEW)
  published(@CurrentUser() user: JwtUser) {
    return this.appearance.published(user.tid);
  }

  @Get('preview')
  @RequireAnyPermission(...VIEW)
  preview(@CurrentUser() user: JwtUser) {
    return this.appearance.get(user.tid, user);
  }

  @Put()
  @RequireAnyPermission(...MANAGE)
  put(@CurrentUser() user: JwtUser, @Body() dto: SaveAppearanceDto) {
    return this.appearance.saveDraft(user.tid, user, dto);
  }

  @Post('draft')
  @RequireAnyPermission(...MANAGE)
  draft(@CurrentUser() user: JwtUser, @Body() dto: SaveAppearanceDto) {
    return this.appearance.saveDraft(user.tid, user, dto);
  }

  @Post('publish')
  @RequireAnyPermission(...MANAGE)
  publish(@CurrentUser() user: JwtUser) {
    return this.appearance.publish(user.tid, user);
  }

  @Post('reset')
  @RequireAnyPermission(...MANAGE)
  reset(@CurrentUser() user: JwtUser) {
    return this.appearance.reset(user.tid, user);
  }

  @Get('versions')
  @RequireAnyPermission(...VIEW)
  versions(@CurrentUser() user: JwtUser) {
    return this.appearance.versions(user.tid, user);
  }

  @Post('versions/:id/restore')
  @RequireAnyPermission(...MANAGE)
  restore(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.appearance.restore(user.tid, user, id);
  }

  @Get('themes')
  @RequireAnyPermission(...VIEW)
  themes(@CurrentUser() user: JwtUser) {
    return this.appearance.listThemes(user.tid);
  }

  @Post('themes')
  @RequireAnyPermission(...MANAGE)
  saveTheme(@CurrentUser() user: JwtUser, @Body() dto: SaveAppearanceThemeDto) {
    return this.appearance.saveTheme(user.tid, user, dto.name, dto.description);
  }

  @Post('themes/:id/apply')
  @RequireAnyPermission(...MANAGE)
  applyTheme(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.appearance.applyTheme(user.tid, user, id);
  }

  @Delete('themes/:id')
  @RequireAnyPermission(...MANAGE)
  deleteTheme(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.appearance.deleteTheme(user.tid, user, id);
  }

  @Get('export')
  @Header('Content-Type', 'application/json')
  @RequireAnyPermission(...VIEW)
  exportJson(@CurrentUser() user: JwtUser) {
    return this.appearance.exportJson(user.tid, user);
  }

  @Post('import')
  @RequireAnyPermission(...MANAGE)
  importJson(@CurrentUser() user: JwtUser, @Body() dto: ImportAppearanceDto) {
    const snap =
      (dto.snapshot as { snapshot?: Record<string, unknown> }).snapshot ??
      dto.snapshot;
    return this.appearance.importJson(user.tid, user, snap);
  }

  @Post('logo')
  @RequireAnyPermission(...MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2_500_000 },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @Query('slot') slot: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.appearance.uploadLogo(user.tid, user, slot || 'logo', file);
  }
}
