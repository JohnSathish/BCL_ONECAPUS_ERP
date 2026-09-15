'use client';

import { useParams } from 'next/navigation';
import { ExamEditorDesk } from '@/components/school-sis/exams/exam-editor-desk';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ExamEditorDesk examId={params.id} />;
}
