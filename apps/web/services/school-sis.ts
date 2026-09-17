import { api } from './api';

export type SchoolSisOverview = {
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  counts: {
    students: number;
    staff: number;
    teachingStaff: number;
    nonTeachingStaff: number;
    sections: number;
    enrollments: number;
    grades: number;
    openApplications: number;
    users: number;
    newEnquiries: number;
    eventsUpcoming: number;
  };
  gender: { male: number; female: number; other: number; unspecified: number };
  byClass: Array<{ id: string; name: string; code: string; sortOrder: number; count: number }>;
  recentApplications: Array<{
    id: string;
    applicant: string;
    classLabel: string;
    applicationNumber: string;
    submittedAt: string;
    status: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    category: string;
    publishedAt: string | null;
    featured: boolean;
    slug: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    venue: string | null;
    startsAt: string;
    endsAt: string | null;
    slug: string;
  }>;
  system: {
    status: 'ONLINE' | 'OFFLINE';
    storageConfigured: boolean;
    backupConfigured: boolean;
  };
  modules?: Record<string, boolean>;
};

export type SchoolSisGrade = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type SchoolSisSubjectType = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type SchoolSisSubject = {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
  active?: boolean;
  subjectTypeId?: string | null;
  subjectType?: SchoolSisSubjectType | null;
  maxMarks?: number | null;
  passMarks?: number | null;
  hasTheory?: boolean;
  hasPractical?: boolean;
  isOptional?: boolean;
};

export type SchoolSisCurriculum = {
  academicYear: { id: string; name: string; code?: string };
  types: SchoolSisSubjectType[];
  subjects: SchoolSisSubject[];
  grades: SchoolSisGrade[];
  mappings: Array<{
    id: string;
    gradeId: string;
    subjectId: string;
    gradeName: string;
    subjectName: string;
  }>;
};

export async function fetchSchoolSisCurriculum() {
  const { data } = await api.get<SchoolSisCurriculum>('/v1/school-sis/curriculum');
  return data;
}

export async function createSchoolSisSubjectType(payload: {
  name: string;
  code?: string;
  sortOrder?: number;
}) {
  const { data } = await api.post('/v1/school-sis/subject-types', payload);
  return data as SchoolSisSubjectType;
}

export async function updateSchoolSisSubjectType(
  id: string,
  payload: { name: string; code?: string; sortOrder?: number; active?: boolean },
) {
  const { data } = await api.patch(`/v1/school-sis/subject-types/${id}`, payload);
  return data as SchoolSisSubjectType;
}

export async function deleteSchoolSisSubjectType(id: string) {
  await api.delete(`/v1/school-sis/subject-types/${id}`);
}

export async function createSchoolSisSubject(payload: {
  name: string;
  code?: string;
  subjectTypeId?: string;
  sortOrder?: number;
  maxMarks?: number;
  passMarks?: number;
  hasTheory?: boolean;
  hasPractical?: boolean;
  isOptional?: boolean;
}) {
  const { data } = await api.post('/v1/school-sis/subjects', payload);
  return data as SchoolSisSubject;
}

export async function updateSchoolSisSubject(
  id: string,
  payload: {
    name: string;
    code?: string;
    subjectTypeId?: string;
    sortOrder?: number;
    active?: boolean;
    maxMarks?: number;
    passMarks?: number;
    hasTheory?: boolean;
    hasPractical?: boolean;
    isOptional?: boolean;
  },
) {
  const { data } = await api.patch(`/v1/school-sis/subjects/${id}`, payload);
  return data as SchoolSisSubject;
}

export async function deleteSchoolSisSubject(id: string) {
  await api.delete(`/v1/school-sis/subjects/${id}`);
}

export async function saveSchoolSisClassSubjects(payload: {
  gradeId: string;
  subjectIds: string[];
}) {
  const { data } = await api.put('/v1/school-sis/class-subjects', payload);
  return data as SchoolSisCurriculum;
}

export type SchoolSisSection = {
  id: string;
  name: string;
  capacity: number | null;
  academicYearId?: string;
  grade: SchoolSisGrade;
  _count?: { enrollments: number };
  classTeachers?: Array<{ staff: { id: string; fullName: string } }>;
};

export async function fetchSchoolSisOverview() {
  const { data } = await api.get<SchoolSisOverview>('/v1/school-sis/overview');
  return data;
}

export async function fetchSchoolSisMasters() {
  const { data } = await api.get<{
    academicYear: { id: string; name: string };
    academicYears?: Array<{ id: string; name: string; code?: string; status: string }>;
    grades: SchoolSisGrade[];
    subjects: SchoolSisSubject[];
    sections: SchoolSisSection[];
    allSections?: SchoolSisSection[];
  }>('/v1/school-sis/masters');
  return data;
}

export async function createSchoolSisSection(payload: {
  gradeId: string;
  name: string;
  capacity?: number;
}) {
  const { data } = await api.post('/v1/school-sis/sections', payload);
  return data;
}

export type SchoolSisStudent = {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  status: string;
  createdAt?: string;
  currentAddress?: { house?: string | null; line1?: string | null } | null;
  enrollments: Array<{
    rollNumber: string | null;
    source?: string;
    section: { id: string; name: string; grade: { id: string; name: string; code: string } };
  }>;
  guardians: Array<{
    relationship?: string;
    guardian: { fullName: string; phone: string | null; relation?: string };
  }>;
};

export async function fetchSchoolSisStudents(params?: {
  q?: string;
  gradeId?: string;
  sectionId?: string;
  status?: string;
}) {
  const { data } = await api.get<SchoolSisStudent[]>('/v1/school-sis/students', {
    params: {
      q: params?.q || undefined,
      gradeId: params?.gradeId || undefined,
      sectionId: params?.sectionId || undefined,
      status: params?.status || undefined,
    },
  });
  return data;
}

export async function createSchoolSisStudent(payload: {
  admissionNumber?: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  previousSchoolName?: string;
  previousClass?: string;
}) {
  const { data } = await api.post('/v1/school-sis/students', payload);
  return data;
}

export type SchoolSisStaff = {
  id: string;
  employeeCode: string;
  fullName: string;
  staffType: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  joiningDate: string | null;
  dateOfBirth: string | null;
  status: string;
  photoUrl: string | null;
  gender: string | null;
  bloodGroup: string | null;
  fatherSpouseName: string | null;
  academicQualification: string | null;
  professionalQualification: string | null;
  teachingExperience: string | null;
  classAssigned: string | null;
  trainingStatus: string | null;
  address: string | null;
  remarks: string | null;
  extrasJson?: Record<string, unknown> | null;
};

export async function fetchSchoolSisStaff() {
  const { data } = await api.get<SchoolSisStaff[]>('/v1/school-sis/staff');
  return data;
}

export async function fetchSchoolSisStaffOne(id: string) {
  const { data } = await api.get<SchoolSisStaff>(`/v1/school-sis/staff/${id}`);
  return data;
}

export async function createSchoolSisStaff(payload: {
  employeeCode: string;
  fullName: string;
  staffType?: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
}) {
  const { data } = await api.post<SchoolSisStaff>('/v1/school-sis/staff', payload);
  return data;
}

export async function patchSchoolSisStaff(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<SchoolSisStaff>(`/v1/school-sis/staff/${id}`, payload);
  return data;
}

export async function uploadSchoolSisStaffPhoto(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/school-sis/staff/${id}/photo`, form);
  return data as { url: string };
}

export async function removeSchoolSisStaffPhoto(id: string) {
  const { data } = await api.delete(`/v1/school-sis/staff/${id}/photo`);
  return data;
}

export async function uploadSchoolSisStaffDocument(
  id: string,
  slot: 'RESUME' | 'JOINING_LETTER',
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/school-sis/staff/${id}/documents/upload`, form, {
    params: { slot },
  });
  return data as { fileName?: string; url?: string };
}

export async function assignSchoolSisRollNumbers(studentIds?: string[]) {
  const { data } = await api.post('/v1/school-sis/students/assign-roll-numbers', {
    studentIds,
  });
  return data as { assigned: number; total: number; yearCode: string };
}

export async function enrollSchoolSisStudent(payload: {
  studentId: string;
  sectionId: string;
  rollNumber?: string;
}) {
  const { data } = await api.post('/v1/school-sis/enrollments', payload);
  return data;
}

export async function fetchSchoolSisAllocations() {
  const { data } = await api.get<{
    classTeachers: Array<{
      id: string;
      staff: { fullName: string };
      section: { name: string; grade: { name: string } };
    }>;
    subjectTeachers: Array<{
      id: string;
      periodsPerWeek: number;
      staff: { fullName: string };
      subject: { name: string };
      section: { name: string; grade: { name: string } };
    }>;
  }>('/v1/school-sis/allocations');
  return data;
}

export async function assignSchoolSisClassTeacher(payload: { sectionId: string; staffId: string }) {
  const { data } = await api.post('/v1/school-sis/allocations/class-teacher', payload);
  return data;
}

export async function assignSchoolSisSubjectTeacher(payload: {
  sectionId: string;
  subjectId: string;
  staffId: string;
  periodsPerWeek?: number;
}) {
  const { data } = await api.post('/v1/school-sis/allocations/subject-teacher', payload);
  return data;
}

export async function fetchSchoolSisStudent(id: string) {
  const { data } = await api.get<SchoolSisStudentMaster>(`/v1/school-sis/students/${id}`);
  return data;
}

export type SchoolSisStudentMaster = {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  status: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bloodGroup: string | null;
  house?: string | null;
  nationality: string | null;
  religion: string | null;
  casteCategory: string | null;
  motherTongue: string | null;
  languagesKnown?: string[] | unknown;
  aadhaarNumber: string | null;
  aadhaarMasked?: boolean;
  photoUrl: string | null;
  currentAddress?: Record<string, string | null> | null;
  permanentAddress?: Record<string, string | null> | null;
  usesTransport?: boolean;
  transportJson?: Record<string, string | null> | null;
  usesHostel?: boolean;
  hostelJson?: Record<string, string | null> | null;
  remarks?: string | null;
  classTeacher?: { fullName: string; designation: string | null } | null;
  subjects?: Array<{ id: string; name: string; code: string }>;
  parentPortalActive?: boolean;
  medical: {
    medicalHealth: string | null;
    allergies: unknown;
    medicalConditions: string | null;
    medications: string | null;
    emergencyNotes: string | null;
  } | null;
  enrollments: Array<{
    id: string;
    status: string;
    rollNumber: string | null;
    admissionDate?: string | null;
    source?: string;
    academicYear: { id: string; name: string; code?: string };
    section: { id: string; name: string; grade: { id: string; name: string; code: string } };
  }>;
  guardians: Array<{
    relationship?: string;
    guardian: {
      id: string;
      fullName: string;
      phone: string | null;
      email?: string | null;
      occupation?: string | null;
      relation: string;
      photoUrl?: string | null;
    };
  }>;
  previousSchools: Array<{
    id: string;
    schoolName: string;
    lastClass: string | null;
    yearOfLeaving?: string | null;
  }>;
  documents: Array<{
    id: string;
    slot: string;
    fileName: string;
    verificationStatus?: string;
    createdAt?: string;
    hasFile?: boolean;
  }>;
  enrollmentEvents: Array<{
    id: string;
    type: string;
    createdAt: string;
    note: string | null;
    actorUserId?: string | null;
    actorName?: string | null;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actorUserId?: string | null;
    actorName?: string | null;
  }>;
  siblingLinks?: Array<{
    relationship: string;
    sibling: {
      id: string;
      fullName: string;
      admissionNumber: string;
      enrollments: Array<{ section: { name: string; grade: { name: string } } }>;
    };
  }>;
};

export async function saveSchoolSisStudentMaster(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/students/master', payload);
  return data as { id: string; admissionNumber: string };
}

export async function patchSchoolSisStudentMaster(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-sis/students/${id}`, payload);
  return data as { id: string; admissionNumber: string };
}

export async function uploadSchoolSisStudentPhoto(
  id: string,
  file: File,
  kind: 'STUDENT' | 'FATHER' | 'MOTHER' | 'GUARDIAN' = 'STUDENT',
) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/school-sis/students/${id}/photo`, form, {
    params: { kind },
  });
  return data as { url: string };
}

export async function removeSchoolSisStudentPhoto(id: string) {
  const { data } = await api.delete(`/v1/school-sis/students/${id}/photo`);
  return data;
}

export async function uploadSchoolSisStudentDocument(id: string, slot: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/school-sis/students/${id}/documents/upload`, form, {
    params: { slot },
  });
  return data;
}

export async function fetchSchoolSisStudentDocumentFile(
  studentId: string,
  documentId: string,
  fileName: string,
) {
  const { data } = await api.get(
    `/v1/school-sis/students/${studentId}/documents/${documentId}/file`,
    {
      responseType: 'blob',
    },
  );
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deleteSchoolSisStudentDocument(id: string, documentId: string) {
  const { data } = await api.delete(`/v1/school-sis/students/${id}/documents/${documentId}`);
  return data;
}

export async function promoteSchoolSisStudent(payload: {
  studentId: string;
  toSectionId: string;
  rollNumber?: string;
  note?: string;
}) {
  const { data } = await api.post('/v1/school-sis/enrollments/promote', payload);
  return data;
}

export async function addSchoolSisPreviousSchool(
  studentId: string,
  payload: { schoolName: string; lastClass?: string; board?: string },
) {
  const { data } = await api.post(`/v1/school-sis/students/${studentId}/previous-schools`, payload);
  return data;
}

export async function addSchoolSisDocument(
  studentId: string,
  payload: { slot: string; fileName: string },
) {
  const { data } = await api.post(`/v1/school-sis/students/${studentId}/documents`, payload);
  return data;
}

export type SchoolSisApplication = {
  id: string;
  applicationNumber: string;
  status: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  submittedAt: string;
  student?: { admissionNumber: string } | null;
  cycle: { name: string };
};

export async function fetchSchoolSisApplications(status?: string) {
  const { data } = await api.get<SchoolSisApplication[]>('/v1/school-sis/admission/applications', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function fetchSchoolSisAdmissionCycles() {
  const { data } = await api.get<
    Array<{ id: string; name: string; status: string; opensAt: string; closesAt: string }>
  >('/v1/school-sis/admission/cycles');
  return data;
}

export async function createSchoolSisAdmissionCycle(payload: {
  name: string;
  opensAt: string;
  closesAt: string;
  seatCap?: number;
}) {
  const { data } = await api.post('/v1/school-sis/admission/cycles', payload);
  return data;
}

export async function patchSchoolSisApplicationStatus(id: string, status: string) {
  const { data } = await api.patch(`/v1/school-sis/admission/applications/${id}/status`, {
    status,
  });
  return data;
}

export async function convertSchoolSisApplication(
  id: string,
  payload: { sectionId: string; rollNumber?: string },
) {
  const { data } = await api.post(`/v1/school-sis/admission/applications/${id}/convert`, payload);
  return data;
}

export type SchoolSisTimetableBell = {
  id: string;
  kind: 'PERIOD' | 'BREAK' | string;
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  periodNumber: number | null;
};

export type SchoolSisTimetableSlot = {
  id: string;
  dayOfWeek: number;
  bellId: string;
  subjectId: string | null;
  staffId: string | null;
  roomLabel: string | null;
  notes: string | null;
  printedSubject?: string | null;
  printedTeacher?: string | null;
  needsConfirmation?: boolean;
  sectionId?: string;
  subject: { id: string; name: string; code: string } | null;
  staff: { id: string; fullName: string; employeeCode: string; designation: string | null } | null;
  section?: { id: string; name: string; grade: { name: string; code: string } };
  bell?: SchoolSisTimetableBell;
};

export type SchoolSisTimetableGrid = {
  academicYear: { id: string; name: string };
  plan: { id: string; name: string; status: string; daysJson?: number[] } | null;
  bells: SchoolSisTimetableBell[];
  rooms: Array<{ id: string; name: string }>;
  days: number[];
  section?: {
    id: string;
    name: string;
    grade: { id: string; name: string; code: string };
    academicYear?: { name: string };
  };
  staff?: { id: string; fullName: string };
  student?: { id: string; fullName: string };
  slots: SchoolSisTimetableSlot[];
};

export async function fetchSchoolSisTimetableSetup() {
  const { data } = await api.get<SchoolSisTimetableGrid>('/v1/school-sis/timetable/setup');
  return data;
}

export async function saveSchoolSisTimetableBells(payload: {
  academicYearId?: string;
  bells: Array<
    Partial<SchoolSisTimetableBell> & {
      kind: string;
      code: string;
      label: string;
      startTime: string;
      endTime: string;
      sortOrder: number;
    }
  >;
  days?: number[];
}) {
  const { data } = await api.post('/v1/school-sis/timetable/bells', payload);
  return data;
}

export async function createSchoolSisRoom(name: string) {
  const { data } = await api.post('/v1/school-sis/timetable/rooms', { name });
  return data;
}

export async function deleteSchoolSisRoom(id: string) {
  const { data } = await api.delete(`/v1/school-sis/timetable/rooms/${id}`);
  return data;
}

export async function fetchSchoolSisClassTimetable(sectionId: string) {
  const { data } = await api.get<SchoolSisTimetableGrid>(
    `/v1/school-sis/timetable/class/${sectionId}`,
  );
  return data;
}

export async function fetchSchoolSisTeacherTimetable(staffId: string) {
  const { data } = await api.get<SchoolSisTimetableGrid>(
    `/v1/school-sis/timetable/teacher/${staffId}`,
  );
  return data;
}

export async function fetchSchoolSisStudentTimetable(studentId: string) {
  const { data } = await api.get<SchoolSisTimetableGrid>(
    `/v1/school-sis/timetable/student/${studentId}`,
  );
  return data;
}

export async function fetchSchoolSisMasterTimetable(params?: {
  dayOfWeek?: number;
  sectionId?: string;
  staffId?: string;
  room?: string;
}) {
  const { data } = await api.get<SchoolSisTimetableGrid>('/v1/school-sis/timetable/master', {
    params,
  });
  return data;
}

export async function saveSchoolSisTimetableSlot(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/timetable/slots', payload);
  return data;
}

export async function moveSchoolSisTimetableSlot(payload: {
  slotId: string;
  bellId: string;
  dayOfWeek: number;
  allowOverride?: boolean;
}) {
  const { data } = await api.post('/v1/school-sis/timetable/slots/move', payload);
  return data;
}

export async function copySchoolSisTimetable(payload: {
  mode?: 'SECTION' | 'DAY' | 'WEEK' | 'YEAR';
  fromSectionId?: string;
  toSectionId?: string;
  fromDay?: number;
  toDay?: number;
  fromYearId?: string;
  toYearId?: string;
  replaceDest?: boolean;
}) {
  const { data } = await api.post('/v1/school-sis/timetable/copy', payload);
  return data;
}

export async function validateSchoolSisTimetable() {
  const { data } = await api.get('/v1/school-sis/timetable/validate');
  return data as {
    validEntries: number;
    teacherConflicts: string[];
    roomConflicts: string[];
    missingTeachers: string[];
    missingSubjects: string[];
    emptyPeriods: string[];
    needsConfirmation: string[];
  };
}

export async function publishSchoolSisTimetable() {
  const { data } = await api.post('/v1/school-sis/timetable/publish');
  return data;
}

export async function fetchSchoolSisTimetableDashboard() {
  const { data } = await api.get('/v1/school-sis/timetable/dashboard');
  return data;
}

export async function fetchSchoolSisTimetableToday(params?: {
  sectionId?: string;
  staffId?: string;
  studentId?: string;
}) {
  const { data } = await api.get('/v1/school-sis/timetable/today', { params });
  return data;
}

export async function fetchMySchoolSisTimetable() {
  const { data } = await api.get('/v1/school-sis/timetable/mine');
  return data;
}

export async function downloadSchoolSisTimetablePdf(params?: {
  dayOfWeek?: number;
  sectionId?: string;
}) {
  const { data } = await api.get('/v1/school-sis/timetable/pdf', {
    params,
    responseType: 'blob',
  });
  triggerBlobDownload(data as Blob, 'st-lukes-timetable.pdf');
}

export async function downloadSchoolSisTimetableExcel(dayOfWeek?: number) {
  const { data } = await api.get('/v1/school-sis/timetable/excel', {
    params: dayOfWeek ? { dayOfWeek } : undefined,
    responseType: 'blob',
  });
  triggerBlobDownload(data as Blob, 'st-lukes-timetable.xlsx');
}

export type SchoolSisFeeLine = {
  id: string;
  kind: string;
  code: string;
  label: string;
  amount: number | null;
  unspecified: boolean;
  remarks: string | null;
  sortOrder: number;
};

export type SchoolSisFeeStructure = {
  id: string;
  code: string;
  name: string;
  status: string;
  sourceLabel: string | null;
  notesJson: string[] | unknown;
  grade: { id: string; code: string; name: string };
  academicYear: { id: string; name: string; code: string };
  updatedAt?: string;
  lines: SchoolSisFeeLine[];
  installments: Array<{ id: string; sequence: number; label: string; amount: number }>;
  totals: {
    annual: number;
    uniform: number;
    grand: number;
    installments: number;
    printedGrandTotal: number;
  };
};

export async function fetchSchoolSisFeeStructures() {
  const { data } = await api.get<{
    academicYear: { id: string; name: string };
    structures: SchoolSisFeeStructure[];
  }>('/v1/school-sis/fees/structures');
  return data;
}

export async function updateSchoolSisFeeLine(
  structureId: string,
  lineId: string,
  payload: {
    amount?: number | null;
    unspecified?: boolean;
    label?: string;
    remarks?: string | null;
    applyToSameSchedule?: boolean;
  },
) {
  const { data } = await api.patch(
    `/v1/school-sis/fees/structures/${structureId}/lines/${lineId}`,
    payload,
  );
  return data as SchoolSisFeeStructure;
}

export async function updateSchoolSisFeeInstallment(
  structureId: string,
  installmentId: string,
  amount: number,
) {
  const { data } = await api.patch(
    `/v1/school-sis/fees/structures/${structureId}/installments/${installmentId}`,
    { amount },
  );
  return data as SchoolSisFeeStructure;
}

export async function fetchSchoolSisStudentFees(studentId: string) {
  const { data } = await api.get<{
    student: { id: string; fullName: string };
    enrollment: {
      id: string;
      rollNumber: string | null;
      grade: { id: string; code: string; name: string };
      section: { id: string; name: string };
    };
    structure: SchoolSisFeeStructure | null;
    structures?: SchoolSisFeeStructure[];
  }>(`/v1/school-sis/fees/student/${studentId}`);
  return data;
}

export async function fetchSchoolAcademicYears() {
  const { data } = await api.get('/v1/school-sis/academic/years');
  return data as Array<{
    id: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    status: string;
    _count?: { enrollments: number; sections: number };
  }>;
}

export async function saveSchoolAcademicYear(
  payload: {
    name: string;
    code?: string;
    startDate: string;
    endDate: string;
    status?: string;
    copyTimetableFromYearId?: string;
  },
  id?: string,
) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/academic/years/${id}`, payload)
    : await api.post('/v1/school-sis/academic/years', payload);
  return data;
}

export async function activateSchoolAcademicYear(id: string) {
  const { data } = await api.post(`/v1/school-sis/academic/years/${id}/activate`);
  return data;
}

export async function archiveSchoolAcademicYear(id: string) {
  const { data } = await api.post(`/v1/school-sis/academic/years/${id}/archive`);
  return data;
}

export async function fetchSchoolAcademicClasses() {
  const { data } = await api.get('/v1/school-sis/academic/classes');
  return data as {
    academicYear: { id: string; name: string };
    grades: Array<{
      id: string;
      name: string;
      code: string;
      active: boolean;
      capacity: number | null;
      sortOrder: number;
    }>;
    sections: Array<{
      id: string;
      name: string;
      capacity: number | null;
      active: boolean;
      gradeId: string;
      grade: { id: string; name: string };
      _count?: { enrollments: number };
      classTeachers?: Array<{ staff: { id: string; fullName: string } }>;
    }>;
  };
}

export async function saveSchoolGrade(
  payload: { name: string; code?: string; capacity?: number; active?: boolean },
  id?: string,
) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/academic/grades/${id}`, payload)
    : await api.post('/v1/school-sis/academic/grades', payload);
  return data;
}

export async function patchSchoolSection(
  id: string,
  payload: { name?: string; capacity?: number; active?: boolean },
) {
  const { data } = await api.patch(`/v1/school-sis/academic/sections/${id}`, payload);
  return data;
}

export async function archiveSchoolSection(id: string) {
  await api.delete(`/v1/school-sis/academic/sections/${id}`);
}

export async function fetchSchoolClassSubjectMatrix() {
  const { data } = await api.get('/v1/school-sis/academic/class-subjects');
  return data as {
    academicYear: { id: string; name: string };
    grades: Array<{ id: string; name: string }>;
    subjects: SchoolSisSubject[];
    rows: Array<{
      sectionId: string;
      gradeId: string;
      className: string;
      sectionName: string;
      subjectId: string | null;
      subjectName: string | null;
      subjectCode: string | null;
      subjectType: string | null;
      teacher: { id: string; fullName: string } | null;
    }>;
  };
}

export async function bulkMapSchoolClassSubjects(payload: {
  gradeIds: string[];
  subjectIds: string[];
}) {
  const { data } = await api.put('/v1/school-sis/academic/class-subjects/bulk', payload);
  return data;
}

export async function fetchSchoolStaffMap() {
  const { data } = await api.get('/v1/school-sis/academic/staff-map');
  return data as {
    academicYear: { id: string; name: string };
    staff: Array<{
      id: string;
      fullName: string;
      employeeCode: string;
      department?: string | null;
      email?: string | null;
      status?: string | null;
      designation?: string | null;
    }>;
    classTeachers: Array<{
      id: string;
      staff: { id: string; fullName: string };
      section: { name: string; grade: { name: string } };
    }>;
    subjectTeachers: Array<{
      id: string;
      staff: { id: string; fullName: string };
      subject: { name: string };
      section: { name: string; grade: { name: string } };
      periodsPerWeek: number;
    }>;
    coverage?: { assignedSections: number; totalSections: number };
    workload: Array<{
      id: string;
      fullName: string;
      employeeCode: string;
      department?: string | null;
      email?: string | null;
      status?: string | null;
      designation?: string | null;
      classTeacherSections: number;
      classTeacherLabel?: string | null;
      subjects: number;
      subjectList?: Array<{ name: string; section: string; periods: number }>;
      periods: number;
    }>;
  };
}

export async function fetchSchoolOptionals(sectionId?: string) {
  const { data } = await api.get('/v1/school-sis/academic/optionals', {
    params: sectionId ? { sectionId } : undefined,
  });
  return data as {
    academicYear: { id: string; name: string };
    subjects: SchoolSisSubject[];
    students: Array<{
      id: string;
      fullName: string;
      admissionNumber: string;
      className: string;
      sectionId: string;
      subjectIds: string[];
    }>;
  };
}

export async function saveSchoolOptionalMapping(payload: {
  studentId: string;
  subjectIds: string[];
}) {
  const { data } = await api.put('/v1/school-sis/academic/optionals', payload);
  return data;
}

export async function fetchSchoolHouses() {
  const { data } = await api.get('/v1/school-sis/academic/houses');
  return data as {
    academicYear: { id: string; name: string };
    houses: Array<{
      id: string;
      name: string;
      color: string;
      captainName: string | null;
      teacherStaffId: string | null;
      teacher: { id: string; fullName: string } | null;
      memberships: Array<{
        student: { id: string; fullName: string; admissionNumber: string };
      }>;
    }>;
  };
}

export async function saveSchoolHouse(
  payload: {
    name: string;
    color?: string;
    captainName?: string;
    teacherStaffId?: string;
  },
  id?: string,
) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/academic/houses/${id}`, payload)
    : await api.post('/v1/school-sis/academic/houses', payload);
  return data;
}

export async function assignSchoolHouseMembers(payload: { houseId: string; studentIds: string[] }) {
  const { data } = await api.put('/v1/school-sis/academic/houses/members', payload);
  return data;
}

export async function fetchSchoolClubs() {
  const { data } = await api.get('/v1/school-sis/academic/clubs');
  return data as {
    academicYear: { id: string; name: string };
    clubs: Array<{
      id: string;
      name: string;
      description: string | null;
      coordinator: { id: string; fullName: string } | null;
      members: Array<{
        student: { id: string; fullName: string; admissionNumber: string };
      }>;
      activities: Array<{
        id: string;
        title: string;
        activityDate: string | null;
        notes: string | null;
      }>;
    }>;
  };
}

export async function saveSchoolClub(
  payload: { name: string; description?: string; coordinatorStaffId?: string },
  id?: string,
) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/academic/clubs/${id}`, payload)
    : await api.post('/v1/school-sis/academic/clubs', payload);
  return data;
}

export async function assignSchoolClubMembers(clubId: string, studentIds: string[]) {
  const { data } = await api.put(`/v1/school-sis/academic/clubs/${clubId}/members`, { studentIds });
  return data;
}

export async function addSchoolClubActivity(
  clubId: string,
  payload: { title: string; activityDate?: string; notes?: string },
) {
  const { data } = await api.post(`/v1/school-sis/academic/clubs/${clubId}/activities`, payload);
  return data;
}

export async function fetchSchoolPromotion(sectionId?: string) {
  const { data } = await api.get('/v1/school-sis/academic/promotion', {
    params: sectionId ? { sectionId } : undefined,
  });
  return data as {
    academicYear: { id: string; name: string };
    years: Array<{ id: string; name: string; status: string }>;
    sections: Array<{
      id: string;
      name: string;
      academicYearId: string;
      grade: { name: string };
      academicYear: { name: string };
    }>;
    students: Array<{
      enrollmentId: string;
      studentId: string;
      fullName: string;
      admissionNumber: string;
      status: string;
      className: string;
      sectionId: string;
      rollNumber: string | null;
    }>;
    history: Array<{
      id: string;
      type: string;
      createdAt: string;
      note: string | null;
      student: { fullName: string; admissionNumber: string };
    }>;
  };
}

export async function applySchoolPromotion(payload: {
  studentIds: string[];
  action: 'PROMOTE' | 'HOLD' | 'WITHDRAW';
  toSectionId?: string;
  note?: string;
}) {
  const { data } = await api.post('/v1/school-sis/academic/promotion', payload);
  return data as { ok: boolean; count: number };
}

export async function fetchSchoolIdCards() {
  const { data } = await api.get('/v1/school-sis/academic/id-cards');
  return data as Array<{
    id: string;
    name: string;
    status: string;
    isDefault: boolean;
    layoutJson: Record<string, unknown>;
  }>;
}

export async function saveSchoolIdCard(
  payload: {
    name: string;
    status?: string;
    isDefault?: boolean;
    layoutJson?: Record<string, unknown>;
  },
  id?: string,
) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/academic/id-cards/${id}`, payload)
    : await api.post('/v1/school-sis/academic/id-cards', payload);
  return data;
}

export async function previewSchoolIdCard(id: string, studentId?: string) {
  const { data } = await api.get(`/v1/school-sis/academic/id-cards/${id}/preview`, {
    params: studentId ? { studentId } : undefined,
  });
  return data as {
    template: { layoutJson: Record<string, boolean | string> };
    school: { name: string; logoUrl: string | null; address: string | null };
    academicYear: { name: string };
    student: {
      fullName: string;
      admissionNumber: string;
      photoUrl: string | null;
      bloodGroup: string | null;
      className: string;
    };
  };
}

export async function fetchMonthlyFeeConfig() {
  const { data } = await api.get('/v1/school-sis/fees/monthly/config');
  return data as {
    academicYear: { id: string; name: string; code: string };
    settings: {
      dueDay: number;
      lateFeeAmount: number;
      lateFeeEnabled: boolean;
      paymentMethods: string[];
      receiptPrefix: string;
      signatoryName: string | null;
      schoolName: string;
      schoolAddress: string;
      logoUrl: string | null;
      instructionsJson: string[];
      refundPolicy: string | null;
      examInstructions: string | null;
      otherNotes: string | null;
    };
    plans: Array<{
      id: string;
      gradeId: string;
      tuitionAmount: number;
      lateFeeAmount: number | null;
      otherAmount: number;
      grade: { id: string; name: string; code: string };
    }>;
    applicableClasses?: Array<{ name: string; code: string }>;
    updatedAt?: string;
    updatedBy?: string | null;
    onlinePayments?: {
      available: boolean;
      gatewayName: string | null;
      provider: string | null;
      environment: string | null;
      warning: string | null;
    };
  };
}

export async function saveMonthlyFeeSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/fees/monthly/config', payload);
  return data;
}

export async function resetMonthlyFeeSettings() {
  const { data } = await api.post('/v1/school-sis/fees/monthly/config/reset');
  return data;
}

export type SchoolPaymentGateway = {
  id: string;
  provider: string;
  name: string;
  environment: 'TEST' | 'LIVE';
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
  lastConnectionTest: string | null;
  lastConnectionError: string | null;
  createdAt: string;
  updatedAt: string;
  credentials: Record<string, string | boolean>;
  configuration: {
    webhookUrl: string;
    callbackUrl: string;
    successUrl: string;
    failureUrl: string;
    currency?: string;
  };
};

export async function fetchSchoolPaymentGateways() {
  const { data } = await api.get('/v1/school-sis/fees/payment-gateways');
  return data as {
    configured: number;
    activeGateway: string | null;
    defaultGateway: string | null;
    gatewayStatus: string;
    onlinePaymentsAvailable: boolean;
    warning: string | null;
    gateways: SchoolPaymentGateway[];
  };
}

export async function fetchSchoolPaymentGateway(id: string, reveal = false) {
  const { data } = await api.get(`/v1/school-sis/fees/payment-gateways/${id}`, {
    params: reveal ? { reveal: '1' } : undefined,
  });
  return data as SchoolPaymentGateway;
}

export async function createSchoolPaymentGateway(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/fees/payment-gateways', payload);
  return data as SchoolPaymentGateway;
}

export async function updateSchoolPaymentGateway(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-sis/fees/payment-gateways/${id}`, payload);
  return data as SchoolPaymentGateway;
}

export async function deleteSchoolPaymentGateway(id: string) {
  const { data } = await api.delete(`/v1/school-sis/fees/payment-gateways/${id}`);
  return data as { ok: boolean };
}

export async function testSchoolPaymentGateway(id: string) {
  const { data } = await api.post(`/v1/school-sis/fees/payment-gateways/${id}/test-connection`);
  return data as { ok: boolean; message: string; reason: string | null };
}

export async function setDefaultSchoolPaymentGateway(id: string) {
  const { data } = await api.post(`/v1/school-sis/fees/payment-gateways/${id}/set-default`);
  return data as { ok: boolean; message: string };
}

export async function activateSchoolPaymentGateway(id: string) {
  const { data } = await api.post(`/v1/school-sis/fees/payment-gateways/${id}/activate`);
  return data;
}

export async function deactivateSchoolPaymentGateway(id: string) {
  const { data } = await api.post(`/v1/school-sis/fees/payment-gateways/${id}/deactivate`);
  return data;
}

export async function fetchSchoolGatewayTransactions(params: Record<string, string>) {
  const { data } = await api.get('/v1/school-sis/fees/payment-gateways/transactions', { params });
  return data as {
    items: Array<{
      id: string;
      gateway: string;
      provider: string;
      student: string;
      admissionNumber: string;
      amount: number;
      feeReference: string | null;
      orderId: string;
      paymentId: string | null;
      status: string;
      createdAt: string;
      completedAt: string | null;
      feePaymentId: string | null;
    }>;
  };
}

export async function startSchoolOnlineCheckout(payload: {
  studentId: string;
  months: string[];
  amountPaying?: number;
  waiveLateFee?: boolean;
  notes?: string;
}) {
  const { data } = await api.post('/v1/school-sis/fees/monthly/online/checkout', payload);
  return data as {
    transactionId: string;
    orderId: string;
    amount: number;
    currency: string;
    provider: string;
    gatewayName: string;
    checkout: Record<string, unknown>;
  };
}

export async function verifySchoolOnlinePayment(payload: {
  orderId: string;
  paymentId?: string;
  signature?: string;
}) {
  const { data } = await api.post('/v1/school-sis/fees/monthly/online/verify', payload);
  return data;
}

export async function saveMonthlyFeePlan(payload: {
  gradeId: string;
  tuitionAmount: number;
  lateFeeAmount?: number;
  otherAmount?: number;
}) {
  const { data } = await api.put('/v1/school-sis/fees/monthly/plans', payload);
  return data;
}

export async function quoteMonthlyFee(studentId: string, month: string) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/quote', {
    params: { studentId, month },
  });
  return data as {
    paid: boolean;
    payment?: { id: string; receiptNumber: string } | null;
    student: { id: string; fullName: string; admissionNumber: string };
    className: string;
    sectionName: string;
    feeMonth: string;
    monthLabel: string;
    tuitionAmount: number;
    otherAmount: number;
    lateFeeAmount: number;
    lateApplies: boolean;
    previousBalance: number;
    totalAmount: number;
    academicYear: { name: string };
    settings: {
      paymentMethods: string[];
      dueDay: number;
      schoolName: string;
      schoolAddress: string;
      signatoryName: string | null;
      instructionsJson: string[];
    };
  };
}

export async function fetchMonthlyFeeLedger(studentId: string) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/ledger', {
    params: { studentId },
  });
  return data as MonthlyFeeLedger;
}

export type MonthlyFeeLedgerRow = {
  feeMonth: string;
  monthLabel: string;
  tuitionAmount: number;
  otherAmount: number;
  lateFeeAmount: number;
  lateApplies: boolean;
  lateReason: string | null;
  previousDue: number;
  paidAmount: number;
  totalDue: number;
  grossDue: number;
  status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE';
  selectable: boolean;
};

export type MonthlyFeeLedger = {
  academicYear: { name: string; code: string };
  settings: {
    paymentMethods: string[];
    dueDay: number;
    lateFeeEnabled?: boolean;
    schoolName: string;
    schoolAddress: string;
    signatoryName: string | null;
    instructionsJson: string[];
    receiptPrefix: string;
  };
  student: { id: string; fullName: string; admissionNumber: string; phone: string | null };
  className: string;
  sectionName: string;
  gradeCode?: string;
  otherLabel?: string;
  currentMonth: string;
  currentMonthStatus: string;
  unpaidMonths: number;
  totalOutstanding: number;
  lastPaymentDate: string | null;
  lastReceiptNumber: string | null;
  rows: MonthlyFeeLedgerRow[];
  history: Array<{
    id: string;
    paidAt: string;
    receiptNumber: string;
    months: string[];
    amount: number;
    paymentMode: string;
    status: string;
  }>;
};

export async function collectMonthlyFee(payload: {
  studentId: string;
  feeMonth?: string;
  months?: string[];
  paymentMode: string;
  reference?: string;
  chequeNumber?: string;
  bankName?: string;
  discountAmount?: number;
  discountType?: 'AMOUNT' | 'PERCENT';
  discountValue?: number;
  discountReason?: string;
  discountApprovedBy?: string;
  amountPaying?: number;
  otherAmount?: number;
  waiveLateFee?: boolean;
  lateWaivers?: Array<{ month: string; reason: string }>;
  cashReceived?: number;
  payerName?: string;
  payerMobile?: string;
  instrumentDate?: string;
  notes?: string;
  channel?: 'OFFICE' | 'PARENT' | 'GATEWAY';
}) {
  const { data } = await api.post('/v1/school-sis/fees/monthly/collect', payload);
  return data as {
    receiptNumber: string;
    payment: {
      id: string;
      tuitionAmount?: number;
      lateFeeAmount?: number;
      otherAmount?: number;
      discountAmount?: number;
      totalAmount?: number;
    };
    months?: string[];
  };
}

export async function sendMonthlyFeeReceipt(id: string) {
  const { data } = await api.post(`/v1/school-sis/fees/monthly/payments/${id}/send`);
  return data as { ok: boolean; receiptNumber: string; studentPhone: string | null };
}

export async function fetchMonthlyFeeDashboard() {
  const { data } = await api.get('/v1/school-sis/fees/monthly/dashboard');
  return data as {
    academicYear: { name: string };
    todayCollection: number;
    todayCount: number;
    monthCollection: number;
    monthPaid: number;
    monthPending: number;
    enrolled: number;
    latePayments: number;
    pendingFees: number;
    byClass: Array<{ name: string; amount: number; paid: number }>;
    byMonth: Array<{ month: string; label: string; amount: number; count: number }>;
  };
}

export async function fetchMonthlyFeeRegister(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/register', { params });
  return data as {
    academicYear: { name: string };
    rows: Array<{
      id: string;
      receiptNumber: string;
      feeMonth: string;
      monthLabel: string;
      tuitionAmount: number;
      lateFeeAmount: number;
      totalAmount: number;
      paymentMode: string;
      status: string;
      paidAt: string;
      className: string;
      sectionName: string;
      student: { fullName: string; admissionNumber: string };
    }>;
  };
}

export async function fetchMonthlyFeePending(month?: string) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/pending', {
    params: month ? { month } : undefined,
  });
  return data as {
    academicYear?: { id: string; name: string; code: string };
    feeMonth: string;
    monthLabel: string;
    summary: {
      enrolled: number;
      pending: number;
      paid: number;
      pendingAmount: number;
    };
    grades: Array<{
      gradeId: string;
      name: string;
      enrolled: number;
      paid: number;
      pending: number;
      pendingAmount: number;
    }>;
    sections: Array<{ id: string; gradeId: string; name: string; className: string }>;
    rows: Array<{
      studentId: string;
      fullName: string;
      admissionNumber: string;
      phone?: string | null;
      rollNumber?: string | null;
      gradeId: string;
      gradeCode?: string;
      sectionId: string;
      className: string;
      sectionName: string;
      tuitionAmount: number;
      lateFeeAmount: number;
      otherAmount?: number;
      previousBalance?: number;
      totalDue: number;
      overdue?: boolean;
      status?: string;
    }>;
  };
}

export async function voidMonthlyFee(id: string, reason: string) {
  const { data } = await api.post(`/v1/school-sis/fees/monthly/payments/${id}/void`, { reason });
  return data;
}

export async function fetchMonthlyFeePayment(id: string) {
  const { data } = await api.get(`/v1/school-sis/fees/monthly/payments/${id}`);
  return data as {
    id: string;
    receiptNumber: string;
    feeMonth: string;
    tuitionAmount: number;
    lateFeeAmount: number;
    otherAmount: number;
    discountAmount: number;
    previousBalance: number;
    totalAmount: number;
    grossAmount?: number | null;
    paymentMode: string;
    reference: string | null;
    status: string;
    paidAt: string;
    snapshotJson: Record<string, unknown>;
    lines?: Array<{
      tuitionAmount: number;
      lateFeeAmount: number;
      otherAmount: number;
    }>;
    student: { fullName: string; admissionNumber: string };
    events: Array<{ type: string; createdAt: string; note: string | null }>;
  };
}

function triggerBlobDownload(data: Blob, fileName: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadMonthlyFeeRegisterXlsx(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/register-export', {
    params,
    responseType: 'blob',
  });
  triggerBlobDownload(data as Blob, 'monthly-fee-register.xlsx');
}

export async function downloadMonthlyFeeReceiptPdf(id: string, receiptNumber: string) {
  const { data } = await api.get(`/v1/school-sis/fees/monthly/payments/${id}/pdf`, {
    responseType: 'blob',
  });
  triggerBlobDownload(data as Blob, `${receiptNumber.replaceAll('/', '-')}.pdf`);
}

export async function printMonthlyFeeReceipt(id: string) {
  const { printHtmlDocument } = await import('@/lib/print-html-document');
  const { data } = await api.get(`/v1/school-sis/fees/monthly/payments/${id}/receipt`, {
    responseType: 'text',
    headers: { Accept: 'text/html' },
  });
  await printHtmlDocument(String(data), {
    title: 'Fee receipt',
    width: '297mm',
    height: '210mm',
  });
}

export type UserWiseCollectionReport = {
  date: string;
  summary: {
    totalCollection: number;
    totalCash: number;
    totalOnline: number;
    cashPercent: number;
    onlinePercent: number;
    totalTransactions: number;
    userCount: number;
  };
  users: Array<{
    userId: string | null;
    userName: string;
    role: string;
    cashCollection: number;
    onlineCollection: number;
    totalCollection: number;
    receiptCount: number;
    firstCollectionTime: string | null;
    lastCollectionTime: string | null;
    cashClose: { status: string; difference: number; actualCashCount: number } | null;
  }>;
  pagination: { page: number; limit: number; total: number };
  canViewAll: boolean;
  canClose: boolean;
  filters: {
    academicYear: { id: string; name: string };
    years: Array<{ id: string; name: string; status: string }>;
    grades: Array<{ id: string; name: string }>;
    sections: Array<{ id: string; gradeId: string; name: string }>;
    paymentModes: string[];
    collectors: Array<{ userId: string; userName: string }>;
    schoolName: string | null;
    logoUrl: string | null;
  };
};

export async function fetchUserWiseCollection(params: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/school-sis/fees/monthly/reports/user-wise-collection', {
    params,
  });
  return data as UserWiseCollectionReport;
}

export async function fetchUserWiseReceipts(
  userId: string,
  params: Record<string, string | number | undefined>,
) {
  const { data } = await api.get(
    `/v1/school-sis/fees/monthly/reports/user-wise-collection/users/${userId}`,
    { params },
  );
  return data as {
    date: string;
    user: { userId: string | null; userName: string; role: string };
    summary: {
      cashCollected: number;
      onlineCollected: number;
      total: number;
      receipts: number;
    };
    receipts: Array<{
      id: string;
      receiptNumber: string;
      studentName: string;
      admissionNo: string;
      className: string;
      feeMonth: string;
      amount: number;
      paymentMode: string;
      collectionTime: string | null;
      status: string;
    }>;
    pagination: { page: number; limit: number; total: number };
  };
}

export async function downloadUserWiseCollectionXlsx(params: Record<string, string | undefined>) {
  const { data } = await api.get(
    '/v1/school-sis/fees/monthly/reports/user-wise-collection/export',
    {
      params,
      responseType: 'blob',
    },
  );
  triggerBlobDownload(data as Blob, `user-wise-collection-${params.date || 'today'}.xlsx`);
}

export async function closeSchoolFeeCashCounter(payload: {
  userId: string;
  date: string;
  academicYearId?: string;
  openingCash: number;
  actualCashCount: number;
  notes?: string;
}) {
  const { data } = await api.post('/v1/school-sis/fees/monthly/reports/cash-close', payload);
  return data;
}

export async function reopenSchoolFeeCashCounter(userId: string, date: string) {
  const { data } = await api.post('/v1/school-sis/fees/monthly/reports/cash-close/reopen', {
    userId,
    date,
  });
  return data;
}

export async function fetchStationerySettings() {
  const { data } = await api.get('/v1/school-sis/stationery/settings');
  return data;
}

export async function saveStationerySettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/stationery/settings', payload);
  return data;
}

export async function fetchStationeryDashboard() {
  const { data } = await api.get('/v1/school-sis/stationery/dashboard');
  return data;
}

export async function fetchStationeryCategories() {
  const { data } = await api.get('/v1/school-sis/stationery/categories');
  return data as Array<{
    id: string;
    name: string;
    code: string;
    children: Array<{ id: string; name: string; code: string }>;
  }>;
}

export async function createStationeryCategory(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/stationery/categories', payload);
  return data;
}

export async function fetchStationeryProducts(params?: {
  q?: string;
  categoryId?: string;
  stock?: string;
}) {
  const { data } = await api.get('/v1/school-sis/stationery/products', { params });
  return data as any[];
}

export async function saveStationeryProduct(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/stationery/products/${id}`, payload)
    : await api.post('/v1/school-sis/stationery/products', payload);
  return data;
}

export async function importStationeryProducts(rows: unknown[]) {
  const { data } = await api.post('/v1/school-sis/stationery/products/import', { rows });
  return data as {
    total: number;
    success: number;
    failed: number;
    duplicate: number;
    invalid: number;
    errors: Array<{ row: number; sku: string; error: string }>;
  };
}

export async function downloadStationeryProductTemplate() {
  const { data } = await api.get('/v1/school-sis/stationery/products/import-template', {
    responseType: 'blob',
  });
  triggerBlobDownload(data as Blob, 'stationery-products.xlsx');
}

export async function searchStationeryStudents(q: string) {
  const { data } = await api.get('/v1/school-sis/stationery/students', { params: { q } });
  return data as any[];
}

export async function fetchStationerySuggested(studentId: string) {
  const { data } = await api.get(`/v1/school-sis/stationery/students/${studentId}/suggested`);
  return data as any[];
}

export async function completeStationerySale(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/stationery/sales', payload);
  return data;
}

export async function fetchStationerySales(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/stationery/sales', { params });
  return data as any[];
}

export async function fetchStationerySale(id: string) {
  const { data } = await api.get(`/v1/school-sis/stationery/sales/${id}`);
  return data;
}

export async function cancelStationerySale(id: string, reason?: string) {
  const { data } = await api.post(`/v1/school-sis/stationery/sales/${id}/cancel`, { reason });
  return data;
}

export async function fetchStationerySuppliers() {
  const { data } = await api.get('/v1/school-sis/stationery/suppliers');
  return data as any[];
}

export async function saveStationerySupplier(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/stationery/suppliers/${id}`, payload)
    : await api.post('/v1/school-sis/stationery/suppliers', payload);
  return data;
}

export async function fetchStationeryPurchases() {
  const { data } = await api.get('/v1/school-sis/stationery/purchases');
  return data as any[];
}

export async function createStationeryPurchase(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/stationery/purchases', payload);
  return data;
}

export async function adjustStationeryStock(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/stationery/stock/adjust', payload);
  return data;
}

export async function fetchStationeryMovements(productId?: string) {
  const { data } = await api.get('/v1/school-sis/stationery/stock/movements', {
    params: { productId },
  });
  return data as any[];
}

export async function createStationeryReturn(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/stationery/returns', payload);
  return data;
}

export async function fetchStationeryReports(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/stationery/reports', { params });
  return data;
}

export async function fetchSchoolExamDashboard() {
  const { data } = await api.get('/v1/school-sis/exams/dashboard');
  return data;
}

export async function fetchSchoolExamSettings() {
  const { data } = await api.get('/v1/school-sis/exams/settings');
  return data;
}

export async function saveSchoolExamSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/exams/settings', payload);
  return data;
}

export async function fetchSchoolExamTypes() {
  const { data } = await api.get('/v1/school-sis/exams/types');
  return data;
}

export async function saveSchoolExamType(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/exams/types/${id}`, payload)
    : await api.post('/v1/school-sis/exams/types', payload);
  return data;
}

export async function fetchSchoolGradeSystems() {
  const { data } = await api.get('/v1/school-sis/exams/grade-systems');
  return data;
}

export async function saveSchoolGradeSystem(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/exams/grade-systems/${id}`, payload)
    : await api.post('/v1/school-sis/exams/grade-systems', payload);
  return data;
}

export async function fetchSchoolExams() {
  const { data } = await api.get('/v1/school-sis/exams');
  return data;
}

export async function fetchSchoolExam(id: string) {
  const { data } = await api.get(`/v1/school-sis/exams/${id}`);
  return data;
}

export async function saveSchoolExam(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/exams/${id}`, payload)
    : await api.post('/v1/school-sis/exams', payload);
  return data;
}

export async function archiveSchoolExam(id: string) {
  const { data } = await api.delete(`/v1/school-sis/exams/${id}`);
  return data;
}

export async function saveSchoolExamSubject(examId: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`/v1/school-sis/exams/${examId}/subjects`, payload);
  return data;
}

export async function saveSchoolExamComponent(
  examSubjectId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.post(
    `/v1/school-sis/exams/subjects/${examSubjectId}/components`,
    payload,
  );
  return data;
}

export async function fetchSchoolExamSchedules(examId?: string) {
  const { data } = await api.get('/v1/school-sis/exams/schedules', { params: { examId } });
  return data;
}

export async function saveSchoolExamSchedule(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/exams/schedules', payload);
  return data;
}

export async function fetchSchoolExamMarksRoster(params: {
  examId: string;
  sectionId: string;
  componentId: string;
}) {
  const { data } = await api.get('/v1/school-sis/exams/marks/roster', { params });
  return data;
}

export async function saveSchoolExamMarks(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/exams/marks', payload);
  return data;
}

export async function reopenSchoolExamMarks(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/exams/marks/reopen', payload);
  return data;
}

export async function generateSchoolExamResults(payload: { examId: string; sectionId?: string }) {
  const { data } = await api.post('/v1/school-sis/exams/results/generate', payload);
  return data;
}

export async function publishSchoolExamResults(examId: string, reason?: string) {
  const { data } = await api.post('/v1/school-sis/exams/results/publish', { examId, reason });
  return data;
}

export async function unpublishSchoolExamResults(examId: string, reason?: string) {
  const { data } = await api.post('/v1/school-sis/exams/results/unpublish', { examId, reason });
  return data;
}

export async function fetchSchoolExamResults(examId: string, sectionId?: string) {
  const { data } = await api.get('/v1/school-sis/exams/results', { params: { examId, sectionId } });
  return data;
}

export async function fetchSchoolExamReportCard(examId: string, studentId: string) {
  const { data } = await api.get('/v1/school-sis/exams/report-card', {
    params: { examId, studentId },
  });
  return data;
}

export async function fetchSchoolExamReports(examId: string) {
  const { data } = await api.get('/v1/school-sis/exams/reports', { params: { examId } });
  return data;
}

export async function fetchStudentPublishedExamResults(studentId: string) {
  const { data } = await api.get(`/v1/school-sis/exams/students/${studentId}/published`);
  return data;
}

export async function fetchSchoolCalendarSetup(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/setup', { params: { academicYearId } });
  return data;
}

export async function fetchSchoolCalendarDashboard(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/dashboard', {
    params: { academicYearId },
  });
  return data;
}

export async function fetchSchoolCalendarMonth(params: {
  year: number;
  month: number;
  academicYearId?: string;
}) {
  const { data } = await api.get('/v1/school-sis/calendar/month', { params });
  return data;
}

export async function fetchSchoolCalendarYear(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/year', { params: { academicYearId } });
  return data;
}

export async function fetchSchoolHolidays(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/holidays', {
    params: { academicYearId },
  });
  return data;
}

export async function saveSchoolHoliday(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/calendar/holidays/${id}`, payload)
    : await api.post('/v1/school-sis/calendar/holidays', payload);
  return data;
}

export async function deleteSchoolHoliday(id: string) {
  const { data } = await api.delete(`/v1/school-sis/calendar/holidays/${id}`);
  return data;
}

export async function duplicateSchoolHoliday(id: string) {
  const { data } = await api.post(`/v1/school-sis/calendar/holidays/${id}/duplicate`);
  return data;
}

export async function importSchoolHolidays(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/calendar/holidays/import', payload);
  return data;
}

export async function saveSchoolWeeklyOff(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/calendar/weekly-off', payload);
  return data;
}

export async function saveSchoolAcademicTerms(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/calendar/terms', payload);
  return data;
}

export async function fetchSchoolCalendarOverrides(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/overrides', {
    params: { academicYearId },
  });
  return data;
}

export async function saveSchoolCalendarOverride(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/calendar/overrides', payload);
  return data;
}

export async function deleteSchoolCalendarOverride(id: string) {
  const { data } = await api.delete(`/v1/school-sis/calendar/overrides/${id}`);
  return data;
}

export async function fetchSchoolCalendarEvents(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/calendar/events', { params });
  return data;
}

export async function saveSchoolCalendarEvent(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/calendar/events/${id}`, payload)
    : await api.post('/v1/school-sis/calendar/events', payload);
  return data;
}

export async function deleteSchoolCalendarEvent(id: string) {
  const { data } = await api.delete(`/v1/school-sis/calendar/events/${id}`);
  return data;
}

export async function fetchSchoolCalendarReports(kind?: string, academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/calendar/reports', {
    params: { kind, academicYearId },
  });
  return data;
}

export async function fetchSchoolAttendanceDashboard(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/dashboard', { params });
  return data;
}

export async function fetchSchoolAttendanceSettings(academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/attendance/settings', {
    params: { academicYearId },
  });
  return data;
}

export async function saveSchoolAttendanceSettings(
  payload: Record<string, unknown>,
  academicYearId?: string,
) {
  const { data } = await api.patch('/v1/school-sis/attendance/settings', payload, {
    params: { academicYearId },
  });
  return data;
}

export async function fetchSchoolAttendanceRoster(params: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/roster', { params });
  return data;
}

export async function saveSchoolAttendanceDraft(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/draft', payload);
  return data;
}

export async function submitSchoolAttendance(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/submit', payload);
  return data;
}

export async function fetchSchoolAttendanceAbsentees(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/absentees', { params });
  return data;
}

export async function fetchSchoolAttendanceLow(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/low', { params });
  return data;
}

export async function fetchSchoolAttendanceMonthly(params: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/monthly', { params });
  return data;
}

export async function fetchSchoolAttendanceLeave(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/school-sis/attendance/leave', { params });
  return data;
}

export async function createSchoolAttendanceLeave(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/leave', payload);
  return data;
}

export async function reviewSchoolAttendanceLeave(id: string, approve: boolean, note?: string) {
  const { data } = await api.post(
    `/v1/school-sis/attendance/leave/${id}/${approve ? 'approve' : 'reject'}`,
    { note },
  );
  return data;
}

export async function fetchSchoolAttendanceCorrections(status?: string) {
  const { data } = await api.get('/v1/school-sis/attendance/corrections', { params: { status } });
  return data;
}

export async function createSchoolAttendanceCorrection(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/corrections', payload);
  return data;
}

export async function reviewSchoolAttendanceCorrection(
  id: string,
  approve: boolean,
  note?: string,
) {
  const { data } = await api.post(
    `/v1/school-sis/attendance/corrections/${id}/${approve ? 'approve' : 'reject'}`,
    { note },
  );
  return data;
}

export async function fetchSchoolTeacherAttendanceToday(date?: string) {
  const { data } = await api.get('/v1/school-sis/attendance/teacher/today', { params: { date } });
  return data;
}

export async function searchSchoolAttendanceStudents(q: string, academicYearId?: string) {
  const { data } = await api.get('/v1/school-sis/attendance/search', {
    params: { q, academicYearId },
  });
  return data;
}

export async function notifySchoolAttendance(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/notify', payload);
  return data;
}

export async function syncSchoolAttendance(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/attendance/sync', payload);
  return data;
}

export async function fetchSchoolStudentAttendance(studentId: string, academicYearId?: string) {
  const { data } = await api.get(`/v1/school-sis/attendance/students/${studentId}`, {
    params: { academicYearId },
  });
  return data;
}

function hr(path: string, params?: Record<string, unknown>) {
  return api.get(`/v1/school-sis/hr${path}`, { params }).then((r) => r.data);
}

function hrPost(path: string, payload?: unknown) {
  return api.post(`/v1/school-sis/hr${path}`, payload).then((r) => r.data);
}

function hrPatch(path: string, payload?: unknown) {
  return api.patch(`/v1/school-sis/hr${path}`, payload).then((r) => r.data);
}

export const fetchHrDashboard = (periodMonth?: string) => hr('/dashboard', { periodMonth });
export const fetchHrSettings = () => hr('/settings');
export const saveHrSettings = (payload: unknown) => hrPatch('/settings', payload);
export const fetchHrDepartments = () => hr('/departments');
export const saveHrDepartment = (payload: unknown) => hrPost('/departments', payload);
export const fetchHrDesignations = () => hr('/designations');
export const saveHrDesignation = (payload: unknown) => hrPost('/designations', payload);
export const fetchHrEmployeeTypes = () => hr('/employee-types');
export const saveHrEmployeeType = (payload: unknown) => hrPost('/employee-types', payload);
export const fetchHrNextCode = () => hr('/employees/next-code');
export const fetchHrEmployees = (params?: Record<string, unknown>) => hr('/employees', params);
export const fetchHrEmployee = (id: string) => hr(`/employees/${id}`);
export const createHrEmployee = (payload: unknown) => hrPost('/employees', payload);
export const saveHrEmployment = (id: string, payload: unknown) =>
  hrPatch(`/employees/${id}/employment`, payload);
export const saveHrBank = (id: string, payload: unknown) =>
  hrPost(`/employees/${id}/bank`, payload);
export const importHrEmployees = (payload: unknown) => hrPost('/employees/import', payload);
export const fetchHrComponents = () => hr('/salary/components');
export const saveHrComponent = (payload: unknown) => hrPost('/salary/components', payload);
export const fetchHrStructures = () => hr('/salary/structures');
export const saveHrStructure = (payload: unknown) => hrPost('/salary/structures', payload);
export const assignHrSalary = (payload: unknown) => hrPost('/salary/assign', payload);
export const reviseHrSalary = (payload: unknown) => hrPost('/salary/revise', payload);
export const fetchHrLeaveTypes = () => hr('/leave/types');
export const saveHrLeaveType = (payload: unknown) => hrPost('/leave/types', payload);
export const saveHrLeavePolicy = (payload: unknown) => hrPost('/leave/policies', payload);
export const fetchHrLeaveRequests = (params?: Record<string, unknown>) =>
  hr('/leave/requests', params);
export const requestHrLeave = (payload: unknown) => hrPost('/leave/request', payload);
export const reviewHrLeave = (id: string, approve: boolean) =>
  hrPost(`/leave/${id}/${approve ? 'approve' : 'reject'}`);
export const fetchHrStaffAttendance = (date: string) => hr('/attendance', { date });
export const markHrStaffAttendance = (payload: unknown) => hrPost('/attendance', payload);
export const finalizeHrAttendanceMonth = (periodMonth: string) =>
  hrPost('/attendance/finalize', { periodMonth });
export const calculateHrPayroll = (payload: unknown) => hrPost('/payroll/calculate', payload);
export const fetchHrPayrollList = () => hr('/payroll');
export const fetchHrPayroll = (id: string) => hr(`/payroll/${id}`);
export const reviewHrPayroll = (id: string) => hrPost(`/payroll/${id}/review`);
export const approveHrPayroll = (id: string) => hrPost(`/payroll/${id}/approve`);
export const processHrPayroll = (id: string) => hrPost(`/payroll/${id}/process`);
export const finalizeHrPayroll = (id: string) => hrPost(`/payroll/${id}/finalize`);
export const reverseHrPayroll = (id: string, reason: string) =>
  hrPost(`/payroll/${id}/reverse`, { reason });
export const payHrPayrollLines = (payload: unknown) => hrPost('/payroll/pay', payload);
export const fetchHrPayslipPdf = (id: string) =>
  api.get(`/v1/school-sis/hr/payslips/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data);
export const fetchHrLoans = (staffId?: string) => hr('/loans', { staffId });
export const createHrLoan = (payload: unknown) => hrPost('/loans', payload);
export const fetchHrReimbursements = (staffId?: string) => hr('/reimbursements', { staffId });
export const createHrReimbursement = (payload: unknown) => hrPost('/reimbursements', payload);
export const approveHrReimbursement = (id: string) => hrPost(`/reimbursements/${id}/approve`);
export const createHrExit = (payload: unknown) => hrPost('/exits', payload);
export const saveHrStatutory = (payload: unknown) => hrPost('/statutory', payload);
export const fetchHrMe = () => hr('/me');

function tr(path: string, params?: Record<string, unknown>) {
  return api.get(`/v1/school-sis/transport${path}`, { params }).then((r) => r.data);
}
function trPost(path: string, payload?: unknown) {
  return api.post(`/v1/school-sis/transport${path}`, payload).then((r) => r.data);
}
function trPatch(path: string, payload?: unknown) {
  return api.patch(`/v1/school-sis/transport${path}`, payload).then((r) => r.data);
}

export const fetchTransportDashboard = () => tr('/dashboard');
export const fetchTransportSettings = () => tr('/settings');
export const saveTransportSettings = (payload: unknown) => trPatch('/settings', payload);
export const fetchTransportVehicles = (params?: Record<string, unknown>) => tr('/vehicles', params);
export const saveTransportVehicle = (payload: unknown, id?: string) =>
  id ? trPatch(`/vehicles/${id}`, payload) : trPost('/vehicles', payload);
export const saveTransportVehicleDocument = (id: string, payload: unknown) =>
  trPost(`/vehicles/${id}/documents`, payload);
export const fetchTransportPersonnel = (kind: string, params?: Record<string, unknown>) =>
  tr('/personnel', { ...params, kind });
export const saveTransportPersonnel = (payload: unknown, id?: string) =>
  id ? trPatch(`/personnel/${id}`, payload) : trPost('/personnel', payload);
export const fetchTransportStops = (params?: Record<string, unknown>) => tr('/stops', params);
export const saveTransportStop = (payload: unknown, id?: string) =>
  id ? trPatch(`/stops/${id}`, payload) : trPost('/stops', payload);
export const fetchTransportRoutes = (params?: Record<string, unknown>) => tr('/routes', params);
export const saveTransportRoute = (payload: unknown, id?: string) =>
  id ? trPatch(`/routes/${id}`, payload) : trPost('/routes', payload);
export const searchTransportStudents = (q: string) => tr('/students/search', { q });
export const fetchTransportAllocations = (params?: Record<string, unknown>) =>
  tr('/allocations', params);
export const saveTransportAllocation = (payload: unknown) => trPost('/allocations', payload);
export const bulkTransportAllocation = (payload: unknown) => trPost('/allocations/bulk', payload);
export const endTransportAllocation = (id: string, reason?: string) =>
  trPost(`/allocations/${id}/end`, { reason });
export const fetchTransportTrips = (params?: Record<string, unknown>) => tr('/trips', params);
export const generateTransportTrips = (payload: unknown) => trPost('/trips/generate', payload);
export const fetchTransportRoster = (id: string) => tr(`/trips/${id}/roster`);
export const transportTripAction = (id: string, action: string, payload?: unknown) =>
  trPost(`/trips/${id}/${action}`, payload ?? {});
export const transportBoarding = (id: string, payload: unknown) =>
  trPost(`/trips/${id}/boarding`, payload);
export const transportBulkAttendance = (id: string, payload: unknown) =>
  trPost(`/trips/${id}/bulk-attendance`, payload);
export const fetchTransportMaintenance = (vehicleId?: string) => tr('/maintenance', { vehicleId });
export const saveTransportMaintenance = (payload: unknown) => trPost('/maintenance', payload);
export const fetchTransportFuel = (vehicleId?: string) => tr('/fuel', { vehicleId });
export const saveTransportFuel = (payload: unknown) => trPost('/fuel', payload);
export const fetchTransportIncidents = () => tr('/incidents');
export const saveTransportIncident = (payload: unknown) => trPost('/incidents', payload);
export const resolveTransportIncident = (id: string, actionTaken?: string) =>
  trPost(`/incidents/${id}/resolve`, { actionTaken });
export const reportTransportBreakdown = (payload: unknown) => trPost('/breakdown', payload);
export const fetchTransportTracking = () => tr('/tracking');
export const fetchTransportGeofences = () => tr('/geofences');
export const saveTransportGeofence = (payload: unknown) => trPost('/geofences', payload);
export const fetchTransportFeePlans = () => tr('/fees/plans');
export const saveTransportFeePlan = (payload: unknown) => trPost('/fees/plans', payload);
export const saveTransportConcession = (payload: unknown) => trPost('/fees/concessions', payload);
export const fetchTransportRequests = (status?: string) => tr('/requests', { status });
export const saveTransportRequest = (payload: unknown) => trPost('/requests', payload);
export const reviewTransportRequest = (id: string, payload: unknown) =>
  trPost(`/requests/${id}/review`, payload);
export const fetchTransportAudit = () => tr('/audit');
export const importTransportRows = (payload: unknown) => trPost('/import', payload);
