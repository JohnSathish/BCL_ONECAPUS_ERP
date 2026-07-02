import { apiFetch } from '@/api/client';

export type ExamPaper = {
  id: string;
  paperCode?: string;
  paperName?: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
};

export type ExamSeat = {
  id: string;
  paperId?: string;
  classroomId?: string;
  seatNumber?: string;
};

export type ExamRoom = {
  id: string;
  code?: string;
  name?: string;
};

export type ExamSession = {
  id: string;
  name?: string;
};

export type StudentExamAdmitCard = {
  student?: {
    rollNumber?: string;
    admissionNumber?: string;
    masterProfile?: { fullName?: string };
    user?: { displayName?: string };
    program?: { name?: string };
  };
  session?: ExamSession | null;
  papers?: ExamPaper[];
  seats?: ExamSeat[];
  rooms?: ExamRoom[];
  instructions?: string;
  feeBlocked?: boolean;
  outstandingAmount?: number;
  feeBlockReasons?: string[];
};

export type IaExamScheduleItem = {
  id: string;
  paperCode?: string;
  paperName?: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
};

export type IaExamSchedule = {
  student?: {
    fullName?: string;
    rollNumber?: string;
    programme?: string;
  };
  schedule?: IaExamScheduleItem[];
};

export type ExamMarkEntry = {
  id: string;
  paperId?: string;
  internalMarks?: number | string | null;
  externalMarks?: number | string | null;
  practicalMarks?: number | string | null;
  totalMarks?: number | string | null;
  maxMarks?: number | string | null;
  grade?: string | null;
  resultStatus?: string | null;
};

export type ExamResultSummary = {
  id: string;
  resultStatus?: string;
  percentage?: number | string | null;
  sgpa?: number | string | null;
  cgpa?: number | string | null;
  totalMarks?: number | string | null;
  maxMarks?: number | string | null;
  publishStatus?: string;
};

export type StudentExamResults = {
  student?: {
    masterProfile?: { fullName?: string };
    user?: { displayName?: string };
    rollNumber?: string;
    program?: { name?: string };
  };
  summaries?: ExamResultSummary[];
  marks?: ExamMarkEntry[];
  papers?: ExamPaper[];
};

export type IaMarkComponent = {
  code?: string;
  label?: string;
  marks?: number | null;
  maxMarks?: number;
  isAbsent?: boolean;
};

export type IaMarkSummary = {
  totalMarks?: number;
  maxMarks?: number;
  percentage?: number;
  resultStatus?: string;
};

export type StudentIaMarks = {
  studentId?: string;
  components?: IaMarkComponent[];
  summaries?: IaMarkSummary[];
};

export function fetchStudentExamAdmitCard(sessionId?: string) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  return apiFetch<StudentExamAdmitCard>(`/v1/examinations/portal/admit-card${query}`);
}

export function fetchStudentIaSchedule() {
  return apiFetch<IaExamSchedule>('/v1/examinations/ia/portal/schedule');
}

export function fetchStudentExamResults(sessionId?: string) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  return apiFetch<StudentExamResults>(`/v1/examinations/portal/results${query}`);
}

export function fetchStudentIaMarks() {
  return apiFetch<StudentIaMarks>('/v1/examinations/ia/portal/marks');
}

export function formatExamDate(value?: string | null) {
  if (!value) return '—';
  const text = String(value);
  if (text.length >= 10) {
    const date = new Date(text.slice(0, 10));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return text.slice(0, 10);
}

export function formatExamTime(value?: string | null) {
  if (!value) return '—';
  const text = String(value);
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatExamTimeRange(start?: string | null, end?: string | null) {
  return `${formatExamTime(start)} – ${formatExamTime(end)}`;
}

export function markValue(value?: number | string | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

export function resultStatusColor(status?: string | null) {
  const normalized = (status ?? '').toUpperCase();
  if (normalized.includes('PASS')) return '#107C10';
  if (normalized.includes('FAIL')) return '#DC2626';
  if (normalized.includes('PENDING')) return '#D97706';
  return '#2563EB';
}
