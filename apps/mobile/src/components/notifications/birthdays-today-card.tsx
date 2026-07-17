import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { studentTheme } from '@/components/student-portal/theme';
import { facultyTheme } from '@/components/faculty-portal/theme';

export type BirthdayWidgetPerson = {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  role: 'student' | 'staff';
};

export type BirthdaysWidgetData = {
  isMyBirthday: boolean;
  birthdays: BirthdayWidgetPerson[];
};

type Props = {
  data?: BirthdaysWidgetData | null;
  variant?: 'student' | 'staff';
  onPressNotifications?: () => void;
};

export function BirthdaysTodayCard({ data, variant = 'student', onPressNotifications }: Props) {
  const theme = variant === 'student' ? studentTheme : facultyTheme;
  const birthdays = data?.birthdays ?? [];
  const isMyBirthday = data?.isMyBirthday ?? false;
  const hasContent = isMyBirthday || birthdays.length > 0;

  if (!hasContent) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isMyBirthday ? '#fbbf24' : theme.border,
        },
      ]}
    >
      {isMyBirthday ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🎉 Happy Birthday!</Text>
          <Text style={styles.bannerSub}>
            Wishing you a wonderful day from your campus community.
          </Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>🎂 Today's Birthdays</Text>
        {onPressNotifications ? (
          <Pressable onPress={onPressNotifications}>
            <Text style={[styles.link, { color: theme.primaryLight }]}>Alerts</Text>
          </Pressable>
        ) : null}
      </View>

      {birthdays.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>Enjoy your special day!</Text>
      ) : (
        birthdays.slice(0, 6).map((person) => (
          <View key={`${person.role}-${person.id}`} style={styles.row}>
            <StudentAvatar name={person.fullName} photoUrl={person.photoUrl} size={36} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {person.fullName}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {person.role === 'staff' ? 'Colleague' : 'Classmate'}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  banner: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9a3412',
  },
  bannerSub: {
    fontSize: 12,
    color: '#c2410c',
    lineHeight: 17,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
});
