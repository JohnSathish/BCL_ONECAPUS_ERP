import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authColors } from '@/components/auth/auth-theme';
import {
  COLLEGE_NAME,
  COLLEGE_PORTAL_SUBTITLE,
  COLLEGE_WEBSITE_URL,
  SIGN_IN_CTA,
  WELCOME_QUICK_ACCESS,
} from '@/constants/release';

export default function GuestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);
  const surface = scheme === 'dark' ? '#1e293b' : '#ffffff';

  function onItem(item: (typeof WELCOME_QUICK_ACCESS)[number]) {
    if ('url' in item && item.url) {
      void Linking.openURL(item.url).catch(() => {
        Alert.alert(item.label, 'Could not open link.');
      });
      return;
    }
    Alert.alert(item.label, 'Sign in to access this service in the mobile app.');
  }

  return (
    <View style={[styles.root, { backgroundColor: scheme === 'dark' ? '#0f172a' : '#eef2ff' }]}>
      <LinearGradient
        colors={['#1e3a8a', '#2563eb']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.headerTitle}>Guest Portal</Text>
        <Text style={styles.headerSub}>{COLLEGE_NAME}</Text>
        <Text style={styles.headerProduct}>{COLLEGE_PORTAL_SUBTITLE}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.lead, { color: colors.textMuted }]}>
          Browse public campus services without signing in.
        </Text>

        <View style={styles.grid}>
          {WELCOME_QUICK_ACCESS.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.card, { backgroundColor: surface }]}
              onPress={() => onItem(item)}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.websiteBtn}
          onPress={() => void Linking.openURL(COLLEGE_WEBSITE_URL)}
        >
          <Text style={styles.websiteText}>Visit College Website →</Text>
        </Pressable>

        <Pressable style={styles.signInBtn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.signInText}>{SIGN_IN_CTA}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#dbeafe', fontSize: 13, fontWeight: '600', marginTop: 4 },
  headerProduct: { color: '#bfdbfe', fontSize: 12, marginTop: 2 },
  body: { padding: 16, gap: 14 },
  lead: { fontSize: 13, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: { fontSize: 22 },
  label: { fontSize: 13, fontWeight: '700' },
  websiteBtn: { alignItems: 'center', paddingVertical: 12 },
  websiteText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
  signInBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
