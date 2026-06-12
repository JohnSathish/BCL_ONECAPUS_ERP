import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { NepCategory } from '../domain/nep-categories';
import { DEFAULT_SEMESTER_CREDIT_TARGET } from '../domain/fyugp-templates';
import { CreditLedgerService } from './credit-ledger.service';
import { resolveSemesterCreditTarget } from './structure-rules.helper';

@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditLedgerService,
  ) {}

  async allocateRegistration(
    tenantId: string,
    registrationId: string,
    actorId?: string,
  ) {
    const reg = await this.prisma.semesterRegistration.findFirstOrThrow({
      where: { id: registrationId, tenantId },
      include: {
        lines: {
          include: {
            offeringSection: {
              include: {
                courseOffering: { include: { course: true } },
                shift: true,
              },
            },
            offering: { include: { course: true } },
          },
        },
      },
    });

    const lines = [...reg.lines].sort(
      (a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0),
    );

    return this.prisma.$transaction(async (tx) => {
      let rank = 1;
      for (const line of lines) {
        if (!line.offeringSectionId) {
          throw new BadRequestException(
            `Line ${line.id} missing offering section`,
          );
        }

        const section = line.offeringSection!;
        const offering = section.courseOffering ?? line.offering;

        await tx.$executeRaw`
          SELECT 1 FROM academic.offering_seat_ledgers
          WHERE offering_section_id = ${line.offeringSectionId}::uuid
          FOR UPDATE
        `;

        let ledger = await tx.offeringSeatLedger.findUnique({
          where: { offeringSectionId: line.offeringSectionId },
        });
        if (!ledger) {
          ledger = await tx.offeringSeatLedger.create({
            data: { tenantId, offeringSectionId: line.offeringSectionId },
          });
        }

        let status = 'confirmed';
        if (ledger.confirmedCount >= section.capacity) {
          if (ledger.waitlistCount >= section.waitlistCapacity) {
            status = 'rejected';
          } else {
            status = 'waitlisted';
            await tx.offeringSeatLedger.update({
              where: { offeringSectionId: line.offeringSectionId },
              data: { waitlistCount: { increment: 1 } },
            });
          }
        } else {
          await tx.offeringSeatLedger.update({
            where: { offeringSectionId: line.offeringSectionId },
            data: { confirmedCount: { increment: 1 } },
          });
        }

        await tx.semesterRegistrationLine.update({
          where: { id: line.id },
          data: { status, priorityRank: rank++ },
        });

        if (status === 'confirmed') {
          await this.credits.postConfirmedLine(tx, {
            tenantId,
            studentId: reg.studentId,
            lineId: line.id,
            category: line.category as NepCategory,
            semesterSequence: reg.semesterSequence,
            courseCode: offering.course.code,
            credits: offering.course.credits,
          });
        }
      }

      await tx.registrationAuditLog.create({
        data: {
          tenantId,
          registrationId,
          action: 'allocated',
          actorId,
          metadata: { lineCount: lines.length },
        },
      });

      const earned = await tx.semesterRegistrationLine.findMany({
        where: {
          registration: {
            studentId: reg.studentId,
            semesterSequence: reg.semesterSequence,
          },
          status: 'confirmed',
        },
        include: { offering: { include: { course: true } } },
      });
      const creditsSum = earned.reduce(
        (s, l) => s + Number(l.offering.course.credits),
        0,
      );
      const student = await tx.student.findFirst({
        where: { id: reg.studentId },
        select: { programVersionId: true },
      });
      const creditsRequired = student?.programVersionId
        ? await resolveSemesterCreditTarget(
            tx,
            tenantId,
            student.programVersionId,
            reg.semesterSequence,
          )
        : DEFAULT_SEMESTER_CREDIT_TARGET;

      await tx.studentSemesterProgress.upsert({
        where: {
          studentId_semesterSequence: {
            studentId: reg.studentId,
            semesterSequence: reg.semesterSequence,
          },
        },
        create: {
          tenantId,
          studentId: reg.studentId,
          semesterSequence: reg.semesterSequence,
          calendarSemesterId: reg.semesterId,
          creditsEarned: creditsSum,
          creditsRequired,
          status: 'completed',
          completedAt: new Date(),
        },
        update: {
          calendarSemesterId: reg.semesterId,
          creditsEarned: creditsSum,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      return tx.semesterRegistration.update({
        where: { id: registrationId },
        data: { status: 'completed', submittedAt: new Date() },
        include: {
          lines: {
            include: {
              offering: { include: { course: true } },
              offeringSection: {
                include: {
                  shift: true,
                  courseOffering: { include: { course: true } },
                },
              },
            },
          },
          semester: true,
        },
      });
    });
  }

  async promoteWaitlist(
    tenantId: string,
    lineId: string,
    promotedById?: string,
  ) {
    const line = await this.prisma.semesterRegistrationLine.findFirst({
      where: { id: lineId, tenantId, status: 'waitlisted' },
      include: {
        offeringSection: {
          include: { courseOffering: { include: { course: true } } },
        },
        offering: { include: { course: true } },
        registration: true,
      },
    });
    if (!line?.offeringSectionId)
      throw new BadRequestException('Waitlisted line not found');
    const sectionId = line.offeringSectionId;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT 1 FROM academic.offering_seat_ledgers
        WHERE offering_section_id = ${sectionId}::uuid
        FOR UPDATE
      `;

      const section = line.offeringSection!;
      const ledger = await tx.offeringSeatLedger.findUniqueOrThrow({
        where: { offeringSectionId: sectionId },
      });
      if (ledger.confirmedCount >= section.capacity) {
        throw new BadRequestException('No seats available');
      }

      await tx.offeringSeatLedger.update({
        where: { offeringSectionId: sectionId },
        data: {
          confirmedCount: { increment: 1 },
          waitlistCount: { decrement: 1 },
        },
      });

      await tx.semesterRegistrationLine.update({
        where: { id: lineId },
        data: { status: 'confirmed' },
      });

      await tx.waitlistPromotion.create({
        data: {
          tenantId,
          lineId,
          offeringId: line.offeringId,
          offeringSectionId: sectionId,
          promotedById: promotedById ?? undefined,
        },
      });

      const offering = section.courseOffering ?? line.offering;
      await this.credits.postConfirmedLine(tx, {
        tenantId,
        studentId: line.registration.studentId,
        lineId: line.id,
        category: line.category as NepCategory,
        semesterSequence: line.registration.semesterSequence,
        courseCode: offering.course.code,
        credits: offering.course.credits,
        descriptionPrefix: 'Waitlist promotion',
      });

      return { ok: true };
    });
  }
}
