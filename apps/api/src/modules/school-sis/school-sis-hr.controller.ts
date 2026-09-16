import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import { RequiresSchoolLicense } from './school-sis-license.decorators';
import {
  SIS_HR_SELF,
  SIS_HR_VIEW,
  SIS_PAYROLL_APPROVE,
  SIS_PAYROLL_CALC,
  SIS_PAYROLL_PAY,
  SIS_PAYROLL_VIEW,
} from './school-sis-iam.perms';
import { SchoolSisHrService, type HrActor } from './school-sis-hr.service';
import {
  AssignSalaryDto,
  CreateHrEmployeeDto,
  CreatePayrollDto,
  ExitDto,
  ImportEmployeesDto,
  LeaveRequestDto,
  LoanDto,
  MarkStaffAttendanceDto,
  PayLineDto,
  ReimbursementDto,
  SalaryRevisionDto,
  SaveHrBankDto,
  SaveHrComponentDto,
  SaveHrDepartmentDto,
  SaveHrDesignationDto,
  SaveHrEmployeeTypeDto,
  SaveHrEmploymentDto,
  SaveHrSettingsDto,
  SaveHrStructureDto,
  SaveLeavePolicyDto,
  SaveLeaveTypeDto,
  StatutoryRuleDto,
} from './dto/school-hr.dto';

function actor(user: JwtUser, req?: { ip?: string }): HrActor {
  const p = user.permissions ?? [];
  const star = p.includes('*');
  return {
    userId: user.sub,
    manageHr:
      star ||
      p.includes(SCHOOL_SIS_PERMISSION_MANAGE) ||
      p.includes('hr.employees.manage'),
    payrollView:
      star ||
      p.includes('payroll.view') ||
      p.includes('payroll.calculate') ||
      p.includes('payroll.approve') ||
      p.includes('payroll.pay'),
    payrollCalc: star || p.includes('payroll.calculate'),
    payrollApprove: star || p.includes('payroll.approve'),
    payrollPay: star || p.includes('payroll.pay'),
    revealBank:
      star || p.includes('hr.bank.reveal') || p.includes('hr.employees.manage'),
    ip: req?.ip,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-hr')
@RequiresSchoolLicense('hr_payroll')
@Controller({ path: 'school-sis/hr', version: '1' })
export class SchoolSisHrController {
  constructor(private readonly hr: SchoolSisHrService) {}

  @Get('dashboard')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_PAYROLL_VIEW)
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query('periodMonth') periodMonth?: string,
  ) {
    return this.hr.dashboard(user.tid, periodMonth);
  }

  @Get('settings')
  @RequireAnyPermission(...SIS_HR_VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.hr.ensureSetup(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveHrSettingsDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.saveSettings(user.tid, dto, actor(user, req));
  }

  @Get('departments')
  @RequireAnyPermission(...SIS_HR_VIEW)
  departments(@CurrentUser() user: JwtUser) {
    return this.hr.departments(user.tid);
  }

  @Post('departments')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  saveDept(@CurrentUser() user: JwtUser, @Body() dto: SaveHrDepartmentDto) {
    return this.hr.saveDepartment(user.tid, dto);
  }

  @Get('designations')
  @RequireAnyPermission(...SIS_HR_VIEW)
  designations(@CurrentUser() user: JwtUser) {
    return this.hr.designations(user.tid);
  }

  @Post('designations')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  saveDesig(@CurrentUser() user: JwtUser, @Body() dto: SaveHrDesignationDto) {
    return this.hr.saveDesignation(user.tid, dto);
  }

  @Get('employee-types')
  @RequireAnyPermission(...SIS_HR_VIEW)
  types(@CurrentUser() user: JwtUser) {
    return this.hr.employeeTypes(user.tid);
  }

  @Post('employee-types')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  saveType(@CurrentUser() user: JwtUser, @Body() dto: SaveHrEmployeeTypeDto) {
    return this.hr.saveEmployeeType(user.tid, dto);
  }

  @Get('employees/next-code')
  @RequireAnyPermission(...SIS_HR_VIEW)
  nextCode(@CurrentUser() user: JwtUser) {
    return this.hr.nextEmployeeCode(user.tid).then((code) => ({ code }));
  }

  @Get('employees')
  @RequireAnyPermission(...SIS_HR_VIEW)
  employees(
    @CurrentUser() user: JwtUser,
    @Query('staffType') staffType?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.hr.employees(
      user.tid,
      {
        staffType,
        departmentId,
        status,
        search,
        page: page ? Number(page) : 1,
      },
      actor(user),
    );
  }

  @Post('employees')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  createEmployee(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateHrEmployeeDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.createEmployee(user.tid, dto, actor(user, req));
  }

  @Get('employees/:id')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF)
  async employee(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const a = actor(user);
    const own = await this.hr.ownStaffId(user.tid, user.sub);
    if (a.manageHr || a.payrollView) {
      return this.hr.employee(user.tid, id, a);
    }
    if (own === id) {
      return this.hr.employee(user.tid, id, {
        ...a,
        payrollView: true,
        revealBank: false,
      });
    }
    throw new ForbiddenException('You can only open your own employee profile');
  }

  @Patch('employees/:id/employment')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  employment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveHrEmploymentDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.saveEmployment(user.tid, id, dto, actor(user, req));
  }

  @Post('employees/:id/bank')
  @RequireAnyPermission(
    'hr.bank.reveal',
    'hr.employees.manage',
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  bank(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveHrBankDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.saveBank(user.tid, id, dto, actor(user, req));
  }

  @Post('employees/import')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  importEmp(
    @CurrentUser() user: JwtUser,
    @Body() dto: ImportEmployeesDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.importEmployees(user.tid, dto, actor(user, req));
  }

  @Get('salary/components')
  @RequireAnyPermission(...SIS_PAYROLL_VIEW, ...SIS_HR_VIEW)
  components(@CurrentUser() user: JwtUser) {
    return this.hr.components(user.tid);
  }

  @Post('salary/components')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  saveComp(@CurrentUser() user: JwtUser, @Body() dto: SaveHrComponentDto) {
    return this.hr.saveComponent(user.tid, dto);
  }

  @Get('salary/structures')
  @RequireAnyPermission(...SIS_PAYROLL_VIEW)
  structures(@CurrentUser() user: JwtUser) {
    return this.hr.structures(user.tid);
  }

  @Post('salary/structures')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  saveStructure(@CurrentUser() user: JwtUser, @Body() dto: SaveHrStructureDto) {
    return this.hr.saveStructure(user.tid, dto);
  }

  @Post('salary/assign')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  assign(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignSalaryDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.assignSalary(user.tid, dto, actor(user, req));
  }

  @Post('salary/revise')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  revise(
    @CurrentUser() user: JwtUser,
    @Body() dto: SalaryRevisionDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.reviseSalary(user.tid, dto, actor(user, req));
  }

  @Get('leave/types')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF)
  leaveTypes(@CurrentUser() user: JwtUser) {
    return this.hr.leaveTypes(user.tid);
  }

  @Post('leave/types')
  @RequireAnyPermission('hr.leave.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  saveLeaveType(@CurrentUser() user: JwtUser, @Body() dto: SaveLeaveTypeDto) {
    return this.hr.saveLeaveType(user.tid, dto);
  }

  @Post('leave/policies')
  @RequireAnyPermission('hr.leave.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  savePolicy(@CurrentUser() user: JwtUser, @Body() dto: SaveLeavePolicyDto) {
    return this.hr.saveLeavePolicy(user.tid, dto);
  }

  @Get('leave/requests')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF)
  async leaves(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('staffId') staffId?: string,
  ) {
    const a = actor(user);
    const own = await this.hr.ownStaffId(user.tid, user.sub);
    const scoped = a.manageHr || a.payrollView ? staffId : (own ?? 'none');
    return this.hr.leaveRequests(user.tid, status, scoped);
  }

  @Post('leave/request')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF, 'hr.leave.create')
  requestLeave(
    @CurrentUser() user: JwtUser,
    @Body() dto: LeaveRequestDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.requestLeave(user.tid, dto, actor(user, req));
  }

  @Post('leave/:id/approve')
  @RequireAnyPermission('hr.leave.approve', SCHOOL_SIS_PERMISSION_MANAGE)
  approveLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.reviewLeave(user.tid, id, actor(user, req), true);
  }

  @Post('leave/:id/reject')
  @RequireAnyPermission('hr.leave.approve', SCHOOL_SIS_PERMISSION_MANAGE)
  rejectLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.reviewLeave(user.tid, id, actor(user, req), false);
  }

  @Get('attendance')
  @RequireAnyPermission(...SIS_HR_VIEW)
  attendance(@CurrentUser() user: JwtUser, @Query('date') date: string) {
    return this.hr.attendanceDay(user.tid, date);
  }

  @Post('attendance')
  @RequireAnyPermission(...SIS_HR_VIEW, 'hr.attendance.mark')
  markAtt(
    @CurrentUser() user: JwtUser,
    @Body() dto: MarkStaffAttendanceDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.markAttendance(user.tid, dto, actor(user, req));
  }

  @Post('attendance/finalize')
  @RequireAnyPermission('hr.attendance.mark', SCHOOL_SIS_PERMISSION_MANAGE)
  finalizeAtt(
    @CurrentUser() user: JwtUser,
    @Body() body: { periodMonth: string },
    @Req() req: { ip?: string },
  ) {
    return this.hr.finalizeAttendanceMonth(
      user.tid,
      body.periodMonth,
      actor(user, req),
    );
  }

  @Post('payroll/calculate')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  calculate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePayrollDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.createPayroll(user.tid, dto, actor(user, req));
  }

  @Get('payroll')
  @RequireAnyPermission(...SIS_PAYROLL_VIEW)
  payrollList(@CurrentUser() user: JwtUser) {
    return this.hr.payrollList(user.tid, actor(user));
  }

  @Get('payroll/:id')
  @RequireAnyPermission(...SIS_PAYROLL_VIEW)
  payrollOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.hr.payrollRun(user.tid, id, actor(user));
  }

  @Post('payroll/:id/review')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  reviewPay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.transitionPayroll(
      user.tid,
      id,
      actor(user, req),
      'UNDER_REVIEW',
    );
  }

  @Post('payroll/:id/approve')
  @RequireAnyPermission(...SIS_PAYROLL_APPROVE)
  approvePay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.transitionPayroll(
      user.tid,
      id,
      actor(user, req),
      'APPROVED',
    );
  }

  @Post('payroll/:id/process')
  @RequireAnyPermission(...SIS_PAYROLL_APPROVE)
  processPay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.transitionPayroll(
      user.tid,
      id,
      actor(user, req),
      'PROCESSED',
    );
  }

  @Post('payroll/:id/finalize')
  @RequireAnyPermission(...SIS_PAYROLL_APPROVE)
  finalizePay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.transitionPayroll(user.tid, id, actor(user, req), 'LOCKED');
  }

  @Post('payroll/:id/reverse')
  @RequireAnyPermission(...SIS_PAYROLL_APPROVE)
  reversePay(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: { ip?: string },
  ) {
    return this.hr.transitionPayroll(
      user.tid,
      id,
      actor(user, req),
      'REVERSED',
      body.reason,
    );
  }

  @Post('payroll/pay')
  @RequireAnyPermission(...SIS_PAYROLL_PAY)
  pay(
    @CurrentUser() user: JwtUser,
    @Body() dto: PayLineDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.payLines(user.tid, dto, actor(user, req));
  }

  @Get('payslips/:id/pdf')
  @RequireAnyPermission(...SIS_PAYROLL_VIEW, ...SIS_HR_SELF)
  @Header('Content-Type', 'application/pdf')
  async payslipPdf(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const buf = await this.hr.payslipPdf(user.tid, id, actor(user));
    return new StreamableFile(buf);
  }

  @Get('loans')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_PAYROLL_VIEW)
  loans(@CurrentUser() user: JwtUser, @Query('staffId') staffId?: string) {
    return this.hr.loans(user.tid, staffId);
  }

  @Post('loans')
  @RequireAnyPermission(...SIS_PAYROLL_CALC)
  createLoan(
    @CurrentUser() user: JwtUser,
    @Body() dto: LoanDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.createLoan(user.tid, dto, actor(user, req));
  }

  @Get('reimbursements')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF)
  reimb(@CurrentUser() user: JwtUser, @Query('staffId') staffId?: string) {
    return this.hr.reimbursements(user.tid, staffId);
  }

  @Post('reimbursements')
  @RequireAnyPermission(...SIS_HR_VIEW, ...SIS_HR_SELF)
  createReimb(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReimbursementDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.createReimbursement(user.tid, dto, actor(user, req));
  }

  @Post('reimbursements/:id/approve')
  @RequireAnyPermission(...SIS_PAYROLL_APPROVE, SCHOOL_SIS_PERMISSION_MANAGE)
  approveReimb(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.hr.reviewReimbursement(user.tid, id, actor(user, req), true);
  }

  @Post('exits')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  exit(
    @CurrentUser() user: JwtUser,
    @Body() dto: ExitDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.createExit(user.tid, dto, actor(user, req));
  }

  @Post('statutory')
  @RequireAnyPermission('hr.employees.manage', SCHOOL_SIS_PERMISSION_MANAGE)
  statutory(
    @CurrentUser() user: JwtUser,
    @Body() dto: StatutoryRuleDto,
    @Req() req: { ip?: string },
  ) {
    return this.hr.saveStatutory(user.tid, dto, actor(user, req));
  }

  @Get('me')
  @RequireAnyPermission(...SIS_HR_SELF, ...SIS_HR_VIEW)
  async me(@CurrentUser() user: JwtUser) {
    const id = await this.hr.ownStaffId(user.tid, user.sub);
    if (!id) return { staff: null };
    return this.hr.employee(user.tid, id, {
      ...actor(user),
      payrollView: true,
      revealBank: false,
    });
  }
}
