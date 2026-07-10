import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { buildInstitutionalExcelReport } from '../../common/reports';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionsService } from '../admissions/admissions.service';
import { DashboardAnalyticsService } from '../dashboard-analytics/dashboard-analytics.service';
import { FeeReportsService } from '../fees/services/fee-reports.service';
import { StudentFeeSummaryService } from '../fees/services/student-fee-summary.service';
import { StudentAttendanceService } from '../student-attendance/student-attendance.service';
import { CustomReportService } from '../student-reports/services/custom-report.service';
import { StudentReportsQueryService } from '../student-reports/services/student-reports-query.service';
import { StudentsService } from '../students/students.service';
import { StudentProfileChangeRequestService } from '../students/services/student-profile-change-request.service';
import { StaffService } from '../staff/staff.service';
import { AI_PERMS, userHasAnyPermission } from './ai-permissions.util';
import { KnowledgeQueryService } from '../knowledge-base/knowledge-query.service';
import { HybridIntentResolver } from './intent/hybrid-intent.resolver';
import {
  buildReportPreviewMarkdown,
  buildFeeReportPreviewMarkdown,
  buildAttendanceReportPreviewMarkdown,
  parseStudentReportIntent,
  parseFeeReportIntent,
  parseAttendanceReportIntent,
} from './intent/report-intent.parser';
import type {
  AiActiveStudent,
  AiChatResponse,
  AiIntentFilters,
  ResolvedIntent,
} from './ai-assistant.types';

type ToolResult = Omit<AiChatResponse, 'sessionId'> & {
  _activeStudent?: AiActiveStudent | null;
  _confirmationMeta?: AiSessionStatePending;
  _pendingReportIntent?: import('./ai-assistant.types').AiPendingIntent;
};

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly dashboard: DashboardAnalyticsService,
    private readonly customReports: CustomReportService,
    private readonly reportQueries: StudentReportsQueryService,
    private readonly students: StudentsService,
    private readonly profileChanges: StudentProfileChangeRequestService,
    private readonly staff: StaffService,
    private readonly feeReports: FeeReportsService,
    private readonly feeSummaryService: StudentFeeSummaryService,
    private readonly attendance: StudentAttendanceService,
    private readonly admissions: AdmissionsService,
    private readonly intents: HybridIntentResolver,
    private readonly knowledge: KnowledgeQueryService,
  ) {}

  private maxRows() {
    const n = Number(this.config.get('AI_ASSISTANT_MAX_REPORT_ROWS') ?? 2000);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 2000;
  }

  async execute(
    user: JwtUser,
    intent: ResolvedIntent,
    sessionId: string,
  ): Promise<ToolResult> {
    switch (intent.action) {
      case 'get_institutional_kpis':
        return this.kpis(user);
      case 'fee_summary':
        return this.feeSummary(user);
      case 'attendance_summary':
        return this.attendanceSummary(user);
      case 'lookup_student':
        return this.lookupStudent(
          user,
          intent.searchQuery ?? '',
          intent.lookupFocus ?? 'profile',
        );
      case 'knowledge_query':
        return this.knowledgeQuery(
          user,
          intent.question ?? intent.searchQuery ?? '',
        );
      case 'hybrid_query':
        return this.hybridQuery(user, intent);
      case 'search_students':
        return this.searchStudents(user, intent.searchQuery ?? '');
      case 'search_staff':
        return this.searchStaff(user, intent.searchQuery ?? '');
      case 'search_applications':
        return this.searchApplications(user, intent.searchQuery ?? '');
      case 'search_subjects':
        return this.searchSubjects(user, intent.searchQuery ?? '');
      case 'search_departments':
        return this.searchDepartments(user, intent.searchQuery ?? '');
      case 'profile_completion_summary':
        return this.profileCompletionSummary(user, intent);
      case 'generate_student_report':
        return this.studentReport(user, intent);
      case 'generate_fee_report':
        return this.feeReport(user, intent);
      case 'generate_attendance_report':
        return this.attendanceReport(user, intent);
      case 'generate_chart':
        return this.chart(user, intent);
      case 'propose_action':
        return this.proposeAction(user, intent);
      case 'action_stub':
        return this.proposeAction(user, intent);
      case 'clarify':
      case 'help':
      default:
        return {
          answer:
            intent.answerHint ??
            'Ask about fees, attendance, students, staff, or generate a student report.',
          source: 'rules',
          links: intent.actionHref
            ? [
                {
                  label: intent.actionLabel ?? 'Open module',
                  href: intent.actionHref,
                },
              ]
            : undefined,
          suggestedFollowUps: [
            'What is the credit for MDC-110?',
            'Show Semester 1 course details',
            'How many credits are required for FYUP?',
            'How many students have pending fees?',
          ],
        };
    }
  }

  private async hybridQuery(
    user: JwtUser,
    intent: ResolvedIntent,
  ): Promise<ToolResult> {
    const semester = intent.filters.semester;
    if (!semester) {
      return {
        answer:
          'Please specify a semester (e.g. “Show all Semester III students with pending fees”).',
        source: 'hybrid',
      };
    }

    const kb = await this.knowledge.semesterContextBrief(user.tid, semester);
    const focus = intent.hybridErpFocus ?? 'fees';

    if (focus === 'fees') {
      this.assertPerm(user, AI_PERMS.fees, 'fee data');
    } else {
      this.assertPerm(user, AI_PERMS.reports, 'attendance data');
    }

    if (focus === 'fees') {
      const rows = await this.feeDefaultersBySemester(user.tid, semester);
      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

      const answer = [
        `Semester ${this.romanSemester(semester)} — students with pending fees`,
        '',
        'Institutional context (Knowledge Base):',
        kb.markdown,
        '',
        'Live ERP data:',
        `${rows.length} student(s) with outstanding fees totalling ${this.formatInr(totalOutstanding)}.`,
        rows.length
          ? 'See table below for roll numbers and amounts.'
          : 'No outstanding fee records for this semester.',
      ].join('\n');

      return {
        answer,
        source: 'hybrid',
        knowledgeSource: kb.source ?? undefined,
        table: rows.length
          ? {
              columns: [
                { key: 'roll', label: 'Roll No.' },
                { key: 'name', label: 'Name' },
                { key: 'programme', label: 'Programme' },
                { key: 'outstanding', label: 'Outstanding (₹)' },
              ],
              rows: rows.slice(0, 25).map((r) => ({
                roll: r.roll,
                name: r.name,
                programme: r.programme,
                outstanding: this.formatInr(r.outstanding),
              })),
              totalRows: rows.length,
            }
          : undefined,
        links: [
          { label: 'Fee defaulters', href: '/admin/fees/defaulters' },
          {
            label: 'Knowledge Base',
            href: '/admin/administration/knowledge-base',
          },
        ],
        suggestedFollowUps: [
          'What is the attendance requirement?',
          'Show Semester 3 course details',
          'How many students have pending fees?',
        ],
      };
    }

    const attRows = await this.lowAttendanceBySemester(user.tid, semester);
    const answer = [
      `Semester ${this.romanSemester(semester)} — students with low attendance`,
      '',
      'Institutional context (Knowledge Base):',
      kb.markdown,
      '',
      'Live ERP data:',
      `${attRows.length} student(s) below 75% attendance in this semester cohort.`,
    ].join('\n');

    return {
      answer,
      source: 'hybrid',
      knowledgeSource: kb.source ?? undefined,
      table: attRows.length
        ? {
            columns: [
              { key: 'roll', label: 'Roll No.' },
              { key: 'name', label: 'Name' },
              { key: 'attendance', label: 'Attendance %' },
            ],
            rows: attRows.slice(0, 25),
            totalRows: attRows.length,
          }
        : undefined,
      links: [
        { label: 'Attendance reports', href: '/admin/academics/attendance' },
        {
          label: 'Knowledge Base',
          href: '/admin/administration/knowledge-base',
        },
      ],
    };
  }

  private romanSemester(n: number) {
    const map: Record<number, string> = {
      1: 'I',
      2: 'II',
      3: 'III',
      4: 'IV',
      5: 'V',
      6: 'VI',
      7: 'VII',
      8: 'VIII',
    };
    return map[n] ?? String(n);
  }

  private async feeDefaultersBySemester(tenantId: string, semester: number) {
    const summaries = await (this.prisma as any).studentFeeSummary.findMany({
      where: { tenantId, totalOutstanding: { gt: 0 } },
      take: 2000,
    });
    if (!summaries.length) return [];

    const studentIds = summaries.map((s: { studentId: string }) => s.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        id: { in: studentIds },
        deletedAt: null,
        academicStanding: { currentSemesterSequence: semester },
      },
      include: {
        masterProfile: { select: { fullName: true } },
        programVersion: { include: { program: { select: { name: true } } } },
      },
    });
    const byId = new Map(students.map((s) => [s.id, s]));

    return summaries
      .map((sum: { studentId: string; totalOutstanding: unknown }) => {
        const s = byId.get(sum.studentId);
        if (!s) return null;
        return {
          roll: s.rollNumber ?? s.enrollmentNumber,
          name: s.masterProfile?.fullName ?? '—',
          programme: s.programVersion?.program?.name ?? '—',
          outstanding: Number(sum.totalOutstanding ?? 0),
        };
      })
      .filter(Boolean)
      .sort(
        (a: { outstanding: number }, b: { outstanding: number }) =>
          b.outstanding - a.outstanding,
      ) as Array<{
      roll: string;
      name: string;
      programme: string;
      outstanding: number;
    }>;
  }

  private async lowAttendanceBySemester(tenantId: string, semester: number) {
    const summaries = await this.prisma.studentAttendanceSummary.findMany({
      where: { tenantId, percentage: { lt: 75 } },
      take: 500,
    });
    if (!summaries.length) return [];

    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        id: { in: summaries.map((s) => s.studentId) },
        deletedAt: null,
        academicStanding: { currentSemesterSequence: semester },
      },
      include: { masterProfile: { select: { fullName: true } } },
    });
    const attMap = new Map(summaries.map((s) => [s.studentId, s.percentage]));
    return students
      .map((s) => ({
        roll: s.rollNumber ?? s.enrollmentNumber,
        name: s.masterProfile?.fullName ?? '—',
        attendance: `${Number(attMap.get(s.id) ?? 0).toFixed(1)}%`,
      }))
      .sort((a, b) => parseFloat(a.attendance) - parseFloat(b.attendance));
  }

  private async knowledgeQuery(
    user: JwtUser,
    question: string,
  ): Promise<ToolResult> {
    const answer = await this.knowledge.answer(user.tid, question);
    if (!answer) {
      return {
        answer:
          'I could not find that in the institutional Knowledge Base yet. Upload curriculum or policy documents (e.g. NEHU Curriculum Framework) under Knowledge Base, or ask about live ERP data such as students and fees.',
        source: 'knowledge',
        suggestedFollowUps: [
          'What is the credit for MDC-110?',
          'Show Semester 1 course details',
          'How many credits are required for FYUP?',
          'Which MDC courses are available in Semester 1?',
        ],
      };
    }

    const sourceLine = [
      answer.source.documentTitle,
      answer.source.section,
      answer.source.pageRef ? `p. ${answer.source.pageRef}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      answer: answer.markdown.includes('Source:')
        ? answer.markdown
        : `${answer.markdown}\n\nSource: ${sourceLine}`,
      source: 'knowledge',
      table: answer.table,
      knowledgeSource: answer.source,
      suggestedFollowUps: [
        'Show Semester 1 course details',
        'Explain Semester 1',
        'Which MDC courses are available in Semester 1?',
        'How many credits are required for FYUP?',
        'Compare Semester 1 and Semester 2',
      ],
    };
  }

  clarificationResponse(
    intent: ResolvedIntent,
  ): Omit<AiChatResponse, 'sessionId'> {
    if (intent.needsClarification?.includes('fields')) {
      return {
        answer:
          'Which fields would you like in the report? Select columns below, or reply with field names (e.g. Roll Number, Student Name, Mobile).',
        source: 'rules',
        fieldOptions: this.intents.reportFieldOptions(intent.columns),
        suggestedFollowUps: [
          'Roll Number, Student Name, Gender, Mobile Number',
          'Use default columns and Excel',
        ],
      };
    }
    if (intent.needsClarification?.includes('query')) {
      const prompts: Record<string, string> = {
        search_staff:
          'Who should I search for? Reply with a staff name, employee code, or mobile.',
        search_applications:
          'Reply with an applicant name, application number, or email.',
        search_subjects: 'Reply with a subject or course code/title.',
        search_departments: 'Reply with a department name or code.',
      };
      return {
        answer:
          prompts[intent.action] ??
          'Who should I search for? Reply with a student name, roll number, or mobile.',
        source: 'rules',
      };
    }
    return {
      answer: 'Please provide a bit more detail so I can continue.',
      source: 'rules',
    };
  }

  private assertPerm(user: JwtUser, perms: readonly string[], label: string) {
    if (!userHasAnyPermission(user, [...perms])) {
      throw new ForbiddenException(
        `You do not have permission to access ${label} via OneCampus AI.`,
      );
    }
  }

  private async kpis(user: JwtUser) {
    this.assertPerm(user, AI_PERMS.dashboard, 'institutional KPIs');
    const ops = await this.dashboard.getOperationsCenter(user.tid, {}, user);
    const adm = ops.admissions;
    const answer = [
      `${ops.institution.studentCount.toLocaleString('en-IN')} active students and ${ops.institution.staffCount} staff on record.`,
      `Academic year ${ops.institution.academicYear}, semester ${ops.institution.semester}.`,
      adm
        ? `Admissions: ${adm.pendingReview} pending review, ${adm.received} received, ${adm.approved} approved, ${adm.seatsRemaining} seats remaining.`
        : 'No active admission season metrics.',
      `Fees outstanding: ${this.formatInr(ops.finance.pendingDues)} (${ops.finance.defaulters} students). Today’s collection: ${this.formatInr(ops.finance.todayCollection)}.`,
      `Today’s student attendance: ${ops.academic.studentAttendancePct}%.`,
    ].join(' ');

    return {
      answer,
      links: [
        { label: 'Dashboard', href: '/admin' },
        { label: 'Students', href: '/admin/students' },
        { label: 'Fee defaulters', href: '/admin/fees/defaulters' },
      ],
      source: 'live' as const,
      suggestedFollowUps: [
        'How many students have pending fees?',
        "Show today's attendance summary",
      ],
    };
  }

  private async feeSummary(user: JwtUser) {
    this.assertPerm(user, AI_PERMS.fees, 'fee data');
    const ops = await this.dashboard.getOperationsCenter(user.tid, {}, user);
    return {
      answer: `${ops.finance.defaulters} students have outstanding fees totalling ${this.formatInr(ops.finance.pendingDues)}. ${ops.finance.monthlyTuitionPending} students have unpaid monthly tuition. Today’s collection is ${this.formatInr(ops.finance.todayCollection)}; this month ${this.formatInr(ops.finance.monthCollection)}. Collection rate is ${ops.finance.collectionRate}%.`,
      links: [
        { label: 'Defaulters list', href: '/admin/fees/defaulters' },
        { label: 'Collect fees', href: '/admin/fees/collections' },
        { label: 'Financial reports', href: '/admin/fees/reports' },
      ],
      source: 'live' as const,
      suggestedFollowUps: [
        "Show today's attendance summary",
        'Generate student report',
      ],
    };
  }

  private async attendanceSummary(user: JwtUser) {
    this.assertPerm(user, AI_PERMS.attendance, 'attendance data');
    const ops = await this.dashboard.getOperationsCenter(user.tid, {}, user);
    const live = ops.academic.dataSource === 'live';
    return {
      answer: live
        ? `Today’s student attendance is ${ops.academic.studentAttendancePct}% (${ops.academic.studentsPresent} present, ${ops.academic.studentsAbsent} absent). Faculty attendance is ${ops.academic.facultyAttendancePct}%. ${ops.academic.classesCompleted} of ${ops.academic.classesScheduled} classes have been marked.`
        : `Attendance sessions have not been fully marked today. ${ops.academic.classesScheduled} classes are scheduled; open Attendance to mark sessions.`,
      links: [
        { label: 'Attendance module', href: '/admin/academics/attendance' },
      ],
      source: live ? ('live' as const) : ('estimated' as const),
      suggestedFollowUps: ['How many students have pending fees?'],
    };
  }

  private async lookupStudent(
    user: JwtUser,
    identifier: string,
    focus: import('./ai-assistant.types').AiLookupFocus,
  ) {
    this.assertPerm(user, AI_PERMS.students, 'student lookup');
    const id = identifier.trim().toUpperCase();
    const result = await this.students.list(user, {
      search: id,
      page: 1,
      limit: 10,
    } as never);
    const list = (result?.data ?? []) as Array<Record<string, unknown>>;
    const norm = (v: unknown) =>
      String(v ?? '')
        .replace(/\s+/g, '')
        .toUpperCase();
    const student =
      list.find((s) => {
        const candidates = [
          s.rollNumber,
          s.enrollmentNumber,
          s.admissionNumber,
          s.applicationNumber,
          s.universityRollNumber,
        ];
        return candidates.some(
          (c) => norm(c) === id || norm(c) === id.replace(/-/g, ''),
        );
      }) ?? list[0];

    if (!student) {
      return {
        answer: `No student found with Admission/Roll No. ${id}. Check the number and try again.`,
        source: 'live' as const,
        links: [{ label: 'Students directory', href: '/admin/students' }],
        suggestedFollowUps: ['Find Student', 'Generate student report'],
        _activeStudent: null,
      };
    }

    const studentId = String(student.id);
    const name = String(student.fullName ?? student.displayFullName ?? '—');
    const enrollment = String(student.enrollmentNumber ?? '—');
    const roll = String(
      student.rollNumber ?? (enrollment !== '—' ? enrollment : id),
    );
    const programme = String(student.programme ?? '—');
    const semester = student.semester != null ? String(student.semester) : '—';
    const shift = String(student.shift ?? student.shiftCode ?? '—');
    const mobile = String(student.mobileNumber ?? '—');
    const profileHref = `/admin/students/${studentId}`;
    const active: AiActiveStudent = {
      id: studentId,
      rollNumber: roll,
      enrollmentNumber: enrollment !== '—' ? enrollment : undefined,
      name,
    };
    const remember = (
      result: Omit<AiChatResponse, 'sessionId'>,
    ): ToolResult => ({
      ...result,
      _activeStudent: active,
    });

    const profileBlock = [
      'Student found',
      '',
      `Name: ${name}`,
      `Roll No.: ${roll}`,
      `Registration No.: ${enrollment}`,
      `Programme: ${programme}`,
      `Semester: ${semester}`,
      `Shift: ${shift}`,
      `Mobile: ${mobile}`,
    ].join('\n');

    if (focus === 'shift') {
      return remember({
        answer: `${name} (${roll}) belongs to ${shift}.`,
        source: 'live',
        links: [{ label: 'Open profile', href: profileHref }],
        table: {
          columns: [
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
          ],
          rows: [
            { field: 'Name', value: name },
            { field: 'Roll No.', value: roll },
            { field: 'Programme', value: programme },
            { field: 'Semester', value: semester },
            { field: 'Shift', value: shift },
          ],
        },
        suggestedFollowUps: [
          'How much fee is pending?',
          'What about attendance?',
          'Show profile',
        ],
      });
    }

    if (focus === 'programme') {
      return remember({
        answer: `${name} (${roll}) is studying ${programme}.`,
        source: 'live',
        links: [{ label: 'Open profile', href: profileHref }],
        suggestedFollowUps: ['Which shift?', 'How much fee is pending?'],
      });
    }

    if (focus === 'semester') {
      return remember({
        answer: `${name} (${roll}) is currently in Semester ${semester}.`,
        source: 'live',
        links: [{ label: 'Open profile', href: profileHref }],
        suggestedFollowUps: ['Which shift?', 'Show profile'],
      });
    }

    if (focus === 'fee') {
      this.assertPerm(user, AI_PERMS.fees, 'fee data');
      try {
        const fee = await this.feeSummaryService.get(user.tid, studentId);
        const outstanding = Number(fee.totalOutstanding ?? 0);
        const status = String(fee.feeStatus ?? '—');
        return remember({
          answer: [
            `Fee status — ${name} (${roll})`,
            '',
            `Status: ${status}`,
            `Outstanding: ₹${outstanding.toLocaleString('en-IN')}`,
          ].join('\n'),
          source: 'live',
          links: [
            { label: 'Open fee account', href: `/admin/fees/collections` },
            { label: 'Open profile', href: profileHref },
          ],
          suggestedFollowUps: ['Which shift?', 'Attendance?'],
        });
      } catch {
        return remember({
          answer: `Found ${name} (${roll}), but fee summary is not available right now.`,
          source: 'live',
          links: [{ label: 'Open profile', href: profileHref }],
        });
      }
    }

    if (focus === 'attendance') {
      this.assertPerm(user, AI_PERMS.attendance, 'attendance data');
      try {
        const subjects = (await this.attendance.summaries(user.tid, {
          studentId,
        } as never)) as Array<Record<string, unknown>>;
        if (!subjects.length) {
          return remember({
            answer: `${name} (${roll}) — no attendance summary recorded yet.`,
            source: 'live',
            links: [{ label: 'Open profile', href: profileHref }],
          });
        }
        const percentages = subjects.map((s) => Number(s.percentage ?? 0));
        const overall =
          percentages.reduce((a, b) => a + b, 0) / percentages.length;
        return remember({
          answer: [
            `Attendance — ${name} (${roll})`,
            '',
            `Overall: ${overall.toFixed(1)}%`,
            `Subjects tracked: ${subjects.length}`,
          ].join('\n'),
          source: 'live',
          table: {
            columns: [
              { key: 'course', label: 'Course' },
              { key: 'percentage', label: '%' },
            ],
            rows: subjects.slice(0, 8).map((s) => ({
              course: String(s.courseId ?? s.courseCode ?? '—'),
              percentage: Number(s.percentage ?? 0),
            })),
            totalRows: subjects.length,
          },
          links: [{ label: 'Open profile', href: profileHref }],
          suggestedFollowUps: ['How much fee is pending?', 'Which shift?'],
        });
      } catch {
        return remember({
          answer: `Found ${name} (${roll}), but attendance data is not available right now.`,
          source: 'live',
          links: [{ label: 'Open profile', href: profileHref }],
        });
      }
    }

    // profile / who / default
    return remember({
      answer: profileBlock,
      source: 'live',
      links: [{ label: 'Open full profile', href: profileHref }],
      table: {
        columns: [
          { key: 'field', label: 'Field' },
          { key: 'value', label: 'Value' },
        ],
        rows: [
          { field: 'Name', value: name },
          { field: 'Roll No.', value: roll },
          { field: 'Registration No.', value: enrollment },
          { field: 'Programme', value: programme },
          { field: 'Semester', value: semester },
          { field: 'Shift', value: shift },
          { field: 'Mobile', value: mobile },
        ],
      },
      suggestedFollowUps: [
        'How much fee is pending?',
        'Attendance?',
        'Which shift?',
      ],
    });
  }

  private async searchStudents(user: JwtUser, query: string) {
    this.assertPerm(user, AI_PERMS.students, 'student search');
    const result = await this.students.list(user, {
      search: query,
      page: 1,
      limit: 10,
    } as never);
    const list = (result?.data ?? []) as Array<Record<string, unknown>>;
    if (!list.length) {
      return {
        answer: `No students matched “${query}”.`,
        source: 'live' as const,
        links: [{ label: 'Students directory', href: '/admin/students' }],
      };
    }
    const tableRows = list.map((s) => ({
      rollNumber: s.rollNumber ?? s.enrollmentNumber ?? '—',
      fullName:
        s.fullName ??
        [s.firstName, s.lastName].filter(Boolean).join(' ') ??
        '—',
      programme: s.programme ?? s.programName ?? '—',
      mobile: s.mobileNumber ?? s.mobile ?? '—',
      id: s.id,
    }));
    const lines = tableRows
      .slice(0, 5)
      .map(
        (r) =>
          `• ${r.fullName} (${r.rollNumber}) — ${r.programme}${r.mobile !== '—' ? ` · ${r.mobile}` : ''}`,
      )
      .join('\n');
    return {
      answer: `Found ${list.length} student(s) for “${query}”:\n${lines}`,
      source: 'live' as const,
      links: tableRows.slice(0, 3).map((r) => ({
        label: String(r.fullName),
        href: `/admin/students/${r.id}`,
      })),
      table: {
        columns: [
          { key: 'rollNumber', label: 'Roll No.' },
          { key: 'fullName', label: 'Name' },
          { key: 'programme', label: 'Programme' },
          { key: 'mobile', label: 'Mobile' },
        ],
        rows: tableRows,
        totalRows: list.length,
      },
      suggestedFollowUps: [
        'Generate student report',
        'How many students have pending fees?',
      ],
    };
  }

  private async searchStaff(user: JwtUser, query: string) {
    this.assertPerm(user, AI_PERMS.staff, 'staff search');
    const result = await this.staff.listDirectory(user, {
      search: query,
      page: 1,
      limit: 10,
    } as never);
    const list = (result?.data ?? []) as Array<Record<string, unknown>>;
    if (!list.length) {
      return {
        answer: `No staff matched “${query}”.`,
        source: 'live' as const,
        links: [{ label: 'Staff directory', href: '/admin/hr' }],
      };
    }
    const tableRows = list.map((s) => ({
      employeeCode: s.employeeCode ?? '—',
      fullName: s.fullName ?? '—',
      mobile: s.mobile ?? '—',
      id: s.id,
    }));
    const lines = tableRows
      .slice(0, 5)
      .map((r) => `• ${r.fullName} (${r.employeeCode})`)
      .join('\n');
    return {
      answer: `Found ${list.length} staff member(s) for “${query}”:\n${lines}`,
      source: 'live' as const,
      links: [{ label: 'HR & staff', href: '/admin/hr' }],
      table: {
        columns: [
          { key: 'employeeCode', label: 'Code' },
          { key: 'fullName', label: 'Name' },
          { key: 'mobile', label: 'Mobile' },
        ],
        rows: tableRows,
        totalRows: list.length,
      },
    };
  }

  private async studentReport(user: JwtUser, intent: ResolvedIntent) {
    this.assertPerm(user, AI_PERMS.reports, 'student reports');
    const columns = intent.columns?.length
      ? intent.columns
      : this.intents.defaultReportColumns();
    const format = intent.format === 'csv' ? 'csv' : 'xlsx';

    const built = await this.buildReportFilters(user.tid, intent.filters, user);
    if (built.errors.length) {
      return {
        answer: [
          'I could not apply one or more filters from your request:',
          '',
          ...built.errors.map((e) => `• ${e}`),
          '',
          'Please clarify the programme, major, semester, or other filters and try again.',
        ].join('\n'),
        source: 'rules' as const,
        suggestedFollowUps: [
          'Prepare Student report of Philosophy Major with Name, NEHU Roll Number, Gender, College Roll Number, Mobile Number fields',
          'Generate student report',
        ],
      };
    }

    const resolved = await this.resolveReportFiltersWithFallback(
      user.tid,
      intent.filters,
      built.dto,
      user,
    );
    const filters = resolved.dto;
    const rowCount = resolved.rowCount;

    if (!intent.reportConfirmed) {
      const spec = parseStudentReportIntent(intent.question ?? '') ?? {
        reportType: 'student_report' as const,
        filters: intent.filters,
        columns: intent.columns ?? [],
        format,
        filterLabels: resolved.appliedFilterLabels,
        columnLabels: columns.map(
          (key) =>
            this.intents.reportFieldOptions(columns).find((f) => f.key === key)
              ?.label ?? key,
        ),
      };

      const previewSpec = {
        ...spec,
        columns: intent.columns?.length ? intent.columns : spec.columns,
        columnLabels: columns.map(
          (key) =>
            this.intents.reportFieldOptions(columns).find((f) => f.key === key)
              ?.label ?? key,
        ),
        filterLabels: resolved.appliedFilterLabels,
      };

      const previewAnswer = [
        buildReportPreviewMarkdown(previewSpec, rowCount),
        resolved.filterNote ? `\n\n${resolved.filterNote}` : '',
      ].join('');

      return {
        answer: previewAnswer,
        source: 'live' as const,
        ...(rowCount > 0
          ? {
              confirmation: {
                confirmationId: 'report-generate',
                summary: `${rowCount} student(s) match these filters. Generate the Excel file?`,
                actionLabel: 'Generate report',
                reportGenerate: true,
              },
              suggestedFollowUps: ['Yes, generate report'],
            }
          : {}),
        links: [{ label: 'Student reports', href: '/admin/reports/students' }],
        ...(rowCount > 0
          ? {
              _pendingReportIntent: {
                action: 'generate_student_report' as const,
                filters: intent.filters,
                columns,
                format: format as 'xlsx' | 'csv',
                awaitingReportConfirm: true,
              },
            }
          : {}),
      };
    }

    if (rowCount === 0) {
      return {
        answer:
          resolved.filterNote ??
          'No students match the selected filters. Adjust your request and try again.',
        source: 'live' as const,
        suggestedFollowUps: ['Generate student report'],
      };
    }

    const exportResult = await this.customReports.exportCustom(
      user.tid,
      {
        columns,
        format,
        name: this.reportTitle(intent.filters),
        ...filters,
      },
      user,
    );

    const totalRows = Number(
      (exportResult.meta as { total?: number; rows?: unknown[] })?.total ??
        (exportResult.meta as { rows?: unknown[] })?.rows?.length ??
        rowCount,
    );
    const buffer = exportResult.buffer;
    const truncated = totalRows > this.maxRows();

    return {
      answer: `Generated ${format.toUpperCase()} report “${exportResult.filename}” with ${totalRows} student row(s)${truncated ? ' (row cap applied)' : ''}. Download below.`,
      source: 'live' as const,
      downloads: [
        {
          label: `Download ${format.toUpperCase()}`,
          filename: exportResult.filename,
          contentType: exportResult.contentType,
          base64: buffer.toString('base64'),
        },
      ],
      links: [{ label: 'Student reports', href: '/admin/reports/students' }],
      suggestedFollowUps: [
        'How many students have pending fees?',
        'Find student',
      ],
    };
  }

  private describeFilterLabels(filters: AiIntentFilters): string[] {
    const lines: string[] = [];
    if (filters.majorSubjectName)
      lines.push(`Major: ${filters.majorSubjectName}`);
    if (filters.minorSubjectName)
      lines.push(`Minor: ${filters.minorSubjectName}`);
    if (filters.programmeName)
      lines.push(`Programme: ${filters.programmeName}`);
    if (filters.programmeFamily) {
      lines.push(
        `Programme family: ${filters.programmeFamily === 'BCOM' ? 'Commerce' : filters.programmeFamily === 'BSC' ? 'Science' : 'Arts'}`,
      );
    }
    if (filters.departmentName)
      lines.push(`Department: ${filters.departmentName}`);
    if (filters.shiftName) lines.push(`Shift: ${filters.shiftName}`);
    if (filters.semester) lines.push(`Semester: ${filters.semester}`);
    if (filters.gender) lines.push(`Gender: ${filters.gender}`);
    if (filters.feeStatus) lines.push('Fee status: Outstanding');
    return lines;
  }

  private reportTitle(filters: AiIntentFilters) {
    const parts = ['Student Report'];
    if (filters.majorSubjectName) parts.push(filters.majorSubjectName);
    if (filters.minorSubjectName)
      parts.push(`Minor ${filters.minorSubjectName}`);
    if (filters.programmeName) parts.push(filters.programmeName);
    if (filters.programmeFamily) parts.push(filters.programmeFamily);
    if (filters.semester) parts.push(`Sem ${filters.semester}`);
    if (filters.gender === 'FEMALE') parts.push('Girls');
    if (filters.gender === 'MALE') parts.push('Boys');
    if (filters.shiftName) parts.push(filters.shiftName);
    return parts.join(' — ');
  }

  private async buildReportFilters(
    tenantId: string,
    filters: AiIntentFilters,
    user?: JwtUser,
  ): Promise<{
    dto: Record<string, unknown>;
    errors: string[];
  }> {
    const dto: Record<string, unknown> = {};
    const errors: string[] = [];

    if (filters.semester) dto.semester = filters.semester;
    if (filters.gender) dto.gender = filters.gender;
    if (filters.feeStatus) dto.feeStatus = filters.feeStatus;

    if (filters.majorSubjectName) {
      const major = await this.resolveAcademicSubject(
        tenantId,
        filters.majorSubjectName,
      );
      if (major.id) {
        dto.majorSubjectId = major.id;
      } else if (major.ambiguous?.length) {
        errors.push(
          `Multiple majors match “${filters.majorSubjectName}”: ${major.ambiguous.join(', ')}. Please specify which one.`,
        );
      } else {
        errors.push(
          `No major subject found for “${filters.majorSubjectName}”. Check the subject name in Academic Subjects.`,
        );
      }
    }

    if (filters.minorSubjectName) {
      const minor = await this.resolveAcademicSubject(
        tenantId,
        filters.minorSubjectName,
      );
      if (minor.id) {
        dto.minorSubjectId = minor.id;
      } else if (minor.ambiguous?.length) {
        errors.push(
          `Multiple minors match “${filters.minorSubjectName}”: ${minor.ambiguous.join(', ')}.`,
        );
      } else {
        errors.push(
          `No minor subject found for “${filters.minorSubjectName}”.`,
        );
      }
    }

    if (filters.departmentName) {
      const dept = await this.prisma.department.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          name: { contains: filters.departmentName, mode: 'insensitive' },
        },
        select: { id: true, name: true },
      });
      if (dept) {
        dto.departmentId = dept.id;
      } else {
        errors.push(`No department found for “${filters.departmentName}”.`);
      }
    }

    if (filters.shiftName) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { name: { contains: filters.shiftName, mode: 'insensitive' } },
            { code: { contains: filters.shiftName, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (shift) {
        dto.shiftId = shift.id;
      } else {
        errors.push(`No shift found for “${filters.shiftName}”.`);
      }
    }

    if (filters.programmeName) {
      const program = await this.prisma.program.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          name: { contains: filters.programmeName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (program) {
        const version = await this.prisma.programVersion.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            programId: program.id,
            status: 'PUBLISHED',
          },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        if (version) dto.programVersionId = version.id;
      }
    }

    if (filters.programmeCode || filters.programmeFamily) {
      const versions = await this.prisma.programVersion.findMany({
        where: {
          tenantId,
          deletedAt: null,
          program: {
            deletedAt: null,
            ...(filters.programmeCode
              ? { code: { equals: filters.programmeCode, mode: 'insensitive' } }
              : filters.programmeFamily === 'BCOM'
                ? {
                    OR: [
                      { code: { startsWith: 'BCOM', mode: 'insensitive' } },
                      { code: { equals: 'B.COM', mode: 'insensitive' } },
                    ],
                  }
                : filters.programmeFamily === 'BSC'
                  ? { code: { startsWith: 'BSC-', mode: 'insensitive' } }
                  : { code: { startsWith: 'BA-', mode: 'insensitive' } }),
          },
        },
        select: { id: true },
        take: 50,
      });
      if (versions.length === 1) {
        dto.programVersionId = versions[0].id;
      } else if (versions.length > 1) {
        const students = await this.prisma.student.findMany({
          where: {
            tenantId,
            deletedAt: null,
            programVersionId: { in: versions.map((v) => v.id) },
          },
          select: { id: true },
          take: this.maxRows(),
        });
        dto.studentIds = students.map((s) => s.id);
      }
    }

    if (
      filters.missingAadhaar ||
      filters.missingPhoto ||
      filters.missingMobile ||
      filters.missingAbcId
    ) {
      const profileAnd: object[] = [];
      if (filters.missingAadhaar) {
        profileAnd.push({ OR: [{ nationalId: null }, { nationalId: '' }] });
      }
      if (filters.missingMobile) {
        profileAnd.push({ OR: [{ mobileNumber: null }, { mobileNumber: '' }] });
      }
      if (filters.missingPhoto) {
        profileAnd.push({ OR: [{ photoPath: null }, { photoPath: '' }] });
      }

      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(profileAnd.length ? { masterProfile: { AND: profileAnd } } : {}),
          ...(filters.missingAbcId
            ? {
                OR: [
                  { abcAccount: null },
                  { abcAccount: { is: { abcId: null } } },
                ],
              }
            : {}),
        },
        select: { id: true },
        take: this.maxRows(),
      });
      const ids = students.map((s) => s.id);

      if (dto.studentIds) {
        const set = new Set(ids);
        dto.studentIds = (dto.studentIds as string[]).filter((id) =>
          set.has(id),
        );
      } else {
        dto.studentIds = ids;
      }
    }

    return { dto, errors };
  }

  /**
   * Major/minor track is the canonical filter, but imported students may only have
   * programme or department set. Fall back when track filter returns zero rows.
   */
  private async resolveReportFiltersWithFallback(
    tenantId: string,
    intentFilters: AiIntentFilters,
    dto: Record<string, unknown>,
    user?: JwtUser,
  ): Promise<{
    dto: Record<string, unknown>;
    rowCount: number;
    appliedFilterLabels: string[];
    filterNote?: string;
  }> {
    let resolved = { ...dto };
    let where = this.reportQueries.buildWhere(
      tenantId,
      resolved as never,
      user,
    );
    let rowCount = await this.reportQueries.countStudents(where);
    let appliedFilterLabels = this.describeFilterLabels(intentFilters);

    const majorName = intentFilters.majorSubjectName;
    if (rowCount === 0 && majorName && resolved.majorSubjectId) {
      const programmeName = `FYUP in ${majorName}`;
      const program = await this.prisma.program.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          name: { contains: programmeName, mode: 'insensitive' },
        },
        select: { id: true, name: true },
      });
      if (program) {
        const version = await this.prisma.programVersion.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            programId: program.id,
            status: 'PUBLISHED',
          },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        if (version) {
          const programmeDto = { ...resolved };
          delete programmeDto.majorSubjectId;
          programmeDto.programVersionId = version.id;
          const programmeWhere = this.reportQueries.buildWhere(
            tenantId,
            programmeDto as never,
            user,
          );
          const programmeCount =
            await this.reportQueries.countStudents(programmeWhere);
          if (programmeCount > 0) {
            resolved = programmeDto;
            rowCount = programmeCount;
            appliedFilterLabels = [`Programme: ${program.name}`];
            return {
              dto: resolved,
              rowCount,
              appliedFilterLabels,
              filterNote: `No students have Major/Minor track assigned for “${majorName}”. Matched ${programmeCount} student(s) on programme “${program.name}” instead.`,
            };
          }
        }
      }

      const dept = await this.prisma.department.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          name: { contains: majorName, mode: 'insensitive' },
        },
        select: { id: true, name: true },
      });
      if (dept) {
        const deptDto = { ...resolved };
        delete deptDto.majorSubjectId;
        deptDto.departmentId = dept.id;
        const deptWhere = this.reportQueries.buildWhere(
          tenantId,
          deptDto as never,
          user,
        );
        const deptCount = await this.reportQueries.countStudents(deptWhere);
        if (deptCount > 0) {
          resolved = deptDto;
          rowCount = deptCount;
          appliedFilterLabels = [`Department: ${dept.name}`];
          return {
            dto: resolved,
            rowCount,
            appliedFilterLabels,
            filterNote: `No students have Major/Minor track assigned for “${majorName}”. Matched ${deptCount} student(s) in department “${dept.name}” instead.`,
          };
        }
      }

      const trackTotal = await this.prisma.studentMajorMinorTrack.count({
        where: { tenantId },
      });
      return {
        dto: resolved,
        rowCount: 0,
        appliedFilterLabels,
        filterNote: [
          `“${majorName}” is a valid academic subject, but **0 of 865 students** have a Major/Minor track record${trackTotal === 0 ? ' (this table is empty for all imported students)' : ''}.`,
          'Philosophy students may be stored under programme **FYUP in Philosophy** or department **Philosophy** — the assistant will use those automatically when track data exists.',
          'To fix permanently, backfill `student_major_minor_tracks` during import or from student profiles.',
        ].join('\n'),
      };
    }

    return { dto: resolved, rowCount, appliedFilterLabels };
  }

  private async resolveAcademicSubject(tenantId: string, name: string) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const slugCompact = name.toLowerCase().replace(/\s+/g, '');
    const matches = await this.prisma.academicSubject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
          { slug: { equals: slugCompact, mode: 'insensitive' } },
          { name: { contains: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
      take: 10,
      orderBy: { name: 'asc' },
    });
    if (!matches.length) return { notFound: true as const };
    const exact = matches.filter(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (exact.length === 1) return { id: exact[0].id };
    if (matches.length === 1) return { id: matches[0].id };
    return { ambiguous: matches.map((m) => m.name) };
  }

  private async feeReport(user: JwtUser, intent: ResolvedIntent) {
    this.assertPerm(user, AI_PERMS.fees, 'fee reports');
    const type = intent.feeReportType ?? 'outstanding';
    const format = intent.format === 'csv' ? 'csv' : 'xlsx';
    const query = await this.buildFeeReportQuery(user.tid, intent.filters);
    const rowCount = await this.countFeeReportRows(
      user.tid,
      type,
      query,
      intent.filters,
    );

    if (!intent.reportConfirmed) {
      const spec = parseFeeReportIntent(intent.question ?? '') ?? {
        reportType: 'fee_report' as const,
        feeReportType: type,
        filters: intent.filters,
        format,
        filterLabels: this.describeFilterLabels(intent.filters),
        reportTitle: type,
      };

      return this.reportPreviewResult({
        answer: buildFeeReportPreviewMarkdown(spec, rowCount),
        rowCount,
        format,
        pendingIntent: {
          action: 'generate_fee_report',
          filters: intent.filters,
          format: format as 'xlsx' | 'csv',
          feeReportType: type,
          awaitingReportConfirm: true,
        },
        links: [{ label: 'Financial reports', href: '/admin/fees/reports' }],
      });
    }

    if (rowCount === 0) {
      return {
        answer: 'No fee records match the selected filters.',
        source: 'live' as const,
        links: [{ label: 'Financial reports', href: '/admin/fees/reports' }],
      };
    }

    const exported = await this.feeReports.exportReport(user.tid, type, {
      ...query,
      format,
    } as never);

    if (format === 'csv' && 'content' in exported) {
      const content = String(exported.content ?? '');
      return {
        answer: `Generated ${format.toUpperCase()} fee report “${type}” with ${rowCount} row(s). Download below.`,
        source: 'live' as const,
        downloads: [
          {
            label: 'Download CSV',
            filename: exported.filename ?? `${type}.csv`,
            contentType: 'text/csv',
            base64: Buffer.from(content, 'utf8').toString('base64'),
          },
        ],
        links: [{ label: 'Financial reports', href: '/admin/fees/reports' }],
      };
    }

    const buffer = (exported as { buffer?: Buffer }).buffer;
    if (!buffer) {
      return {
        answer: `Fee report “${type}” generated. Open Financial Reports for full exports.`,
        source: 'live' as const,
        links: [{ label: 'Financial reports', href: '/admin/fees/reports' }],
      };
    }
    return {
      answer: `Generated ${format.toUpperCase()} fee report “${type}” with ${rowCount} row(s). Download below.`,
      source: 'live' as const,
      downloads: [
        {
          label: `Download ${format.toUpperCase()}`,
          filename:
            (exported as { filename?: string }).filename ?? `${type}.xlsx`,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64: buffer.toString('base64'),
        },
      ],
      links: [{ label: 'Financial reports', href: '/admin/fees/reports' }],
    };
  }

  private async attendanceReport(user: JwtUser, intent: ResolvedIntent) {
    this.assertPerm(user, AI_PERMS.attendance, 'attendance reports');
    const type = intent.attendanceReportType ?? 'shortage';
    const format = intent.format === 'csv' ? 'csv' : 'xlsx';
    const rowCount = await this.countAttendanceReportRows(
      user.tid,
      type,
      intent.filters,
    );

    if (!intent.reportConfirmed) {
      const spec = parseAttendanceReportIntent(intent.question ?? '') ?? {
        reportType: 'attendance_report' as const,
        attendanceReportType: type,
        filters: intent.filters,
        format,
        filterLabels: this.describeFilterLabels(intent.filters),
        reportTitle: type,
      };

      return this.reportPreviewResult({
        answer: buildAttendanceReportPreviewMarkdown(spec, rowCount),
        rowCount,
        format,
        pendingIntent: {
          action: 'generate_attendance_report',
          filters: intent.filters,
          format: format as 'xlsx' | 'csv',
          attendanceReportType: type,
          awaitingReportConfirm: true,
        },
        links: [
          { label: 'Attendance module', href: '/admin/academics/attendance' },
        ],
      });
    }

    if (rowCount === 0) {
      return {
        answer: 'No attendance records match the selected filters.',
        source: 'live' as const,
        links: [
          { label: 'Attendance module', href: '/admin/academics/attendance' },
        ],
      };
    }

    const rows = (await this.attendance.reports(
      user.tid,
      type,
      {} as never,
    )) as
      | Array<Record<string, unknown>>
      | { data?: Array<Record<string, unknown>> };
    const list = Array.isArray(rows) ? rows : (rows.data ?? []);
    const filtered = await this.filterAttendanceRows(
      user.tid,
      list,
      intent.filters,
    );
    const flat = filtered.slice(0, this.maxRows()).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        studentId: r.studentId ?? r.id ?? '—',
        courseId: r.courseId ?? '—',
        percentage: r.subjectPercentage ?? r.percentage ?? '—',
        status: r.eligibilityStatus ?? r.status ?? '—',
      };
    });

    const built = await buildInstitutionalExcelReport({
      meta: {
        institutionName: 'Don Bosco College',
        reportTitle:
          type === 'shortage'
            ? 'Attendance Shortage Report'
            : 'Attendance Report',
        generatedBy: user.email ?? user.sub,
      },
      sheets: [
        {
          name: 'Attendance',
          columns: [
            { key: 'studentId', label: 'Student ID' },
            { key: 'courseId', label: 'Course' },
            { key: 'percentage', label: '%' },
            { key: 'status', label: 'Status' },
          ],
          rows: flat,
        },
      ],
      filenameBase: `attendance-${type}`,
    });

    return {
      answer: `Generated attendance ${type} report with ${flat.length} row(s). Download below.`,
      source: 'live' as const,
      downloads: [
        {
          label: 'Download Excel',
          filename: built.filename,
          contentType: built.contentType,
          base64: built.buffer.toString('base64'),
        },
      ],
      table: {
        columns: [
          { key: 'studentId', label: 'Student ID' },
          { key: 'courseId', label: 'Course' },
          { key: 'percentage', label: '%' },
          { key: 'status', label: 'Status' },
        ],
        rows: flat.slice(0, 8),
        totalRows: flat.length,
      },
      links: [
        { label: 'Attendance module', href: '/admin/academics/attendance' },
      ],
    };
  }

  private reportPreviewResult(input: {
    answer: string;
    rowCount: number;
    format: 'xlsx' | 'csv';
    pendingIntent: import('./ai-assistant.types').AiPendingIntent;
    links?: import('./ai-assistant.types').AiLink[];
  }): ToolResult {
    return {
      answer: input.answer,
      source: 'live' as const,
      ...(input.rowCount > 0
        ? {
            confirmation: {
              confirmationId: 'report-generate',
              summary: `${input.rowCount} row(s) match these filters. Generate the ${input.format.toUpperCase()} file?`,
              actionLabel: 'Generate report',
              reportGenerate: true,
            },
            suggestedFollowUps: ['Yes, generate report'],
            _pendingReportIntent: input.pendingIntent,
          }
        : {}),
      links: input.links,
    };
  }

  private async buildFeeReportQuery(
    tenantId: string,
    filters: AiIntentFilters,
  ): Promise<Record<string, unknown>> {
    const query: Record<string, unknown> = {};
    const built = await this.buildReportFilters(tenantId, filters);
    if (built.dto.programVersionId) {
      query.programVersionId = built.dto.programVersionId;
    }
    if (built.dto.shiftId) query.shiftId = built.dto.shiftId;
    return query;
  }

  private async countFeeReportRows(
    tenantId: string,
    type: string,
    query: Record<string, unknown>,
    filters: AiIntentFilters,
  ) {
    const report = await this.feeReports.report(tenantId, type, query as never);
    let rows = (report as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    rows = await this.filterRowsByStudentFilters(tenantId, rows, filters);
    return rows.length;
  }

  private async countAttendanceReportRows(
    tenantId: string,
    type: string,
    filters: AiIntentFilters,
  ) {
    const rows = (await this.attendance.reports(
      tenantId,
      type,
      {} as never,
    )) as Array<Record<string, unknown>>;
    const list = Array.isArray(rows) ? rows : [];
    const filtered = await this.filterAttendanceRows(tenantId, list, filters);
    return filtered.length;
  }

  private async filterAttendanceRows(
    tenantId: string,
    rows: Array<Record<string, unknown>>,
    filters: AiIntentFilters,
  ) {
    if (!filters.semester && !filters.shiftName && !filters.programmeName) {
      return rows;
    }
    return this.filterRowsByStudentFilters(tenantId, rows, filters);
  }

  private async filterRowsByStudentFilters(
    tenantId: string,
    rows: Array<Record<string, unknown>>,
    filters: AiIntentFilters,
  ) {
    if (!filters.semester && !filters.programmeName && !filters.shiftName) {
      return rows;
    }
    const studentIds = rows
      .map((r) => String(r.studentId ?? r.id ?? ''))
      .filter(Boolean);
    if (!studentIds.length) return rows;

    const built = await this.buildReportFilters(tenantId, filters);
    const where = this.reportQueries.buildWhere(tenantId, {
      ...(built.dto as object),
      studentIds,
    } as never);
    const matched = await this.prisma.student.findMany({
      where,
      select: { id: true },
    });
    const allowed = new Set(matched.map((s) => s.id));
    return rows.filter((r) => allowed.has(String(r.studentId ?? r.id ?? '')));
  }

  private async chart(user: JwtUser, intent: ResolvedIntent) {
    this.assertPerm(user, AI_PERMS.dashboard, 'charts');
    const widgetId = intent.chartWidgetId ?? 'department-admissions';
    const chart = await this.dashboard.getChart(user.tid, widgetId, {});
    const series = (chart.series ?? []).map((p) => ({
      label: String(p.label),
      value: Number(p.value) || 0,
    }));
    const title =
      widgetId === 'fee-collection-trend'
        ? 'Fee collection trend'
        : widgetId === 'shift-attendance'
          ? 'Attendance by shift'
          : widgetId === 'shift-enrollment'
            ? 'Enrollment by shift'
            : 'Admissions by department';

    const built = await buildInstitutionalExcelReport({
      meta: {
        institutionName: 'Don Bosco College',
        reportTitle: title,
        generatedBy: user.email ?? user.sub,
      },
      sheets: [
        {
          name: 'Chart data',
          columns: [
            { key: 'label', label: 'Label' },
            { key: 'value', label: 'Value' },
          ],
          rows: series,
        },
      ],
      filenameBase: `chart-${widgetId}`,
    });

    return {
      answer: `${title} — ${series.length} data point(s). Chart and Excel download below.`,
      source: 'live' as const,
      chart: {
        title,
        chartType: (chart.chartType === 'donut' ? 'pie' : 'bar') as
          | 'bar'
          | 'pie'
          | 'line',
        series,
      },
      downloads: [
        {
          label: 'Download Excel',
          filename: built.filename,
          contentType: built.contentType,
          base64: built.buffer.toString('base64'),
        },
      ],
      links: [{ label: 'Analytics', href: '/admin/analytics' }],
      suggestedFollowUps: [
        'Fee collection chart',
        'Attendance chart',
        'How many students have pending fees?',
      ],
    };
  }

  private async searchApplications(user: JwtUser, query: string) {
    this.assertPerm(user, AI_PERMS.admissions, 'admission applications');
    const result = await this.admissions.listApplications(user.tid, {
      search: query,
      page: 1,
      limit: 10,
    } as never);
    const list = (result?.data ?? []) as Array<Record<string, unknown>>;
    if (!list.length) {
      return {
        answer: `No applications matched “${query}”.`,
        source: 'live' as const,
        links: [{ label: 'Admissions', href: '/admin/admissions' }],
      };
    }
    const tableRows = list.map((a) => ({
      applicationNumber: a.applicationNumber ?? a.id ?? '—',
      name: [a.firstName, a.lastName].filter(Boolean).join(' ') || '—',
      status: a.status ?? '—',
      email: a.email ?? '—',
    }));
    return {
      answer: `Found ${list.length} application(s) for “${query}”.`,
      source: 'live' as const,
      table: {
        columns: [
          { key: 'applicationNumber', label: 'Application' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'email', label: 'Email' },
        ],
        rows: tableRows,
        totalRows: list.length,
      },
      links: [{ label: 'Admissions', href: '/admin/admissions' }],
    };
  }

  private async searchSubjects(user: JwtUser, query: string) {
    this.assertPerm(user, AI_PERMS.academic, 'subjects');
    const courses = await this.prisma.course.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, title: true, credits: true },
      take: 15,
      orderBy: { code: 'asc' },
    });
    if (!courses.length) {
      return {
        answer: `No subjects matched “${query}”.`,
        source: 'live' as const,
        links: [{ label: 'Programmes', href: '/admin/programs' }],
      };
    }
    const rows = courses.map((c) => ({
      code: c.code,
      title: c.title,
      credits: c.credits ?? '—',
    }));
    return {
      answer: `Found ${courses.length} subject(s) for “${query}”.`,
      source: 'live' as const,
      table: {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'title', label: 'Title' },
          { key: 'credits', label: 'Credits' },
        ],
        rows,
        totalRows: courses.length,
      },
      links: [{ label: 'Programmes', href: '/admin/programs' }],
    };
  }

  private async searchDepartments(user: JwtUser, query: string) {
    this.assertPerm(user, AI_PERMS.academic, 'departments');
    const departments = await this.prisma.department.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, name: true },
      take: 15,
      orderBy: { code: 'asc' },
    });
    if (!departments.length) {
      return {
        answer: `No departments matched “${query}”.`,
        source: 'live' as const,
        links: [{ label: 'Organization', href: '/admin/organization' }],
      };
    }
    const rows = departments.map((d) => ({ code: d.code, name: d.name }));
    return {
      answer: `Found ${departments.length} department(s) for “${query}”.`,
      source: 'live' as const,
      table: {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
        ],
        rows,
        totalRows: departments.length,
      },
    };
  }

  private async profileCompletionSummary(
    user: JwtUser,
    intent: ResolvedIntent,
  ): Promise<ToolResult> {
    this.assertPerm(user, AI_PERMS.students, 'profile completion');
    const filters = intent.filters ?? {};
    const dash = await this.profileChanges.completionDashboard(user.tid);
    let rows = dash.students;

    if (filters.incompleteProfile) {
      rows = rows.filter((r) => r.percent < 100);
    }
    if (filters.missingAadhaar) {
      rows = rows.filter((r) => r.missing.includes('Aadhaar Number'));
    }
    if (filters.missingClassXii) {
      rows = rows.filter((r) => r.missing.includes('Class XII Marks'));
    }
    if (filters.pendingProfileVerification) {
      const pending = await this.profileChanges.buildReport(
        user.tid,
        'pending-verification',
      );
      return {
        answer: `${pending.rows.length} profile update request(s) are pending office verification. Average profile completion is ${dash.overallAverage}%.`,
        source: 'live',
        table: {
          columns: [
            { key: 'fullName', label: 'Student' },
            { key: 'rollNumber', label: 'Roll' },
            { key: 'status', label: 'Status' },
            { key: 'itemCount', label: 'Fields' },
          ],
          rows: pending.rows.slice(0, 25).map((r) => ({
            fullName: r.fullName ?? '—',
            rollNumber: r.rollNumber ?? '—',
            status: r.status ?? 'PENDING',
            itemCount: r.itemCount ?? 0,
          })),
          totalRows: pending.rows.length,
        },
        links: [
          {
            label: 'Pending profile updates',
            href: '/admin/students/profile-verification/pending',
          },
          {
            label: 'Completion dashboard',
            href: '/admin/students/profile-verification/completion',
          },
        ],
        suggestedFollowUps: [
          'List incomplete profiles',
          'Students missing Class XII marks',
          'Students missing Aadhaar',
        ],
      };
    }

    const focusLabel = filters.missingClassXii
      ? 'missing Class XII marks'
      : filters.missingAadhaar
        ? 'missing Aadhaar'
        : filters.incompleteProfile
          ? 'with incomplete profiles'
          : 'tracked for profile completion';

    return {
      answer: [
        `Profile completion overview: average ${dash.overallAverage}%, ${dash.incompleteCount} incomplete of ${dash.students.length} students.`,
        `Showing ${rows.length} student(s) ${focusLabel}.`,
      ].join(' '),
      source: 'live',
      table: {
        columns: [
          { key: 'fullName', label: 'Student' },
          { key: 'rollNumber', label: 'Roll' },
          { key: 'department', label: 'Department' },
          { key: 'percent', label: '%' },
          { key: 'missing', label: 'Missing' },
        ],
        rows: rows.slice(0, 25).map((r) => ({
          fullName: r.fullName,
          rollNumber: r.rollNumber ?? '—',
          department: r.department,
          percent: r.percent,
          missing: (r.missing ?? []).slice(0, 4).join(', ') || '—',
        })),
        totalRows: rows.length,
      },
      chart: {
        title: 'Profile completion by department',
        chartType: 'bar',
        series: dash.departmentSummary.slice(0, 12).map((d) => ({
          label: d.department,
          value: d.averagePercent,
        })),
      },
      links: [
        {
          label: 'Completion dashboard',
          href: '/admin/students/profile-verification/completion',
        },
        {
          label: 'Pending verification',
          href: '/admin/students/profile-verification/pending',
        },
      ],
      suggestedFollowUps: [
        'Pending profile verification requests',
        'Students missing Class XII marks',
        'Export incomplete profiles',
      ],
    };
  }

  private proposeAction(user: JwtUser, intent: ResolvedIntent) {
    const proposed = intent.proposedAction ?? 'admin';
    const permMap: Record<string, readonly string[]> = {
      sms: AI_PERMS.communication,
      email: AI_PERMS.communication,
      promote: AI_PERMS.promotion,
      certificates: AI_PERMS.certificates,
    };
    const needed = permMap[proposed];
    if (needed && !userHasAnyPermission(user, [...needed])) {
      throw new ForbiddenException(
        `You do not have permission for “${proposed}” actions.`,
      );
    }
    const confirmationId = randomUUID();
    return {
      answer:
        intent.answerHint ??
        'This action requires your confirmation before continuing.',
      source: 'rules' as const,
      confirmation: {
        confirmationId,
        summary:
          intent.answerHint ??
          `Confirm to proceed with ${intent.actionLabel ?? proposed}.`,
        actionLabel: intent.actionLabel ?? 'Confirm & open module',
        danger: ['promote', 'sms', 'email'].includes(proposed),
      },
      links: intent.actionHref
        ? [{ label: intent.actionLabel ?? 'Open', href: intent.actionHref }]
        : undefined,
      // Stash href on confirmation via session in service layer
      suggestedFollowUps: ['How many students have pending fees?'],
      // pass through for session storage
      _confirmationMeta: {
        confirmationId,
        proposedAction: proposed,
        actionLabel: intent.actionLabel ?? 'Open module',
        actionHref: intent.actionHref ?? '/admin',
        summary: intent.answerHint ?? '',
      },
    } as Omit<AiChatResponse, 'sessionId'> & {
      _confirmationMeta?: AiSessionStatePending;
    };
  }

  private formatInr(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  }
}

type AiSessionStatePending = {
  confirmationId: string;
  proposedAction: string;
  actionLabel: string;
  actionHref: string;
  summary: string;
};
