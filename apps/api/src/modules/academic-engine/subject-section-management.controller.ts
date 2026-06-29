import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  AutoDivideSubjectSectionsDto,
  BulkProvisionSubjectSectionsDto,
  CreateSubjectSectionDto,
  ImportSectionAllocationsDto,
  MoveStudentSectionDto,
  SubjectSectionFiltersDto,
  UpdateSubjectSectionDto,
} from './dto/subject-section.dto';
import { SubjectSectionManagementService } from './services/subject-section-management.service';

@Controller('academic-engine/subject-sections')
export class SubjectSectionManagementController {
  constructor(private readonly sections: SubjectSectionManagementService) {}

  @Get('dashboard')
  @RequirePermissions('academic-engine:read')
  getDashboard(
    @CurrentUser() user: JwtUser,
    @Query() query: SubjectSectionFiltersDto,
  ) {
    return this.sections.getDashboard(user.tid, query);
  }

  @Get('subjects')
  @RequirePermissions('academic-engine:read')
  listSubjects(
    @CurrentUser() user: JwtUser,
    @Query() query: SubjectSectionFiltersDto,
  ) {
    return this.sections.listSubjects(user.tid, query);
  }

  @Get('sections/:sectionId/students')
  @RequirePermissions('academic-engine:read')
  listSectionStudents(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.sections.listSectionStudents(user.tid, sectionId);
  }

  @Get('offerings/:offeringId/allocation-export')
  @RequirePermissions('academic-engine:read')
  async exportOfferingAllocations(
    @CurrentUser() user: JwtUser,
    @Param('offeringId') offeringId: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.sections.exportOfferingAllocationsCsv(
      user.tid,
      offeringId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('sections/:sectionId/students/export')
  @RequirePermissions('academic-engine:read')
  async exportSectionStudents(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.sections.exportSectionStudentsCsv(
      user.tid,
      sectionId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('bulk-provision')
  @RequirePermissions('academic-engine:manage')
  bulkProvision(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkProvisionSubjectSectionsDto,
  ) {
    return this.sections.bulkProvisionSections(user.tid, dto);
  }

  @Post('sections')
  @RequirePermissions('academic-engine:manage')
  createSection(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSubjectSectionDto,
  ) {
    return this.sections.createSection(user.tid, dto);
  }

  @Patch('sections/:sectionId')
  @RequirePermissions('academic-engine:manage')
  updateSection(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSubjectSectionDto,
  ) {
    return this.sections.updateSection(user.tid, sectionId, dto);
  }

  @Post('auto-divide')
  @RequirePermissions('academic-engine:manage')
  autoDivide(
    @CurrentUser() user: JwtUser,
    @Body() dto: AutoDivideSubjectSectionsDto,
  ) {
    return this.sections.autoDivideStudents(user.tid, dto, user.sub);
  }

  @Post('move-student')
  @RequirePermissions('academic-engine:manage')
  moveStudent(
    @CurrentUser() user: JwtUser,
    @Body() dto: MoveStudentSectionDto,
  ) {
    return this.sections.moveStudentToSection(user.tid, dto, user.sub);
  }

  @Post('import-allocations')
  @RequirePermissions('academic-engine:manage')
  importAllocations(
    @CurrentUser() user: JwtUser,
    @Body() dto: ImportSectionAllocationsDto,
  ) {
    return this.sections.importSectionAllocations(user.tid, dto, user.sub);
  }
}
