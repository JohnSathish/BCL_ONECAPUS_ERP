export type InventoryStore = {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  status: string;
  _count?: { items: number };
};

export type InventoryItem = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category?: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  status: string;
  store?: { id: string; code: string; name: string };
};

export type InventoryTransaction = {
  id: string;
  transactionType: string;
  quantity: number;
  balanceAfter: number;
  department?: string | null;
  issuedToName?: string | null;
  notes?: string | null;
  createdAt: string;
  item?: { sku: string; name: string; unit: string };
  store?: { code: string; name: string };
};

export type InventoryVendor = {
  id: string;
  code: string;
  name: string;
  contactName?: string | null;
  mobile?: string | null;
  email?: string | null;
  status: string;
  _count?: { purchaseOrders: number };
};

export type InventoryPurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  totalAmount?: string | null;
  vendor?: { code: string; name: string };
  store?: { code: string; name: string } | null;
  _count?: { lines: number };
  lines?: InventoryPurchaseOrderLine[];
};

export type InventoryPurchaseOrderLine = {
  id: string;
  description: string;
  sku?: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice?: string | null;
  item?: { id: string; sku: string; name: string; barcode: string } | null;
};

export type InventoryLabel = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  storeCode: string;
  scanPayload: string;
  barcodeImageUrl: string;
  qrImageUrl: string;
};

export type InventoryDashboard = {
  activeStores: number;
  activeItems: number;
  activeVendors: number;
  openPurchaseOrders: number;
  pendingRequisitions: number;
  restockSuggestionCount: number;
  lowStockCount: number;
  issuesLast7Days: number;
  totalUnitsOnHand: number;
  lowStockItems: Array<{
    id: string;
    sku: string;
    name: string;
    quantityOnHand: number;
    reorderLevel: number;
  }>;
  categoryBreakdown: Array<{ category: string; itemCount: number; totalUnits: number }>;
};

export type InventoryVendorPrice = {
  id: string;
  unitPrice: string;
  minOrderQty: number;
  leadDays?: number | null;
  item?: { id: string; sku: string; name: string; unit: string };
  vendor?: { id: string; code: string; name: string };
};

export type InventoryRequisition = {
  id: string;
  requisitionNo: string;
  department: string;
  status: string;
  requestedByName?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { lines: number };
  purchaseOrder?: { id: string; poNumber: string; status: string } | null;
  lines?: Array<{
    id: string;
    quantityRequested: number;
    quantityApproved?: number | null;
    item: { id: string; sku: string; name: string; unit: string; quantityOnHand: number };
  }>;
};

export type InventoryRestockSuggestion = {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  suggestedOrderQty: number;
  preferredVendor?: {
    id: string;
    code: string;
    name: string;
    unitPrice: number;
    minOrderQty: number;
  } | null;
  vendorOptions: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    unitPrice: number;
  }>;
};
