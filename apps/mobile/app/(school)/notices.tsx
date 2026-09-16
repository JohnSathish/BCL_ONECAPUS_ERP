import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { fetchSchoolNotices } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolNoticesScreen() {
  const q = useQuery({ queryKey: ['school-notices'], queryFn: fetchSchoolNotices });
  const rows = Array.isArray(q.data) ? (q.data as Record<string, unknown>[]) : [];
  return (
    <SchoolShell title="Announcements" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {rows.length === 0 ? (
        <SchoolEmpty title="No notices" body="School announcements will appear in this feed." />
      ) : (
        rows.map((n, i) => (
          <SchoolCard key={i}>
            <Text style={{ fontWeight: '800', color: schoolUi.colors.text }}>
              {String(n.title ?? n.headline ?? 'Notice')}
            </Text>
            <Text style={{ color: schoolUi.colors.muted, marginTop: 8 }}>
              {String(n.summary ?? n.body ?? n.excerpt ?? '')}
            </Text>
          </SchoolCard>
        ))
      )}
    </SchoolShell>
  );
}
