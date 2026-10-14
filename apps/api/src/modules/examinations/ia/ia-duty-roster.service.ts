import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { IaAdmitPdfService } from './ia-admit-pdf.service';
import {
  DEFAULT_DUTY_BANDS,
  normalizeDutyBands,
  requiredInvigilators,
  type DutyBand,
} from './ia-duty-rules';

type HallInput = {
  id?: string;
  classroomId?: string | null;
  hallLabel: string;
  studentCount: number;
  capacity?: number | null;
  specialRoom?: boolean;
  approvedRequired?: number;
  overrideReason?: string | null;
};

type SittingInput = {
  id?: string;
  examDate: string;
  sessionLabel: 'MORNING' | 'AFTERNOON' | 'CUSTOM' | string;
  customLabel?: string | null;
  startTime: string;
  endTime: string;
  reportingTime?: string | null;
  halls: HallInput[];
};

const rosterInclude = {
  sittings: {
    orderBy: [{ examDate: 'asc' as const }, { sortOrder: 'asc' as const }],
    include: {
      halls: {
        orderBy: { sortOrder: 'asc' as const },
        include: { assignments: true },
      },
    },
  },
};

@Injectable()
export class IaDutyRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: IaAdmitPdfService,
    private readonly notifications: UserNotificationsService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  async rules(tenantId: string) {
    const row = await this.prisma.examDutyRule.findUnique({
      where: { tenantId },
    });
    return {
      bands: normalizeDutyBands(row?.bands ?? DEFAULT_DUTY_BANDS),
      minimum: row?.minimum ?? 1,
      specialHallExtra: row?.specialHallExtra ?? 1,
    };
  }

  async saveRules(
    tenantId: string,
    input: { bands: DutyBand[]; minimum?: number; specialHallExtra?: number },
  ) {
    const bands = normalizeDutyBands(input.bands);
    const minimum = Math.max(1, input.minimum ?? 1);
    const specialHallExtra = Math.max(0, input.specialHallExtra ?? 1);
    await this.prisma.examDutyRule.upsert({
      where: { tenantId },
      create: { tenantId, bands, minimum, specialHallExtra },
      update: { bands, minimum, specialHallExtra },
    });
    return this.rules(tenantId);
  }

  async getRoster(user: JwtUser, sessionId: string) {
    const session = await this.sessionOrThrow(user.tid, sessionId);
    let roster = await this.prisma.examDutyRoster.findFirst({
      where: { tenantId: user.tid, sessionId, deletedAt: null },
      include: rosterInclude,
    });
    if (!roster) {
      roster = await this.prisma.examDutyRoster.create({
        data: {
          tenantId: user.tid,
          sessionId,
          instructions:
            'Report to the examination cell 15 minutes before the scheduled time.',
        },
        include: rosterInclude,
      });
      await this.seedFromTimetable(user.tid, roster.id, sessionId);
      roster = await this.reload(user.tid, roster.id);
      await this.audit(user, roster.id, 'CREATE', { sessionId });
    } else if (roster.sittings.length === 0) {
      await this.seedFromTimetable(user.tid, roster.id, sessionId);
      roster = await this.reload(user.tid, roster.id);
    }
    return this.present(user.tid, session, roster);
  }

  async saveRoster(
    user: JwtUser,
    sessionId: string,
    input: {
      instructions?: string;
      acknowledgeRevision?: boolean;
      sittings: SittingInput[];
    },
  ) {
    const current = await this.getRoster(user, sessionId);
    this.assertEditable(current.status, input.acknowledgeRevision);
    const rules = await this.rules(user.tid);
    const rosterId = current.id;
    this.assertUniqueHalls(input.sittings);

    await this.prisma.$transaction(async (tx) => {
      const keptSittingIds: string[] = [];
      for (const [index, sitting] of input.sittings.entries()) {
        const sittingRow = sitting.id
          ? await tx.examDutySitting.update({
              where: { id: sitting.id },
              data: this.sittingData(user.tid, rosterId, sitting, index),
            })
          : await tx.examDutySitting.create({
              data: this.sittingData(user.tid, rosterId, sitting, index),
            });
        keptSittingIds.push(sittingRow.id);
        const keptHallIds: string[] = [];
        for (const [hallIndex, hall] of sitting.halls.entries()) {
          const calculated = requiredInvigilators(
            hall.studentCount,
            rules.bands,
            rules.minimum,
            Boolean(hall.specialRoom),
            rules.specialHallExtra,
          );
          const approved = hall.approvedRequired ?? calculated;
          if (approved !== calculated && !hall.overrideReason?.trim()) {
            throw new BadRequestException(
              `Hall ${hall.hallLabel} needs a reason when the approved count differs from the calculated count.`,
            );
          }
          const data = {
            tenantId: user.tid,
            sittingId: sittingRow.id,
            classroomId: hall.classroomId || null,
            hallLabel: hall.hallLabel.trim(),
            studentCount: Math.max(0, Math.floor(hall.studentCount || 0)),
            capacity: hall.capacity ?? null,
            specialRoom: Boolean(hall.specialRoom),
            calculatedRequired: calculated,
            approvedRequired: Math.max(0, Math.floor(approved)),
            overrideReason:
              approved === calculated ? null : hall.overrideReason?.trim(),
            overrideById: approved === calculated ? null : user.sub,
            overrideAt: approved === calculated ? null : new Date(),
            sortOrder: hallIndex,
          };
          const hallRow = hall.id
            ? await tx.examDutyHall.update({ where: { id: hall.id }, data })
            : await tx.examDutyHall.create({ data });
          keptHallIds.push(hallRow.id);
        }
        await tx.examDutyHall.deleteMany({
          where: { sittingId: sittingRow.id, id: { notIn: keptHallIds } },
        });
      }
      await tx.examDutySitting.deleteMany({
        where: { rosterId, id: { notIn: keptSittingIds } },
      });
      await tx.examDutyRoster.update({
        where: { id: rosterId },
        data: {
          instructions: input.instructions ?? current.instructions,
          revision:
            current.status === 'PUBLISHED' ? { increment: 1 } : undefined,
        },
      });
    });
    await this.audit(
      user,
      rosterId,
      current.status === 'PUBLISHED' ? 'REVISE' : 'EDIT',
      {
        sittings: input.sittings.length,
      },
    );
    if (current.status === 'PUBLISHED')
      await this.notifyRoster(user.tid, rosterId, 'changed');
    return this.getRoster(user, sessionId);
  }

  async suggest(user: JwtUser, sessionId: string, acknowledgeRevision = false) {
    const current = await this.getRoster(user, sessionId);
    this.assertEditable(current.status, acknowledgeRevision);
    const roster = await this.reload(user.tid, current.id);
    const staff = await this.activeStaff(user.tid);
    const leave = await this.leaveByDate(
      user.tid,
      roster.sittings.map((sitting) => sitting.examDate),
    );
    const dutyCount = new Map<string, number>();
    for (const sitting of roster.sittings) {
      for (const hall of sitting.halls) {
        for (const assignment of hall.assignments) {
          dutyCount.set(
            assignment.staffProfileId,
            (dutyCount.get(assignment.staffProfileId) ?? 0) + 1,
          );
        }
      }
    }
    const unfilled: {
      hall: string;
      date: string;
      session: string;
      needed: number;
    }[] = [];
    let assigned = 0;
    for (const sitting of roster.sittings) {
      const day = isoDate(sitting.examDate);
      const away = leave.get(day) ?? new Set<string>();
      const used = new Set(
        sitting.halls.flatMap((hall) =>
          hall.assignments.map((row) => row.staffProfileId),
        ),
      );
      for (const hall of sitting.halls) {
        const open = hall.approvedRequired - hall.assignments.length;
        if (open <= 0) continue;
        const pool = staff
          .filter((person) => !away.has(person.id) && !used.has(person.id))
          .sort(
            (a, b) =>
              (dutyCount.get(a.id) ?? 0) - (dutyCount.get(b.id) ?? 0) ||
              a.fullName.localeCompare(b.fullName),
          );
        const picked = pool.slice(0, open);
        if (picked.length < open) {
          unfilled.push({
            hall: hall.hallLabel,
            date: day,
            session: sessionTitle(sitting.sessionLabel, sitting.customLabel),
            needed: open - picked.length,
          });
        }
        if (!picked.length) continue;
        await this.prisma.examDutyAssignment.createMany({
          data: picked.map((person) => ({
            tenantId: user.tid,
            sittingId: sitting.id,
            hallId: hall.id,
            staffProfileId: person.id,
          })),
        });
        for (const person of picked) {
          used.add(person.id);
          dutyCount.set(person.id, (dutyCount.get(person.id) ?? 0) + 1);
          assigned += 1;
        }
      }
    }
    await this.audit(user, current.id, 'GENERATE', { assigned, unfilled });
    if (current.status === 'PUBLISHED') {
      await this.prisma.examDutyRoster.update({
        where: { id: current.id },
        data: { revision: { increment: 1 } },
      });
      await this.notifyRoster(user.tid, current.id, 'changed');
    }
    return { ...(await this.getRoster(user, sessionId)), assigned, unfilled };
  }

  async assign(
    user: JwtUser,
    sessionId: string,
    input: {
      hallId: string;
      staffProfileId: string;
      acknowledgeConflict?: boolean;
      acknowledgeRevision?: boolean;
    },
  ) {
    const current = await this.getRoster(user, sessionId);
    this.assertEditable(current.status, input.acknowledgeRevision);
    const hall = await this.prisma.examDutyHall.findFirst({
      where: { id: input.hallId, tenantId: user.tid },
      include: { sitting: true },
    });
    if (!hall || hall.sitting.rosterId !== current.id)
      throw new NotFoundException('Hall not found');
    await this.placeStaff(
      user,
      current.id,
      hall.sittingId,
      hall.id,
      input.staffProfileId,
      input.acknowledgeConflict,
    );
    if (current.status === 'PUBLISHED')
      await this.bumpAndNotify(user, current.id);
    else
      await this.audit(user, current.id, 'ASSIGN', {
        hallId: hall.id,
        staffProfileId: input.staffProfileId,
      });
    return this.getRoster(user, sessionId);
  }

  async removeAssignment(
    user: JwtUser,
    sessionId: string,
    assignmentId: string,
    acknowledgeRevision = false,
  ) {
    const current = await this.getRoster(user, sessionId);
    this.assertEditable(current.status, acknowledgeRevision);
    const row = await this.prisma.examDutyAssignment.findFirst({
      where: {
        id: assignmentId,
        tenantId: user.tid,
        sitting: { rosterId: current.id },
      },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    await this.prisma.examDutyAssignment.delete({ where: { id: row.id } });
    await this.audit(user, current.id, 'REMOVE', { assignmentId });
    if (current.status === 'PUBLISHED')
      await this.bumpAndNotify(user, current.id);
    return this.getRoster(user, sessionId);
  }

  async moveAssignment(
    user: JwtUser,
    sessionId: string,
    input: {
      assignmentId: string;
      hallId: string;
      acknowledgeConflict?: boolean;
      acknowledgeRevision?: boolean;
    },
  ) {
    const current = await this.getRoster(user, sessionId);
    this.assertEditable(current.status, input.acknowledgeRevision);
    const row = await this.prisma.examDutyAssignment.findFirst({
      where: {
        id: input.assignmentId,
        tenantId: user.tid,
        sitting: { rosterId: current.id },
      },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    const hall = await this.prisma.examDutyHall.findFirst({
      where: { id: input.hallId, tenantId: user.tid },
    });
    if (!hall) throw new NotFoundException('Hall not found');
    await this.prisma.examDutyAssignment.delete({ where: { id: row.id } });
    await this.placeStaff(
      user,
      current.id,
      hall.sittingId,
      hall.id,
      row.staffProfileId,
      input.acknowledgeConflict,
    );
    await this.audit(user, current.id, 'MOVE', {
      from: row.hallId,
      to: hall.id,
      staffProfileId: row.staffProfileId,
    });
    if (current.status === 'PUBLISHED')
      await this.bumpAndNotify(user, current.id);
    return this.getRoster(user, sessionId);
  }

  async publish(user: JwtUser, sessionId: string, acknowledgeWarnings = false) {
    const current = await this.getRoster(user, sessionId);
    const warnings = this.warnings(current);
    if (warnings.length && !acknowledgeWarnings) {
      throw new BadRequestException({
        message: 'Resolve the roster warnings or confirm them.',
        warnings,
      });
    }
    await this.prisma.examDutyRoster.update({
      where: { id: current.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: user.sub,
        revision:
          current.status === 'PUBLISHED'
            ? { increment: 1 }
            : Math.max(1, current.revision),
      },
    });
    await this.audit(user, current.id, 'PUBLISH', { warnings });
    await this.notifyRoster(user.tid, current.id, 'assigned');
    return this.getRoster(user, sessionId);
  }

  async reopen(user: JwtUser, sessionId: string) {
    const current = await this.getRoster(user, sessionId);
    await this.prisma.examDutyRoster.update({
      where: { id: current.id },
      data: { status: 'DRAFT' },
    });
    await this.audit(user, current.id, 'REOPEN', {});
    return this.getRoster(user, sessionId);
  }

  async renderMySlip(user: JwtUser) {
    const mine = await this.myDuties(user);
    if (!mine.staff)
      throw new NotFoundException('No staff profile is linked to this login.');
    const items = mine.duties
      .map(
        (duty) =>
          `<tr><td>${escapeHtml(duty.date)}</td><td>${escapeHtml(duty.session)}</td><td>${escapeHtml(duty.time)}</td><td>${escapeHtml(duty.reportingTime ?? '—')}</td><td>${escapeHtml(duty.hall)}</td><td>${escapeHtml(duty.examName)}</td></tr>`,
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #222; padding: 6px; }
      tr { break-inside: avoid; }
    </style></head><body>
      <h1>My Exam Duties</h1>
      <p>${escapeHtml(mine.staff.fullName)} · ${escapeHtml(mine.staff.employeeCode)}</p>
      <table><thead><tr><th>Date</th><th>Session</th><th>Time</th><th>Reporting</th><th>Hall</th><th>Examination</th></tr></thead><tbody>${items || '<tr><td colspan="6">No published duties.</td></tr>'}</tbody></table>
    </body></html>`;
    const buffer = await this.pdf.htmlToPdf(html);
    return { buffer, filename: 'my-exam-duties.pdf' };
  }

  async myDuties(user: JwtUser) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true, fullName: true, employeeCode: true },
    });
    if (!staff) return { staff: null, duties: [] };
    return { staff, duties: await this.dutiesForStaff(user.tid, staff.id) };
  }

  async renderPdf(
    user: JwtUser,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      staffId?: string;
      scope?: string;
    },
  ) {
    const html = await this.renderHtml(user, sessionId, query);
    const buffer = await this.pdf.htmlToPdf(html);
    return { buffer, filename: 'examination-duty-roster.pdf' };
  }

  async renderXlsx(
    user: JwtUser,
    sessionId: string,
    query: { date?: string; session?: string; staffId?: string },
  ) {
    const view = await this.filtered(user, sessionId, query);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Duty roster');
    sheet.addRow([view.college, view.examName]);
    sheet.addRow([
      'Date',
      'Session',
      'Hall',
      'Students',
      'Required',
      'Invigilator',
      'Department',
    ]);
    for (const sitting of view.sittings) {
      for (const hall of sitting.halls) {
        const people = hall.assignments.length ? hall.assignments : [null];
        for (const person of people) {
          sheet.addRow([
            sitting.date,
            sitting.session,
            hall.hallLabel,
            hall.studentCount,
            hall.approvedRequired,
            person?.fullName ?? '',
            person?.department ?? '',
          ]);
        }
      }
    }
    const staffSheet = book.addWorksheet('Staff totals');
    staffSheet.addRow(['Staff', 'Department', 'Duties', 'Dates', 'Sessions']);
    for (const person of view.staffSummary) {
      staffSheet.addRow([
        person.fullName,
        person.department,
        person.totalDuties,
        person.dates.join(', '),
        person.sessions.join(', '),
      ]);
    }
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, filename: 'examination-duty-roster.xlsx' };
  }

  async renderHtml(
    user: JwtUser,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      staffId?: string;
      scope?: string;
    },
  ) {
    const view = await this.filtered(user, sessionId, query);
    const blocks = view.sittings
      .map((sitting) => {
        const rows = sitting.halls
          .map((hall) => {
            const names =
              hall.assignments.map((person) => person.fullName).join(', ') ||
              '—';
            return `<tr><td>${escapeHtml(hall.hallLabel)}</td><td>${hall.studentCount}</td><td>${hall.approvedRequired}</td><td>${escapeHtml(names)}</td><td></td></tr>`;
          })
          .join('');
        return `<section>
          <h2>${escapeHtml(sitting.date)} · ${escapeHtml(sitting.session)} · ${escapeHtml(sitting.time)}</h2>
          <p>Reporting time: ${escapeHtml(sitting.reportingTime || '—')}</p>
          <table><thead><tr><th>Hall</th><th>Students</th><th>Required</th><th>Invigilators</th><th>Signature</th></tr></thead><tbody>${rows}</tbody></table>
        </section>`;
      })
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #111; font-size: 12px; }
      h1 { font-size: 18px; margin: 0; text-align: center; }
      h2 { font-size: 14px; margin: 16px 0 4px; }
      p { margin: 2px 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #222; padding: 6px; vertical-align: top; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
      .sign { margin-top: 28px; display: flex; justify-content: space-between; }
    </style></head><body>
      <h1>${escapeHtml(view.college)}</h1>
      <p style="text-align:center">${escapeHtml(view.examName)}<br>Examination Duty Roster</p>
      ${view.instructions ? `<p>${escapeHtml(view.instructions)}</p>` : ''}
      ${blocks || '<p>No duties in this selection.</p>'}
      <div class="sign"><span>Examination Cell</span><span>Principal</span></div>
    </body></html>`;
  }

  private async filtered(
    user: JwtUser,
    sessionId: string,
    query: { date?: string; session?: string; staffId?: string },
  ) {
    const roster = await this.getRoster(user, sessionId);
    const sittings = roster.sittings.filter((sitting) => {
      if (query.date && sitting.date !== query.date) return false;
      if (query.session && sitting.sessionLabel !== query.session) return false;
      return true;
    });
    if (!query.staffId) {
      return { ...roster, sittings };
    }
    return {
      ...roster,
      sittings: sittings
        .map((sitting) => ({
          ...sitting,
          halls: sitting.halls
            .map((hall) => ({
              ...hall,
              assignments: hall.assignments.filter(
                (person) => person.staffProfileId === query.staffId,
              ),
            }))
            .filter((hall) => hall.assignments.length),
        }))
        .filter((sitting) => sitting.halls.length),
    };
  }

  private async dutiesForStaff(tenantId: string, staffProfileId: string) {
    const rows = await this.prisma.examDutyAssignment.findMany({
      where: {
        tenantId,
        staffProfileId,
        sitting: { roster: { status: 'PUBLISHED', deletedAt: null } },
      },
      include: {
        hall: true,
        sitting: { include: { roster: true } },
      },
      orderBy: { sitting: { examDate: 'asc' } },
    });
    const sessionIds = [
      ...new Set(rows.map((row) => row.sitting.roster.sessionId)),
    ];
    const sessions = await this.prisma.examSession.findMany({
      where: { id: { in: sessionIds } },
      select: { id: true, name: true },
    });
    const names = new Map(
      sessions.map((session) => [session.id, session.name]),
    );
    return rows.map((row) => ({
      assignmentId: row.id,
      examName: names.get(row.sitting.roster.sessionId) ?? 'Examination',
      date: isoDate(row.sitting.examDate),
      session: sessionTitle(row.sitting.sessionLabel, row.sitting.customLabel),
      time: `${prettyClock(row.sitting.startTime)} – ${prettyClock(row.sitting.endTime)}`,
      reportingTime: row.sitting.reportingTime
        ? prettyClock(row.sitting.reportingTime)
        : null,
      hall: row.hall.hallLabel,
      instructions: row.sitting.roster.instructions,
    }));
  }

  private async present(
    tenantId: string,
    session: { id: string; name: string; academicYearId: string | null },
    roster: Awaited<ReturnType<IaDutyRosterService['reload']>>,
  ) {
    const staffIds = [
      ...new Set(
        roster.sittings.flatMap((sitting) =>
          sitting.halls.flatMap((hall) =>
            hall.assignments.map((row) => row.staffProfileId),
          ),
        ),
      ),
    ];
    const [people, college, classrooms] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where: { id: { in: staffIds } },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: { select: { name: true } },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.classroom.findMany({
        where: {
          tenantId,
          deletedAt: null,
          availableForExams: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          code: true,
          examCapacity: true,
          capacity: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    const staffById = new Map(people.map((person) => [person.id, person]));
    const sittings = roster.sittings.map((sitting) => ({
      id: sitting.id,
      date: isoDate(sitting.examDate),
      sessionLabel: sitting.sessionLabel,
      session: sessionTitle(sitting.sessionLabel, sitting.customLabel),
      customLabel: sitting.customLabel,
      startTime: sitting.startTime,
      endTime: sitting.endTime,
      time: `${prettyClock(sitting.startTime)} – ${prettyClock(sitting.endTime)}`,
      reportingTime: sitting.reportingTime,
      halls: sitting.halls.map((hall) => ({
        id: hall.id,
        classroomId: hall.classroomId,
        hallLabel: hall.hallLabel,
        studentCount: hall.studentCount,
        capacity: hall.capacity,
        specialRoom: hall.specialRoom,
        calculatedRequired: hall.calculatedRequired,
        approvedRequired: hall.approvedRequired,
        overrideReason: hall.overrideReason,
        unfilled: Math.max(0, hall.approvedRequired - hall.assignments.length),
        assignments: hall.assignments.map((assignment) => {
          const person = staffById.get(assignment.staffProfileId);
          return {
            id: assignment.id,
            staffProfileId: assignment.staffProfileId,
            fullName: person?.fullName ?? 'Staff',
            employeeCode: person?.employeeCode ?? '',
            department: person?.department?.name ?? '',
          };
        }),
      })),
    }));
    const staffSummary = this.staffSummary(sittings);
    const positions = sittings.reduce(
      (sum, sitting) =>
        sum +
        sitting.halls.reduce((inner, hall) => inner + hall.approvedRequired, 0),
      0,
    );
    const filled = sittings.reduce(
      (sum, sitting) =>
        sum +
        sitting.halls.reduce(
          (inner, hall) => inner + hall.assignments.length,
          0,
        ),
      0,
    );
    return {
      id: roster.id,
      sessionId: session.id,
      examName: session.name,
      academicYearId: session.academicYearId,
      college: college?.name ?? 'Don Bosco College Tura',
      status: roster.status,
      revision: roster.revision,
      instructions: roster.instructions,
      publishedAt: roster.publishedAt,
      sittings,
      staffSummary,
      classrooms,
      summary: {
        halls: sittings.reduce((sum, sitting) => sum + sitting.halls.length, 0),
        students: sittings.reduce(
          (sum, sitting) =>
            sum +
            sitting.halls.reduce((inner, hall) => inner + hall.studentCount, 0),
          0,
        ),
        required: positions,
        assigned: filled,
        unfilled: Math.max(0, positions - filled),
        teachers: staffSummary.length,
      },
      warnings: this.warnings({ sittings, status: roster.status }),
    };
  }

  private staffSummary(
    sittings: Array<{
      date: string;
      session: string;
      halls: Array<{
        assignments: Array<{
          staffProfileId: string;
          fullName: string;
          department: string;
        }>;
      }>;
    }>,
  ) {
    const map = new Map<
      string,
      {
        staffProfileId: string;
        fullName: string;
        department: string;
        dates: Set<string>;
        sessions: Set<string>;
      }
    >();
    for (const sitting of sittings) {
      for (const hall of sitting.halls) {
        for (const person of hall.assignments) {
          const row = map.get(person.staffProfileId) ?? {
            staffProfileId: person.staffProfileId,
            fullName: person.fullName,
            department: person.department,
            dates: new Set<string>(),
            sessions: new Set<string>(),
          };
          row.dates.add(sitting.date.slice(8, 10));
          row.sessions.add(sitting.session);
          map.set(person.staffProfileId, row);
        }
      }
    }
    return [...map.values()]
      .map((row) => ({
        staffProfileId: row.staffProfileId,
        fullName: row.fullName,
        department: row.department,
        totalDuties: countDuties(sittings, row.staffProfileId),
        dates: [...row.dates],
        sessions: [...row.sessions],
        status: 'Complete',
      }))
      .sort(
        (a, b) =>
          b.totalDuties - a.totalDuties || a.fullName.localeCompare(b.fullName),
      );
  }

  private warnings(roster: {
    status: string;
    sittings: Array<{
      date: string;
      session: string;
      halls: Array<{
        hallLabel: string;
        studentCount: number;
        capacity: number | null;
        approvedRequired: number;
        assignments: unknown[];
      }>;
    }>;
  }) {
    const warnings: string[] = [];
    for (const sitting of roster.sittings) {
      const seen = new Set<string>();
      for (const hall of sitting.halls) {
        const key = hall.hallLabel.trim().toLowerCase();
        if (seen.has(key))
          warnings.push(
            `${sitting.date} ${sitting.session}: duplicate hall ${hall.hallLabel}`,
          );
        seen.add(key);
        if (hall.assignments.length < hall.approvedRequired) {
          warnings.push(
            `${hall.hallLabel} on ${sitting.date} ${sitting.session} is short by ${hall.approvedRequired - hall.assignments.length}`,
          );
        }
        if (hall.capacity && hall.studentCount > hall.capacity) {
          warnings.push(
            `${hall.hallLabel} has ${hall.studentCount} students above capacity ${hall.capacity}`,
          );
        }
      }
    }
    return warnings;
  }

  private async seedFromTimetable(
    tenantId: string,
    rosterId: string,
    sessionId: string,
  ) {
    const [papers, rules] = await Promise.all([
      this.prisma.examPaperSchedule.findMany({
        where: {
          tenantId,
          sessionId,
          deletedAt: null,
          status: { not: 'UNSCHEDULED' },
        },
      }),
      this.rules(tenantId),
    ]);
    const groups = new Map<string, typeof papers>();
    for (const paper of papers) {
      const hour = paper.startTime.getUTCHours();
      const label = hour < 12 ? 'MORNING' : 'AFTERNOON';
      const key = `${isoDate(paper.examDate)}|${label}|${clock(paper.startTime)}|${clock(paper.endTime)}`;
      const list = groups.get(key) ?? [];
      list.push(paper);
      groups.set(key, list);
    }
    let order = 0;
    for (const [key, group] of groups) {
      const [date, label, start, end] = key.split('|');
      const sitting = await this.prisma.examDutySitting.create({
        data: {
          tenantId,
          rosterId,
          examDate: new Date(`${date}T00:00:00.000Z`),
          sessionLabel: label!,
          startTime: start!,
          endTime: end!,
          reportingTime: shiftClock(start!, -15),
          sortOrder: order,
        },
      });
      order += 1;
      const rooms = await this.prisma.examRoomAllocation.findMany({
        where: {
          tenantId,
          paperId: { in: group.map((paper) => paper.id) },
          deletedAt: null,
        },
      });
      const byClass = new Map<string, { count: number; classroomId: string }>();
      for (const room of rooms) {
        const current = byClass.get(room.classroomId) ?? {
          count: 0,
          classroomId: room.classroomId,
        };
        current.count += room.capacityUsed;
        byClass.set(room.classroomId, current);
      }
      const classrooms = await this.prisma.classroom.findMany({
        where: { id: { in: [...byClass.keys()] } },
        select: {
          id: true,
          name: true,
          code: true,
          examCapacity: true,
          capacity: true,
        },
      });
      const roomName = new Map(classrooms.map((room) => [room.id, room]));
      let hallOrder = 0;
      for (const room of byClass.values()) {
        const classroom = roomName.get(room.classroomId);
        const calculated = requiredInvigilators(
          room.count,
          rules.bands,
          rules.minimum,
          false,
          rules.specialHallExtra,
        );
        await this.prisma.examDutyHall.create({
          data: {
            tenantId,
            sittingId: sitting.id,
            classroomId: room.classroomId,
            hallLabel: classroom?.code || classroom?.name || 'Hall',
            studentCount: room.count,
            capacity: classroom?.examCapacity ?? classroom?.capacity ?? null,
            calculatedRequired: calculated,
            approvedRequired: calculated,
            sortOrder: hallOrder,
          },
        });
        hallOrder += 1;
      }
    }
  }

  private async placeStaff(
    user: JwtUser,
    rosterId: string,
    sittingId: string,
    hallId: string,
    staffProfileId: string,
    acknowledgeConflict?: boolean,
  ) {
    const existing = await this.prisma.examDutyAssignment.findFirst({
      where: { sittingId, staffProfileId },
      include: { hall: true },
    });
    if (existing && existing.hallId !== hallId) {
      if (!acknowledgeConflict) {
        throw new BadRequestException({
          conflict: true,
          message: `This staff member is already assigned to hall ${existing.hall.hallLabel} in the same session.`,
        });
      }
      await this.prisma.examDutyAssignment.delete({
        where: { id: existing.id },
      });
      await this.audit(user, rosterId, 'OVERRIDE', {
        staffProfileId,
        fromHall: existing.hall.hallLabel,
        toHallId: hallId,
      });
    }
    if (existing && existing.hallId === hallId) return existing;
    const away = await this.prisma.staffLeaveApplication.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId,
        status: 'APPROVED',
        fromDate: {
          lte: (await this.prisma.examDutySitting.findUnique({
            where: { id: sittingId },
          }))!.examDate,
        },
        toDate: {
          gte: (await this.prisma.examDutySitting.findUnique({
            where: { id: sittingId },
          }))!.examDate,
        },
      },
    });
    if (away && !acknowledgeConflict) {
      throw new BadRequestException({
        conflict: true,
        message: 'This staff member is on approved leave for this date.',
      });
    }
    return this.prisma.examDutyAssignment.create({
      data: { tenantId: user.tid, sittingId, hallId, staffProfileId },
    });
  }

  private async activeStaff(tenantId: string) {
    return this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, fullName: true, portalUserId: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  private async leaveByDate(tenantId: string, dates: Date[]) {
    if (!dates.length) return new Map<string, Set<string>>();
    const min = new Date(Math.min(...dates.map((date) => date.getTime())));
    const max = new Date(Math.max(...dates.map((date) => date.getTime())));
    const rows = await this.prisma.staffLeaveApplication.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        fromDate: { lte: max },
        toDate: { gte: min },
      },
      select: { staffProfileId: true, fromDate: true, toDate: true },
    });
    const map = new Map<string, Set<string>>();
    for (const date of dates) {
      const key = isoDate(date);
      const away = new Set<string>();
      for (const row of rows) {
        if (
          row.fromDate.getTime() <= date.getTime() &&
          row.toDate.getTime() >= date.getTime()
        ) {
          away.add(row.staffProfileId);
        }
      }
      map.set(key, away);
    }
    return map;
  }

  private sittingData(
    tenantId: string,
    rosterId: string,
    sitting: SittingInput,
    index: number,
  ) {
    return {
      tenantId,
      rosterId,
      examDate: new Date(`${sitting.examDate}T00:00:00.000Z`),
      sessionLabel: sitting.sessionLabel,
      customLabel: sitting.customLabel || null,
      startTime: sitting.startTime,
      endTime: sitting.endTime,
      reportingTime: sitting.reportingTime || null,
      sortOrder: index,
    };
  }

  private assertUniqueHalls(sittings: SittingInput[]) {
    for (const sitting of sittings) {
      const seen = new Set<string>();
      for (const hall of sitting.halls) {
        const key = hall.hallLabel.trim().toLowerCase();
        if (!key)
          throw new BadRequestException('Every hall needs a name or number.');
        if (seen.has(key)) {
          throw new BadRequestException(
            `Hall ${hall.hallLabel} is listed twice in the same session.`,
          );
        }
        seen.add(key);
      }
    }
  }

  private assertEditable(status: string, acknowledge?: boolean) {
    if (status === 'PUBLISHED' && !acknowledge) {
      throw new BadRequestException(
        'This roster is published. Confirm the revision before changing assignments.',
      );
    }
  }

  private async bumpAndNotify(user: JwtUser, rosterId: string) {
    await this.prisma.examDutyRoster.update({
      where: { id: rosterId },
      data: { revision: { increment: 1 } },
    });
    await this.notifyRoster(user.tid, rosterId, 'changed');
  }

  private async notifyRoster(
    tenantId: string,
    rosterId: string,
    kind: 'assigned' | 'changed',
  ) {
    const roster = await this.reload(tenantId, rosterId);
    const session = await this.prisma.examSession.findUnique({
      where: { id: roster.sessionId },
      select: { name: true },
    });
    const staffIds = [
      ...new Set(
        roster.sittings.flatMap((sitting) =>
          sitting.halls.flatMap((hall) =>
            hall.assignments.map((row) => row.staffProfileId),
          ),
        ),
      ),
    ];
    const people = await this.prisma.staffProfile.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true, portalUserId: true, email: true },
    });
    const title =
      kind === 'assigned' ? 'Exam duty assigned' : 'Exam duty changed';
    for (const person of people) {
      if (!person.portalUserId) continue;
      const body = `${session?.name ?? 'Examination'}: your invigilation duty was ${kind}. Open My Exam Duties for the date, hall and reporting time.`;
      await this.notifications.createInApp({
        tenantId,
        userId: person.portalUserId,
        type: 'EXAM_DUTY',
        title,
        body,
        link: '/(staff)/exam-duties',
        metadata: { rosterId, staffProfileId: person.id },
      });
      await this.triggers.trigger({
        tenantId,
        templateCode: 'EXAM_DUTY_ASSIGNED',
        triggerKey: `exam-duty-${kind}`,
        entityType: 'EXAM_DUTY_ASSIGNMENT',
        entityId: `${rosterId}:${person.id}:${roster.revision}`,
        skipDedupe: false,
        channels: ['EMAIL', 'IN_APP', 'PUSH'],
        recipient: {
          recipientType: 'FACULTY',
          userId: person.portalUserId,
          staffProfileId: person.id,
          displayName: person.fullName,
          email: person.email ?? undefined,
        },
        variables: {
          examName: session?.name ?? 'Examination',
          staffName: person.fullName,
        },
      });
    }
  }

  private async audit(
    user: JwtUser,
    rosterId: string,
    action: string,
    detail: unknown,
  ) {
    await this.prisma.examDutyAudit.create({
      data: {
        tenantId: user.tid,
        rosterId,
        actorId: user.sub,
        action,
        detail: detail as Prisma.InputJsonValue,
      },
    });
  }

  private async reload(tenantId: string, rosterId: string) {
    const roster = await this.prisma.examDutyRoster.findFirst({
      where: { id: rosterId, tenantId, deletedAt: null },
      include: rosterInclude,
    });
    if (!roster) throw new NotFoundException('Duty roster not found');
    return roster;
  }

  private async sessionOrThrow(tenantId: string, sessionId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
      select: { id: true, name: true, academicYearId: true },
    });
    if (!session) throw new NotFoundException('Examination not found');
    return session;
  }
}

function countDuties(
  sittings: Array<{
    halls: Array<{ assignments: Array<{ staffProfileId: string }> }>;
  }>,
  staffProfileId: string,
) {
  return sittings.reduce(
    (sum, sitting) =>
      sum +
      sitting.halls.reduce(
        (inner, hall) =>
          inner +
          hall.assignments.filter(
            (row) => row.staffProfileId === staffProfileId,
          ).length,
        0,
      ),
    0,
  );
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function clock(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function shiftClock(value: string, minutes: number) {
  const [hour, minute] = value.split(':').map(Number);
  const total = (hour ?? 0) * 60 + (minute ?? 0) + minutes;
  const normalized = (total + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function prettyClock(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function sessionTitle(label: string, custom?: string | null) {
  if (label === 'CUSTOM' && custom) return custom;
  if (label === 'MORNING') return 'Morning';
  if (label === 'AFTERNOON') return 'Afternoon';
  return custom || label;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
