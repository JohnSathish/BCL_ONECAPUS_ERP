export type Institution = { id: string; name: string; code?: string | null };

export type Campus = {
  id: string;
  institutionId: string;
  name: string;
  code?: string | null;
};

export type DepartmentType =
  | 'ACADEMIC'
  | 'ARTS'
  | 'SCIENCE'
  | 'COMMERCE'
  | 'PROFESSIONAL'
  | 'INTERDISCIPLINARY'
  | 'ADMINISTRATIVE';

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type FacultyHodOption = {
  id: string;
  employeeCode: string;
  fullName?: string | null;
  departmentId?: string | null;
  portalUser?: { email: string } | null;
  user?: { email: string } | null;
};

export type Department = {
  id: string;
  institutionId: string;
  campusId?: string | null;
  name: string;
  code: string;
  departmentType: DepartmentType;
  hodId?: string | null;
  status: DepartmentStatus;
  institution?: { id: string; name: string; code?: string | null };
  campus?: { id: string; name: string; code?: string | null } | null;
  hod?: {
    id: string;
    employeeCode: string;
    fullName?: string | null;
    portalUser?: { email: string } | null;
    user?: { email: string } | null;
  } | null;
};

export type Semester = {
  id: string;
  academicYearId: string;
  name: string;
  sequence: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  semesters: Semester[];
};

export type SetupSummary = {
  institutions: number;
  campuses: number;
  departments: number;
  academicYears: number;
  semesters: number;
  cbcsEnabled: boolean;
};

export type AcademicSettings = {
  tenantId: string;
  cbcsEnabled: boolean;
  nepProfile: Record<string, unknown> | null;
  creditPolicy: {
    minCreditsPerSemester?: number;
    maxCreditsPerSemester?: number;
    minCreditsForDegree?: number;
    gradePointScale?: number;
    defaultSharedPoolCapacity?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export const DEPARTMENT_TYPE_OPTIONS: { value: DepartmentType; label: string }[] = [
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'ARTS', label: 'Arts / Humanities' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'INTERDISCIPLINARY', label: 'Interdisciplinary' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
];
