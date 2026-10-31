import { getLoginRequestHeaders } from '@/lib/login-host';
import { publicClient } from '@/lib/http/public-client';
import { api } from '@/services/api';

const publicHeaders = () => getLoginRequestHeaders();

const base = '/v1/opac';

export type OpacBookCard = {
  id: string;
  title: string;
  author: string | null;
  publicationYear: string | null;
  coverImageUrl: string | null;
  total: number;
  available: number;
  reference: number;
};

export type OpacHome = {
  collegeName: string;
  campus: string | null;
  address: string | null;
  logoUrl: string | null;
  settings: {
    hours: Array<{ label: string; hours: string }>;
    announcements: Array<{ text: string; date?: string }>;
    contactPhone: string;
    contactEmail: string;
    publicSearch: boolean;
  };
  cards: {
    copies: number;
    titles: number;
    authors: number;
    categories: number;
    departments: number;
  };
  recent: OpacBookCard[];
  mostBorrowed: OpacBookCard[];
};

export type OpacSearch = {
  page: number;
  limit: number;
  total: number;
  items: OpacBookCard[];
};

export type OpacCopy = {
  id: string;
  accessionNumber: string;
  barcode: string;
  copyType: string | null;
  callNumber: string | null;
  shelf: string | null;
  status: string;
  availability: string;
  tone: 'available' | 'borrowed' | 'reference' | 'closed';
};

export type OpacBook = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publicationYear: string | null;
  edition: string | null;
  subject: string | null;
  category: string | null;
  department: string | null;
  classificationNumber: string | null;
  language: string | null;
  coverImageUrl: string | null;
  total: number;
  available: number;
  borrowed: number;
  reference: number;
  copies: OpacCopy[];
};

export type OpacAccount = {
  profile: {
    memberType: string;
    name: string;
    code: string | null;
    card: string | null;
    department: string | null;
    photoUrl: string | null;
    status: string;
  };
  showFines: boolean;
  renewalEnabled: boolean;
  reservationEnabled: boolean;
  stats: {
    borrowed: number;
    overdue: number;
    dueSoon: number;
    reservations: number;
    outstandingFine: number | null;
    totalBorrowed: number;
  };
  loans: Array<{
    id: string;
    title: string;
    author: string | null;
    accession: string;
    barcode: string;
    issuedAt: string;
    dueAt: string;
    renewalCount: number;
    overdue: boolean;
  }>;
  history: Array<{
    id: string;
    title: string;
    accession: string;
    issuedAt: string;
    returnedAt: string | null;
    renewalCount: number;
  }>;
  reservations: Array<{
    id: string;
    title: string;
    author: string | null;
    reservedAt: string;
    queuePosition: number;
    status: string;
  }>;
  fines: Array<{
    id: string;
    title: string;
    accession: string;
    amount: number;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
  announcements: Array<{ text: string; date?: string }>;
};

export const fetchOpacHome = () =>
  publicClient.get<OpacHome>(`${base}/home`, { headers: publicHeaders() }).then((r) => r.data);

export const searchOpac = (params: Record<string, string | number | undefined>) =>
  publicClient
    .get<OpacSearch>(`${base}/search`, { params, headers: publicHeaders() })
    .then((r) => r.data);

export const fetchOpacBook = (id: string) =>
  publicClient
    .get<OpacBook>(`${base}/books/${id}`, { headers: publicHeaders() })
    .then((r) => r.data);

export const fetchOpacInfo = () =>
  publicClient.get(`${base}/info`, { headers: publicHeaders() }).then((r) => r.data);

export const fetchOpacDepartments = () =>
  publicClient
    .get<Array<{ id: string; name: string; titles: number }>>(`${base}/departments`, {
      headers: publicHeaders(),
    })
    .then((r) => r.data);

export const fetchOpacDigital = (q?: string) =>
  publicClient
    .get<
      Array<{
        id: string;
        title: string;
        author: string | null;
        assetType: string;
        externalUrl: string | null;
      }>
    >(`${base}/digital`, { params: { q }, headers: publicHeaders() })
    .then((r) => r.data);

export const fetchOpacAccount = () => api.get<OpacAccount>(`${base}/account`).then((r) => r.data);

export const reserveOpacBook = (bookId: string) =>
  api.post(`${base}/reservations`, { bookId }).then((r) => r.data);

export const cancelOpacReservation = (id: string) =>
  api.post(`${base}/reservations/${id}/cancel`).then((r) => r.data);

export const renewOpacCopy = (barcode: string) =>
  api.post(`${base}/renew`, { barcode }).then((r) => r.data);

export type OpacSettings = {
  enabled: boolean;
  publicSearch: boolean;
  studentLogin: boolean;
  staffLogin: boolean;
  reservation: boolean;
  renewal: boolean;
  showFines: boolean;
  digital: boolean;
  maxReservations: number;
  reservationDays: number;
  hours: Array<{ label: string; hours: string }>;
  announcements: Array<{ text: string; date?: string }>;
  contactPhone: string;
  contactEmail: string;
};

export const fetchOpacAdminSettings = () =>
  api.get<OpacSettings>(`${base}/admin/settings`).then((r) => r.data);

export const saveOpacAdminSettings = (body: OpacSettings) =>
  api.patch<OpacSettings>(`${base}/admin/settings`, body).then((r) => r.data);

export const fetchOpacUsage = () =>
  api
    .get<{
      since: string;
      counts: Record<string, number>;
      searches: Array<{ query: string | null; count: number }>;
      views: Array<{ title: string; count: number }>;
    }>(`${base}/admin/usage`)
    .then((r) => r.data);
