import { api } from '@/services/api';
import type {
  InventoryDashboard,
  InventoryItem,
  InventoryLabel,
  InventoryPurchaseOrder,
  InventoryRequisition,
  InventoryRestockSuggestion,
  InventoryStore,
  InventoryTransaction,
  InventoryVendor,
  InventoryVendorPrice,
} from '@/types/inventory';

const base = '/v1/inventory';

export const fetchInventoryDashboard = () =>
  api.get<InventoryDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchInventoryStores = () =>
  api.get<InventoryStore[]>(`${base}/stores`).then((r) => r.data);

export const createInventoryStore = (payload: Record<string, unknown>) =>
  api.post<InventoryStore>(`${base}/stores`, payload).then((r) => r.data);

export const fetchInventoryItems = (params?: Record<string, string | number | undefined>) =>
  api.get<InventoryItem[]>(`${base}/items`, { params }).then((r) => r.data);

export const lookupInventoryItem = (barcode: string) =>
  api.get<InventoryItem>(`${base}/items/lookup/${encodeURIComponent(barcode)}`).then((r) => r.data);

export const createInventoryItem = (payload: Record<string, unknown>) =>
  api.post<InventoryItem>(`${base}/items`, payload).then((r) => r.data);

export const fetchInventoryTransactions = (params?: Record<string, string | number | undefined>) =>
  api.get<InventoryTransaction[]>(`${base}/transactions`, { params }).then((r) => r.data);

export const receiptInventoryStock = (payload: Record<string, unknown>) =>
  api.post<InventoryTransaction>(`${base}/transactions/receipt`, payload).then((r) => r.data);

export const issueInventoryStock = (payload: Record<string, unknown>) =>
  api.post<InventoryTransaction>(`${base}/transactions/issue`, payload).then((r) => r.data);

export const returnInventoryStock = (payload: Record<string, unknown>) =>
  api.post<InventoryTransaction>(`${base}/transactions/return`, payload).then((r) => r.data);

export const fetchInventoryVendors = (params?: Record<string, string | number | undefined>) =>
  api.get<InventoryVendor[]>(`${base}/vendors`, { params }).then((r) => r.data);

export const createInventoryVendor = (payload: Record<string, unknown>) =>
  api.post<InventoryVendor>(`${base}/vendors`, payload).then((r) => r.data);

export const fetchInventoryPurchaseOrders = (
  params?: Record<string, string | number | undefined>,
) => api.get<InventoryPurchaseOrder[]>(`${base}/purchase-orders`, { params }).then((r) => r.data);

export const fetchInventoryPurchaseOrder = (id: string) =>
  api.get<InventoryPurchaseOrder>(`${base}/purchase-orders/${id}`).then((r) => r.data);

export const createInventoryPurchaseOrder = (payload: Record<string, unknown>) =>
  api.post<InventoryPurchaseOrder>(`${base}/purchase-orders`, payload).then((r) => r.data);

export const submitInventoryPurchaseOrder = (id: string) =>
  api.post<InventoryPurchaseOrder>(`${base}/purchase-orders/${id}/submit`).then((r) => r.data);

export const receiveInventoryPurchaseOrderLine = (
  id: string,
  payload: { lineId: string; quantity: number },
) =>
  api
    .post<InventoryPurchaseOrder>(`${base}/purchase-orders/${id}/receive`, payload)
    .then((r) => r.data);

export const fetchInventoryLabels = (payload?: {
  itemIds?: string[];
  storeId?: string;
  limit?: number;
}) => api.post<InventoryLabel[]>(`${base}/labels/batch`, payload ?? {}).then((r) => r.data);

export const fetchVendorPrices = (vendorId: string) =>
  api.get<InventoryVendorPrice[]>(`${base}/vendors/${vendorId}/prices`).then((r) => r.data);

export const upsertVendorPrice = (vendorId: string, payload: Record<string, unknown>) =>
  api.post<InventoryVendorPrice>(`${base}/vendors/${vendorId}/prices`, payload).then((r) => r.data);

export const fetchInventoryRequisitions = (params?: Record<string, string | number | undefined>) =>
  api.get<InventoryRequisition[]>(`${base}/requisitions`, { params }).then((r) => r.data);

export const fetchInventoryRequisition = (id: string) =>
  api.get<InventoryRequisition>(`${base}/requisitions/${id}`).then((r) => r.data);

export const createInventoryRequisition = (payload: Record<string, unknown>) =>
  api.post<InventoryRequisition>(`${base}/requisitions`, payload).then((r) => r.data);

export const submitInventoryRequisition = (id: string) =>
  api.post<InventoryRequisition>(`${base}/requisitions/${id}/submit`).then((r) => r.data);

export const approveInventoryRequisition = (id: string, payload?: Record<string, unknown>) =>
  api
    .post<InventoryRequisition>(`${base}/requisitions/${id}/approve`, payload ?? {})
    .then((r) => r.data);

export const rejectInventoryRequisition = (id: string) =>
  api.post(`${base}/requisitions/${id}/reject`).then((r) => r.data);

export const convertRequisitionToPo = (id: string, payload: Record<string, unknown>) =>
  api
    .post<InventoryRequisition>(`${base}/requisitions/${id}/convert-to-po`, payload)
    .then((r) => r.data);

export const fetchRestockSuggestions = () =>
  api.get<InventoryRestockSuggestion[]>(`${base}/suggestions/restock`).then((r) => r.data);

export const createPoFromRestockSuggestions = (payload: {
  vendorId: string;
  storeId?: string;
  itemIds: string[];
}) =>
  api.post<InventoryPurchaseOrder>(`${base}/suggestions/create-po`, payload).then((r) => r.data);

export const issueInventoryByBarcode = (payload: {
  barcode: string;
  quantity: number;
  department?: string;
  issuedToName?: string;
}) => api.post<InventoryTransaction>(`${base}/transactions/issue`, payload).then((r) => r.data);
