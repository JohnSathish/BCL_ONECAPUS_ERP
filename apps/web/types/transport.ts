export type TransportDashboard = {
  activeRoutes: number;
  activeVehicles: number;
  assignedStudents: number;
  totalCapacity: number;
  utilizationPercent: number;
  routesAtCapacity?: number;
  routesNearCapacity?: number;
  capacityAlerts?: TransportCapacityAlert[];
  routeLoad: {
    id: string;
    code: string;
    name: string;
    assigned: number;
    capacity: number;
    utilizationPct?: number;
    atCapacity?: boolean;
    nearCapacity?: boolean;
  }[];
};

export type TransportCapacityAlert = {
  routeId: string;
  code: string;
  name: string;
  assigned: number;
  capacity: number;
  utilizationPct: number;
  atCapacity: boolean;
  nearCapacity: boolean;
  warningPercent: number;
  severity: 'CRITICAL' | 'WARNING' | 'OK';
};

export type TransportStudentOption = {
  id: string;
  enrollmentNumber: string;
  fullName: string;
  mobile?: string | null;
};

export type TransportRoute = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  startPoint?: string | null;
  endPoint?: string | null;
  fareAmount?: string | null;
  capacityWarningPercent?: number;
  status: string;
  stops?: TransportStop[];
  vehicles?: TransportVehicle[];
  _count?: { assignments: number };
};

export type TransportStop = {
  id: string;
  name: string;
  sortOrder: number;
  pickupTime?: string | null;
};

export type TransportVehicle = {
  id: string;
  registrationNo: string;
  vehicleType: string;
  capacity: number;
  driverName?: string | null;
  driverMobile?: string | null;
  routeId?: string | null;
  status: string;
  route?: { id: string; code: string; name: string } | null;
};

export type TransportAssignment = {
  id: string;
  studentId: string;
  routeId: string;
  stopId?: string | null;
  status: string;
  assignedAt: string;
  notificationStatus?: string | null;
  parentNotifiedAt?: string | null;
  studentName?: string;
  enrollmentNumber?: string;
  route?: { code: string; name: string };
  stop?: { name: string; pickupTime?: string | null } | null;
};
