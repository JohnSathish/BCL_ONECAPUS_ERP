import { Module } from '@nestjs/common';

import { AccommodationModule } from '../accommodation/accommodation.module';
import { CommunicationModule } from '../communication/communication.module';

import { LoansModule } from '../loans/loans.module';

import { PayrollController } from './payroll.controller';

import { PayrollSettingsController } from './payroll-settings.controller';

import { PayrollVerifyController } from './payroll-verify.controller';

import { StaffPortalPayrollController } from './staff-portal-payroll.controller';

import { ArrearsService } from './services/arrears.service';

import { FormulaEngineService } from './services/formula-engine.service';

import { IncrementService } from './services/increment.service';

import { LoanService } from './services/loan.service';

import { PayStructureService } from './services/pay-structure.service';

import { PayrollAdjustmentsService } from './services/payroll-adjustments.service';
import { ProfessionalTaxService } from './services/professional-tax.service';
import { PayrollExcelStylesService } from './services/payroll-excel-styles.service';
import { TdsService } from './services/tds.service';
import { PayslipNotificationService } from './services/payslip-notification.service';
import { PayslipsService } from './services/payslips.service';
import { StaffPortalPayrollService } from './services/staff-portal-payroll.service';

import { PayrollAnalyticsService } from './services/payroll-analytics.service';

import { PayrollApprovalService } from './services/payroll-approval.service';

import { PayrollAttendanceBridgeService } from './services/payroll-attendance-bridge.service';

import { PayrollAuditService } from './services/payroll-audit.service';

import { PayrollReportsService } from './services/payroll-reports.service';

import { PayrollRunEngineService } from './services/payroll-run-engine.service';

import { PayrollSeedService } from './services/payroll-seed.service';

import { PayrollSettingsService } from './services/payroll-settings.service';

import { PayslipDocumentService } from './services/payslip-document.service';

import { PfCpfService } from './services/pf-cpf.service';

import { SalaryComponentService } from './services/salary-component.service';

import { PayAssignmentImportService } from './services/pay-assignment-import.service';

import { DbcPayrollSetupService } from './services/dbc-payroll-setup.service';

import { StaffPayAssignmentService } from './services/staff-pay-assignment.service';

import { StaffPfConfigService } from './services/staff-pf-config.service';

@Module({
  imports: [AccommodationModule, CommunicationModule, LoansModule],

  controllers: [
    PayrollController,

    PayrollSettingsController,

    PayrollVerifyController,

    StaffPortalPayrollController,
  ],

  providers: [
    FormulaEngineService,

    SalaryComponentService,

    PayStructureService,

    StaffPayAssignmentService,

    IncrementService,

    LoanService,

    PayrollRunEngineService,

    PayrollApprovalService,

    PayslipDocumentService,

    PfCpfService,

    ArrearsService,

    PayrollReportsService,

    PayrollAnalyticsService,

    PayrollSettingsService,

    PayrollAttendanceBridgeService,

    PayrollSeedService,

    DbcPayrollSetupService,

    PayAssignmentImportService,

    StaffPfConfigService,

    PayrollAuditService,

    PayrollAdjustmentsService,

    ProfessionalTaxService,

    PayrollExcelStylesService,

    TdsService,

    PayslipNotificationService,

    PayslipsService,

    StaffPortalPayrollService,
  ],

  exports: [
    FormulaEngineService,

    PayrollRunEngineService,

    PayrollAnalyticsService,

    StaffPayAssignmentService,

    StaffPfConfigService,

    PayrollAuditService,
  ],
})
export class PayrollModule {}
