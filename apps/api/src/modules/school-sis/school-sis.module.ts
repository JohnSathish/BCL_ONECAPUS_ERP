import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AdministrationModule } from '../administration/administration.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';
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
import { SchoolSisFcmProvider } from './school-sis-push.provider';
import { SchoolSisPushService } from './school-sis-push.service';
import { SchoolSisPushController } from './school-sis-push.controller';
import { SchoolSisPushProcessor } from './school-sis-push.processor';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import { SchoolSisAutomationService } from './school-sis-automation.service';
import { SchoolSisAutomationController } from './school-sis-automation.controller';
import { SchoolSisAutomationProcessor } from './school-sis-automation.processor';
import { SchoolSisAccessService } from './school-sis-access.service';
import { SchoolSisIamService } from './school-sis-iam.service';
import { SchoolSisAccountSecurityService } from './school-sis-account-security.service';
import { SchoolSisIamController } from './school-sis-iam.controller';
import { SchoolSisAccountSecurityController } from './school-sis-account-security.controller';
import { SchoolSisReportsController } from './school-sis-reports.controller';
import { SchoolSisAttendanceController } from './school-sis-attendance.controller';
import { SchoolSisHrController } from './school-sis-hr.controller';
import { SchoolSisHrService } from './school-sis-hr.service';
import { SchoolSisTransportController } from './school-sis-transport.controller';
import { SchoolSisTransportService } from './school-sis-transport.service';
import { SchoolSisLibraryController } from './school-sis-library.controller';
import { SchoolSisLibraryService } from './school-sis-library.service';
import { SchoolSisSmsController } from './school-sis-sms.controller';
import { SchoolSisSmsService } from './school-sis-sms.service';
import { SchoolSisSmsProcessor } from './school-sis-sms.processor';
import { SchoolSisLicenseService } from './school-sis-license.service';
import { SchoolSaasLicenseIssuerService } from './school-saas-license-issuer.service';
import { SchoolSisLicenseController } from './school-sis-license.controller';
import { SchoolSaasLicenseIssuerController } from './school-saas-license-issuer.controller';
import { SchoolSisAccountsController } from './school-sis-accounts.controller';
import { SchoolSisAccountsService } from './school-sis-accounts.service';
import { SchoolSisAccountsPostingService } from './school-sis-accounts.posting.service';
import { SchoolLicenseGuard } from './school-sis-license.guard';
import { SchoolSisOpsController } from './school-sis-ops.controller';
import { SchoolSisOpsService } from './school-sis-ops.service';
import { SchoolSisOpsProcessor } from './school-sis-ops.processor';
import { SchoolSisOpsMetrics } from './school-sis-ops.metrics';
import { SchoolSisOpsInterceptor } from './school-sis-ops.interceptor';
import { SchoolSisDevicesController } from './school-sis-devices.controller';
import { SchoolSisDevicesService } from './school-sis-devices.service';
import { SchoolMaintenanceGuard } from './school-sis-ops.guard';
import { SchoolSisAttendanceService } from './school-sis-attendance.service';
import { SchoolSisReportsService } from './school-sis-reports.service';
import { SchoolSisReportsQueryService } from './school-sis-reports-query.service';
import { SchoolReportEngineService } from './report-engine/report-engine.service';
import { SchoolReportBrandingService } from './report-engine/report-branding.service';
import { SchoolReportPdfService } from './report-engine/report-pdf.service';
import { SchoolReportExcelService } from './report-engine/report-excel.service';
import { SchoolSisHomeworkService } from './school-sis-homework.service';
import { SchoolSisAppearanceService } from './school-sis-appearance.service';
import { SchoolSisAppearanceController } from './school-sis-appearance.controller';

@Module({
  imports: [
    AuthModule,
    TenantsModule,
    AdministrationModule,
    PermissionsModule,
    BullModule.registerQueue({ name: 'school-whatsapp' }),
    BullModule.registerQueue({ name: 'school-push' }),
    BullModule.registerQueue({ name: 'school-automation' }),
    BullModule.registerQueue({ name: 'school-sms' }),
    BullModule.registerQueue({ name: 'school-ops' }),
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
    SchoolSisPushController,
    SchoolSisAutomationController,
    SchoolSisIamController,
    SchoolSisAccountSecurityController,
    SchoolSisReportsController,
    SchoolSisAttendanceController,
    SchoolSisHrController,
    SchoolSisTransportController,
    SchoolSisLicenseController,
    SchoolSaasLicenseIssuerController,
    SchoolSisAccountsController,
    SchoolSisLibraryController,
    SchoolSisSmsController,
    SchoolSisOpsController,
    SchoolSisDevicesController,
    SchoolSisAppearanceController,
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
    SchoolSisFcmProvider,
    SchoolSisPushService,
    SchoolSisPushProcessor,
    SchoolSisEventBus,
    SchoolSisAutomationService,
    SchoolSisAutomationProcessor,
    SchoolSisAccessService,
    SchoolSisAttendanceService,
    SchoolSisHrService,
    SchoolSisTransportService,
    SchoolSisLicenseService,
    SchoolSaasLicenseIssuerService,
    SchoolSisAccountsPostingService,
    SchoolSisAccountsService,
    SchoolSisLibraryService,
    SchoolSisSmsService,
    SchoolSisSmsProcessor,
    SchoolSisOpsService,
    SchoolSisOpsProcessor,
    SchoolSisOpsMetrics,
    SchoolSisDevicesService,
    SchoolSisAppearanceService,
    SchoolSisHomeworkService,
    { provide: APP_INTERCEPTOR, useClass: SchoolSisOpsInterceptor },
    { provide: APP_GUARD, useClass: SchoolLicenseGuard },
    { provide: APP_GUARD, useClass: SchoolMaintenanceGuard },
    SchoolSisIamService,
    SchoolSisAccountSecurityService,
    SchoolSisReportsQueryService,
    SchoolSisReportsService,
    SchoolReportBrandingService,
    SchoolReportPdfService,
    SchoolReportExcelService,
    SchoolReportEngineService,
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
    SchoolSisPushService,
    SchoolSisEventBus,
    SchoolSisAutomationService,
    SchoolSisAccessService,
    SchoolSisAttendanceService,
    SchoolSisHrService,
    SchoolSisTransportService,
    SchoolSisLicenseService,
    SchoolSisAccountsPostingService,
    SchoolSisAccountsService,
    SchoolSisLibraryService,
    SchoolSisSmsService,
    SchoolSisOpsService,
    SchoolSisIamService,
    SchoolSisAccountSecurityService,
    SchoolSisReportsService,
    SchoolReportEngineService,
    SchoolSisHomeworkService,
  ],
})
export class SchoolSisModule {}
