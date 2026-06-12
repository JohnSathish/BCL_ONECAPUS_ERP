import type { PortalCalendarEvent } from '@/utils/portal-calendar';

export type StaffMeProfile = {
  id: string;
  employeeCode: string;
  fullName: string;
  photoUrl: string | null;
  email: string | null;
  mobile: string | null;
  staffType: string;
  employmentType: string;
  status: string;
  designation: string | null;
  department: string | null;
  departmentId: string | null;
  institutionName: string | null;
  campusName: string | null;
  joiningDate: string | null;
  qualification: string | null;
  specialization: string | null;
  experienceYears: number | null;
  biometricId: string | null;
  rfidNo: string | null;
  biometricSyncStatus: string | null;
  biometricDeviceId: string | null;
  isTeaching: boolean;
  isHod: boolean;
  isAdminStaff: boolean;
  additionalRoles: { code: string; label: string }[];
  greeting: string;
  online: boolean;
};

export type StaffAcademicContext = {
  session: string | null;
  cycle: string;
  activeSemesters: number[];
};

export type StaffDashboardKpis = {
  attendance: {
    presentDays: number;
    late: number;
    absent: number;
    percentage: number;
    todayCheckIn: string;
    todayCheckOut: string | null;
    device: string;
    status: string;
  };
  teachingLoad: {
    assignedSubjects: number;
    sections: number;
    weeklyClasses: number;
    weeklyWorkloadTarget?: number;
    weeklyWorkloadPercent?: number;
    credits: number;
  };
  leave: {
    casual: number;
    sick: number;
    earned: number;
    pendingRequests: number;
  };
  salary: {
    currentMonthSalary: number;
    payslipAvailable: boolean;
    lastPaymentDate: string | null;
    currency: string;
  };
  tasks: {
    pendingLessonPlans: number;
    attendancePending: number;
    examDutyAssigned: number;
    approvalRequests: number;
    lmsPendingEvaluations: number;
  };
};

export type StaffTimetableSlot = {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
  semesterNo: number | null;
  sectionCode: string | null;
  classroom: string | null;
  offeringSectionId: string | null;
  status: string;
};

export type StaffSubjectCard = {
  id: string;
  courseCode: string;
  courseTitle: string;
  semesterNo: number;
  sectionCode: string;
  studentCount: number;
  offeringSectionId: string | null;
  role?: string | null;
  allocationPercent?: number | null;
  weeklyHours?: number | null;
  canMarkAttendance?: boolean;
  canEnterInternalMarks?: boolean;
  canUploadLessonPlan?: boolean;
  canAccessSubjectWorkspace?: boolean;
  teachingTeam?: {
    staffProfileId: string;
    staffName?: string | null;
    shortCode?: string | null;
    role?: string | null;
  }[];
};

export type StaffDepartmentNotice = {
  id: string;
  title: string;
  body: string;
  link: string | null;
};

export type StaffLmsTasks = {
  assignmentsToEvaluate: number;
  notesPendingUpload: number;
  discussionReplies: number;
};

export type StaffPerformanceSnapshot = {
  classesThisWeek: number;
  attendanceSubmittedPercent: number;
  assignedSubjects: number;
  studentsTaught: number;
};

export type StaffPortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type StaffDashboardData = {
  profile: StaffMeProfile;
  academicContext: StaffAcademicContext;
  kpis: StaffDashboardKpis;
  lmsTasks?: StaffLmsTasks;
  departmentNotices?: StaffDepartmentNotice[];
  performanceSnapshot?: StaffPerformanceSnapshot;
  todaySchedule: StaffTimetableSlot[];
  subjects: StaffSubjectCard[];
  notifications: StaffPortalNotification[];
  unreadNotificationCount: number;
  calendarEvents?: PortalCalendarEvent[];
};

export type StaffPortalDocument = {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  verificationStatus?: string;
  createdAt: string;
};

export type StaffNavContext = {
  staffType: string;
  isTeaching: boolean;
  isHod: boolean;
  isAdminStaff: boolean;
  permissions?: string[];
};
