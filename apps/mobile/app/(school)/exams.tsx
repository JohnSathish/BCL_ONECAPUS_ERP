import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { fetchSchoolExams } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolExamsScreen() {
  const childId = useSchoolSession((s) => s.childId);
  const q = useQuery({
    queryKey: ['school-exams', childId],
    queryFn: () => fetchSchoolExams(childId),
  });
  const rows = Array.isArray(q.data) ? (q.data as Record<string, unknown>[]) : [];
  return (
    <SchoolShell title="Examinations" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {rows.length === 0 ? (
        <SchoolEmpty
          title="No published results"
          body="Exam timetable and results appear after the school publishes them."
        />
      ) : (
        rows.map((exam, i) => (
          <SchoolCard key={i}>
            <Text style={{ fontWeight: '800', color: schoolUi.colors.text }}>
              {String(exam.name ?? exam.title ?? 'Examination')}
            </Text>
            <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
              {String(exam.status ?? exam.result ?? '')}
            </Text>
          </SchoolCard>
        ))
      )}
    </SchoolShell>
  );
}
