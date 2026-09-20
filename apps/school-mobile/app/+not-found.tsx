import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen light insetBottom>
      <View style={styles.box}>
        <Text style={styles.title}>Let’s get you back</Text>
        <Text style={styles.body}>
          This screen could not be opened. Continue to Home or sign in.
        </Text>
        <Pressable onPress={() => router.replace('/home')} style={styles.primary}>
          <Text style={styles.primaryText}>Go to Home</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/login')} style={styles.secondary}>
          <Text style={styles.secondaryText}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: space.lg, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy },
  body: { color: colors.muted, lineHeight: 22, marginBottom: 8 },
  primary: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: {
    backgroundColor: '#eef1f8',
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.navy, fontWeight: '800' },
});
