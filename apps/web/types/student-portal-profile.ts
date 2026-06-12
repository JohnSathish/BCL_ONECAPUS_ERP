export type StudentPortalProfile360 = {
  personal: {
    photoUrl: string | null;
    registrationNumber: string | null;
    rollNumber: string;
    enrollmentNumber: string;
    rfidNumber: string | null;
    admissionNumber: string | null;
    fullName: string;
    displayFullName: string;
    gender: string | null;
    dateOfBirth: string | null;
    bloodGroup: string | null;
    aadhaarMasked: string | null;
    category: string | null;
    religion: string | null;
    nationality: string;
  };
  academic: {
    programme: string | null;
    department: string | null;
    major: string | null;
    minor: string | null;
    subjects: { category: string; label: string; title: string }[];
    semester: number | null;
    shift: string | null;
    batch: string | null;
    academicYear: string | null;
    readOnly: boolean;
  };
  contact: {
    mobileNumber: string | null;
    alternateMobile: string | null;
    personalEmail: string | null;
    currentAddress: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      pinCode?: string | null;
    } | null;
    emergencyContact: string | null;
    editable: boolean;
  };
  parents: {
    fatherName: string | null;
    motherName: string | null;
    guardianName: string | null;
    parentMobile: string | null;
    fatherMobile?: string | null;
    motherMobile?: string | null;
    editable: boolean;
  };
  requiredDocuments?: {
    type: string;
    label: string;
    uploaded: boolean;
    verified: boolean;
  }[];
  profileCompletion?: {
    percent: number;
    missing: string[];
  };
  academicProgress?: {
    currentSemester: number;
    totalSemesters: number;
  };
  statistics?: {
    libraryBooks: number;
    certificates: number;
    assignments: number;
    attendance: number | null;
    cgpa: number | null;
  };
  achievements?: {
    code: string;
    label: string;
    earned: boolean;
  }[];
  recentActivity?: {
    id: string;
    type: string;
    title: string;
    occurredAt: string;
  }[];
  documents: {
    id: string;
    documentType: string;
    fileName: string;
    verificationStatus: string;
    uploadedAt: string;
  }[];
  rfid: {
    assigned: boolean;
    rfidNumber: string | null;
    cardNumber: string;
    issueDate: string | null;
  };
  attendance: {
    overall: number | null;
    subjects: { id?: string; label?: string; courseName?: string; percentage: number }[];
    eligibility: string | null;
    readOnly: boolean;
  };
  fees: {
    currentDue: number;
    paidAmount: number;
    status: string;
    readOnly: boolean;
  };
  certificates: {
    id: string;
    type: string;
    certificateNo: string;
    issuedAt: string;
  }[];
  changeRequests: {
    id: string;
    section: string;
    status: string;
    changes: Record<string, unknown>;
    submittedAt: string;
  }[];
  sessions: {
    lastLoginAt: string | null;
    devices: {
      id: string;
      label: string;
      userAgent: string;
      ipAddress: string;
      lastActiveAt: string;
      isCurrent: boolean;
    }[];
  };
};

export type StudentNotificationPrefs = {
  examNotifications: boolean;
  attendanceAlerts: boolean;
  feeReminders: boolean;
  timetableUpdates: boolean;
  lmsNotifications: boolean;
  certificateUpdates: boolean;
};

export type StudentPrivacyPrefs = {
  showMobileToFaculty: boolean;
  showEmailToFaculty: boolean;
  hidePersonalInfo: boolean;
};
