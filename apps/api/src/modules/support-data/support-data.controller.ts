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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  SupportDataCreateDto,
  SupportDataImportCommitDto,
  SupportDataListQueryDto,
  SupportDataReorderDto,
  SupportDataStatusDto,
  SupportDataUpdateDto,
} from './dto/support-data.dto';
import { SupportDataService } from './support-data.service';

@ApiBearerAuth()
@ApiTags('support-data')
@Controller({ path: 'support-data', version: '1' })
export class SupportDataController {
  constructor(private readonly service: SupportDataService) {}

  @Get('categories')
  @RequireAnyPermission('lookups:read', 'lookups:manage')
  categories(@Query('group') group?: string) {
    return this.service.getCategories(group);
  }

  @Get(':category/export')
  @RequireAnyPermission('lookups:read', 'lookups:manage')
  async exportCategory(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Query() query: SupportDataListQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(user.tid, category, query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${category}-support-data.xlsx"`,
    );
    res.send(buffer);
  }

  @Post(':category/import/validate')
  @RequirePermissions('lookups:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async validateImport(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      return {
        valid: false,
        rows: [],
        errors: [{ row: 0, message: 'No file' }],
        total: 0,
      };
    }
    return this.service.validateImport(user.tid, category, file.buffer);
  }

  @Post(':category/import/commit')
  @RequirePermissions('lookups:manage')
  commitImport(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Body() dto: SupportDataImportCommitDto,
  ) {
    return this.service.commitImport(user.tid, category, dto.rows, user.sub);
  }

  @Patch(':category/reorder')
  @RequirePermissions('lookups:manage')
  reorder(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Body() dto: SupportDataReorderDto,
  ) {
    return this.service.reorder(user.tid, category, dto.ids, user.sub);
  }

  @Get(':category/meta')
  @RequireAnyPermission('lookups:read', 'lookups:manage')
  meta(@Param('category') category: string) {
    return this.service.getCategory(category);
  }

  @Get(':category')
  @RequireAnyPermission(
    'lookups:read',
    'lookups:manage',
    'students:read',
    'staff:read',
  )
  list(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Query() query: SupportDataListQueryDto,
  ) {
    return this.service.list(user.tid, category, query);
  }

  @Post(':category')
  @RequirePermissions('lookups:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Body() dto: SupportDataCreateDto,
  ) {
    return this.service.create(user.tid, category, dto.data, user.sub);
  }

  @Put(':category/:id')
  @RequirePermissions('lookups:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Param('id') id: string,
    @Body() dto: SupportDataUpdateDto,
  ) {
    return this.service.update(user.tid, category, id, dto.data, user.sub);
  }

  @Patch(':category/:id/status')
  @RequirePermissions('lookups:manage')
  setStatus(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Param('id') id: string,
    @Body() dto: SupportDataStatusDto,
  ) {
    return this.service.setStatus(
      user.tid,
      category,
      id,
      dto.isActive,
      user.sub,
    );
  }

  @Post(':category/:id/archive')
  @RequirePermissions('lookups:manage')
  archive(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Param('id') id: string,
  ) {
    return this.service.archive(user.tid, category, id, user.sub);
  }

  @Post(':category/:id/restore')
  @RequirePermissions('lookups:manage')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('category') category: string,
    @Param('id') id: string,
  ) {
    return this.service.restore(user.tid, category, id, user.sub);
  }
}
