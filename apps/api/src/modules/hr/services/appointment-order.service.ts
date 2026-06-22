import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  AcceptAppointmentOrderDto,
  AppointmentOrderQueryDto,
  CancelAppointmentOrderDto,
  CreateAppointmentOrderDto,
  RejectAppointmentOrderDto,
  UpdateAppointmentOrderDto,
} from '../dto/appointment-order.dto';
import { PayStructureService } from '../../payroll/services/pay-structure.service';
import { AppointmentOrderDocumentService } from './appointment-order-document.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import {
  DEFAULT_APPOINTMENT_BODY,
  DEFAULT_TERMS_NON_TEACHING,
  DEFAULT_TERMS_TEACHING,
  buildAppointmentOrderHtml,
  buildSalaryTableHtml,
  renderTemplate,
} from '../templates/appointment-order.template';

type AuditMeta = { clientIp?: string; userAgent?: string };

@Injectable()
export class AppointmentOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payStructures: PayStructureService,
    private readonly documents: AppointmentOrderDocumentService,
    private readonly recruitmentNotifications: RecruitmentNotificationService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async dashboard(tenantId: string) {
    const [
      issued,
      pendingAcceptance,
      joined,
      notJoined,
      probation,
      confirmed,
      temporary,
      contract,
      visiting,
    ] = await Promise.all([
      this.db().appointmentOrder.count({
        where: {
          tenantId,
          status: { in: ['GENERATED', 'SENT', 'ACCEPTED', 'JOINED'] },
        },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, status: 'SENT' },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, status: 'JOINED' },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, status: 'NOT_JOINED' },
      }),
      this.db().staffProfile.count({
        where: {
          tenantId,
          deletedAt: null,
          probationEndDate: { not: null },
          confirmationDate: null,
        },
      }),
      this.db().staffProfile.count({
        where: { tenantId, deletedAt: null, confirmationDate: { not: null } },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, appointmentType: 'TEMPORARY' },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, appointmentType: 'CONTRACT' },
      }),
      this.db().appointmentOrder.count({
        where: { tenantId, appointmentType: 'VISITING_FACULTY' },
      }),
    ]);
    return {
      issued,
      pendingAcceptance,
      joined,
      notJoined,
      probation,
      confirmed,
      temporary,
      contract,
      visiting,
    };
  }

  listCandidates(tenantId: string, search?: string) {
    return this.db().recruitmentApplication.findMany({
      where: {
        tenantId,
        status: {
          in: [
            'APPLIED',
            'SUBMITTED',
            'SHORTLISTED',
            'INTERVIEW',
            'SELECTED',
            'OFFERED',
            'HIRED',
          ],
        },
        ...(search?.trim()
          ? {
              OR: [
                { fullName: { contains: search.trim(), mode: 'insensitive' } },
                {
                  applicationNo: {
                    contains: search.trim(),
                    mode: 'insensitive',
                  },
                },
                { mobile: { contains: search.trim() } },
              ],
            }
          : {}),
      },
      include: {
        vacancy: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
      take: 50,
    });
  }

  async getCandidate(tenantId: string, applicationId: string) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: {
        vacancy: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, label: true } },
          },
        },
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    const addr = app.addressJson as { line1?: string; city?: string } | null;
    return {
      ...app,
      addressText: addr
        ? [addr.line1, addr.city].filter(Boolean).join(', ')
        : null,
    };
  }

  list(tenantId: string, filters: AppointmentOrderQueryDto = {}) {
    return this.db().appointmentOrder.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.designationId
          ? { designationId: filters.designationId }
          : {}),
        ...(filters.appointmentType
          ? { appointmentType: filters.appointmentType }
          : {}),
        ...(filters.staffType ? { staffType: filters.staffType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const order = await this.db().appointmentOrder.findFirst({
      where: { id, tenantId },
      include: {
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        joiningReport: true,
      },
    });
    if (!order) throw new NotFoundException('Appointment order not found');
    return order;
  }

  async create(user: JwtUser, dto: CreateAppointmentOrderDto) {
    const candidate = await this.getCandidate(user.tid, dto.applicationId);
    const addr = candidate.addressText ?? '';
    return this.db().appointmentOrder.create({
      data: {
        tenantId: user.tid,
        applicationId: dto.applicationId,
        vacancyId: candidate.vacancyId,
        offerId: dto.offerId ?? candidate.offers?.[0]?.id ?? null,
        candidateName: candidate.fullName,
        fatherName: candidate.fatherName,
        addressText: addr,
        mobile: candidate.mobile,
        email: candidate.email,
        dateOfBirth: candidate.dateOfBirth,
        qualification: candidate.qualification,
        photoUrl: candidate.photoUrl,
        appointmentType: dto.appointmentType,
        employmentMode: dto.employmentMode ?? 'FULL_TIME',
        staffType: dto.staffType,
        designationId: dto.designationId ?? candidate.vacancy?.designationId,
        departmentId: dto.departmentId ?? candidate.vacancy?.departmentId,
        shiftId: dto.shiftId,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
        reportingTo: dto.reportingTo,
        payStructureTemplateId: dto.payStructureTemplateId,
        basicPay: dto.basicPay,
        salaryBreakup: dto.salaryBreakup ?? undefined,
        grossSalary: dto.grossSalary,
        totalDeductions: dto.totalDeductions,
        netSalary: dto.netSalary,
        templateId: dto.templateId,
        termsHtml: dto.termsHtml,
        status: 'DRAFT',
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateAppointmentOrderDto) {
    const order = await this.get(user.tid, id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be edited.');
    }
    return this.db().appointmentOrder.update({
      where: { id },
      data: {
        appointmentType: dto.appointmentType,
        employmentMode: dto.employmentMode,
        staffType: dto.staffType,
        designationId: dto.designationId,
        departmentId: dto.departmentId,
        shiftId: dto.shiftId,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        reportingTo: dto.reportingTo,
        payStructureTemplateId: dto.payStructureTemplateId,
        basicPay: dto.basicPay,
        salaryBreakup: dto.salaryBreakup ?? undefined,
        grossSalary: dto.grossSalary,
        totalDeductions: dto.totalDeductions,
        netSalary: dto.netSalary,
        templateId: dto.templateId,
        termsHtml: dto.termsHtml,
      },
    });
  }

  async previewSalary(tenantId: string, templateId: string, basicPay: number) {
    const lines = await this.payStructures.previewStructure(
      tenantId,
      templateId,
      basicPay,
    );
    const earnings = lines.filter((l) => l.componentType === 'EARNING');
    const deductions = lines.filter((l) => l.componentType === 'DEDUCTION');
    const gross = earnings.reduce((s, l) => s + Number(l.amount), 0);
    const totalDed = deductions.reduce((s, l) => s + Number(l.amount), 0);
    return {
      lines,
      grossSalary: gross,
      totalDeductions: totalDed,
      netSalary: gross - totalDed,
    };
  }

  private async nextOrderNo(tenantId: string) {
    const year = new Date().getFullYear();
    const seq = await this.db().appointmentOrderSequence.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, currentNo: 1 },
      update: { currentNo: { increment: 1 } },
    });
    const no = seq.currentNo;
    return `DBC/APPT/${year}/${String(no).padStart(3, '0')}`;
  }

  private async nextReferenceNo(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.db().appointmentOrder.count({
      where: { tenantId },
    });
    return `DBC/JS/11/${year}/ - ${String(count + 1).padStart(2, '0')}`;
  }

  async generate(user: JwtUser, id: string, audit?: AuditMeta) {
    const order = await this.get(user.tid, id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be generated.');
    }

    const [designation, department, shift, tenant, branding] =
      await Promise.all([
        order.designationId
          ? this.db().designation.findFirst({
              where: { id: order.designationId },
            })
          : null,
        order.departmentId
          ? this.db().department.findFirst({
              where: { id: order.departmentId },
            })
          : null,
        order.shiftId
          ? this.db().shift.findFirst({ where: { id: order.shiftId } })
          : null,
        this.db().tenant.findFirst({ where: { id: user.tid } }),
        this.db().tenantBranding.findFirst({ where: { tenantId: user.tid } }),
      ]);

    const principal = await this.db().certificateSignature.findFirst({
      where: { tenantId: user.tid, roleSlug: 'principal', isActive: true },
    });

    const salaryLines =
      (order.salaryBreakup as Array<{
        name: string;
        amount: number;
        componentType?: string;
      }>) ?? [];
    const net = Number(order.netSalary ?? 0);
    const termsBlock =
      order.termsHtml ??
      (order.staffType === 'TEACHING'
        ? DEFAULT_TERMS_TEACHING
        : DEFAULT_TERMS_NON_TEACHING);

    const vars: Record<string, string> = {
      staff_name: order.candidateName,
      designation: designation?.label ?? 'Staff',
      department: department?.name ?? '—',
      shift: shift?.name ?? 'Day',
      joining_date: order.joiningDate
        ? new Date(order.joiningDate).toLocaleDateString('en-IN')
        : '—',
      salary: `₹${net.toLocaleString('en-IN')}`,
      address: order.addressText ?? '',
      principal_name: principal?.displayName ?? 'Principal',
      college_name: tenant?.name ?? 'Don Bosco College, Tura',
      academic_year: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
      salary_table: buildSalaryTableHtml(salaryLines),
      terms_block: `<div class="terms">${termsBlock}</div>`,
    };

    const bodyHtml = renderTemplate(DEFAULT_APPOINTMENT_BODY, vars);
    const verifyToken = randomUUID();
    const verifyHash = createHash('sha256')
      .update(`${id}:${order.applicationId}:${verifyToken}`)
      .digest('hex');
    const verifyCode = verifyHash.slice(0, 16).toUpperCase();
    const verifyUrl = `${process.env.WEB_PUBLIC_URL ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/verify/appointment-order/${verifyToken}`;

    const orderNo = await this.nextOrderNo(user.tid);
    const referenceNo = await this.nextReferenceNo(user.tid);
    const dateLabel = `Tura, the ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const renderedHtml = buildAppointmentOrderHtml({
      collegeName: tenant?.name ?? 'Don Bosco College, Tura',
      collegeAddress: branding?.addressLine ?? 'Tura, Meghalaya',
      naacInfo: '(Re-accredited with B Grade by NAAC)',
      referenceNo,
      dateLabel,
      candidateName: order.candidateName,
      addressText: order.addressText ?? '—',
      subject: `Appointment to the Post of ${designation?.label ?? 'Staff'} (${shift?.name ?? 'Day'} Shift)`,
      bodyHtml,
      principalName: principal?.displayName ?? 'Principal',
      verifyUrl,
      verifyCode,
    });

    const updated = await this.db().appointmentOrder.update({
      where: { id },
      data: {
        orderNo,
        referenceNo,
        renderedHtml,
        verifyToken,
        verifyHash,
        verifyCode,
        status: 'GENERATED',
        generatedById: user.sub,
        generatedAt: new Date(),
      },
    });

    await this.audit(user, id, 'GENERATED', audit);
    void this.documents.generatePdf(user.tid, id);
    return updated;
  }

  async send(user: JwtUser, id: string, audit?: AuditMeta) {
    const order = await this.get(user.tid, id);
    if (!['GENERATED', 'SENT'].includes(order.status)) {
      throw new BadRequestException('Order must be generated before sending.');
    }
    const updated = await this.db().appointmentOrder.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: {
        application: {
          include: { vacancy: { select: { title: true } } },
        },
      },
    });
    await this.audit(user, id, 'SENT', audit);
    void this.recruitmentNotifications.appointmentOrderSent(
      user.tid,
      id,
      updated.application,
      updated,
    );
    return updated;
  }

  async accept(
    user: JwtUser,
    id: string,
    dto: AcceptAppointmentOrderDto,
    audit?: AuditMeta,
  ) {
    const order = await this.get(user.tid, id);
    if (order.status !== 'SENT') {
      throw new BadRequestException('Only sent orders can be accepted.');
    }
    const updated = await this.db().appointmentOrder.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedById: user.sub,
        signedCopyUrl: dto.signedCopyUrl ?? null,
      },
    });
    await this.audit(user, id, 'ACCEPTED', audit, {
      signedCopyUrl: dto.signedCopyUrl,
    });
    return updated;
  }

  async reject(
    user: JwtUser,
    id: string,
    dto: RejectAppointmentOrderDto,
    audit?: AuditMeta,
  ) {
    const order = await this.get(user.tid, id);
    if (!['SENT', 'GENERATED'].includes(order.status)) {
      throw new BadRequestException('Cannot reject this order.');
    }
    const updated = await this.db().appointmentOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
    await this.audit(user, id, 'REJECTED', audit, { reason: dto.reason });
    return updated;
  }

  async cancel(
    user: JwtUser,
    id: string,
    dto: CancelAppointmentOrderDto,
    audit?: AuditMeta,
  ) {
    const order = await this.get(user.tid, id);
    if (['JOINED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Cannot cancel this order.');
    }
    const updated = await this.db().appointmentOrder.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.audit(user, id, 'CANCELLED', audit, { reason: dto.reason });
    return updated;
  }

  async reissue(user: JwtUser, id: string) {
    const order = await this.get(user.tid, id);
    const clone = await this.db().appointmentOrder.create({
      data: {
        tenantId: user.tid,
        applicationId: order.applicationId,
        vacancyId: order.vacancyId,
        offerId: order.offerId,
        templateId: order.templateId,
        supersedesOrderId: id,
        revisionNo: (order.revisionNo ?? 1) + 1,
        candidateName: order.candidateName,
        fatherName: order.fatherName,
        addressText: order.addressText,
        mobile: order.mobile,
        email: order.email,
        dateOfBirth: order.dateOfBirth,
        qualification: order.qualification,
        photoUrl: order.photoUrl,
        appointmentType: order.appointmentType,
        employmentMode: order.employmentMode,
        staffType: order.staffType,
        designationId: order.designationId,
        departmentId: order.departmentId,
        shiftId: order.shiftId,
        joiningDate: order.joiningDate,
        reportingTo: order.reportingTo,
        basicPay: order.basicPay,
        grossSalary: order.grossSalary,
        totalDeductions: order.totalDeductions,
        netSalary: order.netSalary,
        payStructureTemplateId: order.payStructureTemplateId,
        salaryBreakup: order.salaryBreakup ?? undefined,
        termsHtml: order.termsHtml,
        status: 'DRAFT',
      },
    });
    await this.audit(user, clone.id, 'REISSUED', undefined, {
      fromOrderId: id,
    });
    return clone;
  }

  async verifyPublic(token: string) {
    const order = await this.db().appointmentOrder.findFirst({
      where: { verifyToken: token },
    });
    if (!order) throw new NotFoundException('Invalid verification token');
    return {
      valid: true,
      orderNo: order.orderNo,
      candidateName: order.candidateName,
      status: order.status,
      verifyCode: order.verifyCode,
      generatedAt: order.generatedAt,
    };
  }

  getPdf(tenantId: string, id: string) {
    return this.documents.getPdfBuffer(tenantId, id);
  }

  private async audit(
    user: JwtUser,
    orderId: string,
    action: string,
    audit?: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    await this.db().appointmentOrderAuditLog.create({
      data: {
        tenantId: user.tid,
        orderId,
        actorId: user.sub,
        action,
        ipAddress: audit?.clientIp ?? null,
        userAgent: audit?.userAgent ?? null,
        metadata: metadata ?? {},
      },
    });
  }
}
