import { api } from '@/services/api';

export type KnowledgeDocumentStatus = {
  id: string;
  title: string;
  sourceType: string;
  version: string | null;
  status: string;
  pageCount: number | null;
  fileName: string | null;
  createdAt: string;
  _count: {
    courses: number;
    facts: number;
    semesterPlans: number;
    chunks: number;
    definitions: number;
  };
};

export type KnowledgeStatusResponse = {
  documents: KnowledgeDocumentStatus[];
  activeDocumentId: string | null;
  coursesBySemester: Array<{ semester: number | null; courses: number }>;
};

export type KnowledgeIngestResult = {
  ok: boolean;
  documentId: string;
  title: string;
  courses: number;
  facts: number;
  semesterPlans: number;
  definitions: number;
  chunks: number;
  syncedFromErp?: number;
  imported?: number;
  skipped?: number;
};

export async function getKnowledgeStatus() {
  const { data } = await api.get<KnowledgeStatusResponse>('/v1/knowledge-base/status');
  return data;
}

export async function seedFyugpFramework() {
  const { data } = await api.post<KnowledgeIngestResult>('/v1/knowledge-base/seed/fyugp-framework');
  return data;
}

export async function syncErpCatalogToKnowledge() {
  const { data } = await api.post<KnowledgeIngestResult>('/v1/knowledge-base/sync/erp-catalog');
  return data;
}

export async function uploadCurriculumPdf(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<KnowledgeIngestResult>(
    '/v1/knowledge-base/ingest/curriculum-pdf',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function uploadCoursesExcel(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<KnowledgeIngestResult>(
    '/v1/knowledge-base/ingest/courses-excel',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function uploadRegulationPdf(
  file: File,
  meta: { title: string; sourceType: string; version?: string },
) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', meta.title);
  form.append('sourceType', meta.sourceType);
  if (meta.version) form.append('version', meta.version);
  const { data } = await api.post<KnowledgeIngestResult>(
    '/v1/knowledge-base/ingest/regulation-pdf',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export const REGULATION_UPLOAD_TYPES = [
  { value: 'EXAMINATION_REGULATION', label: 'Examination Regulations' },
  { value: 'ATTENDANCE_RULE', label: 'Attendance Rules' },
  { value: 'FEE_RULE', label: 'Fee Rules' },
  { value: 'ADMISSION_RULE', label: 'Admission Rules' },
  { value: 'HOSTEL_RULE', label: 'Hostel Rules' },
  { value: 'HR_POLICY', label: 'HR / Service Rules' },
  { value: 'GENERAL_POLICY', label: 'General Policy' },
] as const;

export async function downloadCoursesTemplate() {
  const { data } = await api.get<Blob>('/v1/knowledge-base/template/courses.xlsx', {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'onecampus-knowledge-courses-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
