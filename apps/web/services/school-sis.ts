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

export type SchoolSisSubject = {
  id: string;
  code: string;
  name: string;
};

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
  fromSectionId: string;
  toSectionId: string;
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
  };
}

export async function publishSchoolSisTimetable() {
  const { data } = await api.post('/v1/school-sis/timetable/publish');
  return data;
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
