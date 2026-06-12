import { api } from '@/services/api';
import type {
  FrontOfficeAdmissionsDeskSummary,
  FrontOfficeComplaint,
  FrontOfficeDashboard,
  FrontOfficeEnquiry,
  FrontOfficeGatePass,
  FrontOfficeKioskScanResult,
  FrontOfficeListResponse,
} from '@/types/front-office';

const base = '/v1/front-office';

export const fetchFrontOfficeDashboard = () =>
  api.get<FrontOfficeDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchFrontOfficeEnquiries = (params?: Record<string, string | number | undefined>) =>
  api
    .get<FrontOfficeListResponse<FrontOfficeEnquiry>>(`${base}/enquiries`, { params })
    .then((r) => r.data);

export const createFrontOfficeEnquiry = (payload: Record<string, unknown>) =>
  api.post<FrontOfficeEnquiry>(`${base}/enquiries`, payload).then((r) => r.data);

export const updateFrontOfficeEnquiry = (id: string, payload: Record<string, unknown>) =>
  api.patch<FrontOfficeEnquiry>(`${base}/enquiries/${id}`, payload).then((r) => r.data);

export const fetchFrontOfficeGatePasses = (params?: Record<string, string | number | undefined>) =>
  api
    .get<FrontOfficeListResponse<FrontOfficeGatePass>>(`${base}/gate-passes`, { params })
    .then((r) => r.data);

export const createFrontOfficeGatePass = (payload: Record<string, unknown>) =>
  api.post<FrontOfficeGatePass>(`${base}/gate-passes`, payload).then((r) => r.data);

export const checkInFrontOfficeGatePass = (id: string) =>
  api.post<FrontOfficeGatePass>(`${base}/gate-passes/${id}/check-in`).then((r) => r.data);

export const checkOutFrontOfficeGatePass = (id: string) =>
  api.post<FrontOfficeGatePass>(`${base}/gate-passes/${id}/check-out`).then((r) => r.data);

export const fetchFrontOfficeComplaints = (params?: Record<string, string | number | undefined>) =>
  api
    .get<FrontOfficeListResponse<FrontOfficeComplaint>>(`${base}/complaints`, { params })
    .then((r) => r.data);

export const createFrontOfficeComplaint = (payload: Record<string, unknown>) =>
  api.post<FrontOfficeComplaint>(`${base}/complaints`, payload).then((r) => r.data);

export const updateFrontOfficeComplaint = (id: string, payload: Record<string, unknown>) =>
  api.patch<FrontOfficeComplaint>(`${base}/complaints/${id}`, payload).then((r) => r.data);

export const fetchFrontOfficeAdmissionsDesk = () =>
  api.get<FrontOfficeAdmissionsDeskSummary>(`${base}/admissions/desk-summary`).then((r) => r.data);

export const linkEnquiryToAdmission = (enquiryId: string, admissionApplicationId: string) =>
  api
    .post<FrontOfficeEnquiry>(`${base}/enquiries/${enquiryId}/link-admission`, {
      admissionApplicationId,
    })
    .then((r) => r.data);

export const createEnquiryFromAdmission = (applicationId: string) =>
  api
    .post<FrontOfficeEnquiry>(`${base}/enquiries/from-admission/${applicationId}`)
    .then((r) => r.data);

export const printFrontOfficeGatePass = (id: string) =>
  api.get<FrontOfficeGatePass>(`${base}/gate-passes/${id}/print`).then((r) => r.data);

export const fetchFrontOfficeKioskStatus = () =>
  api
    .get<{
      visitorsInside: number;
      activePasses: number;
      checkedInToday: number;
    }>(`${base}/kiosk/status`)
    .then((r) => r.data);

export const scanFrontOfficeKiosk = (payload: { code: string; autoCheckIn?: boolean }) =>
  api.post<FrontOfficeKioskScanResult>(`${base}/kiosk/scan`, payload).then((r) => r.data);
