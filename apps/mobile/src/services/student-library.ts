import { apiFetch } from '@/api/client';

export type LibraryLoan = {
  id: string;
  issuedAt?: string;
  dueAt?: string;
  returnedAt?: string | null;
  status?: string;
  daysOverdue?: number;
  projectedFine?: number | string | null;
  copy?: {
    barcode?: string;
    book?: { title?: string; author?: string | null; isbn?: string | null };
  };
};

export type StudentLibraryDashboard = {
  stats?: {
    activeLoans?: number;
    outstandingFine?: number;
    totalLoans?: number;
    activeReservations?: number;
  };
  activeLoans?: { id: string; bookTitle?: string; dueAt?: string; isOverdue?: boolean }[];
  readingScore?: { overall?: number };
};

export type LibraryFine = {
  id: string;
  amount?: number | string;
  reason?: string | null;
  status?: string;
  loan?: { copy?: { book?: { title?: string } } };
};

export type OpacCatalogueHit = {
  id: string;
  title: string;
  author: string | null;
  publicationYear?: string | null;
  available: number;
  total: number;
  reference: number;
};

export type OpacCopy = {
  accessionNumber: string;
  barcode: string;
  callNumber: string | null;
  shelf: string | null;
  availability: string;
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
  department: string | null;
  classificationNumber: string | null;
  available: number;
  total: number;
  reference: number;
  copies: OpacCopy[];
};

export type OpacAccount = {
  announcements?: { text: string; date?: string }[];
  stats?: {
    borrowed?: number;
    overdue?: number;
    reservations?: number;
    outstandingFine?: number | null;
  };
  loans?: {
    id: string;
    title: string;
    author?: string | null;
    barcode: string;
    issuedAt?: string;
    dueAt?: string;
    overdue?: boolean;
  }[];
  history?: { id: string; title: string; returnedAt?: string | null }[];
  reservations?: { id: string; title: string; queuePosition?: number | null; status?: string }[];
};

export type OpacDigitalItem = {
  id: string;
  title: string;
  author?: string | null;
  assetType?: string;
  externalUrl?: string | null;
};

export function searchMyLibrary(q: string) {
  const params = new URLSearchParams({ q, field: 'all', limit: '12' });
  return apiFetch<{ items: OpacCatalogueHit[]; total: number }>(
    `/v1/opac/catalogue?${params.toString()}`,
  );
}

export function fetchOpacBook(id: string) {
  return apiFetch<OpacBook>(`/v1/opac/catalogue/${id}`);
}

export function fetchOpacAccount() {
  return apiFetch<OpacAccount>('/v1/opac/account');
}

export function fetchOpacDigital() {
  return apiFetch<OpacDigitalItem[]>('/v1/opac/digital');
}

export function renewMyLibraryCopy(barcode: string) {
  return apiFetch('/v1/opac/renew', {
    method: 'POST',
    body: JSON.stringify({ barcode }),
  });
}

export function fetchStudentLibraryLoans() {
  return apiFetch<LibraryLoan[]>('/v1/library/me/loans');
}

export function fetchStudentLibraryDashboard() {
  return apiFetch<StudentLibraryDashboard>('/v1/library/me/dashboard');
}

export function fetchStudentLibraryFines() {
  return apiFetch<LibraryFine[]>('/v1/library/me/fines');
}

export function formatLibraryDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
