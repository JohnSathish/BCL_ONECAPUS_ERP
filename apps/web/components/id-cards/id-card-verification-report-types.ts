export type IdVerificationReportRow = {
  studentId: string;
  photoUrl: string | null;
  fullName: string;
  registrationNumber: string | null;
  rollNumber: string;
  department: string | null;
  programme: string | null;
  semester: string | null;
  gender: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  rfidNumber: string | null;
  validToLabel: string | null;
  emergencyContact: string | null;
  hasPhoto: boolean;
};

export type IdVerificationReportSection = {
  departmentName: string;
  rows: IdVerificationReportRow[];
};

export type IdVerificationReportMeta = {
  institutionName: string;
  campusName?: string | null;
  logoUrl?: string | null;
  reportTitle: string;
  semester?: string | null;
  sessionName?: string | null;
  generatedAt: string;
  totalStudents: number;
};
