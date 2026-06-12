import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateCoPoMapDto,
  CreateCourseOutcomeDto,
  CreateProgramOutcomeDto,
  RunAttainmentDto,
} from './dto/obe.dto';
import { ObeService } from './obe.service';

@ApiBearerAuth()
@ApiTags('obe')
@RequireAnyPermission('obe:read', 'obe:manage', 'academic:read')
@Controller({ path: 'obe', version: '1' })
export class ObeController {
  constructor(private readonly service: ObeService) {}

  @Get('program-outcomes')
  programOutcomes(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId: string,
  ) {
    return this.service.listProgramOutcomes(user.tid, programVersionId);
  }

  @Post('program-outcomes')
  createPo(@CurrentUser() user: JwtUser, @Body() dto: CreateProgramOutcomeDto) {
    return this.service.createProgramOutcome(user.tid, dto);
  }

  @Get('course-outcomes')
  courseOutcomes(
    @CurrentUser() user: JwtUser,
    @Query('courseId') courseId: string,
  ) {
    return this.service.listCourseOutcomes(user.tid, courseId);
  }

  @Post('course-outcomes')
  createCo(@CurrentUser() user: JwtUser, @Body() dto: CreateCourseOutcomeDto) {
    return this.service.createCourseOutcome(user.tid, dto);
  }

  @Get('mappings')
  mappings(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId?: string,
  ) {
    return this.service.listMappings(user.tid, programVersionId);
  }

  @Post('mappings')
  createMapping(@CurrentUser() user: JwtUser, @Body() dto: CreateCoPoMapDto) {
    return this.service.createMapping(user.tid, dto);
  }

  @Post('attainment/runs')
  runAttainment(@CurrentUser() user: JwtUser, @Body() dto: RunAttainmentDto) {
    return this.service.runAttainment(user.tid, dto);
  }

  @Get('attainment/runs/:programVersionId')
  listRuns(
    @CurrentUser() user: JwtUser,
    @Param('programVersionId') programVersionId: string,
  ) {
    return this.service.listAttainmentRuns(user.tid, programVersionId);
  }
}
