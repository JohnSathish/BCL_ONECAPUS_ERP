import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STUDENT_REPORT_FIELDS } from '../../student-reports/domain/student-report-field-registry';
import type {
  AiActiveStudent,
  AiIntentFilters,
  AiPendingIntent,
  ResolvedIntent,
} from '../ai-assistant.types';
import { applyErpDictionary, isActiveStudentFollowUp } from './erp-dictionary';
import {
  defaultStudentReportColumns,
  parseStudentReportIntent,
  parseFeeReportIntent,
  parseAttendanceReportIntent,
} from './report-intent.parser';

const DEFAULT_REPORT_COLUMNS = [
  'rollNumber',
  'fullName',
  'gender',
  'mobileNumber',
  'programme',
  'currentSemester',
  'department',
  'shift',
];

const FIELD_ALIASES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\broll\s*(number|no\.?)?\b/i, key: 'rollNumber' },
  { pattern: /\b(student\s*)?name\b|\bfull\s*name\b/i, key: 'fullName' },
  { pattern: /\bgender\b|\bsex\b/i, key: 'gender' },
  { pattern: /\bmobile\b|\bphone\b|\bwhatsapp\b/i, key: 'mobileNumber' },
  { pattern: /\bfather/i, key: 'fatherName' },
  { pattern: /\bmother/i, key: 'motherName' },
  { pattern: /\baddress\b/i, key: 'permanentAddress' },
  { pattern: /\bcategory\b/i, key: 'category' },
  { pattern: /\baadhaar\b|\baadhar\b|\bnational\s*id\b/i, key: 'nationalId' },
  { pattern: /\bblood\s*group\b/i, key: 'bloodGroup' },
  { pattern: /\bemail\b/i, key: 'email' },
  { pattern: /\bprogramme\b|\bprogram\b/i, key: 'programme' },
  { pattern: /\bsemester\b/i, key: 'currentSemester' },
  { pattern: /\bdepartment\b/i, key: 'department' },
  { pattern: /\bshift\b/i, key: 'shift' },
];

@Injectable()
export class HybridIntentResolver {
  constructor(private readonly config: ConfigService) {}

  resolve(
    question: string,
    pending?: AiPendingIntent | null,
    activeStudent?: AiActiveStudent | null,
  ): ResolvedIntent {
    const q = applyErpDictionary(question.trim());
    const lower = q.toLowerCase();

    if (pending) {
      const continued = this.continuePending(q, lower, pending);
      if (continued) return continued;
    }

    const filters = this.extractFilters(lower);
    const columns = this.extractColumns(q);
    const format = this.extractFormat(lower);

    // ERP-first: roll / admission / enrollment identifiers (e.g. BA25-814)
    const studentIdentifier = this.extractStudentIdentifier(q);
    if (studentIdentifier && !this.isStaffContext(lower)) {
      return {
        action: 'lookup_student',
        filters,
        searchQuery: studentIdentifier,
        lookupFocus: this.studentLookupFocus(lower),
        confidence: 0.99,
      };
    }

    // Level 3 memory: follow-ups refer to the active student in session
    if (
      activeStudent?.rollNumber &&
      !this.isStaffContext(lower) &&
      isActiveStudentFollowUp(lower)
    ) {
      return {
        action: 'lookup_student',
        filters,
        searchQuery: activeStudent.rollNumber,
        lookupFocus: this.studentLookupFocus(lower),
        confidence: 0.96,
      };
    }

    // Live ERP: who opted / enrolled in a paper (must beat Knowledge Base course-code routing)
    if (this.isPaperEnrolmentQuery(q, lower)) {
      const searchQuery = this.extractPaperQuery(q);
      return {
        action: 'list_paper_students',
        filters,
        searchQuery,
        question: q,
        confidence: searchQuery ? 0.97 : 0.6,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    // Hybrid: institutional knowledge + live ERP (e.g. Sem III students with pending fees)
    const hybrid = this.resolveHybridQuery(q, lower, filters);
    if (hybrid) return hybrid;

    // Institutional Knowledge Base (curriculum, regulations) — before live ERP reports
    if (this.isKnowledgeQuery(q, lower)) {
      return {
        action: 'knowledge_query',
        filters,
        question: q,
        confidence: 0.97,
        source: 'knowledge',
      };
    }

    if (this.isActionStub(lower)) {
      return this.proposeAction(lower);
    }

    if (this.isChart(lower)) {
      return {
        action: 'generate_chart',
        filters,
        chartWidgetId: this.chartWidget(lower),
        confidence: 0.9,
      };
    }

    if (this.isFeeReport(lower)) {
      const feeSpec = parseFeeReportIntent(q);
      if (feeSpec) {
        return {
          action: 'generate_fee_report',
          filters: feeSpec.filters,
          feeReportType: feeSpec.feeReportType,
          format: feeSpec.format,
          confidence: 0.92,
          question: q,
        };
      }
      return {
        action: 'generate_fee_report',
        filters,
        feeReportType: this.feeReportType(lower),
        format: format ?? 'xlsx',
        confidence: 0.9,
        question: q,
      };
    }

    if (this.isAttendanceReport(lower)) {
      const attSpec = parseAttendanceReportIntent(q);
      if (attSpec) {
        return {
          action: 'generate_attendance_report',
          filters: attSpec.filters,
          attendanceReportType: attSpec.attendanceReportType,
          format: attSpec.format,
          confidence: 0.92,
          question: q,
        };
      }
      return {
        action: 'generate_attendance_report',
        filters,
        attendanceReportType: this.attendanceReportType(lower),
        format: format ?? 'xlsx',
        confidence: 0.9,
        question: q,
      };
    }

    if (this.isSearchApplications(lower)) {
      const searchQuery = this.extractSearchQuery(q, lower, 'application');
      return {
        action: 'search_applications',
        filters,
        searchQuery,
        confidence: searchQuery ? 0.9 : 0.55,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    if (this.isSearchSubjects(lower)) {
      const searchQuery = this.extractSearchQuery(q, lower, 'subject');
      return {
        action: 'search_subjects',
        filters,
        searchQuery,
        confidence: searchQuery ? 0.9 : 0.55,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    if (this.isSearchDepartments(lower)) {
      const searchQuery = this.extractSearchQuery(q, lower, 'department');
      return {
        action: 'search_departments',
        filters,
        searchQuery,
        confidence: searchQuery ? 0.9 : 0.55,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    if (this.isProfileCompletion(lower)) {
      const profileFilters = { ...filters };
      if (
        /incomplete\s+profile|profile\s+incomplete|incomplete\s+profiles|profile\s+completion/.test(
          lower,
        )
      ) {
        profileFilters.incompleteProfile = true;
      }
      if (
        /missing\s+class\s*xii|class\s*xii\s+missing|no\s+class\s*xii/.test(
          lower,
        )
      ) {
        profileFilters.missingClassXii = true;
        profileFilters.incompleteProfile = true;
      }
      if (
        /pending\s+(profile\s+)?verif|profile\s+update\s+pending|awaiting\s+verif/.test(
          lower,
        )
      ) {
        profileFilters.pendingProfileVerification = true;
      }
      if (/without\s+aadhaar|no\s+aadhaar|missing\s+aadhaar/.test(lower)) {
        profileFilters.missingAadhaar = true;
        profileFilters.incompleteProfile = true;
      }
      return {
        action: 'profile_completion_summary',
        filters: profileFilters,
        confidence: 0.92,
        question: q,
      };
    }

    if (this.isSearchStaff(lower)) {
      const searchQuery = this.extractSearchQuery(q, lower, 'staff');
      return {
        action: 'search_staff',
        filters,
        searchQuery,
        confidence: searchQuery ? 0.9 : 0.5,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    if (this.isSearchStudent(lower)) {
      const searchQuery = this.extractSearchQuery(q, lower, 'student');
      return {
        action: 'search_students',
        filters,
        searchQuery,
        confidence: searchQuery ? 0.9 : 0.5,
        needsClarification: searchQuery ? undefined : ['query'],
      };
    }

    const reportSpec = parseStudentReportIntent(q);
    if (reportSpec) {
      const missing: Array<'fields' | 'format'> = [];
      if (!reportSpec.columns.length) missing.push('fields');
      return {
        action: 'generate_student_report',
        filters: reportSpec.filters,
        columns: reportSpec.columns.length ? reportSpec.columns : undefined,
        format: reportSpec.format,
        confidence: 0.92,
        needsClarification: missing.length ? missing : undefined,
        question: q,
      };
    }

    if (this.isStudentReport(lower)) {
      const missing: Array<'fields' | 'format'> = [];
      if (!columns.length) missing.push('fields');
      return {
        action: 'generate_student_report',
        filters,
        columns: columns.length ? columns : undefined,
        format: format ?? 'xlsx',
        confidence: 0.85,
        needsClarification: missing.length ? missing : undefined,
        question: q,
      };
    }

    // Category chip labels (exact / near-exact)
    if (
      /fee collection summary|generate fee report|finance report|collection report/.test(
        lower,
      )
    ) {
      return { action: 'fee_summary', filters, confidence: 0.95 };
    }
    if (
      /attendance analysis|export attendance|attendance summary/.test(lower)
    ) {
      return { action: 'attendance_summary', filters, confidence: 0.95 };
    }
    if (
      /admission trends|gender distribution|how many students|institutional/.test(
        lower,
      )
    ) {
      return { action: 'get_institutional_kpis', filters, confidence: 0.9 };
    }
    if (/download admission register|admission register/.test(lower)) {
      return {
        action: 'generate_student_report',
        filters,
        columns: this.defaultReportColumns(),
        format: 'xlsx',
        confidence: 0.9,
      };
    }
    if (/^generate student report$|^student report$/.test(lower.trim())) {
      return {
        action: 'generate_student_report',
        filters,
        format: 'xlsx',
        confidence: 0.9,
        needsClarification: ['fields'],
      };
    }
    if (/^find student$|^search student$/.test(lower.trim())) {
      return {
        action: 'search_students',
        filters,
        confidence: 0.9,
        needsClarification: ['query'],
      };
    }
    if (/^search staff$|^find staff$/.test(lower.trim())) {
      return {
        action: 'search_staff',
        filters,
        confidence: 0.9,
        needsClarification: ['query'],
      };
    }
    if (/^search application$|^find application$/.test(lower.trim())) {
      return {
        action: 'search_applications',
        filters,
        confidence: 0.9,
        needsClarification: ['query'],
      };
    }
    if (/^find subject$|^search subject$/.test(lower.trim())) {
      return {
        action: 'search_subjects',
        filters,
        confidence: 0.9,
        needsClarification: ['query'],
      };
    }

    if (this.isExamFee(lower)) {
      return {
        action: 'exam_fee_query',
        filters,
        question: q,
        searchQuery: q,
        confidence: 0.93,
      };
    }

    if (this.isFee(lower)) {
      return { action: 'fee_summary', filters, confidence: 0.9 };
    }

    if (this.isAttendance(lower)) {
      return { action: 'attendance_summary', filters, confidence: 0.9 };
    }

    if (this.isKpi(lower)) {
      return { action: 'get_institutional_kpis', filters, confidence: 0.85 };
    }

    return {
      action: 'help',
      filters,
      confidence: 0.2,
      answerHint:
        'I can answer from the institutional Knowledge Base (curriculum, credits, course codes), look up live ERP data (students, fees, attendance), and generate reports. Try “What is the credit for MDC-110?” or a student roll number.',
    };
  }

  defaultReportColumns() {
    return defaultStudentReportColumns();
  }

  reportFieldOptions(selected?: string[]) {
    const pick = new Set(selected?.length ? selected : DEFAULT_REPORT_COLUMNS);
    const preferred = [
      'rollNumber',
      'fullName',
      'gender',
      'mobileNumber',
      'fatherName',
      'motherName',
      'permanentAddress',
      'category',
      'nationalId',
      'bloodGroup',
      'email',
      'programme',
      'currentSemester',
      'department',
      'shift',
    ];
    const byKey = new Map(STUDENT_REPORT_FIELDS.map((f) => [f.key, f]));
    return preferred
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((f) => ({
        key: f!.key,
        label: f!.label,
        selected: pick.has(f!.key),
      }));
  }

  llmEnabled() {
    return Boolean(this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')?.trim());
  }

  private continuePending(
    q: string,
    lower: string,
    pending: AiPendingIntent,
  ): ResolvedIntent | null {
    const filters = {
      ...pending.filters,
      ...this.extractFilters(lower),
    };
    const columns =
      this.extractColumns(q).length > 0
        ? this.extractColumns(q)
        : pending.columns;
    const format = this.extractFormat(lower) ?? pending.format;

    if (pending.action === 'generate_student_report') {
      if (pending.awaitingReportConfirm && this.isReportConfirmPhrase(lower)) {
        return {
          action: 'generate_student_report',
          filters: pending.filters,
          columns: pending.columns,
          format: pending.format ?? 'xlsx',
          reportConfirmed: true,
          confidence: 1,
        };
      }

      const reportSpec = parseStudentReportIntent(q);
      if (reportSpec) {
        const missing: Array<'fields' | 'format'> = [];
        if (!reportSpec.columns.length && !pending.columns?.length) {
          missing.push('fields');
        }
        return {
          action: 'generate_student_report',
          filters: { ...pending.filters, ...reportSpec.filters },
          columns: reportSpec.columns.length
            ? reportSpec.columns
            : pending.columns,
          format: reportSpec.format ?? pending.format ?? 'xlsx',
          confidence: 0.95,
          needsClarification: missing.length ? missing : undefined,
          question: q,
        };
      }

      // User may reply with only "excel" / "semester 5" / field list
      const onlyFormat =
        /^(excel|xlsx|csv|pdf|generate|download|yes|ok|okay|go ahead)\b/i.test(
          lower.trim(),
        );
      const mergedColumns =
        columns?.length && !onlyFormat
          ? columns
          : pending.columns?.length
            ? pending.columns
            : onlyFormat
              ? DEFAULT_REPORT_COLUMNS
              : columns;

      const missing: Array<'fields' | 'format'> = [];
      if (!mergedColumns?.length) missing.push('fields');

      return {
        action: 'generate_student_report',
        filters,
        columns: mergedColumns,
        format: format ?? 'xlsx',
        confidence: 0.95,
        needsClarification: missing.length ? missing : undefined,
      };
    }

    if (
      (pending.action === 'generate_fee_report' ||
        pending.action === 'generate_attendance_report') &&
      pending.awaitingReportConfirm &&
      this.isReportConfirmPhrase(lower)
    ) {
      return {
        action: pending.action,
        filters: pending.filters,
        feeReportType: pending.feeReportType,
        attendanceReportType: pending.attendanceReportType,
        format: pending.format ?? 'xlsx',
        reportConfirmed: true,
        confidence: 1,
      };
    }

    if (
      (pending.action === 'search_students' ||
        pending.action === 'search_staff' ||
        pending.action === 'search_applications' ||
        pending.action === 'search_subjects' ||
        pending.action === 'search_departments') &&
      q.trim().length >= 2
    ) {
      return {
        action: pending.action,
        filters,
        searchQuery: q.trim(),
        confidence: 0.95,
      };
    }

    return null;
  }

  private extractFilters(lower: string): AiIntentFilters {
    const filters: AiIntentFilters = {};

    if (/\bb\.?\s*com\b|\bcommerce\b|\bbcom\b/.test(lower)) {
      filters.programmeFamily = 'BCOM';
    } else if (/\bb\.?\s*sc\b|\bscience\b|\bbsc\b/.test(lower)) {
      filters.programmeFamily = 'BSC';
    } else if (/\bb\.?\s*a\b|\barts\b|\bba\b|\bfyup\b/.test(lower)) {
      filters.programmeFamily = 'BA';
    }

    const semMatch = lower.match(
      /semester\s*(?:v|iv|iii|ii|i|\d+)|sem\s*[-.]?\s*(\d+|v|iv|iii|ii|i)\b/,
    );
    if (semMatch) {
      const token = (semMatch[1] ?? semMatch[0].replace(/semester|sem/gi, ''))
        .trim()
        .toLowerCase();
      const roman: Record<string, number> = {
        i: 1,
        ii: 2,
        iii: 3,
        iv: 4,
        v: 5,
        vi: 6,
        vii: 7,
        viii: 8,
      };
      const n = roman[token] ?? Number(token.replace(/\D/g, ''));
      if (n >= 1 && n <= 8) filters.semester = n;
    }

    if (/\bgirls?\b|\bfemale\b|\bwomen\b/.test(lower))
      filters.gender = 'FEMALE';
    if (/\bboys?\b|\bmale\b|\bmen\b/.test(lower)) filters.gender = 'MALE';

    if (/without\s+aadhaar|no\s+aadhaar|missing\s+aadhaar/.test(lower)) {
      filters.missingAadhaar = true;
    }
    if (/without\s+photo|no\s+photo|missing\s+photo/.test(lower)) {
      filters.missingPhoto = true;
    }
    if (/without\s+mobile|no\s+mobile|missing\s+mobile/.test(lower)) {
      filters.missingMobile = true;
    }
    if (/without\s+abc|no\s+abc|missing\s+abc/.test(lower)) {
      filters.missingAbcId = true;
    }
    if (/incomplete\s+profile|profile\s+incomplete/.test(lower)) {
      filters.incompleteProfile = true;
    }
    if (/missing\s+class\s*xii|class\s*xii\s+missing/.test(lower)) {
      filters.missingClassXii = true;
    }
    if (/pending\s+(profile\s+)?verif/.test(lower)) {
      filters.pendingProfileVerification = true;
    }

    if (/pending\s+fee|outstanding|defaulter|overdue/.test(lower)) {
      filters.feeStatus = 'DUE';
    }

    return filters;
  }

  private extractColumns(q: string): string[] {
    const keys = new Set<string>();
    for (const { pattern, key } of FIELD_ALIASES) {
      if (pattern.test(q)) keys.add(key);
    }
    // Explicit "with A, B and C" lists often include field labels
    if (/with\s+.+/i.test(q) || /columns?\s*:/i.test(q)) {
      for (const field of STUDENT_REPORT_FIELDS) {
        if (q.toLowerCase().includes(field.label.toLowerCase())) {
          keys.add(field.key);
        }
      }
    }
    return [...keys];
  }

  private extractFormat(lower: string): 'xlsx' | 'csv' | undefined {
    if (/\bcsv\b/.test(lower)) return 'csv';
    if (/\bexcel\b|\bxlsx\b|\bxls\b|\bspreadsheet\b/.test(lower)) return 'xlsx';
    if (/\bpdf\b/.test(lower)) return 'xlsx'; // Phase 1: Excel institutional export
    return undefined;
  }

  private isStudentReport(lower: string) {
    return (
      (/\b(generate|export|download|create|prepare)\b/.test(lower) &&
        /\b(report|excel|csv|list|register)\b/.test(lower)) ||
      /\bstudent\s+report\b|\badmission\s+report\b|\badmission\s+register\b/.test(
        lower,
      ) ||
      (/\breport\b/.test(lower) &&
        (/\bstudent\b|\bba\b|\bcommerce\b|\bscience\b|\bfyup\b/.test(lower) ||
          /\bgirls?\b|\bboys?\b|\bsemester\b/.test(lower)))
    );
  }

  private isReportConfirmPhrase(lower: string) {
    const t = lower.trim();
    return (
      /^(yes|confirm|ok|okay|proceed|go ahead|generate)(\b|,|\s|$)/i.test(t) ||
      /\bgenerate\s+(the\s+)?report\b/i.test(t) ||
      /^yes,?\s+generate\b/i.test(t)
    );
  }

  /**
   * Curriculum / policy questions answered from the institutional Knowledge Base.
   * Operational ERP questions (students, fees, attendance) are excluded unless hybrid.
   */
  private isPaperEnrolmentQuery(q: string, lower: string) {
    const asksStudents =
      /\bstudents?\b/.test(lower) ||
      /\broll\s*(no|number|numbers)?\b/.test(lower);
    const enrolment =
      /\b(opted|opt\b|enrolled|enrol|registered|took|taking|chosen|chose|selected|who\s+takes?|who\s+has)\b/.test(
        lower,
      );
    const paper =
      /\b(vtc|mdc|aec|sec|vac)\b/.test(lower) ||
      /\b(?:MDC|AEC|SEC|VAC|VTC|SUB)[-:\s.]?\d{2,4}/i.test(q) ||
      /\b(paper|course|subject)\b/.test(lower);
    const listAsk = /\b(which|who|list|show|all|names?)\b/.test(lower);
    return asksStudents && (enrolment || (listAsk && paper));
  }

  private extractPaperQuery(q: string): string | undefined {
    const code = q.match(
      /\b((?:MDC|AEC|SEC|VAC|VTC|SUB)[-:\s.]?\d{2,4}(?:\.\d+)?)\b/i,
    );
    if (code?.[1]) {
      return code[1].replace(/\s+/g, '').replace(/:/g, '-');
    }
    const titled = q.match(
      /\b(?:opted|opt|enrolled|enrol|registered|taking|took|for)\s+(.+?)(?:\s+list|\s+roll|\s*$)/i,
    );
    if (titled?.[1]) {
      const cleaned = titled[1]
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.length >= 3 ? cleaned : undefined;
    }
    return undefined;
  }

  private isKnowledgeQuery(q: string, lower: string) {
    if (this.isPaperEnrolmentQuery(q, lower)) return false;
    if (this.isRegulationKnowledgeQuery(lower)) return true;

    const operational =
      /\bstudents?\b|\bstaff\b|\bfaculty\b|\bfee\b|\bpending\b|\bcollection\b|\battendance\b|\bdefaulter\b|\boutstanding\b|\breport\b|\bexcel\b|\bcsv\b|\bdownload\b|\bpromote\b|\bsms\b|\bemail\b/.test(
        lower,
      );
    // Course codes from NEHU framework (MDC-110, VAC-140, AEC-120, …)
    if (/\b(?:MDC|AEC|SEC|VAC|SUB|VTC)[-\s]?\d{2,3}\b/i.test(q)) {
      return true;
    }
    if (
      /\b(fyup|four[- ]year|4[- ]year)\b/.test(lower) &&
      /\bcredit/.test(lower)
    ) {
      return true;
    }
    if (
      /\b(curriculum|credit framework|nehu framework|multidisciplinary|value added course|ability enhancement|skill enhancement)\b/.test(
        lower,
      )
    ) {
      return true;
    }
    if (operational) return false;

    if (
      /\b(mdc|aec|sec|vac)\b/.test(lower) &&
      /\b(course|list|which|available|all|show|credit)\b/.test(lower)
    ) {
      return true;
    }
    if (
      /\bsem(?:ester)?\s*(?:[1-8]|i{1,3}|iv|v?i{0,3})\b/.test(lower) &&
      /\b(course|credit|structure|paper|detail|explain|compare|framework|major|minor|mdc|aec|sec|vac)\b/.test(
        lower,
      )
    ) {
      return true;
    }
    if (/\bcompare\b/.test(lower) && /\bsem(?:ester)?\b/.test(lower)) {
      return true;
    }
    if (
      /\bhow many credits?\b/.test(lower) &&
      /\b(fyup|programme|program|ug|undergraduate|semester)\b/.test(lower)
    ) {
      return true;
    }
    return false;
  }

  private isRegulationKnowledgeQuery(lower: string) {
    return (
      /\b(change|switch|alter)\s+(?:their\s+)?major\b|\bmajor\s+change\b|\bpromotion\s+rule|\battendance\s+requirement|\bminimum\s+attendance|\beligible\s+for\s+exam|\bexam\s+regulation|\bhostel\s+refund|\brefund\s+policy|\bleave\s+rule|\bservice\s+rule|\bcan\s+semester\b/i.test(
        lower,
      ) &&
      !/\b(show|list|all)\s+.*\bstudents?\b.*\b(pending|outstanding|defaulter)\b/i.test(
        lower,
      )
    );
  }

  private resolveHybridQuery(
    q: string,
    lower: string,
    filters: AiIntentFilters,
  ): ResolvedIntent | null {
    const hasStudentList =
      /\b(show|list|all|which)\b.*\bstudents?\b|\bstudents?\b.*\b(with|having)\b/i.test(
        lower,
      );
    const feeFocus =
      /\b(pending|outstanding|defaulter|dues?|unpaid)\b.*\bfee|\bfee.*\b(pending|outstanding|defaulter|dues?|unpaid)\b/i.test(
        lower,
      );
    const attendanceFocus =
      /\b(low|poor|short)\b.*\battendance\b|\battendance\b.*\b(below|shortage|deficit)\b/i.test(
        lower,
      );

    if (!hasStudentList || (!feeFocus && !attendanceFocus)) return null;

    const semester = filters.semester ?? this.extractSemesterFromText(lower);
    if (!semester) return null;

    return {
      action: 'hybrid_query',
      filters: { ...filters, semester },
      question: q,
      hybridErpFocus: attendanceFocus ? 'attendance' : 'fees',
      confidence: 0.98,
      source: 'hybrid',
    };
  }

  private extractSemesterFromText(lower: string): number | null {
    const roman: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
    };
    const m = lower.match(/\bsem(?:ester)?\s*([1-8]|i{1,3}|iv|v?i{0,3})\b/i);
    if (!m) return null;
    const token = m[1].toLowerCase();
    if (/^\d+$/.test(token)) return Number(token);
    return roman[token] ?? null;
  }

  private isExamFee(lower: string) {
    return (
      /\bexam(?:ination)?\s+fee\b|\bsemester\s+exam(?:ination)?\s+fee\b|\bback\s+papers?\b/.test(
        lower,
      ) ||
      (/\bexam\b/.test(lower) &&
        /\b(unpaid|pending|verification|collection|receipt|back\s*log)\b/.test(
          lower,
        ))
    );
  }

  private isFee(lower: string) {
    return (
      (/\bfee\b|\bcollection\b|\boutstanding\b|\bdefaulter\b|\bdues?\b/.test(
        lower,
      ) &&
        !/\breport\b/.test(lower)) ||
      /\bpending\s+fees?\b|\btoday'?s?\s+collection\b/.test(lower)
    );
  }

  private isAttendance(lower: string) {
    return /\battendance\b|\babsen/.test(lower);
  }

  private isKpi(lower: string) {
    return (
      /\bhow many students\b|\btotal students\b|\badmitted\b|\binsights?\b|\bkpi\b|\bdashboard\b/.test(
        lower,
      ) ||
      (/\bhow many\b/.test(lower) &&
        /\bstudent|admission|application/.test(lower))
    );
  }

  private isSearchStudent(lower: string) {
    return (
      /\bfind student\b|\bsearch student\b|\blookup student\b/.test(lower) ||
      (/\bfind\b|\bsearch\b/.test(lower) &&
        !/\bstaff\b|\bfaculty\b|\bemployee\b/.test(lower) &&
        !/\breport\b|\bfee\b|\battendance\b/.test(lower) &&
        /[a-z]{3,}/.test(lower.replace(/find|search|student|for|the|a/g, '')))
    );
  }

  private isSearchStaff(lower: string) {
    return /\bfind staff\b|\bsearch staff\b|\bfind faculty\b|\bsearch faculty\b|\bfind employee\b/.test(
      lower,
    );
  }

  private isActionStub(lower: string) {
    return /\b(promote students|send sms|send email|generate certificates|lock mark|publish results|generate fee demand|hall ticket)\b/.test(
      lower,
    );
  }

  private isChart(lower: string) {
    return (
      /\bchart\b|\bgraph\b|\bpie\b|\bbar chart\b/.test(lower) ||
      /admission trends|gender distribution|department comparison/.test(lower)
    );
  }

  private chartWidget(lower: string) {
    if (/fee|collection|revenue/.test(lower)) return 'fee-collection-trend';
    if (/attendance|absent/.test(lower)) return 'shift-attendance';
    if (/shift|enrollment/.test(lower)) return 'shift-enrollment';
    return 'department-admissions';
  }

  private isFeeReport(lower: string) {
    return (
      (/\b(generate|export|download)\b/.test(lower) &&
        /\bfee\b|\bcollection\b|\bdefaulter\b|\boutstanding\b|\bcash book\b/.test(
          lower,
        )) ||
      /generate fee report|fee collection summary/.test(lower)
    );
  }

  private feeReportType(lower: string) {
    if (/monthly/.test(lower)) return 'monthly-collection';
    if (/daily|today/.test(lower)) return 'daily-collection';
    if (/cash book/.test(lower)) return 'cash-book';
    return 'outstanding';
  }

  private isAttendanceReport(lower: string) {
    return (
      (/\b(generate|export|download)\b/.test(lower) &&
        /\battendance\b|\babsentee\b|\bshortage\b/.test(lower)) ||
      /export attendance|attendance analysis/.test(lower)
    );
  }

  private attendanceReportType(lower: string) {
    if (/daily|today/.test(lower)) return 'daily';
    return 'shortage';
  }

  private isSearchApplications(lower: string) {
    return /\b(find|search)\b.*\bapplication\b|\bapplication no\b/.test(lower);
  }

  private isSearchSubjects(lower: string) {
    return /\b(find|search)\b.*\b(subject|course)\b/.test(lower);
  }

  private isSearchDepartments(lower: string) {
    return /\b(find|search)\b.*\bdepartment\b/.test(lower);
  }

  private isProfileCompletion(lower: string) {
    return (
      /\bprofile\s+completion\b/.test(lower) ||
      /\bincomplete\s+profiles?\b/.test(lower) ||
      /\bmissing\s+class\s*xii\b/.test(lower) ||
      /\bpending\s+(profile\s+)?verif/.test(lower) ||
      /\bstudents?\s+missing\s+(aadhaar|bank|photo|class\s*xii)\b/.test(
        lower,
      ) ||
      /\bhow\s+many\s+incomplete\s+profiles?\b/.test(lower)
    );
  }

  private proposeAction(lower: string): ResolvedIntent {
    if (/promote/.test(lower)) {
      return {
        action: 'propose_action',
        filters: {},
        confidence: 1,
        proposedAction: 'promote',
        actionLabel: 'Open promotion workflow',
        actionHref: '/admin/academics/promotion',
        answerHint:
          'Promotion changes student semester standing. Confirm to open the Promotion module (you must complete the run there).',
      };
    }
    if (/sms/.test(lower)) {
      return {
        action: 'propose_action',
        filters: {},
        confidence: 1,
        proposedAction: 'sms',
        actionLabel: 'Open Communication (SMS)',
        actionHref: '/admin/communication',
        answerHint:
          'Bulk SMS is a write action. Confirm to open Communication and compose the campaign yourself.',
      };
    }
    if (/email/.test(lower)) {
      return {
        action: 'propose_action',
        filters: {},
        confidence: 1,
        proposedAction: 'email',
        actionLabel: 'Open Communication (Email)',
        actionHref: '/admin/communication/email',
        answerHint:
          'Bulk email is a write action. Confirm to open Communication and compose the campaign yourself.',
      };
    }
    if (/certificate/.test(lower)) {
      return {
        action: 'propose_action',
        filters: {},
        confidence: 1,
        proposedAction: 'certificates',
        actionLabel: 'Open Certificates',
        actionHref: '/admin/certificates',
        answerHint:
          'Certificate issue is a write action. Confirm to open Certificates to preview and issue documents.',
      };
    }
    return {
      action: 'propose_action',
      filters: {},
      confidence: 1,
      proposedAction: 'admin',
      actionLabel: 'Open admin dashboard',
      actionHref: '/admin',
      answerHint:
        'This administrative action requires confirmation. Confirm to open the related module.',
    };
  }

  private extractSearchQuery(
    q: string,
    lower: string,
    kind: 'student' | 'staff' | 'application' | 'subject' | 'department',
  ) {
    const cleaned = q
      .replace(
        new RegExp(
          `\\b(find|search|lookup|show|get)\\b\\s*(${kind}|faculty|employee|course)?\\b`,
          'ig',
        ),
        '',
      )
      .replace(/\b(for|named|name|is|the|a|an|no\.?|number)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length >= 2 ? cleaned : undefined;
  }

  /**
   * College roll / admission / enrollment style codes: BA25-814, BSC25-001, BCOM25-12.
   */
  extractStudentIdentifier(q: string): string | undefined {
    const match = q.match(/\b([A-Za-z]{1,5}\s*\d{2}\s*[-–—/]?\s*\d{2,6})\b/);
    if (!match?.[1]) return undefined;
    return match[1].replace(/\s+/g, '').replace(/[–—/]/g, '-').toUpperCase();
  }

  private isStaffContext(lower: string) {
    return /\bstaff\b|\bfaculty\b|\bemployee\b|\bemp\s*id\b/.test(lower);
  }

  private studentLookupFocus(
    lower: string,
  ): import('../ai-assistant.types').AiLookupFocus {
    if (
      /\bshift\b|\bmorning\b|\bday\b|\bevening\b|\bbelongs?\b|\bstud(y|ies|ying)\s+where\b/.test(
        lower,
      )
    ) {
      return 'shift';
    }
    if (
      /\bprogramme\b|\bprogram\b|\bcourse\b|\bmajor\b|\bstud(y|ies|ying)\b/.test(
        lower,
      )
    ) {
      return 'programme';
    }
    if (/\bsemester\b|\bsem\b/.test(lower)) return 'semester';
    if (
      /\bfee\b|\boutstanding\b|\bdue\b|\bdefaulter\b|\bpaid\b|\bpending\b|\bhow much\b/.test(
        lower,
      )
    ) {
      return 'fee';
    }
    if (/\battendance\b|\babsent\b|\bpresent\b/.test(lower)) {
      return 'attendance';
    }
    if (
      /\bwho\b|\bprofile\b|\bdetails?\b|\bmobile\b|\bphone\b|\bcontact\b|\bfather\b|\bmother\b|\bgive\b|\btell\b/.test(
        lower,
      )
    ) {
      return 'who';
    }
    return 'profile';
  }
}
