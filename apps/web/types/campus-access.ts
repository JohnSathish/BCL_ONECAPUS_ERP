export type KioskMemberSnapshot = {
  fullName: string;
  photoUrl?: string | null;
  enrollmentNumber?: string | null;
  programme?: string | null;
  semester?: number | null;
  mobile?: string | null;
  gender?: string | null;
  status: string;
  memberType: string;
  hosteller?: boolean;
  libraryMembership?: string | null;
  booksBorrowed?: number;
  booksDue?: number;
  outstandingFine?: number;
};

export type KioskLiveStats = {
  todayEntries: number;
  todayExits: number;
  currentlyInside: number;
  peakHour: string | null;
  scansToday: number;
  studentsInside: { male: number; female: number; total: number };
  staffInside: { teaching: number; nonTeaching: number };
  visitorsInside: number;
  activity: Array<{
    at: string;
    name: string;
    programme?: string | null;
    direction: string;
  }>;
};

export type KioskBootstrap = {
  accessPoint: {
    id: string;
    code: string;
    name: string;
    accessType: string;
    location?: string | null;
    voiceEnabled: boolean;
  };
  institutionName: string;
  logoUrl?: string | null;
  stats: KioskLiveStats;
};

export type KioskScanResult = {
  allowed: boolean;
  direction: 'IN' | 'OUT' | 'NONE';
  denialReason?: string;
  member?: KioskMemberSnapshot;
  scannedAt: string;
  voiceMessage?: string;
  stats: KioskLiveStats;
};

export type AccessPointRow = {
  id: string;
  code: string;
  name: string;
  accessType: string;
  location?: string | null;
  active: boolean;
  blockOnFine: boolean;
  voiceEnabled: boolean;
  devices: Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    lastSeenAt?: string | null;
    active: boolean;
  }>;
  _count?: { logs: number };
};

export type CamsDashboard = KioskLiveStats;
