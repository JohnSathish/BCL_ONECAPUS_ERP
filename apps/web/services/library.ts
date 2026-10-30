import { api } from '@/services/api';
import type {
  LibraryAccessDeskDashboard,
  LibraryActivityItem,
  LibraryAssistantResponse,
  LibraryBookPreview,
  LibraryCirculationDeskContext,
  LibraryCopyQr,
  LibraryBook,
  LibraryBookListResponse,
  LibraryCategory,
  LibraryCopyIncident,
  LibraryDashboard,
  LibraryDigitalAsset,
  LibraryDigitalAssetListResponse,
  LibraryFine,
  LibraryIssuePreview,
  LibraryLoan,
  LibraryMemberDetail,
  LibraryMemberListResponse,
  LibraryMemberSummary,
  LibraryMemberSummaryCards,
  LibraryMemberSyncResult,
  LibraryNaacReportBundle,
  LibraryNextAccession,
  LibraryReadingAnalytics,
  LibraryQrPass,
  LibraryReadingZone,
  LibraryReservation,
  LibraryReservationQueueGroup,
  LibraryRenewPreview,
  LibraryReturnPreview,
  LibraryRecommendedBook,
  LibrarySearchResult,
  StudentLibraryDashboard,
  LibrarySettings,
  LibraryVisit,
  LibraryVisitor,
  OccupancySnapshot,
  ResearchItemListResponse,
  ResearchRepositoryItem,
  ScanResult,
} from '@/types/library';

const base = '/v1/library';

export const fetchLibraryDashboard = (period: 'today' | 'week' | 'month' = 'today') =>
  api.get<LibraryDashboard>(`${base}/dashboard`, { params: { period } }).then((r) => r.data);

export const fetchLibraryDashboardActivity = (
  limit = 20,
  scope: 'today' | 'recent' = 'today',
  action?: 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE',
) =>
  api
    .get<LibraryActivityItem[]>(`${base}/dashboard/activity`, {
      params: { limit, scope, action },
    })
    .then((r) => r.data);

export type LibraryDashboardUsage = {
  from?: string;
  days: number;
  newMembers: null;
  series: { date: string; label: string; issued: number; returned: number }[];
  topBooks: { bookId: string; title: string; issues: number; share: number }[];
};

export const fetchLibraryDashboardUsage = (params: { days?: number; from?: string; to?: string }) =>
  api.get<LibraryDashboardUsage>(`${base}/dashboard/usage`, { params }).then((r) => r.data);

export const fetchLibraryMemberSummary = (scanCode: string) =>
  api
    .get<LibraryMemberSummary>(`${base}/circulation/member-summary`, {
      params: { scanCode },
    })
    .then((r) => r.data);

export const fetchLibraryBookPreview = (barcode: string) =>
  api
    .get<LibraryBookPreview>(`${base}/circulation/book-preview`, { params: { barcode } })
    .then((r) => r.data);

export const fetchLibraryIssuePreview = (memberScan: string, copyBarcode: string) =>
  api
    .get<LibraryIssuePreview>(`${base}/circulation/issue-preview`, {
      params: { memberScan, copyBarcode },
    })
    .then((r) => r.data);

export const fetchLibraryDeskContext = () =>
  api.get<LibraryCirculationDeskContext>(`${base}/circulation/desk-context`).then((r) => r.data);

export const fetchLibraryReturnPreview = (barcode: string) =>
  api
    .get<LibraryReturnPreview>(`${base}/circulation/return-preview`, { params: { barcode } })
    .then((r) => r.data);

export const fetchLibraryRenewPreview = (barcode: string) =>
  api
    .get<LibraryRenewPreview>(`${base}/circulation/renew-preview`, { params: { barcode } })
    .then((r) => r.data);

export const fetchLibraryCopyQr = (copyId: string) =>
  api.get<LibraryCopyQr>(`${base}/copies/${copyId}/qr`).then((r) => r.data);

export const scanLibraryAccess = (scanCode: string) =>
  api.post<ScanResult>(`${base}/access/scan`, { scanCode }).then((r) => r.data);

export const fetchLibraryOccupancy = () =>
  api.get<OccupancySnapshot>(`${base}/access/occupancy`).then((r) => r.data);

export const fetchLibraryAccessDeskDashboard = () =>
  api.get<LibraryAccessDeskDashboard>(`${base}/access/desk-dashboard`).then((r) => r.data);

export const fetchLibraryVisits = (params?: Record<string, string | number | undefined>) =>
  api
    .get<{
      items: LibraryVisit[];
      total: number;
      page: number;
      limit: number;
      from: number;
      to: number;
      stats: import('@/types/library').LibraryVisitStats;
    }>(`${base}/access/visits`, { params: compactParams(params) })
    .then((r) => r.data);

export const recordLibraryVisitExit = (id: string) =>
  api.post<LibraryVisit>(`${base}/access/visits/${id}/exit`).then((r) => r.data);

export const registerLibraryVisitor = (payload: {
  fullName: string;
  mobile?: string;
  institution?: string;
  purpose?: string;
}) => api.post<LibraryVisitor>(`${base}/visitors`, payload).then((r) => r.data);

export const registerLibraryWalkIn = (payload: {
  fullName: string;
  mobile?: string;
  institution?: string;
  purpose?: string;
}) =>
  api.post<{ visitor: LibraryVisitor }>(`${base}/visitors/walk-in`, payload).then((r) => r.data);

export const fetchLibraryVisitors = () =>
  api.get<LibraryVisitor[]>(`${base}/visitors`).then((r) => r.data);

export const fetchLibraryCategories = () =>
  api.get<LibraryCategory[]>(`${base}/categories`).then((r) => r.data);

export const fetchLibraryBooks = (params?: Record<string, string | number | undefined>) =>
  api.get<LibraryBookListResponse>(`${base}/books`, { params }).then((r) => r.data);

export const fetchLibraryCatalogueSummary = () =>
  api
    .get<import('@/types/library').LibraryCatalogueSummary>(`${base}/books/summary`)
    .then((r) => r.data);

export const fetchLibraryCatalogueOptions = () =>
  api
    .get<{
      categories: LibraryCategory[];
      departments: { id: string; name: string }[];
      subjects: string[];
      languages: string[];
      years: string[];
    }>(`${base}/books/options`)
    .then((r) => r.data);

export const fetchLibraryBook = (id: string) =>
  api.get<LibraryBook>(`${base}/books/${id}`).then((r) => r.data);

export const createLibraryBook = (payload: Record<string, unknown>) =>
  api.post<LibraryBook>(`${base}/books`, payload).then((r) => r.data);

export const updateLibraryBook = (id: string, payload: Record<string, unknown>) =>
  api.patch<LibraryBook>(`${base}/books/${id}`, payload).then((r) => r.data);

export const addLibraryCopy = (payload: { bookId: string; barcode: string; copyNumber?: number }) =>
  api.post(`${base}/copies`, payload).then((r) => r.data);

export const issueLibraryBook = (memberScan: string, copyBarcode: string, receiptNo?: string) =>
  api
    .post<{ loan: LibraryLoan }>(`${base}/circulation/issue`, {
      memberScan,
      copyBarcode,
      receiptNo,
    })
    .then((r) => r.data);

export const returnLibraryBook = (copyBarcode: string) =>
  api
    .post<{
      loan: LibraryLoan;
      fine: { id: string; amount: number | string } | null;
      overdueDays: number;
    }>(`${base}/circulation/return`, { copyBarcode })
    .then((r) => r.data);

export const fetchOverdueLoans = () =>
  api.get<LibraryLoan[]>(`${base}/circulation/overdue`).then((r) => r.data);

export const fetchActiveLoans = () =>
  api.get<LibraryLoan[]>(`${base}/circulation/active`).then((r) => r.data);

export const reserveLibraryBook = (bookId: string, studentId?: string) =>
  api
    .post<LibraryReservation>(`${base}/circulation/reserve`, { bookId, studentId })
    .then((r) => r.data);

export const cancelLibraryReservation = (id: string) =>
  api.post(`${base}/circulation/reserve/${id}/cancel`).then((r) => r.data);

export const fetchLibraryReservations = () =>
  api.get<LibraryReservation[]>(`${base}/reservations`).then((r) => r.data);

export const fetchLibraryReservationSummary = () =>
  api
    .get<import('@/types/library').LibraryReservationSummary>(`${base}/reservations/summary`)
    .then((r) => r.data);

export const fetchLibraryReservationList = (params?: Record<string, string | number | undefined>) =>
  api
    .get<import('@/types/library').LibraryReservationListResponse>(`${base}/reservations/list`, {
      params,
    })
    .then((r) => r.data);

export const searchLibraryReservationStudents = (search: string) =>
  api
    .get<import('@/types/library').LibraryReservationStudent[]>(`${base}/reservations/students`, {
      params: { search },
    })
    .then((r) => r.data);

export const fetchLibraryReservationQueue = () =>
  api.get<LibraryReservationQueueGroup[]>(`${base}/reservations/queue`).then((r) => r.data);

export const fetchLibraryCopyIncidents = (params?: { status?: string; incidentType?: string }) =>
  api.get<LibraryCopyIncident[]>(`${base}/circulation/incidents`, { params }).then((r) => r.data);

export const fetchLibraryIncidentSummary = () =>
  api
    .get<import('@/types/library').LibraryIncidentSummary>(`${base}/circulation/incidents/summary`)
    .then((r) => r.data);

export const fetchLibraryIncidentList = (params?: Record<string, string | number | undefined>) =>
  api
    .get<import('@/types/library').LibraryIncidentListResponse>(
      `${base}/circulation/incidents/list`,
      {
        params,
      },
    )
    .then((r) => r.data);

export const previewLibraryIncidentCopy = (code: string) =>
  api
    .get<import('@/types/library').LibraryIncidentCopyPreview>(
      `${base}/circulation/incidents/copy`,
      {
        params: { code },
      },
    )
    .then((r) => r.data);

export const replaceLibraryIncidentByBarcode = (payload: {
  copyBarcode: string;
  notes?: string;
  replacementBarcode?: string;
}) =>
  api
    .post<LibraryCopyIncident>(`${base}/circulation/incidents/replace-by-barcode`, payload)
    .then((r) => r.data);

export const reportLibraryCopyIncident = (payload: {
  copyBarcode: string;
  incidentType: 'LOST' | 'DAMAGED';
  notes?: string;
  chargeAmount?: number;
}) => api.post<LibraryCopyIncident>(`${base}/circulation/incidents`, payload).then((r) => r.data);

export const replaceLibraryCopyIncident = (
  id: string,
  payload?: { replacementBarcode?: string; notes?: string },
) =>
  api
    .post<LibraryCopyIncident>(`${base}/circulation/incidents/${id}/replace`, payload ?? {})
    .then((r) => r.data);

export const resolveLibraryCopyIncident = (id: string, notes?: string) =>
  api
    .post<LibraryCopyIncident>(`${base}/circulation/incidents/${id}/resolve`, { notes })
    .then((r) => r.data);

export const notifyLibraryDueTomorrow = () =>
  api
    .post<{
      checked: number;
      sent: number;
      skipped?: boolean;
    }>(`${base}/circulation/notify-due-tomorrow`)
    .then((r) => r.data);

export const fetchLibrarySettings = () =>
  api.get<LibrarySettings>(`${base}/settings`).then((r) => r.data);

export const updateLibrarySettings = (payload: Partial<LibrarySettings>) =>
  api.patch<LibrarySettings>(`${base}/settings`, payload).then((r) => r.data);

export const fetchLibraryAssistantPrompts = () =>
  api.get<string[]>(`${base}/assistant/prompts`).then((r) => r.data);

export const askLibraryAssistant = (question: string) =>
  api.post<LibraryAssistantResponse>(`${base}/assistant/ask`, { question }).then((r) => r.data);

export const fetchMyLibraryDashboard = () =>
  api.get<StudentLibraryDashboard>(`${base}/me/dashboard`).then((r) => r.data);

export const fetchMyLibraryRecommendations = (limit = 12) =>
  api
    .get<LibraryRecommendedBook[]>(`${base}/me/recommendations`, {
      params: { limit },
    })
    .then((r) => r.data);

export const fetchMyLibraryVisits = () =>
  api.get<{ items: LibraryVisit[]; totalVisits: number }>(`${base}/me/visits`).then((r) => r.data);

export const fetchMyLibraryLoans = () =>
  api.get<LibraryLoan[]>(`${base}/me/loans`).then((r) => r.data);

export const fetchMyLibraryReservations = () =>
  api.get<LibraryReservation[]>(`${base}/me/reservations`).then((r) => r.data);

export const fetchStudentLibraryVisits = (studentId: string) =>
  api
    .get<{ items: LibraryVisit[]; totalVisits: number }>(`${base}/students/${studentId}/visits`)
    .then((r) => r.data);

export const fetchLibraryReport = (path: string, params?: Record<string, string | undefined>) =>
  api.get<unknown>(`${base}/reports/${path}`, { params }).then((r) => r.data);

export const fetchLibraryNaacReportSummary = (params?: {
  from?: string;
  to?: string;
  academicYear?: string;
  departmentId?: string;
  categoryId?: string;
  medium?: 'ALL' | 'PHYSICAL' | 'DIGITAL';
}) =>
  api.get<LibraryNaacReportBundle>(`${base}/reports/naac/summary`, { params }).then((r) => r.data);

export const downloadLibraryNaacReport = (
  format: 'pdf' | 'xlsx' | 'csv',
  params?: {
    from?: string;
    to?: string;
    academicYear?: string;
    departmentId?: string;
    categoryId?: string;
    medium?: 'ALL' | 'PHYSICAL' | 'DIGITAL';
  },
) =>
  api
    .get(`${base}/reports/naac/export`, {
      params: { ...params, format },
      responseType: 'blob',
    })
    .then((r) => r.data as Blob);

export const linkLibraryNaacEvidence = (payload: {
  academicYear: string;
  from?: string;
  to?: string;
  criterion?: number;
  metricCode?: string;
  format?: 'pdf' | 'xlsx' | 'csv';
  evidenceNotes?: string;
}) =>
  api
    .post<{
      tag: { id: string };
      reportId: string;
      filename: string;
    }>(`${base}/reports/naac/link-evidence`, payload)
    .then((r) => r.data);

export const fetchLibraryFootfall = () =>
  api.get<LibraryDashboard['footfallTrends']>(`${base}/analytics/footfall`).then((r) => r.data);

export const downloadLibraryReportCsv = (
  path: string,
  params?: Record<string, string | undefined>,
) =>
  api
    .get<string>(`${base}/reports/export/${path}`, { params, responseType: 'text' as const })
    .then((r) => r.data);

export const fetchDigitalSummary = () =>
  api
    .get<import('@/types/library').LibraryDigitalSummary>(`${base}/digital-assets/summary`)
    .then((r) => r.data);

export const fetchDigitalAssets = (params?: Record<string, string | number | undefined>) =>
  api
    .get<LibraryDigitalAssetListResponse>(`${base}/digital-assets`, { params })
    .then((r) => r.data);

export const fetchPopularDigitalAssets = () =>
  api.get<LibraryDigitalAsset[]>(`${base}/digital-assets/popular`).then((r) => r.data);

export const createDigitalAsset = (form: FormData) =>
  api.post<LibraryDigitalAsset>(`${base}/digital-assets`, form).then((r) => r.data);

export const publishDigitalAsset = (id: string) =>
  api.post(`${base}/digital-assets/${id}/publish`).then((r) => r.data);

export const syncQuestionBankToLibrary = () =>
  api.post(`${base}/digital-assets/sync/question-bank`).then((r) => r.data);

export const downloadDigitalAsset = (id: string) =>
  api
    .get(`${base}/digital-assets/${id}/download`, { responseType: 'blob' })
    .then((r) => r.data as Blob);

export const previewDigitalAsset = (id: string) =>
  api
    .get(`${base}/digital-assets/${id}/preview`, { responseType: 'blob' })
    .then((r) => r.data as Blob);

export const fetchResearchItems = (params?: Record<string, string | number | undefined>) =>
  api.get<ResearchItemListResponse>(`${base}/research`, { params }).then((r) => r.data);

export const fetchPendingResearch = () =>
  api.get<ResearchRepositoryItem[]>(`${base}/research/pending`).then((r) => r.data);

export const fetchPopularResearch = () =>
  api.get<ResearchRepositoryItem[]>(`${base}/research/popular`).then((r) => r.data);

export const createResearchItem = (form: FormData) =>
  api.post<ResearchRepositoryItem>(`${base}/research`, form).then((r) => r.data);

export const submitResearchItem = (id: string) =>
  api.post(`${base}/research/${id}/submit`).then((r) => r.data);

export const reviewResearchItem = (id: string, action: 'APPROVE' | 'REJECT', comments?: string) =>
  api.post(`${base}/research/${id}/review`, { action, comments }).then((r) => r.data);

export const downloadResearchItem = (id: string) =>
  api.get(`${base}/research/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob);

export const fetchMyLibraryQr = () => api.get<LibraryQrPass>(`${base}/me/qr`).then((r) => r.data);

export const selfCheckInLibrary = (zoneId?: string) =>
  api.post<ScanResult>(`${base}/me/check-in`, { zoneId }).then((r) => r.data);

export const fetchLibraryZones = () =>
  api.get<LibraryReadingZone[]>(`${base}/zones`).then((r) => r.data);

export const fetchLibraryZoneOccupancy = () =>
  api.get<LibraryReadingZone[]>(`${base}/zones/occupancy`).then((r) => r.data);

export const searchLibrary = (
  q: string,
  limit = 20,
  type?: 'ALL' | 'BOOK' | 'DIGITAL' | 'RESEARCH',
) =>
  api
    .get<LibrarySearchResult>(`${base}/search`, { params: { q, limit, type } })
    .then((r) => r.data);

export const notifyLibraryOverdue = () =>
  api
    .post<{
      checked: number;
      sent: number;
      skipped?: boolean;
    }>(`${base}/circulation/notify-overdue`)
    .then((r) => r.data);

export const fetchLibraryFines = (status?: 'UNPAID' | 'PAID' | 'WAIVED' | 'ALL') =>
  api
    .get<LibraryFine[]>(`${base}/circulation/fines`, { params: status ? { status } : {} })
    .then((r) => r.data);

export const payLibraryFine = (id: string, notes?: string) =>
  api.post(`${base}/circulation/fines/${id}/pay`, { notes }).then((r) => r.data);

export const waiveLibraryFine = (id: string, reason?: string) =>
  api.post(`${base}/circulation/fines/${id}/waive`, { reason }).then((r) => r.data);

export const renewLibraryLoan = (copyBarcode: string) =>
  api.post<LibraryLoan>(`${base}/circulation/renew`, { copyBarcode }).then((r) => r.data);

export const accrueLibraryFines = () =>
  api
    .post<{ checked: number; updated: number }>(`${base}/circulation/accrue-fines`)
    .then((r) => r.data);

export const fetchMyLibraryFines = () =>
  api.get<LibraryFine[]>(`${base}/me/fines`).then((r) => r.data);

export const fetchLibraryDepartmentHeatmap = () =>
  api
    .get<NonNullable<LibraryDashboard['departmentHeatmap']>>(`${base}/analytics/department-heatmap`)
    .then((r) => r.data);

export const fetchLibraryGenderTrends = () =>
  api
    .get<NonNullable<LibraryDashboard['genderTrends']>>(`${base}/analytics/gender-trends`)
    .then((r) => r.data);

export const fetchLibraryReportsDesk = (params: {
  days?: number;
  from?: string;
  to?: string;
  year?: number;
}) =>
  api
    .get<import('@/types/library').LibraryReportsDesk>(`${base}/reports/overview`, { params })
    .then((r) => r.data);

export const fetchLibraryReadingAnalytics = (params: {
  days?: number;
  from?: string;
  to?: string;
}) => api.get<LibraryReadingAnalytics>(`${base}/analytics/reading`, { params }).then((r) => r.data);

export const fetchLibraryMembers = (params?: Record<string, string | number | undefined>) =>
  api
    .get<LibraryMemberListResponse>(`${base}/members`, { params: compactParams(params) })
    .then((r) => r.data);

export const fetchLibraryMemberSummaryCards = () =>
  api.get<LibraryMemberSummaryCards>(`${base}/members/summary`).then((r) => r.data);

export const fetchLibraryMemberDetail = (
  memberId: string,
  memberType: string,
  loans?: 'recent' | 'all',
) =>
  api
    .get<LibraryMemberDetail>(`${base}/members/${memberId}`, {
      params: compactParams({ memberType, loans }),
    })
    .then((r) => r.data);

export const syncLibraryMembers = (scope: 'ALL' | 'STUDENTS' | 'FACULTY' | 'STAFF') =>
  api.post<LibraryMemberSyncResult>(`${base}/members/sync`, { scope }).then((r) => r.data);

export const blockLibraryMember = (
  memberId: string,
  payload: { memberType: string; reason: string; note?: string },
) => api.post(`${base}/members/${memberId}/block`, payload).then((r) => r.data);

export const unblockLibraryMember = (
  memberId: string,
  payload: { memberType: string; reason: string },
) => api.post(`${base}/members/${memberId}/unblock`, payload).then((r) => r.data);

export const updateLibraryMemberPrivileges = (
  memberId: string,
  payload: {
    memberType: string;
    loanLimit?: number | null;
    loanDays?: number | null;
    maxRenewals?: number | null;
    fineExempt?: boolean;
    expiresAt?: string | null;
  },
) => api.patch(`${base}/members/${memberId}/privileges`, payload).then((r) => r.data);

export const bulkLibraryMembers = (payload: {
  action: 'ACTIVATE' | 'BLOCK' | 'UNBLOCK' | 'EXPIRY' | 'SYNC';
  members: { memberId: string; memberType: string }[];
  reason?: string;
  note?: string;
  expiresAt?: string | null;
}) =>
  api
    .post<
      | LibraryMemberSyncResult
      | { processed: number; failed: { memberId: string; message: string }[] }
    >(`${base}/members/bulk`, payload)
    .then((r) => r.data);

export const downloadLibraryMemberRegister = (
  format: 'csv' | 'xlsx' | 'pdf',
  params?: Record<string, string | number | undefined>,
) =>
  api
    .get(`${base}/members/export`, {
      params: compactParams({ ...params, format }),
      responseType: 'blob',
    })
    .then((r) => r.data as Blob);

export const fetchNextAccessionNo = () =>
  api.get<LibraryNextAccession>(`${base}/accession/next`).then((r) => r.data);

export const createAccessionBook = (payload: Record<string, unknown>) =>
  api.post<LibraryBook>(`${base}/books/accession`, payload).then((r) => r.data);

export const updateAccessionWorkflow = (bookId: string, payload: Record<string, unknown>) =>
  api.patch<LibraryBook>(`${base}/books/${bookId}/accession`, payload).then((r) => r.data);

export const searchLibrarySuggestions = (q: string) =>
  api
    .get<
      { label: string; type: string; id: string; meta: string }[]
    >(`${base}/search/suggestions`, { params: { q, limit: 8 } })
    .then((r) => r.data);

function compactParams(params?: Record<string, string | number | undefined>) {
  const next: Record<string, string | number> = {};
  if (!params) return next;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === 'ALL') continue;
    next[key] = value;
  }
  return next;
}

export const fetchEntryExitFilters = () =>
  api
    .get<{
      departments: { id: string; name: string }[];
      programs: { id: string; name: string }[];
    }>(`${base}/reports/entry-exit/filters`)
    .then((r) => r.data);

export const fetchEntryExitSummary = (params?: Record<string, string | number | undefined>) =>
  api
    .get<import('@/types/library').EntryExitSummary>(`${base}/reports/entry-exit/summary`, {
      params: compactParams(params),
    })
    .then((r) => r.data);

export const fetchEntryExitVisits = (params?: Record<string, string | number | undefined>) =>
  api
    .get<{
      items: import('@/types/library').EntryExitVisitRow[];
      total: number;
      page: number;
      limit: number;
    }>(`${base}/reports/entry-exit/visits`, { params: compactParams(params) })
    .then((r) => r.data);

export const fetchEntryExitInside = (params?: Record<string, string | number | undefined>) =>
  api
    .get<{
      items: import('@/types/library').EntryExitVisitRow[];
      total: number;
    }>(`${base}/reports/entry-exit/currently-inside`, { params: compactParams(params) })
    .then((r) => r.data);

export const fetchEntryExitDepartments = (params?: Record<string, string | number | undefined>) =>
  api
    .get<{
      rows: {
        departmentId: string | null;
        department: string;
        visits: number;
        entries: number;
        exits: number;
        currentlyInside: number;
        averageStayMinutes: number;
        maximumStayMinutes: number;
      }[];
    }>(`${base}/reports/entry-exit/departments`, { params: compactParams(params) })
    .then((r) => r.data);

export const fetchEntryExitHourly = (params?: Record<string, string | number | undefined>) =>
  api
    .get<{
      buckets: { hour: number; label: string; entries: number; exits: number; footfall: number }[];
      peakHour: { label: string; entries: number };
    }>(`${base}/reports/entry-exit/hourly`, { params: compactParams(params) })
    .then((r) => r.data);

export const fetchEntryExitInsights = (params?: Record<string, string | number | undefined>) =>
  api
    .get<Record<string, unknown>>(`${base}/reports/entry-exit/insights`, {
      params: compactParams(params),
    })
    .then((r) => r.data);

export const fetchEntryExitStudentHistory = (
  studentId: string,
  params?: Record<string, string | number | undefined>,
) =>
  api
    .get(`${base}/reports/entry-exit/students/${studentId}/history`, {
      params: compactParams(params),
    })
    .then((r) => r.data);

const kohaBase = `${base}/koha-import`;
const kohaTimeout = 600_000;

export type KohaImportBatch = {
  id: string;
  importName: string;
  sourceSystem: string;
  uploadedFileName: string;
  status: string;
  totalBibliographicRecords: number;
  totalPhysicalCopies: number;
  validRecords: number;
  invalidRecords: number;
  duplicateCandidates: number;
  missingAccessionNumbers: number;
  missingBarcodes: number;
  mappedDepartments: number;
  unmappedCollectionCodes: number;
  needsReview: number;
  notApplicable: number;
  importedBooks: number;
  importedCopies: number;
  skippedRecords: number;
  failedRecords: number;
  progress: number | null;
  notes: string[];
  fieldMap: { source: string; destination: string }[];
  detectedBookHeaders: string[];
  detectedCopyHeaders: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type KohaCollectionMapping = {
  id: string | null;
  sourceCollectionCode: string;
  sourceCollectionDescription: string;
  copyCount: number;
  departmentId: string | null;
  mappingStatus: 'MAPPED' | 'NEEDS_REVIEW' | 'UNMAPPED' | 'NOT_APPLICABLE';
  mappingMethod: string;
  verifiedAt: string | null;
};

export const fetchKohaImportBatches = () =>
  api.get<{ items: KohaImportBatch[] }>(`${kohaBase}/batches`).then((r) => r.data);

export const fetchKohaImportBatch = (id: string) =>
  api.get<KohaImportBatch>(`${kohaBase}/${id}`).then((r) => r.data);

export const uploadKohaCatalogue = (file: File, importName?: string) => {
  const body = new FormData();
  body.append('file', file);
  if (importName?.trim()) body.append('importName', importName.trim());
  return api
    .post<KohaImportBatch>(`${kohaBase}/upload`, body, { timeout: kohaTimeout })
    .then((r) => r.data);
};

export const fetchKohaMappings = (id: string) =>
  api
    .get<{
      departments: { id: string; name: string; code: string }[];
      items: KohaCollectionMapping[];
    }>(`${kohaBase}/${id}/mappings`)
    .then((r) => r.data);

export const updateKohaMapping = (
  id: string,
  payload: { mappingStatus: KohaCollectionMapping['mappingStatus']; departmentId?: string | null },
) => api.patch(`${kohaBase}/mappings/${id}`, payload).then((r) => r.data);

export const dryRunKohaImport = (id: string) =>
  api.post<KohaImportBatch>(`${kohaBase}/${id}/dry-run`).then((r) => r.data);

export const sampleKohaImport = (id: string) =>
  api
    .post<KohaImportBatch>(`${kohaBase}/${id}/sample`, undefined, { timeout: kohaTimeout })
    .then((r) => r.data);

export const startKohaImport = (id: string) =>
  api.post<KohaImportBatch>(`${kohaBase}/${id}/import`, { approved: true }).then((r) => r.data);

export const retryKohaImport = (id: string) =>
  api.post<KohaImportBatch>(`${kohaBase}/${id}/retry`, { approved: true }).then((r) => r.data);

export const downloadKohaReport = (id: string, kind: 'validation' | 'errors') =>
  api
    .get(`${kohaBase}/${id}/report`, { params: { kind }, responseType: 'blob' })
    .then((r) => r.data as Blob);

const catalogueReports = `${base}/catalogue-reports`;

export type CatalogueReportDefinition = {
  key: string;
  title: string;
  group: string;
  sensitive: boolean;
  formal: boolean;
  unavailableReason: string | null;
};

export type CatalogueReportPayload = {
  key: string;
  title: string;
  institutionName: string;
  generatedAt: string;
  filters: string;
  notes: string[];
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  limit: number;
  totals: Record<string, number>;
  unavailable?: string;
};

export type CatalogueDashboard = {
  distinctTitles: number;
  physicalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueCopies: number;
  lostCopies: number;
  damagedCopies: number;
  withdrawnCopies: number;
  titlesWithoutDepartment: number;
  recentlyAcquiredCopies: number;
  growth?: { titles: number | null; copies: number | null };
  departments: {
    department: string;
    titles: number;
    copies: number;
    available: number;
    issued: number;
  }[];
};

export const fetchCatalogueReportDefinitions = () =>
  api.get<{ reports: CatalogueReportDefinition[] }>(catalogueReports).then((r) => r.data);

export const fetchCatalogueReportOptions = () =>
  api
    .get<{
      departments: { id: string; name: string; code: string }[];
      categories: { id: string; name: string; code: string }[];
      collections: { code: string; copies: number }[];
      statuses: string[];
    }>(`${catalogueReports}/options`)
    .then((r) => r.data);

export const fetchCatalogueDashboard = () =>
  api.get<CatalogueDashboard>(`${catalogueReports}/dashboard`).then((r) => r.data);

export const fetchCatalogueReport = (
  key: string,
  params: Record<string, string | number | undefined>,
) => api.get<CatalogueReportPayload>(`${catalogueReports}/${key}`, { params }).then((r) => r.data);

export const downloadCatalogueReport = (
  key: string,
  format: 'xlsx' | 'csv' | 'pdf',
  params: Record<string, string | number | undefined>,
) =>
  api
    .get(`${catalogueReports}/${key}/export`, {
      params: { ...params, format },
      responseType: 'blob',
      timeout: 600_000,
    })
    .then((r) => r.data as Blob);

const departmentInventory = `${base}/department-inventory`;

export type DepartmentInventoryCards = {
  departments: number;
  titles: number;
  copies: number;
  available: number;
  issued: number;
  lost: number;
  damaged: number;
  unmapped: number;
};

export type DepartmentInventoryRow = {
  id: string;
  code: string;
  name: string;
  titles: number;
  copies: number;
  available: number;
  issued: number;
  lost: number;
  damaged: number;
};

export type DepartmentBookRow = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publicationYear: string;
  edition: string;
  category: string;
  location: string;
  copies: number;
  available: number;
  issued: number;
  lostDamaged: number;
  callNumber: string;
  collectionType: string;
};

export const fetchDepartmentInventory = (params: Record<string, string | number | undefined>) =>
  api
    .get<{
      institutionName: string;
      generatedAt: string;
      cards: DepartmentInventoryCards;
      departments: DepartmentInventoryRow[];
      note: string;
    }>(`${departmentInventory}/summary`, { params })
    .then((r) => r.data);

export const fetchDepartmentBooks = (params: Record<string, string | number | undefined>) =>
  api
    .get<{
      page: number;
      limit: number;
      total: number;
      rows: DepartmentBookRow[];
    }>(`${departmentInventory}/books`, { params })
    .then((r) => r.data);

export const fetchDepartmentBookCopies = (bookId: string) =>
  api
    .get<
      {
        id: string;
        accession: string;
        barcode: string;
        status: string;
        callNumber: string;
        collectionCode: string;
        shelvingLocation: string;
        onLoan: boolean;
        displayStatus: string;
      }[]
    >(`${departmentInventory}/books/${bookId}/copies`)
    .then((r) => r.data);

export const fetchDepartmentRegister = (params: Record<string, string | number | undefined>) =>
  api
    .get<{
      page: number;
      limit: number;
      total: number;
      rows: {
        accession: string;
        title: string;
        author: string;
        isbn: string;
        displayStatus: string;
        department: string;
      }[];
    }>(`${departmentInventory}/register`, { params })
    .then((r) => r.data);

export const fetchUnmappedLibraryBooks = (params: Record<string, string | number | undefined>) =>
  api
    .get<{
      page: number;
      limit: number;
      total: number;
      rows: {
        id: string;
        title: string;
        author: string;
        accession: string;
        collectionCode: string;
        copies: number;
      }[];
    }>(`${departmentInventory}/unmapped`, { params })
    .then((r) => r.data);

export const assignLibraryBookDepartment = (payload: { departmentId: string; bookIds: string[] }) =>
  api
    .post<{
      department: string;
      linked: number;
      primarySet: number;
      skipped: number;
    }>(`${departmentInventory}/assign`, payload)
    .then((r) => r.data);

export const downloadDepartmentInventory = (
  format: 'xlsx' | 'csv' | 'pdf',
  params: Record<string, string | number | undefined>,
) =>
  api
    .get(`${departmentInventory}/export`, {
      params: { ...params, format },
      responseType: 'blob',
      timeout: 600_000,
    })
    .then((r) => r.data as Blob);

export const downloadEntryExitExport = (
  format: 'xlsx' | 'csv' | 'pdf',
  params?: Record<string, string | number | undefined>,
) =>
  api
    .get(`${base}/reports/entry-exit/export/${format}`, {
      params: compactParams(params),
      responseType: 'blob',
    })
    .then((r) => r.data as Blob);

const barcodeBase = `${base}/barcodes`;

export type LibraryBarcodeLabelSettings = {
  preset: 'A4_2X4' | 'SINGLE' | 'CUSTOM' | 'ROLL' | 'ZEBRA_2UP';
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  barcodeHeightMm: number;
  moduleWidth: number;
  fontSizePt: number;
  showLogo: boolean;
  showTitle: boolean;
  showAuthor: boolean;
  showDepartment: boolean;
  showCallNumber: boolean;
  showAccession: boolean;
  headerTitle: string;
  headerSubtitle: string;
  headerCode: string;
};

export type LibraryBarcodeLabelPayload = {
  copyId: string;
  accessionNumber: string;
  encodedValue: string;
  title: string;
  author: string;
  callNumber: string;
  department: string;
};

export type LibraryBarcodeCopyRow = {
  copyId: string;
  bookId: string;
  accessionNumber: string;
  barcode: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  edition: string;
  publicationYear: string;
  department: string;
  category: string;
  callNumber: string;
  copyStatus: string;
  printStatus: string;
  printable: boolean;
  blocker: string | null;
};

export const fetchBarcodeSummary = () =>
  api
    .get<{
      totalCopies: number;
      withAccession: number;
      printable: number;
      readyToPrint: number;
      confirmedLabels: number;
      missingAccession: number;
      duplicateAccessionNumbers: number;
      duplicateCopyCount: number;
      note: string;
    }>(`${barcodeBase}/summary`)
    .then((r) => r.data);

export const fetchBarcodeCopies = (params: Record<string, string | number | undefined>) =>
  api
    .get<{
      items: LibraryBarcodeCopyRow[];
      total: number;
      page: number;
      limit: number;
    }>(`${barcodeBase}/copies`, { params })
    .then((r) => r.data);

export const fetchBarcodeCopyIds = (params: Record<string, string | number | undefined>) =>
  api
    .get<{ ids: string[]; total: number; truncated: boolean; limit: number }>(
      `${barcodeBase}/copies/ids`,
      {
        params,
      },
    )
    .then((r) => r.data);

export const alignBarcodeCopies = (payload: { scope: 'ALL' | 'SELECTED'; copyIds?: string[] }) =>
  api
    .post<{
      updated: number;
      alreadyMatched: number;
      leftUnchanged: number;
      missingAccession: number;
      note: string;
    }>(`${barcodeBase}/align`, payload)
    .then((r) => r.data);

export const previewBarcodeLabels = (copyIds: string[]) =>
  api
    .post<{
      labels: LibraryBarcodeLabelPayload[];
      rejected: { copyId: string; accessionNumber: string; reason: string }[];
    }>(`${barcodeBase}/preview`, { copyIds })
    .then((r) => r.data);

export const createBarcodeJob = (payload: {
  copyIds: string[];
  mode: 'INDIVIDUAL' | 'BULK' | 'REPRINT';
}) =>
  api
    .post<{
      jobId: string;
      status: string;
      labels: LibraryBarcodeLabelPayload[];
    }>(`${barcodeBase}/jobs`, payload)
    .then((r) => r.data);

export const updateBarcodeJob = (jobId: string, status: 'DIALOG_OPENED' | 'USER_CONFIRMED') =>
  api.patch(`${barcodeBase}/jobs/${jobId}`, { status }).then((r) => r.data);

export const fetchBarcodeJobs = (page = 1) =>
  api
    .get<{
      items: {
        id: string;
        actorLabel: string | null;
        mode: string;
        status: string;
        labelCount: number;
        createdAt: string;
        sampleAccessions: string[];
        copyIds: string[];
      }[];
      total: number;
      note: string;
    }>(`${barcodeBase}/jobs`, { params: { page } })
    .then((r) => r.data);

export const fetchBarcodeSettings = () =>
  api
    .get<{
      template: LibraryBarcodeLabelSettings;
      fits: boolean;
      institutionName: string;
    }>(`${barcodeBase}/settings`)
    .then((r) => r.data);

export const saveBarcodeSettings = (template: LibraryBarcodeLabelSettings) =>
  api
    .put<{
      template: LibraryBarcodeLabelSettings;
      fits: boolean;
    }>(`${barcodeBase}/settings`, template)
    .then((r) => r.data);

export const fetchBarcodeReports = () =>
  api.get<{ key: string; title: string }[]>(`${barcodeBase}/reports`).then((r) => r.data);

export const downloadBarcodeReport = (
  key: string,
  format: 'xlsx' | 'csv' | 'pdf',
  params: Record<string, string | number | undefined>,
) =>
  api
    .get(`${barcodeBase}/reports/${key}/export`, {
      params: { ...params, format },
      responseType: 'blob',
      timeout: 600_000,
    })
    .then((r) => r.data as Blob);
