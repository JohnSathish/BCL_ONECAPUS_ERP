import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  BulkClearanceDto,
  ClearanceListQueryDto,
  ClearancePreviewQueryDto,
  ClearancePrintDto,
  ClearanceStudentSearchDto,
  SaveClearanceDto,
  UpdateClearanceDto,
} from './dto/library-clearance.dto';
import { LibraryClearanceService } from './services/library-clearance.service';

const LIB_READ = [
  'library:read',
  'library:manage',
  'library:circulate',
  'library:reports',
] as const;
const LIB_WRITE = ['library:circulate', 'library:manage'] as const;

@ApiBearerAuth()
@ApiTags('library-clearance')
@Controller({ path: 'library/clearance', version: '1' })
export class LibraryClearanceController {
  constructor(private readonly clearance: LibraryClearanceService) {}

  @Get('options')
  @RequireAnyPermission(...LIB_READ)
  options(@CurrentUser() user: JwtUser) {
    return this.clearance.options(user.tid, user.sub);
  }

  @Get('records')
  @RequireAnyPermission(...LIB_READ)
  records(@CurrentUser() user: JwtUser, @Query() query: ClearanceListQueryDto) {
    return this.clearance.list(user.tid, query);
  }

  @Get('students/search')
  @RequireAnyPermission(...LIB_READ)
  searchStudents(
    @CurrentUser() user: JwtUser,
    @Query() query: ClearanceStudentSearchDto,
  ) {
    return this.clearance.searchStudents(user.tid, query.q ?? '');
  }

  @Get('students/:studentId/preview')
  @RequireAnyPermission(...LIB_READ)
  preview(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Query() query: ClearancePreviewQueryDto,
  ) {
    return this.clearance.preview(user.tid, studentId, query);
  }

  @Get('students/:studentId/history')
  @RequireAnyPermission(...LIB_READ)
  history(@CurrentUser() user: JwtUser, @Param('studentId') studentId: string) {
    return this.clearance.history(user.tid, studentId);
  }

  @Post('bulk')
  @RequireAnyPermission(...LIB_WRITE)
  bulk(@CurrentUser() user: JwtUser, @Body() dto: BulkClearanceDto) {
    return this.clearance.bulk(user.tid, user.sub, dto);
  }

  @Post('print')
  @RequireAnyPermission(...LIB_READ)
  print(@CurrentUser() user: JwtUser, @Body() dto: ClearancePrintDto) {
    return this.clearance.printHtml(
      user.tid,
      dto.ids,
      dto.layout ?? 'single',
      dto.autoPrint !== false,
    );
  }

  @Post('pdf')
  @Header('Cache-Control', 'no-store')
  @RequireAnyPermission(...LIB_READ)
  async pdf(@CurrentUser() user: JwtUser, @Body() dto: ClearancePrintDto) {
    const file = await this.clearance.printPdf(
      user.tid,
      dto.ids,
      dto.layout ?? 'single',
    );
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Get(':id')
  @RequireAnyPermission(...LIB_READ)
  detail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clearance.detail(user.tid, id);
  }

  @Post()
  @RequireAnyPermission(...LIB_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: SaveClearanceDto) {
    return this.clearance.create(user.tid, user.sub, dto);
  }

  @Patch(':id')
  @RequireAnyPermission(...LIB_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateClearanceDto,
  ) {
    return this.clearance.update(user.tid, user.sub, id, dto);
  }

  @Post(':id/recheck')
  @RequireAnyPermission(...LIB_WRITE)
  recheck(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clearance.recheck(user.tid, user.sub, id);
  }

  @Post(':id/regenerate')
  @RequireAnyPermission(...LIB_WRITE)
  regenerate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clearance.regenerate(user.tid, user.sub, id);
  }
}
