import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import {
  AssignLibraryDepartmentDto,
  CatalogueReportQueryDto,
} from '../dto/catalogue-report.dto';
import { LibraryDepartmentInventoryService } from './library-department-inventory.service';

@ApiBearerAuth()
@ApiTags('library')
@RequireAnyPermission('library:reports', 'library:manage', 'library:read')
@Controller({ path: 'library/department-inventory', version: '1' })
export class LibraryDepartmentInventoryController {
  constructor(private readonly inventory: LibraryDepartmentInventoryService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: JwtUser,
    @Query() query: CatalogueReportQueryDto,
  ) {
    return this.inventory.summary(user.tid, query);
  }

  @Get('books')
  books(@CurrentUser() user: JwtUser, @Query() query: CatalogueReportQueryDto) {
    return this.inventory.books(user.tid, query);
  }

  @Get('books/:bookId/copies')
  copies(
    @CurrentUser() user: JwtUser,
    @Param('bookId', ParseUUIDPipe) bookId: string,
  ) {
    return this.inventory.copyRows(user.tid, bookId);
  }

  @Get('register')
  register(
    @CurrentUser() user: JwtUser,
    @Query() query: CatalogueReportQueryDto,
  ) {
    return this.inventory.accessionRegister(user.tid, query);
  }

  @Get('unmapped')
  unmapped(
    @CurrentUser() user: JwtUser,
    @Query() query: CatalogueReportQueryDto,
  ) {
    return this.inventory.unmapped(user.tid, query);
  }

  @Get('export')
  async download(
    @CurrentUser() user: JwtUser,
    @Query() query: CatalogueReportQueryDto,
    @Res() res: Response,
  ) {
    const format =
      query.format === 'csv' || query.format === 'pdf' ? query.format : 'xlsx';
    const file = await this.inventory.export(user.tid, user, query, format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="department-inventory.${file.extension}"`,
    );
    res.send(file.body);
  }

  @Post('assign')
  @RequireAnyPermission('library:manage')
  assign(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignLibraryDepartmentDto,
  ) {
    return this.inventory.assign(user.tid, dto);
  }
}
