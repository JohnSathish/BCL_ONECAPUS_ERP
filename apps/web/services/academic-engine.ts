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
}): Promise<import('@/types/academic-engine').SubjectPathOption[]> {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${params.programVersionId}/eligible-majors`,
    { params: { semesterSequence: params.semesterSequence ?? 1 } },
  );
  return data;
}

export async function fetchEligibleMinors(params: {
  programVersionId: string;
  majorSubjectSlug: string;
  semesterSequence?: number;
  academicYearId?: string;
}): Promise<import('@/types/academic-engine').SubjectPathOption[]> {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${params.programVersionId}/eligible-minors`,
    {
      params: {
        majorSubjectSlug: params.majorSubjectSlug,
        semesterSequence: params.semesterSequence ?? 1,
        academicYearId: params.academicYearId,
      },
    },
  );
  return data;
}

export async function fetchMajorMinorRules(institutionId?: string) {
  const { data } = await api.get('/v1/academic-engine/fyugp/major-minor-rules', {
    params: institutionId ? { institutionId } : undefined,
  });
  return data;
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
    eligibility: {
      warning: string | null;
      eligible: boolean;
    };
  };
}

export async function setStudentAcademicTrack(
  studentId: string,
  payload: {
    track: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
    effectiveFromSemester?: number;
    eligibilityOverride?: boolean;
    aggregatePercentageAtSelection?: number;
  },
) {
  const { data } = await api.put(`/v1/fyugp/students/${studentId}/academic-track`, payload);
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
