import { Module } from '@nestjs/common';
import { AcademicEngineModule } from '../academic-engine/academic-engine.module';
import { PrismaModule } from '../../database/prisma.module';
import { DashboardAnalyticsController } from './dashboard-analytics.controller';
import { DashboardAnalyticsService } from './dashboard-analytics.service';

@Module({
  imports: [PrismaModule, AcademicEngineModule],
  controllers: [DashboardAnalyticsController],
  providers: [DashboardAnalyticsService],
  exports: [DashboardAnalyticsService],
})
export class DashboardAnalyticsModule {}
