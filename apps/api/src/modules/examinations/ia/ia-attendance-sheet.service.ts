import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { registeredSubjectPrint } from '../../academic-engine/domain/offering-paper-title';
import { IaAdmitPdfService } from './ia-admit-pdf.service';
import {
  attendanceIssues,
  groupAttendanceSheets,
  type AttendanceSheet,
  type AttendanceStudent,
} from './ia-attendance-group';

@Injectable()
export class IaAttendanceSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: IaAdmitPdfService,
  ) {}

  async preview(
    user: JwtUser,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      mode?: 'subject' | 'hall';
      paperId?: string;
      hall?: string;
    },
  ) {
    const built = await this.build(user.tid, sessionId, query);
    return {
      examName: built.examName,
      college: built.college,
      sheets: built.sheets,
      issues: built.issues,
      studentCount: built.students.length,
    };
  }

  async renderPdf(
    user: JwtUser,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      mode?: 'subject' | 'hall';
      paperId?: string;
      hall?: string;
    },
  ) {
    const built = await this.build(user.tid, sessionId, query);
    const buffer = await this.pdf.htmlToPdf(this.html(built));
    return { buffer, filename: 'examination-attendance-sheets.pdf' };
  }

  async renderXlsx(
    user: JwtUser,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      mode?: 'subject' | 'hall';
      paperId?: string;
      hall?: string;
    },
  ) {
    const built = await this.build(user.tid, sessionId, query);
    const book = new ExcelJS.Workbook();
    built.sheets.forEach((sheet, index) => {
      const tab = book.addWorksheet(safeSheetName(sheet, index));
      tab.addRow([built.college]);
      tab.addRow([built.examName]);
      tab.addRow([`${sheet.subjectCode} ${sheet.subjectName}`.trim()]);
      tab.addRow([`Hall ${sheet.hall}`, `${sheet.studentCount} students`]);
      tab.addRow([
        '#',
        'College Roll No',
        'Student Name',
        'NEHU Roll No',
        'Seat No',
        'Signature',
      ]);
      sheet.students.forEach((student, rowIndex) => {
        tab.addRow([
          rowIndex + 1,
          student.collegeRoll,
          student.name,
          student.nehuRoll,
          student.seat,
          '',
        ]);
      });
    });
    if (!built.sheets.length)
      book
        .addWorksheet('Attendance')
        .addRow(['No students matched this selection.']);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, filename: 'examination-attendance-sheets.xlsx' };
  }

  private html(built: Awaited<ReturnType<IaAttendanceSheetService['build']>>) {
    const pages = built.sheets
      .map(
        (sheet) => `<section class="sheet">
        <h1>${escapeHtml(built.college)}</h1>
        <h2>${escapeHtml(built.examName)}</h2>
        <p class="meta">${escapeHtml(sheet.subjectCode)} ${escapeHtml(sheet.subjectName)}<br>Hall: ${escapeHtml(sheet.hall)} · ${sheet.studentCount} students${built.when ? ` · ${escapeHtml(built.when)}` : ''}</p>
        <table>
          <thead><tr><th>#</th><th>College Roll No</th><th>Student Name</th><th>NEHU Roll No</th><th>Seat No</th><th>Signature</th></tr></thead>
          <tbody>${sheet.students
            .map(
              (student, index) =>
                `<tr><td>${index + 1}</td><td>${escapeHtml(student.collegeRoll)}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.nehuRoll)}</td><td>${escapeHtml(student.seat)}</td><td class="sign"></td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </section>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
      h1, h2, .meta { text-align: center; margin: 0; }
      h1 { font-size: 16px; }
      h2 { font-size: 13px; margin-top: 2px; }
      .meta { margin: 6px 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #222; padding: 4px 6px; }
      th { background: #f3f4f6; }
      td.sign { height: 28px; }
      tr, thead { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
      .sheet { break-after: page; page-break-after: always; }
      .sheet:last-child { break-after: auto; page-break-after: auto; }
    </style></head><body>${pages || '<p>No students matched this selection.</p>'}</body></html>`;
  }

  private async build(
    tenantId: string,
    sessionId: string,
    query: {
      date?: string;
      session?: string;
      mode?: 'subject' | 'hall';
      paperId?: string;
      hall?: string;
    },
  ) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        semesterNo: true,
        shiftId: true,
        metadata: true,
      },
    });
    if (!session) throw new NotFoundException('Examination not found');
    const papers = await this.prisma.examPaperSchedule.findMany({
      where: {
        tenantId,
        sessionId,
        deletedAt: null,
        status: { not: 'UNSCHEDULED' },
      },
    });
    const selected = papers.filter((paper) => {
      if (query.paperId && paper.id !== query.paperId) return false;
      if (query.date && isoDate(paper.examDate) !== query.date) return false;
      if (query.session === 'MORNING' && paper.startTime.getUTCHours() >= 12)
        return false;
      if (query.session === 'AFTERNOON' && paper.startTime.getUTCHours() < 12)
        return false;
      return true;
    });
    const semesterNos = [
      ...new Set(
        selected
          .map((paper) => paper.semesterNo)
          .filter((value): value is number => value != null),
      ),
    ];
    const lines = selected.length
      ? await this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId,
            status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
            ...(semesterNos.length
              ? { registration: { semesterSequence: { in: semesterNos } } }
              : {}),
          },
          include: {
            offering: {
              select: {
                courseId: true,
                titleOverride: true,
                course: { select: { code: true, title: true } },
              },
            },
            registration: {
              select: {
                studentId: true,
                semesterSequence: true,
                shiftId: true,
              },
            },
          },
        })
      : [];
    const studentIds = [
      ...new Set(lines.map((line) => line.registration.studentId)),
    ];
    const [students, seats, rooms, college] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          rollNumber: true,
          enrollmentNumber: true,
          universityRollNumber: true,
          primaryShiftId: true,
          user: { select: { displayName: true } },
          masterProfile: { select: { fullName: true } },
        },
      }),
      this.prisma.examSeatAllocation.findMany({
        where: {
          tenantId,
          paperId: { in: selected.map((paper) => paper.id) },
          deletedAt: null,
        },
      }),
      this.prisma.classroom.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);
    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    const roomName = new Map(
      rooms.map((room) => [room.id, room.code || room.name]),
    );
    const seatByStudentPaper = new Map(
      seats
        .filter((seat) => seat.studentId)
        .map((seat) => [`${seat.paperId}|${seat.studentId}`, seat]),
    );
    const rows: AttendanceStudent[] = [];
    for (const line of lines) {
      if (
        session.shiftId &&
        line.registration.shiftId &&
        line.registration.shiftId !== session.shiftId
      ) {
        continue;
      }
      const paper = selected.find(
        (item) =>
          (item.semesterNo == null ||
            item.semesterNo === line.registration.semesterSequence) &&
          (item.offeringId === line.offeringId ||
            item.courseId === line.offering.courseId),
      );
      if (!paper) continue;
      const student = studentById.get(line.registration.studentId);
      if (!student) continue;
      if (
        session.shiftId &&
        !line.registration.shiftId &&
        student.primaryShiftId &&
        student.primaryShiftId !== session.shiftId
      ) {
        continue;
      }
      const printed = registeredSubjectPrint(
        line.offering.course,
        line.offering,
      );
      const seat = seatByStudentPaper.get(`${paper.id}|${student.id}`);
      const hall = seat
        ? roomName.get(seat.classroomId) || 'Hall'
        : 'Unassigned';
      if (query.hall && hall !== query.hall) continue;
      rows.push({
        studentId: student.id,
        collegeRoll: student.rollNumber || student.enrollmentNumber,
        name:
          student.masterProfile?.fullName ||
          student.user?.displayName ||
          student.rollNumber ||
          'Student',
        nehuRoll: student.universityRollNumber || '',
        seat: seat?.seatNumber || '',
        subjectCode: printed.code || paper.paperCode,
        subjectName: printed.title || paper.paperName,
        hall,
        paperId: paper.id,
      });
    }
    const mode = query.mode === 'hall' ? 'hall' : 'subject';
    const sheets: AttendanceSheet[] = groupAttendanceSheets(rows, mode);
    const when = [query.date, query.session].filter(Boolean).join(' · ');
    return {
      examName: session.name,
      college: college?.name ?? 'Don Bosco College Tura',
      when,
      students: rows,
      sheets,
      issues: attendanceIssues(rows),
    };
  }
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeSheetName(sheet: AttendanceSheet, index: number) {
  const raw = `${sheet.subjectCode} ${sheet.hall}`
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim();
  return (raw || `Sheet ${index + 1}`).slice(0, 31);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
