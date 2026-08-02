import { Pressable, StyleSheet, Text, View } from 'react-native';
import { studentTheme } from '@/components/student-portal/theme';
import { categoryTone } from '@/components/student-portal/category-tones';

export type SnapshotChip = {
  category: string;
  label: string;
  courseTitle: string;
  credits?: number | null;
  courseCode?: string | null;
};

export function AcademicSnapshotCard({
  chips,
  onOpen,
}: {
  chips: SnapshotChip[];
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconBubbleText}>📚</Text>
          </View>
          <Text style={styles.title}>Academic Snapshot</Text>
        </View>
        <Pressable onPress={onOpen} hitSlop={8}>
          <Text style={styles.viewAll}>View Full Profile</Text>
        </Pressable>
      </View>

      {chips.length === 0 ? (
        <Pressable onPress={onOpen}>
          <Text style={styles.empty}>
            View your Major, MDC, AEC, SEC, and VTC registration details.
          </Text>
          <Text style={styles.link}>Open My Academics →</Text>
        </Pressable>
      ) : (
        chips.map((chip) => {
          const tone = categoryTone(chip.category);
          return (
            <Pressable
              key={`${chip.category}-${chip.courseTitle}`}
              style={styles.row}
              onPress={onOpen}
            >
              <View style={[styles.catPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.catPillText, { color: tone.fg }]}>
                  {chip.category || chip.label}
                </Text>
              </View>
              <Text style={styles.courseTitle} numberOfLines={2}>
                {chip.courseTitle}
              </Text>
              <Text style={styles.credits}>
                {chip.credits != null && chip.credits > 0 ? `${chip.credits} Credits` : ''}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleText: { fontSize: 14 },
  title: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  viewAll: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  empty: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 19 },
  link: { color: studentTheme.primaryLight, fontWeight: '700', marginTop: 8, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  catPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  catPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  courseTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: studentTheme.text,
    lineHeight: 17,
  },
  credits: {
    fontSize: 11,
    fontWeight: '600',
    color: studentTheme.textMuted,
    maxWidth: 72,
    textAlign: 'right',
  },
  chevron: { fontSize: 18, color: studentTheme.textSubtle, fontWeight: '300' },
});
