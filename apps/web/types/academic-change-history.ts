export type AcademicChangeType =
  | 'PROGRAMME_CHANGED'
  | 'DEPARTMENT_CHANGED'
  | 'SHIFT_CHANGED'
  | 'MAJOR_CHANGED'
  | 'MINOR_CHANGED'
  | 'MDC_CHANGED'
  | 'AEC_CHANGED'
  | 'SEC_CHANGED'
  | 'VAC_CHANGED'
  | 'VTC_CHANGED'
  | 'SEMESTER_CHANGED'
  | 'SUBJECT_ADDED'
  | 'SUBJECT_REMOVED'
  | 'SUBJECT_REPLACED'
  | 'REGISTRATION_UPDATED'
  | 'ROLL_NUMBER_CHANGED';

export type AcademicChangeHistoryItem = {
  id: string;
  studentId: string;
  semesterId?: string | null;
  academicYearId?: string | null;
  changeType: AcademicChangeType;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changedById?: string | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  changedOn: string;
  reason?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  browser?: string | null;
  createdAt: string;
};

export type AcademicChangeHistoryList = {
  items: AcademicChangeHistoryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AcademicChangeHistoryQuery = {
  page?: number;
  limit?: number;
  semesterId?: string;
  academicYearId?: string;
  changeType?: string;
  changedById?: string;
  from?: string;
  to?: string;
};
