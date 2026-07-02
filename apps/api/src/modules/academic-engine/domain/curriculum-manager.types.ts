import type { CourseEligibilityRules } from './course-eligibility.types';

export type CurriculumManagerCourseRow = {
  courseId: string;
  code: string;
  title: string;
  displayOrder: number;
  eligibilityRules: CourseEligibilityRules;
  eligibilitySummary: string;
};

export type CurriculumManagerPoolOption = {
  id: string;
  poolName: string;
  courseCount: number;
  assigned: boolean;
  shiftId: string | null;
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
  availablePools: CurriculumManagerPoolOption[];
};

export type CurriculumManagerMajorDepartment = {
  departmentName: string;
  papers: Array<{ code: string; title: string; offeringId: string }>;
  internship?: {
    code: string;
    title: string;
    offeringId: string;
  } | null;
};

export type CurriculumManagerMinorDepartment = {
  departmentName: string;
  paper: { code: string; title: string; offeringId: string };
};

export type CurriculumManagerView = {
  shift: { id: string; code: string; name: string };
  programVersion: {
    id: string;
    code: string;
    name: string;
    version: number;
  };
  semesterNo: number;
  curriculumMode: 'shift-pools' | 'direct-offerings';
  shiftIndependent: boolean;
  semesterSummary: string;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categories: CurriculumManagerCategoryBlock[];
  majorDepartments: CurriculumManagerMajorDepartment[];
  minorDepartments: CurriculumManagerMinorDepartment[];
  minorEnabled: boolean;
  configurationStatus: 'complete' | 'partial' | 'empty';
  missingCategories: string[];
};
