import { api } from '@/services/api';

export type Class12SubjectOption = {
  id: string;
  subjectName: string;
  sortOrder: number;
  boardCode: string;
  streamCode: string;
};

export const CLASS12_STREAM_OPTIONS = [
  { value: 'ARTS', label: 'Arts' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'COMMERCE', label: 'Commerce' },
] as const;

export function normalizeClass12Stream(stream?: string | null): string {
  const raw = String(stream ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (raw.includes('HUMANITIES') || raw.includes('ARTS')) return 'ARTS';
  if (raw.includes('SCIENCE')) return 'SCIENCE';
  if (raw.includes('COMMERCE')) return 'COMMERCE';
  return raw.replace(/[^A-Z0-9]+/g, '_');
}

export async function fetchClass12Subjects(board: string, stream: string) {
  const boardCode = String(board ?? '')
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const streamCode = normalizeClass12Stream(stream);
  if (!boardCode || !streamCode) return [];
  const { data } = await api.get<Class12SubjectOption[]>('/v1/class12/subjects', {
    params: { board: boardCode, stream: streamCode },
  });
  return data;
}
