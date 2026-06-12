import { api } from '@/services/api';
import type {
  CatalogSummary,
  Course,
  CourseImportPreview,
  CourseListParams,
  CourseOffering,
  ImportBatch,
  Paginated,
  Program,
  ProgramVersionDetail,
} from '@/types/programs';
import type { CurriculumOfferingQuery, CurriculumOfferingRow } from '@/types/curriculum-filters';
import { downloadBlob } from '@/utils/download-blob';

export async function fetchCatalogSummary(): Promise<CatalogSummary> {
  const { data } = await api.get('/v1/programs-courses/catalog-summary');
  return data;
}

export async function fetchPrograms(page = 1, search?: string): Promise<Paginated<Program>> {
  const { data } = await api.get('/v1/programs-courses/programs', {
    params: { page, limit: 50, search: search || undefined },
  });
  return data;
}

export async function fetchAllPrograms(
  search?: string,
): Promise<{ data: Program[]; meta: { total: number } }> {
  const limit = 50;
  let page = 1;
  const all: Program[] = [];
  let total = 0;

  while (true) {
    const res = await fetchPrograms(page, search);
    all.push(...res.data);
    total = res.meta.total;
    if (page >= res.meta.totalPages) break;
    page += 1;
  }

  return { data: all, meta: { total } };
}

export async function fetchProgram(id: string): Promise<Program> {
  const { data } = await api.get(`/v1/programs-courses/programs/${id}`);
  return data;
}

export async function createProgram(payload: {
  code: string;
  name: string;
  departmentId: string;
  level: string;
}) {
  const { data } = await api.post('/v1/programs-courses/programs', payload);
  return data as Program;
}

export async function updateProgram(
  id: string,
  payload: Partial<{
    code: string;
    name: string;
    departmentId: string | null;
    level: string;
  }>,
) {
  const { data } = await api.patch(`/v1/programs-courses/programs/${id}`, payload);
  return data as Program;
}

export async function fetchProgramVersions(programId: string): Promise<ProgramVersionDetail[]> {
  const { data } = await api.get(`/v1/programs-courses/programs/${programId}/versions`);
  return data;
}

export async function createProgramVersion(payload: {
  programId: string;
  cbcsEnabled?: boolean;
  sourceVersionId?: string;
}) {
  const { data } = await api.post('/v1/programs-courses/program-versions', payload);
  return data as ProgramVersionDetail;
}

export async function publishProgramVersion(id: string) {
  const { data } = await api.post(`/v1/programs-courses/program-versions/${id}/publish`);
  return data as ProgramVersionDetail;
}

export async function archiveProgramVersion(id: string) {
  const { data } = await api.post(`/v1/programs-courses/program-versions/${id}/archive`);
  return data as ProgramVersionDetail;
}

export async function duplicateProgramVersion(id: string) {
  const { data } = await api.post(`/v1/programs-courses/program-versions/${id}/duplicate`);
  return data as ProgramVersionDetail;
}

export async function deleteProgramVersion(id: string) {
  const { data } = await api.delete(`/v1/programs-courses/program-versions/${id}`);
  return data as { deleted: boolean };
}

export async function purgeProgramVersion(id: string) {
  const { data } = await api.delete(`/v1/programs-courses/program-versions/${id}/purge`);
  return data as { deleted: boolean; purgedCurriculum: boolean };
}

export async function relabelProgramVersion(id: string, version: number) {
  const { data } = await api.patch(`/v1/programs-courses/program-versions/${id}/relabel`, {
    version,
  });
  return data as ProgramVersionDetail;
}

export async function normalizeProgramVersions(payload: {
  programCode: string;
  keepVersionNumber: number;
  removeVersionNumbers?: number[];
}) {
  const { data } = await api.post('/v1/programs-courses/program-versions/normalize', payload);
  return data;
}

export async function deleteProgram(id: string) {
  await api.delete(`/v1/programs-courses/programs/${id}`);
}

export async function fetchCourses(params: CourseListParams = {}): Promise<Paginated<Course>> {
  const {
    page = 1,
    limit = 30,
    search,
    departmentId,
    courseType,
    deliveryType,
    programVersionId,
    semesterSequence,
    category,
  } = params;
  const { data } = await api.get('/v1/programs-courses/courses', {
    params: {
      page,
      limit,
      search: search?.trim() || undefined,
      departmentId: departmentId || undefined,
      courseType: courseType || undefined,
      deliveryType: deliveryType || undefined,
      programVersionId: programVersionId || undefined,
      semesterSequence: semesterSequence ?? undefined,
      category: category || undefined,
    },
  });
  return data;
}

/** Loads every course page for pickers (curriculum mapping). API caps at 100/page. */
export async function fetchAllCourses(
  params: Omit<CourseListParams, 'page' | 'limit'> = {},
): Promise<{ data: Course[]; meta: { total: number } }> {
  const limit = 100;
  let page = 1;
  const all: Course[] = [];
  let total = 0;

  while (true) {
    const res = await fetchCourses({ ...params, page, limit });
    all.push(...res.data);
    total = res.meta.total;
    if (page >= res.meta.totalPages) break;
    page += 1;
  }

  return { data: all, meta: { total } };
}

export async function checkCourseDuplicates(params: {
  code?: string;
  title?: string;
  departmentId?: string;
  excludeCourseId?: string;
}): Promise<{
  codeTaken: boolean;
  titleTakenInDepartment: boolean;
  codeConflict: { code: string; title: string } | null;
  titleConflict: { code: string; title: string; departmentId: string | null } | null;
}> {
  const { data } = await api.get('/v1/programs-courses/courses/duplicate-check', {
    params: {
      code: params.code || undefined,
      title: params.title || undefined,
      departmentId: params.departmentId || undefined,
      excludeCourseId: params.excludeCourseId || undefined,
    },
  });
  return data;
}

export async function createCourse(payload: {
  code: string;
  title: string;
  credits: number;
  courseType: string;
  deliveryType?: string;
  creditCalculationMode?: string;
  theoryCredits?: number;
  practicalCredits?: number;
  theoryHoursPerWeek?: number;
  practicalHoursPerWeek?: number;
  totalTheoryContactHours?: number;
  totalPracticalContactHours?: number;
  totalContactHours?: number;
  attendanceMode?: string;
  labRequired?: boolean;
  requiresTimetableSlots?: boolean;
  description?: string;
  departmentId?: string;
  subjectSlug?: string;
}) {
  const { data } = await api.post('/v1/programs-courses/courses', payload);
  return data as Course;
}

export async function updateCourse(
  id: string,
  payload: Partial<{
    code: string;
    title: string;
    credits: number;
    courseType: string;
    deliveryType: string;
    creditCalculationMode?: string;
    theoryCredits: number;
    practicalCredits: number;
    theoryHoursPerWeek: number;
    practicalHoursPerWeek: number;
    totalTheoryContactHours: number;
    totalPracticalContactHours: number;
    totalContactHours?: number;
    attendanceMode?: string;
    labRequired?: boolean;
    requiresTimetableSlots?: boolean;
    description: string;
    departmentId: string | null;
    subjectSlug: string;
    status: string;
    syllabusVersion: string;
  }>,
) {
  const { data } = await api.patch(`/v1/programs-courses/courses/${id}`, payload);
  return data as Course;
}

export async function deleteCourse(id: string) {
  await api.delete(`/v1/programs-courses/courses/${id}`);
}

export async function downloadCourseImportTemplate() {
  const { data } = await api.get('/v1/programs-courses/courses/import/template', {
    responseType: 'blob',
  });
  downloadBlob(data as Blob, 'Course_Import_Template.xlsx');
}

export async function validateCourseImport(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CourseImportPreview> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/programs-courses/courses/import/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data as CourseImportPreview;
}

export async function commitCourseImport(batchId: string, mode: 'VALID_ONLY' | 'STRICT') {
  const { data } = await api.post('/v1/programs-courses/courses/import/commit', {
    batchId,
    mode,
  });
  return data as {
    batchId: string;
    status: string;
    async?: boolean;
    successfulRows?: number;
    failedRows?: number;
    message?: string;
  };
}

export async function fetchCourseImportPreview(
  batchId: string,
  page = 1,
): Promise<CourseImportPreview | null> {
  const { data } = await api.get(`/v1/programs-courses/courses/import/batches/${batchId}/preview`, {
    params: { page, limit: 200 },
  });
  return data as CourseImportPreview | null;
}

export async function fetchCourseImportBatches(page = 1): Promise<Paginated<ImportBatch>> {
  const { data } = await api.get('/v1/programs-courses/courses/import/batches', {
    params: { page, limit: 20 },
  });
  return data as Paginated<ImportBatch>;
}

export async function downloadCourseImportErrorReport(batchId: string) {
  const { data } = await api.get(
    `/v1/programs-courses/courses/import/batches/${batchId}/error-report`,
    { responseType: 'blob' },
  );
  downloadBlob(data as Blob, 'Import_Error_Report.xlsx');
}

export async function exportCoursesExcel() {
  const { data } = await api.get('/v1/programs-courses/courses/export', {
    responseType: 'blob',
  });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(data as Blob, `courses_export_${date}.xlsx`);
}

export async function fetchOfferings(programVersionId?: string): Promise<CourseOffering[]> {
  const { data } = await api.get('/v1/programs-courses/offerings', {
    params: programVersionId ? { programVersionId } : undefined,
  });
  return data;
}

export async function fetchCurriculumOfferings(
  params: CurriculumOfferingQuery,
): Promise<Paginated<CurriculumOfferingRow>> {
  const { data } = await api.get('/v1/programs-courses/curriculum-offerings', { params });
  return data;
}

export async function createOffering(payload: {
  programVersionId: string;
  courseId: string;
  semesterId?: string;
  isElective?: boolean;
  category: string;
  semesterSequence?: number;
  displayOrder?: number;
  majorPaperIndex?: number;
  capacity?: number;
  waitlistCapacity?: number;
}) {
  const { data } = await api.post('/v1/programs-courses/offerings', payload);
  return data as CourseOffering;
}

export async function updateOffering(
  id: string,
  payload: Partial<{
    capacity: number;
    waitlistCapacity: number;
    category: string;
    semesterSequence: number;
    displayOrder: number;
    isElective: boolean;
    semesterId: string | null;
    majorPaperIndex: number;
  }>,
) {
  const { data } = await api.patch(`/v1/programs-courses/offerings/${id}`, payload);
  return data as CourseOffering;
}

export async function deleteOffering(id: string) {
  await api.delete(`/v1/programs-courses/offerings/${id}`);
}

export async function createOfferingSection(
  offeringId: string,
  payload: {
    shiftId: string;
    sectionCode?: string;
    studentGroup?: string;
    streamIds?: string[];
    capacity?: number;
    waitlistCapacity?: number;
    facultyId?: string;
    classroomId?: string;
  },
) {
  const { data } = await api.post(`/v1/programs-courses/offerings/${offeringId}/sections`, payload);
  return data;
}

export async function updateOfferingSection(
  sectionId: string,
  payload: Partial<{
    shiftId: string;
    sectionCode: string;
    studentGroup: string;
    streamIds: string[];
    capacity: number;
    waitlistCapacity: number;
    facultyId: string | null;
    classroomId: string | null;
    status: string;
  }>,
) {
  const { data } = await api.patch(`/v1/programs-courses/sections/${sectionId}`, payload);
  return data;
}

export async function deleteOfferingSection(sectionId: string) {
  await api.delete(`/v1/programs-courses/sections/${sectionId}`);
}

export async function fetchCourseEligibility(courseId: string) {
  const { data } = await api.get(`/v1/programs-courses/courses/${courseId}/eligibility`);
  return data as import('@/types/course-eligibility').CourseEligibilityRules;
}

export async function updateCourseEligibility(
  courseId: string,
  eligibilityRules: import('@/types/course-eligibility').CourseEligibilityRules,
) {
  const { data } = await api.put(`/v1/programs-courses/courses/${courseId}/eligibility`, {
    eligibilityRules,
  });
  return data;
}

export async function previewCourseEligibility(
  courseId: string,
  payload: {
    studentId?: string;
    programVersionId?: string;
    streamId?: string;
    streamCode?: string;
    majorSubjectSlug?: string;
    minorSubjectSlug?: string;
    class12Subjects?: { name: string; code?: string; marks?: number }[];
  },
) {
  const { data } = await api.post(
    `/v1/programs-courses/courses/${courseId}/eligibility/preview`,
    payload,
  );
  return data as import('@/types/course-eligibility').CourseEligibilityPreviewResult;
}

export async function fetchCourseEligibilityStats(
  courseId: string,
  payload?: { institutionId?: string; programVersionIds?: string[] },
) {
  const { data } = await api.post(
    `/v1/programs-courses/courses/${courseId}/eligibility/stats`,
    payload ?? {},
  );
  return data as import('@/types/course-eligibility').CourseEligibilityStats;
}
