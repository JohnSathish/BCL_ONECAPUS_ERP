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
