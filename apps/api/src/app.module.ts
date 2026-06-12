import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { HttpProblemJsonExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { PrismaModule } from './database/prisma.module';
import { PermissionsModule } from './common/permissions/permissions.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { SupportDataModule } from './modules/support-data/support-data.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicEngineModule } from './modules/academic-engine/academic-engine.module';
import { AcademicLifecycleModule } from './modules/academic-lifecycle/academic-lifecycle.module';
import { AuthModule } from './modules/auth/auth.module';
import { NepAbcModule } from './modules/nep-abc/nep-abc.module';
import { ObeModule } from './modules/obe/obe.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FacultyShiftsModule } from './modules/faculty-shifts/faculty-shifts.module';
import { ShiftOperationsModule } from './modules/shift-operations/shift-operations.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { ShiftScopeGuard } from './common/guards/shift-scope.guard';
import { CurriculumCoreModule } from './modules/curriculum-core/curriculum-core.module';
import { ProgramsCoursesModule } from './modules/programs-courses/programs-courses.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { BrandingModule } from './modules/branding/branding.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardAnalyticsModule } from './modules/dashboard-analytics/dashboard-analytics.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { QueueModule } from './shared/queue/queue.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { StaffModule } from './modules/staff/staff.module';
import { StaffAttendanceModule } from './modules/staff-attendance/staff-attendance.module';
import { StudentAttendanceModule } from './modules/student-attendance/student-attendance.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { TimetableEngineModule } from './modules/timetable-engine/timetable-engine.module';
import { FeesModule } from './modules/fees/fees.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ExaminationsModule } from './modules/examinations/examinations.module';
import { LmsModule } from './modules/lms/lms.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { LibraryModule } from './modules/library/library.module';
import { FrontOfficeModule } from './modules/front-office/front-office.module';
import { TransportModule } from './modules/transport/transport.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { IdCardsModule } from './modules/id-cards/id-cards.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { HrModule } from './modules/hr/hr.module';
import { AccommodationModule } from './modules/accommodation/accommodation.module';
import { LoansModule } from './modules/loans/loans.module';
import { StudentReportsModule } from './modules/student-reports/student-reports.module';
import { LicensingModule } from './modules/licensing/licensing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    PermissionsModule,
    QueueModule,
    CurriculumCoreModule,
    AuthModule,
    TenantsModule,
    BrandingModule,
    UsersModule,
    DashboardAnalyticsModule,
    OrganizationModule,
    ShiftsModule,
    FacultyShiftsModule,
    ShiftOperationsModule,
    ReportsModule,
    StudentReportsModule,
    LicensingModule,
    ProgramsCoursesModule,
    AdmissionsModule,
    MasterDataModule,
    SupportDataModule,
    StudentsModule,
    StaffModule,
    StaffAttendanceModule,
    StudentAttendanceModule,
    InfrastructureModule,
    FeesModule,
    ExaminationsModule,
    LmsModule,
    CommunicationModule,
    CertificatesModule,
    QuestionBankModule,
    LibraryModule,
    FrontOfficeModule,
    TransportModule,
    InventoryModule,
    IdCardsModule,
    PayrollModule,
    HrModule,
    AccommodationModule,
    LoansModule,
    TimetableEngineModule,
    AcademicEngineModule,
    AcademicLifecycleModule,
    NepAbcModule,
    ObeModule,
    RealtimeModule,
    AdministrationModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: APP_FILTER, useClass: HttpProblemJsonExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ShiftScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware, TenantResolverMiddleware)
      .forRoutes('*');
  }
}
