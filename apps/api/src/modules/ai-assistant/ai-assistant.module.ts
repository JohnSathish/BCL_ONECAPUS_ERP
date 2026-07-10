import { Module } from '@nestjs/common';
import { CacheModule } from '../../shared/cache/cache.module';
import { AdmissionsModule } from '../admissions/admissions.module';
import { DashboardAnalyticsModule } from '../dashboard-analytics/dashboard-analytics.module';
import { FeesModule } from '../fees/fees.module';
import { ExaminationFeesModule } from '../examination-fees/examination-fees.module';
import { StaffModule } from '../staff/staff.module';
import { StudentAttendanceModule } from '../student-attendance/student-attendance.module';
import { StudentReportsModule } from '../student-reports/student-reports.module';
import { StudentsModule } from '../students/students.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiAuditService } from './ai-audit.service';
import { AiSessionStore } from './ai-session.store';
import { AiToolsService } from './ai-tools.service';
import { HybridIntentResolver } from './intent/hybrid-intent.resolver';
import { LlmIntentAdapter } from './intent/llm-intent.adapter';

@Module({
  imports: [
    CacheModule,
    DashboardAnalyticsModule,
    StudentsModule,
    StaffModule,
    StudentReportsModule,
    FeesModule,
    ExaminationFeesModule,
    StudentAttendanceModule,
    AdmissionsModule,
    KnowledgeBaseModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    AiSessionStore,
    AiAuditService,
    AiToolsService,
    HybridIntentResolver,
    LlmIntentAdapter,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
