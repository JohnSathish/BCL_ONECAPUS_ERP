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

export const fetchLibraryDashboard = () =>
  api.get<LibraryDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchLibraryDashboardActivity = (limit = 20) =>
  api
    .get<LibraryActivityItem[]>(`${base}/dashboard/activity`, { params: { limit } })
    .then((r) => r.data);

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
    .get<{ items: LibraryVisit[]; total: number }>(`${base}/access/visits`, { params })
    .then((r) => r.data);

export const registerLibraryVisitor = (payload: {
  fullName: string;
  mobile?: string;
  institution?: string;
  purpose?: string;
}) => api.post<LibraryVisitor>(`${base}/visitors`, payload).then((r) => r.data);

export const fetchLibraryVisitors = () =>
  api.get<LibraryVisitor[]>(`${base}/visitors`).then((r) => r.data);

export const fetchLibraryCategories = () =>
  api.get<LibraryCategory[]>(`${base}/categories`).then((r) => r.data);

export const fetchLibraryBooks = (params?: Record<string, string | number | undefined>) =>
  api.get<LibraryBookListResponse>(`${base}/books`, { params }).then((r) => r.data);

export const fetchLibraryBook = (id: string) =>
  api.get<LibraryBook>(`${base}/books/${id}`).then((r) => r.data);

export const createLibraryBook = (payload: Record<string, unknown>) =>
  api.post<LibraryBook>(`${base}/books`, payload).then((r) => r.data);

export const updateLibraryBook = (id: string, payload: Record<string, unknown>) =>
  api.patch<LibraryBook>(`${base}/books/${id}`, payload).then((r) => r.data);

export const addLibraryCopy = (payload: { bookId: string; barcode: string; copyNumber?: number }) =>
  api.post(`${base}/copies`, payload).then((r) => r.data);

export const issueLibraryBook = (memberScan: string, copyBarcode: string) =>
  api
    .post<{ loan: LibraryLoan }>(`${base}/circulation/issue`, { memberScan, copyBarcode })
    .then((r) => r.data);

export const returnLibraryBook = (copyBarcode: string) =>
  api.post(`${base}/circulation/return`, { copyBarcode }).then((r) => r.data);

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

export const fetchLibraryReservationQueue = () =>
  api.get<LibraryReservationQueueGroup[]>(`${base}/reservations/queue`).then((r) => r.data);

export const fetchLibraryCopyIncidents = (params?: { status?: string; incidentType?: string }) =>
  api.get<LibraryCopyIncident[]>(`${base}/circulation/incidents`, { params }).then((r) => r.data);

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
}) =>
  api.get<LibraryNaacReportBundle>(`${base}/reports/naac/summary`, { params }).then((r) => r.data);

export const downloadLibraryNaacReport = (
  format: 'pdf' | 'xlsx' | 'csv',
  params?: { from?: string; to?: string; academicYear?: string },
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

export const fetchLibraryReadingAnalytics = (days = 365) =>
  api
    .get<LibraryReadingAnalytics>(`${base}/analytics/reading`, { params: { days } })
    .then((r) => r.data);

export const fetchLibraryMembers = (params?: Record<string, string | number | undefined>) =>
  api.get<LibraryMemberListResponse>(`${base}/members`, { params }).then((r) => r.data);

export const fetchLibraryMemberDetail = (memberId: string, memberType: string) =>
  api
    .get<LibraryMemberDetail>(`${base}/members/${memberId}`, {
      params: { memberType },
    })
    .then((r) => r.data);

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
