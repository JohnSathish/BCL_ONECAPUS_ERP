import { api } from '@/services/api';

export type SubjectSectionDashboard = {
  totalSubjects: number;
  subjectsWithMultipleSections: number;
  totalSections: number;
  studentsAllocated: number;
  pendingAllocation: number;
};

export type SubjectSectionRow = {
  id: string;
  sectionCode: string;
  shift: { id: string; code: string; name: string };
  capacity: number;
  waitlistCapacity: number;
  allocated: number;
  waitlisted: number;
  vacancy: number;
  isFull: boolean;
  faculty: { id: string; fullName: string; employeeCode: string } | null;
  classroom: {
    id: string;
    name: string;
    code: string;
    capacity: number | null;
  } | null;
};

export type SubjectWithSections = {
  id: string;
  category: string;
  semesterSequence: number;
  mappingSource: string;
  poolName: string | null;
  course: { id: string; code: string; title: string };
  sectionCount: number;
  totalAllocated: number;
  sections: SubjectSectionRow[];
};

export type SectionAllocationStrategy = 'EQUAL' | 'ROLL_NUMBER' | 'ALPHABET' | 'GENDER' | 'RANDOM';

export async function fetchSubjectSectionDashboard(params?: {
  semesterNo?: number;
  category?: string;
}) {
  const { data } = await api.get<SubjectSectionDashboard>(
    '/v1/academic-engine/subject-sections/dashboard',
    { params },
  );
  return data;
}

export async function fetchSubjectsWithSections(params?: {
  semesterNo?: number;
  category?: string;
  search?: string;
}) {
  const { data } = await api.get<SubjectWithSections[]>(
    '/v1/academic-engine/subject-sections/subjects',
    { params },
  );
  return data;
}

export async function bulkProvisionSubjectSections(payload: {
  semesterNo?: number;
  categories?: string[];
  offeringIds?: string[];
  sectionCodes: string[];
  capacityPerSection?: number;
  shiftCode?: string;
}) {
  const { data } = await api.post('/v1/academic-engine/subject-sections/bulk-provision', payload);
  return data as { created: number; skipped: number; total: number };
}

export async function createSubjectSection(payload: {
  offeringId: string;
  shiftId: string;
  sectionCode: string;
  capacity?: number;
  facultyId?: string;
  classroomId?: string;
}) {
  const { data } = await api.post('/v1/academic-engine/subject-sections/sections', payload);
  return data;
}

export async function updateSubjectSection(
  sectionId: string,
  payload: {
    capacity?: number;
    facultyId?: string | null;
    classroomId?: string | null;
  },
) {
  const { data } = await api.patch(
    `/v1/academic-engine/subject-sections/sections/${sectionId}`,
    payload,
  );
  return data;
}

export async function autoDivideSubjectSections(payload: {
  offeringId: string;
  shiftId?: string;
  strategy: SectionAllocationStrategy;
  semesterId?: string;
  programVersionId?: string;
  admissionBatchId?: string;
  dryRun?: boolean;
}) {
  const { data } = await api.post('/v1/academic-engine/subject-sections/auto-divide', payload);
  return data as {
    assigned: number;
    sections: number;
    strategy: string;
    preview: Array<{
      lineId: string;
      rollNumber: string;
      fullName: string;
      fromSection: string | null;
      toSection: string;
    }>;
  };
}

export async function moveStudentSection(payload: { lineId: string; targetSectionId: string }) {
  const { data } = await api.post('/v1/academic-engine/subject-sections/move-student', payload);
  return data;
}

export async function importSectionAllocations(payload: {
  offeringId: string;
  shiftId?: string;
  rows: Array<{ rollNumber: string; sectionCode: string }>;
}) {
  const { data } = await api.post(
    '/v1/academic-engine/subject-sections/import-allocations',
    payload,
  );
  return data as {
    imported: number;
    failed: number;
    results: Array<{ rollNumber: string; sectionCode: string; ok: boolean; error?: string }>;
  };
}

export async function fetchSectionStudents(sectionId: string) {
  const { data } = await api.get(
    `/v1/academic-engine/subject-sections/sections/${sectionId}/students`,
  );
  return data as {
    section: {
      id: string;
      sectionCode: string;
      course: { code: string; title: string };
      category: string;
    };
    students: Array<{
      lineId: string;
      status: string;
      student: {
        id: string;
        rollNumber: string;
        fullName: string;
        department?: { name: string; code: string } | null;
      };
    }>;
  };
}
