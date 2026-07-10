import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

export default function FacultyNoticesScreen() {
  const { home } = useFacultyPortal();
  const { width } = useWindowDimensions();
  const notices = home?.departmentNotices ?? [];

  return (
    <FacultyScreenShell title="Department Notices" subtitle="Announcements for your department">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: width < 360 ? 12 : 16 }]}
      >
        {notices.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notices yet</Text>
            <Text style={styles.muted}>
              Department announcements will appear here when published by the office or HoD.
            </Text>
          </View>
        ) : (
          notices.map((notice) => (
            <View key={notice.id} style={styles.card}>
              <Text style={styles.title}>{notice.title}</Text>
              {notice.body ? <Text style={styles.body}>{notice.body}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, gap: 10, paddingBottom: 32 },
  empty: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  muted: { fontSize: 13, color: facultyTheme.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '800', color: facultyTheme.text },
  body: { fontSize: 13, color: facultyTheme.textMuted, lineHeight: 19 },
});
