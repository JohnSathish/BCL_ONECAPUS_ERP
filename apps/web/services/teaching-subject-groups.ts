import { api } from '@/services/api';

export type TeachingSubjectGroupPaper = {
  id: string;
  courseId: string;
  paperIndex?: number | null;
  offeringSectionId?: string | null;
  course?: { id: string; code: string; title: string; subjectSlug?: string | null };
  offeringSection?: { id: string; sectionCode: string } | null;
};

export type TeachingSubjectGroup = {
  id: string;
  code: string;
  title: string;
  semesterNo: number;
  fyugpCategory: string;
  status: string;
  academicSubjectId?: string | null;
  academicYearId?: string | null;
  shiftId?: string | null;
  departmentId?: string | null;
  primaryStaffProfileId?: string | null;
  offeringSectionId?: string | null;
  academicSubject?: { id: string; slug: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  primaryStaffProfile?: {
    id: string;
    fullName: string;
    shortCode?: string | null;
    employeeCode: string;
  } | null;
  offeringSection?: { id: string; sectionCode: string } | null;
  papers?: TeachingSubjectGroupPaper[];
};

export async function fetchTeachingSubjectGroups(params?: {
  semesterNo?: number;
  shiftId?: string;
  academicYearId?: string;
  fyugpCategory?: string;
  academicSubjectId?: string;
}) {
  const { data } = await api.get<TeachingSubjectGroup[]>('/v1/timetable/teaching-subject-groups', {
    params,
  });
  return data;
}

export async function createTeachingSubjectGroup(payload: {
  code: string;
  title: string;
  semesterNo: number;
  fyugpCategory: string;
  academicSubjectId?: string;
  academicYearId?: string;
  shiftId?: string;
  departmentId?: string;
  primaryStaffProfileId?: string;
  offeringSectionId?: string;
  courseIds?: string[];
}) {
  const { data } = await api.post<TeachingSubjectGroup>(
    '/v1/timetable/teaching-subject-groups',
    payload,
  );
  return data;
}

export async function updateTeachingSubjectGroup(
  id: string,
  payload: Partial<{
    code: string;
    title: string;
    semesterNo: number;
    fyugpCategory: string;
    academicSubjectId: string;
    academicYearId: string;
    shiftId: string;
    departmentId: string;
    primaryStaffProfileId: string;
    offeringSectionId: string;
    status: string;
  }>,
) {
  const { data } = await api.patch<TeachingSubjectGroup>(
    `/v1/timetable/teaching-subject-groups/${id}`,
    payload,
  );
  return data;
}

export async function deleteTeachingSubjectGroup(id: string) {
  const { data } = await api.patch(`/v1/timetable/teaching-subject-groups/${id}/delete`);
  return data;
}

export async function syncTeachingSubjectGroups(payload: {
  semesterNo: number;
  academicYearId?: string;
  shiftId?: string;
  fyugpCategory?: string;
}) {
  const { data } = await api.post<{ created: number; updated: number; buckets: number }>(
    '/v1/timetable/teaching-subject-groups/sync-from-semester',
    payload,
  );
  return data;
}

export async function linkTeachingSubjectGroupPaper(
  groupId: string,
  payload: { courseId: string; paperIndex?: number; offeringSectionId?: string },
) {
  const { data } = await api.post<TeachingSubjectGroup>(
    `/v1/timetable/teaching-subject-groups/${groupId}/papers`,
    payload,
  );
  return data;
}
