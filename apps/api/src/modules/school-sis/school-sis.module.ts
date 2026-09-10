import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolSisAdmissionService } from './school-sis-admission.service';
import { SchoolSisController } from './school-sis.controller';
import { SchoolSisPublicController } from './school-sis-public.controller';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisStudentMasterService } from './school-sis-student-master.service';
import { SchoolSisFeesService } from './school-sis-fees.service';
import { SchoolSisTimetableService } from './school-sis-timetable.service';

@Module({
  imports: [AuthModule, TenantsModule],
  controllers: [SchoolSisController, SchoolSisPublicController],
  providers: [
    SchoolSisService,
    SchoolSisAdmissionService,
    SchoolSisStudentMasterService,
    SchoolSisTimetableService,
    SchoolSisFeesService,
  ],
})
export class SchoolSisModule {}
