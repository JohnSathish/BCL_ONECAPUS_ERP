import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function FacultyTeachingLoadScreen() {
  const { home } = useFacultyPortal();
  const { width } = useWindowDimensions();
  const load = home?.teachingLoad;
  const performance = home?.performance;
  const classes = home?.myClasses ?? [];
  const compact = width < 380;

  return (
    <FacultyScreenShell title="Teaching Load" subtitle="Subjects, sections & weekly hours">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: compact ? 12 : 16 }]}
      >
        <View style={[styles.statsGrid, compact && styles.statsGridCompact]}>
          <Stat label="Subjects" value={load?.assignedSubjects ?? classes.length} />
          <Stat label="Sections" value={load?.sections ?? classes.length} />
          <Stat
            label="Weekly classes"
            value={load?.weeklyClasses ?? performance?.classesThisWeek ?? 0}
          />
          <Stat label="Credits" value={load?.credits ?? '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Assigned Classes</Text>
          {classes.length === 0 ? (
            <Text style={styles.muted}>No teaching assignments found for this session.</Text>
          ) : (
            classes.map((item) => (
              <View key={item.id} style={styles.classRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.classTitle}>{item.courseTitle}</Text>
                  <Text style={styles.classMeta}>
                    {[
                      item.courseCode,
                      item.sectionCode,
                      item.semesterNo != null ? `Sem ${item.semesterNo}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.badgeCol}>
                  <Text style={styles.badge}>{item.studentCount ?? 0} students</Text>
                  {item.weeklyHours != null ? (
                    <Text style={styles.badgeMuted}>{item.weeklyHours} hrs/wk</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, gap: 12, paddingBottom: 32 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsGridCompact: { gap: 8 },
  stat: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: facultyTheme.text },
  statLabel: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 4, fontWeight: '600' },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    gap: 10,
  },
  section: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  muted: { fontSize: 13, color: facultyTheme.textMuted },
  classRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: facultyTheme.border,
  },
  classTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  classMeta: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 2 },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: facultyTheme.primary,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeMuted: { fontSize: 11, color: facultyTheme.textMuted },
});
