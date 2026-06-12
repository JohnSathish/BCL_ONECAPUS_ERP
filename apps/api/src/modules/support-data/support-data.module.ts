import { Module, forwardRef } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { OrganizationModule } from '../organization/organization.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AcademicRoleAdapter } from './adapters/academic-role.adapter';
import { BoardSubjectAdapter } from './adapters/board-subject.adapter';
import { DepartmentAdapter } from './adapters/department.adapter';
import { DesignationAdapter } from './adapters/designation.adapter';
import { LookupAdapter } from './adapters/lookup.adapter';
import { ShiftAdapter } from './adapters/shift.adapter';
import { SupportDataController } from './support-data.controller';
import { SupportDataService } from './support-data.service';

@Module({
  imports: [
    OrganizationModule,
    forwardRef(() => ShiftsModule),
    forwardRef(() => AdministrationModule),
    MasterDataModule,
  ],
  controllers: [SupportDataController],
  providers: [
    SupportDataService,
    LookupAdapter,
    DepartmentAdapter,
    DesignationAdapter,
    AcademicRoleAdapter,
    ShiftAdapter,
    BoardSubjectAdapter,
  ],
  exports: [SupportDataService],
})
export class SupportDataModule {}
