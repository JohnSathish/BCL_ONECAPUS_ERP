import { api } from '@/services/api';
import type {
  CompletionMissingItem,
  CompletionProgramme,
  CompletionQueryParams,
  CompletionSummary,
  SharedPoolAuditRow,
} from '@/types/curriculum-completion';
import type { Paginated } from '@/types/programs';
import type {
  AcademicEngineSummary,
  AcademicShift,
  AcademicStream,
  CatalogSectionRow,
  CatalogWithEligibility,
  CourseOfferingRow,
  RegistrationWindow,
  SemesterRegistration,
  SemesterStructureRule,
  SeatUtilizationRow,
  StudentAcademicProfile,
  StudentProgramChoice,
} from '@/types/academic-engine';

export async function fetchAcademicEngineSummary(): Promise<AcademicEngineSummary> {
  const { data } = await api.get('/v1/academic-engine/summary');
  return data;
}

export async function fetchProgramStructure(programVersionId: string) {
  const { data } = await api.get(`/v1/academic-engine/programs/${programVersionId}/structure`);
  return data as {
    template: import('@/types/academic-engine').ProgramStructureTemplateInfo | null;
    rules: SemesterStructureRule[];
  };
}

export async function upsertProgramStructure(
  programVersionId: string,
  payload: {
    streamId?: string;
    semesterRules?: {
      semesterSequence: number;
      categoryCounts: Record<string, number>;
      continuityRules: Record<string, string>;
      categoryMeta?: Record<
        string,
        { creditRule?: number; mandatory?: boolean; optional?: boolean }
      >;
      semesterCreditTarget?: number;
    }[];
    degreeMinCredits?: number;
    semesterCreditTarget?: number;
  },
) {
  const { data } = await api.put(
    `/v1/academic-engine/programs/${programVersionId}/structure`,
    payload,
  );
  return data;
}

export async function loadNehuFyugpDefaults(programVersionId: string) {
  const { data } = await api.post(
    `/v1/academic-engine/programs/${programVersionId}/structure/load-nehu-defaults`,
  );
  return data;
}

export async function cloneProgramStructure(sourceVersionId: string, targetVersionId: string) {
  const { data } = await api.post(
    `/v1/academic-engine/programs/${targetVersionId}/structure/clone-from/${sourceVersionId}`,
  );
  return data;
}

export async function applyTemplateToVersion(
  programVersionId: string,
  templateId: string,
  conflictStrategy: 'REPLACE_ALL' | 'SKIP_EXISTING' = 'REPLACE_ALL',
) {
  const { data } = await api.post(
    `/v1/academic-engine/programs/${programVersionId}/structure/apply-template/${templateId}`,
    { conflictStrategy },
  );
  return data;
}

export async function fetchFyugpTemplates(includeInactive = false) {
  const { data } = await api.get('/v1/academic-engine/fyugp-templates', {
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  });
  return data as import('@/types/academic-engine').FyugpStructureTemplate[];
}

export async function fetchFyugpTemplate(templateId: string) {
  const { data } = await api.get(`/v1/academic-engine/fyugp-templates/${templateId}`);
  return data as import('@/types/academic-engine').FyugpStructureTemplate;
}

export async function createFyugpTemplate(payload: {
  templateName: string;
  regulationYear: number;
  programmeLevel: 'UG' | 'PG';
  totalSemesters?: number;
  active?: boolean;
  lines: import('@/types/academic-engine').FyugpStructureTemplateLine[];
}) {
  const { data } = await api.post('/v1/academic-engine/fyugp-templates', payload);
  return data;
}

export async function updateFyugpTemplate(
  templateId: string,
  payload: Partial<{
    templateName: string;
    regulationYear: number;
    programmeLevel: 'UG' | 'PG';
    totalSemesters: number;
    active: boolean;
    lines: import('@/types/academic-engine').FyugpStructureTemplateLine[];
  }>,
) {
  const { data } = await api.put(`/v1/academic-engine/fyugp-templates/${templateId}`, payload);
  return data;
}

export async function createFyugpTemplateFromNehuDefaults() {
  const { data } = await api.post('/v1/academic-engine/fyugp-templates/from-nehu-defaults');
  return data;
}

export async function previewApplyFyugpTemplate(
  templateId: string,
  payload: import('@/types/academic-engine').ApplyFyugpTemplatePayload,
) {
  const { data } = await api.post(
    `/v1/academic-engine/fyugp-templates/${templateId}/preview-apply`,
    payload,
  );
  return data as import('@/types/academic-engine').ApplyPreviewResult;
}

export async function applyFyugpTemplate(
  templateId: string,
  payload: import('@/types/academic-engine').ApplyFyugpTemplatePayload,
) {
  const { data } = await api.post(
    `/v1/academic-engine/fyugp-templates/${templateId}/apply`,
    payload,
  );
  return data as { applied: number; skipped: number; total: number; templateName: string };
}

export async function fetchNepOfferings(params?: {
  programVersionId?: string;
  semesterSequence?: number;
  category?: string;
}): Promise<CourseOfferingRow[]> {
  const { data } = await api.get('/v1/academic-engine/offerings', { params });
  return data;
}

export async function updateOfferingCapacity(
  offeringId: string,
  payload: { capacity?: number; waitlistCapacity?: number },
) {
  const { data } = await api.patch(`/v1/programs-courses/offerings/${offeringId}`, payload);
  return data;
}

export async function createAcademicEngineOfferingSection(
  offeringId: string,
  payload: {
    shiftId: string;
    sectionCode?: string;
    capacity?: number;
    waitlistCapacity?: number;
  },
) {
  const { data } = await api.post(`/v1/academic-engine/offerings/${offeringId}/sections`, payload);
  return data;
}

export async function provisionPoolSections(payload?: {
  semesterNo?: number;
  categories?: string[];
  shiftCode?: string;
  shiftId?: string;
  institutionId?: string;
  poolId?: string;
}) {
  const { data } = await api.post(
    '/v1/academic-engine/category-pools/provision-sections',
    payload ?? {},
  );
  return data as {
    created: number;
    skipped: number;
    total: number;
    shiftCode: string;
    details: Array<{ offeringId: string; courseCode: string; created: boolean }>;
  };
}

export async function fetchRegistrationWindows(): Promise<RegistrationWindow[]> {
  const { data } = await api.get('/v1/academic-engine/registration-windows');
  return data;
}

export async function createRegistrationWindow(payload: {
  semesterId: string;
  name: string;
  opensAt: string;
  closesAt: string;
}) {
  const { data } = await api.post('/v1/academic-engine/registration-windows', payload);
  return data;
}

export async function setWindowLocked(windowId: string, locked: boolean) {
  const { data } = await api.patch(`/v1/academic-engine/registration-windows/${windowId}/lock`, {
    locked,
  });
  return data;
}

export async function fetchMyRegistrationWorkflow() {
  const { data } = await api.get('/v1/academic-engine/registrations/me/workflow');
  return data as {
    mode: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID';
    allowStudentSelfService: boolean;
    studentElectiveCategories: string[];
    batchRegistrationMode?: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID' | null;
  };
}

export async function fetchMyRegistration(semesterId?: string) {
  const { data } = await api.get('/v1/academic-engine/registrations/me', {
    params: semesterId ? { semesterId } : undefined,
  });
  return data as {
    student: { id: string; programVersionId: string | null };
    registration: SemesterRegistration | null;
    standing?: { currentSemesterSequence?: number; registrationLocked?: boolean };
    majorMinorTrack?: {
      isTrackLocked: boolean;
      lockedAtSemester: number | null;
      majorSubject?: { slug: string; name: string };
      minorSubject?: { slug: string; name: string } | null;
    } | null;
    vtcTrack?: {
      trackGroupCode: string;
      selectedSem3Offering?: { id: string; course?: { code: string; title: string } };
    } | null;
    canChangeMajorMinor?: boolean;
    class12Subjects?: { name: string; code?: string }[];
  };
}

export async function unlockMajorMinorTrack(studentId: string, reason: string) {
  const { data } = await api.post(
    `/v1/academic-engine/students/${studentId}/major-minor-track/unlock`,
    { reason },
  );
  return data;
}

export async function resetVtcTrack(
  studentId: string,
  payload: { reason: string; trackGroupCode?: string; sem3OfferingId?: string },
) {
  const { data } = await api.post(
    `/v1/academic-engine/students/${studentId}/vtc-track/reset`,
    payload,
  );
  return data;
}

export async function createMyRegistration(payload: {
  semesterId: string;
  semesterSequence: number;
}) {
  const { data } = await api.post('/v1/academic-engine/registrations/me', payload);
  return data as SemesterRegistration;
}

export async function fetchShifts(): Promise<AcademicShift[]> {
  const { data } = await api.get('/v1/academic-engine/shifts');
  return data;
}

export async function fetchCatalog(params: {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  category?: string;
  studentId?: string;
  streamId?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  class12Subjects?: string;
  includeIneligible?: boolean;
}): Promise<CatalogSectionRow[] | CatalogWithEligibility> {
  const { data } = await api.get('/v1/academic-engine/offerings/catalog', {
    params: {
      ...params,
      includeIneligible: params.includeIneligible ? 'true' : undefined,
    },
  });
  return data;
}

export async function fetchEligibleMajors(params: {
  programVersionId: string;
  semesterSequence?: number;
  shiftId?: string;
}): Promise<import('@/types/academic-engine').SubjectPathOption[]> {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${params.programVersionId}/eligible-majors`,
    {
      params: {
        semesterSequence: params.semesterSequence ?? 1,
        shiftId: params.shiftId,
      },
    },
  );
  return data;
}

export async function fetchEligibleMinors(params: {
  programVersionId: string;
  majorSubjectSlug: string;
  semesterSequence?: number;
  academicYearId?: string;
  shiftId?: string;
}): Promise<import('@/types/academic-engine').SubjectPathOption[]> {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${params.programVersionId}/eligible-minors`,
    {
      params: {
        majorSubjectSlug: params.majorSubjectSlug,
        semesterSequence: params.semesterSequence ?? 1,
        academicYearId: params.academicYearId,
        shiftId: params.shiftId,
      },
    },
  );
  return data;
}

export type ShiftAdmissionContext = {
  shift: { id: string; code: string; name: string };
  programVersionId: string | null;
  semesterSequence: number;
  allowedProgramIds: string[];
  allowedProgramVersionIds: string[];
  allowedDepartmentIds: string[];
  autoAssignCategories: string[];
  poolCoursesByCategory: Record<string, { id: string; code: string; title: string }[]>;
};

export type ShiftProgrammeRow = {
  programId: string;
  code: string;
  name: string;
  enabled: boolean;
  publishedVersionIds: string[];
};

export type ShiftDepartmentRow = {
  departmentId: string;
  code: string;
  name: string;
  enabled: boolean;
};

export async function fetchShiftAdmissionContext(params: {
  shiftId: string;
  programVersionId?: string;
  semesterSequence?: number;
  institutionId?: string;
}): Promise<ShiftAdmissionContext> {
  const { data } = await api.get(`/v1/academic-engine/shifts/${params.shiftId}/admission-context`, {
    params: {
      programVersionId: params.programVersionId,
      semesterSequence: params.semesterSequence ?? 1,
      institutionId: params.institutionId,
    },
  });
  return data;
}

export async function fetchShiftProgrammes(
  shiftId: string,
  institutionId?: string,
): Promise<ShiftProgrammeRow[]> {
  const { data } = await api.get(`/v1/academic-engine/shifts/${shiftId}/programmes`, {
    params: institutionId ? { institutionId } : undefined,
  });
  return data;
}

export async function fetchShiftDepartments(
  shiftId: string,
  institutionId?: string,
): Promise<ShiftDepartmentRow[]> {
  const { data } = await api.get(`/v1/academic-engine/shifts/${shiftId}/departments`, {
    params: institutionId ? { institutionId } : undefined,
  });
  return data;
}

export type CurriculumConfigurationStatusRow = {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  programmeFamily: 'BA' | 'BSC' | 'BCOM';
  programmeLabel: string;
  programmeCount: number;
  semesters: Record<number, 'complete' | 'pending' | 'na'>;
};

export type CurriculumManagerCourseRow = {
  courseId: string;
  code: string;
  title: string;
  displayOrder: number;
  eligibilityRules: import('@/types/course-eligibility').CourseEligibilityRules;
  eligibilitySummary: string;
};

export type CurriculumManagerCategoryBlock = {
  categoryType: string;
  requiredCount: number;
  mandatory: boolean;
  autoAssign: boolean;
  continuityRule: string | null;
  pool: {
    id: string;
    poolName: string;
    shiftId: string | null;
    assigned: boolean;
  } | null;
  courses: CurriculumManagerCourseRow[];
  availablePools: Array<{
    id: string;
    poolName: string;
    courseCount: number;
    assigned: boolean;
    shiftId: string | null;
  }>;
};

export type CurriculumManagerView = {
  shift: { id: string; code: string; name: string };
  programVersion: { id: string; code: string; name: string; version: number };
  semesterNo: number;
  curriculumMode: 'shift-pools' | 'direct-offerings';
  shiftIndependent: boolean;
  semesterSummary: string;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categories: CurriculumManagerCategoryBlock[];
  majorDepartments: Array<{
    departmentName: string;
    papers: Array<{ code: string; title: string; offeringId: string }>;
    internship?: { code: string; title: string; offeringId: string } | null;
  }>;
  minorDepartments: Array<{
    departmentName: string;
    paper: { code: string; title: string; offeringId: string };
  }>;
  minorEnabled: boolean;
  configurationStatus: 'complete' | 'partial' | 'empty';
  missingCategories: string[];
};

export async function fetchCurriculumManagerView(params: {
  shiftId: string;
  programVersionId: string;
  semesterNo: number;
  institutionId?: string;
}) {
  const { data } = await api.get(
    `/v1/academic-engine/shifts/${params.shiftId}/curriculum-manager`,
    {
      params: {
        programVersionId: params.programVersionId,
        semesterNo: params.semesterNo,
        institutionId: params.institutionId,
      },
    },
  );
  return data as CurriculumManagerView;
}

export async function assignCurriculumManagerPool(
  shiftId: string,
  payload: { programVersionId: string; semesterNo: number; poolId: string },
) {
  const { data } = await api.put(
    `/v1/academic-engine/shifts/${shiftId}/curriculum-manager/pool-assignment`,
    payload,
  );
  return data as CurriculumManagerView;
}

export async function upsertShiftCurriculumPolicy(
  shiftId: string,
  payload: {
    programVersionId?: string | null;
    semesterNo: number;
    categoryType: string;
    autoAssign: boolean;
  },
) {
  const { data } = await api.put(
    `/v1/academic-engine/shifts/${shiftId}/curriculum-policies`,
    payload,
  );
  return data;
}

export async function fetchCurriculumConfigurationStatus(institutionId?: string) {
  const { data } = await api.get('/v1/academic-engine/shifts/curriculum-configuration-status', {
    params: institutionId ? { institutionId } : undefined,
  });
  return data as {
    shifts: { id: string; code: string; name: string }[];
    rows: CurriculumConfigurationStatusRow[];
  };
}

export async function upsertShiftProgrammes(
  shiftId: string,
  items: { programId: string; enabled: boolean }[],
) {
  const { data } = await api.put(`/v1/academic-engine/shifts/${shiftId}/programmes`, {
    items,
  });
  return data as ShiftProgrammeRow[];
}

export async function upsertShiftDepartments(
  shiftId: string,
  items: { departmentId: string; enabled: boolean }[],
) {
  const { data } = await api.put(`/v1/academic-engine/shifts/${shiftId}/departments`, {
    items,
  });
  return data as ShiftDepartmentRow[];
}

export async function fetchMajorMinorMatrix() {
  const { data } = await api.get('/v1/academic-engine/fyugp/major-minor-matrix');
  return data as Record<string, string[]>;
}

export async function fetchMajorMinorRules(params?: {
  institutionId?: string;
  shiftId?: string;
  majorSubjectId?: string;
}) {
  const { data } = await api.get('/v1/academic-engine/fyugp/major-minor-rules', {
    params,
  });
  return data as MajorMinorRuleRow[];
}

export type MajorMinorRuleRow = {
  id: string;
  majorSubjectId: string;
  allowedMinorSubjectId: string;
  shiftId: string | null;
  academicYearId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  majorSubject: {
    id: string;
    name: string;
    slug: string;
    department?: { id: string; name: string; code: string } | null;
  };
  allowedMinorSubject: {
    id: string;
    name: string;
    slug: string;
    department?: { id: string; name: string; code: string } | null;
  };
  shift?: { id: string; code: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
};

export async function syncMajorMinorRules(body: {
  majorSubjectId: string;
  allowedMinorSubjectIds: string[];
  shiftId?: string | null;
  academicYearId?: string | null;
  isActive?: boolean;
}) {
  const { data } = await api.put('/v1/academic-engine/fyugp/major-minor-rules', body);
  return data as MajorMinorRuleRow[];
}

export async function setMajorMinorRuleActive(ruleId: string, isActive: boolean) {
  const { data } = await api.patch(`/v1/academic-engine/fyugp/major-minor-rules/${ruleId}`, {
    isActive,
  });
  return data as MajorMinorRuleRow;
}

export async function fetchAcademicSubjects(institutionId?: string) {
  const { data } = await api.get('/v1/academic-engine/academic-subjects', {
    params: institutionId ? { institutionId } : undefined,
  });
  return data as import('@/types/course-eligibility').AcademicSubjectOption[];
}

export async function validateMyRegistration(registrationId: string) {
  const { data } = await api.post(
    `/v1/academic-engine/registrations/me/${registrationId}/validate`,
  );
  return data as {
    ok: boolean;
    issues: { code: string; message: string }[];
    creditSummary: {
      draftTotal: number;
      draftByCategory: Record<string, number>;
      confirmed: { total: number; byCategory: Record<string, number> };
    };
  };
}

export async function fetchMyCreditSummary() {
  const { data } = await api.get('/v1/academic-engine/registrations/me/credit-summary');
  return data as { total: number; byCategory: Record<string, number> };
}

export async function updateMyRegistrationLines(
  registrationId: string,
  lines: { category: string; offeringId?: string; offeringSectionId?: string }[],
) {
  const { data } = await api.patch(`/v1/academic-engine/registrations/me/${registrationId}/lines`, {
    lines,
  });
  return data as SemesterRegistration;
}

export async function submitMyRegistration(registrationId: string) {
  const { data } = await api.post(`/v1/academic-engine/registrations/me/${registrationId}/submit`);
  return data as SemesterRegistration;
}

export async function fetchRegistrationAnalytics(programVersionId?: string) {
  const { data } = await api.get('/v1/academic-engine/reports/registration-analytics', {
    params: programVersionId ? { programVersionId } : undefined,
  });
  return data;
}

export async function fetchSeatUtilization(
  programVersionId?: string,
): Promise<SeatUtilizationRow[]> {
  const { data } = await api.get('/v1/academic-engine/reports/seat-utilization', {
    params: programVersionId ? { programVersionId } : undefined,
  });
  return data;
}

export async function fetchMdcConflicts() {
  const { data } = await api.get('/v1/academic-engine/reports/mdc-conflicts');
  return data as { total: number; conflicts: unknown[] };
}

export async function promoteWaitlist(lineId: string) {
  const { data } = await api.post(`/v1/academic-engine/waitlist/${lineId}/promote`);
  return data;
}

export async function fetchAcademicStreams(): Promise<AcademicStream[]> {
  const { data } = await api.get('/v1/academic-engine/streams');
  return data;
}

export async function fetchStudentAcademicProfile(studentId: string) {
  const { data } = await api.get(`/v1/academic-engine/students/${studentId}/profile`);
  return data as {
    profile: StudentAcademicProfile | null;
    choices: StudentProgramChoice[];
  };
}

export async function upsertStudentAcademicProfile(
  studentId: string,
  payload: {
    streamId?: string;
    admissionYearId?: string;
    class12Subjects?: { name: string; code?: string; marks?: number }[];
    languagePreferences?: Record<string, unknown>;
    languageEligibility?: Record<string, unknown>;
  },
) {
  const { data } = await api.put(`/v1/academic-engine/students/${studentId}/profile`, payload);
  return data as StudentAcademicProfile;
}

export async function setStudentProgramChoice(
  studentId: string,
  payload: {
    choiceType: 'MAJOR' | 'MINOR';
    subjectSlug: string;
    departmentId?: string;
    effectiveFromSemester?: number;
  },
) {
  const { data } = await api.post(`/v1/academic-engine/students/${studentId}/choices`, payload);
  return data as StudentProgramChoice;
}

export async function fetchCategoryPools(params?: {
  institutionId?: string;
  categoryType?: string;
  semesterNo?: number;
  includeInactive?: boolean;
}) {
  const { data } = await api.get('/v1/academic-engine/category-pools', {
    params: {
      ...params,
      includeInactive: params?.includeInactive ? 'true' : undefined,
    },
  });
  return data as import('@/types/academic-engine').CategoryPool[];
}

export async function fetchCategoryPool(poolId: string) {
  const { data } = await api.get(`/v1/academic-engine/category-pools/${poolId}`);
  return data as import('@/types/academic-engine').CategoryPoolDetail;
}

export async function createCategoryPool(payload: {
  poolName: string;
  institutionId: string;
  semesterNo: number;
  categoryType: string;
  active?: boolean;
}) {
  const { data } = await api.post('/v1/academic-engine/category-pools', payload);
  return data;
}

export async function updateCategoryPool(
  poolId: string,
  payload: Partial<{
    poolName: string;
    semesterNo: number;
    categoryType: string;
    active: boolean;
  }>,
) {
  const { data } = await api.put(`/v1/academic-engine/category-pools/${poolId}`, payload);
  return data;
}

export async function deleteCategoryPool(poolId: string) {
  const { data } = await api.delete(`/v1/academic-engine/category-pools/${poolId}`);
  return data;
}

export async function addPoolCourse(
  poolId: string,
  payload: { courseId: string; displayOrder?: number; active?: boolean },
) {
  const { data } = await api.post(`/v1/academic-engine/category-pools/${poolId}/courses`, payload);
  return data;
}

export async function removePoolCourse(poolId: string, courseId: string) {
  const { data } = await api.delete(`/v1/academic-engine/category-pools/${poolId}/courses`, {
    data: { courseId },
  });
  return data;
}

export async function previewAssignCategoryPool(
  poolId: string,
  payload: import('@/types/academic-engine').AssignPoolPayload,
) {
  const { data } = await api.post(
    `/v1/academic-engine/category-pools/${poolId}/preview-assign`,
    payload,
  );
  return data as import('@/types/academic-engine').PoolAssignPreviewResult;
}

export async function assignCategoryPool(
  poolId: string,
  payload: import('@/types/academic-engine').AssignPoolPayload,
) {
  const { data } = await api.post(`/v1/academic-engine/category-pools/${poolId}/assign`, payload);
  return data;
}

export async function fetchProgramPoolAssignments(programVersionId: string) {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${programVersionId}/pool-assignments`,
  );
  return data as import('@/types/academic-engine').ProgrammePoolAssignment[];
}

export async function upsertProgramPoolAssignments(
  programVersionId: string,
  assignments: Array<{ semesterNo: number; poolId: string; active: boolean }>,
) {
  const { data } = await api.put(
    `/v1/academic-engine/programs/${programVersionId}/pool-assignments`,
    { assignments },
  );
  return data;
}

export async function fetchProgramPoolExclusions(programVersionId: string) {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${programVersionId}/pool-exclusions`,
  );
  return data as import('@/types/academic-engine').ProgrammePoolExclusion[];
}

export async function upsertProgramPoolExclusion(
  programVersionId: string,
  payload: { poolId: string; courseId: string; active: boolean },
) {
  const { data } = await api.post(
    `/v1/academic-engine/programs/${programVersionId}/pool-exclusions`,
    payload,
  );
  return data;
}

export async function fetchCurriculumCoverage(programVersionId: string, semesterSequence?: number) {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${programVersionId}/curriculum-coverage`,
    { params: semesterSequence ? { semesterSequence } : undefined },
  );
  return data;
}

export async function fetchSemesterRules(params: {
  programVersionId: string;
  semester: number;
  honoursTrack?: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
  studentId?: string;
}) {
  const { data } = await api.get(`/v1/fyugp/semester-rules/${params.semester}`, {
    params: {
      programVersionId: params.programVersionId,
      honoursTrack: params.honoursTrack,
      studentId: params.studentId,
    },
  });
  return data as SemesterStructureRule & { summary: string };
}

export async function validateFyugpRegistration(payload: {
  registrationId?: string;
  programVersionId?: string;
  semesterSequence?: number;
  shiftId?: string;
  streamId?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  honoursTrack?: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
  selections?: Record<string, string>;
}) {
  const { data } = await api.post('/v1/fyugp/validate-registration', payload);
  return data;
}

export async function generateFyugpRegistration(payload: {
  studentId: string;
  programVersionId: string;
  semesterSequence: number;
  registrationId?: string;
  shiftId?: string;
  streamId?: string;
  subjectSelections?: Record<string, string>;
  persist?: boolean;
}) {
  const { data } = await api.post('/v1/fyugp/generate-registration', payload);
  return data;
}

export async function fetchEligibleFyugpSubjects(params: {
  programVersionId: string;
  semester: number;
  category: string;
  majorSubjectSlug?: string;
}) {
  const { data } = await api.get('/v1/fyugp/eligible-subjects', { params });
  return data;
}

export async function fetchStudentAcademicTrack(studentId: string, effectiveFromSemester = 8) {
  const { data } = await api.get(`/v1/fyugp/students/${studentId}/academic-track`, {
    params: { effectiveFromSemester },
  });
  return data as {
    track: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
    aggregatePercentageThroughSem6: number | null;
    researchEligibilityPercent?: number;
    eligibility: {
      warning: string | null;
      blockReason?: string | null;
      eligible: boolean;
      requiresOverride?: boolean;
    };
  };
}

export async function setStudentAcademicTrack(
  studentId: string,
  payload: {
    track: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
    effectiveFromSemester?: number;
    eligibilityOverride?: boolean;
    eligibilityOverrideReason?: string;
    aggregatePercentageAtSelection?: number;
  },
) {
  const { data } = await api.put(`/v1/fyugp/students/${studentId}/academic-track`, payload);
  return data;
}

export async function updateAggregateThroughSem6(
  studentId: string,
  aggregatePercentageThroughSem6: number,
) {
  const { data } = await api.put(`/v1/fyugp/students/${studentId}/aggregate-through-sem6`, {
    aggregatePercentageThroughSem6,
  });
  return data;
}

export async function fetchCurriculumCompletionSummary(
  params: CompletionQueryParams,
): Promise<CompletionSummary> {
  const { data } = await api.get('/v1/academic-engine/curriculum-completion/summary', {
    params,
  });
  return data;
}

export async function fetchCurriculumCompletionMatrix(params: CompletionQueryParams): Promise<{
  programmes: CompletionProgramme[];
}> {
  const { data } = await api.get('/v1/academic-engine/curriculum-completion/matrix', {
    params,
  });
  return data;
}

export async function fetchCurriculumCompletionMissingItems(
  params: CompletionQueryParams & { category?: string; issueType?: string },
): Promise<Paginated<CompletionMissingItem>> {
  const { data } = await api.get('/v1/academic-engine/curriculum-completion/missing-items', {
    params,
  });
  return data;
}

export async function fetchSharedPoolsAudit(
  params: CompletionQueryParams,
): Promise<SharedPoolAuditRow[]> {
  const { data } = await api.get('/v1/academic-engine/curriculum-completion/shared-pools-audit', {
    params,
  });
  return data;
}

export async function exportCurriculumCompletion(
  params: {
    format: 'csv' | 'xlsx';
    reportType: 'audit' | 'missing-setup' | 'nep-compliance';
  } & CompletionQueryParams,
): Promise<Blob> {
  const { data } = await api.get('/v1/academic-engine/curriculum-completion/export', {
    params,
    responseType: 'blob',
  });
  return data;
}
