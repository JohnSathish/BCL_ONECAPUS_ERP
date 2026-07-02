import { apiFetch } from '@/api/client';

export type IaPaper = {
  id: string;
  sessionId: string;
  paperCode: string;
  paperName: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  semesterNo?: number | null;
  status?: string;
};

export type FacultyIaSubject = {
  assignmentId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  semesterNo: number;
  sectionCode?: string | null;
  programmeName?: string | null;
  papers: IaPaper[];
};

export type IaSchemeComponent = {
  id: string;
  code: string;
  label: string;
  maxMarks: number;
};

export type IaMarkRosterStudent = {
  id: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  fullName?: string | null;
  marks: {
    componentId: string;
    code: string;
    label: string;
    maxMarks: number;
    marks: number | null;
    isAbsent: boolean;
    status?: string;
  }[];
};

export type IaMarkRoster = {
  paper: IaPaper & { courseId?: string | null };
  scheme: { id: string; name: string; components: IaSchemeComponent[] };
  students: IaMarkRosterStudent[];
};

export function fetchFacultyIaSubjects() {
  return apiFetch<FacultyIaSubject[]>('/v1/examinations/ia/faculty/my-subjects');
}

export function fetchIaMarkRoster(paperId: string, schemeId?: string) {
  const query = schemeId ? `?schemeId=${encodeURIComponent(schemeId)}` : '';
  return apiFetch<IaMarkRoster>(`/v1/examinations/ia/papers/${paperId}/roster${query}`);
}

export function saveIaMarks(
  paperId: string,
  payload: {
    schemeId: string;
    rows: {
      studentId: string;
      componentId: string;
      marks?: number;
      isAbsent?: boolean;
      remarks?: string;
    }[];
  },
) {
  return apiFetch<{ saved: number }>(`/v1/examinations/ia/papers/${paperId}/marks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
