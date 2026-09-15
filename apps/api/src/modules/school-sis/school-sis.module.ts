import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { SchoolSisPaymentGatewaysService } from './school-sis-payment-gateways.service';
import { SchoolSisPaymentGatewaysController } from './school-sis-payment-gateways.controller';
import { SchoolSisStationeryService } from './school-sis-stationery.service';
import { SchoolSisStationeryController } from './school-sis-stationery.controller';
import { SchoolSisExamsService } from './school-sis-exams.service';
import { SchoolSisExamsController } from './school-sis-exams.controller';
import { SchoolSisCalendarService } from './school-sis-calendar.service';
import { SchoolSisCalendarController } from './school-sis-calendar.controller';
import { SchoolSisTimetableService } from './school-sis-timetable.service';
import { SchoolSisWhatsappService } from './school-sis-whatsapp.service';
import { SchoolSisWhatsappWebhookService } from './school-sis-whatsapp-webhook.service';
import { SchoolSisWhatsappController } from './school-sis-whatsapp.controller';
import { SchoolSisWhatsappProcessor } from './school-sis-whatsapp.processor';

@Module({
  imports: [
    AuthModule,
    TenantsModule,
    BullModule.registerQueue({ name: 'school-whatsapp' }),
  ],
  controllers: [
    SchoolSisController,
    SchoolSisPublicController,
    SchoolSisAcademicController,
    SchoolSisMonthlyFeesController,
    SchoolSisPaymentGatewaysController,
    SchoolSisStationeryController,
    SchoolSisExamsController,
    SchoolSisCalendarController,
    SchoolSisWhatsappController,
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
    SchoolSisPaymentGatewaysService,
    SchoolSisStationeryService,
    SchoolSisCalendarService,
    SchoolSisExamsService,
    SchoolSisWhatsappService,
    SchoolSisWhatsappWebhookService,
    SchoolSisWhatsappProcessor,
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
    SchoolSisPaymentGatewaysService,
    SchoolSisStationeryService,
    SchoolSisExamsService,
    SchoolSisCalendarService,
    SchoolSisWhatsappService,
  ],
})
export class SchoolSisModule {}
