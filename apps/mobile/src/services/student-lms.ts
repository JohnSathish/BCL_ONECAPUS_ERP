import { apiFetch } from '@/api/client';

export type LmsWorkspace = {
  id: string;
  title: string;
  semesterNo?: number;
  course?: { code?: string; title?: string };
  offeringSection?: { sectionCode?: string } | null;
};

export type LmsAssignment = {
  id: string;
  title: string;
  instructions?: string | null;
  submissionType?: string;
  maxMarks?: number | string | null;
  dueAt?: string | null;
  status?: string;
  mySubmission?: {
    id: string;
    status?: string;
    submittedAt?: string | null;
    feedback?: { marksAwarded?: number | string | null; feedbackText?: string | null }[];
  } | null;
};

export type LmsDashboard = {
  cards?: {
    assignmentsDue?: number;
    notesAvailable?: number;
    quizzesPending?: number;
    myCourses?: number;
  };
};

export type StudentAssignmentRow = LmsAssignment & {
  workspaceId: string;
  workspaceTitle: string;
  courseCode?: string;
};

export function fetchLmsDashboard() {
  return apiFetch<LmsDashboard>('/v1/lms/me/dashboard');
}

export function fetchLmsWorkspaces() {
  return apiFetch<{ workspaces?: LmsWorkspace[] }>('/v1/lms/me/workspaces');
}

export function fetchWorkspaceAssignments(workspaceId: string) {
  return apiFetch<LmsAssignment[]>(`/v1/lms/workspaces/${workspaceId}/assignments`);
}

export async function fetchAllStudentAssignments() {
  const { workspaces = [] } = await fetchLmsWorkspaces();
  const rows = await Promise.all(
    workspaces.map(async (workspace) => {
      const assignments = await fetchWorkspaceAssignments(workspace.id).catch(() => []);
      return assignments.map((assignment) => ({
        ...assignment,
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        courseCode: workspace.course?.code,
      }));
    }),
  );
  return rows.flat().sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export function assignmentStatusLabel(assignment: LmsAssignment) {
  const submission = assignment.mySubmission?.status;
  if (submission === 'EVALUATED') return 'Graded';
  if (submission === 'SUBMITTED') return 'Submitted';
  if (submission === 'RETURNED') return 'Returned';
  if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) return 'Overdue';
  return 'Pending';
}

export function assignmentStatusColor(status: string) {
  switch (status) {
    case 'Graded':
      return '#107C10';
    case 'Submitted':
      return '#2563EB';
    case 'Overdue':
      return '#DC2626';
    case 'Returned':
      return '#D97706';
    default:
      return '#6B7280';
  }
}

export function formatDueDate(value?: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
