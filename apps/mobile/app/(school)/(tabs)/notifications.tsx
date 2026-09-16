import { useQuery } from '@tanstack/react-query';
import { Pressable, Text } from 'react-native';
import { fetchSchoolInbox, markSchoolInboxReadAll } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolNotificationsScreen() {
  const q = useQuery({ queryKey: ['school-inbox'], queryFn: fetchSchoolInbox });
  const items = Array.isArray(q.data?.items) ? (q.data.items as Record<string, unknown>[]) : [];
  return (
    <SchoolShell title="Notifications" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      <Pressable
        onPress={() => {
          void markSchoolInboxReadAll().then(() => q.refetch());
        }}
      >
        <Text style={{ color: schoolUi.colors.primary, fontWeight: '700', marginBottom: 8 }}>
          Mark all read
        </Text>
      </Pressable>
      {items.length === 0 ? (
        <SchoolEmpty title="You're all caught up" body="New school alerts will appear here." />
      ) : (
        items.map((item, i) => (
          <SchoolCard key={String(item.id ?? i)}>
            <Text style={{ fontWeight: '800', color: schoolUi.colors.text }}>
              {String(item.title ?? item.subject ?? 'Notice')}
            </Text>
            <Text style={{ color: schoolUi.colors.muted, marginTop: 4 }}>
              {String(item.body ?? item.preview ?? item.message ?? '')}
            </Text>
          </SchoolCard>
        ))
      )}
    </SchoolShell>
  );
}
