import { api } from '@/services/api';

export type TimetablePlan = {
  id: string;
  name: string;
  status: string;
  approvalState: string;
  shiftId?: string | null;
  metadata?:
    | {
        semesterMode?: 'ODD' | 'EVEN';
        allowedSemesters?: number[];
        blockedSemesters?: number[];
        streamId?: string | null;
        streamCode?: string | null;
        streamName?: string | null;
        generationScope?: string;
      }
    | Record<string, unknown>;
  semesterSequence?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  generatedAt?: string | null;
  publishedAt?: string | null;
  generationSummary?: Record<string, unknown>;
};

export type TimetableReplacementOverlay = {
  assignmentId: string;
  reason: string;
  reasonLabel: string;
  originalStaffProfileId: string;
  originalStaffName: string;
  handledByName: string;
  handledByCode: string;
  startDate: string;
  endDate: string;
};

export type TimetableEntry = {
  id: string;
  dayOfWeek: number;
  periodNo?: number | null;
  startTime: string;
  endTime: string;
  courseId?: string | null;
  teachingSubjectGroupId?: string | null;
  staffProfileId?: string | null;
  classroomId?: string | null;
  course?: { code: string; title: string } | null;
  teachingSubjectGroup?: { code: string; title: string } | null;
  staffProfile?: { shortCode?: string | null; fullName: string } | null;
  classroom?: { code: string; name: string } | null;
  replacementOverlay?: TimetableReplacementOverlay | null;
  slotType: string;
  fyugpCategory?: string | null;
  sectionCode?: string | null;
  semesterSequence?: number | null;
  isCombined?: boolean;
  shiftId?: string | null;
  shiftCode?: string | null;
  shiftName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TimetableMatrixRow = {
  id: string;
  dayOfWeek: number;
  periodNo?: number | null;
  label: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  isLunch?: boolean;
  isSaturdayHalfDay?: boolean;
  durationMinutes?: number;
  entries: TimetableEntry[];
};

export type TimetableMatrix = {
  summary?: {
    title?: string;
    streamName?: string;
    shiftId?: string | null;
    semesterMode?: string | null;
    academicYearId?: string | null;
    effectiveFrom?: string | null;
  };
  days: { value: number; label: string }[];
  slots: Omit<TimetableMatrixRow, 'entries'>[];
  rows: TimetableMatrixRow[];
};

export type TimetableContext = {
  currentAcademicMode: 'ODD' | 'EVEN';
  allowedSemesters: number[];
  blockedSemesters: number[];
  streams: {
    id: string;
    code: string;
    name: string;
    group?: string | null;
    departments: string[];
  }[];
  shifts: { id: string; code: string; name: string; startTime: string; endTime: string }[];
  academicYears: { id: string; name: string; status?: string }[];
};

export type TimetableDashboard = {
  currentActiveCycle: 'ODD' | 'EVEN';
  allowedSemesters: number[];
  blockedSemesters: number[];
  generatedPlansByStream: { label: string; count: number }[];
  generatedPlansByShift: { label: string; count: number }[];
  pendingTimetables: number;
  publishedTimetables: number;
};

export type TimetableConflictSummary = {
  planId: string;
  totalEntries: number;
  totalConflicts: number;
  blockingConflicts: number;
  conflicts: {
    conflictType: string;
    severity?: string;
    message: string;
    affectedEntityType?: string;
  }[];
};

export type TeachingAllocationRow = {
  id: string;
  offeringSectionId: string;
  departmentId?: string | null;
  department?: string | null;
  semester?: number | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  paperType?: string | null;
  staffProfileId?: string | null;
  staffCode?: string | null;
  staffName?: string | null;
  facultyInitial?: string | null;
  weeklyHours?: number;
  maxWeeklyHours?: number;
  assignedWeeklyHours?: number;
  workloadStatus?: 'GREEN' | 'YELLOW' | 'RED' | string;
  shiftId?: string | null;
  shift?: string | null;
  preferredRoomId?: string | null;
  preferredRoom?: string | null;
  labRequired?: boolean;
  combinedClass?: boolean;
  combinedGroupId?: string | null;
  status?: string | null;
};

export type TimetableReadiness = {
  totalSubjects: number;
  readySubjects: number;
  blockingIssues: number;
  warnings: number;
  readyForGeneration: boolean;
  summary: Record<string, number>;
  issues: {
    type: string;
    severity: string;
    message: string;
    offeringSectionId?: string;
    fixPath?: string;
  }[];
};

export type StreamMasterRoutine = {
  plan: TimetablePlan & {
    semesterMode?: string;
    streamCode?: string;
  };
  title: string;
  semesterMode: 'ODD' | 'EVEN';
  semesterRows: number[];
  days: { value: number; label: string }[];
  timeBlocks: {
    id: string;
    periodNo?: number;
    label: string;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
    isLunch?: boolean;
    allowedCategories?: string[];
  }[];
  streams: {
    code: string;
    name: string;
    departments: string[];
    summary: Record<string, number>;
    rows: {
      id: string;
      label: string;
      startTime: string;
      endTime: string;
      isBreak?: boolean;
      isLunch?: boolean;
      allowedCategories?: string[];
      semesters: {
        semester: number;
        label: string;
        days: {
          dayOfWeek: number;
          label: string;
          entries: {
            id: string;
            courseCode?: string | null;
            courseTitle?: string | null;
            category?: string | null;
            facultyInitial?: string | null;
            facultyName?: string | null;
            roomCode?: string | null;
            isCombined?: boolean;
            combinedGroupKey?: string | null;
            parallelGroupId?: string | null;
          }[];
        }[];
      }[];
    }[];
  }[];
};

export async function fetchTimetablePlans(params?: {
  shiftId?: string;
  streamId?: string;
  semesterMode?: string;
  status?: string;
}) {
  const { data } = await api.get('/v1/timetable/plans', { params });
  return data as TimetablePlan[];
}

export async function createTimetablePlan(payload: {
  name: string;
  shiftId?: string;
  streamId?: string;
  semesterMode?: 'ODD' | 'EVEN';
  generationScope?: string;
  academicYearId?: string;
  semesterSequence?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}) {
  const { data } = await api.post('/v1/timetable/plans', payload);
  return data as TimetablePlan;
}

export async function fetchTimetableContext() {
  const { data } = await api.get('/v1/timetable/context');
  return data as TimetableContext;
}

export async function fetchTimetableDashboard() {
  const { data } = await api.get('/v1/timetable/dashboard');
  return data as TimetableDashboard;
}

export async function generateTimetablePlan(planId: string) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/generate`);
  return data as { generatedEntries: number; consideredSections: number };
}

export async function fetchTimetableMatrix(
  planId: string,
  params?: {
    staffProfileId?: string;
    classroomId?: string;
    offeringSectionId?: string;
    semesterSequence?: number;
    sectionCode?: string;
  },
) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/matrix`, {
    params,
  });
  return data as TimetableMatrix;
}

export async function validateTimetablePlan(planId: string) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/validate`);
  return data as TimetableConflictSummary;
}

export async function submitTimetablePlan(planId: string) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/submit-review`);
  return data as TimetablePlan;
}

export async function createManualTimetablePlan(payload: {
  name?: string;
  shiftId?: string;
  streamId?: string;
  semesterMode?: 'ODD' | 'EVEN';
  academicYearId?: string;
  semesterSequence?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}) {
  const { data } = await api.post('/v1/timetable/plans', {
    ...payload,
    name: payload.name?.trim() || `Manual Timetable ${new Date().toLocaleDateString()}`,
    generationScope: 'MANUAL',
  });
  return data as TimetablePlan;
}

export type ManualEntryPayload = {
  planId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftId?: string;
  slotTemplateId?: string;
  periodNo?: number;
  offeringSectionId?: string;
  courseOfferingId?: string;
  courseId?: string;
  teachingSubjectGroupId?: string;
  staffProfileId?: string | null;
  classroomId?: string;
  semesterSequence?: number;
  sectionCode?: string;
  slotType?: string;
  fyugpCategory?: string;
  combinedGroupKey?: string;
  isCombined?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
  facultyTeam?: Array<{ staffProfileId: string; role?: string; allocationPercent?: number }>;
};

export async function createManualEntry(payload: ManualEntryPayload) {
  const { data } = await api.post('/v1/timetable/entries/manual', payload);
  return data;
}

export async function updateTimetableEntry(entryId: string, payload: Partial<ManualEntryPayload>) {
  const { data } = await api.patch(`/v1/timetable/entries/${entryId}`, payload);
  return data;
}

export async function deleteTimetableEntry(entryId: string) {
  const { data } = await api.patch(`/v1/timetable/entries/${entryId}/delete`);
  return data;
}

export async function duplicateTimetableEntry(
  entryId: string,
  payload: { targetDay: number; targetPeriodNo?: number },
) {
  const { data } = await api.post(`/v1/timetable/entries/${entryId}/duplicate`, payload);
  return data;
}

export async function copyDaySchedule(
  planId: string,
  payload: { sourceDay: number; targetDay: number },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/bulk/copy-day`, payload);
  return data as { copied: number };
}

export async function copySemesterSchedule(
  planId: string,
  payload: { sourceSemester: number; targetSemester: number },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/bulk/copy-semester`, payload);
  return data as { copied: number };
}

export async function bulkMovePeriods(
  planId: string,
  payload: { fromPeriod: number; toPeriod: number; dayOfWeek?: number },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/bulk/move-periods`, payload);
  return data as { updated: number };
}

export async function bulkReplaceFaculty(
  planId: string,
  payload: { fromStaffProfileId: string; toStaffProfileId: string },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/bulk/replace-faculty`, payload);
  return data as { updated: number };
}

export async function bulkReplaceRooms(
  planId: string,
  payload: { fromClassroomId: string; toClassroomId: string },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/bulk/replace-rooms`, payload);
  return data as { updated: number };
}

export async function clonePreviousTimetable(payload: {
  sourcePlanId: string;
  targetPlanId: string;
}) {
  const { data } = await api.post('/v1/timetable/clone-previous', payload);
  return data;
}

export async function fetchSlotCategoryRules(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/category-slot-rules`);
  return data as Array<{
    id: string;
    dayOfWeek: number;
    periodNo?: number;
    label: string;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
    isLunch?: boolean;
    isSaturdayHalfDay?: boolean;
    allowedCategories?: string[];
  }>;
}

export async function saveSlotCategoryRules(planId: string, rules: unknown[]) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/category-slot-rules`, { rules });
  return data;
}

export async function downloadRoutineTemplate(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/routine/template`, {
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  return data as Blob;
}

export async function exportTimetableRoutine(planId: string, scope = 'draft') {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/export`, {
    params: { scope },
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  return data as Blob;
}

export async function validateRoutineUpload(planId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/timetable/plans/${planId}/routine/validate-upload`, form);
  return data as {
    summary: {
      total: number;
      success: number;
      warnings: number;
      errors: number;
      canCommit: boolean;
    };
    rows: Array<Record<string, unknown>>;
  };
}

export async function commitRoutineUpload(
  planId: string,
  file: File,
  options?: { overrideConflicts?: boolean },
) {
  const form = new FormData();
  form.append('file', file);
  if (options?.overrideConflicts) form.append('overrideConflicts', 'true');
  const { data } = await api.post(`/v1/timetable/plans/${planId}/routine/commit-upload`, form);
  return data as {
    committed: number;
    preview: { success: number; warnings: number; errors: number };
  };
}

export async function approveTimetablePlan(
  planId: string,
  payload?: { acknowledgeWarnings?: boolean; overrideReason?: string },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/approve`, payload ?? {});
  return data as TimetablePlan;
}

export async function publishTimetablePlan(
  planId: string,
  payload?: { acknowledgeWarnings?: boolean; overrideReason?: string },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/publish`, payload ?? {});
  return data as TimetablePlan;
}

export async function fetchDraftRoomEntries(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/draft-rooms`);
  return data as TimetableEntry[];
}

export async function finalizeTimetableRooms(
  planId: string,
  payload?: { assignments?: Array<{ entryId: string; classroomId: string }> },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/finalize-rooms`, payload ?? {});
  return data as { updated: number };
}

export async function deleteTimetablePlan(planId: string) {
  try {
    const { data } = await api.patch(`/v1/timetable/plans/${planId}/delete`);
    return data as TimetablePlan;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 404) throw error;
    const { data } = await api.post(`/v1/timetable/plans/${planId}/delete`);
    return data as TimetablePlan;
  }
}

export async function fetchTodayTimetableSessions(params?: {
  date?: string;
  shiftId?: string;
  streamId?: string;
  staffProfileId?: string;
}) {
  const { data } = await api.get('/v1/timetable/attendance/today-sessions', { params });
  return data as TimetableEntry[];
}

export type TimetableCalendarDayPayload = {
  date: string;
  calendarDay: {
    date: string;
    isWorkingDay: boolean;
    dayKind: string;
    createsAttendanceSession: boolean;
    events: Array<{ id: string; type: string; title: string }>;
  };
  sessionsRun: boolean;
  suppressedReason: string | null;
  plan: { id: string; name: string; academicYearId: string | null } | null;
  sessions: TimetableEntry[];
  relocated: TimetableEntry[];
};

export async function fetchTimetableCalendarDay(params?: {
  date?: string;
  shiftId?: string;
  streamId?: string;
  staffProfileId?: string;
}) {
  const { data } = await api.get('/v1/timetable/calendar/day', { params });
  return data as TimetableCalendarDayPayload;
}

export async function applyTimetableCalendarDay(
  planId: string,
  payload: {
    date: string;
    action: 'CANCEL_DAY' | 'FORCE_RUN' | 'RELOCATE_ENTRY' | 'CLEAR_DAY_ACTIONS';
    originalEntryId?: string;
    targetDate?: string;
    reason?: string;
  },
) {
  const { data } = await api.post(`/v1/timetable/plans/${planId}/calendar/apply-day`, payload);
  return data;
}

export async function fetchFacultyWeekTimetable(params?: { shiftId?: string; streamId?: string }) {
  const { data } = await api.get('/v1/timetable/views/faculty/week', { params });
  return data as TimetableMatrix & { plan?: TimetablePlan };
}

export async function fetchStudentWeekTimetable() {
  const { data } = await api.get('/v1/timetable/views/student/week');
  return data as { plan?: TimetablePlan; entries: TimetableEntry[] };
}

export async function fetchNoticeBoardTimetable(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/print`);
  return data as TimetableMatrix & { title: string; plan?: TimetablePlan };
}

export async function fetchStreamMasterRoutine(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/stream-master`);
  return data as StreamMasterRoutine;
}

export async function fetchTeachingAllocations(params?: {
  academicYearId?: string;
  streamId?: string;
  shiftId?: string;
  semesterMode?: string;
  departmentId?: string;
}) {
  const { data } = await api.get('/v1/timetable/teaching-allocations', { params });
  return data as TeachingAllocationRow[];
}

export async function saveTeachingAllocation(
  payload: Partial<TeachingAllocationRow> & {
    offeringSectionId: string;
  },
) {
  const { data } = await api.post('/v1/timetable/teaching-allocations', payload);
  return data as TeachingAllocationRow;
}

export async function submitTeachingAllocations(sectionIds: string[], status = 'SUBMITTED') {
  const { data } = await api.post('/v1/timetable/teaching-allocations/submit', {
    sectionIds,
    status,
  });
  return data as { updated: number; status: string };
}

export async function autoAssignTeachingAllocations(payload: Record<string, string | undefined>) {
  const { data } = await api.post('/v1/timetable/teaching-allocations/auto-assign', payload);
  return data as { considered: number; assigned: number };
}

export async function fetchTimetableReadiness(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/timetable/readiness', { params });
  return data as TimetableReadiness;
}

export async function fetchTimetableValidationCenter(planId: string) {
  const { data } = await api.get(`/v1/timetable/plans/${planId}/validation-center`);
  return data as TimetableConflictSummary & {
    readyForPublish: boolean;
    suggestions: { conflictType: string; message: string; action: string }[];
  };
}

export function teachingAllocationTemplateUrl(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `/v1/timetable/teaching-allocations/template${suffix}`;
}

export async function downloadTeachingAllocationTemplate(
  params?: Record<string, string | undefined>,
) {
  const { data } = await api.get(teachingAllocationTemplateUrl(params), {
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
  return data as Blob;
}

export async function validateTeachingAllocationUpload(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/timetable/teaching-allocations/validate-upload', form);
  return data as {
    summary: { total: number; valid: number; invalid: number; warnings: number };
    rows: unknown[];
  };
}

export async function commitTeachingAllocationUpload(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/timetable/teaching-allocations/commit-upload', form);
  return data as { committed: number };
}

export type DepartmentWorkloadRow = {
  id: string;
  entryId?: string | null;
  offeringSectionId?: string | null;
  dayOfWeek?: number | null;
  dayName?: string | null;
  periodNo?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  subjectSlot?: string | null;
  fyugpCategory?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  semester?: number | null;
  sectionCode?: string | null;
  departmentId?: string | null;
  department?: string | null;
  staffProfileId?: string | null;
  staffName?: string | null;
  classroomId?: string | null;
  classroomCode?: string | null;
  weeklyHours?: number | null;
  maxWeeklyHours?: number | null;
  assignedWeeklyHours?: number | null;
  workloadStatus?: string | null;
  status?: string | null;
  source?: string | null;
};

export type DepartmentWorkloadSheet = {
  mode: 'SLOTS' | 'SUBJECTS';
  plan: {
    id: string;
    name: string;
    status: string;
    approvalState: string;
  } | null;
  departmentIds: string[];
  rows: DepartmentWorkloadRow[];
};

export type FacultyWorkloadAvailability = {
  staffProfileId: string;
  staffName: string;
  employeeCode?: string | null;
  shortCode?: string | null;
  department?: string | null;
  employmentType?: string | null;
  maxWeeklyHours: number;
  assignedWeeklyHours: number;
  remainingHours: number;
  workloadStatus: string;
  assignedSubjects: Array<{
    offeringSectionId: string;
    subjectCode?: string | null;
    subjectName?: string | null;
    semester?: number | null;
    weeklyHours: number;
    category?: string | null;
  }>;
  occupiedSlots: Array<{
    entryId: string;
    planId: string;
    dayOfWeek: number;
    dayName: string;
    periodNo?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    subjectName?: string | null;
    classroomCode?: string | null;
  }>;
};

export async function fetchDepartmentWorkloadPlans(params?: {
  academicYearId?: string;
  shiftId?: string;
  semesterMode?: string;
}) {
  const { data } = await api.get('/v1/timetable/department-workload/plans', { params });
  return data as Array<{
    id: string;
    name: string;
    status: string;
    approvalState: string;
    academicYearId?: string | null;
    shiftId?: string | null;
    semesterMode?: string;
    updatedAt?: string;
  }>;
}

export async function fetchDepartmentWorkloadSheet(params?: {
  planId?: string;
  departmentId?: string;
  semesterMode?: string;
  shiftId?: string;
  academicYearId?: string;
}) {
  const { data } = await api.get('/v1/timetable/department-workload', { params });
  return data as DepartmentWorkloadSheet;
}

export async function assignDepartmentWorkload(payload: {
  entryId?: string;
  offeringSectionId?: string;
  staffProfileId?: string | null;
  classroomId?: string | null;
  workloadHours?: number | null;
  status?: string;
}) {
  const { data } = await api.post('/v1/timetable/department-workload/assign', payload);
  return data;
}

export async function fetchFacultyWorkloadAvailability(
  staffProfileId: string,
  params?: { planId?: string; semesterMode?: string },
) {
  const { data } = await api.get(
    `/v1/timetable/department-workload/faculty/${staffProfileId}/availability`,
    { params },
  );
  return data as FacultyWorkloadAvailability;
}

export async function transitionDepartmentWorkloadStatus(payload: {
  sectionIds?: string[];
  entryIds?: string[];
  planId?: string;
  status: string;
}) {
  const { data } = await api.post('/v1/timetable/department-workload/status', payload);
  return data as { updated: number; status: string };
}

export type ElectiveAllocationRow = {
  id: string;
  courseOfferingId: string;
  courseId?: string;
  offeringSectionId?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  category?: string | null;
  semesterSequence?: number | null;
  homeDepartmentId?: string | null;
  homeDepartment?: string | null;
  poolName?: string | null;
  programme?: string | null;
  weeklyHours?: number;
  sectionCode?: string | null;
  shiftId?: string | null;
  shift?: string | null;
  staffProfileId?: string | null;
  staffName?: string | null;
  staffCode?: string | null;
  staffDepartment?: string | null;
  classroomId?: string | null;
  classroom?: string | null;
  capacity?: number;
  teachingDepartmentId?: string | null;
  status?: string | null;
  slots?: Array<{
    id: string;
    planId: string;
    dayOfWeek: number;
    dayName: string;
    periodNo?: number | null;
    startTime?: string;
    endTime?: string;
    classroomId?: string | null;
    staffProfileId?: string | null;
  }>;
};

export async function fetchElectiveStaffAllocations(params?: {
  academicYearId?: string;
  shiftId?: string;
  semesterMode?: string;
  semesterSequence?: number;
  category?: string;
  q?: string;
}) {
  const { data } = await api.get('/v1/timetable/elective-staff-allocation', { params });
  return data as ElectiveAllocationRow[];
}

export async function fetchElectiveFacultyOptions(shiftId?: string) {
  const { data } = await api.get('/v1/timetable/elective-staff-allocation/faculty', {
    params: shiftId ? { shiftId } : undefined,
  });
  return data as Array<{
    id: string;
    fullName: string;
    employeeCode?: string | null;
    shortCode?: string | null;
    departmentId?: string | null;
    department?: string | null;
    maxWeeklyHours?: number;
  }>;
}

export async function fetchElectiveRoomOptions() {
  const { data } = await api.get('/v1/timetable/elective-staff-allocation/rooms');
  return data as Array<{
    id: string;
    code: string;
    name?: string | null;
    capacity?: number | null;
    roomType?: string | null;
  }>;
}

export async function fetchElectiveSlotOptions(shiftId?: string) {
  const { data } = await api.get('/v1/timetable/elective-staff-allocation/slots', {
    params: shiftId ? { shiftId } : undefined,
  });
  return data as Array<{
    dayOfWeek: number;
    dayName: string;
    periodNo: number;
    label: string;
    startTime: string;
    endTime: string;
    slotTemplateId?: string | null;
  }>;
}

export async function fetchElectiveDepartments() {
  const { data } = await api.get('/v1/timetable/elective-staff-allocation/departments');
  return data as Array<{ id: string; name: string; code?: string | null }>;
}

export async function assignElectiveStaff(payload: {
  courseOfferingId: string;
  shiftId: string;
  staffProfileId: string;
  sectionCode?: string;
  teachingDepartmentId?: string | null;
  classroomId?: string | null;
  capacity?: number | null;
  workloadHours?: number | null;
  dayOfWeek?: number | null;
  periodNo?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  planId?: string | null;
  timetablePlanEntryId?: string | null;
  notes?: string | null;
  academicYearId?: string | null;
}) {
  const { data } = await api.post('/v1/timetable/elective-staff-allocation/assign', payload);
  return data as {
    row: ElectiveAllocationRow | null;
    planEntry: {
      id: string;
      planId: string;
      dayOfWeek: number;
      dayName: string;
      periodNo?: number | null;
      startTime: string;
      endTime: string;
    } | null;
    conflicts: Array<{ type: string; message: string }>;
  };
}
