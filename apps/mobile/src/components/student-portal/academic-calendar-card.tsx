import { Pressable, StyleSheet, Text, View } from 'react-native';
import { studentTheme } from '@/components/student-portal/theme';
import { calendarTypeTone } from '@/components/student-portal/category-tones';

export type HomeCalendarEvent = {
  id: string;
  date: string;
  type?: string | null;
  title: string;
  subtitle?: string | null;
};

function formatDateBlock(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { day: '--', mon: '—', week: '' };
  }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    week: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
  };
}

export function AcademicCalendarCard({
  events,
  onViewAll,
}: {
  events: HomeCalendarEvent[];
  onViewAll: () => void;
}) {
  const preview = events.slice(0, 4);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconBubbleText}>📅</Text>
          </View>
          <Text style={styles.title}>Academic Calendar</Text>
        </View>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      {preview.length === 0 ? (
        <Text style={styles.empty}>
          Holidays, meetings, exams and fee due dates will appear here when published.
        </Text>
      ) : (
        <View style={styles.timeline}>
          {preview.map((ev, index) => {
            const date = formatDateBlock(ev.date);
            const tone = calendarTypeTone(ev.type);
            const last = index === preview.length - 1;
            return (
              <View key={ev.id} style={styles.row}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateDay}>{date.day}</Text>
                  <Text style={styles.dateMon}>
                    {date.mon} {date.week}
                  </Text>
                  {!last ? <View style={styles.rail} /> : null}
                </View>
                <View style={[styles.dot, { backgroundColor: tone.fg }]} />
                <View style={styles.body}>
                  <View style={styles.bodyTop}>
                    <Text style={[styles.eventIcon, { color: tone.fg }]}>{tone.icon}</Text>
                    <View style={styles.textCol}>
                      <Text style={styles.eventTitle} numberOfLines={3}>
                        {ev.title}
                      </Text>
                      {shouldShowTypeLabel(ev.type) ? (
                        <Text style={[styles.typeLabel, { color: tone.fg }]}>{tone.label}</Text>
                      ) : null}
                      {ev.subtitle ? (
                        <Text style={styles.eventMeta} numberOfLines={2}>
                          {ev.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Pressable style={styles.cta} onPress={onViewAll}>
        <Text style={styles.ctaText}>View full calendar →</Text>
      </Pressable>
    </View>
  );
}

/** Prefer icon/dot for generic meetings; keep a quiet label only for distinct types. */
function shouldShowTypeLabel(type?: string | null) {
  const key = String(type ?? '').toLowerCase();
  return ['exam', 'holiday', 'assignment', 'fee', 'prayer'].includes(key);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  viewAll: { fontSize: 13, fontWeight: '700', color: studentTheme.primaryLight },
  empty: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 19 },
  timeline: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 14,
    minHeight: 64,
  },
  dateCol: {
    width: 52,
    alignItems: 'flex-start',
    position: 'relative',
  },
  dateDay: { fontSize: 16, fontWeight: '800', color: studentTheme.text, lineHeight: 18 },
  dateMon: {
    fontSize: 9,
    fontWeight: '700',
    color: studentTheme.textMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  rail: {
    position: 'absolute',
    left: 8,
    top: 36,
    bottom: -14,
    width: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  body: { flex: 1, paddingRight: 2 },
  bodyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eventIcon: { fontSize: 15, marginTop: 1 },
  textCol: { flex: 1, gap: 2 },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: studentTheme.text,
    lineHeight: 20,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  eventMeta: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 16 },
  cta: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: studentTheme.primaryLight, fontWeight: '700', fontSize: 13 },
});
