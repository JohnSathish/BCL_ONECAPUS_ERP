import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { FacultyShiftsService } from './faculty-shifts.service';

@ApiBearerAuth()
@ApiTags('faculty-shifts')
@Controller({ path: 'faculty-shifts', version: '1' })
export class FacultyShiftsController {
  constructor(private readonly service: FacultyShiftsService) {}

  @Get()
  @RequirePermissions('shift:read')
  list(@CurrentUser() user: JwtUser, @Query('shiftId') shiftId: string) {
    return this.service.listForShift(user, shiftId);
  }

  @Post()
  @RequirePermissions('shift:manage')
  assign(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: { facultyId: string; shiftId: string; hoursPerWeek?: number },
  ) {
    return this.service.assign(
      user,
      dto.facultyId,
      dto.shiftId,
      dto.hoursPerWeek,
    );
  }

  @Delete(':facultyId/:shiftId')
  @RequirePermissions('shift:manage')
  unassign(
    @CurrentUser() user: JwtUser,
    @Param('facultyId') facultyId: string,
    @Param('shiftId') shiftId: string,
  ) {
    return this.service.unassign(user, facultyId, shiftId);
  }
}
