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
  isbn?: string | null;
  publisher?: string | null;
  publicationYear?: string | null;
  bookType?: string | null;
  subject?: string | null;
  language?: string | null;
  pages?: number | null;
  callNumber?: string | null;
  coverImageUrl?: string | null;
  available: number;
  total: number;
  borrowed?: number;
  reference: number;
  availability?: 'available' | 'issued' | 'reference' | 'unavailable';
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
  language?: string | null;
  category?: string | null;
  coverImageUrl?: string | null;
  available: number;
  total: number;
  borrowed?: number;
  reference: number;
  copies: OpacCopy[];
};

export type OpacAccount = {
  reservationEnabled?: boolean;
  profile?: {
    name?: string;
    code?: string | null;
    card?: string | null;
    department?: string | null;
    memberType?: string;
    status?: string;
  };
  announcements?: { text: string; date?: string }[];
  stats?: {
    borrowed?: number;
    overdue?: number;
    reservations?: number;
    outstandingFine?: number | null;
    totalBorrowed?: number;
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

export type OpacSearchField =
  | 'all'
  | 'title'
  | 'author'
  | 'isbn'
  | 'accession'
  | 'call'
  | 'publisher'
  | 'subject';

export function searchMyLibrary(input: {
  q: string;
  field?: OpacSearchField;
  page?: number;
  year?: string;
  availability?: 'available' | 'borrowed' | 'reference';
  material?: 'book' | 'journal';
}) {
  const params = new URLSearchParams({
    q: input.q,
    field: input.field ?? 'all',
    page: String(input.page ?? 1),
    limit: '20',
  });
  if (input.year) params.set('year', input.year);
  if (input.availability) params.set('availability', input.availability);
  if (input.material) params.set('material', input.material);
  return apiFetch<{ items: OpacCatalogueHit[]; total: number; page: number }>(
    `/v1/opac/catalogue?${params.toString()}`,
  );
}

export function reserveOpacBook(bookId: string) {
  return apiFetch('/v1/opac/reservations', {
    method: 'POST',
    body: JSON.stringify({ bookId }),
  });
}

export function libraryRequestMessage(error: unknown) {
  const status =
    typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status)
      : 0;
  const message = error instanceof Error ? error.message : '';
  console.warn('[opac]', status || 'network', message || error);
  if (status === 401 || /session expired/i.test(message)) {
    return 'Your session has expired. Sign in again.';
  }
  if (status === 408 || /internet|could not reach|network/i.test(message)) {
    return 'Unable to connect. Please check your internet connection.';
  }
  if (status === 404) {
    return 'The catalogue could not be loaded. Please try again in a little while.';
  }
  if (status >= 500) return 'Something went wrong. Please try again.';
  if (message && !/request failed/i.test(message)) return message;
  return 'Something went wrong. Please try again.';
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
