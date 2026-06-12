import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('branding')
@Controller({ path: 'branding', version: '1' })
@RequireAnyPermission(
  'tenant:read',
  'tenant:manage',
  'student:portal:self',
  'staff:portal:self',
)
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  get(@CurrentUser() user: JwtUser) {
    return this.branding.getOrCreate(user.tid);
  }

  @Get('audit')
  audit(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    const n = limit ? Math.min(Number(limit), 50) : 20;
    return this.branding.listAudit(user.tid, Number.isFinite(n) ? n : 20);
  }

  @Patch()
  @RequirePermissions('tenant:manage')
  update(@CurrentUser() user: JwtUser, @Body() dto: UpdateBrandingDto) {
    return this.branding.update(user.tid, user.sub, dto);
  }

  @Post('logo')
  @RequirePermissions('tenant:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadLogo(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branding.uploadAsset(user.tid, user.sub, 'logo', file);
  }

  @Post('favicon')
  @RequirePermissions('tenant:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadFavicon(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branding.uploadAsset(user.tid, user.sub, 'favicon', file);
  }

  @Get('theme')
  getTheme(@CurrentUser() user: JwtUser) {
    return this.branding.getOrCreateTheme(user.tid);
  }

  @Get('theme/presets')
  themePresets() {
    return this.branding.listThemePresets();
  }

  @Patch('theme')
  @RequirePermissions('tenant:manage')
  updateTheme(@CurrentUser() user: JwtUser, @Body() dto: UpdateThemeDto) {
    return this.branding.updateTheme(user.tid, user.sub, dto);
  }

  @Post('theme/preset/:name')
  @RequirePermissions('tenant:manage')
  applyPreset(@CurrentUser() user: JwtUser, @Param('name') name: string) {
    return this.branding.applyThemePreset(user.tid, user.sub, name);
  }

  @Get('theme/export')
  exportTheme(@CurrentUser() user: JwtUser) {
    return this.branding.exportTheme(user.tid);
  }

  @Post('theme/import')
  @RequirePermissions('tenant:manage')
  importTheme(
    @CurrentUser() user: JwtUser,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.branding.importTheme(user.tid, user.sub, payload);
  }
}
