export type ReportBucket = {
  key: string;
  label: string;
  count: number;
  percentage?: number;
};

export type StudentReportDashboard = {
  totalStudents: number;
  activeStudents: number;
  programmeWise: ReportBucket[];
  semesterWise: ReportBucket[];
  shiftWise: ReportBucket[];
  genderWise: ReportBucket[];
  categoryWise: ReportBucket[];
  updatedAt: string;
};

export type DistributionReport = {
  title: string;
  total: number;
  buckets: ReportBucket[];
  crossTabs?: { label: string; buckets: ReportBucket[] }[];
};

export type CombinationReport = {
  total: number;
  combinations: {
    major: string;
    minor: string;
    count: number;
  }[];
};

export type AgeReport = {
  total: number;
  averageAge: number | null;
  youngest: { name: string; age: number } | null;
  oldest: { name: string; age: number } | null;
  buckets: ReportBucket[];
};

export type SubjectStrengthSubjectRow = {
  offeringId: string;
  courseCode: string;
  courseTitle: string;
  studentCount: number;
};

export type SubjectStrengthCategoryGroup = {
  category: string;
  label: string;
  subjects: SubjectStrengthSubjectRow[];
};

export type SubjectStrengthSemesterGroup = {
  semesterSequence: number;
  label: string;
  totalStudents: number;
  categories: SubjectStrengthCategoryGroup[];
};

export type SubjectStrengthReport = {
  title: string;
  totalEnrollments: number;
  semesters: SubjectStrengthSemesterGroup[];
};

export type DepartmentStrengthRow = {
  departmentId: string | null;
  departmentName: string;
  majorSubjectId: string;
  majorSubjectName: string;
  studentCount: number;
};

export type DepartmentStrengthReport = {
  title: string;
  academicYearLabel: string | null;
  semesterLabel: string | null;
  semesterSequence: number | null;
  summary: {
    totalDepartments: number;
    totalStudents: number;
  };
  rows: DepartmentStrengthRow[];
};

export type DepartmentStrengthStudentRow = {
  studentId: string;
  enrollmentNumber: string;
  rollNumber: string;
  fullName: string;
  majorDepartment: string;
  minorDepartment: string;
  mobileNumber: string;
  admissionStatus: string;
};

export type DepartmentStrengthStudentsReport = {
  title: string;
  departmentName: string;
  majorSubjectName: string;
  semesterLabel: string | null;
  total: number;
  students: DepartmentStrengthStudentRow[];
};

export type DepartmentSubjectSummaryLine = {
  category: string;
  categoryLabel: string;
  label: string;
  courseCode: string;
  courseTitle: string;
  majorPaperIndex: number | null;
  studentCount: number;
};

export type DepartmentSubjectSummaryDept = {
  departmentId: string | null;
  departmentName: string;
  lines: DepartmentSubjectSummaryLine[];
};

export type DepartmentSubjectSummaryReport = {
  title: string;
  semesterLabel: string | null;
  departments: DepartmentSubjectSummaryDept[];
};
