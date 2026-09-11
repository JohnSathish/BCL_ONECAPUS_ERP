import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { clearSession } from '@/auth/session';
import { Card, Feed, GoldButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

const LINKS = [
  ['Morning prayer', '/prayer'],
  ['Timetable', '/timetable'],
  ['Attendance', '/attendance'],
  ['Fees', '/fees'],
  ['About the school', '/page/about'],
  ['Principal’s message', '/page/principal'],
  ['Admissions', '/page/admissions'],
  ['Contact', '/page/contact'],
  ['Notifications', '/inbox'],
] as const;

export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen title="More">
      <Feed>
        {LINKS.map(([label, href]) => (
          <Card key={href} onPress={() => router.push(href as never)}>
            <Text style={styles.link}>{label}</Text>
          </Card>
        ))}
        <View style={{ height: space.sm }} />
        <GoldButton
          label="Log out"
          onPress={() => {
            void clearSession().then(() => router.replace('/login'));
          }}
        />
        <Pressable onPress={() => router.push('/page/privacy' as never)}>
          <Text style={styles.privacy}>Privacy policy</Text>
        </Pressable>
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontWeight: '700', color: colors.navy },
  privacy: { textAlign: 'center', color: colors.muted, marginTop: 8 },
});
