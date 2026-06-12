import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationEmailService } from '../../communication/services/communication-email.service';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PayslipDocumentService } from './payslip-document.service';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

@Injectable()
export class PayslipNotificationService {
  private readonly logger = new Logger(PayslipNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: CommunicationEmailService,
    private readonly payslipDocs: PayslipDocumentService,
    private readonly config: ConfigService,
  ) {}

  async emailRunPayslips(user: JwtUser, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'PUBLISHED') {
      return {
        sent: 0,
        skipped: 0,
        failed: 0,
        note: 'Only published runs can email payslips',
      };
    }

    const payslips = await this.prisma.payslip.findMany({
      where: { payrollRunId: runId, tenantId: user.tid, status: 'PUBLISHED' },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            email: true,
            portalUserId: true,
            portalUser: { select: { email: true } },
          },
        },
      },
    });

    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: user.tid },
      select: { displayName: true },
    });
    const institution = branding?.displayName ?? 'Your Institution';
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const ps of payslips) {
      const to =
        ps.staffProfile.portalUser?.email?.trim() ||
        ps.staffProfile.email?.trim() ||
        '';
      if (!to) {
        skipped++;
        continue;
      }

      try {
        if (!ps.pdfPath) await this.payslipDocs.generatePdf(user.tid, ps.id);
        const period = `${MONTHS[ps.month - 1]} ${ps.year}`;
        const result = await this.email.send({
          to,
          subject: `${institution} — Salary Payslip ${period}`,
          html: `
            <p>Dear ${ps.staffProfile.fullName},</p>
            <p>Your salary payslip for <strong>${period}</strong> has been published.</p>
            <ul>
              <li>Gross: ₹${Number(ps.grossSalary).toLocaleString('en-IN')}</li>
              <li>Net: ₹${Number(ps.netSalary).toLocaleString('en-IN')}</li>
            </ul>
            <p><a href="${appUrl}/staff/salary">View payslip in Staff Portal</a></p>
            <p style="color:#666;font-size:12px">This is an automated message from ${institution} ERP.</p>
          `,
        });

        if (result.ok) {
          await this.prisma.payslip.update({
            where: { id: ps.id },
            data: { emailSentAt: new Date() },
          });
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        this.logger.warn(
          `Payslip email failed for ${ps.id}: ${err instanceof Error ? err.message : err}`,
        );
        failed++;
      }
    }

    return { sent, skipped, failed, total: payslips.length };
  }

  async emailOnePayslip(user: JwtUser, payslipId: string) {
    const ps = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId: user.tid },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            email: true,
            portalUserId: true,
            portalUser: { select: { email: true } },
          },
        },
      },
    });
    if (!ps) throw new NotFoundException('Payslip not found');

    const to =
      ps.staffProfile.portalUser?.email?.trim() ||
      ps.staffProfile.email?.trim() ||
      '';
    if (!to)
      return {
        sent: 0,
        skipped: 1,
        failed: 0,
        note: 'No email on staff profile',
      };

    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: user.tid },
      select: { displayName: true },
    });
    const institution = branding?.displayName ?? 'Your Institution';
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const period = `${MONTHS[ps.month - 1]} ${ps.year}`;

    if (!ps.pdfPath) await this.payslipDocs.generatePdf(user.tid, ps.id);
    const result = await this.email.send({
      to,
      subject: `${institution} — Salary Payslip ${period}`,
      html: `
        <p>Dear ${ps.staffProfile.fullName},</p>
        <p>Your salary payslip for <strong>${period}</strong> is attached below.</p>
        <ul>
          <li>Gross: ₹${Number(ps.grossSalary).toLocaleString('en-IN')}</li>
          <li>Net: ₹${Number(ps.netSalary).toLocaleString('en-IN')}</li>
        </ul>
        <p><a href="${appUrl}/staff/salary">View payslip in Staff Portal</a></p>
      `,
    });

    if (result.ok) {
      await this.prisma.payslip.update({
        where: { id: ps.id },
        data: { emailSentAt: new Date() },
      });
      return { sent: 1, skipped: 0, failed: 0 };
    }
    return { sent: 0, skipped: 0, failed: 1 };
  }
}
