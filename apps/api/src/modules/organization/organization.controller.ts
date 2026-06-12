import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { UpsertAcademicSettingsDto } from './dto/academic-settings.dto';
import {
  CreateAcademicYearDto,
  CreateCampusDto,
  CreateDepartmentDto,
  DepartmentListQueryDto,
  FacultyQueryDto,
  CreateInstitutionDto,
  CreateSemesterDto,
  OrganizationReferenceQueryDto,
  UpdateDepartmentDto,
} from './dto/organization.dto';
import { resolveDepartmentGroupFromQuery } from './department-rules';
import { OrganizationService } from './organization.service';

@ApiBearerAuth()
@ApiTags('organization')
@RequireAnyPermission('org:read', 'org:manage')
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Get('institutions')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  institutions(@CurrentUser() user: JwtUser) {
    return this.org.listInstitutions(user.tid);
  }

  @Post('institutions')
  @RequirePermissions('org:manage')
  createInstitution(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInstitutionDto,
  ) {
    return this.org.createInstitution(user.tid, dto);
  }

  @Get('campuses')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  campuses(
    @CurrentUser() user: JwtUser,
    @Query() query: OrganizationReferenceQueryDto,
  ) {
    return this.org.listCampuses(user.tid, query.institutionId);
  }

  @Post('campuses')
  createCampus(@CurrentUser() user: JwtUser, @Body() dto: CreateCampusDto) {
    return this.org.createCampus(user.tid, dto);
  }

  @Get('departments')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  departments(
    @CurrentUser() user: JwtUser,
    @Query() query: DepartmentListQueryDto,
  ) {
    const resolvedType = resolveDepartmentGroupFromQuery({
      type: query.type,
      scope: query.scope,
    });
    return this.org.listDepartments(user.tid, {
      campusId: query.campusId,
      institutionId: query.institutionId,
      status: query.status,
      type: resolvedType,
      departmentType: query.departmentType,
    });
  }

  @Get('departments/:id')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  getDepartment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.org.getDepartment(user.tid, id);
  }

  @Post('departments')
  createDepartment(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.org.createDepartment(user.tid, dto);
  }

  @Patch('departments/:id')
  updateDepartment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.org.updateDepartment(user.tid, id, dto);
  }

  @Get('faculty')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  facultyForHod(@CurrentUser() user: JwtUser, @Query() query: FacultyQueryDto) {
    return this.org.listFacultyForHod(user.tid, query.departmentId);
  }

  @Get('academic-years')
  @RequireAnyPermission(
    'org:read',
    'org:manage',
    'academic:read',
    'academic:manage',
  )
  academicYears(@CurrentUser() user: JwtUser) {
    return this.org.listAcademicYears(user.tid);
  }

  @Post('academic-years')
  createAcademicYear(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAcademicYearDto,
  ) {
    return this.org.createAcademicYear(user.tid, dto);
  }

  @Post('semesters')
  createSemester(@CurrentUser() user: JwtUser, @Body() dto: CreateSemesterDto) {
    return this.org.createSemester(user.tid, dto);
  }

  @Get('setup-summary')
  setupSummary(@CurrentUser() user: JwtUser) {
    return this.org.getSetupSummary(user.tid);
  }

  @Get('academic-settings')
  academicSettings(@CurrentUser() user: JwtUser) {
    return this.org.getAcademicSettings(user.tid);
  }

  @Patch('academic-settings')
  updateAcademicSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertAcademicSettingsDto,
  ) {
    return this.org.upsertAcademicSettings(user.tid, dto);
  }

  @Delete('institutions/:id')
  deleteInstitution(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.org.softDeleteInstitution(user.tid, id);
  }

  @Delete('campuses/:id')
  deleteCampus(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.org.softDeleteCampus(user.tid, id);
  }

  @Delete('departments/:id')
  deleteDepartment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.org.softDeleteDepartment(user.tid, id);
  }
}
