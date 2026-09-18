import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Feed, Screen } from '@/ui/kit';
import { colors, radii } from '@/theme/tokens';

const ITEMS = [
  {
    icon: '✅',
    title: 'Attendance',
    body: 'Today’s class-wise attendance',
    href: '/office/attendance',
  },
  {
    icon: '📊',
    title: 'Examinations',
    body: 'Published results and schedules',
    href: '/office/examinations',
  },
  { icon: '₹', title: 'Fees', body: 'Collection overview', href: '/office/fees' },
  { icon: '📄', title: 'Notices', body: 'Circulars and announcements', href: '/office/notices' },
  { icon: '📅', title: 'Calendar', body: 'Upcoming school events', href: '/(tabs)/calendar' },
  { icon: '👥', title: 'Students', body: 'Search the school roll', href: '/office/students' },
  { icon: '🧑‍🏫', title: 'Teachers', body: 'Teaching staff directory', href: '/office/teachers' },
];

export default function ReportsScreen() {
  const router = useRouter();
  return (
    <Screen title="Reports" light>
      <Feed>
        <Text style={styles.lead}>School snapshots for the principal’s office.</Text>
        {ITEMS.map((item) => (
          <Pressable key={item.title} onPress={() => router.push(item.href as never)}>
            <Card>
              <View style={styles.row}>
                <View style={styles.icon}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  body: { color: colors.muted, marginTop: 2 },
  chev: { color: colors.muted, fontSize: 22 },
});
