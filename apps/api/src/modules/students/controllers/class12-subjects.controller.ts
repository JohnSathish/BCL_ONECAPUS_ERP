import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { Class12SubjectsService } from '../services/class12-subjects.service';

@ApiBearerAuth()
@ApiTags('class12')
@Controller({ path: 'class12', version: '1' })
export class Class12SubjectsController {
  constructor(private readonly subjects: Class12SubjectsService) {}

  @Get('subjects')
  @RequireAnyPermission(
    'student:portal:self',
    'students:read',
    'students:manage',
    'lookups:read',
    'lookups:manage',
  )
  list(
    @CurrentUser() user: JwtUser,
    @Query('board') board?: string,
    @Query('stream') stream?: string,
  ) {
    return this.subjects.listByBoardAndStream(user.tid, board, stream);
  }
}
