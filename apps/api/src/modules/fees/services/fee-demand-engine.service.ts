import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CourseDeliveryFeeService } from '../../../common/services/course-delivery-fee.service';
import type {
  DemandScopeDto,
  GenerateDemandDto,
  PublishDemandDto,
} from '../dto/fees.dto';
import { FeeLedgerService } from './fee-ledger.service';
import {
  FeeStructureService,
  type FeeStudentContext,
} from './fee-structure.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';

@Injectable()
export class FeeDemandEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly structures: FeeStructureService,
    private readonly ledger: FeeLedgerService,
    private readonly courseDeliveryFees: CourseDeliveryFeeService,
    private readonly communication: CommunicationTriggerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async preview(tenantId: string, scope: DemandScopeDto) {
    const students = await this.resolveStudents(tenantId, scope);
    const rows = await Promise.all(
      students.map((student: any) =>
        this.previewForStudent(tenantId, student, scope),
      ),
    );
    return {
      scope,
      studentCount: rows.length,
      totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0),
      duplicateCount: rows.filter((row) => row.duplicateDemand).length,
      rows,
    };
  }

  async generate(user: JwtUser, dto: GenerateDemandDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const preview = await this.preview(user.tid, dto);
    const created: any[] = [];
    const skipped: any[] = [];

    for (const row of preview.rows) {
      if (row.duplicateDemand) {
        skipped.push({
          studentId: row.studentId,
          reason: 'Duplicate active demand exists',
        });
        continue;
      }
      if (!row.lines.length) {
        skipped.push({
          studentId: row.studentId,
          reason: 'No applicable fee lines',
        });
        continue;
      }

      const demand = await this.db().studentFeeDemand.create({
        data: {
          tenantId: user.tid,
          studentId: row.studentId,
          feeStructureId: row.primaryFeeStructureId,
          academicYearId: dto.academicYearId,
          semesterId: dto.semesterId,
          semesterNumber: row.context.semesterNumber,
          academicYearNo: row.context.academicYearNo,
          demandNo: await this.nextDemandNo(user.tid),
          demandType: dto.demandType ?? 'GENERAL',
          billingLayer: dto.billingLayer ?? 'YEARLY',
          billingPeriod: dto.billingPeriod,
          status: dto.publish ? 'PUBLISHED' : 'DRAFT',
          totalAmount: row.totalAmount,
          balanceAmount: row.totalAmount,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          publishedAt: dto.publish ? new Date() : undefined,
          generatedById: user.sub,
          metadata: {
            context: row.context,
            previewGeneratedAt: new Date().toISOString(),
          },
          lines: {
            create: row.lines.map((line: any) => ({
              tenantId: user.tid,
              feeComponentId: line.feeComponentId,
              code: line.code,
              name: line.name,
              category: line.category,
              quantity: line.quantity ?? 1,
              unitAmount: line.unitAmount,
              amount: line.amount,
              sourceType: line.sourceType,
              sourceRefId: line.sourceRefId,
              metadata: line.metadata,
            })),
          },
        },
        include: { lines: true },
      });

      await this.ledger.post({
        tenantId: user.tid,
        studentId: row.studentId,
        demandId: demand.id,
        entryType: 'CHARGE',
        debitAmount: row.totalAmount,
        referenceType: 'DEMAND',
        referenceId: demand.id,
        description: `${demand.demandType} fee demand generated`,
        postedById: user.sub,
      });
      await this.audit(user, 'demand.generated', demand.id, { after: demand });
      created.push(demand);
      if (dto.publish) {
        void this.notifyDemandPublished(user.tid, demand.id);
      }
    }

    return {
      createdCount: created.length,
      skippedCount: skipped.length,
      totalAmount: created.reduce(
        (sum, demand) => sum + Number(demand.totalAmount ?? 0),
        0,
      ),
      created,
      skipped,
    };
  }

  async publish(user: JwtUser, id: string, dto: PublishDemandDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const demand = await this.ensureDemand(user.tid, id);
    if (demand.status === 'LOCKED')
      throw new BadRequestException('Locked demand cannot be republished.');
    const updated = await this.db().studentFeeDemand.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { lines: true },
    });
    await this.audit(user, 'demand.published', id, {
      reason: dto.reason,
      before: demand,
      after: updated,
    });
    void this.notifyDemandPublished(user.tid, id);
    return updated;
  }

  async lock(user: JwtUser, id: string, dto: PublishDemandDto) {
    const demand = await this.ensureDemand(user.tid, id);
    const updated = await this.db().studentFeeDemand.update({
      where: { id },
      data: { status: 'LOCKED', lockedAt: new Date() },
      include: { lines: true },
    });
    await this.audit(user, 'demand.locked', id, {
      reason: dto.reason,
      before: demand,
      after: updated,
    });
    return updated;
  }

  async rollback(user: JwtUser, id: string, dto: PublishDemandDto) {
    const demand = await this.ensureDemand(user.tid, id);
    if (Number(demand.paidAmount ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot rollback a demand after payment allocation.',
      );
    }
    const updated = await this.db().studentFeeDemand.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.ledger.post({
      tenantId: user.tid,
      studentId: demand.studentId,
      demandId: demand.id,
      entryType: 'REVERSAL',
      creditAmount: Number(demand.totalAmount ?? 0),
      referenceType: 'DEMAND_ROLLBACK',
      referenceId: demand.id,
      description: dto.reason ?? 'Demand rollback',
      postedById: user.sub,
    });
    await this.audit(user, 'demand.rollback', id, {
      reason: dto.reason,
      before: demand,
      after: updated,
    });
    return updated;
  }

  private async previewForStudent(
    tenantId: string,
    student: any,
    scope: DemandScopeDto,
  ) {
    const context = this.studentContext(student, scope);
    const structures = await this.structures.findApplicable(tenantId, context);
    const lines = structures.flatMap((structure: any) =>
      (structure.components ?? [])
        .filter((component: any) =>
          this.componentApplies(component, context, scope),
        )
        .map((component: any) => ({
          feeComponentId: component.id,
          code: component.code,
          name: component.name,
          category: component.category,
          quantity: 1,
          unitAmount: Number(component.amount),
          amount: Number(component.amount),
          sourceType: 'STRUCTURE',
          sourceRefId: structure.id,
          metadata: { feeStructureCode: structure.code },
        })),
    );

    const subjectLines = await this.subjectChargeLines(
      tenantId,
      student,
      scope,
    );
    const allLines = [...this.dedupeLines(lines), ...subjectLines];
    const duplicateDemand = await this.findDuplicateDemand(
      tenantId,
      student.id,
      scope,
    );

    return {
      studentId: student.id,
      enrollmentNumber: student.enrollmentNumber,
      studentName:
        student.masterProfile?.fullName ??
        student.user?.name ??
        student.enrollmentNumber,
      context,
      primaryFeeStructureId: structures[0]?.id,
      totalAmount: allLines.reduce((sum, line) => sum + line.amount, 0),
      duplicateDemand,
      lines: allLines,
    };
  }

  private async subjectChargeLines(
    tenantId: string,
    student: any,
    scope: DemandScopeDto,
  ) {
    const registration = (student.semesterRegistrations ?? []).find(
      (reg: any) =>
        scope.semesterId ? reg.semesterId === scope.semesterId : true,
    );
    if (!registration) return [];
    const preview = await this.courseDeliveryFees.previewFromRegistration(
      tenantId,
      registration.id,
    );
    return preview.feeLines.map((line) => ({
      code: line.ruleCode,
      name: line.ruleName,
      category: 'PRACTICAL',
      quantity: line.perCourse ? line.courseCodes.length : 1,
      unitAmount:
        line.perCourse && line.courseCodes.length
          ? line.amount / line.courseCodes.length
          : line.amount,
      amount: line.amount,
      sourceType: 'SUBJECT_RULE',
      metadata: { courseCodes: line.courseCodes },
    }));
  }

  private async resolveStudents(tenantId: string, scope: DemandScopeDto) {
    const ids = scope.studentIds?.length
      ? scope.studentIds
      : scope.studentId
        ? [scope.studentId]
        : undefined;
    return this.db().student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(ids ? { id: { in: ids } } : {}),
        ...(scope.programVersionId
          ? { programVersionId: scope.programVersionId }
          : {}),
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.shiftId ? { primaryShiftId: scope.shiftId } : {}),
        ...(scope.streamId
          ? { academicProfile: { streamId: scope.streamId } }
          : {}),
      },
      include: {
        user: true,
        masterProfile: true,
        academicProfile: true,
        academicStanding: true,
        semesterRegistrations: {
          include: {
            lines: { include: { offering: { include: { course: true } } } },
          },
        },
      },
      take: ids ? undefined : 500,
    });
  }

  private studentContext(
    student: any,
    scope: DemandScopeDto,
  ): FeeStudentContext {
    const semesterNumber =
      scope.semesterNumber ??
      student.academicStanding?.currentSemesterSequence ??
      null;
    return {
      studentId: student.id,
      programVersionId: student.programVersionId,
      departmentId: student.departmentId,
      streamId: student.academicProfile?.streamId,
      shiftId:
        scope.shiftId ??
        student.primaryShiftId ??
        student.academicProfile?.preferredShiftId,
      semesterNumber,
      academicYearNo: semesterNumber
        ? Math.ceil(Number(semesterNumber) / 2)
        : null,
    };
  }

  private componentApplies(
    component: any,
    context: FeeStudentContext,
    scope: DemandScopeDto,
  ) {
    const semesters = Array.isArray(component.semesterNumbers)
      ? component.semesterNumbers
      : [];
    const frequency = String(component.billingFrequency ?? '').toUpperCase();
    const layer = String(scope.billingLayer ?? '').toUpperCase();
    return (
      (!semesters.length || semesters.includes(context.semesterNumber)) &&
      (!layer || frequency === layer || frequency === 'YEARLY')
    );
  }

  private dedupeLines(lines: any[]) {
    const seen = new Set<string>();
    return lines.filter((line) => {
      const key = `${line.code}:${line.sourceRefId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private findDuplicateDemand(
    tenantId: string,
    studentId: string,
    scope: DemandScopeDto,
  ) {
    return this.db().studentFeeDemand.findFirst({
      where: {
        tenantId,
        studentId,
        status: { in: ['DRAFT', 'PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        demandType: scope.demandType ?? 'GENERAL',
        billingLayer: scope.billingLayer ?? 'YEARLY',
        ...(scope.academicYearId
          ? { academicYearId: scope.academicYearId }
          : {}),
        ...(scope.semesterId ? { semesterId: scope.semesterId } : {}),
        ...(scope.billingPeriod ? { billingPeriod: scope.billingPeriod } : {}),
      },
    });
  }

  private async ensureDemand(tenantId: string, id: string) {
    const demand = await this.db().studentFeeDemand.findFirst({
      where: { tenantId, id },
      include: { lines: true },
    });
    if (!demand) throw new BadRequestException('Fee demand not found.');
    return demand;
  }

  private async nextDemandNo(tenantId: string) {
    const count = await this.db().studentFeeDemand.count({
      where: { tenantId },
    });
    return `FDM-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private audit(
    user: JwtUser,
    action: string,
    demandId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.db().feeAuditLog.create({
      data: {
        tenantId: user.tid,
        demandId,
        actorId: user.sub,
        action,
        metadata,
      },
    });
  }

  private async notifyDemandPublished(tenantId: string, demandId: string) {
    const demand = await this.db().studentFeeDemand.findFirst({
      where: { tenantId, id: demandId },
    });
    if (!demand) return;

    const student = await this.prisma.student.findFirst({
      where: { id: demand.studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        masterProfile: {
          select: { fullName: true, email: true, mobileNumber: true },
        },
      },
    });
    if (!student?.user) return;

    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const displayName =
      student.masterProfile?.fullName ??
      student.user.displayName ??
      student.user.email;

    await this.communication.trigger({
      tenantId,
      templateCode: 'FEE_REMINDER',
      triggerKey: 'fee.demand_published',
      entityType: 'fee_demand',
      entityId: demand.id,
      recipient: {
        recipientType: 'STUDENT',
        userId: student.userId,
        studentId: student.id,
        displayName,
        email: student.masterProfile?.email ?? student.user.email,
        phone: student.masterProfile?.mobileNumber ?? undefined,
      },
      variables: {
        student_name: displayName,
        amount: String(demand.balanceAmount ?? demand.totalAmount),
        due_date: demand.dueDate
          ? new Date(demand.dueDate).toISOString().slice(0, 10)
          : '',
        demand_no: demand.demandNo,
        institution_name: institutionName,
      },
    });
  }
}
