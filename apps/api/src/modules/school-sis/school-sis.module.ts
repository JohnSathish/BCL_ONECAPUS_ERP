import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolSisAdmissionService } from './school-sis-admission.service';
import { SchoolSisController } from './school-sis.controller';
import { SchoolSisPublicController } from './school-sis-public.controller';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisStudentMasterService } from './school-sis-student-master.service';
import { SchoolSisCurriculumService } from './school-sis-curriculum.service';
import { SchoolSisAcademicService } from './school-sis-academic.service';
import { SchoolSisAcademicController } from './school-sis-academic.controller';
import { SchoolSisFeesService } from './school-sis-fees.service';
import { SchoolSisMonthlyFeesService } from './school-sis-monthly-fees.service';
import { SchoolSisFeeReportsService } from './school-sis-fee-reports.service';
import { SchoolSisMonthlyFeesController } from './school-sis-monthly-fees.controller';
import { SchoolSisTimetableService } from './school-sis-timetable.service';

@Module({
  imports: [AuthModule, TenantsModule],
  controllers: [
    SchoolSisController,
    SchoolSisPublicController,
    SchoolSisAcademicController,
    SchoolSisMonthlyFeesController,
  ],
  providers: [
    SchoolSisService,
    SchoolSisAdmissionService,
    SchoolSisStudentMasterService,
    SchoolSisCurriculumService,
    SchoolSisAcademicService,
    SchoolSisTimetableService,
    SchoolSisFeesService,
    SchoolSisMonthlyFeesService,
    SchoolSisFeeReportsService,
  ],
  exports: [
    SchoolSisService,
    SchoolSisAdmissionService,
    SchoolSisStudentMasterService,
    SchoolSisCurriculumService,
    SchoolSisAcademicService,
    SchoolSisTimetableService,
    SchoolSisFeesService,
    SchoolSisMonthlyFeesService,
    SchoolSisFeeReportsService,
  ],
})
export class SchoolSisModule {}
