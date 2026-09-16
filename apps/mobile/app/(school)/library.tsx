import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { fetchSchoolLibrary } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolLibraryScreen() {
  const features = useSchoolSession((s) => s.features);
  const childId = useSchoolSession((s) => s.childId);
  const q = useQuery({
    queryKey: ['school-lib-me', childId],
    queryFn: () => fetchSchoolLibrary(childId),
    enabled: features.library !== false,
  });
  const loans = ((q.data?.loans as Array<Record<string, unknown>>) ?? []).filter(
    (l) => l.status === 'ISSUED',
  );
  const fines = ((q.data?.fines as Array<Record<string, unknown>>) ?? []).filter(
    (f) => f.status === 'PENDING',
  );
  return (
    <SchoolShell title="My Library" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {features.library === false ? (
        <SchoolEmpty
          title="Library is disabled"
          body="This school has not enabled the library module."
        />
      ) : !loans.length && !fines.length ? (
        <SchoolEmpty
          title="No books issued"
          body="Issued copies, due dates and fines will show here."
        />
      ) : (
        <>
          {loans.map((l) => (
            <SchoolCard key={String(l.id)}>
              <Text style={{ fontWeight: '800', color: schoolUi.colors.text }}>
                {String((l.copy as { book?: { title?: string } })?.book?.title ?? 'Book')}
              </Text>
              <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
                Due {String(l.dueAt).slice(0, 10)}
              </Text>
            </SchoolCard>
          ))}
          {fines.map((f) => (
            <SchoolCard key={String(f.id)}>
              <Text style={{ fontWeight: '800', color: schoolUi.colors.text }}>
                Fine ₹{String(f.amount)}
              </Text>
              <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
                {String(f.kind)} · {String(f.status)}
              </Text>
            </SchoolCard>
          ))}
        </>
      )}
    </SchoolShell>
  );
}
