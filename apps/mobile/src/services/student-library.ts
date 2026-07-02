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
