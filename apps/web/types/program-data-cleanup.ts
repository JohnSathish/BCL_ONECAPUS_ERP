export type ProgramVersionUsage = {
  offerings: number;
  students: number;
  registrations: number;
  outcomeRuns: number;
  approvalPolicies: number;
  poolAssignments: number;
  semesterRules: number;
  deliverySections: number;
  staffAssignments: number;
  programOutcomes: number;
};

export type CleanupVersionRow = {
  id: string;
  version: number;
  status: string;
  programId: string;
  programCode: string;
  programName: string;
  programDeleted: boolean;
  usage: ProgramVersionUsage;
  safeToPurge: boolean;
  blockers: string[];
};

export type CleanupProgramRow = {
  id: string;
  code: string;
  name: string;
  departmentCode: string | null;
  looksLikeCourseCode: boolean;
  versions: CleanupVersionRow[];
  safeToRemove: boolean;
  blockers: string[];
};

export type ProgramDataCleanupReport = {
  unusedProgrammes: CleanupProgramRow[];
  orphanVersions: CleanupVersionRow[];
  emptyCurriculumVersions: CleanupVersionRow[];
};
